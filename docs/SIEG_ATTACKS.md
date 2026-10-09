# Sieg basic attack presentation

This revision is presentation-only. The committed server combat implementation,
shared combat definitions, damage timing, hitboxes, attack cooldowns, movement,
collision, and protocol are unchanged. Sieg's idle/walk PNGs and Coco's assets
are unchanged. The production path still starts attacks only from accepted
server combat markers.

## Frame metadata

`apps/client/src/animation/siegAttackFrames.json` is the single authored metadata
source for explicit source rectangles, per-pose anatomical foot pivots, and
presentation durations. `scripts/import-sieg-attacks.py` consumes it and records
source hashes in `SIEG_ATTACK_PROVENANCE.json`. The source PNGs are not edited.
All are 1536×1024 RGBA images with real transparent pixels.

Every crop uses the same 0.20 nearest-neighbor scale on a 128×128 logical canvas.
The body (approximately 230 source pixels tall side-on) maps to the existing
approximately 46-pixel idle/walk body size. Sword/cape/VFX extents never determine
scale. Each source pivot maps to canvas (64,96), rendered at the existing world
position plus the existing 13-pixel vertical visual offset. Entire crop rectangles
fit within the canvas; the importer rejects clipping. Phaser uses the larger
combat canvas for bounds/culling rather than idle dimensions.

LEFT uses RIGHT's exact frame indices/durations with `Sprite.setFlipX(true)`,
mirroring the entire frame. The logical pivot is centered horizontally, so
mirroring maps x=64 to 128−64=64. No separate LEFT PNG is created.

The tables use zero-based frame indices per direction. Source rectangles are
half-open `(x0,y0,x1,y1)`, and pivots are absolute source-sheet coordinates.

## RIGHT — 765 ms

| Frame | Source rectangle | Source pivot | Duration (ms) |
|---:|---|---|---:|
| 0 | (20,20,380,390) | (196,358) | 80 |
| 1 | (395,10,760,390) | (581,358) | 80 |
| 2 | (775,15,1135,390) | (957,358) | 80 |
| 3 | (1140,15,1520,390) | (1324,358) | 80 |
| 4 | (30,400,375,715) | (207,684) | 45 |
| 5 | (395,405,750,715) | (533,684) | 40 |
| 6 | (750,405,1150,715) | (895,684) | 40 |
| 7 | (1155,410,1510,715) | (1298,684) | 55 |
| 8 | (15,725,400,1024) | (206,971) | 55 |
| 9 | (402,725,765,1024) | (579,971) | 60 |
| 10 | (775,725,1135,1024) | (968,971) | 70 |
| 11 | (1150,725,1525,1024) | (1342,971) | 80 |

## UP — 655 ms

| Frame | Source rectangle | Source pivot | Duration (ms) |
|---:|---|---|---:|
| 0 | (35,25,400,355) | (167,320) | 80 |
| 1 | (440,20,775,355) | (570,330) | 80 |
| 2 | (15,355,400,695) | (172,660) | 45 |
| 3 | (410,355,795,695) | (605,660) | 45 |
| 4 | (800,355,1145,695) | (974,660) | 55 |
| 5 | (1160,355,1536,695) | (1360,660) | 60 |
| 6 | (20,695,405,1024) | (208,919) | 65 |
| 7 | (435,695,795,1024) | (606,919) | 70 |
| 8 | (805,695,1150,1024) | (977,919) | 75 |
| 9 | (1170,695,1536,1024) | (1338,919) | 80 |

## DOWN — 710 ms

| Frame | Source rectangle | Source pivot | Duration (ms) |
|---:|---|---|---:|
| 0 | (15,45,395,365) | (174,300) | 80 |
| 1 | (420,45,775,365) | (590,300) | 45 |
| 2 | (800,45,1140,365) | (966,300) | 45 |
| 3 | (1160,45,1536,365) | (1331,300) | 45 |
| 4 | (10,365,395,680) | (205,586) | 45 |
| 5 | (405,365,785,680) | (598,586) | 45 |
| 6 | (790,365,1145,680) | (960,586) | 55 |
| 7 | (1150,365,1536,680) | (1335,586) | 60 |
| 8 | (20,680,405,1024) | (205,885) | 65 |
| 9 | (410,680,795,1024) | (599,885) | 70 |
| 10 | (800,680,1145,1024) | (974,885) | 75 |
| 11 | (1160,680,1536,1024) | (1364,885) | 80 |

UP reads the first row's two frames, then four middle-row frames, then four
bottom-row frames. RIGHT and DOWN read four frames per row. No poses are dropped,
reversed, interpolated, or regenerated. No extra basic-attack slash is drawn.

## Playback

The existing hero loader registers one-shot clips; PlayerView seeks their
variable-duration frame metadata using PlayerPresentation's confirmed-action
clock. Direction is locked to the accepted marker. Completion restores the
existing directional idle/walk state. Hurt/defeat preserve existing interrupt
priority, and stale snapshots do not replay attacks.

