# Sieg directional basic attack

The supplied RIGHT (12 frames), UP (10 frames), and DOWN (12 frames) RGBA
sheets are sliced in reading order. UP skips the two unused slots in its first
row. LEFT uses the RIGHT pixels with Phaser's horizontal flip. Source sheets
remain untouched in `Images/Sprites/Sieg`.

`scripts/import-sieg-attacks.py` contains explicit crop rectangles and anatomical
ground anchors. It uses a single 0.20 nearest-neighbor scale and a common 128×128
canvas with ground anchor (64,96). Weapons and red effects extend beyond the
body without changing the world position. There is no alpha cleanup, color
change, stretching, interpolation, or generated artwork. Original diffuse glow
pixels are retained; glow can meet crop boundaries because the supplied source
has overlapping soft regions. The identifiable sword/slash shapes remain inside
the reviewed bounds. `SIEG_ATTACK_PROVENANCE.json` records source hashes and every
crop/anchor. Rebuild with a Python environment containing Pillow:

```sh
python3 scripts/import-sieg-attacks.py
```

The existing hero loader, PlayerPresentation, and PlayerView handle playback.
Basic attack metadata in `siegAttack.ts` defines variable frame durations.
Accepted server markers lock facing; server age selects the frame, with no
replay on stale snapshots. Each clip lasts 450 ms to retain existing attack
cadence, so wind-up durations are shorter than the reference brief's starting
suggestions. Recovery returns to existing directional idle/walk. Hurt and defeat
retain their existing presentation priority. Heavy attacks and walking assets
are retained. Basic attack art always uses authored colors; existing appearance
masks remain available for idle/walk, defense, and heavy attacks.

The server delays basic sword contact by 7 ticks horizontally, 5 UP, or 3 DOWN
at 30 Hz. Contact applies once at authoritative current positions, with existing
range, obstruction, damage, puzzle, and boss rules. Recovery does no damage.
Hurt, reset, and scene changes cancel pending contact. Heavy attacks keep their
existing immediate contact behavior. Timing lives separately from rendering
metadata in shared combat definitions. No client-reported outcome or new protocol
field is introduced, and attacks add no translation or movement restriction.

## Review and verification

```sh
npm run typecheck
npm test
npm run build
node --import tsx scripts/sieg-attack-qa.ts qa/sieg-attacks-review
```

For visible repeated review, run:

```sh
node --import tsx scripts/sieg-attack-qa.ts qa/sieg-attacks-review --headed --repeat=3
```

This standalone fixture creates two normal browser clients and presses J after
setting the direction on its local QA server. It records both clients, verifies
correct rows and LEFT flip, checks monotonic frame progression/recovery and
fixed render positions, and saves screenshots/traces. It does not add a debug
combat endpoint to the production service. `?siegQA=1` exposes player render
metadata in the game's DOM for diagnostics; ordinary WASD/J controls still apply.

The verified two-client run is in `qa/sieg-attacks-final/report.json`. All 100 tests
passed, including contact/cancellation tests, directional renderer tests, and
existing real Socket.IO integration tests. Build succeeds with the existing Vite
bundle-size warning.
