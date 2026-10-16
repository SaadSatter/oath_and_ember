import { it, expect } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { Prediction } from "../../client/src/net/prediction.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { INPUT_LEAD_TICKS, FIREBALL_SPEED } from "../../../packages/shared/src/constants.js";
function room() {
  const r = new GameRoom("AIM234", false, "FOREST_RUINS");
  const a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  return { r, sieg: r.state.players[a.playerId], coco: r.state.players[b.playerId] };
}
// Coco's cast is scheduled with her movement: it fires on the pressed tick, from
// the exact position and facing client prediction shows for that tick, so a
// fireball leaves her staff even while she walks or turns.
it("casts on the scheduled tick from the predicted position and facing", () => {
  const { r, coco } = room();
  const prediction = new Prediction();
  prediction.reset(coco, r.state.serverTick);
  let seq = 0;
  const send = (moveX: number, moveY: number, primaryHeld = false) => {
    const input = { ...neutral(++seq), moveX, moveY, primaryHeld };
    input.targetTick = r.state.serverTick + INPUT_LEAD_TICKS;
    input.movementEpoch = coco.movementEpoch ?? 0;
    prediction.push({ ...input }, r.state);
    r.receiveInput(coco.id, input);
    return input.targetTick;
  };
  for (let n = 0; n < INPUT_LEAD_TICKS + 4; n++) {
    send(1, 0);
    r.tick();
    prediction.reconcile(coco, r.state);
  }
  expect(coco.facing).toBe(0);
  send(0, -1);
  r.tick();
  prediction.reconcile(coco, r.state);
  const castTick = send(0, -1, true);
  const predicted = prediction.stateAt(castTick);
  expect(predicted).not.toBeNull();
  while (r.state.serverTick < castTick) {
    expect(
      Object.values(r.state.projectiles).some((q) => q.owner === coco.id),
    ).toBe(false);
    send(0, -1, true);
    r.tick();
  }
  const fireball = Object.values(r.state.projectiles).find(
    (q) => q.owner === coco.id,
  )!;
  expect(fireball).toBeDefined();
  expect(fireball.castTick).toBe(castTick);
  expect(fireball.castOrigin!.x).toBeCloseTo(predicted!.x, 6);
  expect(fireball.castOrigin!.y).toBeCloseTo(predicted!.y, 6);
  expect(fireball.vx).toBeCloseTo(0, 6);
  expect(fireball.vy).toBeCloseTo(-FIREBALL_SPEED, 6);
  expect(coco.combat!.facing).toBeCloseTo(predicted!.facing, 6);
  expect(coco.combat!.startedTick).toBe(castTick);
});
it("still enforces the server cooldown on scheduled casts", () => {
  const { r, coco } = room();
  let seq = 0;
  const press = (primaryHeld: boolean) =>
    r.receiveInput(coco.id, {
      ...neutral(++seq),
      primaryHeld,
      targetTick: r.state.serverTick + INPUT_LEAD_TICKS,
      movementEpoch: coco.movementEpoch ?? 0,
    });
  for (let n = 0; n < INPUT_LEAD_TICKS + 6; n++) {
    press(n % 2 === 0);
    r.tick();
  }
  const shots = Object.values(r.state.projectiles).filter(
    (q) => q.owner === coco.id,
  );
  expect(shots).toHaveLength(1);
});
it("aims a standing attack along the last direction pressed, matching predicted facing", () => {
  const { r, sieg } = room();
  let seq = 0;
  const send = (moveX: number, moveY: number, primaryHeld = false) =>
    r.receiveInput(sieg.id, {
      ...neutral(++seq),
      moveX,
      moveY,
      primaryHeld,
      targetTick: r.state.serverTick + INPUT_LEAD_TICKS,
      movementEpoch: sieg.movementEpoch ?? 0,
    });
  send(-1, 0);
  r.tick();
  send(0, 0);
  r.tick();
  send(0, 0, true);
  r.tick();
  expect(sieg.combat!.facing).toBeCloseTo(Math.PI, 6);
});
it("falls back to authoritative facing when no direction has been pressed", () => {
  const { r, coco } = room();
  coco.facing = Math.PI / 2;
  r.receiveInput(coco.id, { ...neutral(1), primaryHeld: true });
  r.tick();
  expect(coco.combat!.facing).toBeCloseTo(Math.PI / 2, 6);
});
