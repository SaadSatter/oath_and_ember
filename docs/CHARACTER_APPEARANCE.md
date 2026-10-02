# Sieg and Coco appearance customization

Sieg and Coco remain the official names. Stable role IDs OATH/EMBER and asset directories are retained for protocol and asset compatibility.

## Rendering and protected regions

One canonical `top-down.png` per hero supplies all idle/walk frames. One same-sized `palette-mask.png` identifies customizable regions: red means primary cloth, green means magical accent. Runtime mask-based RGB replacement preserves source luminance relationships and alpha; unmasked pixels are byte-identical. Default primary/magic choices bypass replacement and use the canonical texture, preserving the approved appearance exactly. No global customization tint is applied.

`scripts/create_palette_masks.py` builds the masks from constrained material hue families and anatomical exclusion zones. Sieg's mask targets crimson scarf/cape, excluding neutral armor, sword, skin and hair. Coco's primary mask targets saturated purple hat/clothing away from the face/hair band. Magic targets bright orange crystal/glow and compatible hat gem accents, avoiding face-center eyes/skin and neutral staff structure. The mask PNGs are runtime assets and can be manually refined without changing palette code. Canonical art remains untouched. No optional armor customization is included.

The current generated artwork has mixed hues and anti-aliased boundaries rather than clean indexed palettes. Masks deliberately leave ambiguous dark/neutral pixels and secondary trim unchanged; tiny original-color edge accents can remain. Saturated highlights may clip at 255 during recoloring, and charcoal preserves bright source highlights rather than making the entire cloth black. These are conservative presentation limitations, not new costume designs. Future professionally authored assets should ship explicit material masks instead of relying on hue inference.

## Available choices

- Sieg scarf/cape: Crimson (default), Royal Blue, Forest Green, Charcoal, Ivory.
- Coco primary outfit/hat: Purple (default), Deep Blue, Crimson, Emerald, Charcoal.
- Coco magic: Ember Orange (default), Arcane Blue, Violet, Emerald Green, Rose/Pink.

Magic selection also colors existing Coco-owned projectiles and her guard/channel rings. Staff/crystal glow and compatible magical sprite accents are masked. No new spells, particles or mechanics were added. Skin, eyes, hair, neutral weapons/armor and staff wood/metal are not intended customizable regions.

## Shared state and persistence

`packages/shared/src/appearance.ts` defines typed semantic IDs, role-specific validation and defaults. Optional `Player.appearance` maintains compatibility with initialization/fixtures that predate cosmetics; rendering falls back to role defaults when absent. The server accepts `appearance:select` only for a selected hero in the lobby, validates exact keys and role-specific enum values, stores a copy and synchronizes room state. Unknown colors, arbitrary RGB/image data, extra fields and invalid combinations are rejected. A selection cancels that player's ready status so they can review the new appearance before readying again.

Existing room/session snapshots naturally retain appearance through gameplay, map transitions, replay and reconnect. Changing hero initializes its matching default; reselecting the same hero retains colors. A new session starts with defaults. There are no accounts, databases or inventories. Cosmetic selection modifies no simulation parameters.

## Cache and animation compatibility

`appearanceTextures.ts` loads the canonical image and mask once per role and lazily generates a canvas keyed by role + primary palette + effect palette. At most five Sieg or 25 Coco combinations are possible. Only requested combinations are allocated; no palette-specific sheets are shipped or sent. Phaser textures reuse cached canvases across scenes; each TextureManager tracks pending registrations. Pixel processing occurs on cache misses, never in the render loop. Asset load failures retain canonical artwork.

Canonical animation definitions, keys, FPS and frame clocks are shared by every palette. PlayerView substitutes the same numbered frame in the selected texture after animation frame advancement and during ordinary rendering, without restarting playback. F4 hides sprite rendering without discarding appearance. Viewport scale and collision dimensions remain independent.

Future frames participate when added to the canonical sheet/manifest with corresponding mask cells of identical dimensions/alignment. Mask authoring is required for newly painted material regions; adding a new ability does not require new recoloring logic. Side-view characters remain geometric until approved side-view art and matching masks exist.

## UI and validation

The existing lobby receives compact swatches and a transparent preview for each selected hero, including a read-only partner preview. Responsive wrapping and existing scrollable panels support small screens; accessible labels and pressed states identify each choice.

Two browser clients in room WLEMQK selected Sieg's blue scarf and Coco's emerald outfit with arcane blue magic. Both clients showed matching previews and matching in-game local/remote appearances. Independent movement, F4 round-trip and Coco reload/session resume retained selected colors. Scene-transition persistence and malformed payload rejection are covered by real Socket.IO integration tests; no gameplay state difference was found in unit comparisons. Desktop viewport emulation is distinct from physical mobile testing.


Final validation: `npm run typecheck`, `npm test` (34 tests across six files), and `npm run build` passed. Production build retains the pre-existing large Phaser bundle warning. The lobby was also checked at 390×844 and 844×390: swatches/preview reflowed in portrait, and the scrollable landscape panel allowed color selection and Ready. Physical device safe-area/touch feel was not tested.

The updated test service is running at http://localhost:3001/ (the older service on port 3000 was left intact). The new appearance protocol requires the updated server as well as the updated client. Two selected-color gameplay screenshots are `appearance-client-sieg.png` and `appearance-client-coco.png`; the portrait lobby is `appearance-lobby-mobile.png`.

Ivory correction: light cloth now transfers shading relative to the canonical crimson material's midtone with a 0.6 gamma curve, instead of preserving crimson's dark absolute luminance. The warm-white target is #f5f1e7. This retains ordered shadows/highlights while making ivory visibly light. Other palettes, alpha and unmasked regions retain their previous behavior. A regression checks light midtones, distinct folds and protected pixels.
