# rules-reviewer: Situation B (griffin-unprepared-v1)

| Field | Value |
| --- | --- |
| Date | 2026-11-06 |
| Reviewer | `.claude/agents/rules-reviewer.md` subagent (read-only: Read, Grep, Glob), launched in a separate invocation by implementation session 959362b9-aa98-47dd-bedd-265c37862f01 at the owner's request; not instructed to approve |
| Reviewed | `midterm/griffin-situation-b`, 5388b23..0ca9a5f (6deaef3, 96fd952, 0ca9a5f) |
| Note | The report below is the reviewer's output, copied verbatim. The implementation agent's responses are in docs/midterm/SITUATION_B_GRIFFIN.md, "Review round 1". |

---

## rules-reviewer report

**Reviewed:** branch `midterm/griffin-situation-b`, worktree `/Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember-griffin-b`, range 5388b23..0ca9a5f (6deaef3, 96fd952, 0ca9a5f). I had no diff file, so I read the current state of each named file. Files read in full or in the relevant parts:
- `packages/agent/src/`: `perception.ts` (props, telegraphs, clip, `perceive`/`add`), `evaluator.ts`, `environment.ts` (reset, step, tickOnce, watchRoom, checkEnd, progress), `types.ts` (TerminationReason), `suite.ts`, `route/griffinStart.ts`, `route/griffinWitness.ts`, `route/director.ts`, `policies/navigate.ts` (asTuned/asTunedMaze), `griffinSituations.ts`, `policies/situationGuidance.ts`, `harness.ts` (caps, validatePlan, policiesFor, runSuite/runOne), `finalAccess.ts` (gate parts)
- `scripts/midterm/live.ts` (args, gates, model setup), `scripts/midterm/replay-video.ts` (scenario/terminal handling)
- `packages/agent/test/griffinSituationB.test.ts`
- `docs/midterm/SITUATION_B_GRIFFIN.md` §1–8, `docs/midterm/DECLARED_EVALUATION_SUITE.md`
- Game references: `apps/client/src/environment/GriffinView.ts`, `apps/server/src/griffin.ts`, `GameRoom.ts` (tick damage paths and `damage()`), and the player manual (grep only).

**Not reviewed or unverifiable:**
- I could not run anything, so I don't know whether typecheck, tests or build pass. The doc's claim that "the full test suite passes" is unverified.
- I did not check the pinned hashes (start, prefix SHA, witness actions/end hash, prompt hashes) against real runs.
- I did not read the files in `docs/midterm/evidence/situation-b-certification/`.
- I did not read the `llm.ts`/`centralized.ts` diffs line by line. I relied on grep and the call sites (centralized.ts:389–399, 968; llm.ts:297–302).
- I did not read `evaluate.ts`. Grep shows no guidance path in `scripts/midterm` other than `live.ts` and `situation-b.ts`.
- I did not check `viewRect` (it predates this change) against the client camera.

### Findings

