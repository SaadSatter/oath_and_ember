# Heavy Break and Coco projectile update

This update fixes the geometric traveling blast and makes Heavy Break a true server-authoritative charge attack. Server movement, hit ranges, puzzle interactions, Coco's projectile speed (420), damage (20 to enemies / 10 to the boss), lifetime (1.6 seconds), and collision tests are unchanged.

## Heavy Break state machine

Heavy Break still requires the existing Guard prerequisite and one additional skill point. Without Heavy Break, Sieg retains the fast normal sword attack. With it unlocked:

| State / condition | Server action |
| --- | --- |
| Idle, fresh primary press, attack cooldown clear | Start charge; capture server tick and facing |
| Primary held | Increment charge by one fixed simulation tick; publish ticks and progress; do no attack damage |
| Release before 14 held ticks | Perform one normal 25-damage slash |
| Release at/after 14 held ticks | Perform one heavy 40-damage slash |
| At/after 33 held ticks | Full visual charge; damage remains fixed at 40 |
| At/after 38 held ticks | Accumulation capped; keep holding without automatically releasing |
| Any accepted release | Clear charge, record one combat marker, start the existing 0.45-second sword cooldown |
| Hurt, stale intent, disconnect, reset, transition | Cancel charge without dealing release damage |
| Press during cooldown | Ignore; release and press again when cooldown clears |

At 30 Hz, minimum is approximately 0.467 seconds, full is 1.1 seconds, and cap is 1.267 seconds. Values are centralized in `packages/shared/src/combat.ts`. Early release as a normal slash preserves tap-to-attack and avoids a dead-feeling canceled tap. Fixed heavy damage retains the prior stronger damage value rather than adding an unrequested damage curve.

`Player.heavyCharge` contains server-owned `startedTick`, locked `facing`, `ticks`, and `progress`. `Player.combat` retains the existing accepted sword/heavy/cast marker; a new heavy marker means release. No client charge duration, damage, position or outcome is accepted. A paused room does not accumulate held ticks. The server applies damage on accepted release, independent of artwork frames.

## Reliable taps

The original latest-input-only sampling could miss a complete J tap between 30 Hz samples. Keyboard/touch primary edges now send the same validated InputFrame immediately and reliably. The server retains at most eight pending primary edges and consumes one per simulation step. Press/release edges bypass the ordinary 10 ms same-state input throttle; strict schema validation, increasing sequences and gameplay cooldown checks still apply. Continuous movement prediction and periodic input remain unchanged. Input edges are intent, never combat outcomes. Disconnect/reset/transition/stale-input handling clears queued edges.

## Heavy presentation

Priority remains hurt/defeat, release/attack/cast, held charge/channel, walk, idle. Movement does not cancel charge or change the captured attack direction. Wind-up advances once to a held pose; server progress drives a charge ring, particles and bar. Release plays once and returns to locomotion.

`scripts/normalize_heavy_reference.py` explicitly crops the approved horizontal heavy row onto 128×128 transparent canvases with the existing (64,96) foot anchor. It reuses the reviewed source-matte cleanup and produces `characters/oath/heavy.png` plus `heavy-mask.png`. No new art is generated. Wind-up uses two source poses at 8 FPS; release uses five display frames at 10 FPS (500 ms), including repeated approved poses to hold the arc/recovery. Four distinct source poses are used. Crowded intermediate poses and the final debris-only cell are omitted. Some flattened-source fringes/overlap and uneven pose spacing remain; final clean layered art should replace these evaluation assets.

Right is canonical and left mirrors it. Up/down use their approved basic directional attacks plus a larger procedural slash arc; held charge uses the corresponding directional idle and buildup effects. These are documented fallbacks, not invented vertical heavy character artwork. Scarf color uses the existing cached runtime palette system on the heavy mask. Side-view characters retain geometric presentation.

## Projectile rendering

`ProjectileView` owns the client projectile images, compact glow/core/trailing sparks and transient impact bursts. It never creates, moves or collides gameplay projectiles. `Adventure` passes positions from the existing projectile interpolation buffer; velocity selects visual orientation. There is no sprite-based hit detection or projectile spawning at an animation frame.

`effects/coco-blast.png` is a single neutral grayscale blast extracted from the approved isolated right-traveling projectile in `Basic Fighting Sprites.png`, using explicit bounds (1368,118)-(1524,244). `scripts/normalize_projectile_reference.py` removes the dark background, normalizes to 96×64, and places its core at (76,32). Rotation points its short comet tail away from velocity. Runtime tint uses Coco's selected magic palette for blast, glow, trail and burst; the small bright core remains pale. The same texture supports every palette, with no recoloring work or five texture sets per render frame.

The existing snapshots now include a bounded `World.projectileImpacts` list containing projectile id, owner, world position and server tick. Only the existing enemy/boss collision branches record an impact. Natural lifetime expiry, scene clearing and disconnect do not invent collision bursts. Events persist for 30 ticks (one second), allowing ordinary missed snapshots to recover them. Views deduplicate by projectile id and skip old bursts on reconnect; a burst lasts 350 ms. This short retention is not an indefinite event log under prolonged packet loss.

F4 displays geometric traveling projectiles along with geometric characters. Resize affects presentation only. Missing blast art retains colored procedural core/trail presentation.

## Validation

All required commands passed: `npm run typecheck`, `npm test` (49 tests / eight files), `npm run build`. Build retains the existing Phaser bundle-size warning. `git diff --check` passed.

Two real Socket.IO clients verify matching charge/release snapshots, tap edges arriving within one server tick, traveling projectiles and collision-impact snapshots. Deterministic tests cover 14/33/38-tick timing, cap, early normal release, no damage during hold, fixed heavy damage, cooldown rejection, interruption/stale/disconnect cancellation, projectile expiry without impact, event deduplication and presentation recovery/facing.

Two browser clients in room Y6ML3R validated normal J taps, held/minimum/full charge (remote observed ticks 19 and 33/progress 1), matching heavy release sequence 1055, later repeat releases, Arcane traveling blast, server-recorded collision, F4, portrait/landscape resize during charge and reconnect followed by release. For convenient heavy visual testing only, an isolated local fixture on port 3004 grants Guard/Heavy through server unlock calls; it does not alter the ordinary game server on port 3003. The fixture and test setup do not bypass the server's charge or attack acceptance logic.

Two ordinary-build browser clients in room 6QC3YH validated Rose traveling VFX and shared authoritative collision events (including impact positions x535 and x493). The inspected client error/warning log was empty. Screenshots include `heavy-charge-remote.png`, `heavy-release.png`, `projectile-arcane.png`, `projectile-rose.png`, and `projectile-impact-rose.png`. Exact threshold/cap and rapid-input assertions are automated; browser gestures validate representative charge/release visuals, not exhaustive latency stress conditions.

## Preview

Ordinary game: http://localhost:3003/ (normal skill prerequisites apply).

Heavy visual fixture: http://localhost:3004/?touch=1 (Heavy Break is unlocked by the server fixture for testing). For a fresh fixture after a build, run `node scripts/visual_combat_fixture.mjs`; use a free local port with `COMBAT_QA_PORT` if 3004 is already in use.
