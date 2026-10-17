import { expect, it } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import { HALF, ticksFor } from "../../../packages/shared/src/constants.js";
import { neutral, type Rect } from "../../../packages/shared/src/gameTypes.js";
import {
  pushableDefinitions,
  pushableRect,
} from "../../../packages/shared/src/pushables.js";
import {
  gladeBushes,
  gladeSolved,
  gladeState,
  gladeStatueLines,
  gladeRejectLines,
  gladeStatueSolid,
  nearGladeStatue,
} from "../../../packages/shared/src/statueGlade.js";

const chairDef = pushableDefinitions.find((d) => d.id === "puzzle-chair")!;
function glade() {
  const r = new GameRoom("GLADE1"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  r.transition("PUZZLE_GLADE");
  const sieg = r.state.players[a.playerId],
    coco = r.state.players[b.playerId];
  const chair = () => pushableRect(chairDef, r.state.pushableOffsets);
  return { r, sieg, coco, chair };
}
// Every spot a hero can stand on, reached by walking from the arrival point.
function reachable(walls: Rect[]) {
  const step = 8,
    seen = new Set<string>(),
    out: { x: number; y: number }[] = [];
  const free = (x: number, y: number) =>
    !walls.some(
      (r) => x + HALF > r.x && x - HALF < r.x + r.w && y + HALF > r.y && y - HALF < r.y + r.h,
    );
  const start = maps.PUZZLE_GLADE.spawn,
    queue = [[Math.round(start.x / step), Math.round(start.y / step)]];
  while (queue.length) {
    const [gx, gy] = queue.pop()!,
      key = `${gx},${gy}`;
    if (seen.has(key) || !free(gx * step, gy * step)) continue;
    seen.add(key);
    out.push({ x: gx * step, y: gy * step });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push([gx + dx, gy + dy]);
  }
  return out;
}
const reachDistance = (spots: { x: number; y: number }[], r: Rect) =>
  Math.min(
    ...spots.map((p) =>
      Math.hypot(
        Math.max(r.x - p.x, p.x - (r.x + r.w), 0),
        Math.max(r.y - p.y, p.y - (r.y + r.h), 0),
      ),
    ),
  );

it("speaks of what was lost, then thanks the heroes once seated", () => {
  expect(gladeStatueLines(undefined)[0]).toMatch(
    /waiting for someone to return to me what was lost/,
  );
  expect(gladeStatueLines({ bushesBurned: false, burnedTick: null, seatedTick: 9 })[0]).toMatch(
    /rest/,
  );
});

it("walls the chair in with dry bushes until Coco burns them", () => {
  const { r, chair } = glade();
  // Sieg can't get within push reach of the chair while the thicket stands.
  const sealed = reachable(collisionRects("PUZZLE_GLADE", r.state.puzzles, r.state.pushableOffsets));
  expect(reachDistance(sealed, chair())).toBeGreaterThan(40);
  // The chair and both big rocks can be pushed.
  expect(pushableDefinitions.filter((d) => d.scene === "PUZZLE_GLADE").map((d) => d.id)).toEqual([
    "puzzle-chair",
    "puzzle-gold-rock",
    "puzzle-purple-rock",
  ]);
  gladeState(r.state.puzzles)!.bushesBurned = true;
  const open = reachable(collisionRects("PUZZLE_GLADE", r.state.puzzles, r.state.pushableOffsets));
  expect(reachDistance(open, chair())).toBeLessThan(20);
});

it("burns the whole thicket from one of Coco's fireballs, never from enemy fire", () => {
  for (const faction of ["heroes", "enemies"] as const) {
    const { r, coco } = glade();
    const bush = gladeBushes[2];
    Object.assign(coco, { x: bush.x - 90, y: bush.y });
    r.state.projectiles.shot = {
      id: "shot",
      owner: faction === "heroes" ? coco.id : "golem",
      ...(faction === "enemies" ? { faction: "enemies" as const, damage: 12 } : {}),
      sceneId: "PUZZLE_GLADE",
      x: coco.x + 20,
      y: coco.y,
      vx: 380,
      vy: 0,
      life: 2,
    };
    for (let n = 0; n < ticksFor(0.5); n++) r.tick();
    expect(gladeState(r.state.puzzles)!.bushesBurned, faction).toBe(faction === "heroes");
    expect(r.state.projectiles.shot).toBeUndefined();
  }
});

it("lets Sieg push the chair from its corner to the statue, who sits and opens the way", () => {
  const { r, sieg, coco, chair } = glade();
  Object.assign(coco, { x: 120, y: 660 });
  gladeState(r.state.puzzles)!.bushesBurned = true;
  const session = r.sessions.get(sieg.id)!;
  // Stand Sieg behind the chair each tick and hold Push: the chair moves only
  // through the server's own push physics and collision.
  const push = (dir: "down" | "left", ticks: number) => {
    for (let n = 0; n < ticks && !gladeSolved(r.state.puzzles); n++) {
      const c = chair();
      Object.assign(
        sieg,
        dir === "down"
          ? { x: c.x + c.w / 2, y: c.y - HALF - 1, facing: Math.PI / 2 }
          : { x: c.x + c.w + HALF + 1, y: c.y + c.h / 2, facing: Math.PI },
      );
      session.input = { ...neutral(session.input.seq + 1), pushHeld: true };
      session.received = Date.now();
      r.tick();
    }
  };
  const start = chair();
  push("down", ticksFor(4));
  expect(chair().y).toBeGreaterThan(start.y + 60);
  push("left", ticksFor(10));
  expect(chair().x).toBeLessThan(start.x - 300);
  expect(gladeSolved(r.state.puzzles)).toBe(false);
  push("down", ticksFor(6));
  expect(gladeSolved(r.state.puzzles)).toBe(true);
  expect(r.state.puzzles.statueChair.complete).toBe(true);
  // Seated for good: the chair can no longer be pushed away.
  const settled = chair();
  push("left", ticksFor(1));
  expect(chair()).toEqual(settled);
  // The exit before her now takes the party onward.
  for (let n = 0; n < ticksFor(1.1); n++) r.tick();
  Object.assign(sieg, maps.PUZZLE_GLADE.points.exit);
  session.input = { ...neutral(session.input.seq + 1), interactHeld: true };
  session.received = Date.now();
  r.tick();
  expect(r.state.sceneId).toBe("MONSTER_CLEARING");
});

it("keeps the way onward sealed until she is seated", () => {
  const { r, sieg } = glade();
  for (let n = 0; n < ticksFor(1.1); n++) r.tick();
  Object.assign(sieg, maps.PUZZLE_GLADE.points.exit);
  const session = r.sessions.get(sieg.id)!;
  session.input = { ...neutral(session.input.seq + 1), interactHeld: true };
  session.received = Date.now();
  r.tick();
  expect(r.state.sceneId).toBe("PUZZLE_GLADE");
});

it("refuses the gold and black rocks with an insult each time they're brought, without sitting", () => {
  const { r, sieg, coco } = glade();
  Object.assign(coco, { x: 120, y: 660 });
  const session = r.sessions.get(sieg.id)!;
  const rockAt = (id: string) =>
    pushableRect(pushableDefinitions.find((d) => d.id === id)!, r.state.pushableOffsets);
  // Push a rock east (Sieg stands to its west) with the real push physics.
  const pushEast = (id: string, ticks: number) => {
    for (let n = 0; n < ticks; n++) {
      const c = rockAt(id);
      Object.assign(sieg, { x: c.x - HALF - 1, y: c.y + c.h / 2, facing: 0 });
      session.input = { ...neutral(session.input.seq + 1), pushHeld: true };
      session.received = Date.now();
      r.tick();
    }
  };
  for (const [id, item] of [
    ["puzzle-gold-rock", "gold"],
    ["puzzle-purple-rock", "obsidian"],
  ] as const) {
    // Fixture: the rock waits 40 units west of her pedestal; Sieg brings it in.
    const def = pushableDefinitions.find((d) => d.id === id)!;
    r.state.pushableOffsets = {
      ...r.state.pushableOffsets,
      [id]: {
        x: gladeStatueSolid.x - 40 - def.rect.w - def.rect.x,
        y: gladeStatueSolid.y - def.rect.y,
      },
    };
    r.tick();
    expect(gladeState(r.state.puzzles)!.rejected?.item).not.toBe(item);
    pushEast(id, ticksFor(1));
    const rejected = gladeState(r.state.puzzles)!.rejected!;
    expect(rejected.item).toBe(item);
    expect(gladeSolved(r.state.puzzles)).toBe(false);
    // Once per arrival: lingering beside her doesn't repeat it...
    const tick = rejected.tick;
    for (let n = 0; n < ticksFor(1); n++) r.tick();
    expect(gladeState(r.state.puzzles)!.rejected!.tick).toBe(tick);
    // ...but taking it away and bringing it back earns another.
    r.state.pushableOffsets![id].x -= 60;
    r.tick();
    r.state.pushableOffsets![id].x += 60;
    r.tick();
    expect(gladeState(r.state.puzzles)!.rejected!.tick).toBeGreaterThan(tick);
    // Park it well clear of the next rock's approach.
    r.state.pushableOffsets![id].y += 120;
    r.tick();
  }
  expect(gladeRejectLines.gold.join(" ")).toMatch(/gold/i);
  expect(gladeRejectLines.obsidian.join(" ")).toMatch(/black, mysterious rock/i);
});

it("lets a hero speak with her from any side of the statue, but not from afar", () => {
  const s = gladeStatueSolid,
    walls = collisionRects("PUZZLE_GLADE", {});
  const standable = (p: { x: number; y: number }) =>
    !walls.some(
      (r) => p.x + HALF > r.x && p.x - HALF < r.x + r.w && p.y + HALF > r.y && p.y - HALF < r.y + r.h,
    );
  const midX = s.x + s.w / 2,
    midY = s.y + s.h / 2;
  const sides = {
    north: { x: midX, y: s.y - HALF - 2 },
    south: { x: midX, y: s.y + s.h + HALF + 2 },
    west: { x: s.x - HALF - 2, y: midY },
    east: { x: s.x + s.w + HALF + 2, y: midY },
  };
  for (const [side, at] of Object.entries(sides)) {
    expect(standable(at), side).toBe(true);
    expect(nearGladeStatue(at), side).toBe(true);
  }
  for (const far of [
    { x: midX, y: s.y - 120 },
    { x: midX, y: s.y + s.h + 80 },
    { x: s.x - 80, y: midY },
    { x: s.x + s.w + 80, y: midY },
  ])
    expect(nearGladeStatue(far), JSON.stringify(far)).toBe(false);
});
