# Hedge Maze implementation checkpoint

Implemented the approved 48×40, strictly top-down maze using logical 32px tiles. The current campaign has a marked **E · HEDGE MAZE** entrance in Forest Ruins at (240,450). E at the maze's western return point brings the party back to this entrance. This is an interim campaign connection until the approved shrine hub is integrated. Like the existing campaign, map transitions currently move the party together; independent branch simulation is still a later integration task.

The full layout is carved from the approved paths, with loops, dead ends and solid hedge boundaries. Flight cannot bypass those boundaries. One amber bush blocks the required route and burns only on a valid Coco Fireball contact; other walls obstruct the shot and remain solid.

Five guards: two Mosslings, two Cinder Wisps and one Ironbound Sentinel in the approved two groups. The sentinel now uses the user-supplied forest golem sprites and charged white beam with a two-tile explosion; see `golem-attack-implementation.md`. The separate key carrier uses a Mossling appearance with a gold key indicator and has no damage or Black Hole path; it is a puzzle actor, not a sixth combat guard.

The cow is a harmless, damage-immune 128px body. Black Hole hits its physical boundary and pulls it incrementally along the grazing lane into the bay. Pulling respects walls and living player bodies; the cow never teleports. Successful parking latches, preserving the cleared lane on revisits.

The key carrier chooses escape destinations using navigable distances from both living heroes, rather than a fixed patrol. It respects maze collision. Its base speed is 430 px/s, reduced to 86 by Slow Time, while boosted Sieg retains 190 px/s. Sieg must be within 42px while both Slow Time and Super Speed are active to tag it using E. The server grants one shared key and permanently records capture.

The shared key opens the sole chest gate through an atomic server transaction. One shears reward can then be claimed by either hero. Gate state, burned bush, parked cow, captured runner and inventory survive returning to the campaign and revisiting the maze. Unfinished combat and actor states are held in the existing in-memory map cache. Full game restart resets the quest foundation.

Validation:
- Collision / fireball / flight tests for the burnable bush and solid boundaries.
- Incremental Black Hole cow movement, player obstruction, damage immunity and no wall overlap.
- Exact guard composition and golem charged attack.
- Reactive fleeing, 0.2 speed interaction, required cooperative tag, key payment, gated reward and persistence on revisit.
- A complete movement-intent walkthrough from normal spawns: navigate to bush, cast Fireball, reach bay, cast Black Hole, navigate both heroes to the chase, use Slow Time + Super Speed, pursue and tag, unlock gate, collect shears, walk back. Combat guards are excluded from this test to isolate puzzle traversal; their composition and behavior are tested separately. No position teleporting is used in this walkthrough.
- `scripts/qa-hedge-maze.ts`: two-browser rendering and real keyboard ability casts. Camera fixtures place players for screenshots; guards are excluded during the focused ability checks. Screenshots are in `qa/maze-*.png`.

Not included in this stage: Mirror Pond, Griffin encounter, shrine quest completion, or independent multi-map simulation. Their designs remain approved.

Final checks: `npm run typecheck`, all 227 tests across 34 files, `npm run build`, and two-client browser QA passed. The normal Vite large-bundle advisory remains unchanged.
