# Situation A deterministic heuristic baseline

**Active comparator: v2, declaration r5, frozen at `1de3b61`; 2/2 successes in 31.5 game seconds.** The original v1 description/results below are retained as history; see the v2 sections for the active changes and evidence.

Owner-requested new comparator: `baseline-maze-heuristic`, policy ID `baseline-maze-heuristic-v1`. Source SHA256: `a268d234adec49279d89b1ac4b030e19a45ccd8db39b4790736de0f482ebb9e1`. Declaration r4 changes only A's cheap comparator. Frozen A, model policies, gameplay and B/C definitions remain unchanged. B/C have not been run or tuned; their baseline-quest selection remains pending certification.

The player uses normal reset/observe/legal_actions/step/outcome via the existing harness. It makes zero model calls. Each hero owns separate memory, built from its own normal screen, inventory, journal, ability readiness and last result. It has a remembered observed map, not privileged offscreen geometry. The centralized model has both screens; that architecture asymmetry is disclosed.

General rules are hand-coded: fire can remove a visibly combustible hedge; Black Hole moves a cow toward its landing point; a visible grazing label supplies a destination hypothesis; speed/time abilities help chase a visibly key-carrying wolf; an owned key's description can identify a gate. These are disclosed puzzle-rule priors, not an uninformed baseline. No solution waypoints, completed subgoal flags, scenario identity, source map or successful trace is provided to the policy. The heuristic does not guarantee completion.

It deterministically searches visible/remembered terrain, prioritizes unexplored frontiers, backtracks around blocked edges, and approaches observed interaction targets. It enumerates firing positions around the visible cow and uses the same observation-derived preview available to the centralized controller. Candidate ranking rewards movement toward the observed grazing label, discounts hero obstruction and distance, excludes uncertain radius-edge targets, and remembers attempted position/direction configurations. After firing it moves sideways out of the cow's swept body, allows 180 game ticks for the effect, and checks observed displacement. A moved cow does not imply a cleared passage. Cooldown readiness is checked; periodic exploration prevents permanent cow-only work. Unknown item effects are not counted as progress.

Limitations: coarse observed terrain, greedy candidate ranking and finite exploration budget can miss a solution; dynamic-body collisions can make remembered blocked edges stale. No lookahead engine simulator or perfect puzzle solver is used. Attempts are not completed subgoals. Evaluation uses the authoritative Shears predicate and unchanged episode/decision limits. Offline speed is accelerated and is not a normal-speed recording.

Four development runs on S2-local seed 0 preceded the freeze: all failed at the decision limit. First: 196.2 game-s, 0 invalid; second: 195.9 game-s, 8 invalid item trials (then replaced by description matching); third: 198.9 game-s, 0 invalid; fourth: 197.4 game-s, 0 invalid. All used zero model calls. No held-out case was used. This is post-hoc development on A, not a baseline declared before the historical model pilots.

Reproduce from repository root with local dependencies installed:

```sh
node --import tsx scripts/midterm/evaluate.ts --player baseline-maze-heuristic --situations S2-local --seeds 0 --out /tmp/maze-baseline-run1
node --import tsx scripts/midterm/evaluate.ts --player baseline-maze-heuristic --situations S2-local --seeds 0 --out /tmp/maze-baseline-run2
```

Both repetitions must use the same committed policy. Final outcomes and evidence will be appended after verification. Existing baseline-quest implementation and pinned hashes are retained unchanged.

## Historical v1 frozen repetitions and verification

Policy frozen at `15edcd6` (implementation `9bc1a11`). Run 1 records clean `15edcd6`; run 2 records `15edcd6+dirty` because session-evidence documentation was refreshed during the repetitions. The only working diff was that session record; policy bytes match the committed source SHA256. No runtime code changed between runs. Both A/cheap-baseline trials failed at the decision limit: **197.4 game seconds / 11,843 ticks**, 1,601 Sieg decisions and 1,550 Coco decisions, **0 invalid actions, 0 model calls/tokens and $0 API cost**. Wall time: run 1 **28.0 s**, run 2 **21.1 s**. Both collected the key and opened the gate through ordinary interactions; neither acquired Shears. Exact state/action-result fingerprints match. End hash: `aa9d463aac7531a74191fccf20736c18834daac5437478a8d8c393638ff95222`.

