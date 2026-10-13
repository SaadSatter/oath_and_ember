import metadata from "./siegPushFrames.json" with { type: "json" };
import type { CombatDirection } from "./combat.js";
export const siegPushKey = "hero:OATH:push";
export const siegPushAsset = {
  url: "/assets/characters/oath/push.png",
  frameWidth: 128,
  frameHeight: 128,
};
export function siegPushFrame(direction: CombatDirection, now: number) {
  const clip = metadata.directions[direction];
  let age = now % clip.durations.reduce((sum, duration) => sum + duration, 0);
  for (let i = 0; i < clip.durations.length; i++) {
    if (age < clip.durations[i]) return clip.start + i;
    age -= clip.durations[i];
  }
  return clip.start;
}
