# Defense artwork integration

Changes are in `/Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember`.
Source: `Images/Sprites/Defense Basic Sprites.png` (2172 × 724 RGBA).
Reproduce extraction with `scripts/normalize_defense_reference.py` using Pillow.
Exact crop bounds, anatomical anchors and source SHA-256 are recorded in
`DEFENSE_ASSET_PROVENANCE.json`. The source document is a reference brief.

## Runtime assets and timing

All defense canvases are 128 × 128. Guard uses ground origin (64,96).
Ward is now a separate hollow effect with center (64,70), positioned around Coco's
existing 48 × 64 idle/walk sprite. Her outfit, hair, skin and staff retain their normal appearance.

| Character | Runtime artwork | Entry | Held | Recovery | Impact |
|---|---|---|---|---|---|
| Coco | One canonical extracted outer Ward rim, no embedded character | 667 ms right/left; 500 ms down; 583 ms up | continuous opacity shimmer/orbiting light | 667 ms fade | 250 ms palette ripple |
| Sieg | 8 right start, 8 right loop reference poses, 8 right end, 8 down start, 8 up start, 7 complete impact poses | 8 frames at 12 fps = 667 ms | one stable supplied Guard pose plus shield glint | 8 frames at 12 fps = 667 ms | first 3 impact frames at 12 fps = 250 ms |

Right/left Guard loops hold the first right-loop pose; vertical loops hold the final supplied
vertical start pose. This prevents unrelated head/body drawings from shaking on each loop.
The authoritative held animation state and clocks remain continuous. Left mirrors right.
Vertical Guard recovery and impacts fall back to right-facing art. Coco's normal directional
body respects facing while the spherical rim has no facing. Movement during Ward uses the
existing walk animation; Guard carries its held stance with existing movement behavior.

## Extraction corrections

The initial crops included adjacent weapons, low-alpha matte bridges and frame-number fragments;
repeated body drawings also had inconsistent body positions. Guard extraction now keeps the
connected opaque anatomical silhouette, retains its immediate antialiased perimeter, discards
neighboring islands and labels, and normalizes each pose using head center and boot ground.
The source's last truncated impact cell is omitted entirely.

Coco's original combined Ward frames embedded a purple interior glow into her outfit/body.
These combined frames are no longer rendered. Only the bright outer sphere rim is extracted
from one approved loop pose, normalized to the canonical ember color, and rendered separately.
No character pixels, dark hair, face or cloak remain in the Ward texture.
This uses the supplied artwork without generating or repainting a character. A thinner, hollow
barrier is deliberately preferred over the source's inseparable purple character glow.
Ward start/end affect only barrier alpha/scale, never Coco's body size or position.

## Authority and palette compatibility

`PlayerPresentation` owns start/loop/end clocks, continuing through movement snapshots and F4 changes.
Defeat/hurt and accepted attack/charge retain priority. Platformer defense retains the existing
presentation fallback; gameplay movement and collision geometry are unchanged.

The server increments `Player.defensiveHit.seq` and includes its tick only when existing damage
reduction applies. Both clients receive this marker in existing snapshots. PlayerView consumes
new markers, avoids ordinary red hurt feedback for reduced hits, and rejects stale hit replay.
Sieg's impact returns to its underlying held/recovery phase; Coco receives a magic-colored ripple.
Damage reduction remains 75%; no new combat rules or collision changes are introduced.

Defense uses the existing palette-mask pipeline: red = Sieg scarf, green = Ward magic.
Ward's mask contains only green effect regions and its body is rendered through the normal
appearance layer. Its selected `effectPalette` recolors the entire rim; no global character tint
or palette-specific animation atlas is used. Canonical magic is normalized to ember.
Canvas results cache by role/layer/primary/effect palette; source image promises are shared.
Phaser textures cache by texture manager, with pending requests deduplicated.
Pixel recoloring does not run per render frame.

## Verification

- Typecheck passed in the original project.
- 59 tests across 10 files passed, including two new rendering regressions: Guard holds one frame
  across multiple loop cycles, and Ward leaves Coco's unchanged body visible while changing only
  its separate VFX layer; F4 hides/restores both correctly.
- Existing multiplayer tests verify equal authoritative defense/hit snapshots, HP reduction,
  release and reconnect. Lobby leave tests also remain passing.
- Production build passed; Vite's existing bundle-size advisory remains.
- Two browser clients using the local repeatable server fixture: ivory Sieg scarf and emerald
  Ward match the reported color combination; no stray sword strip or purple interior overlay was
  visible. Guard's held pose was stable across observations; both clients saw clean separate Ward rendering.
- F4 switched geometric/sprite rendering without losing defense or palette choices.
- Earlier responsive checks covered desktop 1920×1080, laptop 1366×768, portrait 390×844,
  and landscape 844×390. The corrected layers still use the same world renderer scale.
- Manual keyboard holding, every palette and direction, and all transient impact frames have not
  been exhaustively checked in the browser; automated tests cover presentation and synchronization.

Corrected browser preview: `defense-fixed-preview.jpg`.
Normalized assets: `defense-normalized-preview.png`.
The earlier `defense-browser-qa.jpg` is retained as a historical before-fix preview.
