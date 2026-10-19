# Chapter 0 prologue: A Promise Kept

The prologue is opt-in for now, so the normal campaign start is unchanged:

```sh
npm run prologue   # build, then serve with PROLOGUE=1 on http://localhost:3019
```

Create a room in two tabs, choose Sieg and Coco, and ready both. The whole prologue plays in about 8–12 minutes, then Chapter 0, Part 1 continues with Coco's errand (`docs/CHAPTER0_PART1.md`).

## Scenes

| # | Scene | Where | Starts when | Notes |
| --- | --- | --- | --- | --- |
| 1 | `visit` | Shop ground floor | Sieg walks in the front door | Coco starts inside and can pester Alden (E) while she waits |
| 2 | `fork` | Road below the garden fence | Either hero reaches the road | Sieg's inner narration is his alone |
| — | (travel) | Shop road → `PROLOGUE_TRAIL` | E at `← FOREST` (west) | Emberbrook (east) stays closed until the end |
| 3a | `cart` | Forest trail | Either hero comes within 96 units of the cart | Crates and barrel: E to inspect, with a different line for each hero |
| — | (travel) | Trail → `PROLOGUE_CLEARING` | E at `FOLLOW THE TRACKS` | Only after the cart has been found |
| 3b | `ambush` | Clearing | Arriving | A golem (Ironbound Sentinel) and a Cinder Wisp rise and hold still until the lines end. Their sprites, AI, stats and attacks are unchanged |
| — | fight | Clearing | `ambush` ends | Monsters rise one at a time, every 3 s, at the nearest free spot a safe distance from the heroes. Each one beaten is replaced, up to 8 at once (4 golems, 4 wisps). Heroes cannot fall below 15 HP |
| 3c | `rescue` | Clearing | Either hero at 25 HP or less, or 45 s pass. First the fight freezes and the ambush fills to eight from the clearing's rim; all eight walk in and ring the heroes, leaving the north open. Then Alden enters | Enemies freeze and their shots vanish. Alden walks in from the north path while the clearing glows, then casts. On the flash line every monster standing dies on the same server tick |
| 4–5 | `home` | Shop upstairs, that evening | Chained | Both heroes healed. Scolding, "You always do.", the marriage joke, Sieg's goodnight |
| 5 | `farewell` | The garden gate | Chained | Private to Sieg; Coco is downstairs and sees a narration line |
| 6 | `morning` | Shop ground floor | Chained | Private to Coco; Sieg is in his room at home (above Hearthside Cottage), polishing an old wooden practice sword. The first two rules of magic are not revealed. Alden's list matches Part 1's errand |
| end | — | Shop road | `morning` ends | Flag `prologue.complete`; Chapter 0, Part 1 begins with Coco's errand (see `docs/CHAPTER0_PART1.md`) |

Coco calls Alden "Papa" throughout.

## How it works

- **Script as data:** `packages/shared/src/prologue.ts` holds the stages, every line, each hero's placement (optionally in different scenes), Alden's position and walk target, line cues (`alden-enter`, `alden-cast`, `flash`, `glow`), objectives, the trail inspection lines and the ambush tuning.
- **Walking into place:** when a scene starts, the story takes the controls and walks each hero in it to their mark from wherever they are, around obstacles, before the first line. Only a hero on another map is moved there instead.
  - **Smooth:** the walk is announced a moment before its first step (`storyWalk.ts`). The walking hero's own client then predicts it tick by tick with the same function the server uses, so it is as smooth as ordinary movement.
  - **Nobody is sent back:** the hero whose own movement starts a scene (reaching the road, the cart, the shop door…) stops where they are. Their partner takes their place beside them in the scene's arrangement. Until the walk's first step, the hero's own movement plays out on the server just as their screen showed it, so nothing snaps back. Only `exact` scenes (Coco kneeling beside Alden; the reunion) walk everyone to fixed marks.
  - **Never stuck:** a walk that is blocked finishes in place, and no scene waits more than 12 s for its cast to walk in.
  - **Measuring it:** `node --import tsx scripts/qa-walk.ts` records every frame of a walk in two browsers and reports the largest single-frame step and any direction reversals.
- **Server-owned:** `apps/server/src/prologue.ts` runs it. It starts scenes from triggers and handles chaining, party travel and enemy spawns. It enforces the fight's HP floor and timing, walks Alden, and runs the spell. While a scene plays, the room ignores movement, attacks, abilities and doors.
- **Reading lines:** the only client message is `story:read {cutscene, line}`. One read is enough: whichever hero presses E first moves the line on for both. Stale, repeated or wrong-line reads (including both pressing at once) are ignored, so nothing skips or plays twice. Lines with an `audience` are private: only that hero can advance them, and the partner sees the `elsewhere` text.
- **Disconnects:** while a partner is away the room is paused, so scenes, the fight timer and Alden all wait. A reconnecting hero lands on the same line, because the story lives in `World.story`.
  - A client that reconnects before the server has noticed its old socket close now takes the session over, instead of being refused and sent back to the title screen. The old socket's late close is ignored.
