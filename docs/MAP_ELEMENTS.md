# House map elements

House presentation explicitly classifies tiles as `wall`, `object`, `path`, or
`door` in `apps/client/src/environment/mapClassification.ts`. Authored regions
are evaluated in order, so a doorway or individual chair overrides the broader
wall or table region containing it. Tile adjacency is not an object definition.

- Paths include floors, rugs, roads, stair treads, and thresholds. They retain
  authored tile-layer ordering below actors.
- Objects retain one ground anchor across all their tiles. Dining chairs have
  separate anchors from the table; touching props remain independent.
- Walls use their ground bases, including their raised faces.
- Doors distinguish the foreground arch/frame from the traversable opening.
  Classification does not open a closed door or complete a puzzle.

Players and enemies sort by simulation Y. House element depth is ground Y minus
13, matching the existing player art's feet offset. Preserve source tile flips,
rotation, integer scale, and nearest-neighbor filtering when extracting tiles.

`packages/shared/src/mapElements.ts` classifies the reviewed interior solid
footprints. `maps.ts` flattens these same footprints for server movement and
client prediction. Collision coordinates are unchanged; neither atlas pixels
nor presentation anchors generate gameplay collision. Trees retain their
existing ground anchors and authoritative trunk footprints.

When adding a house prop, author its full tile region and ground anchor. If it
also needs collision, review and add its physical footprint separately. Add an
approach regression for both sides of the anchor and for any traversable gap.
