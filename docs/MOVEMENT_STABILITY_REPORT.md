# Movement stability investigation — October 9, 2026

Implemented within the existing Phaser client and authoritative, in-memory server. Physics remains 30Hz, speed remains 190 world units/second, and the existing 26×26 foot-level collision box is retained. Sprites, animation, attack artwork, filtering, rendering scale, map artwork and camera framing are unchanged. Shift is unbound; K retains the secondary action.

## Follow-up after the 4:02 PM recording

The new recording showed the earlier checks did not establish complete stability. Live short taps did not reproduce a correction during inspection, but a new deterministic regression exposed another scheduling defect shared by both characters: a 770ms queued clock reply reset the estimated server clock behind fresh snapshots. The input target collapsed from its eight-tick buffer to the current server tick. The next fresh reply restored eight ticks immediately, allowing held intent to acquire extra simulation steps during a short tap/release.

`apps/client/src/net/simulationClock.ts` now rejects clock measurements with RTT above 200ms, preserves a minimum eight-tick target buffer against the latest authoritative snapshot, and slews accepted clock corrections by at most 0.25 tick per probe after initial calibration. Authority and the prediction ceiling are unchanged. The failing regression's target jump was **8 ticks before / 0 ticks after**. This is a scheduling measurement, not a measured displacement from the user's recording; that video has no network trace to prove every observed jump has this cause.

The follow-up also adds compact, bounded F3 traces of authoritative, predicted and rendered positions to `main.ts`, and delayed clock-acknowledgement plus long-idle/small-tap scenarios to `scripts/movement-stability-qa.ts`. Debug trace collection is capped at 20Hz and 90 samples to avoid creating a heavy per-frame DOM history.

Follow-up evidence is saved in `qa/movement-stability-clock-taps`: two recordings, traces and `VERIFICATION.json`. Both clients completed 30 taps after 20 seconds idle, with 54 deliberately delayed clock acknowledgements each. The approximately 37-second idle/tap trace measured **0 reconciliation delta, 0 authoritative/predicted/rendered backward steps, 0 penetrations**, and maximum prediction lead **11 ticks** for both. Actual simulated tap durations varied (up to approximately 400ms), since browser automation delivery was slower than the requested 65ms hold; this run does not claim every tap lasted precisely 65ms. The continuous walking loop recorded one 6.33-unit authoritative step flagged near its deliberate direction reversal, with no predicted or rendered reversal and no correction. It is retained in the audit rather than discarded.

The original user recording contains live combat and cannot be assigned a single proven cause from pictures alone. The new failure is reproduced and fixed, but the follow-up fixtures isolate movement from enemies. The live browser reload could not resume the old room (connection request timed out); loading the rebuilt client in **both tabs and creating a fresh room** is necessary before comparing live gameplay again.

## Confirmed causes and fixes

| Cause | Change and why it works |
| --- | --- |
| Command sampling and pending-command count still influenced predicted elapsed time. Delayed delivery could accumulate substantial lead and recoil on acknowledgement/release. | Commands carry separate sequence IDs and requested simulation ticks. Prediction replays fixed ticks, not packets, with an eleven-tick ceiling beyond the latest snapshot. The twelfth tick is reserved for changed intent; this also fixes commands previously falling outside the server acceptance window at the ceiling. |
| Client and server applied held intent on different ticks during batching/loss. | The server validates and schedules intent by tick, coalescing same-tick commands and applying late commands on its next tick. Six recent intents travel redundantly; movement/button edges are reliable. Packets never grant extra physics steps or client-owned outcomes. |
| Dash/blink displacement and cooldown were simulated only by the server. A regression reproduced a 19-unit mismatch. | Both peers use shared `stepMovement`, including the original three-step dash displacement, swept collision and two-second cooldown. Other gameplay remains authoritative. |
| A wall-clock input timeout retroactively expired motion during server catch-up. | Held intent expires against simulation ticks beyond its scheduled tick. A deterministic one-second wall-time stall test verifies that queued movement survives catch-up and still expires after its bounded lease. |
| Full syncs caused by the partner reset local pending movement; stale updates and old-location inputs could cross transitions. | Local movement epochs invalidate queued intent at arrival, respawn and reconnect. Partner-only full syncs reconcile instead of resetting local prediction. Older snapshot ticks/revisions are rejected; remote interpolation respects location epochs. |
| Snapshot receipt bursts compressed remote movement. An empty buffer allowed its playback clock to run ahead and then jump. | Snapshot spacing uses authoritative ticks. The remote playback clock pauses at an empty buffer and resumes through subsequent samples at simulation speed. A regression checks that a six-tick burst advances only 3.04 units during its first 16ms, rather than jumping 38 units. |
| Exterior and forest trees had visible trunks but no solid ground bases. | Small shared trunk rectangles now block feet while allowing movement under canopies and diagonal sliding. Existing wall/furniture/fence geometry and nearest-contact axis sweeps were already stable for valid positions and overlapping rectangles, so they are retained. |