| # | Severity | File | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1 | High (latent: paid runs are blocked while status is `proposed`) | `packages/agent/src/policies/situationGuidance.ts:32-40` | Its own provenance (line 47) says the text was drafted "from game source and the offline witness". (a) "The Griffin aims at the nearer hero" comes from `griffin.ts:327-334` and is not in the manual. It is also incomplete: the Griffin locks onto Coco whenever she is over the nest (`coco.y < 240`, lines 328, 410-418), and a grounded Griffin headbutt-aims at Sieg once he has stood still ≥1.4 s (lines 423-427). (b) "From the shore below the flight path, follow it side to side and throw north just before it passes overhead" is the witness's tactic (`griffinWitness.ts:15-20, 128-152`). (c) "Health does not come back" and "sword cannot reach it while it flies" are source facts (`resolveSword` `!griffinAirborne`; no heal path in `apps/server/src`). | CLAUDE.md forbids giving gameplay agents source-derived hidden information or hardcoding solutions in prompts. The declaration (lines 80-83) says players get "no … route constants or source access". If approved as written, the post-tuned condition plays with hidden targeting rules and the certification controller's solution. The partly wrong targeting rule could also push Coco into the nest-intrusion trap. | Owner decision. Either remove the source-only mechanics and the witness tactic, or record explicitly that post-tuned B uses source-derived solution guidance and disclose that in results. Correct the targeting statement if any of it is kept. |
| 2 | Medium | `docs/midterm/SITUATION_B_GRIFFIN.md:64`; `perception.ts:744` | The doc says "no other scenario's observations change". The new effects appear in every `GRIFFIN_ENCLOSURE` observation, and held-out S4 and F both pass through the enclosure (`suite.ts:171-181, 188-189`). | The held-out observation contract changed without being disclosed. Any S4/F final run or comparison with an earlier S4/F record differs in what players saw at the Griffin. | Correct the doc. Add S4/F to the owner's approval item 1 (doc §8). Confirm the S4/F scripted pins (`scriptedFreeze.test.ts`) still match after a real run. |
| 3 | Medium | `griffinSituations.ts:93`; `SITUATION_B_GRIFFIN.md:77-84`; `DECLARED_EVALUATION_SUITE.md:64-71` | The "pre-tuned" B condition is defined as the generic planner prompt "unchanged since Pilot-30 (040685c)". The test pins it to Pilot-30's prompt hash (`griffinSituationB.test.ts:272-277`). The declaration classifies Pilot-30 as post-tuned, with an unidentified tuning intervention, and lists Pilot-28 at 678b86c as A's pre-tuned run. | "Pre-tuned" means a different policy in A than in B, and B's pre-tuned prompt may carry A-derived tuning. That confounds any pre/post comparison. | Disclose in the B record and in results that B's pre-tuned condition is "Pilot-30's generic policy, not tuned on B". Get the owner's acceptance of this definition before paid runs. |
| 4 | Medium | `situationGuidance.ts:42-50`; `harness.ts:312-313`; `live.ts:224` | Approval is a mutable `status` string. Nothing ties "approved" to a specific `sha256` of the text. | After approval, the text could be edited while status stays `approved`, and paid runs would accept it. Summaries record the sha256, so this is only detectable after the fact. | Store an `approvedSha256` (or pin it in a test). Refuse paid runs when `guidanceHash(text)` does not match it. |
| 5 | Medium | `griffinSituationB.test.ts:232-268` | The telegraph test covers only BEAM CHARGE/BEAM on Coco's screen. During HEADBUTT_CHARGE it asserts nothing (line 264). There is no test of Sieg's view, of a line wholly off screen (expected: no entry), or of the gates in `perception.ts:313` (DEFEATED, wig claimed). | A regression in the headbutt mark, its geometry or its off-screen handling would go unnoticed. | Add cases (see Missing test coverage). |
| 6 | Medium | `environment.ts:759-772`; test file :148-185 | Failure-before-success ordering is tested only through the pure predicate. Nothing exercises `checkEnd` with a knockout and success in the same tick, or a knockout during the prefix (it must be ignored). | The documented ordering guarantee has no test that would fail if lines 768-770 were reordered. | Add an environment-level test (labelled fixture) where success holds and a lethal `room.damage` occurs in the same tick; expect `knocked_out`. |
| 7 | Low | `harness.ts:61` | `WALL_CLOCK_CEILING_S` covers only P1. `live.ts:123` `--wall-seconds` can raise B above the declared 3,600 s. | A B run could exceed the declared bound and change `wall_clock_limit` outcomes. | Add `"griffin-unprepared-v1": 3600` to the ceiling map. |
| 8 | Low | `scripts/midterm/replay-video.ts:64,71` | `known` excludes `ABC_SITUATIONS`, so B traces cannot be replayed. `knocked_out` and `left_area` would also be classed as "external stops". | Video replay is not possible for B traces (live recording still works). | Include ABC situations. Treat `knocked_out` and `left_area` as game-decided ends. |
| 9 | Low | `perception.ts:315-320` vs `GriffinView.ts:460-475` | The client hides the beam sprites when the drawn length is ≤20/35/60 px. Perception lists "griffin beam" at any length. Clipping uses the centreline only, ignoring the ~70 px beam width and the 26 px headbutt circle. | Slight differences from the screen at the edges: a very short beam is listed but not drawn, and a circle partly on screen is reported as "continuing off your screen". | Hide the beam entry when length ≤ 20 px, or document the difference. |
| 10 | Info | `route/griffinWitness.ts:25-31, 97` | The witness is one joint controller. It reads both heroes' observations (`griffinOnScreen(c) ?? griffinOnScreen(s)`) and uses source-derived constants (shore y, nest, fireball speed). Director's `asTuned` only rounds positions to one decimal; `asTunedMaze` only applies in the Hedge Maze. Neither adds information. Only the test, `situation-b.ts` and a comment in `griffinSituations.ts` reference it; no policy imports it. | Acceptable as a labelled, solution-aware certification controller. It is not evidence that per-hero play is feasible. | Keep the labelling. Do not cite it as a two-agent result. |
| 11 | Info | `harness.ts:312` | Proposed guidance is allowed only when the gateway label starts with `mock:`. `MockGateway` uses `mock:random-legal@…` and OpenAI uses `openai:…`. | Correct for the current gateways. A future gateway with a `mock:` label would bypass the gate. | Optionally check `instanceof MockGateway`. |

