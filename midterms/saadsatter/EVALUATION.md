# Evaluation — Oath and Ember

Declared suite: **`oath-ember-abc-2026-11-06-r6-eval-integration`**. Implementation, launch commands and evidence are available directly in `oath_and_ember-eval`. This is a partial evaluation: B/C model runs and the C baseline remain unrun.

## Declared cases

| Situation | Start | Authoritative success | Status |
| --- | --- | --- | --- |
| A — Hedge Maze (`S2-local`, seed 0) | Frozen maze-entrance checkpoint; normal shared inventory | Enchanted Shears acquired | Frozen A unchanged; historical model pilots and heuristic baseline available |
| B — Griffin Trial, Unprepared — Goddess Return (`griffin-unprepared-return-v1`, seed 0) | Fresh 640-HP Griffin; both heroes full health/normal abilities; no Mirror, Shears or wig; legal opening/north-travel history | Griffin HP zero, wig acquired, normal goddess offering and actual `chapter0.complete`; no knockout | Legal checkpoint and rule-aware baseline verified |
| C — Griffin Trial, Prepared (`griffin-prepared-v1`) | Proposed near-matched encounter with Mirror and Shears, no wig | Strict combat defeat and wig acquisition, no knockout; no return requirement | Not registered/certified or run; held out from model-outcome tuning |

B's return objective is the owner's latest amendment. B/C therefore differ in task scope as well as inventory; do not present them as a controlled inventory-only comparison. Prepared peaceful grooming can give a wig while Griffin HP remains positive and does not satisfy C's retained strict defeat predicate. No C-specific walkthrough or outcome tuning has been performed.

The separately reviewed **`griffin-unprepared-v1`** is preserved exactly as implemented in this checkout: enclosure-only combat and wig acquisition, with its original start, hash, boundary and review. It is not an alias of the return variant. Its earlier pre-run owner decisions remain in their original records; they do not authorize paid calls for the new return case.

## Conditions and primary trial allocation

Preserve the evaluation checkout's owner-approved **one primary run per condition per case**: nine primary cells (six model, three baseline). A/B each additionally have a second identical heuristic reproduction, reported as supplementary evidence rather than another primary cell. Four primary outcomes are available and five cells remain unrun. This is not two independent repetitions of each model condition; a reduced/mixed-condition design must not be described as stronger evidence than it is.

| Situation | Pre-tuned model | Post-tuned model | Cheap baseline |
| --- | --- | --- | --- |
| A | 0/1 success: Pilot-28 manually stopped at cow | 1/1 success: Pilot-30 | 1/1 primary success; one matching supplementary reproduction |
| B | 0/1 run | 0/1 run | 1/1 primary success; one matching supplementary reproduction |
| C | 0/1 run | 0/1 run | 0/1 run |

“0/1 run” means no outcome, not a measured failure. Do not pool unlike tasks or treat deterministic repeated trajectories as independent statistical evidence.

## Recorded outcomes

| Run | Result | Game time | Wall time | Model calls | Invalid actions | Estimated API cost |
| --- | --- | --- | --- | --- | --- | --- |
| A pre-tuned — Pilot-28 | Manual stop; cow passage not cleared; no Shears | 125.267 s | 900.8 s | 79 attempted | See original diagnosis; not inferred | $0.094339 conservative charge; $0.085837 known usage |
| A post-tuned — Pilot-30 | Shears acquired | 89.5 s | 1958.1 s | 167 | 2 | $0.443258 runner estimate |
| A heuristic v2, primary / reproduction | Both Shears successes | 31.5 s each | 6.7 /6.4 s | 0 | 0 | $0 |
| B Griffin heuristic v1, primary / reproduction | Both combat defeat + wig + goddess offering + Chapter 0 completion; no knockout | 89.8 s each | 6.7 /6.6 s | 0 | 0 | $0 |

The owner designated Pilot-28 pre-tuned and Pilot-30 post-tuned. Pilot-28's owner-recalled approximately 128 seconds is retained as recollection; recorded elapsed time is 125.267 seconds. Both are historical development pilots, not retroactively preregistered final runs. Their comparison includes controller/planner changes and does not isolate prompt-only tuning. Pilot-30 used `gpt-6-luna` medium at `040685c`; exact intervention provenance is not independently complete. Provider charges above are saved runner estimates, not a current price lookup or invoice. Input/cache/output/reasoning totals and all available identifiers remain in the original records.

