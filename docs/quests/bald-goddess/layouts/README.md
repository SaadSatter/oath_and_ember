# The Bald Goddess — annotated map proposals

All four map designs approved by the user on October 14, 2026, including the latest maze monsters, reactive runner, east-perimeter spike entrance / southern wall, submerged pond center, and Griffin lake / pillar encounter. These are approved layout specifications, not implemented levels or final PixelLab artwork. Map-layout approvals need not be requested again. The inventory UI/state design was subsequently approved and its shared foundation implemented. The Hedge Maze and Mirror Pond are now implemented; see `../hedge-maze-implementation.md` and `../mirror-pond-implementation.md`. The central Goddess Shrine hub is also implemented; see `../shrine-implementation.md`. Griffin encounter and independent multi-scene simulation remain subsequent stages.

The Griffin nest interaction is approved: deliver the mirror to distract it, then deliver shears during distraction to cut automatically and award one wig without defeating it. Both tools remain shared and owned; combat and cutting cannot award duplicate wigs.

| Image | Region | Dimensions | Main content |
|---|---|---|---|
| [Goddess Shrine](01-goddess-shrine.png) | Central hub + southern Start / Return | 40 × 32 | Statue, offering point, player start, open N/E/W branches, southern return |
| [Hedge Maze](02-hedge-maze.png) | East | 48 × 40 | Complex loops, burnable hedge, Black Hole cow blockade, reactive fleeing runner + Slow Time / Super Speed key chase, locked shears chest |
| [Mirror Pond](03-mirror-pond.png) | West | 48 × 40 | Vertical spike entry, four perimeter mirrors with distinct angles, protected torches, flying firing positions, reset-to-pass shutters, center platform + bridge rise only after all torches |
| [Griffin Enclosure](04-griffin-enclosure.png) | North | 40 × 36 | Northern-third lake, north-center nest, airborne lasers, shoreline Black Hole pull, four collapsing pillars, headbutt / stun openings |

Each plan includes a logical tile grid, portals, example routes, colored actor/mechanism markers, solution notes, ability limitations and reset rules. Gold is Sieg/physical, purple is Coco/magic, cyan is a mechanism/return. Dashed paths denote links, flight or conditional access; they are not all walkable terrain. Each diagram's notes identify the distinction.

All item rewards use the proposed shared room inventory. Chests remain locked until their actual puzzle/encounter conditions are met. E is interaction for both heroes; Sieg pushes using 1 or the Push icon. No required puzzle depends on presently unavailable Heavy Break, Telekinesis or Blink.

The shrine preview incorporates the supplied crying-statue source intact; the other shapes are schematic planning glyphs. Final approved layouts will reuse existing verified PixelLab assets wherever possible. The SVG originals remain editable alongside each PNG.

Generation: `python3 scripts/plan-bald-goddess-maps.py` writes the SVGs. Render their 1600 × 1220 canvases in Chromium at device scale 1 for the PNG previews. Plans have been visually checked for readable labels and route/boundary alignment. They have not been implemented or gameplay-tested.
