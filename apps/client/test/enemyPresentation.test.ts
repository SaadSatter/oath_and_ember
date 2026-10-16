import { it, expect } from "vitest";
import {
  EnemyPresentation,
  enemyDirection,
} from "../src/animation/EnemyPresentation.js";
import { spawnEnemy } from "../../../packages/shared/src/enemies.js";
it("turns every monster and the runner immediately with velocity rather than stale facing", () => {
  for (const type of [
    "mossling",
    "cinder_wisp",
    "ironbound_sentinel",
  ] as const) {
    const e = spawnEnemy("actor", type, 500, 500),
      m = new EnemyPresentation();
    for (const [vx, vy, expected] of [
      [40, 0, "east"],
      [0, -40, "north"],
      [-40, 0, "west"],
      [0, 40, "south"],
    ] as const) {
      Object.assign(e, { vx, vy, facing: 0, state: "CHASE" });
      const pose = m.update(e, 1);
      expect(enemyDirection(pose.facing)).toBe(expected);
      expect(pose.moving).toBe(true);
    }
  }
});
it("interrupts a golem beam or punch visually when displaced and never resumes that old attack", () => {
  for (const attackKind of ["beam", "melee"] as const) {
    const e = spawnEnemy("golem", "ironbound_sentinel", 500, 500),
      m = new EnemyPresentation();
    Object.assign(e, {
      state: "ATTACK",
      attackKind,
      attackSeq: 1,
      attackStartedTick: 1,
      attackFacing: 0,
      facing: 0,
    });
    expect(m.update(e, 1).attacking).toBe(true);
    e.y -= 10;
    const turned = m.update(e, 2);
    expect(turned.attacking).toBe(false);
    expect(enemyDirection(turned.facing)).toBe("north");
    expect(turned.moving).toBe(true);
    expect(m.update(e, 2)).toEqual(turned);
    expect(m.update(e, 3).attacking).toBe(false);
    e.attackSeq++;
    expect(m.update(e, 4).attacking).toBe(true);
    expect(e.attackFacing).toBe(0);
  }
});
it("changes idle direction and native eight-way golem directions without starting stale attacks", () => {
  const e = spawnEnemy("golem", "ironbound_sentinel", 0, 0),
    m = new EnemyPresentation();
  e.facing = Math.PI;
  expect(enemyDirection(m.update(e, 0).facing)).toBe("west");
  e.vx = 40;
  e.vy = -40;
  expect(enemyDirection(m.update(e, 1).facing, 8)).toBe("north-east");
  Object.assign(e, { state: "DEAD", vx: 0, vy: 0 });
  expect(m.update(e, 2)).toMatchObject({ moving: false, attacking: false });
});
it("does not confuse normal travel or interpolation noise with forced motion", () => {
  const e = spawnEnemy("moss", "mossling", 500, 500),
    m = new EnemyPresentation();
  Object.assign(e, { vx: 60, vy: 0 });
  m.update(e, 1);
  e.x += 2;
  expect(enemyDirection(m.update(e, 2).facing)).toBe("east");
  Object.assign(e, { vx: 0, vy: 0, facing: Math.PI });
  e.x += 0.1;
  expect(m.update(e, 3)).toMatchObject({ moving: false, facing: Math.PI });
});
it("does not mistake movement before a new windup for displacement during that attack", () => {
  const e = spawnEnemy("golem", "ironbound_sentinel", 500, 500),
    m = new EnemyPresentation();
  Object.assign(e, { state: "CHASE", vx: 32, vy: 0, facing: 0 });
  m.update(e, 1);
  Object.assign(e, {
    x: 502,
    state: "ATTACK",
    vx: 0,
    vy: 0,
    attackSeq: 1,
    attackFacing: 0,
  });
  expect(m.update(e, 3)).toMatchObject({ moving: false, attacking: true });
  e.y -= 5;
  expect(m.update(e, 5)).toMatchObject({ moving: true, attacking: false });
});