Original pre/post evidence, hashes and metrics are unchanged. The A baseline policy is `baseline-maze-heuristic-v2` (`1de3b61`); B is `baseline-griffin-heuristic-v1` (`fbc3627`). Archived runs retain those original source commits. Integration tests in this checkout verify availability separately; they are not relabelled as those original trials.

## Baseline knowledge and interface fairness

Both new baselines are deterministic and have no model gateway. Each hero has its own observation/map/action-result memory; no filesystem, engine state, source map, route constants or successful trace is supplied to a playing policy. The centralized model sees both permitted hero screens, an architecture/information asymmetry that is disclosed.

A knows public puzzle mechanics: fire on combustible vegetation, organic pulling, chase abilities and keys opening gates. It searches pull positions, checks effects, backtracks, crosses newly opened gates and explores unvisited space beyond them. There is no fixed maze/chest solution route. B knows general combat, spacing, recovery, flight over observed water/gaps, organic-target pull/damage and normal inventory/dialogue interactions. It receives no Griffin-grounding rule, fixed nest coordinate or return route. The visible straw nest was already drawn in the client and is now listed under normal viewport filtering for all players; offscreen visibility is tested.

B uses normal observed RETURN exits, shrine exploration and offering interaction with the owned wig. Accepted inputs are not treated as confirmed effects. The evaluator checks actual game state/events. Lethal-hit respawn is an immediate failure even when the game restores HP to 100. Gameplay/respawn rules are unchanged.

The older solution-aware `baseline-quest`, its code, successful A references and measured old-enclosure failure evidence are preserved. It remains C's declared comparator pending certification. It is not silently relabelled as either new heuristic. Four A v1 development failures and its two measured failures are retained; v2 successes do not erase them. B's prefix-construction failure and intermediate reward/return failures are also preserved.

## Evidence and reproducibility

- Machine declaration/results: `docs/midterm/evaluation-abc/declaration.json`, `declared-results.json`, `matrix.json`.
- A heuristic: `docs/midterm/evidence/maze-heuristic-v2/manifest.json`; earlier failures in `maze-heuristic-v1/`.
- B heuristic: `docs/midterm/evidence/griffin-heuristic-v1/manifest.json`; legal definition `evaluation-abc/B-unprepared-return-definition.json`.
- Model records: `evaluation-abc/A-pretuned-pilot28.json`, `A-posttuned-pilot30.json`; original Pilot-30 files and video link under `midterms/saadsatter/evidence/traces/pilot-30-model-centralized-S2-local-seed0/`.
- Native reviewed enclosure case: `docs/midterm/SITUATION_B_GRIFFIN.md` and its existing session-49 review/evidence.
- Previous native report/declaration: `evaluation-abc/history/pre-baseline-integration/`. Incoming 18-row worktree plan: `history/parallel-worktree/`, historical and superseded by this native nine-cell plan.

Paths above are repository-relative; after course packaging they are inside the submission folder. Raw trace hashes/chains, start/end hashes, policy/config identifiers, confirmed milestones and summaries are in the manifests. Gzip traces decode with `gzip -dc trace.jsonl.gz`. Traces contain evaluator-only evidence and are never supplied to players.

From the evaluation checkout, run either command separately:

```sh
cd /Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember-eval
npm run eval:live -- --scenario S2-local --seed 0 --player baseline-maze-heuristic
# Or:
npm run eval:live -- --scenario griffin-unprepared-return-v1 --seed 0 --player baseline-griffin-heuristic
```

The live viewer records at normal speed by default. Its printed output folder contains `recording.webm` and `recording.json`. Archived heuristic trials were accelerated offline and have no video; these commands start new free baseline runs. Pilot-30 has a separate saved model-run recording. No new recording is claimed by the no-viewer integration smoke tests.

## Verification and limitations

Typecheck and build pass in `oath_and_ember-eval`. Integration targeted suite: **78/78 tests in six files**, covering both heuristic policies, the live Griffin CLI, native reviewed Griffin scenario, frozen A and scripted behavior pins. Held-out refusal remains tested. No full-suite test run was launched concurrently with the other workstream. No paid calls, push or merge occurred.

C remains held out from model-outcome tuning. Freeze any final policies and C checkpoint before C outcomes. Model memory comparison, remaining model/C trials, fresh green full CI, a short normal-speed submission recording, human playtest and student-authored reflection remain separate requirements; no completed course hand-in is claimed. Both heuristics are incomplete and development-informed; success on these cases does not prove general puzzle/combat competence.
