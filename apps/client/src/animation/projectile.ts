import baseFireball from "./baseFireballFrames.json" with { type: "json" };
export const magicAssets = {
  baseFireball: {
    url: "/assets/effects/coco/base-fireball.png",
    width: baseFireball.frameWidth,
    height: baseFireball.frameHeight,
    count: baseFireball.durations.length,
    fps: 1000 / 130,
    loop: true,
  },
  fireball: {
    url: "/assets/effects/coco/fireball.png",
    width: 48,
    height: 40,
    count: 36,
    fps: 1000 / 130,
    loop: true,
  },
  flight: {
    url: "/assets/effects/coco/flight.png",
    width: 64,
    height: 64,
    count: 4,
    fps: 14,
    loop: true,
  },
  core: {
    url: "/assets/effects/coco/core.png",
    width: 32,
    height: 32,
    count: 1,
    fps: 0,
    loop: false,
  },
  impact: {
    url: "/assets/effects/coco/impact.png",
    width: 96,
    height: 96,
    count: 7,
    fps: 14,
    loop: false,
  },
} as const;
export type MagicLayer = keyof typeof magicAssets;
export const magicKey = (layer: MagicLayer) => `coco:magic:${layer}`;
export const flightFrame = (elapsedMs: number) =>
  Math.floor((Math.max(0, elapsedMs) * magicAssets.flight.fps) / 1000) %
  magicAssets.flight.count;
export const impactDuration =
  (magicAssets.impact.count / magicAssets.impact.fps) * 1000;
export const impactFrame = (elapsedMs: number) =>
  Math.min(
    magicAssets.impact.count - 1,
    Math.floor((Math.max(0, elapsedMs) * magicAssets.impact.fps) / 1000),
  );

export const fireballFrame = (level: number, elapsedMs: number) =>
  (Math.max(1, Math.min(4, level)) - 1) * 9 +
  (Math.floor(Math.max(0, elapsedMs) / 130) % 9);

export function baseFireballFrame(elapsedMs: number) {
  let age =
    Math.max(0, elapsedMs) %
    baseFireball.durations.slice(0, 7).reduce((sum, n) => sum + n, 0);
  for (let i = 0; i < 7; i++) {
    if (age < baseFireball.durations[i]) return i;
    age -= baseFireball.durations[i];
  }
  return 0;
}

export const baseFireballImpactDuration = baseFireball.durations
  .slice(7)
  .reduce((sum, n) => sum + n, 0);
export const baseFireballImpactFrame = (elapsed: number) =>
  7 + Math.min(8, Math.floor(Math.max(0, elapsed) / 130));
