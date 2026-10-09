import { expect, it } from "vitest";
import { GameRoom } from "../../server/src/GameRoom.js";
import { Prediction } from "../src/net/prediction.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
it("does not rewind diagonal wall sliding when two sampled inputs are acknowledged in one server tick", () => {
  const r = new GameRoom("PROBE1"),
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
  for (let seq = 1; seq <= 2; seq++)
    prediction.push({ ...neutral(seq), moveX: 1, moveY: -1 }, r.state);
  const before = prediction.player!.x;
  const session = r.sessions.get(p.id)!;
  session.input = { ...neutral(2), moveX: 1, moveY: -1 };
  session.received = Date.now();
  r.tick();
  prediction.reconcile(p, r.state);
  expect(prediction.player!.x).toBe(before);
  expect(prediction.player!.y).toBe(327);
  r.tick();
  prediction.reconcile(p, r.state);
  expect(prediction.player!.x).toBe(p.x);
});
it("preserves stable corner sliding with alternating zero/two input samples per server tick", () => {
  const r = new GameRoom("PROBE2"),
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
  let seq = 0,
    last = { x: p.x, y: p.y };
  for (let tick = 0; tick < 300; tick++) {
    for (let n = 0; n < (tick % 2 === 0 ? 2 : 0); n++) {
      const input = { ...neutral(++seq), moveX: 1, moveY: -1 };
      prediction.push(input, r.state);
      const s = r.sessions.get(p.id)!;
      s.input = input;
      s.received = Date.now();
    }
    r.tick();
    prediction.reconcile(p, r.state);
    const q = prediction.player!;
    expect(q.x).toBeGreaterThanOrEqual(last.x);
    expect(q.y).toBeLessThanOrEqual(last.y);
    last = { x: q.x, y: q.y };
  }
  expect([prediction.player!.x, prediction.player!.y]).toEqual([p.x, p.y]);
  expect([p.x, p.y]).toEqual([483, 311]);
});
it("does not turn immediate action packets into extra movement steps", () => {
  const r = new GameRoom("PROBE3"),
    p = r.state.players[r.add("a").playerId];
  Object.assign(p, { x: 400, y: 327 });
  const prediction = new Prediction();
  prediction.reset(p);
  prediction.push({ ...neutral(1), moveX: 1 }, r.state);
  const x = prediction.player!.x;
  prediction.push(
    { ...neutral(2), moveX: 1, primaryHeld: true },
    r.state,
    false,
  );
  prediction.push({ ...neutral(3), moveX: 1 }, r.state, false);
  expect(prediction.player!.x).toBe(x);
});
it("anchors prediction to the existing server tick when a hero changes independent scenes", () => {
  const r = new GameRoom("PROBE4"),
    p = r.state.players[r.add("a").playerId];
  r.state.serverTick = 500;
  Object.assign(p, { sceneId: "HOUSE_INTERIOR", x: 608, y: 454 });
  const prediction = new Prediction();
  prediction.reset(p, r.state.serverTick);
  prediction.push({ ...neutral(1), moveX: 1 }, r.state);
  p.x += 190 / 30;
  p.lastProcessedInputSeq = 1;
  r.state.serverTick++;
  prediction.reconcile(p, r.state);
  expect(prediction.player!.x).toBe(p.x);
  expect(prediction.error).toBe(0);
});
it("does not expire unacknowledged movement while delayed neutral acknowledgements advance server time", () => {
  const r = new GameRoom("DELAY1"),
    p = r.state.players[r.add("a").playerId];
  Object.assign(p, { x: 400, y: 327 });
  const prediction = new Prediction();
  prediction.reset(p);
  let last = p.x;
  for (let seq = 1; seq <= 12; seq++) {
    prediction.push({ ...neutral(seq), moveX: 1, moveY: -1 }, r.state);
    r.state.serverTick += 2;
    prediction.reconcile(p, r.state);
    expect(prediction.player!.x).toBeGreaterThanOrEqual(last);
    last = prediction.player!.x;
  }
});
it("keeps prediction lead bounded over sustained delayed snapshots and settles on release", () => {
  const r = new GameRoom("SPRING"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const p = r.state.players[a.playerId];
  Object.assign(p, { sceneId: "FOREST_RUINS", x: 100, y: 450 });
  const prediction = new Prediction();
  prediction.reset(p);
  const inputs = [neutral()];
  let snapshot = structuredClone(r.state);
  let maxCorrection = 0;
  for (let seq = 1; seq <= 300; seq++) {
    // Client timers occasionally run an extra sample before the next server tick.
    const input = { ...neutral(seq), moveX: seq > 180 ? 0 : 1 };
    if (seq % 10 === 0)
      prediction.push({ ...input, seq: seq * 2 - 1 }, snapshot);
    input.seq = seq * 2;
    prediction.push(input, snapshot);
    const session = r.sessions.get(p.id)!;
    inputs.push(input);
    session.input = inputs[Math.max(0, seq - 3)];
    session.received = Date.now();
    r.tick();
    if (seq > 3 && seq % 2 === 0) {
      snapshot = structuredClone(r.state);
      prediction.reconcile(snapshot.players[p.id], snapshot);
      maxCorrection = Math.max(maxCorrection, prediction.error);
      expect(Math.abs(prediction.player!.x - p.x)).toBeLessThanOrEqual(
        (4 * 190) / 30 + 1e-6,
      );
    }
  }
  expect(maxCorrection).toBeLessThanOrEqual((4 * 190) / 30 + 1e-6);
  expect(prediction.player!.x).toBeCloseTo(p.x);
});
