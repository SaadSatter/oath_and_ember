import { expect, it } from "vitest";
import {
  CastPrediction,
  pondTravel,
  MATCH_TICKS,
  staffOrigin,
  staffOffsets,
  travel,
} from "../src/net/castPrediction.js";
import {
  DT,
  FIREBALL_SPEED,
  ticksFor,
} from "../../../packages/shared/src/constants.js";
import type {
  Player,
  Projectile,
  World,
} from "../../../packages/shared/src/gameTypes.js";
const coco = (attack = 0) =>
  ({
    id: "c",
    role: "EMBER",
    hp: 100,
    cooldowns: { attack },
  }) as unknown as Player;
const world = (
  serverTick: number,
  projectiles: Record<string, Projectile> = {},
) => ({ serverTick, projectiles, players: {} }) as unknown as World;
const shot = (
  id: string,
  castTick: number,
  x: number,
  y = 100,
): Projectile => ({
  id,
  owner: "c",
  x,
  y,
  vx: FIREBALL_SPEED,
  vy: 0,
  life: 1,
  castTick,
  castOrigin: { x: 100, y },
  fireballLevel: 1,
});
const at = { x: 100, y: 100, facing: 0 };
it("predicts a cast only when Coco could cast, mirroring the cooldown", () => {
  const c = new CastPrediction();
  expect(c.press(10, { ...coco(), role: "OATH" } as Player, world(2))).toBe(
    false,
  );
  expect(c.press(10, coco(1), world(2))).toBe(false);
  expect(c.press(10, coco(), world(2))).toBe(true);
  expect(c.press(14, coco(), world(2))).toBe(false);
  expect(c.press(10 + Math.round(0.6 / DT), coco(), world(2))).toBe(true);
});
it("draws an unconfirmed cast from the predicted origin once that tick is on screen", () => {
  const c = new CastPrediction();
  c.press(10, coco(), world(2));
  c.resolve((tick) => (tick === 10 ? at : null));
  expect(c.view(world(2), {}, "c", 9.5, 1, []).positions.size).toBe(0);
  const { projectiles, positions } = c.view(world(2), {}, "c", 13, 1, []);
  expect(projectiles["cast:10"].castOrigin).toEqual({ x: 100, y: 100 });
  expect(positions.get("cast:10")!.x).toBeCloseTo(
    100 + FIREBALL_SPEED * 3 * DT,
    0,
  );
  expect(positions.get("cast:10")!.y).toBe(100);
});
it("hands the shot to the server projectile under the same key, carried to the local timeline", () => {
  const c = new CastPrediction();
  c.press(10, coco(), world(2));
  c.resolve(() => at);
  const confirmed = world(12, {
    real: shot("real", 10, 100 + FIREBALL_SPEED * 2 * DT),
  });
  c.sync(confirmed, "c");
  const { projectiles, positions } = c.view(
    confirmed,
    confirmed.projectiles,
    "c",
    16,
    1,
    [],
  );
  expect(Object.keys(projectiles)).toEqual(["cast:10"]);
  // Same place the unconfirmed cast would be drawn at tick 16.
  expect(positions.get("cast:10")!.x).toBeCloseTo(
    100 + FIREBALL_SPEED * 6 * DT,
    3,
  );
});
it("retires casts the server never confirmed, and confirmed ones once they end", () => {
  const c = new CastPrediction();
  c.press(10, coco(), world(2));
  c.sync(world(10 + MATCH_TICKS), "c");
  expect(c.casts).toHaveLength(1);
  c.sync(world(11 + MATCH_TICKS), "c");
  expect(c.casts).toHaveLength(0);
  // The next cast waits out the 0.6s attack cooldown.
  const next = 10 + Math.round(0.6 / DT);
  c.press(next, coco(), world(next - 10));
  c.sync(world(next + 1, { real: shot("real", next, 120) }), "c");
  expect(c.casts[0].projectileId).toBe("real");
  c.sync(world(next + 10), "c");
  expect(c.casts).toHaveLength(0);
});
it("stops a locally drawn shot at walls instead of flying through them", () => {
  const stop = travel({ x: 0, y: 0 }, { x: 300, y: 0 }, 1, [
    { x: 50, y: -20, w: 10, h: 40 },
  ]);
  expect(stop.x).toBeLessThanOrEqual(46);
  expect(stop.x).toBeGreaterThan(40);
});
it("starts fireballs at Coco's staff and settles onto the authoritative path", () => {
  const origin = { x: 100, y: 100 };
  expect(staffOrigin(origin, origin, { x: 1, y: 0 })).toEqual({
    x: 100 + staffOffsets.right.x,
    y: 100 + staffOffsets.right.y,
  });
  expect(
    staffOrigin({ x: 90, y: 100 }, origin, { x: -1, y: 0 }).x,
  ).toBeLessThan(90);
  expect(staffOrigin({ x: 200, y: 100 }, origin, { x: 1, y: 0 })).toEqual({
    x: 200,
    y: 100,
  });
});
it("starts the local cast pose with the predicted cast, never replaying the server's marker", () => {
  const c = new CastPrediction();
  c.press(10, coco(), world(2));
  c.resolve(() => ({ ...at, facing: -Math.PI / 2 }));
  expect(c.pose(9, 2)).toBeNull();
  const pose = c.pose(13, 4)!;
  expect(pose).toMatchObject({ seq: 10, kind: "cast", facing: -Math.PI / 2 });
  // Age seen by the presentation: three ticks on the predicted timeline.
  expect(4 - pose.startedTick).toBe(3);
  expect(c.pose(13, 12, 10)).not.toBeNull();
  expect(c.pose(13, 12, 30)).toBeNull();
});
it("stops a locally drawn shot where it meets a visible target instead of flying past it", () => {
  const c = new CastPrediction();
  c.press(10, coco(), world(2));
  c.resolve(() => at);
  const enemy = { x: 160, y: 72, w: 56, h: 56 };
  // Well after the shot would have crossed the enemy's position.
  const { positions } = c.view(
    world(2),
    {},
    "c",
    10 + ticksFor(0.5),
    1,
    [],
    [enemy],
  );
  const x = positions.get("cast:10")!.x;
  expect(x).toBeLessThan(enemy.x);
  expect(x).toBeGreaterThan(enemy.x - 12);
  // Confirmed server shots carried ahead of the snapshot stop there too.
  const confirmed = world(12, { real: shot("real", 10, 140) });
  c.sync(confirmed, "c");
  const carried = c.view(
    confirmed,
    confirmed.projectiles,
    "c",
    12 + ticksFor(0.4),
    1,
    [],
    [enemy],
  );
  expect(carried.positions.get("cast:10")!.x).toBeLessThan(enemy.x);
});

