# game-rules-audit: recording (continuous showcase)

| Field | Value |
| --- | --- |
| Date | 2026-11-07 |
| Session | 9409e901-41c2-42f4-839f-2090bdeba517 (the same Claude Code session that implemented the showcase; **not** an independent session, see note) |
| Session URL | None unless the owner supplies one |
| Skill file SHA256 | `03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756` |
| Commit audited | `6e528f7`, working tree clean |
| Target and focus | recording — the continuous showcase `showcase-maze-griffin-complete-v1` (commits `c30d2fb..6e528f7` on `midterm/evaluation`): scenario definition, success predicate, non-terminal knockout rule, guidance `showcase-maze-griffin-v1`, free baseline, knockout probe, paid lock, live recording and replay-video pacing, before the owner's paid-run authorization |
| Files read | `AGENTS.md`, `CLAUDE.md`, `docs/midterm/MIDTERM_GUIDELINES.md`, `REQUIREMENTS_CHECKLIST.md`, `manual/Oath_and_Ember_Player_Manual.md`, `packages/agent/src/{showcase,suite,evaluator,environment,harness,playerKinds}.ts`, `policies/{situationGuidance,showcaseRoute}.ts`, `route/showcaseKnockoutProbe.ts`, `scripts/midterm/{live,replay-video,showcase,showcase-knockout-check}.ts`, `packages/agent/src/liveViewer.ts` (`pacer`), `apps/server/src/GameRoom.ts` (`damage`), `apps/server/src/griffin.ts`, `packages/agent/test/showcase.test.ts`, `docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md` |
| Commands run | `git diff --stat eeb2b59..HEAD -- apps packages/shared manual Images` → empty (no server, shared, manual or art change). SHA-256 of 12 frozen run-path files at `eeb2b59` vs working tree (perception, actions, centralized, llm, mazeHeuristic, griffinHeuristic, runner, budget, situationA, griffinSituations, griffinSituationC, navigate) → all identical. `validatePlan` with a paid-like `openai:gpt-6-luna@medium` gateway, seeds 0 and 1 → both refused ("locked for paid model runs"). `grep` for HP regeneration in `apps/server/src` → none outside the Prologue woods lessons. `npm test` → **1,383 passed, 1 failed (1,384)**; the failure is `s2Shutdown.test.ts` "gives up on a video that never finalizes" (210 ms vs a 200 ms bound), known and failing identically at `eeb2b59`. `npm run typecheck` → pass. `npm run build` → pass. `python3 -I scripts/evidence/scan_secrets.py <showcase doc, evidence folder, showcase.ts, situationGuidance.ts>` → 25 files, 0 findings |

**Independence note.** This audit ran in the implementing session, at the owner's request, before the paid run. A skill invocation is not an independent review (`AGENTS.md`); the `rules-reviewer` subagent reviews the same range separately.

## Findings

