import metadata from "./siegAttackFrames.json" with { type: "json" };
import type { CombatDirection } from "./combat.js";
export const siegAttackMetadata = metadata;
export const siegBasicKey = "hero:OATH:basic";
export const siegBasicAsset = {
  url: "/assets/characters/oath/basic.png",
  frameWidth: 128,
  frameHeight: 128,
};
export function siegBasicClip(direction: CombatDirection) {
  const d = direction === "left" ? "right" : direction;
  const durations = metadata.directions[d].frames.map((f) => f.durationMs);
  const durationMs = durations.reduce((sum, ms) => sum + ms, 0);
  const start = metadata.directions[d].frames[0].frame;
  return {
    start,
    end: start + durations.length - 1,
    fps: (durations.length * 1000) / durationMs,
    durationMs,
    durations,
  };
}
export function actionFrame(
  clip: {
    start: number;
    end: number;
    fps: number;
    durations?: readonly number[];
  },
  elapsedMs: number,
) {
  if (!clip.durations)
    return (
      clip.start +
      Math.min(
        clip.end - clip.start,
        Math.floor((Math.max(0, elapsedMs) * clip.fps) / 1000),
      )
    );
  let elapsed = Math.max(0, elapsedMs);
  for (let i = 0; i < clip.durations.length; i++) {
    if (elapsed < clip.durations[i]) return clip.start + i;
    elapsed -= clip.durations[i];
  }
  return clip.end;
}