it("turns a predicted pond shot at the mirror instead of overshooting while awaiting a snapshot", async () => {
  const { newMirrorPond, pondStations, pondPuzzle } =
    await import("../../../packages/shared/src/mirrorPond.js");
  const w = world(1);
  w.sceneId = "MIRROR_POND";
  const pond = newMirrorPond();
  pond.mirrors[0] = Math.PI / 4;
  w.puzzles = { mirrorPond: { ...pondPuzzle(), pond } };
  w.players = { c: coco() };
  const station = pondStations[0];
  const q = {
    ...shot("q", 1, station.x - 40, station.y),
    castOrigin: station.shot,
  };
  const before = structuredClone(q);
  const predicted = pondTravel(q, 60 / FIREBALL_SPEED, w, []);
  // It turns where its edge (radius 4) meets the glass face, 6px off the
  // pivot line: 10px from the line, i.e. 10·√2 before the pivot on this path.
  const reach = 10 * Math.SQRT2;
  expect(predicted.at.x).toBeCloseTo(station.x - reach);
  expect(predicted.at.y).toBeCloseTo(station.y + 60 - (40 - reach));
  expect(predicted.velocity.vx).toBeCloseTo(0);
  expect(predicted.velocity.vy).toBeCloseTo(FIREBALL_SPEED);
  expect(q).toEqual(before);
  expect(pond.torches).toEqual([false, false, false, false]);
});
