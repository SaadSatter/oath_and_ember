// asTuned (policies/navigate.ts) gives the scripted route and baselines the
// one-decimal position they were tuned on, from the interface's two-decimal,
// truncated `self` (pilot-6 fix 3; review finding 3). It should equal the
// earlier round1 of the raw position. Positions are px / 32 for float px.
import { describe, expect, it } from "vitest";
import { round1, truncate2, TILE } from "../src/perception.js";
import { asTuned } from "../src/policies/navigate.js";
import type { Observation } from "../src/types.js";

const tuned = (v: number) => asTuned({ self: { x: v, y: v } } as unknown as Observation).self.x;
const same = (px: number) => tuned(truncate2(px / TILE)) === round1(px / TILE);

describe("asTuned matches the earlier round1 on positions", () => {
  it("on 2,000,000 seeded random float positions over 64 tiles", () => {
    let seed = 7;
    const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32;
    let bad = 0;
    for (let i = 0; i < 2_000_000; i++) if (!same(rnd() * 64 * TILE)) bad++;
    expect(bad).toBe(0);
  });

  it("on 60,540 positions reached by walking, slowed, sprinting and diagonal steps, both ways", () => {
    // These positions sit close to x.x5 boundaries far more often than random
    // floats; with the earlier truncate2 rounding guard, 61 of them differed.
    const steps = [190 / 60, 38 / 60, 380 / 60, 190 / 60 / Math.SQRT2, 38 / 60 / Math.SQRT2, 380 / 60 / Math.SQRT2];
    let n = 0;
    const bad: number[] = [];
    for (const step of steps)
      for (const start of [13, 100.5, 160, 543.25, 800.125, 1000.3333]) {
        for (let px = start, k = 0; k < 20000 && px < 64 * TILE; k++, px += step, n++) if (!same(px)) bad.push(px);
        for (let px = start, k = 0; k < 20000 && px > 13; k++, px -= step, n++) if (!same(px)) bad.push(px);
      }
    expect(n).toBe(60540);
    expect(bad).toEqual([]);
  });

  it("near boundaries: just above and below every x.x5, and around integers", () => {
    for (let t = 0; t < 640; t++) {
      const b = t / 10 + 0.05;
      for (const d of [1e-6, -1e-6, 1e-9, -1e-9, 1e-12, -1e-12]) expect(same((b + d) * TILE), `${b} ${d}`).toBe(true);
    }
    for (let k = 1; k <= 64; k++) for (const d of [-1e-14, -1e-12, -1e-9, -1e-3, 0, 1e-3]) expect(same((k + d) * TILE)).toBe(true);
  });

  it("documents the remaining theoretical window: the double just below a decimal x.x5", () => {
    // 1.45 is stored as 1.4499999999999999556. round1 computes 1.45 * 10 = 14.5
    // and rounds up; the truncated hundredths (1.44) can no longer tell it from
    // 1.441. Within about 1e-14 tile of such a boundary; not seen in walking
    // positions or in the pinned route and baseline runs (scriptedFreeze.test.ts).
    expect(round1(1.45)).toBe(1.5);
    expect(tuned(truncate2(1.45))).toBe(1.4);
  });

  it("changes only the scripted players' copy: the observation it is given is untouched", () => {
    const o = { self: { x: 25.96, y: 27.44, hp: 100 }, area: { name: "Hedge Maze" } } as unknown as Observation;
    const before = JSON.stringify(o);
    const t = asTuned(o);
    expect(JSON.stringify(o)).toBe(before);
    expect(t.self).toMatchObject({ x: 26, y: 27.4, hp: 100 });
  });
});
