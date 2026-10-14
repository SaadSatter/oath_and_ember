import metadata from "./blackHoleFrames.json" with { type: "json" };
export const blackHoleKey = "magic:black-hole";
export const blackHoleAsset = {
  url: "/assets/effects/coco/black-hole.png",
  frameWidth: metadata.frameWidth,
  frameHeight: metadata.frameHeight,
};
export function blackHoleFrame(
  elapsed: number,
  phase: "travel" | "vortex" = "travel",
) {
  const start = phase === "vortex" ? metadata.durations.length - 3 : 0;
  const end =
    phase === "vortex"
      ? metadata.durations.length
      : metadata.durations.length - 3;
  const duration = metadata.durations
    .slice(start, end)
    .reduce((sum, n) => sum + n, 0);
  let age =
    phase === "vortex"
      ? Math.max(0, elapsed) % duration
      : Math.min(Math.max(0, elapsed), duration - 1);
  for (let i = start; i < end; i++) {
    if (age < metadata.durations[i]) return i;
    age -= metadata.durations[i];
  }
  return end - 1;
}
