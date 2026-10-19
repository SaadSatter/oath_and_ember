import { expect, it } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import {
  HALF,
  SERVER_HZ,
  ticksFor,
} from "../../../packages/shared/src/constants.js";
import {
  npcs,
  npcsIn,
  npcPose,
  npcInReach,
  NPC_TALK_RANGE,
} from "../../../packages/shared/src/npcs.js";
import {
  villageDoorPoint,
  villageInteriorIds,
  villageInteriors,
} from "../../../packages/shared/src/villageInteriors.js";

const village = maps.EMBERBROOK_VILLAGE;
const walls = collisionRects("EMBERBROOK_VILLAGE", {});
const blocked = (p: { x: number; y: number }, half = HALF) =>
  walls.some(
    (r) =>
      p.x + half > r.x &&
      p.x - half < r.x + r.w &&
      p.y + half > r.y &&
      p.y - half < r.y + r.h,
  );
function party() {
  const r = new GameRoom("VIL234"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const p = r.state.players[a.playerId],
    session = r.sessions.get(p.id)!;
  const send = (input: object) => {
    session.input = { ...neutral(session.input.seq + 1), ...input };
    session.received = Date.now();
    r.tick();
  };
  return { r, p, send };
}

it("follows the main house and leads on to the transition trail, both ways", () => {
  const { r, p, send } = party();
  Object.assign(p, maps.MAIN_HOUSE.points.exit);
  send({ interactHeld: true });
  expect(r.state.sceneId).toBe("EMBERBROOK_VILLAGE");
  for (const hero of Object.values(r.state.players))
    expect(blocked(hero)).toBe(false);
  // Walk the plaza road east, then up the north road, with real movement.
  send({});
  for (const goal of [{ x: 480, y: 350 }, village.points.exit]) {
    for (
      let n = 0;
      n < ticksFor(20) && Math.hypot(p.x - goal.x, p.y - goal.y) > 4;
      n++
    )
      send({
        moveX: Math.abs(goal.x - p.x) > 2 ? Math.sign(goal.x - p.x) : 0,
        moveY: Math.abs(goal.y - p.y) > 2 ? Math.sign(goal.y - p.y) : 0,
      });
    expect(Math.hypot(p.x - goal.x, p.y - goal.y)).toBeLessThanOrEqual(4);
  }
  send({});
  send({ interactHeld: true });
  expect(r.state.sceneId).toBe("TRANSITION_TRAIL");
  // And back: the trail returns the party to the village beside its exit.
  for (let n = 0; n < ticksFor(1.1); n++) r.tick();
  Object.assign(p, maps.TRANSITION_TRAIL.points.back);
  send({ interactHeld: true });
  expect(r.state.sceneId).toBe("EMBERBROOK_VILLAGE");
  for (const hero of Object.values(r.state.players))
    expect(blocked(hero)).toBe(false);
});

it("keeps every villager on open ground, inside the village, at a steady pace", () => {
  const villagers = npcsIn("EMBERBROOK_VILLAGE");
  expect(villagers.map((n) => n.sprite).sort()).toEqual(
    [
      "healer",
      "mother",
      "old_man",
      "townsfolk",
      "wizard",
      // Chapter 0's market stalls.
      "shopkeeper",
      "baker",
      "merchant",
    ].sort(),
  );
  // Plain checks per tick, one assertion per villager: same coverage, fast.
  for (const npc of villagers) {
    let previous = npcPose(npc, 0);
    const problems: string[] = [];
    // Two minutes covers every loop several times.
    for (let tick = 1; tick < SERVER_HZ * 120 && problems.length < 5; tick++) {
      const pose = npcPose(npc, tick);
      if (blocked(pose)) problems.push(`in a wall @${tick}`);
      if (
        pose.x <= 32 + HALF ||
        pose.x >= village.width - 32 - HALF ||
        pose.y <= 32 + HALF ||
        pose.y >= village.height - 32 - HALF
      )
        problems.push(`outside the village @${tick}`);
      if (
        Math.hypot(pose.x - previous.x, pose.y - previous.y) >
        npc.speed / SERVER_HZ + 1e-9
      )
        problems.push(`jumped @${tick}`);
      previous = pose;
    }
    expect(problems, npc.id).toEqual([]);
  }
});

it("never lets a villager stand where E is needed for an exit", () => {
  for (const npc of npcsIn("EMBERBROOK_VILLAGE"))
    for (let tick = 0; tick < SERVER_HZ * 120; tick += 3) {
      const pose = npcPose(npc, tick);
      for (const point of Object.values(village.points))
        expect(
          Math.hypot(pose.x - point.x, pose.y - point.y),
          `${npc.id} near an exit`,
        ).toBeGreaterThan(NPC_TALK_RANGE + 50);
    }
});

it("finds the nearest villager in talking range, the same for every client", () => {
  const elder = npcs.find((n) => n.id === "elder")!;
  const tick = 1234.5,
    pose = npcPose(elder, tick);
  expect(
    npcInReach("EMBERBROOK_VILLAGE", { x: pose.x + 20, y: pose.y }, tick)?.id,
  ).toBe("elder");
  expect(
    npcInReach(
      "EMBERBROOK_VILLAGE",
      { x: pose.x + NPC_TALK_RANGE + 5, y: pose.y },
      tick,
    ),
  ).toBeNull();
  expect(npcInReach("MAIN_HOUSE", pose, tick)).toBeNull();
  // A pure function of the tick: identical answers, no hidden state.
  expect(npcPose(elder, tick)).toEqual(npcPose(elder, tick));
  // Walkers walk; the healer keeps her post.
  const healer = npcs.find((n) => n.id === "healer")!;
  expect(npcPose(healer, 0)).toEqual(npcPose(healer, 99999));
  expect(
    new Set(Array.from({ length: 200 }, (_, t) => npcPose(elder, t * 30).x))
      .size,
  ).toBeGreaterThan(20);
});

it("lets each hero walk into every village house and back out on their own", () => {
  for (const id of villageInteriorIds.filter(
    (id) => !villageInteriors[id].outsideScene,
  )) {
    const { r, p, send } = party();
    r.transition("EMBERBROOK_VILLAGE");
    const partner = Object.values(r.state.players).find((q) => q.id !== p.id)!;
    Object.assign(p, village.points[villageDoorPoint(id)]);
    send({});
    send({ interactHeld: true });
    expect(p.sceneId).toBe(id);
    // Only the hero who used the door goes inside.
    expect(partner.sceneId).toBe("EMBERBROOK_VILLAGE");
    expect(r.state.sceneId).toBe("EMBERBROOK_VILLAGE");
    const room = maps[id],
      solids = collisionRects(id, {});
    const clear = (q: { x: number; y: number }) =>
      !solids.some(
        (s) =>
          q.x + HALF > s.x &&
          q.x - HALF < s.x + s.w &&
          q.y + HALF > s.y &&
          q.y - HALF < s.y + s.h,
      );
    expect(clear(p)).toBe(true);
    // Walk up into the room and back with real movement; furniture stays solid.
    const start = { x: p.x, y: p.y };
    for (let n = 0; n < ticksFor(1); n++) send({ moveY: -1 });
    expect(p.y).toBeLessThan(start.y - 60);
    for (
      let n = 0;
      n < ticksFor(3) && Math.hypot(p.x - start.x, p.y - start.y) > 4;
      n++
    )
      send({
        moveX: Math.abs(start.x - p.x) > 2 ? Math.sign(start.x - p.x) : 0,
        moveY: Math.abs(start.y - p.y) > 2 ? Math.sign(start.y - p.y) : 0,
      });
    const b = room.doorInteractionBounds!;
    expect(
      p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h,
    ).toBe(true);
    send({});
    send({ interactHeld: true });
    expect(p.sceneId).toBe("EMBERBROOK_VILLAGE");
    expect(
      Math.hypot(
        p.x - villageInteriors[id].outside.x,
        p.y - villageInteriors[id].outside.y,
      ),
    ).toBeLessThan(70);
    expect(blocked(p)).toBe(false);
  }
});
