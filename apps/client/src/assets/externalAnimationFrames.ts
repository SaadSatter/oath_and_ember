type DirectionContract = {
  x_edges: number[];
  directions: string[];
  animation_frames?: Record<string, number[]>;
  direction_aliases?: Record<
    string,
    { source_direction: string; flip_x: boolean }
  >;
  standing_frames?: Record<string, number>;
};
export function externalDirection(c: DirectionContract, direction: string) {
  const alias = c.direction_aliases?.[direction];
  return {
    sourceDirection: alias?.source_direction ?? direction,
    flipX: alias?.flip_x ?? false,
  };
}
export function externalAnimationFrames(
  c: DirectionContract,
  row: number,
): number[] {
  const columns = c.x_edges.length - 1;
  const direction = externalDirection(c, c.directions[row]).sourceDirection;
  const sourceRow = c.directions.indexOf(direction);
  if (sourceRow < 0) throw Error("Missing canonical direction");
  return (
    c.animation_frames?.[direction] ??
    Array.from({ length: columns }, (_, i) => i)
  ).map((col) => sourceRow * columns + col);
}
export function externalStandingFrame(c: DirectionContract, direction: string) {
  const canonical = externalDirection(c, direction).sourceDirection;
  return (
    c.directions.indexOf(canonical) * (c.x_edges.length - 1) +
    (c.standing_frames?.[direction] ?? 0)
  );
}
