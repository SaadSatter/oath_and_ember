# Main house exterior and interior

Run `npm run dev`, open http://localhost:5173 in two separate browser sessions, create a fresh room, choose Sieg/Coco and ready both. Normal play starts outside the front door. Press E near it to enter the house independently; press E near the lower-right interior doorway to return. Release E between transitions. Walk south through the fence opening, follow the path east and press E at EXIT to begin the existing shared forest progression. The forest exit remains a party transition, including a partner still inside the house. `npm run enemy:encounter` deliberately bypasses the house.

## Authored maps and scale

Sources are `Images/Sprites/Map Sprites, Top Down/Main House/Tiled_files/Exterior.tmx` and `Interior1.tmx`, with their matching PNG sheets. Source art is copied without pixel edits. The similarly named PNG-folder exterior sheet has different dimensions and must not be substituted. `scripts/import-house-map.py` and `scripts/import-house-interior.py` flatten authored infinite chunks, preserving layer order and Tiled GIDs/flip flags. Maps contain no authored collision/object layers, so shared deterministic collision footprints are manually reviewed against the art.

Exterior: source occupied tile origin (-18,-7), 27×20 tiles, 864×640 world. Interior: source occupied tile origin (-17,-10), 26×22 tiles, 832×704 world. Both retain 16px tiles rendered uniformly at **2×**, giving 32 world units per tile. Camera zoom is **1** on both maps, with nearest-neighbor textures, rounded pixels and the existing uniform integer CSS enlargement. No character sheet or `characterVisuals.ts` scale changes: heroes retain 48×64 cells, scale1 and anatomical anchor (24,60), with the existing13-world-unit presentation offset. Their visible height is roughly48–51 world units, about1.5 environment tiles. Source furniture is a coarser pixel grid than the normalized heroes; this difference is preserved, not disguised by stretching.

The interior's playable authored room bounds (160,160,512,352) frame the camera. If the viewport contains the room it is centered at the existing zoom; smaller viewports follow the local hero within those bounds. The room is not enlarged to fill a screen. Dark padding and letterboxing are intentional. Exterior follows each local hero independently.

## Locations and collision

All coordinates below are world units after source-origin normalization and2× tile scaling:

- Exterior starts: Sieg (456,354), Coco (506,354).
- Exterior door interaction: (480,326), radius42; return immediately outside at (480,344).
- Interior entry: (608,454); exit interaction (608,430), radius42.
- Arrivals choose a nearby walkable horizontal offset (0,+32,-32,+64,-64) when the partner occupies the nominal spawn.
- Forest exit: (810,500), radius50; existing party progression continues.

Server-side `Player.sceneId` records individual location independently of `World.sceneId` (shared progression). Server creates all live location fields; optional typing only supports old internal fixtures. Inputs contain only intent, not a requested scene. Collision/prediction use each player's location. Clients render co-located heroes only and reset local prediction/interpolation at transitions; remote interpolation never blends coordinates across locations. Projectiles carry location and impacts are filtered accordingly; enemies cannot target or resolve hits against heroes in another location. Entry preserves health, skills and room progression. Reconnect restores the location. Held E is latched until release to prevent door loops.

Solid house/fence/furniture bases and boundaries are in `packages/shared/src/maps.ts`. Doors remain walkable. Rugs/details remain non-solid. Interior furniture uses unchanged source tile frames, sorted by connected furniture ground footprints, while rugs remain behind heroes. Exterior roof and tree canopies sort against ground position. The staircase treads are walkable between their solid flanking walls; there is no upstairs scene or new door layout. The rug is floor with separate table/chair footprints. The upper wall face is blocked through y224. Couch sorting separates its atlas region from adjacent dining-set tiles and uses the visible ground edge (y334), excluding tile padding.

## Layers and assets

Interior layers: Floor, Tile Layer6, Boxes, Walls, Windows, Objects1, Objects2. Images: walls_floor.png, Interior.png, Doors_windows_animation.png. Initial authored animation poses remain static. Furniture atlas tiles in its upper256px are foreground depth-sorted; rugs/scattered floor details remain in the original ground layers. Exterior retains all22 authored layers and matching source sheets; verified tree tiles are replaced with supplied forest tree sprites, as before. Six Tree/Moss_tree variants retain original64/128px canvases and verified trunk-base origins. Airship maps are unchanged.

Provenance: `docs/ENVIRONMENT_ASSET_PROVENANCE.json` (exterior/trees) and `docs/HOUSE_INTERIOR_PROVENANCE.json` (interior source/copy/output hashes and normalization). No artwork generation or retired art pipeline is used.

## QA

Run typecheck, full tests and build. `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/oath-ember-playwright node --import tsx scripts/house-interior-qa.ts qa/NEW_DIRECTORY` exercises two real browsers: independent entry, held-E safety, both inside, independent exit, movement, all four required viewport sizes, equal horizontal/vertical canvas scaling, and forest progression. The harness uses one explicit authoritative placement fixture to return to the previously browser-tested interior door; other entry/exit/movement checks use ordinary keyboard input. Screenshots, recordings, reports and failed attempts are preserved in each fresh directory. Physical mobile/touch feel is outside desktop browser emulation.

Latest verified evidence: `qa/house-interior-v3/REVIEW.html` links both recordings, independent-location screenshots and all16 responsive exterior/interior screenshots. These screenshots were visually inspected. `qa.json` reports no runtime/asset-loading errors. Typecheck,90 tests across15 files and build pass; the existing Phaser bundle-size warning remains. Failed attempts in v1/v2 are retained; v2 also encountered asset404s because a build was mistakenly run while QA was reading dist. Final QA ran only after the completed build.

## Changed files for this feature

- `packages/shared/src/gameTypes.ts`
- `packages/shared/src/maps.ts`
- `apps/server/src/GameRoom.ts`
- `apps/server/src/enemySimulation.ts`
- `apps/client/src/environment/EnvironmentView.ts`
- `apps/client/src/main.ts`
- `apps/client/src/net/NetworkClient.ts`
- `apps/client/src/net/prediction.ts`
- `apps/client/src/net/interpolation.ts`
- `apps/client/public/assets/environment/main-house/interior-map.json`
- `apps/client/public/assets/environment/main-house/Interior.png`
- `apps/client/public/assets/environment/main-house/walls_floor.png`
- `apps/server/test/houseInterior.test.ts`
- `apps/server/test/mainHouse.test.ts`
- `apps/server/test/game.test.ts`
- `apps/client/test/housePresentation.test.ts`
- `scripts/import-house-interior.py`
- `scripts/import-house-map.py`
- `scripts/house-interior-qa.ts`
- `docs/HOUSE_INTERIOR_PROVENANCE.json`
- `docs/ENVIRONMENT_ASSET_PROVENANCE.json`
- `docs/HOUSE_AND_TREES.md`

## Interior footprint correction

Evidence: `qa/interior-footprints-v3/REVIEW.html`. Regression tests cover rug margins, the stair approach, upper wall contact, table/chair blocking and couch contact. Typecheck, 116 tests and build pass. Supplied TMX and images, tile scale, character dimensions and movement speed remain unchanged.

Final room audit: zero backward steps and zero solid penetrations in authoritative, predicted and rendered traces across all six client/stage combinations, with no browser errors. Recorded v2 and corrected clear-start v3 fixtures are retained. A socket test timed out during concurrent video finalization; the targeted 17-test collision/interior suite passed after QA closed. An earlier timing-sensitive combat assertion also passed on the complete 116-test rerun.
