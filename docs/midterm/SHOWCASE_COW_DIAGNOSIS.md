# Pilot-38 cow failure: diagnosis and proposed generic correction

November 7, 2026. Codex same-session investigation, not independent review. User reports Coco repeatedly casting in front of the cow despite a previous success. Original [Pilot-38 evidence](../../midterms/saadsatter/evidence/showcase/pilot-38-original/README.md) and [Pilot-37 evidence](../../midterms/saadsatter/evidence/showcase/pilot-37-original/README.md) are preserved, including unsuccessful/unknown-usage records. No paid retry was run.

## What the trace establishes

- Pilot-38, source `ec46864`, ends `manual_stop` at 65.5 game-s, 142 attempted calls, one failed/unknown-usage call, no knockouts. It did not obtain Shears. Canonical conservative charge $0.362406; not independently verified provider billing.
- The cow stays at its initial observed position throughout. The two casts made while its body is visible are northeast from below the cow, not the successful side setup.
- At tick 2005 Coco casts from observed (23.49,30.46). At tick 2028 the recorded vortex is (23.78,30.18), while the cow is (26,25): **5.64 tiles apart**. The public manual says the vortex affects targets within 3 tiles. The cast is accepted but cannot pull this cow from that vortex position. Which particular collision stopped the projectile early was not isolated; no claim about that obstacle is made.
- At tick 1996 the model gives Coco a Black Hole action and a `go_to` position in the same order. The documented planner contract says explicit actions execute **before** the walking intention (`centralized.ts`). It therefore casts before reaching its intended new setup. This is a planning/order-construction error, not evidence that the controller ignored the requested position.
- The model acknowledges the failed NE cast, then later repeats NE from another unsuitable southern position. It subsequently wanders/explores around the blockage rather than verifying a changed landing point and useful displacement.
- In Pilot-37, Coco casts east from the side at tick 2087. The observed vortex and moving cow are **2.04 tiles apart** at tick 2149; the cow moves from x26 to approximately23.84 and the maze is completed. Actual source line hashes/positions and the mixed order are preserved in `diagnosis.json`.

The engine, shared rules, centralized controller, navigation and pull-preview implementation are byte-identical between those two recorded sources. No corresponding gameplay/controller regression was found. A fresh model episode does not retain a successful solution from the previous run; the scenario seed fixes the game reset, not the model's sequence of decisions. The complete prompt also changed for the later north-next clarification, so this is not an identical-input replay experiment.

## Proposed correction

Added only general showcase positioning advice: separate repositioning from ability actions, wait for observed arrival, inspect the existing landing-point/affected-target preview, then cast from that confirmed state. Check actual visible displacement/opening; after no effect, change real casting position or landing geometry instead of repeating a failed position/aim pair. Existing action-order and public ability mechanics are restated; **no cow solution, maze coordinate, special side/aim instruction or hidden engine state is given to the model**. Frozen A/B/C guidance, engine and controller are unchanged.

| Identity | SHA-256 |
| --- | --- |
| Definition, unchanged | `ec827f19555e5456d987f866c6f50414827f8875efd911859f351aeafe532831` |
| Proposed guidance | `ea5d75ba9b74a4c72ac60f0b2f35aaa8e991c5e767737a34fc14b871a355d320` |
| Proposed full prompt | `0099a850c7219c31797e0802bc82c7a688c99512adc600fe4a4aa808b7087e8b` |

The initial draft explicitly named the pulling spell in the phase plan, triggering the existing blanket no-maze-answer test. Revised wording remains generic, and the test was preserved rather than weakened. This is outcome-informed showcase tuning after Pilot-38, not evidence of improved model reliability. No model run has validated the proposed advice.

## Preservation, limits and authorization

Pilot-38's raw trace/summary/run/recording metadata are byte-identical copies, trace compressed losslessly; original local video remains untouched and identified by hash. No full paid-video decode/inspection is claimed here. Exact replay checks every one of 430 step results/start/end/manual-stop tick. Original failures and unknown-cost fields are not overwritten.

Previous owner authorization was for one owner-launched attempt and was consumed by Pilot-38. Paid flag is now false and proposed guidance has no approved hash. No automatic retry or agent launch. New exact-hash approval is needed before any further run. Target configuration stays OpenAI gpt-6-luna medium, seed 0, centralized, batch 4, $2 cap/7,200s/400 calls per hero.

Canonical ledger: 38 entries, no open reservation; pilot cap $9 / remaining $2.304996, contingency $0.90, total cap $25 / remaining $18.302075. All charges preserved; no budget increase or new reservation during this diagnosis. No push, merge, course PR modification or submission.

Validation: 17/17 targeted tests and typecheck pass; original Pilot-38 replays all 430 results exactly. [Proposed exact text/hash checks](evidence/showcase-cow-diagnosis/). Same-session diff audit confirms unchanged engine, controller, observation/action paths and frozen official evidence. No independent-review or new model-success claim.
