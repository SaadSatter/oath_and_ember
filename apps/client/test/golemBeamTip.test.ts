import { it, expect } from "vitest";
import {
  golemBeamTipFrame,
  golemEffectFrame,
  golemBeamFade,
  GOLEM_CHARGE_ORB_FRAMES,
  GOLEM_BEAM_FADE_MS,
} from "../src/animation/golem.js";
import { readFileSync } from "node:fs";
it("plays every endpoint frame once then loops only the last three occupied cells", () => {
  for (let i = 0; i < 11; i++)
    expect(golemBeamTipFrame((i + 0.1) * 0.09)).toBe(i);
  for (let i = 11; i < 100; i++)
    expect(golemBeamTipFrame((i + 0.1) * 0.09)).toBe(8 + ((i - 11) % 3));
  expect(golemBeamTipFrame(-10)).toBe(0);
  const png = readFileSync(
    "apps/client/public/assets/enemies/ironbound_sentinel/beam-tip.png",
  );
  expect(png.readUInt32BE(16)).toBe(512);
  expect(png.readUInt32BE(20)).toBe(384);
});
it("cycles only the round orb frames at the palm, never the horizontal launch frames", () => {
  for (let ms = 0; ms < 10000; ms += 17)
    expect(golemEffectFrame("charge", ms)).toBeLessThan(GOLEM_CHARGE_ORB_FRAMES);
  // The orb loop still reaches its final orb frame before repeating.
  expect(golemEffectFrame("charge", 130 * (GOLEM_CHARGE_ORB_FRAMES - 1))).toBe(
    GOLEM_CHARGE_ORB_FRAMES - 1,
  );
  expect(golemEffectFrame("charge", 130 * GOLEM_CHARGE_ORB_FRAMES)).toBe(0);
});
it("dissipates an ended beam gradually instead of removing it at once", () => {
  let previous = golemBeamFade(0);
  expect(previous).toMatchObject({ alpha: 1, thickness: 1, done: false });
  for (let ms = 50; ms <= GOLEM_BEAM_FADE_MS; ms += 50) {
    const next = golemBeamFade(ms);
    expect(next.alpha).toBeLessThan(previous.alpha);
    expect(next.thickness).toBeLessThan(previous.thickness);
    // No single 50ms step drops more than a third of the remaining glow.
    expect(previous.alpha - next.alpha).toBeLessThan(0.34);
    previous = next;
  }
  expect(golemBeamFade(GOLEM_BEAM_FADE_MS)).toMatchObject({ alpha: 0, done: true });
});
