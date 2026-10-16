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
  normalizeMirrorAngle,
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
      while (Math.hypot(p.x - v.x, p.y - v.y) > 4 && n++ < 180) {
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
  // Wait for a clear spike phase, then cross at boosted speed.
  go(s, 43 * 32, 26 * 32);
  let crossed = false;
  for (let attempt = 0; attempt < 5 && !crossed; attempt++) {
    while (s.cooldowns.sprint) tick();
    go(s, 43 * 32, 26 * 32);
    while (Math.abs(Math.sin(pond.clock * 3.2)) < 0.85) tick();
    tick(c, { slowTimeHeld: true });
    tick(s, { sprintHeld: true });
    for (let n = 0; n < 45 && s.x > 36.5 * 32; n++) tick(s, { moveX: -1 });
    crossed = s.x < 37 * 32;
  }
  expect(crossed).toBe(true);
  // Let speed expire so precise mirror approaches use ordinary movement.
  while (s.sprintRemaining) tick();
  const approaches = [
    [38, 15],
    [29, 6],
    [6, 15],
    [19, 30],
  ];
  for (let i = 0; i < 4; i++) {
    const p = pondStations[i],
      [x, y] = approaches[i];
    go(s, x * 32, y * 32);
    tick(s, {
      moveX:
        Math.abs(p.x - s.x) > Math.abs(p.y - s.y) ? Math.sign(p.x - s.x) : 0,
      moveY:
        Math.abs(p.y - s.y) >= Math.abs(p.x - s.x) ? Math.sign(p.y - s.y) : 0,
    });
    const target = normalizeMirrorAngle(p.angle);
    let turns = 0;
    while (Math.abs(pond.mirrors[i] - target) > 1e-7 && turns++ < 241)
      tick(s, { pushHeld: true });
    tick();
    expect(pond.mirrors[i]).toBeCloseTo(target);
    turns = 0;
    while (Math.abs(pond.mirrors[i] - p.rest) > 1e-7 && turns++ < 241)
      tick(s, { pushHeld: true });
    tick();
    expect(pond.mirrors[i]).toBeCloseTo(p.rest);
  }
  while (c.cooldowns.flight) tick();
  tick(c, { flightHeld: true });
  go(c, 16 * 32, 18 * 32);
  go(c, 22 * 32, 25 * 32);
  expect(c.flightRemaining).toBeGreaterThan(0);
  go(s, 38 * 32, 29 * 32);
  expect(s.x).toBeCloseTo(38 * 32, -1);
}, 20000);
