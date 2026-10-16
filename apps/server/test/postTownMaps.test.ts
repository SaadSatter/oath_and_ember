import { ticksFor } from "../../../packages/shared/src/constants.js";
import { expect, it } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import {
  collisionRects,
  maps,
  postTownRoute,
} from "../../../packages/shared/src/maps.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { move } from "../../../packages/shared/src/movement.js";

function room() {
  const r = new GameRoom("MAP234");
  const a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  return r;
}
function interact(r: GameRoom, atExit: boolean) {
  const p = Object.values(r.state.players)[0];
  Object.assign(
    p,
    atExit
      ? maps[r.state.sceneId].points.exit
      : {
          x: maps[r.state.sceneId].spawn.x + 100,
          y: maps[r.state.sceneId].spawn.y,
        },
  );
  const s = r.sessions.get(p.id)!;
  s.input = { ...neutral(s.input.seq + 1), interactHeld: true };
  s.received = Date.now();
  r.tick();
}
it("takes both players through all four exports with server-validated exits and combat", () => {
  const r = room();
  interact(r, true);
  for (const id of Object.keys(
    postTownRoute,
  ) as (keyof typeof postTownRoute)[]) {
    expect(r.state.sceneId).toBe(id);
    const revision = r.state.worldRevision;
    interact(r, false);
    expect(r.state.sceneId).toBe(id);
    if (id === "MONSTER_CLEARING") {
      expect(Object.keys(r.state.enemies)).toHaveLength(3);
      interact(r, true);
      expect(r.state.sceneId).toBe(id);
      // Mutate server state as a fixture; clients have no completion command.
      for (const enemy of Object.values(r.state.enemies)) enemy.hp = 0;
    }
    const skillPoints = Object.values(r.state.players).map(
      (p) => p.skillPoints,
    );
    interact(r, true);
    expect(r.state.sceneId).toBe(postTownRoute[id].next);
    expect(r.state.worldRevision).toBe(revision + 1);
    Object.values(r.state.players).forEach((p, i) => {
      expect(p.sceneId).toBe(r.state.sceneId);
      expect(p.x).toBe(maps[r.state.sceneId].spawn.x + i * 50);
      expect(p.skillPoints).toBe(skillPoints[i]);
      expect(r.sessions.get(p.id)!.input.interactHeld).toBe(false);
    });
  }
  expect(r.state.sceneId).toBe("BRIDGE_RUINS");
  expect(Object.keys(r.state.enemies)).toHaveLength(0);
  expect(r.state.bridgePuzzle?.stage).toBe(1);
  expect(r.state.puzzles.gate.complete).toBe(false);
  expect(r.state.puzzles.bridge.complete).toBe(false);
});
it("keeps both arrivals clear and every exported exit reachable through shared collision", () => {
  for (const id of Object.keys(
    postTownRoute,
  ) as (keyof typeof postTownRoute)[]) {
    const map = maps[id],
      walls = collisionRects(id, {});
    const free = (x: number, y: number) =>
      !walls.some(
        (r) =>
          x + 13 > r.x &&
          x - 13 < r.x + r.w &&
          y + 13 > r.y &&
          y - 13 < r.y + r.h,
      );
    expect(free(map.spawn.x, map.spawn.y), id).toBe(true);
    expect(free(map.spawn.x + 50, map.spawn.y), id).toBe(true);
    const visited = new Set<string>(),
      queue = [{ ...map.spawn }];
    let reached = false;
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      if (Math.hypot(p.x - map.points.exit.x, p.y - map.points.exit.y) < 40) {
        reached = true;
        break;
      }
      for (const [dx, dy] of [
        [8, 0],
        [-8, 0],
        [0, 8],
        [0, -8],
      ]) {
        const x = p.x + dx,
          y = p.y + dy,
          key = `${x},${y}`;
        if (
          x < 32 ||
          y < 32 ||
          x > 992 ||
          y > 736 ||
          visited.has(key) ||
          !free(x, y)
        )
          continue;
        visited.add(key);
        queue.push({ x, y });
      }
    }
    expect(reached, id).toBe(true);
    const r = room(),
      p = Object.values(r.state.players)[0];
    Object.assign(p, { x: 50, y: 100 });
    move(p, { ...neutral(), moveX: -1 }, map, walls, 0.2);
    expect(p.x).toBeGreaterThanOrEqual(45);
  }
});

it("lets both heroes cross the clearing's southeast grass and blocks the lower-left wall cluster", () => {
  const r = room();
  r.transition("MONSTER_CLEARING");
  const map = maps.MONSTER_CLEARING;
  const walls = collisionRects("MONSTER_CLEARING", r.state.puzzles);
  for (const p of Object.values(r.state.players)) {
    // This grass used to be covered by an oversized horizontal collider.
    Object.assign(p, { x: 800, y: 550 });
    move(p, { ...neutral(), moveY: 1 }, map, walls, 0.6);
    expect(p.y).toBe(664);
    // These separate wall islands were missing from collision entirely.
    for (const [x, y, contact] of [
      [224, 540, 563],
      [288, 730, 717],
      [224, 150, 179],
    ]) {
      Object.assign(p, { x, y });
      move(p, { ...neutral(), moveY: y === 730 ? -1 : 1 }, map, walls, 0.6);
      expect(p.y).toBe(contact);
    }
    // The diagonal connector blocks movement into the L-shaped wall.
    Object.assign(p, { x: 360, y: 650 });
    move(p, { ...neutral(), moveX: -1 }, map, walls, 0.5);
    expect(p.x).toBe(333);
    Object.assign(p, { x: 330, y: 620 });
    move(p, { ...neutral(), moveX: -1 }, map, walls, 0.5);
    expect(p.x).toBe(301);
  }
});

