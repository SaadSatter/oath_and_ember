import { ticksFor } from "../../../packages/shared/src/constants.js";
import { it, expect } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { collisionRects } from "../../../packages/shared/src/maps.js";
import {
  neutral,
  type Player,
  type InputFrame,
} from "../../../packages/shared/src/gameTypes.js";
import {
  mirrorPondState,
  pondStations,
  pondSpikeState,
  normalizeMirrorAngle,
  pondPushTurn,
} from "../../../packages/shared/src/mirrorPond.js";
it("traverses both pond routes and all four mirror stations using server intents", () => {
  const r = new GameRoom("ABC234", false, "MIRROR_POND"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const w = r.state,
    s = w.players[a.playerId],
    c = w.players[b.playerId],
    pond = mirrorPondState(w.puzzles)!;
  function tick(actor?: Player, patch: Partial<InputFrame> = {}) {
    for (const p of [s, c]) {
      const session = r.sessions.get(p.id)!;
      r.receiveInput(p.id, {
        ...neutral(session.input.seq + 1),
        ...(p === actor ? patch : {}),
      });
    }
    r.tick();
  }
  function path(player: Player, goal: { x: number; y: number }) {
    const walls = collisionRects(
        "MIRROR_POND",
        w.puzzles,
        undefined,
        undefined,
        w.players,
        w.serverTick,
        player.role,
      ),
      allowed = (x: number, y: number) =>
        x >= 0 &&
        x < 48 &&
        y >= 0 &&
        y < 40 &&
        !walls
          .filter((r) => !player.flightRemaining || !r.terrain)
          .some(
            (rect) =>
              (x + 0.5) * 32 + 13 > rect.x &&
              (x + 0.5) * 32 - 13 < rect.x + rect.w &&
              (y + 0.5) * 32 + 13 > rect.y &&
              (y + 0.5) * 32 - 13 < rect.y + rect.h,
          );
    const start = Math.floor(player.y / 32) * 48 + Math.floor(player.x / 32),
      end = Array.from({ length: 48 * 40 }, (_, k) => k)
        .filter((k) => allowed(k % 48, Math.floor(k / 48)))
        .sort(
          (a, b) =>
            Math.hypot(
              ((a % 48) + 0.5) * 32 - goal.x,
              (Math.floor(a / 48) + 0.5) * 32 - goal.y,
            ) -
            Math.hypot(
              ((b % 48) + 0.5) * 32 - goal.x,
              (Math.floor(b / 48) + 0.5) * 32 - goal.y,
            ),
        )[0],
      prev = new Map<number, number>([[start, -1]]),
      queue = [start];
    for (let i = 0; i < queue.length && !prev.has(end); i++) {
      const key = queue[i],
        x = key % 48,
        y = Math.floor(key / 48);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const next = ny * 48 + nx;
        if (allowed(nx, ny) && !prev.has(next)) {
          prev.set(next, key);
          queue.push(next);
        }
      }
    }
    if (!prev.has(end)) throw Error(`No route from ${start} to ${end}`);
    const route: number[] = [];
    for (let key = end; key !== start; key = prev.get(key)!) route.unshift(key);
    return route.map((key) => ({
      x: ((key % 48) + 0.5) * 32,
      y: (Math.floor(key / 48) + 0.5) * 32,
    }));
  }
  function go(p: Player, x: number, y: number) {
    for (const v of [...path(p, { x, y }), { x, y }]) {
      let n = 0;
      while (Math.hypot(p.x - v.x, p.y - v.y) > Math.hypot(3, 3) && n++ < 180) {
        const dx = v.x - p.x,
          dy = v.y - p.y;
        tick(p, {
          moveX: Math.abs(dx) > 3 ? Math.sign(dx) : 0,
          moveY: Math.abs(dy) > 3 ? Math.sign(dy) : 0,
        });
      }
      if (n >= 180)
        throw Error(`Blocked ${p.role} ${p.x},${p.y} -> ${v.x},${v.y}`);
    }
  }
  // Flight traverses the culvert to the first safe firing pad without crossing a ward.
  tick(c, { flightHeld: true });
  go(c, 35 * 32, 31 * 32);
  go(c, 35 * 32, 27 * 32);
  go(c, 28 * 32, 12 * 32);
  expect(c.flightRemaining).toBeGreaterThan(0);
  // Wait in the court for a clear spike phase, then cross at boosted speed.
  go(s, 45 * 32, 26 * 32);
  let crossed = false;
  for (let attempt = 0; attempt < 5 && !crossed; attempt++) {
    while (s.cooldowns.sprint) tick();
    go(s, 45 * 32, 26 * 32);
    // The east-most column rises last; once it retracts the lanes are clear.
    while (pondSpikeState(pond.clock, 3).phase !== "retracting") tick();
    tick(c, { slowTimeHeld: true });
    tick(s, { sprintHeld: true });
    for (let n = 0; n < ticksFor(1.5) && s.x > 36.5 * 32; n++)
      tick(s, { moveX: -1 });
    crossed = s.x < 39 * 32;
  }
  expect(crossed).toBe(true);
  // Let speed expire so precise mirror approaches use ordinary movement.
  while (s.sprintRemaining) tick();
  // Mirrors spin on a center pivot: Sieg must push the half that swings the
  // way he wants, and walk around as the mirror turns, like turning a fan.
  // A mirror reflects identically at θ and θ + 180°.
  const halfTurn = (a: number) => {
    const d = normalizeMirrorAngle(a) % Math.PI;
    return d > Math.PI / 2 ? d - Math.PI : d;
  };
  const face = (i: number) => {
    const p = pondStations[i],
      dx = p.x - s.x,
      dy = p.y - s.y,
      big = Math.max(Math.abs(dx), Math.abs(dy));
    tick(s, {
      moveX: Math.abs(dx) > big * 0.4 ? Math.sign(dx) : 0,
      moveY: Math.abs(dy) > big * 0.4 ? Math.sign(dy) : 0,
    });
  };
  // Push with a fixed direction from one spot until it stalls or aligns.
  function pushFrom(
    i: number,
    spot: { x: number; y: number },
    want: number,
    target: number,
  ) {
    try {
      go(s, spot.x, spot.y);
    } catch {
      return false;
    }
    face(i);
    let moved = false;
    for (let n = 0; n < 241; n++) {
      const before = pond.mirrors[i];
      if (Math.abs(halfTurn(target - before)) < 1e-7) break;
      tick(s, { pushHeld: true });
      if (Math.sign(halfTurn(pond.mirrors[i] - before)) !== want) break;
      moved = true;
    }
    tick();
    return moved;
  }
  // Push spots on reachable ground, nearest first.
  function spotsFor(i: number, want: number) {
    const p = pondStations[i],
      spots: { x: number; y: number }[] = [];
    for (let ty = 0; ty < 40; ty++)
      for (let tx = 0; tx < 48; tx++) {
        const x = (tx + 0.5) * 32,
          y = (ty + 0.5) * 32;
        if (Math.hypot(x - p.x, y - p.y) > 96) continue;
        const turn = pondPushTurn(pond, {
          x,
          y,
          facing: Math.atan2(p.y - y, p.x - x),
        });
        if (turn?.index === i && turn.direction === want) spots.push({ x, y });
      }
    return spots.sort(
      (a, b) =>
        Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y),
    );
  }
  // Push one way as far as Sieg can (up to 60 degrees), like a careless player.
  function overshoot(i: number, want: number) {
    const start = pond.mirrors[i],
      stop = start + (want * Math.PI) / 3;
    for (let leg = 0; leg < 8; leg++)
      if (!spotsFor(i, want).some((spot) => pushFrom(i, spot, want, stop)))
        break;
    expect(pond.mirrors[i]).not.toBeCloseTo(start);
  }
  function turnTo(i: number, target: number) {
    for (let leg = 0; leg < 24; leg++) {
      const diff = halfTurn(target - pond.mirrors[i]);
      if (Math.abs(diff) < 1e-7) return;
      let moved = false;
      // Prefer the short way round, but a blocked side may force the long way.
      for (const want of [Math.sign(diff), -Math.sign(diff)]) {
        const spots = spotsFor(i, want);
        for (const spot of spots)
          if ((moved = pushFrom(i, spot, want, target))) break;
        if (moved) break;
      }
      if (!moved) throw Error(`Mirror ${i + 1} cannot turn toward ${target}`);
    }
    throw Error(`Mirror ${i + 1} did not settle at ${target}`);
  }
  for (let i = 0; i < 4; i++) {
    const p = pondStations[i];
    turnTo(i, p.angle);
    expect(Math.abs(halfTurn(pond.mirrors[i] - p.angle))).toBeLessThan(1e-7);
    // Overshooting either way can still be corrected.
    for (const want of [1, -1]) {
      overshoot(i, want);
      turnTo(i, p.angle);
    }
    expect(Math.abs(halfTurn(pond.mirrors[i] - p.angle))).toBeLessThan(1e-7);
  }
  while (c.cooldowns.flight) tick();
  tick(c, { flightHeld: true });
  go(c, 16 * 32, 18 * 32);
  go(c, 22 * 32, 25 * 32);
  expect(c.flightRemaining).toBeGreaterThan(0);
  // Solved mirrors bar the ring walkway; Sieg reopens each on his way out.
  for (const i of [3, 2, 1, 0]) turnTo(i, pondStations[i].rest);
  go(s, 38 * 32, 29 * 32);
  expect(s.x).toBeCloseTo(38 * 32, -1);
}, 45000);
