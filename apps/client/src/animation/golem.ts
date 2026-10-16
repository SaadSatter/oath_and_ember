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
export function golemEffectFrame(
  kind: "charge" | "blast",
  elapsed: number,
  loop = true,
) {
  const durations = meta.effects[kind].durations,
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
