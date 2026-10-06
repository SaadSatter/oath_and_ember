import { it, expect } from "vitest";
import { PlayerPresentation } from "../src/animation/PlayerPresentation.js";
import type { Player } from "../../../packages/shared/src/gameTypes.js";
const hero = (role: Player["role"] = "OATH") =>
  ({ role, hp: 100, facing: 0, actionState: "guard" }) as Player;
it("starts once, holds across movement, ends once, and supports repeated presses", () => {
  const m = new PlayerPresentation(),
    p = hero();
  expect(m.update(p, "TOP_DOWN", 0, 0, false)).toMatchObject({
    kind: "defense",
    phase: "start",
  });
  expect(m.update({ ...p, vx: 190 }, "TOP_DOWN", 500, 15, false)).toMatchObject(
    { phase: "start", elapsedMs: 500 },
  );
  expect(m.update(p, "TOP_DOWN", 700, 21, false)).toMatchObject({
    phase: "loop",
  });
  expect(m.update(p, "TOP_DOWN", 5700, 171, false)).toMatchObject({
    phase: "loop",
    elapsedMs: 5000,
  });
  expect(
    m.update({ ...p, actionState: "idle" }, "TOP_DOWN", 5800, 174, false),
  ).toMatchObject({ phase: "end" });
  expect(
    m.update({ ...p, actionState: "idle" }, "TOP_DOWN", 6500, 195, false).kind,
  ).toBe("locomotion");
  expect(m.update(p, "TOP_DOWN", 6600, 198, false)).toMatchObject({
    phase: "start",
  });
});
it("authoritative impacts resume held defense and stale events do not replay", () => {
  for (const role of ["OATH", "EMBER"] as const) {
    const m = new PlayerPresentation(),
      p = hero(role);
    m.update(p, "TOP_DOWN", 0, 0, false);
    m.update(p, "TOP_DOWN", 700, 21, false);
    const hit = { ...p, defensiveHit: { seq: 1, tick: 30 } };
    expect(m.update(hit, "TOP_DOWN", 1000, 30, false)).toMatchObject({
      kind: "defense",
      impact: true,
      phase: role === "OATH" ? "impact" : "loop",
    });
    expect(m.update(hit, "TOP_DOWN", 1300, 39, false)).toMatchObject({
      phase: "loop",
      impact: false,
    });
    expect(
      new PlayerPresentation().update(hit, "TOP_DOWN", 2000, 90, false),
    ).toMatchObject({ impact: false });
  }
});
it("keeps presentation clocks across geometric rendering and gives hurt priority", () => {
  const m = new PlayerPresentation(),
    p = hero();
  m.update(p, "TOP_DOWN", 0, 0, false);
  expect(m.update(p, "TOP_DOWN", 100, 3, true).kind).toBe("hurt");
  expect(m.update(p, "TOP_DOWN", 1000, 30, false)).toMatchObject({
    phase: "loop",
  });
});

it("presents existing platformer defense without changing movement or replaying attacks", () => {
  const m = new PlayerPresentation();
  expect(m.update(hero(), "PLATFORMER", 0, 0, false)).toMatchObject({
    kind: "defense",
    phase: "start",
  });
  expect(m.update(hero(), "PLATFORMER", 1000, 30, false)).toMatchObject({
    phase: "loop",
  });
});

import { wardEnvelope, wardRotation } from "../src/animation/defense.js";
import { effectPresentationProfiles } from "../src/assets/effectPresentation.js";
it("pulses the Ward on a continuous scene clock without spinning or disappearing", () => {
  const profile = effectPresentationProfiles.ward;
  const before = { ...profile };
  try {
    Object.assign(profile, {
      rotationMs: 0,
      pulseMs: 1800 / (2 * Math.PI),
      pulseScale: 0.04,
      pulseDepth: 0.12,
    });
    for (const now of [0, 450, 900, 1350, 1800, 3600]) {
      expect(wardRotation(now)).toBe(0);
      const held = wardEnvelope("loop", 0, 500, now);
      expect(held.alpha).toBeGreaterThanOrEqual(0.84);
      expect(held.scale).toBeGreaterThanOrEqual(0.96);
      expect(held.scale).toBeLessThanOrEqual(1);
      expect(wardEnvelope("start", 500, 500, now)).toEqual(held);
      expect(wardEnvelope("impact", 0, 500, now)).toEqual(held);
    }
    expect(wardEnvelope("loop", 0, 500, 900).scale).toBeLessThan(
      wardEnvelope("loop", 0, 500, 0).scale,
    );
    expect(wardEnvelope("end", 500, 500, 900).alpha).toBe(0);
  } finally {
    Object.assign(profile, before);
  }
});