Default standalone clips use the tabulated timings. The server cooldown remains
unchanged and is shorter than these clips. For repeated accepted basic swings,
the presentation queue preserves every received marker and complete sequence,
starting after the previous recovery. Subsequent clips uniformly accelerate to
the observed authoritative attack interval, avoiding an accumulating backlog.
That may add an initial visual delay on sustained attacks; animation is never
used to decide damage. Coco's existing clock/queue behavior is unchanged.

## Asset review

All source files and their RGB/alpha values remain untouched. The supplied files
contain faint diffuse glow regions between poses. Explicit bounds contain the
identifiable sword/slash/sparks; none of the reviewed bounds intersects a strong
red trail. Faint soft glow can meet crop boundaries. It is retained rather than
removed or painted. The metadata pivots compensate for composition changes;
small anatomical pose changes in the original drawings remain visible.

## Development preview

Start Vite and open the separate development HTML page:

```sh
node node_modules/vite/bin/vite.js --config apps/client/vite.config.ts --host 127.0.0.1 --port 5174
```

Open `http://127.0.0.1:5174/sieg-preview.html`. Buttons trigger RIGHT, LEFT, UP,
and DOWN without another player or a hit target. The page simulates accepted
markers only inside its isolated presentation fixture; it connects to no
server and submits no gameplay outcomes. It has Repeat, Change facing mid-attack,
and Return to walk controls. A 3× camera zoom enlarges both idle and attack
without changing their character scale. Readouts show direction, frame index,
accepted sequence, elapsed animation time, playback rate, source rectangle,
source pivot, and logical canvas pivot. A ground crosshair helps review anchors.

The production Vite build has only the main game entry: neither this HTML page
nor the preview fixture is built or linked from production.

## Verification

```sh
npm run typecheck
npm test
npm run build
node --import tsx scripts/sieg-attack-qa.ts qa/sieg-presentation-only-final
node --import tsx scripts/sieg-preview-qa.ts
```

The browser checks cover every frame in all four directions on both real clients,
locked direction, LEFT mirroring, stationary render positions, recovery/idle,
and phase comparison at matched authoritative ticks. The development preview
checks all direction controls, facing lock, repeat, return to walk, and readouts.
Pixel-sampling tests verify that preprocessing preserves original RGBA values
at the one shared scale; canvas bounds tests reject clipping. Existing real
Socket.IO and server gameplay tests are retained.

## Files changed in this presentation revision

- `apps/client/src/animation/siegAttackFrames.json` — explicit crop, pivot, and duration metadata.
- `apps/client/src/animation/siegAttack.ts` — metadata-driven clips; removes dependence on shared gameplay timing.
- `apps/client/src/animation/PlayerPresentation.ts` — complete queued basic sequences and presentation-only cadence handling.
- `apps/client/src/entities/PlayerView.ts` — development inspection readouts; retains existing rendering path.
- `apps/client/sieg-preview.html` — isolated development preview page.
- `apps/client/src/dev/siegPreview.ts` — preview controls and presentation fixture.
- `scripts/import-sieg-attacks.py` — consumes metadata and rejects logical canvas clipping.
- `scripts/sieg-attack-qa.ts` — complete frame coverage and matched-tick client phase checks.
- `scripts/sieg-preview-qa.ts` — preview controls/readout verification.
- `apps/client/test/siegAttack.test.ts` — crop/pivot bounds, duration seeking, and original RGBA sampling checks.
- `apps/client/test/combatPresentation.test.ts` — complete repeats, timing, and unchanged Coco behavior.
- `apps/client/test/playerView.test.ts` — updated recovery-time expectation.
- `docs/SIEG_ATTACK_PROVENANCE.json` — source hashes and frame metadata provenance.
- `docs/SIEG_ATTACKS.md` — this report and all exact per-frame values.
- `qa/sieg-presentation-only-final/` and `qa/sieg-preview-v2/` — final browser evidence.

Final validation: typecheck passed, all 103 tests passed, production build passed
(with the existing Vite bundle-size warning), both-client four-direction checks
passed, and development preview controls/readouts passed. No server, shared
combat, networking, original sprite, idle/walk, or Coco files were changed by
this presentation revision. Other concurrent workspace changes are separate.

## Selected scarf colors

Basic attacks now use the same selected cloth palette as idle/walk. The importer
builds `basic-mask.png` from per-frame `clothRegion` metadata, preserving the
canonical PNGs. It excludes heads and bright effect cores; only scarf/cape material
is recolored at runtime by the existing appearance pipeline. Attack palette
textures are prepared while idle/walking to avoid a canonical red fallback when
an already-customized player attacks. The development preview includes a Scarf
selector for checking crimson, ivory, blue, green, and charcoal. The default
crimson artwork remains byte-identical, and unmasked RGB/alpha is unchanged.
