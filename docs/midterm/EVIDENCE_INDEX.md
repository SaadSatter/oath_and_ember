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
| 3d | Implementation agent, reusable skill, independent review | **Implementation:** `CLAUDE.md` (S17), `AGENTS.md`; sessions S01–S17, S22, S23 (phase 1: `1599183`; phase 2: `7c9f025`, `117b6d2`, `b2b7128`; phase 3: `37e5a73`, `7184983`, `64efed6`, `d2421aa`, `0c45f82`, `ea26944`; phase 4 code left uncommitted and committed by Codex S28 in `0e4920b`/`f657a0a`). **Skills:** `.claude/skills/game-rules-audit/SKILL.md` (revised 2026-10-27) invoked by name in two separate fresh `claude -p` sessions: S24 (`adapter`, report `docs/midterm/agent-evidence/skill-runs/2026-10-27-adapter.md`) and S26 (`server-changes`, report `docs/midterm/agent-evidence/skill-runs/2026-10-27-server-changes.md`). `.claude/skills/session-evidence/SKILL.md` (new) invoked in S25 (output: S23's phase 1 record). Its second invocation, S27 (`83ac1132`), wrote S23's phase 2 record and S24–S26. It was interrupted by the usage limit and recorded by S23. Both skills have therefore been invoked by name in two separate sessions. S23 launched all of these sessions and wrote their prompts. Historical: Codex `.agents/skills/oath-rule-information-boundary` invoked once (S21). **Reviewers:** `.claude/agents/rules-reviewer.md` (read-only, S20 config checks); `.codex/agents/oath-rule-reviewer.toml` | S17, S20, S21, S22, S23, S24, S25, S26, S27, S29 | Independent reviews in fresh Claude and Codex sessions, with findings and resolutions (*planned*). S24–S27 are skill invocations, not independent reviews |
| 4a | Choices explained, with the alternative they beat | D1–D11 alternatives in `docs/GAME_DESIGN_RATIONALE.md`; interface choices and owner decisions in `docs/midterm/AGENT_INTERFACE.md` | S14, S22 | Alternatives for the action vocabulary, baseline, memory and suite |
| 4b | Credible baseline; suite separates players | Exploration baseline (`packages/agent/src/policies/baseline.ts`) completes the milestone only. `docs/midterm/evidence/session1/` | S22 | Quest-aware two-player scripted baseline (*planned*) |
| 5a | Fair, reproducible comparison | Hash-chained traces and start hashes; **frozen suite** `docs/midterm/EVALUATION_SUITE.md` (2026-10-27, provisional, professor confirmation pending) with start states reached by real play (`packages/agent/src/suite.ts`) | S22, S23 | Results table, dated prices, held-out runs |
| 5b | Owner-voiced log and limitations; peer notes | Template `docs/midterm/agent-evidence/AGENT-TEAM.template.md` | S17 | The owner writes `AGENT-TEAM.md` and the limitations. Peer notes due 2026-11-06 |
| 5c | Recording of agent play, limits stated | Only QA videos made with fixtures (`docs/quests/bald-goddess/recording-*`, S01) and a 10 s Codex smoke video on the archive branch. Neither shows the agent playing the quest. Since S32, `eval:live` records every watched run (`LIVE_RUN.md`, "Recording"); so far only a scripted S1 baseline has been recorded, not model play | S01, S14, S19 | A live recording of model-controlled play (*planned*) |

## Professor-approved exception (as stated by the owner)

- Historical Codex and Claude sessions count as implementation-agent evidence: `docs/agent-sessions/`.
- Two AI agents control Sieg and Coco independently: `packages/agent`.
- A recorded video of the AI agents playtesting the Bald Goddess checkpoint is submitted.
- Existing assistant workflows and new sessions provide the reusable-skill and independent-review evidence.

The owner reports this exception; no written approval is stored in this repository. The submission folder and replacing PR #57 are still open questions for the professor.

## Phase 4 checkpoint (2026-10-27)

This update supersedes the older planned/missing Phase 4 labels in the table above. See `PHASE4_HANDOFF.md` and session [S28](../agent-sessions/28-codex-evaluation-handoff.md).

- **Source of the inherited work:** the ledger, observation-only mode, effort setting, quest knowledge module, quest baseline, harness, CLI and their first tests were written, uncommitted, by Claude session [S23](../agent-sessions/23-claude-gap-analysis-evidence-foundation.md) (`618e460d`), then committed with Codex's repairs in S28. S23 ran no paid call and no player on S4/F.
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

## Phase 4 review and re-review fixes (2026-10-27, S29)

Session [S29](../agent-sessions/29-claude-phase4-review-and-fixes.md) (`ffcdac23`).

- **3d (review):** a read-only review of Phase 4 commits `bc377ee..b612285`, in a Claude session separate from the one that built them. It is not the `rules-reviewer` subagent, and its findings are recorded in S29 (full text in the local transcript), not as a committed review file. Findings: H2-a, H2-b, H1-a high; M1–M5 medium; L1–L7 low.
- **3d (implementation):** the same session then fixed those findings with owner approval: `37f4c66`, `c6761a7`, `f5cf5cf`, `8837f88`, `6bee662` on `midterm/evaluation`, and `b18cd0f` (legacy runner refuses paid policies) on `midterm/agent-interface`. **These fixes have not been independently reviewed.** `session-evidence` was invoked by name in S29; `game-rules-audit` was not.
- **2c / 3b:** held-out scenarios and final seeds are now gated in `AgentEnvironment.reset()` with single-use tickets bound to the approved player kind. The spend ledger has a permanent init marker and a reviewed reconciliation procedure. Paid runs accept only `claude-haiku-5-5` at medium or low.
- **3c:** local `npm run typecheck` and `npm run build` pass; **730/730 tests in 94 files** (with `suite.test.ts` and `route/fullQuest.test.ts` excluded). In `oath_and_ember-agent`: 567/568, the one failure being the pre-existing directional sprint test, reproduced on unmodified `f351278`. Course CI remains separate and unfinished.
- No paid call, ledger initialization, held-out player episode, push, merge or PR.

## Final offline preparation on Node 24 (2026-10-27)

- Pending S29 and same-session supplement [S30](../agent-sessions/30-codex-paid-entrypoint-audit-supplement.md) finalized and registered with the session-evidence procedure; recording and paid-entrypoint audit reports preserved unchanged. No report or artifact deleted for Git cleanliness.
- **3b / 3c:** under Node **v24.19.0**, **74/74 paid-safety, shared-ledger, recovery, metering, model and harness tests** pass in 7 files; typecheck and build pass. No S4/F or route/checkpoint tests run. Build warning: existing Vite bundle size.
- Five broad secret-scan matches verified individually as synthetic false positives, no unexpected matches; scanner/global rules unchanged. Proof: `evidence/phase4/synthetic-canary-verification-2026-10-27.json`. Historical reports keep their original findings.
- Read-only inventory: no canonical ledger/init marker/lock; no legacy ledger/lock in any of four worktrees; no unmetered legacy-runner warning. Active paid launchers use the Git-common shared ledger; archived paid CLI paths are disabled.
- Preparation is complete after the evidence-only local commit and clean-tree check. Paid dispatch remains gated by separate ledger-initialization approval, configured credential and smoke approval. No API call, ledger initialization, gameplay change, push or merge.

## Agent-interface reliability pass (2026-10-27, S31)

Session [S31](../agent-sessions/31-claude-agent-interface-reliability-pass.md) (`47c36046`), implementation commit `5c3de48`, based on the first real-LLM S1 run at `4193424`. That run's trace, results and ledger are unchanged (SHA-256 checked before and after).

- **2b (LLM players):** proposed actions now end as executed, rejected, stale or skipped, and only executed ones become history. Replies use structured JSON output (model and effort allowlist unchanged) and conservative envelope validation, and an unusable reply submits nothing. Reply stop reasons and block metadata are recorded. Prompt text explains state-dependent actions and that keyboard controls are not commands, and suggests agreeing on shared-line ownership by message. Design: `docs/midterm/AGENT_INTERFACE.md`, "Reliability pass".
- **2c (observations):** new `dialogueLog`, holding only the lines that hero's own screen displayed, including lines shown while it waited. A private-line boundary test shows the partner sees only its own screen's text.
- **3b (accounting):** per-hero metrics version 2 (model calls, model decisions, parse failures, submitted, executed, stale, rejected and skipped actions); legacy fields kept, with the documented meaning change for parse failures.
- **3c:** under Node v24.19.0, typecheck and build pass. 778/778 tests in 95 files pass with 4 workers, with `suite.test.ts`, `route/fullQuest.test.ts` and `checkpointFreeze.test.ts` excluded (no S4/F). Earlier full-parallel runs had timeout-only failures. 41 new tests are in `packages/agent/test/reliability.test.ts`. The scripted quest baseline replays S1 seed 0 to identical start and end hashes.
- **Not yet:** no `game-rules-audit` or independent review of `5c3de48`. Structured output has not been tried against the real API. No paid call, S4/F, push or merge.

## Automatic gameplay video recording (2026-10-28, S32)

Session [S32](../agent-sessions/32-claude-eval-live-video-recording.md) (`bf4d982e`). Design and limits: `docs/midterm/LIVE_RUN.md`, "Recording".

- **5c (recording infrastructure, not yet the deliverable):** every watched `eval:live` run records the read-only `/watch` viewer with headless Chromium (Playwright, GPU build) at 1920×1080 into `<run>/recording.webm`, with `<run>/recording.json`. The recorder sends no input; a trusted `ready` hook holds the first action, with game time frozen, until both hero views have drawn. `--no-record` turns it off. Recordings are gitignored. Verified on a free S1 baseline run: the video shows the start state, gameplay and the final "finished: success" screen. 5c still needs a recording of **model** play.
- **5a / 3c (unchanged evaluation):** the recorded S1 seed 0 baseline has start hash `d9b2359a956db64d…`, end hash `7e22d17e885d2cd2…` and 290 ticks, as established. Its semantic trace equals a headless run's. Under Node v24.22.1, typecheck and build pass, and 781/781 tests in 95 files pass with `suite.test.ts`, `route/fullQuest.test.ts` and `checkpointFreeze.test.ts` excluded. 14 new tests are in `packages/agent/test/recorder.test.ts`.
- **Protocol deviation:** two early plain `npm test` runs in S32 included the held-out route tests `suite.test.ts` and `route/fullQuest.test.ts`. No model or paid call was involved, and the outcomes were not inspected or used for implementation or tuning. Details are in the S32 record.
- **Not yet:** no `game-rules-audit recording` run and no independent review of this change. No paid call, push or merge.

## OpenAI provider integration (2026-10-28, S33–S34)

Codex supplement [S33](../agent-sessions/33-codex-openai-provider-supplement.md) (`01a17e49`, uncommitted implementation) and Claude session [S34](../agent-sessions/34-claude-openai-provider-completion.md) (`9e618f25`), implementation commit `b20953e`. Configuration and limits: `MODEL_BUDGET.md`, "OpenAI provider".

- **2b (model players):** owner-approved OpenAI alternative: `gpt-6-luna` at low/medium only, Responses API strict JSON-schema output, same `LLMPlayer`, observations and five operations. Anthropic behaviour unchanged.
- **3b (accounting):** both providers need an open reservation in the canonical shared ledger and a one-use per-call grant before any HTTP request, enforced at the transport (including the Anthropic SDK's own `fetch`). OpenAI prices checked against the public docs on 2026-10-28; settlement uses a 1.1× uplift, and unknown usage, model or tier is charged the full reservation.
- **3c:** under Node v24.22.1, typecheck and build pass; **818/818 tests in 96 files** with `suite.test.ts`, `route/fullQuest.test.ts` and `checkpointFreeze.test.ts` excluded. S1 seed 0 baseline replays to the established hashes and 290 ticks, and its recording works.
- **Not yet:** no OpenAI or Anthropic request (account access, real `service_tier` and cache-usage fields unverified); no `game-rules-audit` run or independent review of `b20953e`. No paid call, ledger change, S4/F, push or merge.

## S2 reliability fixes (2026-10-28, S35)

Session [S35](../agent-sessions/35-claude-s2-reliability-fixes.md) (`1d2c5393`), implementation commit `3f22c66`. Diagnosed from the first real OpenAI S2 run (seed 0, `manual_stop`, records not committed). Design: `AGENT_INTERFACE.md`, "S2 reliability pass"; `LIVE_RUN.md`, "Bounded shutdown"; `MODEL_BUDGET.md`, OpenAI request.

- **2b / 2c (interface and observations):**
  - `StepResult.attack` tells a performed swing or cast from a J press that did nothing; the feedback says only that J was recovering, with no timer.
  - World-change lines (hedge burned, cow moved) are checked per tick against the hero's own camera, with the same rule as `visible`. A test checks the event rule and `visible` agree at every point of a grid.
  - The OpenAI strict schema is split per action type; the action set and `validate()` are unchanged.
  - OpenAI output cap is 2,000; cut-off replies are classified and never repaired.
  - Generic prompt guidance; no new action types.
- **2d (episode limits and records):**
  - The second signal exits in every phase.
  - Recorder waits and the viewer close are bounded.
  - The credential scan is chunked, so it is safe for large videos.
  - Verified end to end with a recorded mock S2 run: a forced exit leaves `recording.json` `failed` with path null.
- **3c:**
  - Under Node v24.22.1: typecheck and build pass; **851/851 tests in 99 files**, with `suite.test.ts`, `route/fullQuest.test.ts` and `checkpointFreeze.test.ts` excluded.
  - Both baselines on S1–S3 seed 0 have identical actions and game-state hashes before and after the change.
- **3d:** a same-session `game-rules-audit` before implementing: `agent-evidence/skill-runs/2026-10-28-adapter-s2-feedback.md`. `session-evidence` produced S35. Neither is an independent review.
- **Review and cleanup:**
  - A `rules-reviewer` subagent reviewed `3f22c66` and `3573d2f`: `agent-evidence/reviews/2026-10-28-s2-reliability-rules-review.md`. It found no blocker. It was spawned by the implementing session, so it is not counted as independent.
  - Owner-approved pre-pilot cleanup in `5234e50`. One Ctrl-C under `npm run eval:live` was being counted twice; this was reproduced and fixed, and subprocess launcher tests were added. Doc, parse-reason, provider-isolation, schema-guard and wording corrections were also made.
  - Under Node v24.22.1: 862/862 offline tests in 99 files (held-out-related files excluded; run in two passes because the machine was heavily loaded); typecheck and build pass. The shared ledger is unchanged.
- **Pilot-5 and the S2 briefing (2026-10-28):**
  - In the owner's paid pilot-5 (ledger `pilot-5`, $0.018614), the party left for Bridge Ruins 2.3 game seconds in. Players had not been told which part of the quest S2 evaluates.
  - Owner-approved S2-only episode briefing in `c296ff4`, audited first: `agent-evidence/skill-runs/2026-10-28-suite-s2-briefing.md`. Logged in the `EVALUATION_SUITE.md` change log; S2 results before and after it are reported separately.
  - Under Node v24.22.1: 871/871 offline tests in 100 files (held-out-related files excluded); typecheck and build pass.
- **Not yet:** no review from a separate reviewer session, and no paid S2 run with the briefing. No S4/F, push or merge.
