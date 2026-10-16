import { it, expect } from "vitest";
import { PlayerPresentation } from "../src/animation/PlayerPresentation.js";
import {
  combatDirection,
  combatClip,
  combatAssets,
} from "../src/animation/combat.js";
import type { Player } from "../../../packages/shared/src/gameTypes.js";
import { readFileSync } from "node:fs";
const hero = (seq = 1, facing = 0): Player =>
  ({
    role: "OATH",
    hp: 100,
    actionState: "idle",
    facing,
    vx: 0,
    vy: 0,
    combat: { seq, kind: "sword", facing, startedTick: seq },
  }) as Player;
it("uses accepted markers and immediately interrupts old-facing clips when turning", () => {
  const machine = new PlayerPresentation(),
    p = Object.freeze(hero());
  expect(
    machine.update(
      { ...p, combat: undefined, actionState: "attack" },
      "TOP_DOWN",
      0,
      1,
      false,
    ).kind,
  ).toBe("locomotion");
  expect(machine.update(p, "TOP_DOWN", 10, 1, false)).toMatchObject({
    kind: "combat",
    direction: "right",
    elapsedMs: 0,
  });
  expect(
    machine.update(
      { ...p, facing: Math.PI, vx: -190 },
      "TOP_DOWN",
      200,
      5,
      false,
    ),
  ).toMatchObject({ kind: "locomotion" });
  expect(machine.update(p, "TOP_DOWN", 796, 25, false).kind).toBe("locomotion");
  expect(machine.update(p, "TOP_DOWN", 850, 27, false).kind).toBe("locomotion");
  expect(p.combat!.facing).toBe(0);
});
it("starts a fresh accepted direction immediately and prioritizes hurt/defeat", () => {
  const m = new PlayerPresentation();
  m.update(hero(), "TOP_DOWN", 0, 1, false);
  expect(m.update(hero(14, Math.PI), "TOP_DOWN", 430, 14, false)).toMatchObject(
    { direction: "left", action: { seq: 14 } },
  );
  expect(m.update(hero(14, Math.PI), "TOP_DOWN", 600, 19, false)).toMatchObject(
    { direction: "left", action: { seq: 14 } },
  );
  expect(m.update(hero(14), "TOP_DOWN", 820, 26, true).kind).toBe("hurt");
  expect(
    m.update({ ...hero(20), hp: 0 }, "TOP_DOWN", 850, 27, false).kind,
  ).toBe("defeated");
});
it("rejects stale replay and top-down playback on platformer maps", () => {
  expect(
    new PlayerPresentation().update(hero(), "TOP_DOWN", 0, 90, false).kind,
  ).toBe("locomotion");
  expect(
    new PlayerPresentation().update(hero(), "PLATFORMER", 0, 1, false).kind,
  ).toBe("locomotion");
});
it("aligns independent local/remote clocks from the same server start tick", () => {
  const p = hero(30),
    a = new PlayerPresentation(),
    b = new PlayerPresentation();
  const left = a.update(p, "TOP_DOWN", 1000, 33, false),
    right = b.update(p, "TOP_DOWN", 7000, 33, false);
  expect(left).toEqual(right);
  expect(left.kind).toBe("combat");
  if (left.kind === "combat")
    expect(left.elapsedMs).toBeCloseTo(100 * left.playbackRate!);
  for (const [facing, d] of [
    [0, "right"],
    [Math.PI, "left"],
    [Math.PI / 2, "down"],
    [-Math.PI / 2, "up"],
  ] as const)
    expect(combatDirection(facing)).toBe(d);
});
it("combat sheets and separate effects share frame dimensions and valid clip ranges", () => {
  for (const role of ["OATH", "EMBER"] as const) {
    const a = combatAssets[role],
      png = readFileSync(`apps/client/public${a.url}`);
    expect(png.readUInt32BE(16)).toBe(128 * 8);
    expect(png.readUInt32BE(20)).toBe(128 * 4);
    expect(png[25]).toBe(6);
    for (const d of a.directions) {
      const c = combatClip(role, d);
      expect(c.end).toBeLessThan(32);
      expect(c.durationMs).toBeGreaterThan(400);
    }
  }
  const effect = readFileSync(
    "apps/client/public/assets/characters/ember/combat-effects.png",
  );
  expect(effect.readUInt32BE(16)).toBe(1024);
  expect(effect.readUInt32BE(20)).toBe(512);
});

it("holds charge from authoritative state without input guesses and releases above locomotion", () => {
  const m = new PlayerPresentation(),
    p = {
      ...hero(1, Math.PI),
      combat: undefined,
      heavyCharge: {
        startedTick: 1,
        facing: Math.PI,
        ticks: 20,
        progress: 20 / 33,
      },
    };
  expect(m.update(p, "TOP_DOWN", 1000, 20, false)).toMatchObject({
    kind: "charge",
    direction: "left",
    ticks: 20,
  });
  expect(
    m.update({ ...p, facing: 0, vx: 190 }, "TOP_DOWN", 1200, 25, false),
  ).toMatchObject({ kind: "charge", direction: "right" });
  const release = {
    ...p,
    heavyCharge: undefined,
    combat: {
      seq: 26,
      startedTick: 26,
      kind: "heavy" as const,
      facing: Math.PI,
    },
  };
  expect(m.update(release, "TOP_DOWN", 1300, 26, false)).toMatchObject({
    kind: "combat",
    direction: "left",
  });
  expect(m.update(release, "TOP_DOWN", 1801, 42, false).kind).toBe(
    "locomotion",
  );
  expect(m.update(p, "TOP_DOWN", 1900, 50, true).kind).toBe("hurt");
});

