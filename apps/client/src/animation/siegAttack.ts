import { swordTiming } from "../../../../packages/shared/src/combat.js";
import type { CombatDirection } from "./combat.js";
// Presentation-only timing: readable wind-up, faster contact, settled recovery.
const swordFrames = {
  right: [55, 45, 45, 45, 30, 30, 30, 30, 30, 30, 40, 40],
  up: [70, 70, 35, 35, 35, 35, 35, 35, 50, 50],
  down: [65, 35, 35, 35, 30, 30, 30, 30, 35, 35, 45, 45],
} as const;
export const siegBasicKey = "hero:OATH:basic";
export const siegBasicAsset = {
  url: "/assets/characters/oath/basic.png",
  frameWidth: 128,
  frameHeight: 128,
};
export function siegBasicClip(direction: CombatDirection) {
  const d = direction === "left" ? "right" : direction;
  const durations = swordFrames[d];
  const start = { right: 0, up: 12, down: 24 }[d];
  return {
    start,
    end: start + durations.length - 1,
    fps: (durations.length * 1000) / swordTiming.durationMs,
    durationMs: swordTiming.durationMs,
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
