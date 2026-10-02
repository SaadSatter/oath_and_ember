# Combat presentation integration

The subsequent [Heavy Break and projectile update](COMBAT_CHARGE_AND_PROJECTILES.md) adds server-owned hold/release charging and replaces geometric traveling blasts. Its behavior supersedes the initial heavy fallback described below.

Sieg's four basic sword attacks and Coco's four projectile casts now use the approved `Images/Sprites/Basic Fighting Sprites.png`. The original reference remains separate from runtime assets. No replacement artwork, gameplay mechanic, damage, range, cooldown, collision box, or movement rule was introduced.

## Extracted clips

| Character | Semantic clip | Usable poses | FPS | Duration |
| --- | --- | ---: | ---: | ---: |
| Sieg | attack_right / attack_left / attack_down / attack_up | 6 each | 12 | 500 ms |
| Coco | cast_right / cast_left / cast_down | 6 each | 12 | 500 ms |
| Coco | cast_up | 7 | 12 | 583 ms |

The sheet's numbered cells are not uniformly spaced, and some contain only projectiles. Explicit bounds and body anchors in `scripts/normalize_combat_references.py` select individual poses. `COMBAT_ASSET_PROVENANCE.json` records the source hash, bounds and normalization choices. Labels, borders, numbers and the dark sheet matte are removed. The source's alpha is nearly opaque in background areas, so alpha-only cropping was insufficient. Seeded GrabCut segmentation retains the original foreground RGB pixels without generating artwork. Some antialiased edges and warm lighting remain approximate; these are evaluation assets, not a claim of production-perfect mattes.

Runtime assets live under `apps/client/public/assets/characters/oath/` (Sieg) and `ember/` (Coco); stable role/path identifiers remain compatible with existing gameplay. Each `combat.png` is a 1024×512 RGBA atlas of 128×128 frames, eight columns and four rows ordered right, left, down, up. Unused cells are not played. The foot anchor is (64,96), origin (0.5,0.75), matching the existing idle/walk ground anchor despite extra transparent space. Character visual scale remains centralized in `characterVisuals.ts`; camera zoom never changes world geometry.

## State and synchronization

`PlayerPresentation` is presentation-only state owned by `PlayerView`. Priority is defeated, hurt, accepted attack/cast, existing ability/channel presentation, then walk/idle. Combat captures facing once, continues through recovery despite movement snapshots or input release, and returns to the current locomotion state. A subsequent accepted action can queue without restarting the current clip. Hurt/defeat interrupt it; there are no newly invented hurt/death frames. Platformer rendering retains geometric placeholders.

Held input/actionState was insufficient to distinguish accepted attacks from requests rejected by cooldown. At the existing server attack acceptance branch, the server now records a small `Player.combat` marker: sequence, kind, facing, and start tick. Both clients receive that same marker through existing snapshots. This is an additive observable presentation marker, not a new command channel or client-authoritative outcome. Local and remote views use the same marker. No cosmetic local attack prediction was added.

Start age is estimated from the server start tick; ongoing frame advancement uses elapsed game milliseconds and clip FPS, independently of display refresh or snapshot frequency. Stale markers are ignored on reconnect. The existing server applies sword damage/projectile creation immediately; the supplied anticipation/release art is illustrative and does not defer or duplicate gameplay hits. Exact frame-aligned combat would require separately authored timing assets, not a cooldown change.

## Color and effects

`combat-mask.png` extends the existing scarf/outfit palette masks to combat poses. Coco's separable orange magical pixels live in `combat-effects.png` with `combat-effects-mask.png`; `PlayerView` draws this overlay with the same frame and anchor. Selected magic colors drive its glow/circles and existing authoritative projectile presentation. Outfit and magic palettes remain independent. Recolored textures are cached per role, layer and appearance; pixels are not recolored every render frame. Hair, skin, sword and staff structure are excluded from intended palette regions.

Some white effect cores and baked warm reflections cannot be cleanly isolated from this flattened source. They remain in the body artwork. Sieg's slash arcs remain baked into the swing, and stay red independently of scarf color. No five-sheet palette duplication or replacement artwork is used.

## Explicit fallbacks

- Sieg's heavy upgrade already exists, but the heavy row has overlapping poses, arcs and debris that cannot be reliably separated here. Accepted heavy attacks use the corresponding basic directional clip; upgraded gameplay damage is unchanged.
- Coco's charge row mixes charge/release and only supplies right-facing art. It does not map cleanly to current interaction/channel timing, so existing channel presentation remains.
- Projectile-only cells and ambiguous overlapping down-cast poses are excluded from playback. No mirrored or fabricated directional frames were added.
- Missing sprite assets and side-view gameplay retain geometric fallback. F4 switches rendering without resetting the presentation clock or gameplay.

## Replacing these assets

Author final transparent combat frames on 128×128 canvases with the same (64,96) foot anchor, or update the centralized dimensions/origin together. Preserve character body size relative to 48×64 idle/walk art. Export matching body, palette mask, effects and effects-mask atlases with identical layouts. Replace runtime PNGs, then adjust counts/FPS in `animation/combat.ts` if necessary. Keep all gameplay code semantic; do not move collision or attack ranges to match weapon pixels. Future Guard, Ward, Dash, Blink, Hurt and Death can extend the state priority model when appropriate authoritative state and approved artwork exist.

To reproduce source normalization, install Pillow/numpy in your Python environment and `opencv-python-headless` in a temporary tooling directory, set `COMBAT_VISION_PATH` to that directory, and run `scripts/normalize_combat_references.py`. OpenCV is offline build tooling, not a client/server dependency. Review extracted masks after changing source artwork.

## Validation

Two simultaneous browser clients in room QWPF5A rendered Sieg and Coco, including independent movement, stationary attacks, movement → attack → movement, repeated attacks, simultaneous attacks, all four directions, remote combat, ivory scarf and blue outfit/Arcane magic, reconnect and subsequent combat. Accepted marker arrays matched on both clients for every cardinal test. A separate two-client room CCQZDL verified Rose magic and matching cast markers. Browser screenshots include `combat-down.png`, `combat-up.png`, `combat-rose.png`, `combat-debug.png` and `combat-mobile-portrait.png`.

The remote viewport was resized while Sieg attacked; connections and player identities persisted. Checked 1920×1080, 1440×900, 390×844 and 844×390, with the other client retaining its own viewport. F4 switched geometry/sprites during combat. These live checks complement deterministic tests for cooldown acceptance, repeated actions, direction locking, elapsed timing, recovery, stale reconnect markers and two real Socket.IO clients. Short UI automation captures are not exhaustive stress testing under packet loss.

`npm run typecheck`: passed. `npm test`: 42 tests passed across seven files. `npm run build`: passed, with the existing Phaser bundle-size warning.
