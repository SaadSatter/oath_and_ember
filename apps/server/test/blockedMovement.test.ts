import { expect, it } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { move } from "../../../packages/shared/src/movement.js";
import { maps } from "../../../packages/shared/src/maps.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { DT } from "../../../packages/shared/src/constants.js";
import { selectAnimation } from "../../client/src/animation/selectAnimation.js";
import { Prediction } from "../../client/src/net/prediction.js";
function player() {
  const r = new GameRoom("WALL01");
  const s = r.add("test");
  return r.state.players[s.playerId];
}
it("stays at the nearest contact for overlapping barriers in either iteration order", () => {
  const walls = [
    { x: 100, y: 50, w: 40, h: 100 },
    { x: 100, y: 100, w: 80, h: 100 },
  ];
  for (const order of [walls, [...walls].reverse()]) {
    const p = player();
    Object.assign(p, { x: 86, y: 120 });
    for (let n = 0; n < 120; n++)
      move(p, { ...neutral(n), moveX: 1 }, maps.MAIN_HOUSE, order, DT);
    expect(p.x).toBe(87);
    expect(p.y).toBe(120);
    expect(p.vx).toBe(0);
    expect(selectAnimation(p, "TOP_DOWN")).toBe("walk_east");
    move(p, neutral(), maps.MAIN_HOUSE, order, DT);
    expect(p.x).toBe(87);
    expect(selectAnimation(p, "TOP_DOWN")).toBe("idle_right");
  }
});
it("sweeps across thin walls without tunneling and slides along them", () => {
  const p = player();
  Object.assign(p, { x: 80, y: 120 });
  const walls = [{ x: 100, y: 0, w: 8, h: 300 }];
  move(p, { ...neutral(), moveX: 1 }, maps.MAIN_HOUSE, walls, 1);
  expect(p.x).toBe(87);
  move(p, { ...neutral(), moveX: 1, moveY: 1 }, maps.MAIN_HOUSE, walls, DT);
  expect(p.x).toBe(87);
  expect(p.y).toBeGreaterThan(120);
});
it("does not teleport an idle player overlapping furniture", () => {
  const p = player();
  Object.assign(p, { x: 110, y: 110 });
  move(p, neutral(), maps.MAIN_HOUSE, [{ x: 100, y: 100, w: 40, h: 40 }], DT);
  expect([p.x, p.y]).toEqual([110, 110]);
});
it("keeps authoritative and predicted positions stable while pushing into a house wall", () => {
  const r = new GameRoom("WALL01"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const p = r.state.players[a.playerId];
  Object.assign(p, { x: 400, y: 327 });
  const prediction = new Prediction();
  prediction.reset(p);
  for (let seq = 1; seq < 100; seq++) {
    const i = { ...neutral(seq), moveY: -1 };
    prediction.push(i, r.state);
    const s = r.sessions.get(p.id)!;
    s.input = i;
    s.received = Date.now();
    r.tick();
    prediction.reconcile(p, r.state);
    expect([p.x, p.y]).toEqual([400, 327]);
    expect(prediction.error).toBe(0);
    expect(selectAnimation(p, "TOP_DOWN")).toBe("walk_north");
  }
});
it("holds all cardinal contacts for ten seconds and moves away immediately", () => {
  const box = { x: 100, y: 100, w: 80, h: 80 };
  for (const [x, y, mx, my] of [
    [87, 140, 1, 0],
    [193, 140, -1, 0],
    [140, 87, 0, 1],
    [140, 193, 0, -1],
  ]) {
    const p = player();
    Object.assign(p, { x, y });
    for (let n = 0; n < 300; n++) {
      move(
        p,
        { ...neutral(), moveX: mx, moveY: my },
        maps.MAIN_HOUSE,
        [box],
        DT,
      );
      expect([p.x, p.y]).toEqual([x, y]);
    }
    move(
      p,
      { ...neutral(), moveX: -mx, moveY: -my },
      maps.MAIN_HOUSE,
      [box],
      DT,
    );
    expect((p.x - x) * -mx + (p.y - y) * -my).toBeGreaterThan(0);
  }
});
it("slides along all four wall faces without entering the solid", () => {
  const box = { x: 100, y: 100, w: 80, h: 80 };
  for (const [x, y, mx, my] of [
    [87, 140, 1, 1],
    [193, 140, -1, -1],
    [140, 87, 1, 1],
    [140, 193, -1, -1],
  ]) {
    const p = player();
    Object.assign(p, { x, y });
    move(p, { ...neutral(), moveX: mx, moveY: my }, maps.MAIN_HOUSE, [box], DT);
    expect(
      p.x + 13 > box.x &&
        p.x - 13 < box.x + box.w &&
        p.y + 13 > box.y &&
        p.y - 13 < box.y + box.h,
    ).toBe(false);
    expect(Math.hypot(p.x - x, p.y - y)).toBeCloseTo((190 * DT) / Math.SQRT2);
  }
});
it("stays at inside corners made from adjacent and overlapping walls in either order", () => {
  const walls = [
    { x: 100, y: 0, w: 30, h: 160 },
    { x: 0, y: 100, w: 160, h: 30 },
  ];
  for (const order of [walls, [...walls].reverse()]) {
    const p = player();
    Object.assign(p, { x: 87, y: 87 });
    for (let n = 0; n < 300; n++) {
      move(p, { ...neutral(), moveX: 1, moveY: 1 }, maps.MAIN_HOUSE, order, DT);
      expect([p.x, p.y]).toEqual([87, 87]);
    }
    move(p, { ...neutral(), moveX: -1, moveY: -1 }, maps.MAIN_HOUSE, order, DT);
    expect(p.x).toBeLessThan(87);
    expect(p.y).toBeLessThan(87);
  }
});
it("allows either exit direction from the exact center of an embedded start without ejection", () => {
  for (const [mx, my] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const p = player();
    Object.assign(p, { x: 140, y: 140 });
    move(
      p,
      { ...neutral(), moveX: mx, moveY: my },
      maps.MAIN_HOUSE,
      [{ x: 100, y: 100, w: 80, h: 80 }],
      DT,
    );
    expect(Math.hypot(p.x - 140, p.y - 140)).toBeCloseTo(190 * DT);
  }
});
it("keeps house spawns, arrivals and door approaches outside every solid footprint", () => {
  for (const [scene, points] of [
    [
      "MAIN_HOUSE",
      [
        [456, 354],
        [506, 354],
        [480, 344],
        [480, 326],
      ],
    ],
    [
      "HOUSE_INTERIOR",
      [
        [608, 454],
        [640, 454],
        [608, 430],
      ],
    ],
  ] as const) {
    for (const [x, y] of points)
      expect(
        maps[scene].walls.some(
          (r) =>
            x + 13 > r.x &&
            x - 13 < r.x + r.w &&
            y + 13 > r.y &&
            y - 13 < r.y + r.h,
        ),
      ).toBe(false);
  }
});
it("keeps presentation interpolation outside a table corner instead of cutting through it", async () => {
  const { constrainMotion } =
    await import("../../../packages/shared/src/movement.js");
  const start = { x: 330, y: 343 },
    target = { x: 320, y: 353 };
  const naive = { x: 327.5, y: 345.5 };
  const table = { x: 340, y: 356, w: 122, h: 106 };
  const penetrates = (p: { x: number; y: number }) =>
    p.x + 13 > table.x &&
    p.x - 13 < table.x + table.w &&
    p.y + 13 > table.y &&
    p.y - 13 < table.y + table.h;
  expect(penetrates(naive)).toBe(true);
  let p = start;
  for (let n = 0; n < 60; n++) {
    p = constrainMotion(
      p,
      { x: (target.x - p.x) * 0.25, y: (target.y - p.y) * 0.25 },
      maps.HOUSE_INTERIOR,
      [table],
    );
    expect(penetrates(p)).toBe(false);
  }
  expect(p.x).toBeCloseTo(target.x);
  expect(p.y).toBeCloseTo(target.y);
});
