# Collision jitter investigation and fix

## Reproduced before changing behavior

The current shared collision algorithm did not reverse or penetrate solids during a sampled grid sweep of valid positions in MAIN_HOUSE/HOUSE_INTERIOR. Two normal browser clients also stayed fixed against cardinal barriers and corners. Ordinary diagonal movement exposed prediction corrections, but not visible reversals in that particular capture.

The original visible shake was reproduced with ordinary held diagonal movement while the QA transport delivered input packets in150ms batches. On Coco's interior down-left wall slide, authoritative position never reversed, but predicted position reversed9 times and the rendered position reversed18 times. The largest rendered backward step was about7.50 world units. Evidence is retained in `qa/collision-investigation-batched-before`, including both native recordings and per-render traces. Failed instrumentation attempt v1 is preserved; v2 corrected the tracing script without changing game behavior.

A deterministic pre-fix regression also failed: two client movement samples predicted X408.95668589502964, but one authoritative tick acknowledging both packets reset prediction to404.4783429475148. This reproduced the timing error independently of browser load, textures and smoothing.

## Root cause and changes

The server applies the latest held input once per fixed simulation tick and acknowledges its sequence. That sequence acknowledges intent; it does not count elapsed physics steps. The client previously advanced one physics step per outgoing packet and replayed only packets whose sequence was unacknowledged. A batch acknowledgement could discard multiple predicted steps after only one server tick, rewinding the predicted position. Existing rendering convergence then visibly followed that rewind. Map overlap did not cause the reproduced shake.

The server also discarded newer movement packets arriving less than 10ms after an earlier packet. A burst beginning with neutral intent could therefore keep the hero stopped despite newer movement. The server now retains the latest validated monotonic input; simulation still runs once per fixed tick and the bounded action-edge queue remains intact.

`Prediction` now tracks predicted physics ticks separately from command sequences, assigns commands to that timeline, anchors it to the existing authoritative `serverTick`, and replays future ticks using the held acknowledged/pending intent. Replay retains the existing120-step bound. `NetworkClient` initializes this clock on full sync and independent location changes. Immediate action packets update queued intent without adding a movement step; the regular30Hz sampler still advances movement. Unacknowledged commands are rebased when the server clock passes their assigned ticks, retaining relative spacing rather than prematurely expiring pending movement. No server authority or networking message fields changed.

An independent embedded-start regression found an exact-center tie in `sweep()`: west/north was incorrectly classified as moving deeper, preventing escape. The tie now permits either direction. Embedded fixtures are never teleported; idle stays stationary and escape occurs at normal movement speed. Positions that are already inside a solid remain invalid until they move out—there is deliberately no automatic depenetration or spawn teleport.

`?movementQA=1` exposes read-only authoritative/predicted/rendered coordinates, input acknowledgement and correction size for QA. It does not send outcomes to the server. Local smoothing and remote interpolation previously could cut a straight line through a solid corner between two valid positions. Both presentation paths now use the same shared swept-axis constraints. The existing smoothing rate remains unchanged. Movement speed, sprite dimensions, character scale, map coordinates and artwork are unchanged.

## Geometry and regression coverage

The map audit found6 overlap pairs outside (four world-boundary joins, two fence joins) and2 inside (compound wall/furniture footprints). They are retained; valid spawn/arrival/door positions are outside solid footprints. Tests cover all cardinal contacts, ten-second sustained movement, moving away, diagonal slides on all faces, adjacent/overlapping corners in both obstacle orders, thin walls, idle and centered embedded starts, prediction/server agreement, alternating zero/two input samples per tick, immediate action packets and scene-clock resets. Existing real-socket multiplayer, independent entry/exit and reconnect tests remain required.

Verification: `npm run typecheck`, `npm test` (115 tests across18 files), `npm run build`. The existing Phaser bundle-size warning remains.

The final two-client batched-input run recorded **zero authoritative, predicted or rendered reversals and zero penetrations**, including startup, across twelve exterior/interior cardinal, corner and diagonal traces. Evidence: `qa/collision-jitter-final-v4/VERIFICATION.json` and `REVIEW.html`. Earlier failed iterations are preserved in final/v2/v3; they exposed the server packet drop, visual corner cutting and pending-command expiration before the final result. Original reproduction: Coco's interior diagonal trace had nine predicted and eighteen rendered reversals, with a maximum rendered backward step of 7.50 world units.

```sh
BATCH_INPUT=1 PLAYWRIGHT_BROWSERS_PATH=/private/tmp/oath-ember-playwright node --import tsx scripts/collision-jitter-qa.ts qa/NEW_DIRECTORY
```

The harness uses authoritative setup fixtures to place both heroes at contacts. Movement itself uses ordinary browser keyboard input; both sessions remain connected simultaneously. Each stage holds movement for4 seconds. Transport batching is QA-only.

## Limits

This eliminates the reproduced packet-acknowledgement/contact shake at contacts/sliding corners; it does not suppress valid authoritative corrections following severe latency, packet loss, gameplay transitions or a server input timeout. Browser QA emulates local packet bursts, not every real network condition. If a different object or input combination still shakes, use movementQA traces to separate physical, prediction and rendered positions before changing collision geometry.

The first sandboxed test run could not open localhost sockets; the complete suite was rerun with local socket access and passed. The QA audit measures backward steps above 0.01 world units and strict overlaps with a 1e-7 measurement epsilon; neither threshold changes collision behavior.

Normal-delivery final QA (`qa/collision-jitter-normal-final`) independently recorded zero reversals and penetrations across all twelve traces and no browser errors, with both clients connected simultaneously.

## Sustained movement recoil (October 9 follow-up)

A second timing case accumulated a permanent client lead when the input sampler occasionally ran extra steps before a server tick. Rebasing pending commands also extended the prediction clock. After walking for several seconds, releasing movement could therefore rewind a position simulated too far ahead. Reconciliation now bounds the future horizon by outstanding inputs (with one in-flight step retained for batched acknowledgements) and clamps pending command times into that horizon. Rebasing commands no longer adds elapsed physics time. Server movement, collision geometry, protocol and artwork are unchanged.

The sustained-movement regression uses a real GameRoom, three-tick input delay, snapshots every two ticks, periodic extra client samples, six seconds of unobstructed walking, and four seconds after release. It fails against the previous predictor and passes with the bounded horizon. Shift has been removed from the secondary action binding; K remains the defense key.

Follow-up validation: typecheck, all 118 tests, production build, and diff whitespace checks passed. Batched two-client browser evidence is in `qa/sieg-recoil-check-browser/VERIFICATION.json`: no wall penetrations or rendered reversals after the first 500ms. Across startup there were two rendered backward steps, at most 1.07 world units; one later predicted correction was 4.48 units without a rendered reversal. This fixes accumulating lead, while preserving authoritative corrections under delayed delivery.
