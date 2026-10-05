import {expect, it} from "vitest";
import {investigateWard, type WardSample, type AuthoritySample} from "./presentation-evidence.js";
const history: AuthoritySample[] = Array.from({length: 100}, (_,serverTick) => ({roomCode: "room", serverTick,
  players: [{id: "coco", actionState: serverTick < 80 ? "guard" : "idle", combat: null, hp: 100}]}));
const samples: WardSample[] = history.map(h => ({roomCode: h.roomCode, serverTick: h.serverTick, playerId: "coco", local: false,
  actionState: h.players[0].actionState, combat: null, hp: 100, renderId: h.serverTick, browserMs: h.serverTick * 33,
  ward: {kind: "defense", phase: h.serverTick < 80 ? "loop" : "end", visible: h.serverTick < 80, alpha: h.serverTick < 80 ? 0.9 : 0,
    elapsedMs: 1000, x: 0, y: 0, scaleX: 1, texture: "ward", frame: 0}}));
it("does not mistake legitimate post-release disappearance for hidden held Ward", () => {
  expect(investigateWard(samples, history)).toMatchObject({classification: "NOT_REPRODUCED", hiddenSamples: [], unmatched: 0});
});
it("detects a real remote disappearance at the same authoritative held tick", () => {
  const bad = samples.map(s => s.serverTick === 50 ? {...s, ward: {...s.ward, visible: false}} : s);
  expect(investigateWard(bad, history)).toMatchObject({classification: "REPRODUCED", hiddenSamples: [expect.objectContaining({serverTick: 50})]});
});
it("fails closed on missing authority or conflicting client snapshots", () => {
  expect(investigateWard(samples, []).classification).toBe("INCONCLUSIVE");
  expect(investigateWard(samples.map(s => ({...s, actionState: "idle"})), history).classification).toBe("INCONCLUSIVE");
});
