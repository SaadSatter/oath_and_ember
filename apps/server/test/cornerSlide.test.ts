import { expect, it } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { move, CORNER_SLIDE } from "../../../packages/shared/src/movement.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { DT, HALF, ticksFor } from "../../../packages/shared/src/constants.js";
import { Prediction } from "../../client/src/net/prediction.js";
function player() {
  const r = new GameRoom("SLIDE1");
  const s = r.add("test");
  return r.state.players[s.playerId];
}
const block = { x: 200, y: 200, w: 40, h: 40 };
it("slides a cardinal step around a corner the hero only clips", () => {
  const p = player();
  // Clips the block's top edge by 6px while walking east into it.
  Object.assign(p, { x: block.x - HALF, y: block.y - HALF + 6 });
  const startY = p.y;
  move(p, { ...neutral(), moveX: 1 }, maps.MAIN_HOUSE, [block], DT);
  expect(p.x).toBe(block.x - HALF);
  expect(p.y).toBeLessThan(startY);
  expect(p.vy).toBeLessThan(0);
  for (let n = 0; n < ticksFor(1); n++)
    move(p, { ...neutral(n), moveX: 1 }, maps.MAIN_HOUSE, [block], DT);
  expect(p.y).toBe(block.y - HALF);
  expect(p.x).toBeGreaterThan(block.x + 20);
});
it("slides toward whichever corner is nearer, on every axis", () => {
  const p = player();
  Object.assign(p, { x: block.x + block.w + HALF - 4, y: block.y + block.h + HALF });
  move(p, { ...neutral(), moveY: -1 }, maps.MAIN_HOUSE, [block], DT);
  expect(p.y).toBe(block.y + block.h + HALF);
  expect(p.x).toBeGreaterThan(block.x + block.w + HALF - 4);
});
it("stays blocked when the opening is beyond the slide allowance", () => {
  const p = player();
  Object.assign(p, {
    x: block.x - HALF,
    y: block.y - HALF + CORNER_SLIDE + 1,
  });
  const start = { x: p.x, y: p.y };
  for (let n = 0; n < 10; n++)
    move(p, { ...neutral(n), moveX: 1 }, maps.MAIN_HOUSE, [block], DT);
  expect({ x: p.x, y: p.y }).toEqual(start);
  expect(p.vx).toBe(0);
  expect(p.vy).toBe(0);
});
it("never slides into another solid or through a gap narrower than the hero", () => {
  const p = player();
  const above = { x: 150, y: block.y - 2 * HALF - 4, w: 140, h: 10 };
  Object.assign(p, { x: block.x - HALF, y: block.y - HALF + 4 });
  const start = { x: p.x, y: p.y };
  move(p, { ...neutral(), moveX: 1 }, maps.MAIN_HOUSE, [block, above], DT);
  expect({ x: p.x, y: p.y }).toEqual(start);
});
it("does not alter diagonal wall sliding", () => {
  const p = player();
  Object.assign(p, { x: block.x - HALF, y: block.y - HALF + 6 });
  move(p, { ...neutral(), moveX: 1, moveY: 1 }, maps.MAIN_HOUSE, [block], DT);
  expect(p.x).toBe(block.x - HALF);
  expect(p.y).toBeGreaterThan(block.y - HALF + 6);
});
it("keeps server and client prediction in agreement through a real wall corner", () => {
  const r = new GameRoom("SLIDE2"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const p = r.state.players[a.playerId];
  const scene = p.sceneId ?? r.state.sceneId;
  const walls = collisionRects(
    scene,
    r.state.puzzles,
    r.state.pushableOffsets,
    r.state.bridgePuzzle,
    r.state.players,
    r.state.serverTick,
    p.role,
  );
  // Find a real corner in the opening scene where an eastward step clips and slides.
  let start: { x: number; y: number } | null = null;
  for (const wall of walls) {
    const probe = { ...p, x: wall.x - HALF, y: wall.y - HALF + 5 };
    const y = probe.y;
    move(probe, { ...neutral(), moveX: 1 }, maps[scene], walls, DT);
    if (probe.y < y && probe.x === wall.x - HALF) {
      start = { x: wall.x - HALF, y };
      break;
    }
  }
  expect(start).not.toBeNull();
  Object.assign(p, start);
  const prediction = new Prediction();
  prediction.reset(p, r.state.serverTick);
  const session = r.sessions.get(p.id)!;
  for (let seq = 1; seq <= 12; seq++) {
    const input = { ...neutral(seq), moveX: 1 };
    prediction.push({ ...input }, r.state);
    session.input = input;
    session.received = Date.now();
    r.tick();
    prediction.reconcile(p, r.state);
  }
  expect(p.y).toBeLessThan(start!.y);
  expect(prediction.player!.y).toBeCloseTo(p.y, 6);
  expect(prediction.error).toBeLessThan(1e-6 + 0.5 * 190 * DT * 12);
});
