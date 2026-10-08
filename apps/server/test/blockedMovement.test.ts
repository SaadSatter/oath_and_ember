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
