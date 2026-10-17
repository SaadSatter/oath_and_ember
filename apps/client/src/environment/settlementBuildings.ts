// Frames exclude transparent canvas padding without altering the approved PNGs.
// World-space building areas and collision remain authored in shared settlements.
export const settlementBuildingFrames: Record<
  number,
  readonly [number, number, number, number]
> = {
  1: [44, 25, 123, 156],
  2: [44, 25, 123, 156],
  3: [44, 20, 166, 218],
};