### Checklist

| # | Item | Checked? | Result |
| --- | --- | --- | --- |
| 1 | Game-rule consistency | Yes | No game code touched. The success and failure rules only read state. `damageGriffin` clamps HP to 0 (`griffin.ts:186`), so `hp === 0` is reliable. The peaceful wig has HP > 0 and fails, as declared. Finding 1 concerns prompt content, not rules. |
| 2 | Legal actions | Yes | The prefix and witness use only `step()`. The test asserts the prefix uses only move/wait/interact/advance/choose. The `room.damage` wrapper (`environment.ts:668-674`) calls the original with the same arguments and only records a respawn. Every player-damage path goes through `this.damage` (`GameRoom.ts:1457,1583,1644,1646,1699`), and respawn increments `movementEpoch` (1768-1781). |
| 3 | Observations | Yes | The effects match GriffinView in phases, endpoints (`griffinMouth`, `g.beam ?? griffinBeamEnd(...)`, `g`→`aimX/aimY`) and per-hero screen clipping. There are no numbers, timers or target ids. Minor differences: finding 9. Held-out exposure: finding 2. |
| 4 | Solution leakage | Yes | The briefing is clean (tested regex). The post-tuned guidance contains source-derived mechanics and the witness tactic: finding 1. |
| 5 | Separate reasoning | Partly | Guidance goes only to `model-centralized`, which is a single planner by design (disclosed in the declaration). No new shared channel for the per-hero players. |
| 6 | Fairness between players | Partly | The baseline, pre-tuned and post-tuned conditions share the start and the interface (test 299-322). The pre-tuned definition is confounded: finding 3. Wall-clock ceiling: finding 7. |
| 7 | Engine-owned outcomes | Yes | Success and failure come from `World`. Failure is checked before success (`environment.ts:768-770`). The prefix skips judging (766). Instant actions get `knockedOut: false`; that is correct because no tick runs, and a knockout in an earlier tick is judged in that tick. No hole found. |
| 8 | Deterministic evaluation | Partly (not run) | Reset and prefix are pinned, with tests that reset twice and reset after play. `knockedOut` is cleared each tick. `Date.now` is used only for wall seconds. I could not confirm the pins match a real run. |
| 9 | Tests and CI | Partly | Findings 5 and 6. CI was not inspected. |
| 10 | Project invariants | Yes | One in-memory service. No art, server or shared changes in the listed files. Situation A's pins are asserted. S2-B/S2-C and revision-2 `SITUATIONS` are unchanged; B is in a separate `ABC_SITUATIONS`. `needsFinalGrant` still uses `SITUATIONS` only. The new preset key does not collide in `presetToSituation`. |

### Missing test coverage

- `packages/agent/test/griffinSituationB.test.ts`: HEADBUTT_CHARGE observed → exactly one "griffin charge mark" effect whose end is at `aimX/aimY`, or at the screen-exit point on the segment from `g`.
- Same file: Griffin on screen but the warning line entirely outside a hero's view (Sieg far south) → no griffin effect for that hero.
- Same file: after HP reaches 0 (the witness run) → no griffin effects in any later observation.
- `packages/agent/test/environment.test.ts` (or the B test): labelled fixture with success true and a lethal `room.damage` in the same tick → reason `knocked_out`, not `success`. A knockout during the prefix → reset succeeds and no terminal is reached.
- B test: non-Griffin presets (S2-local) with a lethal hit → episode continues (`failure` is undefined).
- `situationGuidance`: approved status without a matching pinned sha256 → paid `validatePlan` throws (after finding 4 is fixed).
- `harness`: `wallSeconds` above 3600 for B → throws (after finding 7 is fixed).

### Uncertainty

- Whether the S4/F scripted pins (`scriptedFreeze.test.ts`, route seed 1, baselines) still hold with the new enclosure effects. They pin trace digests, not observations, so they probably hold, but only a run would settle it.
- Whether the declaration's "post-tuned" condition is meant to allow source-derived combat guidance (finding 1). Only the owner can settle this.
- Whether `viewRect` matches the client camera exactly. Off-screen clipping correctness depends on it, and it was outside this diff.
- Whether the evidence files in `docs/midterm/evidence/situation-b-certification/` match the pinned witness hashes. I did not read them.