- **Presentation:**
  - `ui/storyDialogue.ts`: the shared dialogue box.
  - `entities/AldenView.ts`: Alden, from `World.story.alden`.
  - `entities/StoryEffects.ts`: the spell circle and the white flash.
  - Outdoors, the camera frames the local hero together with Alden during his scenes.

## Maps

All built maps share one format (`packages/shared/src/composedScenes.ts`):

- one backdrop image under the heroes;
- props from one atlas, depth-sorted by their base;
- collision generated from the same layout.

Both builders copy source pixels; they never repaint them.

### Alden's Magic Shop: `scripts/build-magic-shop.py`

- `HOUSE_INTERIOR` (the main house's interior, now the shop) and the new `HOUSE_UPPER`.
- The walls and floor are the house's own tiles.
- Furniture comes from the house atlas and the Craftpix *Guild or magical building* pack (same publisher and style, already in `Images/Sprites`).
- **Ground floor:**
  - stairs up;
  - pantry;
  - Alden's bookcase and research board;
  - magic table with books and ink;
  - a PixelLab cauldron;
  - a magic circle on the floor (the healing spot);
  - two potion shelves (the house's empty shelf, stocked with its own bottles, some hue-shifted);
  - a counter and potion stand facing the front door;
  - a dining corner.
- **Upstairs:**
  - Coco's bed, desk and wardrobe;
  - a guest bed (where Sieg wakes);
  - Alden's bed, bookshelf and research board;
  - the stairwell down.
- E at the stairs moves each hero between floors on their own, like the front door.

### Forest: `scripts/build-prologue-forest.py`

- `PROLOGUE_TRAIL` (40×24 tiles) and `PROLOGUE_CLEARING` (32×24).
- **Ground:** the house exterior's dirt with its grass border tiles, chosen per tile from which corners are grass, so the paths have the same soft edges as the shop road.
- **Trees:** the house's tree sprites. No canopy may overhang walkable ground, so heroes are never hidden behind a tree.
- **Collision:** every non-walkable tile, merged into rectangles.
- **Trail:** a winding path, with the PixelLab merchant cart and spilled crates in a meadow.
- **Clearing:** an open oval with no inner obstacles (enemy movement does not pathfind). Heroes enter from the south-east; Alden comes down the bramble-closed north path.

### Alden's grave

- A PixelLab dirt mound with a tombstone, at the foot of the small tree west of the garden fence, beside the big oak.
- The regular campaign happens after the burial, so the grave shows whenever no prologue is running.
- During the prologue it stays hidden until the story records `chapter0.burial`, which the later burial scene will set.

## Alden

- **Character:** PixelLab character `fce323ef-89bc-4186-b30b-7baafd59b0c2`, made with the villagers' settings: standard mode, 64 px, 4 directions, high top-down.
- **Look:** grey hair, spectacles, green work robe and apron. No staff while walking or talking; he raises it only to cast.
- **Sheet:** `node scripts/import-alden.mjs` packs `assets/npcs/alden.png` in 112 px cells with feet on y89. Rows 0–3 hold a standing frame plus an 8-frame walk for each direction (west is the east walk mirrored). Row 4 is a 9-frame spellcast with a blue arcane swirl.
- **Two legs:** PixelLab's template walk showed only one leg facing south or north. The standing poses for those directions are the turnaround images with the staff erased (`scripts/alden-unstaff.py`). Their walks were regenerated from those poses.

## Asset provenance

- `Images/Sprites/Story_NPCs/alden/provenance.json`: Alden's frames and generation settings.
- `Images/Sprites/Story_Props/provenance.json`: the cauldron, grave and merchant cart. All are style-matched against the house's own floor, grass and road pixels.

## Tests and QA

- `apps/server/test/prologue.test.ts` (14 tests):
  - placements on clear ground;
  - free roam before triggers;
  - the lock during scenes;
  - first-read advance, stale reads, and the disconnect wait and reconnect;
  - private lines;
  - trail travel and the closed exits;
  - the cart and the ambush spawn;
  - the HP floor, the rescue trigger and timer, and all eight enemies dying on one tick;
  - home, farewell, morning and the open road;
  - real-socket sync, including rejecting malformed reads.
- `apps/server/test/houseInterior.test.ts`:
  - door and stair travel for each hero;
  - furniture and wall collision;
  - every door, stair and story spot reachable from the entrance.
- `node --import tsx scripts/qa-prologue.ts qa/<fresh>`: two real browsers play the whole prologue, with every line read via E. Latest run: `qa/prologue-v2`.
- `node --import tsx scripts/qa-magic-shop.ts qa/<fresh>`: both shop floors and the grave in real browsers. Latest run: `qa/magic-shop-v1`.

## Known limits

- The prologue is still opt-in (`PROLOGUE=1`). Making it the default start is a one-line change in `apps/server/src/index.ts`.
- The old house interior's Tiled map is no longer drawn. It remains the source for the village interior builder, and `mapClassification.ts` still classifies it.
- The later Chapter 0 scenes are not built yet:
  - Coco finding Alden;
  - the mysterious woman;
  - "Remember your oath";
  - the burial (which sets `chapter0.burial`), with Sieg's practice sword on the grave.