it("finishes quick swings before the next accepted attack and never queues stale swings", () => {
  const m = new PlayerPresentation();
  m.update(hero(), "TOP_DOWN", 0, 1, false);
  expect(m.update(hero(), "TOP_DOWN", 301, 10, false).kind).toBe("locomotion");
  expect(m.update(hero(15), "TOP_DOWN", 467, 15, false)).toMatchObject({
    kind: "combat",
    action: { seq: 15 },
    elapsedMs: 0,
  });
  expect(m.update(hero(15), "TOP_DOWN", 768, 24, false).kind).toBe(
    "locomotion",
  );
  const fresh = m.update(hero(16), "TOP_DOWN", 770, 16, false);
  expect(fresh).toMatchObject({
    kind: "combat",
    action: { seq: 16 },
    elapsedMs: 0,
  });
  expect(m.update(hero(17), "TOP_DOWN", 800, 17, false)).toMatchObject({
    kind: "combat",
    action: { seq: 17 },
    elapsedMs: 0,
  });
  expect(m.update(hero(17), "TOP_DOWN", 1101, 26, false).kind).toBe(
    "locomotion",
  );
});
it("plays Coco casts in 200 ms and replaces a cast immediately with the latest accepted action", () => {
  const m = new PlayerPresentation(),
    p = {
      ...hero(),
      role: "EMBER" as const,
      combat: { ...hero().combat!, kind: "cast" as const },
    };
  expect(m.update(p, "TOP_DOWN", 0, 1, false)).toMatchObject({
    kind: "combat",
    elapsedMs: 0,
  });
  expect(m.update(p, "TOP_DOWN", 199, 6, false).kind).toBe("combat");
  expect(m.update(p, "TOP_DOWN", 201, 7, false).kind).toBe("locomotion");
  const next = { ...p, combat: { ...p.combat, seq: 10, startedTick: 10 } };
  m.update(next, "TOP_DOWN", 300, 10, false);
  const newest = { ...p, combat: { ...p.combat, seq: 11, startedTick: 11 } };
  expect(m.update(newest, "TOP_DOWN", 334, 11, false)).toMatchObject({
    kind: "combat",
    action: { seq: 11 },
    elapsedMs: 0,
  });
  expect(m.update(newest, "TOP_DOWN", 535, 17, false).kind).toBe("locomotion");
});
it("uses predicted local facing immediately for both heroes without changing authoritative action aim", () => {
  for (const role of ["OATH", "EMBER"] as const) {
    const m = new PlayerPresentation(),
      p = {
        ...hero(),
        role,
        combat: {
          ...hero().combat!,
          kind: role === "OATH" ? ("sword" as const) : ("cast" as const),
        },
      };
    expect(m.update(p, "TOP_DOWN", 0, 1, false).kind).toBe("combat");
    expect(
      m.update(p, "TOP_DOWN", 80, 3, false, { facing: -Math.PI / 2 }).kind,
    ).toBe("locomotion");
    expect(p.facing).toBe(0);
    expect(p.combat.facing).toBe(0);
    // An old accepted action never restarts when the hero turns back.
    expect(m.update(p, "TOP_DOWN", 100, 4, false, { facing: 0 }).kind).toBe(
      "locomotion",
    );
    expect(
      m.update(
        {
          ...p,
          combat: { ...p.combat, seq: 5, startedTick: 5, facing: Math.PI },
        },
        "TOP_DOWN",
        130,
        5,
        false,
        { facing: Math.PI },
      ),
    ).toMatchObject({ kind: "combat", direction: "left", elapsedMs: 0 });
  }
});
it("drops queued old-facing attacks on a turn and ignores delayed old-facing markers", () => {
  const m = new PlayerPresentation();
  m.update(hero(), "TOP_DOWN", 0, 1, false);
  m.update(hero(8), "TOP_DOWN", 234, 8, false);
  expect(
    m.update({ ...hero(8), facing: Math.PI }, "TOP_DOWN", 250, 9, false).kind,
  ).toBe("locomotion");
  expect(
    m.update({ ...hero(10), facing: Math.PI }, "TOP_DOWN", 300, 10, false).kind,
  ).toBe("locomotion");
  expect(
    m.update({ ...hero(10), facing: Math.PI }, "TOP_DOWN", 900, 28, false).kind,
  ).toBe("locomotion");
});
it("turns guard and held-charge artwork using current motion rather than stale server facing", () => {
  const m = new PlayerPresentation(),
    p = { ...hero(), combat: undefined, actionState: "guard" };
  expect(
    m.update(p, "TOP_DOWN", 0, 1, false, { facing: Math.PI }),
  ).toMatchObject({ kind: "defense", direction: "left" });
  expect(
    m.update(p, "TOP_DOWN", 20, 2, false, { facing: -Math.PI / 2 }),
  ).toMatchObject({ kind: "defense", direction: "up" });
  const charge = {
    ...p,
    actionState: "heavyCharge",
    heavyCharge: { startedTick: 1, facing: 0, ticks: 5, progress: 0.2 },
  };
  expect(
    m.update(charge, "TOP_DOWN", 40, 3, false, { facing: Math.PI / 2 }),
  ).toMatchObject({ kind: "charge", direction: "down" });
});
