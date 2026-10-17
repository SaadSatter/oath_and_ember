import postTownMaps from "./postTownMaps.json" with { type: "json" };

// Existing PixelLab fall/base pines, also used by the bridge, shrine and griffin.
// Keep source PNGs and provenance intact; anchor their verified ground row to
// the town's existing trunk position without changing gameplay geometry.
export function settlementTreeArt(index: number) {
  const objectIndex = index % 2 === 0 ? 0 : 3;
  const source = postTownMaps.TRANSITION_TRAIL.objects[objectIndex];
  return {
    texture: `TRANSITION_TRAIL:object:${objectIndex}`,
    filename: source.filename,
    size: 128,
    originX: 0.5,
    originY: (source.groundY - source.y) / 112,
  };
}