The [Life-of-Buggie movement source](https://github.com/nathang15/Life-of-Buggie/blob/main/RPG%20GAME/Assets/Scripts/PlayerMovement.cs) informed the separation between sampled input and fixed physics updates. Its Unity controller is not a multiplayer implementation; no Unity code, physics system or artwork was imported.

## Files changed

- Shared simulation/protocol: `packages/shared/src/{constants,gameTypes,movement,maps,protocol}.ts`; new `environmentSolids.ts`.
- Client: `apps/client/src/net/{prediction,interpolation,NetworkClient}.ts`; new `simulationClock.ts`; `main.ts` input scheduling, reliable edges and read-only QA instrumentation.
- Server: `apps/server/src/{GameRoom,app}.ts` scheduling, validation, movement epochs and clock probes.
- Regressions: `apps/client/test/collisionPrediction.test.ts`; new `movementSynchronization.test.ts`, `networkMovement.test.ts`, and `apps/server/test/movementScheduling.test.ts`.
- QA: `scripts/movement-stability-qa.ts`, `scripts/analyze-movement-stability.ts`; updated `docs/NETWORKING.md` and `docs/COLLISION_JITTER.md`.

## Before/after measurements

Controlled baseline uses the unchanged HEAD game in a temporary checkout, with only read-only tick instrumentation added. Both versions use the same two-browser keyboard scenarios, 150ms input batches, every-eleventh input packet dropped, 110ms snapshot batches, and periodic 85ms browser stalls. Values are world units. Recoil is measured against simulated intent, retained after release; the automation driver's asynchronous key label is not used as gameplay truth. Intentional rapid reversals are excluded from recoil totals, and the walking-loop audit allows 150ms at its commanded turnaround; release remains audited.

| Metric | Controlled baseline | Final complete jitter recording |
| --- | ---: | ---: |
| Sustained hold/release: maximum reconciliation position delta, Sieg / Coco | 12.67 / 12.67 | 0 / 0 |
| Sustained hold/release: maximum rendered backward step, Sieg / Coco | 0.69 / 1.83 | 0 / 0 |
| Rapid direction changes: maximum reconciliation delta | 25.33 | 0 |
| Dash/blink: maximum reconciliation delta | 19.00 | 0 |
| Rendered reversals across the seven common movement scenarios | 9 | 0 |
| Rendered samples inside the intended tree trunk footprints | 135 | 0 |
| Wall/furniture/corner penetrations | 0 | 0 |
| Maximum prediction lead | 10 ticks | 11 ticks, bounded |

The earlier prolonged-delivery reproduction (`qa/movement-stability-before-v3`) reached 44 ticks of lead and a 23.80-unit rendered backward step during sustained movement. The new ceiling is independent of input count; a five-second snapshot-outage regression cannot exceed eleven ticks.

The follow-up sustained run measured actual injected packet delays up to 292.7ms and dropped 222 packets across both clients. It retained zero authoritative, predicted or rendered reversals and zero penetrations. One forward reconciliation position delta was 12.67 units; the diagnostic records position changes during reconciliation, including forward server catch-up, rather than only divergence at an identical tick. That run's walking-loop/release portion had zero reconciliation deltas for both clients. A further open-space run (ending at X426.67/X439.33, clear of boundaries) measured delays up to 319ms, dropped 236 packets, and retained zero reversals/penetrations; its largest forward reconciliation delta was 6.33 units. Normal-delivery QA had zero reconciliation deltas, reversals and penetrations across all scenarios. Remote continuous movement in the final interpolation recording peaked at 191.32 units/second against nominal 190, with zero backward steps; small timestamp differences between rendering and sampling account for the measurement tolerance.

## Validation and evidence

- `npm run typecheck`, `npm test` (**138 tests, 21 files**), `npm run build`, and `git diff --check` pass. The existing Phaser bundle-size warning remains.
- Deterministic coverage includes 30/60/120/144Hz render cadence, skipped/duplicate input samples, latency, redundant packet recovery, sustained movement/release, five-second snapshot outages, ceiling validation, server catch-up, dash/blink cooldown/collision, all exterior trunks, stale clock replies, partner syncs, disconnect pause, and scene/respawn epochs. Existing overlapping-rectangle, wall/corner, house and combat integration regressions remain passing.
- Real Socket.IO integration checks both players receive identical authoritative positions at matching ticks, rejects outcome fields/far-future requests, and verifies sequence IDs do not determine displacement.
- Recorded browser scenarios cover sustained movement/release, rapid changes, ten-second wall holds, diagonal furniture slides, trunk contact, corners, abilities, furniture/tree circuits, independent entry/exit and Shift with movement abilities unlocked.
- [Sieg normal-delivery recording](/Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember/qa/movement-stability-final-normal/client-1.webm), [Coco normal-delivery recording](/Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember/qa/movement-stability-final-normal/client-2.webm).
- Evidence: `qa/movement-stability-baseline-controlled`, `qa/movement-stability-final-complete`, `qa/movement-stability-final-sustained`, `qa/movement-stability-final-open-release`, and `qa/movement-stability-final-normal`. Each retains per-render traces, screenshots, two native WebM recordings and `qa.json`; numerical audits are in `VERIFICATION.json`. Video frame strips were inspected alongside the traces, including contact/stop and open-space release.

```sh
JITTER=1 PLAYWRIGHT_BROWSERS_PATH=/private/tmp/oath-ember-playwright node --import tsx scripts/movement-stability-qa.ts qa/NEW_RUN
node --import tsx scripts/analyze-movement-stability.ts qa/NEW_RUN
```

Omit `JITTER=1` for normal delivery. `ONLY_SUSTAINED=1` limits recording to the two sustained scenarios. Fixtures change server state only for setup; movement and transitions use real browser keyboard input. Superseded automation-bridge iterations are retained under `/private/tmp/oath-movement-iterations`; that bridge introduced unrequested multi-second delivery backlogs and is not used for the controlled comparison.

## Remaining limits

The eight-tick scheduling buffer deliberately trades some authoritative response latency for consistent tick application; local prediction still responds at the ordinary input cadence. Delay beyond this buffer, prolonged loss, disconnect, respawn and real gameplay transitions can require valid authoritative corrections. Prediction holds at its ceiling during an outage, and remote playback holds when data runs out. This is not a claim of correction-free behavior on every internet connection. No visual clamping hides authoritative rollback, and already-invalid embedded starts are not teleported out of solids.