it("returns the whole party through every campaign entrance using server-validated intent", () => {
  const r = room();
  const route = [
    "MAIN_HOUSE",
    "TRANSITION_TRAIL",
    "GRASSLANDS",
    "PUZZLE_GLADE",
    "MONSTER_CLEARING",
    "BRIDGE_RUINS",
    "GODDESS_SHRINE",
    "FOREST_RUINS",
    "AIRSHIP",
    "AIRSHIP_BOSS",
  ] as const;
  for (const scene of route.slice(1)) r.transition(scene);
  const points = Object.values(r.state.players).map((p) => p.skillPoints);
  for (let i = route.length - 1; i > 0; i--) {
    for (let n = 0; n < ticksFor(1.033); n++) r.tick();
    const p = Object.values(r.state.players)[0];
    Object.assign(p, maps[route[i]].points.back);
    const seq = r.sessions.get(p.id)!.input.seq + 1;
    r.receiveInput(p.id, { ...neutral(seq), interactHeld: true });
    r.tick();
    expect(r.state.sceneId).toBe(route[i - 1]);
    for (const player of Object.values(r.state.players)) {
      expect(player.sceneId).toBe(route[i - 1]);
      const walls = collisionRects(
        route[i - 1],
        r.state.puzzles,
        r.state.pushableOffsets,
        r.state.bridgePuzzle,
        r.state.players,
        r.state.serverTick,
        player.role,
      );
      expect(
        walls.some(
          (rect) =>
            player.x + 13 > rect.x &&
            player.x - 13 < rect.x + rect.w &&
            player.y + 13 > rect.y &&
            player.y - 13 < rect.y + rect.h,
        ),
      ).toBe(false);
      expect(r.sessions.get(player.id)!.input.interactHeld).toBe(false);
    }
  }
  expect(Object.values(r.state.players).map((p) => p.skillPoints)).toEqual(
    points,
  );
});

it("preserves the bridge boulder, completed mechanisms and enemy progress across return visits", () => {
  const r = room();
  r.transition("BRIDGE_RUINS");
  const bridge = r.state.bridgePuzzle!;
  bridge.firstGateOpen =
    bridge.goldSwitchOpen =
    bridge.finalTargetHit =
    bridge.complete =
      true;
  bridge.boulder.y = 736;
  bridge.spikeProgress = 3;
  r.transition("FOREST_RUINS");
  const enemy = Object.values(r.state.enemies)[0];
  enemy.hp = 0;
  const points = Object.values(r.state.players).map((p) => p.skillPoints);
  for (let n = 0; n < ticksFor(1.033); n++) r.tick();
  const p = Object.values(r.state.players)[0];
  Object.assign(p, maps.FOREST_RUINS.points.back);
  r.receiveInput(p.id, { ...neutral(1), interactHeld: true });
  r.tick();
  expect(r.state.sceneId).toBe("GODDESS_SHRINE");
  for (let n = 0; n < ticksFor(1.033); n++) r.tick();
  Object.assign(p, maps.GODDESS_SHRINE.points.back);
  r.receiveInput(p.id, { ...neutral(2), interactHeld: true });
  r.tick();
  expect(r.state.sceneId).toBe("BRIDGE_RUINS");
  expect(r.state.bridgePuzzle).toBe(bridge);
  expect(bridge.complete && bridge.finalTargetHit && bridge.firstGateOpen).toBe(
    true,
  );
  expect(bridge.boulder.y).toBe(736);
  expect(
    Math.hypot(
      p.x - maps.BRIDGE_RUINS.points.exit.x,
      p.y - maps.BRIDGE_RUINS.points.exit.y,
    ),
  ).toBeGreaterThan(50);
  r.transition("FOREST_RUINS");
  expect(r.state.enemies[enemy.id]?.hp ?? 0).toBe(0);
  expect(Object.values(r.state.players).map((p) => p.skillPoints)).toEqual(
    points,
  );
});

it("rejects return intent away from the entrance and prevents held-key transition loops", () => {
  const r = room();
  r.transition("GRASSLANDS");
  const p = Object.values(r.state.players)[0];
  for (let n = 0; n < ticksFor(1.033); n++) r.tick();
  Object.assign(p, {
    x: maps.GRASSLANDS.spawn.x + 100,
    y: maps.GRASSLANDS.spawn.y,
  });
  r.receiveInput(p.id, { ...neutral(1), interactHeld: true });
  r.tick();
  expect(r.state.sceneId).toBe("GRASSLANDS");
  r.receiveInput(p.id, neutral(2));
  r.tick();
  Object.assign(p, maps.GRASSLANDS.points.back);
  r.receiveInput(p.id, { ...neutral(3), interactHeld: true });
  r.tick();
  expect(r.state.sceneId).toBe("TRANSITION_TRAIL");
  Object.assign(p, maps.TRANSITION_TRAIL.points.back);
  const held = 4 + ticksFor(1.367);
  for (let seq = 4; seq < held; seq++) {
    r.receiveInput(p.id, { ...neutral(seq), interactHeld: true });
    r.tick();
  }
  expect(r.state.sceneId).toBe("TRANSITION_TRAIL");
  r.receiveInput(p.id, neutral(held));
  r.tick();
  r.receiveInput(p.id, { ...neutral(held + 1), interactHeld: true });
  r.tick();
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
});
