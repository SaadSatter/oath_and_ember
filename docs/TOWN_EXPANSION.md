# Village and town expansion

## Where to go

- Emberbrook Village: press E at the southeast sign (1030, 650) for Willowbank.
- Willowbank Village: E at the north sign (640, 190) continues to Stonebridge.
  The south sign returns to Emberbrook. Enter the Riverside Home at (312, 376).
- Stonebridge Town: E at the south sign returns to Willowbank. Enter the inn at
  (440, 484). Other buildings are exterior scenery in this expansion.
- Stairs in Hearthside Cottage, Elder Bertram's House, Brynn's Apothecary,
  Riverside Home and Stonebridge Inn connect independent ground/upper scenes.
  Press and release E at the stairs. Each hero can explore a different floor.

There are two new exterior maps, two new ground floors and five upper floors
(ten furnished house-floor maps total). Towns have roads, water, solid building
footprints, trees and wells. Stairs and portals are validated server-side using
shared static geometry; clients send E intent, never destinations or positions.
No combat, quest gate, saved progression or service topology changes are needed.

## Artwork and regeneration

Existing approved original village houses, grass, water and trees are reused.
Both new towns alternate the approved PixelLab fall and base pines from
`post-town/transition_trail` (objects `29197f1c-aaf7-47e0-8f88-a786fcd15581`
and `379c80d1-5c82-4ab8-b14d-98c2e88bb8b4`), also used by the bridge puzzle,
shrine and griffin area. Their source PNGs remain unchanged. Trees render at
128 × 128 with nearest-neighbor filtering and verified trunk-base anchors;
the towns' authoritative trunk positions and collision footprints are unchanged.
LPC furnishings retain their original credits and CC-BY-SA 3.0 license in
`apps/client/public/assets/environment/lpc-interiors`. Kenney Roguelike Indoors
(CC0) supplies furniture and plaza seating; its source archive and License.txt
are retained in `Images/asset-sources/kenney-roguelike-indoors` and
`apps/client/public/assets/environment/kenney-indoors`. New town arrangements and
stair decorations are original. Nearest-neighbor filtering is preserved.

Run these commands from the repository root after changing room layouts:

```
node scripts/build-village-interiors.mjs
node scripts/build-lpc-village-interiors.mjs
npm run typecheck
npm test
npm run build
node --import tsx scripts/qa-town-expansion.ts
```

The browser QA opens two independent clients, checks every furnished floor and
both town maps for asset/runtime errors, and saves screenshots in
`qa/town-expansion`. Gameplay tests verify reachable landings and signposts,
independent and release-gated E travel, movement epochs, identical socket
snapshots, and rejection of fabricated client destinations.

## Clean layout revision

Furniture now uses reviewed world-space areas in
`scripts/village-room-layouts.mjs`, rather than inheriting the old atlas stamps'
size or transparent padding. Art frames fit inside those areas; explicit
footprints are written to shared room geometry. All ten floors reserve clear
stairs and door routes. Rugs may lie beneath furniture; other furnishing areas
and stair artwork must not overlap. Floor furniture stays below the windows.

Trees, houses, wells and seating have separate visible areas in both towns.
Extra residential paths connect house fronts to the main roads. Enterable houses
use one E label rather than overlapping a second building-name label.

Nine residents have been added across Willowbank, Stonebridge and the inn. Six
walk deterministic clear routes, two healers stand at their posts, and the
innkeeper welcomes visitors. All use the existing server-owned talk/pause system
and original approved NPC sprites, with no new network protocol.

Water uses elliptical authored banks, the existing 16 grass/water Wang tiles,
and shared collision sampled from the same corner field. Rounded grassy corners
are walkable; water remains solid. Source artwork is unmodified.

## House proportions

Settlement cottages occupy 246 × 312 visible world units; the two-storey inn
occupies 332 × 436. Original source pixels render uniformly at 2× using frames
that exclude transparent padding. Villager scale is unchanged. Door landings,
front paths, collision footprints and resident routes use the enlarged layout.
Stonebridge extends south to 1152 world units to leave a clear residential street;
its south sign and spawn are at (768, 1072).
