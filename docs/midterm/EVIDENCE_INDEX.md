# Evidence index: rubric checks 1a–5c

Maps each rubric check in `docs/midterm/MIDTERM_GUIDELINES.md` to the evidence that exists **now**. Numbers such as `S14` refer to `docs/agent-sessions/14-*.md`. Status and next steps are in `docs/midterm/REQUIREMENTS_CHECKLIST.md`. Only existing evidence is listed; anything planned is marked *planned*.

Updated 2026-10-27, branch `midterm/evaluation`.

| Check | Requirement (short) | Evidence that exists | Sessions | Missing |
| --- | --- | --- | --- | --- |
| 1a | Rule/source map with labels and locators | `docs/GAME_DESIGN_RATIONALE.md` (design/code/manual/observed/assumed labels, D1–D11 with locators). The owner's D1–D11 approval edits are on `codex/evaluation-archive` (`4d144f4`), not yet on this branch | S14 (rationale written; owner: "I approve of D1-D11") | A rule map covering every Bald Goddess episode rule (shrine, pond, maze, griffin, finale) |
| 1b | Scope and exclusions | Episode `goddess` → `chapter0.complete`: `CLAUDE.md`, `docs/midterm/AGENT_INTERFACE.md`, PR #6 and #7 descriptions | S17 (owner: "Let it end once the Chapter 0 complete comes up"), S22 | README scope statement; Week 3 thread update; course PR #57 still holds Prince of Persia (owner decision: wait for the professor) |
| 1c | Sources credited, reuse terms | `docs/*_PROVENANCE.json`, `Images/Sprites/monster_sprites/README.md`, `docs/SPRITE_ASSETS.md`, audio provenance in `docs/audio/` | S03, S04 (PixelLab), S05 (LPC and Kenney chosen by the owner), S12 (sound sources) | One sources-and-terms section quoting each license (PixelLab terms, LPC, Kenney, audio, Phaser) |
| 2a | Complete loop to a bounded ending | Quest built: S01 (maps, from the owner's 2026-10-14 brief `9ce38024`), S05, S06, S09 (finale, PR #4), S11, S16 (goddess checkpoint). Tests: `apps/server/test/chapter0Finale.test.ts`, `hedgeMazeWalkthrough.test.ts`, `mirrorPondWalkthrough.test.ts`, `griffin.test.ts` | S01, S09, S16 | Done 2026-10-27: `packages/agent/test/route/` (success at tick 12,412, 0 invalid actions, deterministic); evidence in `docs/midterm/evidence/route/seed1/`; `docs/midterm/ROUTE_LOG.md` (21 failures and fixes). **Human:** the owner reports a successful full playthrough through normal gameplay (`docs/midterm/playtests/2026-10-27-owner-full-episode.md`; owner-reported, no recording; kept separate from the agent route) |
| 2b | Model player submits actions through the interface | LLM adapter `packages/agent/src/policies/llm.ts`, tested offline with a fake model (33 tests; re-run 2026-10-26, pass) | S22 | Any live model episode and trace |
| 2c | Per-role information; legal list leaks nothing | `packages/agent/src/perception.ts`, leak tests in `packages/agent/test/environment.test.ts`. Earlier reviews: S18 (pre-implementation), S21 (session A, on the superseded Codex code) | S18, S21, S22 | Owner rule (2026-10-27): griffin HP and phases, signs and labels exactly as a human player sees them. Interface audit with `game-rules-audit` (*planned*) |
| 3a | Runs from a fresh clone | — | — | Course folder, README commands, fresh-clone rehearsal |
| 3b | Runner enforces limits with terminal reasons | `packages/agent/src/runner.ts`, `environment.ts` (tick, decision, model-call, token, spend, wall-clock limits; terminal reasons) | S22 | Failed calls do not count toward the budget; no per-call timeout (gap analysis 2026-10-26) |
| 3c | CI: invariants, legal/illegal, terminal outcome, regression, limits | Deterministic tests exist across `apps/*/test` and `packages/agent/test` | — | Course workflow `midterm-saadsatter.yml`; the full suite currently has 1 failing test (directional sprint frame, first seen in S14/S15 on 2026-10-22) |
| 3d | Implementation agent, reusable skill, independent review | **Implementation:** `CLAUDE.md` (S17), `AGENTS.md`; sessions S01–S17, S22, S23 (phase 1: `1599183`; phase 2: `7c9f025`, `117b6d2`, `b2b7128`). **Skills:** `.claude/skills/game-rules-audit/SKILL.md` (revised 2026-10-27) invoked by name in two separate fresh `claude -p` sessions: S24 (`adapter`, report `docs/midterm/agent-evidence/skill-runs/2026-10-27-adapter.md`) and S26 (`server-changes`, report `docs/midterm/agent-evidence/skill-runs/2026-10-27-server-changes.md`). `.claude/skills/session-evidence/SKILL.md` (new) invoked in S25 (output: S23's phase 1 record). Its second invocation, S27 (`83ac1132`), wrote S23's phase 2 record and S24–S26. It was interrupted by the usage limit and recorded by S23. Both skills have therefore been invoked by name in two separate sessions. S23 launched all of these sessions and wrote their prompts. Historical: Codex `.agents/skills/oath-rule-information-boundary` invoked once (S21). **Reviewers:** `.claude/agents/rules-reviewer.md` (read-only, S20 config checks); `.codex/agents/oath-rule-reviewer.toml` | S17, S20, S21, S22, S23, S24, S25, S26, S27 | Independent reviews in fresh Claude and Codex sessions, with findings and resolutions (*planned*). S24–S27 are skill invocations, not independent reviews |
| 4a | Choices explained, with the alternative they beat | D1–D11 alternatives in `docs/GAME_DESIGN_RATIONALE.md`; interface choices and owner decisions in `docs/midterm/AGENT_INTERFACE.md` | S14, S22 | Alternatives for the action vocabulary, baseline, memory and suite |
| 4b | Credible baseline; suite separates players | Exploration baseline (`packages/agent/src/policies/baseline.ts`) completes the milestone only. `docs/midterm/evidence/session1/` | S22 | Quest-aware two-player scripted baseline (*planned*) |
| 5a | Fair, reproducible comparison | Hash-chained traces and start hashes; **frozen suite** `docs/midterm/EVALUATION_SUITE.md` (2026-10-27, provisional, professor confirmation pending) with start states reached by real play (`packages/agent/src/suite.ts`) | S22, S23 | Results table, dated prices, held-out runs |
| 5b | Owner-voiced log and limitations; peer notes | Template `docs/midterm/agent-evidence/AGENT-TEAM.template.md` | S17 | The owner writes `AGENT-TEAM.md` and the limitations. Peer notes due 2026-11-06 |
| 5c | Recording of agent play, limits stated | Only QA videos made with fixtures (`docs/quests/bald-goddess/recording-*`, S01) and a 10 s Codex smoke video on the archive branch. Neither shows the agent playing the quest | S01, S14, S19 | A live recording of model-controlled play (*planned*) |

## Professor-approved exception (as stated by the owner)

- Historical Codex and Claude sessions count as implementation-agent evidence: `docs/agent-sessions/`.
- Two AI agents control Sieg and Coco independently: `packages/agent`.
- A recorded video of the AI agents playtesting the Bald Goddess checkpoint is submitted.
- Existing assistant workflows and new sessions provide the reusable-skill and independent-review evidence.

The owner reports this exception; no written approval is stored in this repository. The submission folder and replacing PR #57 are still open questions for the professor.

## Phase 4 checkpoint (2026-10-27)

This update supersedes the older planned/missing Phase 4 labels in the table above. See `PHASE4_HANDOFF.md` and session [S28](../agent-sessions/28-codex-evaluation-handoff.md).

- **2b / 2c / 3b:** inherited observation-only mode, independent hero policies, metered harness and persistent ledger validated offline. No observation-schema or game changes. Two reproduced ledger issues repaired with regression tests.
- **3c:** local typecheck/build pass; **669/669 tests** pass. Course CI remains separate and unfinished.
- **3d:** same-session `game-rules-audit` checkpoint saved at `agent-evidence/skill-runs/2026-10-27-phase4-handoff.md`; `session-evidence` used to extract/render S28. Neither is an independent review or a fresh Claude skill session.
- **4b / 5a:** quest baseline succeeds in all six S1–S3 trials on tuning seeds 0/1, zero invalid actions. Portable results: `evidence/phase4/quest-tuning-summary.json`. These are tuning trials, not final held-out results. Static baseline knowledge asymmetry remains disclosed.
- Still missing: live paid trials, final held-out comparison, independent reviews, recording and course-submission work. No paid calls, pushes or merges in S28.

## Phase 4 offline smoke-readiness follow-up (2026-10-27)

- **3b:** ledger/meter tests now include cross-process locks, killed-process recovery, concurrent reservations, unknown and malformed usage, $25 global exhaustion across reopening, and interruption/resume without erased charges. The legacy paid runner and alternate ledger CLI paths are blocked. Implementation commit `f657a0a`.
- **2b / 2c / 5a:** S1 mock trials verify complete per-scenario metrics against disk traces and deterministic semantic replay/end hashes. Observation-only payloads equal the existing per-hero observation/legal set; independent synthetic fixtures reject hidden flags, ids, partner choices and policy history. No live-model result is claimed.
- **3c:** typecheck/build pass; non-held-out test run **676/676 tests in 88 files**; focused infrastructure tests **48/48**. `suite.test.ts` and `route/fullQuest.test.ts` intentionally excluded under the owner's stricter no-S4/F-execution instruction. Four interface tests were moved off the full preset. No held-out outcomes inspected/tuned in this follow-up.
- **3d:** same-session checkpoint report `agent-evidence/skill-runs/2026-10-27-phase4-readiness.md`, not an independent review. Session S28 updated with the real checks and commits.
- Secret scanner: **100 text files, 0 findings** after the readiness report; rescanned after final documentation. Configured next smoke: `claude-haiku-5-5`, effort `medium`, one call, $0.01 reservation/$0.10 smoke stage/$25 global cap. No paid API call, push or merge.
- Local commits: `0e4920b` (quest baseline and disclosed knowledge), `f657a0a` (evaluation infrastructure). See `PHASE4_HANDOFF.md` for limits, commands, remaining risks and the subsequent evidence commit.

## Authorized smoke preflight (2026-10-27): no dispatch

The owner approved one paid smoke call, but the configured credential was absent at clean version `c6be0f2`. Provider documentation lists the model; authenticated acceptance was not checked. Canonical ledger/lock absent and untouched. **0 paid calls, $0 spend, no reservation/settlement, no model trace/summary.** Evidence: `evidence/phase4/smoke-preflight-2026-10-27.json`; details in `PHASE4_HANDOFF.md`. This is a blocked preflight, not live-model evidence. No pilots or S4/F runs.
