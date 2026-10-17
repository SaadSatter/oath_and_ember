import source from "../../public/assets/environment/bridge-ruins/water-tiles.json" with { type: "json" };
// Lower terrain is water, upper terrain is grass in the approved Wang sheet.
const corners = ["NW", "NE", "SW", "SE"] as const;
export const shoreFrames = new Map(
  source.tileset_data.tiles.map((tile, index) => [
    corners.reduce(
      (mask, c, i) => mask | (tile.corners[c] === "lower" ? 1 << i : 0),
      0,
    ),
    index,
  ]),
);
export const shoreFrame = (mask: number) => {
  const frame = shoreFrames.get(mask);
  if (frame === undefined) throw Error(`Missing shoreline Wang frame ${mask}`);
  return frame;
};
