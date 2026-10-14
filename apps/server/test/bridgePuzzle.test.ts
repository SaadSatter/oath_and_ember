import { expect, it } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import type { Projectile } from "../../../packages/shared/src/gameTypes.js";
import {
  bridgePoints as P,
  bridgeRects,
  boulderRect,
  heavyOnPlate,
  bridgeEntryTargetVisible,
  hitBridgeEntryTarget,
  bridgeOpen,
  bridgeTrap,
  hitBridgeLock,
} from "../../../packages/shared/src/bridgePuzzle.js";
function fixture() {
  const r = new GameRoom("BRIDGE", false, "BRIDGE_RUINS"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const sieg = r.state.players[a.playerId],
    coco = r.state.players[b.playerId],
    s = r.state.bridgePuzzle!;
  const input = (p: typeof sieg, extra: object = {}) =>
    r.receiveInput(p.id, {
      ...neutral(r.sessions.get(p.id)!.input.seq + 1),
      ...extra,
    });
  const ticks = (n = 1) => {
    for (let i = 0; i < n; i++) r.tick();
  };
  return { r, sieg, coco, s, input, ticks };
}
function shot(
  owner: string,
  x: number,
  y: number,
  vx = 0,
  vy = -180,
): Projectile {
  return {
    id: "shot",
    owner,
    sceneId: "BRIDGE_RUINS",
    castOrigin: { x, y },
    x,
    y,
    vx,
    vy,
    life: 4,
  };
}
it("requires BOTH heavy weight on A and a frontal moving-target hit, then latches gate 1", () => {
  const { r, sieg, coco, s, input, ticks } = fixture();
  Object.assign(sieg, P.plateA);
  ticks();
  expect(s.firstGateOpen).toBe(false);
  s.trapClock = 0.5;
  Object.assign(coco, { x: 728, y: 1216, facing: -Math.PI / 2 });
  input(coco, { primaryHeld: true });
  ticks();
  input(coco, {});
  ticks(15);
  expect(s.targetHit).toBe(false);
  expect(s.firstGateOpen).toBe(false);
  Object.assign(sieg, { x: 288, y: 1448 });
  for (let n = 0; n < 24; n++) {
    input(sieg, { moveY: -1, pushHeld: true });
    ticks();
  }
  expect(heavyOnPlate(s, "A")).toBe(true);
  expect(s.firstGateOpen).toBe(false);
  s.trapClock = 0.5;
  input(coco, { primaryHeld: true });
  ticks();
  input(coco, {});
  ticks(15);
  expect(s.targetHit).toBe(true);
  expect(s.firstGateOpen).toBe(true);
  s.boulder.y = 1200;
  ticks();
  expect(s.firstGateOpen).toBe(true);
});
it("shows the entry target only while the boulder weights A and rejects shots while it is absent", () => {
  const { r, coco, sieg, s, input, ticks } = fixture();
  const q = shot(coco.id, 728, 1216);
  expect(bridgeEntryTargetVisible(s)).toBe(false);
  expect(hitBridgeEntryTarget(r.state, coco.id, q)).toBe(false);
  Object.assign(s.boulder, P.plateA);
  expect(bridgeEntryTargetVisible(s)).toBe(true);
  Object.assign(sieg, { x: 230, y: 1264 });
  for (let i = 0; i < 12; i++) {
    input(sieg, { moveX: 1, pushHeld: true });
    ticks();
  }
  expect(bridgeEntryTargetVisible(s)).toBe(false);
  expect(hitBridgeEntryTarget(r.state, coco.id, q)).toBe(false);
  expect(s.targetHit).toBe(false);
  expect(s.firstGateOpen).toBe(false);
  Object.assign(s.boulder, P.plateA);
  expect(bridgeEntryTargetVisible(s)).toBe(true);
  expect(hitBridgeEntryTarget(r.state, coco.id, q)).toBe(true);
  ticks();
  expect(s.firstGateOpen).toBe(true);
  s.boulder.y = 1200;
  expect(bridgeEntryTargetVisible(s)).toBe(false);
  ticks();
  expect(s.firstGateOpen).toBe(true);
});
it("blocks Coco at her gate until her moving target is shot, even with the rock on A", () => {
  const { coco, s, input, ticks } = fixture();
  Object.assign(s.boulder, P.plateA);
  Object.assign(coco, { x: 672, y: 1160 });
  for (let i = 0; i < 30; i++) {
    input(coco, { moveY: -1 });
    ticks();
  }
  expect(s.firstGateOpen).toBe(false);
  expect(coco.y).toBeGreaterThanOrEqual(1136);
  s.trapClock = 0.5;
  Object.assign(coco, { x: 728, y: 1216, facing: -Math.PI / 2 });
  input(coco, { primaryHeld: true });
  ticks();
  input(coco, {});
  ticks(15);
  expect(s.targetHit).toBe(true);
  expect(s.firstGateOpen).toBe(true);
  for (let i = 0; i < 30; i++) {
    input(coco, { moveY: -1 });
    ticks();
  }
  expect(coco.y).toBeLessThan(1120);
});
it("rejects moving-target back and side hits, and Sieg projectiles", () => {
  for (const [owner, origin, vx, vy] of [
    ["coco", { x: 728, y: 1100 }, 0, 180],
    ["coco", { x: 780, y: 1160 }, -180, 0],
    ["sieg", { x: 728, y: 1216 }, 0, -180],
  ] as const) {
    const { r, sieg, coco, s, ticks } = fixture();
    Object.assign(s.boulder, P.plateA);
    s.trapClock = 0.75;
    Object.assign(coco, { x: 728, y: 1216 });
    const q = shot(
      owner === "coco" ? coco.id : sieg.id,
      origin.x,
      origin.y,
      vx,
      vy,
    );
    q.x = 728;
    q.y = 1175;
    r.state.projectiles[q.id] = q;
    ticks();
    expect(s.targetHit).toBe(false);
  }
});
it("Coco's golden switch permanently releases the spike entry after her first gate", () => {
  const { s, coco, input, ticks } = fixture();
  Object.assign(coco, P.goldSwitch);
  input(coco, { interactHeld: true });
  ticks();
  expect(s.goldSwitchOpen).toBe(false);
  s.firstGateOpen = true;
  input(coco, { interactHeld: true });
  ticks();
  expect(s.goldSwitchOpen).toBe(true);
  Object.assign(coco, { x: 672, y: 1000 });
  input(coco, {});
  ticks();
  expect(s.goldSwitchOpen).toBe(true);
});
it("never moves the boulder without nearby Sieg pushing intent", () => {
  const { s, sieg, coco, input, ticks } = fixture();
  const start = { ...s.boulder };
  input(sieg, { moveY: -1 });
  input(coco, { moveY: -1, pushHeld: true });
  ticks(30);
  expect(s.boulder).toEqual(start);
  Object.assign(sieg, { x: 288, y: 1408 });
  input(sieg, { moveY: -1, pushHeld: true });
  ticks();
  expect(s.boulder).toEqual(start);
});
it("keeps both characters on stone paths and blocks the surrounding grass", () => {
  const { sieg, coco, input, ticks } = fixture();
  Object.assign(sieg, { x: 216, y: 600 });
  Object.assign(coco, { x: 744, y: 600 });
  for (let n = 0; n < 30; n++) {
    input(sieg, { moveX: -1 });
    input(coco, { moveX: 1 });
    ticks();
  }
  expect(sieg.x).toBeGreaterThanOrEqual(192);
  expect(coco.x).toBeLessThanOrEqual(768);
  Object.assign(sieg, { x: 288, y: 1440 });
  Object.assign(coco, { x: 672, y: 1440 });
  for (let n = 0; n < 30; n++) {
    input(sieg, { moveY: 1 });
    input(coco, { moveY: 1 });
    ticks();
  }
  expect(sieg.y).toBeLessThanOrEqual(1472);
  expect(coco.y).toBeLessThanOrEqual(1472);
});
it("Super Speed doubles physical pushing normally and restores normal pushing during Slow Time", () => {
  for (const [slow, boost, expected] of [
    [false, false, 190 / 30],
    [false, true, 380 / 30],
    [true, false, 38 / 30],
    [true, true, 190 / 30],
  ] as const) {
    const { r, s, sieg, coco, input, ticks } = fixture();
    Object.assign(sieg, { x: 288, y: 1448 });
    if (boost) r.unlock(sieg.id, "dash");
    if (slow) {
      r.unlock(coco.id, "slow_time");
      input(coco, { slowTimeHeld: true });
    }
    input(sieg, { moveY: -1, pushHeld: true, sprintHeld: boost });
    ticks();
    expect(P.boulderStart.y - s.boulder.y).toBeCloseTo(expected);
  }
});
it("pushes the SAME boulder safely through all three traps using both abilities", () => {
  const { r, s, sieg, coco, input, ticks } = fixture();
  s.firstGateOpen = s.goldSwitchOpen = true;
  s.stage = 3;
  s.trapClock = 1.2;
  Object.assign(s.boulder, P.trialStart);
  Object.assign(sieg, { x: 288, y: 1160 });
  r.unlock(sieg.id, "dash");
  r.unlock(coco.id, "slow_time");
  input(coco, { slowTimeHeld: true });
  for (let n = 0; n < 61; n++) {
    input(sieg, { moveY: -1, pushHeld: true, sprintHeld: n === 0 });
    ticks();
  }
  expect(s.failures).toBe(0);
  expect(s.boulder.id).toBe("bridge-boulder");
  expect(s.spikeProgress).toBe(3);
  expect(heavyOnPlate(s, "B")).toBe(true);
  expect(bridgeOpen(s, r.state, 1)).toBe(true);
});
it("sweeps fast pushes against stone walls and closed gates without clipping", () => {
  const { r, s, sieg, input, ticks } = fixture();
  r.unlock(sieg.id, "dash");
  s.boulder.x = 360;
  s.boulder.y = 1312;
  Object.assign(sieg, { x: 320, y: 1312 });
  for (let n = 0; n < 15; n++) {
    input(sieg, { moveX: 1, pushHeld: true, sprintHeld: n === 0 });
    ticks();
  }
  expect(boulderRect(s).x + 48).toBeLessThanOrEqual(384);
  s.boulder.x = 288;
  s.boulder.y = 1144;
  Object.assign(sieg, { x: 288, y: 1184 });
  for (let n = 0; n < 15; n++) {
    input(sieg, { moveY: -1, pushHeld: true });
    ticks();
  }
  expect(boulderRect(s).y).toBeGreaterThanOrEqual(1104);
});
it("spike contact resets Sieg and the same boulder, preserving earlier unlocks", () => {
  const { s, sieg, ticks } = fixture();
  s.firstGateOpen = s.goldSwitchOpen = true;
  s.stage = 3;
  s.trapClock = 0;
  s.boulder.x = 288;
  s.boulder.y = 1040;
  Object.assign(sieg, { x: 288, y: 1080 });
  const epoch = sieg.movementEpoch;
  ticks();
  expect(s.boulder).toEqual({ id: "bridge-boulder", x: 288, y: 1120 });
  expect(sieg.y).toBe(1160);
  expect(sieg.movementEpoch).toBe(epoch! + 1);
  expect(s.firstGateOpen && s.goldSwitchOpen).toBe(true);
  expect(s.failures).toBe(1);
});
it("spikes move from the stone edge completely into water, and Slow Time slows their clock to .2", () => {
  expect(bridgeTrap(0, 0).x).toBe(256);
  expect(bridgeTrap(1.2, 0).x).toBe(480);
  const { r, s, coco, input, ticks } = fixture();
  r.unlock(coco.id, "slow_time");
  input(coco, { slowTimeHeld: true });
  ticks();
  expect(s.trapClock).toBeCloseTo(1 / 150);
});
it("plate B ignores players; loss of weight collapses Coco's bridge without teleporting the boulder", () => {
  const { r, s, sieg, coco, ticks } = fixture();
  s.firstGateOpen = s.goldSwitchOpen = true;
  s.stage = 3;
  Object.assign(sieg, P.plateB);
  ticks();
  expect(bridgeOpen(s, r.state, 1)).toBe(false);
  Object.assign(s.boulder, P.plateB);
  Object.assign(sieg, { x: 288, y: 780 });
  ticks();
  expect(bridgeOpen(s, r.state, 1)).toBe(true);
  Object.assign(coco, P.firePad);
  s.boulder.y = 690;
  ticks();
  expect(coco.x).toBe(640);
  expect(s.boulder.y).toBe(690);
  expect(s.firstGateOpen && s.goldSwitchOpen).toBe(true);
});
it("allows Coco to reach the center firing pad, but never bypass onto Sieg's bank", () => {
  const { s, coco, input, ticks } = fixture();
  s.firstGateOpen = s.goldSwitchOpen = true;
  s.stage = 3;
  Object.assign(s.boulder, P.plateB);
  Object.assign(coco, { x: 640, y: 832 });
  for (let n = 0; n < 30; n++) {
    input(coco, { moveX: -1 });
    ticks();
  }
  expect(coco.x).toBeLessThan(500);
  expect(coco.x).toBeGreaterThanOrEqual(461);
  Object.assign(coco, { x: 672, y: 1408 });
  Object.assign(s.boulder, P.plateB);
});
it("requires a frontal shot CAST from the designated bridge pad while weighted; unlock is permanent", () => {
  const { r, s, coco, ticks } = fixture();
  s.firstGateOpen = s.goldSwitchOpen = true;
  s.stage = 3;
  Object.assign(s.boulder, P.plateB);
  Object.assign(coco, P.firePad);
  expect(hitBridgeLock(r.state, coco.id, shot(coco.id, 672, 832))).toBe(false);
  expect(hitBridgeLock(r.state, coco.id, shot(coco.id, 480, 832, 180, 0))).toBe(
    false,
  );
  expect(hitBridgeLock(r.state, coco.id, shot(coco.id, 480, 832))).toBe(true);
  s.boulder.y = 690;
  ticks();
  expect(s.finalTargetHit).toBe(true);
  expect(bridgeOpen(s, r.state, 1)).toBe(true);
});
it("the actual long-range spell opens both final gates and both final switches are still required", () => {
  const { r, s, sieg, coco, input, ticks } = fixture();
  s.firstGateOpen = s.goldSwitchOpen = true;
  s.stage = 3;
  Object.assign(s.boulder, P.plateB);
  Object.assign(sieg, { x: 288, y: 700 });
  Object.assign(coco, { ...P.firePad, facing: -Math.PI / 2 });
  input(coco, { primaryHeld: true });
  ticks();
  input(coco, {});
  ticks(65);
  expect(s.finalTargetHit).toBe(true);
  Object.assign(sieg, P.switchWest);
  ticks(30);
  expect(s.complete).toBe(false);
  Object.assign(coco, P.switchEast);
  ticks(23);
  expect(s.complete).toBe(true);
  expect(bridgeRects).toHaveLength(2);
  expect(P.firePad.y - P.target.y).toBe(416);
});

it("two real clients receive identical boulder movement and weight-plus-shot unlock", async () => {
  const { createApp } = await import("../src/app.js"),
    { io } = await import("socket.io-client");
  const app = createApp({ startingScene: "BRIDGE_RUINS" });
  await new Promise<void>((res) => app.http.listen(0, "127.0.0.1", res));
  const url = `http://127.0.0.1:${(app.http.address() as any).port}`,
    clients = [io(url), io(url)],
    histories = clients.map(() => new Map<number, any>());
  clients.forEach((c, i) =>
    c.on("game:snapshot", (w) => histories[i].set(w.serverTick, w)),
  );
  const req = (c: any, event: string, data: any) =>
    new Promise<any>((res, rej) =>
      c
        .timeout(2000)
        .emit(event, data, (e: any, r: any) => (e ? rej(e) : res(r))),
    );
  try {
    await Promise.all(
      clients.map((c) => new Promise<void>((res) => c.on("connect", res))),
    );
    const a = (await req(clients[0], "room:create", {})).data;
    await req(clients[1], "room:join", { roomCode: a.roomCode });
    await req(clients[0], "role:select", { role: "OATH" });
    await req(clients[1], "role:select", { role: "EMBER" });
    await req(clients[0], "lobby:ready", { ready: true });
    await req(clients[1], "lobby:ready", { ready: true });
    const r = app.manager.get(a.roomCode),
      s = r.state.bridgePuzzle!,
      players = Object.values(r.state.players);
    Object.assign(
      players.find((p) => p.role === "OATH")!,
      { x: 288, y: 1448 },
    );
    Object.assign(
      players.find((p) => p.role === "EMBER")!,
      { x: 728, y: 1216, facing: -Math.PI / 2 },
    );
    s.trapClock = 0.5;
    clients[0].emit("player:input", {
      ...neutral(1),
      moveY: -1,
      pushHeld: true,
    });
    for (let seq = 2; seq <= 10; seq++) {
      await new Promise((res) => setTimeout(res, 100));
      clients[0].emit("player:input", {
        ...neutral(seq),
        moveY: -1,
        pushHeld: true,
      });
    }
    expect(heavyOnPlate(s, "A")).toBe(true);
    clients[0].emit("player:input", neutral(11));
    s.trapClock = 0.5;
    clients[1].emit("player:input", { ...neutral(1), primaryHeld: true });
    await new Promise((res) => setTimeout(res, 360));
    const shared = [...histories[0].keys()].filter(
      (t) =>
        histories[1].has(t) && histories[0].get(t).bridgePuzzle.firstGateOpen,
    );
    expect(shared.length).toBeGreaterThan(0);
    for (const t of shared) {
      expect(histories[0].get(t)).toEqual(histories[1].get(t));
      const b = histories[0].get(t).bridgePuzzle.boulder;
      expect(b.id).toBe("bridge-boulder");
      expect(b.x).toBe(288);
      expect(b.y).toBeLessThan(P.boulderStart.y);
    }
  } finally {
    clients.forEach((c) => c.disconnect());
    await app.close();
  }
});

it("an occupancy collapse retries only the bridge, and final success permanently removes collapse conditions", () => {
  const { r, s, sieg, coco, ticks } = fixture();
  s.firstGateOpen = s.goldSwitchOpen = true;
  s.stage = 3;
  Object.assign(s.boulder, P.plateB);
  Object.assign(sieg, { x: 500, y: 832 });
  Object.assign(coco, { x: 480, y: 832 });
  ticks();
  expect(coco.x).toBe(640);
  expect(sieg.x).toBe(288);
  expect(s.boulder.y).toBe(736);
  expect(s.firstGateOpen && s.goldSwitchOpen).toBe(true);
  expect(bridgeOpen(s, r.state, 1)).toBe(false);
  const failures = s.failures;
  s.finalTargetHit = true;
  Object.assign(sieg, { x: 500, y: 832 });
  Object.assign(coco, { x: 480, y: 832 });
  ticks();
  expect(s.failures).toBe(failures);
  expect(sieg.x).toBe(500);
  expect(coco.x).toBe(480);
  expect(bridgeOpen(s, r.state, 1)).toBe(true);
});

it("cannot strand the boulder past the first plate before Coco unlocks gate 1", () => {
  const { s, sieg, input, ticks } = fixture();
  Object.assign(sieg, { x: 288, y: 1448 });
  for (let n = 0; n < 50; n++) {
    input(sieg, { moveY: -1, pushHeld: true });
    ticks();
  }
  expect(s.boulder.y).toBe(1264);
  expect(heavyOnPlate(s, "A")).toBe(true);
  expect(s.firstGateOpen).toBe(false);
  s.targetHit = true;
  ticks();
  expect(s.firstGateOpen).toBe(true);
  input(sieg, { moveY: -1, pushHeld: true });
  ticks();
  expect(s.boulder.y).toBeLessThan(1264);
});

it("Sieg touching a spike cannot teleport a boulder left on plate A into the spike trial", () => {
  const { s, sieg, ticks } = fixture();
  s.firstGateOpen = s.goldSwitchOpen = true;
  s.stage = 3;
  s.trapClock = 0;
  Object.assign(s.boulder, P.plateA);
  Object.assign(sieg, { x: 288, y: 1040 });
  const before = { ...s.boulder };
  ticks();
  expect(s.boulder).toEqual(before);
  expect(sieg.y).toBe(1160);
  expect(s.firstGateOpen && s.goldSwitchOpen).toBe(true);
});
