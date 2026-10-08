# Hero sprite assets

Hero artwork is a client presentation layer. PlayerView reads authoritative status and predicted local movement while the scene supplies the existing smoothed/interpolated position. Sprites have no physics bodies. Art dimensions, origins, scale, frame counts and animation timing never alter authoritative movement, collisions, attacks or room state.

## Current approved reference milestone

See `HERO_REFERENCE_INTEGRATION.md` for source/runtime/temporary asset inventory, exact normalization choices and replacement instructions. Current runtime assets are two transparent **192 × 64 PNG sheets**, each containing four **48 × 64** cells ordered down, up, left, right. Every cell's ground anchor is (24,60).

| Frame | Semantic animation | Playback |
| ----- | ------------------ | -------- |
| 0     | idle_down          | static   |
| 1     | idle_up            | static   |
| 2     | idle_left          | static   |
| 3     | idle_right         | static   |

No directional walk cycles were inferred from the ambiguous lower reference rows. Moving and attacking heroes use the appropriate directional idle until those libraries exist. Side-view maps use geometric rendering. Ember's temporary left pose mirrors her supplied right profile; it is documented in provenance.

## Files and responsibilities

- `public/assets/characters/oath` and `.../ember`: normalized transparent runtime art; enemies/environments/effects/ui directories remain reserved.
- `src/animation/definitions.ts`: semantic state lists, sheet URL/dimensions, frame ranges, FPS and repeat settings. Only approved clips are registered.
- `src/assets/characterVisuals.ts`: visual scale, origin and offset for each hero.
- `src/assets/heroLoader.ts`: preload sheets and register valid clips only.
- `src/animation/selectAnimation.ts`: read-only semantic selection and missing-art fallback.
- `src/entities/PlayerView.ts`: sprite/geometry rendering, key transitions, platformer flipping when proper side-view clips exist, tint, rings and health presentation.

## Replacing or extending art later

Export transparent PNGs into the hero directories. Keep each frame on a consistent untrimmed canvas, with the same anatomical ground anchor. Update that hero's URL, frame dimensions and clip mapping in `definitions.ts`; adjust visual scale/origin/offset only in `characterVisuals.ts`. Reload the client to preload and register changed sheets. Frame numbers never belong in gameplay scenes.

Supported future top-down states: directional idles, walk_north, walk_south, walk_east, walk_west, primary_attack, secondary_ability, interact_channel, hurt. Platformer states: idle, run, jump, fall, primary_attack, secondary_ability, interact_channel, hurt. Future artists should provide four distinct top-down walking directions; side-view assets face right and may be mirrored horizontally. Current top-down poses are never used as side-view art.

Suggested eventual FPS: idle 6, walk/run 8–10, actions 10–12, hurt 12. FPS and clip completion are visual only, never a gameplay damage or cooldown clock. Repeated updates preserve the current animation key; completed one-shots hold until semantic state changes. Missing top-down clips resolve to directional idles; a missing sheet or unavailable resolved clip uses geometry. Platformer falls back to geometry until clips are provided.

F4 switches sprite/geometric rendering. `?characters=geometric` starts in debug mode. F3 shows rendering mode and networking diagnostics. Views are removed on despawn, lobby return, map change and scene shutdown, not on viewport resize.

## Responsive asset density

Keep a consistent world-pixel density rather than creating separate gameplay sizes for desktop and mobile. Use integer source dimensions and scale where practical, transparent padding for weapons, and consistent pivots. Canvas display scaling is uniform and nearest-neighbor. See `RESPONSIVE_RENDERING.md`; high-DPI or ultrawide displays never change simulation coordinates or collision dimensions.

## Walking milestone update

The current runtime texture is `top-down.png`: 28 cells, 1344×64, with approved directional idles and six-frame walks at 8 FPS. See `WALK_ANIMATION_INTEGRATION.md` for the exact order and replacement workflow. The earlier idle-only milestone description is historical.
