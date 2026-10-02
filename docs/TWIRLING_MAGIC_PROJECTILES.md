# Coco's twirling projectile

The client now renders a stable glowing core plus animated ribbons through `ProjectileView`. Flight loops at 14 FPS for the entire authoritative projectile lifetime. Phaser elapsed time selects cosmetic frames independently of movement, network ticks and display refresh rate. Velocity sets the travel orientation; the image does not spin over time. A small palette-colored spark trail stays behind the projectile.

Existing interpolated server positions drive both layers. Existing server collision records trigger a seven-frame, 14 FPS impact once at the recorded hit position (500 ms). Retained collision records cannot restart it. Lifetime expiry without a collision record removes the flight without inventing a hit. Damage, speed, collision radius, lifetime, input and server simulation are unchanged. F4 retains geometric projectile debugging.

## Source and runtime assets

`Images/Sprites/Magic Basic Spell.png` remains source/reference artwork. Run `scripts/normalize_magic_projectile.py` with Python and Pillow to reproduce the runtime PNGs. `MAGIC_PROJECTILE_PROVENANCE.json` records reviewed bounds, source hash and anchors; the source is not divided into a uniform grid.

Runtime assets live in `apps/client/public/assets/effects/coco/`:

- `flight.png`: four 64×64 transparent frames, center (32,32), taken from right-facing vortex poses 2–5. Startup, elongated trails and the empty numbered gap are excluded from the loop.
- `core.png`: one 32×32 frame, center (16,16), extracted once and reused without changing frame, offset or scale. Animated core pixels are removed from the ribbon layer.
- `impact.png`: seven 96×96 frames, center (48,48). The final source labels share a dispersing cloud rather than providing two clean separate poses. Soft ownership boundaries suppress neighboring effects where the source overlaps; outer overlapping spokes are trimmed.
- Matching `*-mask.png` files identify the recolorable magical energy. White highlights remain protected. All runtime frames preserve transparency; warm/bright energy extraction removes the source's opaque dark matte.

`docs/magic-projectile-normalized.png` is an inspection montage, not a runtime asset. The older `effects/coco-blast.png` is legacy artwork and is no longer loaded by the game. No character artwork was regenerated.

## Palette and replacement contract

Ember Orange, Arcane Blue, Violet, Emerald Green and Rose Pink use the existing mask recoloring function. Textures are cached and warmed during scene creation, not recolored per render frame. Character and magic palettes remain independent.

Future art should retain these frame sizes and centered core/pivot anchors. Keep the core on its own layer, ribbons on transparent canvases, and trails facing right. Update centralized `apps/client/src/animation/projectile.ts` if counts, dimensions or FPS change. Supply matching green-channel magic masks with protected white highlights. Gameplay coordinates and collision shapes must never be derived from artwork dimensions.

## Validation

Two connected browser clients were exercised with stationary and moving casts in all four travel directions. Both clients received matching authoritative projectile coordinates. Orange and Rose were checked in the browser; automated recoloring tests cover all five palettes. Live presentation diagnostics confirmed ribbon frame wrapping while core frame remained zero and travel angle stayed fixed. Server collision records were observed in the live room; automated view tests verify one-shot impact timing, cleanup, stale-event handling, palette switching and F4 clock continuity.

Run `npm run typecheck`, `npm test`, and `npm run build`. The network integration test requires permission to bind a local loopback socket.
