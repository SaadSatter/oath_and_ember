export const magicAssets = {
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