| # | Severity | Source (H/M) | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Medium | H | `docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md`; `midterms/saadsatter/evidence/showcase/free-validation/` | The doc still says knockouts fail the episode (§3, decision B), lists the old guidance hash `c0f7382e…`, prompt hash `fecf10c7…`, definition hash `23701f01…` and "proposed" limits. The evidence folder was generated at `c30d2fb` with the old guidance. Code at `6e528f7`: knockout non-terminal, guidance `7f3203b9…`, prompt `59e46825…` | A reader would get the wrong knockout rule and hashes; the free evidence does not cover the guidance that would be run | Update the doc to the owner's 2026-11-07 decisions and the new hashes; regenerate the free evidence (check report, baseline, mock, replay, knockout probe) at the final commit, keeping the `c30d2fb` folder as history or clearly superseded |
| 2 | Medium | H | `packages/agent/src/liveViewer.ts` `pacer`; `packages/agent/src/environment.ts` `runPaced` | The paced loop does not wait on the tick where one action ends and the next starts. Replays were measured about 10% fast (141.7 game-s in about 132 s) before `6fc3102`. The live viewer uses the same loop, so live recordings labelled speed 1 also run slightly fast while actions run (magnitude not measured for live runs) | "Normal speed" claims for live videos, and for replay videos made before `6fc3102` (A/B/C evidence included), are slightly inaccurate. Game content and hashes are unaffected | Disclose in the showcase doc that the raw live video's acting segments may run slightly fast and that the replay (game-clock paced) is the normal-speed clip; leave the shared environment unchanged; the owner may decide whether to annotate earlier evidence |
| 3 | Low | M | `scripts/midterm/live.ts`; `packages/agent/src/harness.ts` | The 7,200 s ceiling is enforced only as an upper bound. Without `--wall-seconds 7200`, a model run uses the default 3,600 s | A paid run launched without the flag could stop at `wall_clock_limit` near the expected wall time (about 4,400 s) | Put `--wall-seconds 7200` in the prepared command (or make 7,200 s the showcase default); check it in the pre-run checklist |
| 4 | Low | M | `packages/agent/src/harness.ts` `validatePlan` | Once unlocked, the showcase paid scope checks gateway, model, effort, batch and guidance but not the seed; `live.ts` admits tuning seeds 0 and 1 | A seed-1 paid run would be admitted after the unlock although the owner approved seed 0 | Check `seed === SHOWCASE_PAID_SCOPE.seed` for paid showcase runs, with a test |
| 5 | Info | M | `packages/agent/src/policies/situationGuidance.ts` `SHOWCASE_PHASE_PLAN` | No coordinates, waypoints, step sequences, hidden state or maze answers (tested). It does assign roles ("Coco … fire, pull or flight"; "Sieg … chased, struck, pushed"), names the exits by their drawn signs, and says only Coco can reach the nest by flight. The knockout sentence matches the public manual (line 108). HP does not regenerate in these areas (no regen in server code), so "do not expect it to come back on its own" is accurate | Strong, owner-requested hints. They fit a labelled demonstration, not a generalization result | Keep the label "prompt-tuned demonstration, excluded from A/B/C" wherever the recording is shown |
| 6 | Info | M | showcase player `model-centralized` | One planner sees both heroes' permitted screens and orders both. Separate per-hero memories and model channels do not exist in this player kind (the same disclosed asymmetry as the A/B/C model runs) | The showcase does not demonstrate two independent agents | State this in the showcase doc and next to the recording |
| 7 | Info | H | live viewer | The viewer shows the human game UI, including HUD goal lines that the agents do not receive (for example "Coco: Fly to the northern nest; drop the Shears for a haircut…") | A viewer could think the agents read these hints | Keep the doc note that HUD goal lines are not agent input |

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass | No change under `apps/` or `packages/shared`. The baseline and probe submit ordinary actions through `step()`. The probe reads `room.state` only to snapshot evidence (evaluator side), never writes it |
| 2 Rules and art preserved | Pass | No mechanic, tuning, story, map or art change. Knockout recovery is the existing `GameRoom.damage` rule (HP 100, current area spawn, `movementEpoch` advanced) |
| 3 Real mechanics, no fixtures | Pass | Start = S2-A's ordinary prefix, no fixture (start hash `fdc49877…` equals S2-A's, tested at seeds 0 and 1). Predicate unit checks edit copies of a final world, labelled in the test. Probe knockouts come from the Griffin's own attacks |
| 4 Observations player-visible | Pass | `perception.ts` unchanged. New environment data (`showcase_knockout` trace lines, `showcaseReport`) go to traces and summaries only. The knockout feedback text existed before and matches the manual |
| 5 Legal actions leak nothing | Pass | `actions.ts` unchanged |
| 6 No solution in player context | Pass, Finding #5 (Info) | Briefing, task and guidance checked. Owner-approved explicit demo guidance; no answer key |
| 7 Independent players | Finding #6 (Info) | Centralized planner by design, as in A/B/C |
| 8 One interface | Pass | Baseline, probe and model all use the same environment operations. The free baseline is labelled a baseline |
| 9 Limits and terminal reasons | Pass, Findings #3, #4 | Limits in `SHOWCASE_EPISODE` (36,000 ticks, 4,000 decisions, 400 calls and 8M tokens per hero), $2.00 cap, 7,200 s ceiling; runner-enforced. Knockout no longer terminal; tick, decision, call, token, spend and wall-clock limits, the stall watchdog and three policy failures still end the episode |
| 10 Determinism and identical starts | Pass | Repeated baseline runs give identical end hashes; replays match exactly. The probe run is deterministic (its test pins milestone order) |
| 11 Suite and reporting | Pass | Showcase kept out of `SITUATIONS` and `ABC_SITUATIONS`; labelled `officialEvaluation: false` in every summary; no A/B/C file, result or declaration changed |
| 12 Synchronization and recording honesty | Finding #2 | Replays are labelled "REPLAY … (recorded actions, no model calls)" and checked against the trace. Live pacing runs slightly fast while acting |
| 13 Validation | Pass with known failure | 1,383/1,384; typecheck and build pass |
| 14 No overclaiming, no secrets | Finding #1; secrets Pass | Stale doc and evidence; scan clean |

## Recommended tests

- Paid scope rejects seed 1 for the showcase once unlocked (Finding #4).
- The prepared paid command includes `--wall-seconds 7200` (a launcher test or pre-run checklist item, Finding #3).
- Regenerated free evidence pins the current guidance and prompt hashes (Finding #1).

## Open questions for the owner

- Should earlier A/B/C replay and live videos get a note that speed-1 playback runs slightly fast while actions run (Finding #2)? Their game content and verification are unaffected.
- Is the centralized planner (one planner for both heroes) acceptable for the showcase, given the course's two-independent-players framing (Finding #6)?