[Evidence manifest](evidence/maze-heuristic-v1/manifest.json) includes raw-byte SHA256s, gzip trace archives, summaries, chain verification and four development summaries. Traces contain privileged evaluator records and are never fed to policies. Decompress with `gzip -dc trace.jsonl.gz`. Wall time is host-dependent; repeated deterministic trajectories are not independent statistical evidence. No normal-speed recording was made.

Validation: `npm run typecheck` passed; `npm test -- packages/agent/test/mazeHeuristic.test.ts packages/agent/test/situationA.test.ts packages/agent/test/centralProgress.test.ts packages/agent/test/scriptedFreeze.test.ts` passed **59/59**; `npm run build` passed with the existing large-chunk warning. Initial fixture/type failures were fixed and the checks rerun. Full-suite tests were not run concurrently with other work. Existing baseline-quest and frozen A pins pass unchanged. Same-session rule audit is not independent review.

Secret scan: 201 session/midterm text files returned 0 findings with only the previously documented unchanged historical canary report (`2026-10-27-recording.md`) excluded. Gameplay fingerprints exclude measured host `waitMs`/`latencyMs`; raw traces retain those values and their original hash chains.

## V2: exploration after a newly opened gate

The owner requested deliberate exploration beyond the opening. V2 remembers the approach position and observed gate/wall orientation; it verifies the gate's open appearance before setting a bounded crossing intention. Unvisited cells on the far side get exploration priority. Closed-gate collision history is cleared when the observed opening changes. The player uses measured movement speed for small approach steps; a nearby backpack label alone does not imply E is in reach. An ineffective E does not mark completion: the hero closes distance and retries from a changed position. Nearby visible world objects may also be probed through ordinary E. No puzzle coordinates or hidden state were added.

Four v2 development checks: 197.1 s failure, 196.7 s failure, 174.7 s failure, then 31.5 s success; all zero invalid actions and zero model calls. V1 remains an immutable historical baseline, not rewritten as successful. The active r5 allocation is for v2.

## Recorded active v2 outcomes

V2 frozen at `1de3b61`: **2/2 successes**, **31.5 game seconds / 1890 ticks** each; decisions 367 Sieg / 306 Coco; zero invalid actions, model calls/tokens or API cost. Wall times 6.7 s / 6.4 s. Both authoritative Shears milestones, trace hash chains and deterministic gameplay fingerprints verified. End hash `1287b39e69747d50c98005d23dd7c6ad5757975ca9e0555e329ac6d27a611b79`. Evidence: `docs/midterm/evidence/maze-heuristic-v2/manifest.json`. Both clean runs use the same policy and frozen A start. V1's 0/2 failures remain historical, not replaced in its archived evidence. Fourteen active-suite rows remain unrun; B/C unchanged.

Validation: typecheck and build passed; 64/64 targeted tests passed across maze heuristic, Situation A, central progress and scripted freeze tests. The original route baseline pins and frozen A remain unchanged. No full-suite concurrency, paid calls, held-out runs, game changes or recording claims.

V2 evidence secret scan: 211 session/midterm text files, 0 findings, excluding only the unchanged previously documented historical canary report (`2026-10-27-recording.md`). Both frozen v2 runs record clean `1de3b61`; no session rendering occurred between them.

## Watching and recording a new free run

The archived heuristic trials above were accelerated offline runs and have no video. From the evaluation checkout, run:

```sh
cd /Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember-eval
npm run eval:live -- --scenario S2-local --seed 0 --player baseline-maze-heuristic
```

The live viewer uses normal speed and recording is on by default. Output prints its directory under `evaluation-runs/live/`; `recording.webm` is the video and `recording.json` is recording metadata. This is a new free baseline episode, not a video of the archived trial. The launcher now explicitly admits the new B runtime ID. `griffin-unprepared-v1` in another checkout is a different scenario and must not be silently substituted. The CLI smoke test uses `--no-viewer` and therefore does not create or validate a recording.

Integrated into `oath_and_ember-eval` at the owner's request. Original archived trials retain their source commit IDs; integration checks are recorded separately. The reviewed `griffin-unprepared-v1` enclosure case is preserved beside the return variant, not replaced or aliased.
