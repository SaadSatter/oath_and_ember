import type Phaser from "phaser";
import meta from "../../public/assets/enemies/ironbound_sentinel/attack.json" with { type: "json" };
export const golemKey = (kind: string) => `golem:${kind}`;
export function preloadGolemAttack(scene: Phaser.Scene) {
  scene.load.spritesheet(
    golemKey("beam-tip"),
    "/assets/enemies/ironbound_sentinel/beam-tip.png",
    { frameWidth: 128, frameHeight: 128 },
  );
  scene.load.spritesheet(
    golemKey("beam-middle"),
    "/assets/enemies/ironbound_sentinel/beam-middle.png",
    { frameWidth: 64, frameHeight: 128 },
  );
  for (const kind of ["attack", "charge", "blast", "melee"])
    scene.load.spritesheet(
      golemKey(kind),
      `/assets/enemies/ironbound_sentinel/${kind}.png`,
      { frameWidth: 128, frameHeight: 128 },
    );
}
// The charge sheet's last five cells are horizontal beam-launch frames. The
// palm glow is never rotated, so they read as a sideways beam whatever the
// golem's aim; the palm only cycles the round energy-orb cells.
export const GOLEM_CHARGE_ORB_FRAMES = 12;
export function golemEffectFrame(
  kind: "charge" | "blast",
  elapsed: number,
  loop = true,
) {
  const durations =
    kind === "charge"
      ? meta.effects.charge.durations.slice(0, GOLEM_CHARGE_ORB_FRAMES)
      : meta.effects[kind].durations,
    total = durations.reduce((a, b) => a + b, 0);
  let t = loop ? Math.max(0, elapsed) % total : Math.max(0, elapsed);
  for (let n = 0; n < durations.length; n++) {
    if (t < durations[n]) return n;
    t -= durations[n];
  }
  return durations.length - 1;
}
export const golemBlastDuration = meta.effects.blast.durations.reduce(
  (a, b) => a + b,
  0,
);
export function golemAttackFrame(direction: string, progress: number) {
  return (
    meta.directions.indexOf(direction) * 9 +
    Math.min(8, Math.floor(Math.max(0, progress) * 9))
  );
}
export { golemPalm } from "../../../../packages/shared/src/golem.js";

export function golemMeleeFrame(direction: string, progress: number) {
  return (
    meta.directions.indexOf(direction) * 6 +
    Math.min(5, Math.floor(Math.max(0, progress) * 6))
  );
}

/** Eleven occupied cells in row order; the twelfth cell is empty. */
export function golemBeamTipFrame(elapsedSeconds: number) {
  const frame = Math.floor(Math.max(0, elapsedSeconds) / 0.09);
  return frame < 11 ? frame : 8 + ((frame - 11) % 3);
}

// After the beam ends it lingers and dissipates instead of vanishing: it fades
// out while the ray thins toward nothing. Presentation only.
export const GOLEM_BEAM_FADE_MS = 600;
export function golemBeamFade(elapsedMs: number) {
  const t = Math.min(1, Math.max(0, elapsedMs) / GOLEM_BEAM_FADE_MS),
    ease = 1 - (1 - t) * (1 - t);
  return { alpha: 1 - ease, thickness: 1 - 0.85 * ease, done: t >= 1 };
}
