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
