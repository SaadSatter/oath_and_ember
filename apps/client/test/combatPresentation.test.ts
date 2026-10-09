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
it("uses accepted markers, locks facing and completes through movement/input release", () => {
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
  ).toMatchObject({ kind: "combat", direction: "right" });
  expect(machine.update(p, "TOP_DOWN", 796, 25, false).kind).toBe("locomotion");
  expect(machine.update(p, "TOP_DOWN", 850, 27, false).kind).toBe("locomotion");
  expect(p.combat!.facing).toBe(0);
});
it("queues accepted repeats without cutting recovery and prioritizes hurt/defeat", () => {
  const m = new PlayerPresentation();
  m.update(hero(), "TOP_DOWN", 0, 1, false);
  expect(m.update(hero(14, Math.PI), "TOP_DOWN", 430, 14, false)).toMatchObject(
    { direction: "right" },
  );
  expect(m.update(hero(14, Math.PI), "TOP_DOWN", 786, 25, false)).toMatchObject(
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
  expect(left).toMatchObject({ elapsedMs: 100 });
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
      ...hero(),
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
  ).toMatchObject({ kind: "charge", direction: "left" });
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

it("retains every repeated basic marker and starts each full frame sequence after recovery", () => {
  const m = new PlayerPresentation();
  m.update(hero(), "TOP_DOWN", 0, 1, false);
  m.update(hero(15, Math.PI), "TOP_DOWN", 467, 15, false);
  const second = m.update(hero(15, Math.PI), "TOP_DOWN", 765, 24, false);
  expect(second).toMatchObject({
    kind: "combat",
    action: { seq: 15 },
    direction: "left",
    elapsedMs: 0,
  });
  m.update(hero(29, -Math.PI / 2), "TOP_DOWN", 934, 29, false);
  const third = m.update(hero(29), "TOP_DOWN", 1231.667, 38, false);
  expect(third).toMatchObject({
    kind: "combat",
    action: { seq: 29 },
    direction: "up",
  });
  if (third.kind === "combat") expect(third.elapsedMs).toBeLessThan(1);
});
it("keeps Coco's existing six-frame cast duration and queue policy", () => {
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
  expect(m.update(p, "TOP_DOWN", 499, 15, false).kind).toBe("combat");
  expect(m.update(p, "TOP_DOWN", 501, 16, false).kind).toBe("locomotion");
});
