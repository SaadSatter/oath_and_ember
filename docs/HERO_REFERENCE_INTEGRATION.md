# Approved hero reference integration

This milestone integrates the supplied designs without character regeneration or gameplay changes. Oath retains dark hair, dark armor, crimson scarf/cape, and the silver sword where visible in the selected source pose. Ember retains dark hair, the large purple traveling hat, purple/indigo layers and orange-crystal staff. The original reference artwork is preserved untouched.

## Asset inventory

| Kind                               | Files                                                                             | Runtime usage                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Canonical design reference         | `Images/Sprites/Sprites1.png`                                                     | None; original design sheet retained outside public assets                                         |
| In-game pixel appearance reference | `Images/Sprites/Sprites2.png`                                                     | None directly; original irregular sheet retained outside public assets                             |
| Normalized runtime sheets          | `apps/client/public/assets/characters/{oath,ember}/top-down-idles.png`            | Four directional idles per hero                                                                    |
| Normalized individual poses        | `apps/client/public/assets/characters/{oath,ember}/idle_{down,up,left,right}.png` | Editing/replacement convenience; current loader uses the sheets                                    |
| Temporary geometry                 | PlayerView's generated Graphics shapes                                            | F4 debug, missing assets, and platformer mode                                                      |
| QA preview                         | `docs/normalized-heroes-preview.png`                                              | Documentation only; never loaded by the game                                                       |
| Extraction provenance              | `docs/HERO_ASSET_PROVENANCE.json`                                                 | Original size, source hash, explicit crop bounds, foot anchors, mirroring, scale and output bounds |

The former in-memory bobbing sprite sheets have been replaced with these normalized supplied-art frames. Geometric rendering remains available.

## What was extracted

`Sprites2.png` is 2172 × 724 RGBA, not a production grid. The separated top-row figures are the safest idle candidates. Lower rows include touching silhouettes, irregular spacing and ambiguous pose sequences; this milestone does not infer walk cycles from them.

Oath uses the top row's front, back, left and right poses. Ember uses front, back and the stronger right-profile pose. The top row has two right-facing Ember variants rather than a clean left-facing pose, so the temporary left idle is a horizontal reflection of that same approved right pose. It introduces no newly drawn costume or spell art. This reflection swaps staff/hat handedness and must eventually be replaced with an authored left-facing pose if handedness is important.

Each pose is selected with an explicit bounding box, never equal-cell slicing. All poses use the same 0.22 source-to-logical reduction with nearest-neighbor resampling onto a **48 × 64 transparent canvas**. The anatomical ground anchor is **(24, 60)** in every output. Crop foot anchors are manually reviewed, and the script preserves the source alpha channel. Visible figures occupy about 48–51 vertical pixels inside the padded cells. Relative height is consistent between heroes; broad hats and sword extensions retain their different silhouettes.

Reproduce extraction with the bundled Pillow Python:

```sh
/Users/saadsatter/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/normalize_hero_references.py
```

The script checks original dimensions before applying its explicit coordinates. If the source sheet changes, review all crops/anchors rather than assuming the previous locations remain valid. Source references are not copied into the public runtime directory.

## Centralized visual scale

`apps/client/src/assets/characterVisuals.ts` owns per-hero visual scale, origin and visual offset. Default scale is 1 for both. Default origin is `(0.5, 60/64)`, aligning the sprite's foot anchor with the display position, plus a 13-world-unit vertical presentation offset so the feet align with the existing collision box's bottom. This offset does not change the simulated center.

Adjust Oath and Ember independently here, preferably using integer enlargement for crisp pixels. PlayerView applies scale during rendering and adjusts the HP bar above the full visual cell. It never passes these values into movement, collision, combat or the network. The responsive canvas continues to apply the same uniform nearest-neighbor display scaling to both heroes. Camera zoom stays at 1 world unit per logical pixel. Reference cells must not be stretched to match viewport aspect.

## Temporary animation behavior

The central manifest registers only `idle_down`, `idle_up`, `idle_left`, `idle_right` for each hero, with frames 0–3 in that order in a 192 × 64 sheet. These are static poses, not invented idle cycles. The future semantic animation states remain supported, but no attack, spell, hurt, death or platformer character clips are registered.

PlayerView resolves absent top-down walking/action clips to the appropriate directional idle, using the existing predicted facing locally and authoritative facing remotely. It does not estimate facing from interpolation deltas. This keeps remote pose selection stable when snapshot positions jitter or when a player stops. Attacks, projectiles, defense/channel rings and hurt tint retain existing behavior. Animations do not restart while the resolved directional key stays the same; F4 and canvas resizing do not restart that key. Platformer maps deliberately use geometric fallback for both heroes until separate side-view art exists.

## Validation and remaining art

Required checks are `npm run typecheck`, `npm test`, `npm run build`. Tests cover immutable pose selection, missing-action fallback, independent visual scale, stable animation keys, F4/side-view fallback, PNG dimensions/alpha, responsive layouts and existing multiplayer invariants.

Future work is limited to replacing the temporary mirrored left Ember idle with an authored pose if desired, selecting/producing genuine directional walk cycles, and later separate combat/side-view libraries. This milestone adds no environment art, enemies or gameplay features.

### Completed browser validation

Two real connected clients joined room 98UPBB as Oath and Ember. Both rendered their local and remote heroes. Oath moved right and north with keyboard input; Ember moved right and left with touch input, independently. Changed facing was visible on the remote client without obvious pose flicker. F4 switched both visible heroes to geometry and back to sprites.

The Ember client then traversed 1920×1080, 1440×900, 390×844 and 844×390. Its identity, connection, room and position `(170.6666666666667, 480)` remained unchanged throughout. Canvas display dimensions were respectively 1920×1080, 1214×758, 360×640 and 640×360, with uniform scales 3, 2, 1 and 1. Oath remained connected at a different viewport size. Screenshots and DOM measurements are saved alongside this document. The orientation test identified and fixed stale canvas CSS dimensions when logical size changed at unchanged zoom.

All required commands passed: typecheck, 30 tests, and production build. The build retains the existing large Phaser bundle warning. Real-device touch feel and physical safe areas were not tested. Because this milestone uses static directional poses, resize continuity is additionally covered by PlayerView tests that ensure the resolved animation key is not restarted.

### Replacing runtime art later

Replace each hero's `top-down-idles.png` with a transparent 192×64 PNG containing four 48×64 cells ordered down, up, left, right. Keep feet at `(24,60)` in each cell and retain consistent relative character height. The individual idle PNGs are editing conveniences; updating them alone does not update the loaded sheet. Do not rerun the reference extraction script after installing final art, as it writes the temporary extracted sheets.

For different cell dimensions or genuine walk clips, update `apps/client/src/animation/definitions.ts` and the origin in `apps/client/src/assets/characterVisuals.ts`. Adjust per-hero `scale` in the latter file to evaluate size independently of collision and simulation. Add clips only when corresponding authored frames exist; unavailable actions continue to use directional idles. Side-view art requires separate platformer clips. See `SPRITE_ASSETS.md` for naming, FPS and authoring conventions.
