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

## Pilot-6 navigation fixes (2026-10-28, S36)

Session [S36](../agent-sessions/36-claude-pilot6-navigation-fixes.md) (`4bd24137`), implementation commit `bdfcf7c`. Diagnosed from the owner's paid pilot-6 (S2 seed 0 OpenAI, ledger `pilot-6`, cap $0.20, charged $0.10357, `manual_stop`; records not committed). Design: `AGENT_INTERFACE.md`, "Pilot-6 fixes"; change log in `EVALUATION_SUITE.md`.

- **2b / 2c (interface and observations):**
  - `StepResult.movement` reports full, partial or no movement against the open-ground distance (shared `stepMovement` replayed on a copy). A short move adds one line that never names the obstacle.
  - The cow is a neutral "cow"; its sign is fixed where `HedgeMazeView` draws it.
  - `self` is truncated to two decimals so it matches the `@` cell; the prompt has a legend for cells and the body footprint.
  - S2 briefing second revision (draft wording, pending the owner); a general communication line for every scenario and provider.
  - The lane-cleared sound was investigated and left unchanged (owner default: visible only).
- **3c:**
  - Under Node v24.19.0: typecheck and build pass; `npm test` 898/899. The one failure is a timeout in `apps/server/test/mirrorPondWalkthrough.test.ts` that also occurred before the change; that file passes alone.
  - New `packages/agent/test/pilot6Fixes.test.ts`: 16/16.
  - The scripted route (seed 1: 12,412 ticks, same end hash) and both baselines on S1–S3 seed 0 have identical actions and game-state hashes before and after. This needed the scripted players to round `self` back to one decimal (`asTuned`), which awaits the owner's confirmation.
- **3d:** a same-session `game-rules-audit` before implementing: `agent-evidence/skill-runs/2026-10-28-adapter-pilot6-fixes.md`. `session-evidence` produced S36. Neither is an independent review.
- **Review and follow-up (2026-10-28):**
  - A `rules-reviewer` subagent ran in a fresh context on `bdfcf7c` and `fc685e8`: `agent-evidence/reviews/2026-10-28-pilot6-fixes-rules-review.md` (12 findings, highest Medium). It was spawned by the implementing session, so it is **not counted as independent**.
  - Verification, process deviation, timeout analysis and the audible-chime proposal: `agent-evidence/2026-10-28-pilot6-review-followup.md`.
  - Review finding 1 is confirmed: a false `partial` when Slow Time starts during a partner's move. Not yet fixed.
  - Process deviation: `asTuned` was implemented past the audit's stop point without first asking; it was disclosed at the time and is now provisionally accepted by the owner.
- **Review fixes (2026-10-28), commit `f48ae0e`:**
  - Audit before implementing: `agent-evidence/skill-runs/2026-10-28-adapter-pilot6-review-fixes.md`.
  - Moves are measured only over ticks the server moved the hero by that input, at the Slow Time state actually used. Not-applied and game-moved ticks are reported separately. The confirmed Slow Time false collision is fixed.
  - `truncate2` rounding guard removed after a property test showed scripted-rounding differences on positions reached by walking.
  - **3c:** under Node v24.19.0, typecheck and build pass; `npm test` 921/921 in 107 files. New `pilot6ReviewFixes.test.ts`, `asTuned.test.ts`, and `scriptedFreeze.test.ts` (scripted actions and state hashes pinned to `7bd0c7e`).
- **Not yet:** no review from a separate reviewer session, and no paid S2 run with the briefing. No S4/F, push or merge.

## Independent review of the pilot-6 changes (2026-10-28, S37)

Session [S37](../agent-sessions/37-claude-independent-review-pilot6.md) (`130b0cd4`) is a separate session started by the owner. It did not write the code, was not spawned by the implementing session and was not asked to approve. Report: `agent-evidence/reviews/2026-10-28-pilot6-independent-review.md`.

- **3d:** independent review of `bdfcf7c` and `f48ae0e`: 8 findings, the highest Medium.
- **2b / 2c (findings):**
  - False collision line on a 1-tick open-ground move under Slow Time (new).
  - Silent lethal respawn (pre-existing; the reviewer recommends fixing it before the next paid S2/S3 run, owner decision).
  - Listed coordinates of other things can disagree with their grid cell.
  - Carry path untested in the repository, though reproduced offline.
- **3c:** under Node v26.9.0, typecheck and build pass; `npm test` 921/921 in 107 files. `scriptedFreeze` passes 7/7 against an extract of `7bd0c7e`, which confirms the pinned scripted fingerprints are the pre-change behaviour.
- **Not done:** no code change, model call, S4/F, commit, push or merge. Owner decisions on the findings are pending.


## Additive local-start tuning variants (2026-10-28)

- Implementation `115c542`: S2-local and S3-local only. Protocol, immutable-start hashes, test selection/results and concurrent-session limitation: [LOCAL_STARTS.md](LOCAL_STARTS.md).
- Pre-implementation [game-rules-audit](agent-evidence/skill-runs/2026-10-28-suite-local-starts-preflight.md): no further approval requirement; same-session implementer audit.
- [S38 evidence supplement](../agent-sessions/38-codex-local-starts-supplement.md): same session as S28/S30/S33, not another distinct session or independent review. No paid or held-out execution.

## Independent-review fixes (2026-10-28, S36)

Session [S36](../agent-sessions/36-claude-pilot6-navigation-fixes.md) (`4bd24137`), implementation commit `3c893f3`, for the findings of [S37](../agent-sessions/37-claude-independent-review-pilot6.md), whose review was committed unchanged in `fb844ae`. Design: `AGENT_INTERFACE.md`, "Independent-review fixes".

- **Audit:** same-session `game-rules-audit` before implementing: `agent-evidence/skill-runs/2026-10-28-adapter-independent-review-fixes.md`. Not an independent review.
- **2b / 2c:**
  - short moves are no longer falsely blocked;
  - lethal hits are reported as a neutral line (not an interruption: interrupting changed the frozen scripted runs; owner decision pending);
  - listed moving things use the same truncation as `self`;
  - story-walk ticks are not counted as walking;
  - the carry record is checked at reset.
- **3c:** Node v24.19.0, clean worktree at `115c542` with this change's files only. Typecheck and build pass. `npm test` 948/950; the 2 failures are pre-existing in `suite.test.ts` at `115c542`. `scriptedFreeze` 7/7.
- **Evidence:** the guidelines' example URL is no longer listed as a PR; the `explore/S2` and `explore/S3` pins are one trajectory.



## Combined local-start and observation integration (2026-10-28)

[Integration verification](INTEGRATION_VERIFICATION.md): combined approved commits present, Node v24.19.0 typecheck/build pass; 916 broad permitted tests plus 2 static suite checks and 6 historical S1–S3 freeze checks pass. Twenty supplemental observation cases and four synthetic accounting runs pass. Test-only expectation correction: `c35f6c5`. [Audit](agent-evidence/skill-runs/2026-10-28-suite-combined-integration.md); [same-session S38 supplement](../agent-sessions/38-codex-local-starts-supplement.md). Held-out-capable cases excluded explicitly; no paid or held-out execution.

## Pilot-7 observation and prompt fixes (2026-10-28)

[PILOT7_FIXES.md](PILOT7_FIXES.md): owner-approved after the pilot-7 diagnosis (S2-local, seed 0, ledger `pilot-7`). Implementation `5ab4693`:
- spike columns drawn and listed at full height;
- Mirror Pond painted text listed as labels;
- "You pressed E; nothing responded." for presses that change nothing;
- general communication rules in the prompt.

The shared `explore/S2`/`explore/S3` freeze entry was re-pinned with owner approval. Cause: a painted label hid the wall cell at (45,23). The first divergence is at decision 214. The old values are recorded and reproduced. No other pin changed. Results: 12/12 new tests, 202/202 focused tests, 6/6 S1–S3 freeze checks, typecheck and build pass. No paid, held-out or full-suite run.

## Suite revision 2: S2/S3 swap, manual and tutorial knowledge (2026-10-28)

- **5a:** S2 is now Hedge Maze (Enchanted Shears) and S3 Mirror Pond (Vanity Mirror); S2-local/S3-local likewise. Revision 1 definitions are kept as S2-v1, S3-v1, S2-local-v1 and S3-local-v1. **Every record above this section, including `evidence/phase4/quest-tuning-summary.json` and pilots 4–7, uses revision 1 ids ("S2" = Mirror Pond).** Record: [SUITE_REVISION2.md](SUITE_REVISION2.md); change log in `EVALUATION_SUITE.md`.
- **2b / 2c:** both heroes receive the verbatim player manual and, in the revised S2/S3 and local starts, a tutorial-completion briefing (`packages/agent/src/playerKnowledge.ts`, tests `packages/agent/test/playerKnowledge.test.ts`). Non-player-facing manual files are excluded.
- **3d:** same-session `game-rules-audit` checkpoint `agent-evidence/skill-runs/2026-10-28-suite-revision2-tutorial.md`. It is not an independent review.
- **3d (session):** implementation session [S39](../agent-sessions/39-claude-suite-revision2-tutorial.md) (`a209a67a`). It invoked `game-rules-audit` and `session-evidence`. Owner decisions (approved S2 briefing, no revision 2 pins, `-v1` ids scripted-only, Flight wording, S2-local cost estimate) are in `SUITE_REVISION2.md` and `MODEL_BUDGET.md`.

## Pilot-9 fixes (2026-10-29)

- **2c:** Hedge Maze captions as labels; the cow's full footprint and extent; Push movement and object feedback. Implementation `a3b19ad`, tests `packages/agent/test/pilot9Fixes.test.ts`, record [PILOT9_FIXES.md](PILOT9_FIXES.md).
- **5a:** all 14 permitted scripted trajectories are identical before and after, with no re-pin. Model results before and after `a3b19ad` are reported separately (change log in `EVALUATION_SUITE.md`).
- **5c:** a recording-finalization finding and a proposed fix (not implemented) in `PILOT9_FIXES.md`.

## Pilot-10 diagnosis (2026-10-29)

- **2b / 2c:** read-only diagnosis of pilot-10 (S2-local, seed 0, manual stop): per-call context and memory limits, the cow-passage visibility timeline, the stale dry-hedge request, the unwalked northern corridor, and proposed observation and memory fixes with risks (none implemented). Record: [PILOT10_DIAGNOSIS.md](PILOT10_DIAGNOSIS.md).
- **3d (session):** implementation session [S40](../agent-sessions/40-claude-pilot10-diagnosis.md) (`ce758032`), documentation only. It invoked `session-evidence`. Not an independent review.


## Instruction-guided Maze baseline (2026-10-29)

Implementation `3b7115b`: explicitly solution-informed model-guided, current revision 2 S2-local only. [Guide, validation and future pilot command](GUIDED_MAZE_BASELINE.md); [preflight audit](agent-evidence/skill-runs/2026-10-29-guided-maze-preflight.md); [checkpoint](agent-evidence/skill-runs/2026-10-29-guided-maze-checkpoint.md); [S41 same-session supplement](../agent-sessions/41-codex-guided-maze-supplement.md). 201 distinct targeted offline cases and Node 24.19.0 typecheck/build pass. Scripted Maze proof is not an LLM result. No paid or held-out execution; existing policies/prompts, scenarios, pins and gameplay unchanged.


## Persistent memory player (2026-10-29)

`model-memory` (Workstream B, after the pilot-10 diagnosis): [design, schema, comparison, tests and proposed pilot](MODEL_MEMORY.md); tests in `packages/agent/test/modelMemory.test.ts` (27). Existing `model-history` and `model-obs-only` prompts are pinned unchanged. The 6 permitted frozen baseline pins and 8 revision 2 baseline trajectories are identical before and after. No paid or held-out execution. Audit: [`2026-10-29-adapter-model-memory.md`](agent-evidence/skill-runs/2026-10-29-adapter-model-memory.md) (same session, not independent). Session record: [S42](../agent-sessions/42-claude-model-memory.md).

`model-centralized` (owner request 2026-11-05): one LLM planner controls both heroes through separate legal controllers; there is no messaging. It is its own tuning-only player kind, reported separately from the two-agent players. [Design, tests, call-count estimate and limitations](MODEL_CENTRALIZED.md); tests in `packages/agent/test/centralized.test.ts` (17), including real-play checks on S2-local and S2-C seed 0. No paid or held-out execution.

## 2026-10-29 recorder shutdown evidence (S43)

Supports 3c/3d/5c: [S43 session record](../agent-sessions/43-codex-recorder-shutdown.md), [same-session recording audit](agent-evidence/skill-runs/2026-10-29-recording-shutdown.md), and [recording lifecycle](LIVE_RUN.md#2026-10-29-shutdown-diagnostics-and-viewer-lifetime). Final recorder tests: 25/25 pass. Offline S1 baseline video: 42.76 s, 1280x720, 3,723,034 bytes; playback verified, headless/recorded end hashes match. This is a scripted baseline verification, not a recovered Pilot-11/12 model recording or independent review. No paid call, held-out run, historical trace write or commit.

## Hedge Maze submission evidence (2026-10-29)

This section supersedes the 4b, 5a and 5c rows above for the submission. The owner directed on 2026-10-29 that S2-local, the Hedge Maze, be the primary evaluated episode. No professor approval of that narrowing is recorded. Gaps and status: [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md).

| Check | Evidence |
| --- | --- |
| 4b | Solution-aware scripted reference `baseline-quest`: success on S2-local, reproduced four times with one end hash. Walkthrough-guided `model-guided` and unaided `model-memory` on the same start hash. `midterms/saadsatter/EVALUATION.md`, "Hedge Maze results" |
| 5a | The comparison table with outcomes, invalid actions, limits, latency, tokens, dated cost, git hashes and failures. Every value is checked against `summary.json` by `scripts/midterm/collect_evidence.py`. The manifest with SHA-256 checksums is in `midterms/saadsatter/evidence/manifests/`. Missing: held-out cases, three situations, the observation-only player |
| 5c | Live: the scripted baseline (not an LLM) and pilot 15 (`model-memory`, about 19 min). Replays verified against their traces: pilots 11, 12 and 13. Delivery and caveats: `midterms/saadsatter/evidence/README.md` |

## Situation A, S2-A Full Hedge Maze (2026-10-29)

Supports 3b, 3c and 5a (partially). [SITUATION_A.md](SITUATION_A.md) freezes the Hedge Maze episode as S2-A, a label for S2-local with a pinned definition hash. `packages/agent/test/situationA.test.ts` (24 tests) covers:
- the reset state at seeds 0 and 1;
- reset determinism;
- the information boundary over a full baseline episode;
- legal actions;
- baseline completion matching the committed live trace per hero;
- terminal reporting;
- replay compatibility of the committed S2-local traces.

`scripts/midterm/situation-a.ts --baseline` is the free reproduction. Situations B and C are proposals only. The three-situation and held-out gaps remain.

## Hedge Maze Situations B and C (2026-10-29)

Supports 3c, 4b and 5a (partially). [HEDGE_MAZE_SITUATIONS.md](HEDGE_MAZE_SITUATIONS.md) records:
- the B and C definitions and checkpoint provenance;
- the start hashes;
- the baseline results;
- the trial matrix and budget estimate.

`packages/agent/test/hedgeMazeSituations.test.ts` (30 tests) covers:
- provenance and re-derivation;
- start hashes equal to the recorded world at the cut;
- repeatable resets;
- reachability by replaying the rest of the recording;
- baseline results on B and C;
- the information boundary;
- illegal actions;
- tick limits;
- the same start for scripted and model players.

The free reproduction is `scripts/midterm/hedge-maze-situations.ts --baseline`. No live trials have been run; the held-out gap remains.

## P1 "Into the Forest", the Prologue situation (2026-11-03)

| Check | Evidence |
| --- | --- |
| 2a bounded episode | `P1` in `packages/agent/src/{suite,evaluator}.ts`: start at the game's `prologue` checkpoint; success when the authoritative stage reaches `WOODS` |
| 2c observation boundary | `perception.ts` `prologueProps` and `actions.ts` `localTalk`. Tests in `packages/agent/test/prologueSituation.test.ts` cover no flags, stage or scene ids, HUD lines or future dialogue over a whole episode; the cart unsignposted; inner narration only to its hero |
| 3b limits | `episodes.P1` and `EPISODE_CAP_USD.P1`. Tick and decision limits are tested |
| 4b baseline | `baseline-quest` with the disclosed `PROLOGUE` route (`policies/questKnowledge.ts`). Evidence in `docs/midterm/evidence/p1-baseline/` |
| 5a freeze | `prologueSituation.ts`, definition hash `baa6b04b…73ac` (pinned); system prompts pinned |
| Record | [PROLOGUE_SITUATION.md](PROLOGUE_SITUATION.md); design: [PROLOGUE_SITUATION_PROPOSAL.md](PROLOGUE_SITUATION_PROPOSAL.md) |

### P1 revision 2 (2026-11-03)

| Check | Evidence |
| --- | --- |
| 2b/2c prompt and observation fixes | `NEUTRAL_TASK` (`playerKnowledge.ts`) via `suite.ts` `task`; `perception.ts` `viewRect` (house camera) and `GARDEN_GATEWAY`; tests in `prologueSituation.test.ts` ("P1 revision 2 observation fixes", F1, F6) |
| 3b wall clock | `harness.ts` `WALL_CLOCK_CEILING_S`, `checkWallSeconds` (tested) |
| 5a freeze | Revision 2 hash `7dfac8cd…a655` pinned; revision 1 `baa6b04b…73ac` kept verbatim and pinned |
| 4b baseline | `docs/midterm/evidence/p1-v2-baseline/` |

### P1 revision 3 (2026-11-03)

| Check | Evidence |
| --- | --- |
| 2c observation | `perception.ts` (`gap in garden fence`); the focused test "revision 3: the opening is 'gap in garden fence' …" in `prologueSituation.test.ts` |
| 5a freeze | Revision 3 hash `05a2e744…61aa`. Revisions 1 (`baa6b04b…`) and 2 (`7dfac8cd…`) are kept verbatim and pinned. `promptFreeze.test.ts` pins the tutorial and S2-A prompts |
| 4b baseline | `docs/midterm/evidence/p1-v3-baseline/` |

Supports 2a/3c/3d/5a: [S44 session record](../agent-sessions/44-claude-cow-posts-repin.md). The owner's game change `ffbdecb` (cow posts, griffin 640 HP, story lines) and the owner-chosen new revision of the frozen evaluation values (`ab70771`): S2-A v2, S2-B/S2-C v2, P1 revision 4, re-pinned scripted-player fingerprints; change log in [EVALUATION_SUITE.md](EVALUATION_SUITE.md#2026-11-04-change-log-game-change-ffbdecb-cow-posts-griffin-hp-story-lines). New offline scripted evidence: `midterms/saadsatter/evidence/traces/baseline-quest-S2-local-seed0-v2/`, [`evidence/p1-v4-baseline/`](evidence/p1-v4-baseline/README.md). Agent tests 599/600 (the failing `s2Shutdown` test also failed before the change). No paid call, model run or live recording. Not independent review.


## Pilot-28 centralized policy fixes (2026-11-05)

Supports 2b/2c/3b/3c/3d and recording evidence only: [S47](../agent-sessions/47-codex-pilot28-fixes.md), [same-session audit and verification](agent-evidence/skill-runs/2026-11-05-adapter-pilot28-fixes.md), and [metadata](evidence/pilot28-fixes/). Cumulative per-hero inactivity survives renewed waits/holds; visible-body pull obstruction and radius-edge uncertainty are observation-derived; completion facts require observed evidence IDs; the evaluation objective is separate from the journal. The deterministic S2-local baseline still succeeds with pinned end hash `6644f2ca…`. The mock recording decodes and visibly includes the corrected `finished: manual_stop · 15.2 s` tail. This is not a new live-model success, an independent review, or a re-freeze. No paid calls, held-out execution, push or merge.

## Pilot-30: original registration history (classification superseded below)

Supports 2b/3b/3d/5a/5c: [S48](../agent-sessions/48-claude-pilot30-situation-a.md), [PILOT30_AUDIT.md](PILOT30_AUDIT.md), [evaluation record](evaluation-abc/A-pretuned-pilot30.json), [A/B/C matrix](EVALUATION_ABC_MATRIX.md), and the byte-for-byte evidence in `midterms/saadsatter/evidence/traces/pilot-30-model-centralized-S2-local-seed0/`. First model-driven Hedge Maze success: `model-centralized`, `gpt-6-luna` medium, S2-A v2 seed 0, 89.5 game-s, 167 calls, $0.443258 (runner estimate), 2 invalid actions. Trace chain, offline replay at `040685c`, Situation A identity and a full video decode were checked in this session. One pilot trial of a tuning case, not held out; "pre-tuned" means before explicit solution prompt tuning. The 202 MB live video is not committed. No paid call, model run, push or merge in the audit.

## Pilot-30 planning revision — unprepared/prepared Griffin trials

[Preservation recheck](evaluation-abc/PILOT30_PRESERVATION_RECHECK.json) confirms original seven files/local video and existing A pre-tuned registration unchanged. [Audit §7](PILOT30_AUDIT.md#7-preservation-recheck-and-revised-evaluation-planning-codex-2026-11-06), [revised matrix](EVALUATION_ABC_MATRIX.md), [separate Griffin proposal](GRIFFIN_EVALUATION_FEASIBILITY.md), [same-session rule audit](agent-evidence/skill-runs/2026-11-06-suite-griffin-proposal.md), [S47 supplement](../agent-sessions/47-codex-pilot28-fixes.md). New B/C are proposals only: strict defeat versus peaceful tool resolution needs approval; baseline implementation TBD; C reserved from model-outcome tuning. No new episode, code change or course-completion claim.

## Declared A/B/C suite and current course evaluation report (2026-11-06)

[Declared design r1](DECLARED_EVALUATION_SUITE.md), [manifest](evaluation-abc/declaration.json), [18-row allocation/results](evaluation-abc/declared-results.json), `midterms/saadsatter/EVALUATION.md`, [same-session audit](agent-evidence/skill-runs/2026-11-06-suite-declaration.md), [S47 supplement](../agent-sessions/47-codex-pilot28-fixes.md). Declaration/reporting preparation for 5a is complete; runtime B/C certification and repeated outcomes are not. One historical Pilot-30 row only; A unchanged. Existing baseline selected, C held out from model-outcome tuning. Memory ablation, short recording, human playtest/personal reflection, latest-green CI and final course hand-in still pending.

## Pilot-30 classification correction (owner, 2026-11-06)

The owner confirms Pilot-30 is a **post-tuned model-driven completion**. This supersedes earlier pre-tuned/pre-solution-tuning labels above and in historical session records. [Declaration revision 2](evaluation-abc/declaration.json), [active A/post-tuned/1 registration](evaluation-abc/A-posttuned-pilot30.json), and the current course evaluation report use the corrected allocation. The original mistaken metadata and revision 1 are archived under `evaluation-abc/history/`. No raw trace, video, scenario, policy hash, metric or outcome changed. Exact tuning intervention remains undocumented; no A pre-tuned completion is registered. No new episode or paid call was made.

Pilot-28 is now owner-designated historical **A/pre-tuned/1**, manual-stop failure at the cow. Declaration r3 and `docs/midterm/evaluation-abc/A-pretuned-pilot28.json` record 125.267 game seconds (owner recalled approximately 128), 900.8 wall seconds; Pilot-30 remains post-tuned. Two observed historical rows /16 unrun. This supersedes earlier no-pre-tuned-trial statements. No new episode, raw evidence change or paid call.

## Situation A pre/post-tuned allocation and prompt tuning (declaration r4, 2026-11-06)

Supports 5a/5c: [S48](../agent-sessions/48-claude-pilot30-situation-a.md), [A_PROMPT_TUNING.md](A_PROMPT_TUNING.md), records [A/pre/1 Pilot-28](evaluation-abc/A-pretuned-pilot28.json), [A/pre/2 Pilot-29](evaluation-abc/A-pretuned-pilot29.json), [A/post/1 Pilot-30](evaluation-abc/A-posttuned-pilot30.json), and byte-for-byte evidence in `midterms/saadsatter/evidence/traces/pilot-{28,29}-model-centralized-S2-local-seed0/`. Pre-tuned 0/2 (both owner manual stops at the cow), post-tuned 1/1. The planner prompt diffs were read from source at `678b86c`, `327c34a` and `040685c`; controller code changed in the same commits, which is disclosed. Trace chains and offline replays verified for both pre-tuned runs. Historical pilots, not preregistered or held out. No paid call or model run.

## Declaration r5: one run per cell; Situation A complete (2026-11-06)

Supports 4b/5a: owner decision to run one pre-tuned, one post-tuned and one baseline run per situation ([DECLARED_EVALUATION_SUITE.md](DECLARED_EVALUATION_SUITE.md#revision-5-allocation-2026-11-06)). A: Pilot-28 pre-tuned (manual stop), Pilot-30 post-tuned (success), `baseline-quest` (success, 52.1 game-s, $0; [record](evaluation-abc/A-baseline-quest.json), evidence `midterms/saadsatter/evidence/traces/baseline-quest-A-cheap-baseline-S2-local-seed0/`, run twice with identical actions and the pinned end hash). Pilot-29 is supplementary ([record](evaluation-abc/A-supplementary-pilot29.json)). The r4 entry above is superseded where it calls Pilot-29 a pre-tuned trial. Session [S48](../agent-sessions/48-claude-pilot30-situation-a.md). No paid call.

## Situation B, Griffin Trial (Unprepared) certification (2026-11-06)

Supports 2a/2c/3b/3c/5a: [SITUATION_B_GRIFFIN.md](SITUATION_B_GRIFFIN.md) defines `griffin-unprepared-v1` (definition `bbbbc435…1374`, seed 0 start `1a270d7b…0051`, tick 439), reached by ordinary north travel. Strict success: Griffin HP 0 and the shared wig; new terminal reasons `knocked_out` and `left_area`. [Offline certification evidence](evidence/situation-b-certification/summary.json): a scripted, solution-aware witness (not a baseline) succeeds in 65.5 game-s with 0 invalid actions and 0 knockouts; the unchanged `baseline-quest` ends `knocked_out` at 10.6 s. `packages/agent/test/griffinSituationB.test.ts` (16 tests) covers resets, start state, predicates, failures through real play, the witness, the new Griffin warning observations and the pre/post-tuned prompt mechanism. Mock-only live rehearsals; no paid call, model episode, push or merge. Not independent review.

Situation B review round 1 (supports 3d/2c): `rules-reviewer` report [2026-11-06-situation-b-rules-review.md](agent-evidence/reviews/2026-11-06-situation-b-rules-review.md); `game-rules-audit griffin` [2026-11-06-griffin.md](agent-evidence/skill-runs/2026-11-06-griffin.md) (same session as the implementation, not independent); responses in [SITUATION_B_GRIFFIN.md](SITUATION_B_GRIFFIN.md#responses-to-the-independent-review-and-the-audit); session record [S49](../agent-sessions/49-claude-situation-b-griffin.md).

## Situation B integration and pre-run preparation (2026-11-06)

Supports 2c/3b/5a: Situation B merged into the r5 evaluation branch (`b1253bb`; both sides' index entries kept, no A evidence changed). Owner-approved short-beam observation fix (`3b9eb7b`): no "griffin beam" entry while the beam is 20 px or shorter, as the client draws none; the warning line is unchanged. Owner decisions, checks and the ledger state: [SITUATION_B_GRIFFIN.md, last section](SITUATION_B_GRIFFIN.md#owner-decisions-and-pre-run-preparation-2026-11-06). Typecheck and build pass; 1,288/1,289 tests pass (the one failure predates the merge). Free mock smoke only. Post-tuned guidance stays locked; `baseline-combat-v1` approved for development, not implemented. No paid call, push or merge to `main`.

Owner-requested integration into oath_and_ember-eval: both deterministic heuristic players, separate Griffin return scenario, live launcher support and byte-identical source evidence are now in this checkout. Native reviewed griffin-unprepared-v1 definition/preparation and native nine-cell plan preserved. 78/78 targeted tests, typecheck and build pass; A live CLI reproduces success/end hash 1287b39e…, B CLI regression reproduces a4541450…. Four primary cells observed/five unrun; second baseline runs supplementary. No paid calls, push, merge or gameplay change. Evidence: docs/midterm/evidence/eval-baseline-integration/verification.json. Same-session audit is not independent review.

## Owner-recorded A/B heuristic videos

Owner recorded live A/B heuristic runs at clean 4c9cf9f. Linked both original local recording.webm/recording.json/summary files in course EVALUATION.md and preserved metadata plus SHA256 manifest at docs/midterm/evidence/baseline-live-recordings/. Both saved, speed 1, successful, 31.5/89.8 game-s, zero model calls and invalid actions. Video bytes/hashes and recorded outcomes checked; no full decode or independent terminal-frame inspection claimed. Videos were neither modified, committed nor uploaded. Changed artifact/doc secret scan: 6 files, 0 findings. No new gameplay or paid run.

## Situation B pre-tuned run: Pilot-31 (2026-11-06)

Supports 2b/3b/5a/5c: owner-launched paid run at `6df4bc0`, `model-centralized` `gpt-6-luna` medium, Pilot-30's generic planner without guidance (prompt `cbabb78b…`). `knocked_out` at 50.1 game-s, Griffin at 152/640, 117 calls, $0.265961. Byte-for-byte evidence and SHA-256 values in `midterms/saadsatter/evidence/traces/pilot-31-model-centralized-griffin-unprepared-v1-seed0/`; trace chain and offline replay at `6df4bc0` verified. Registered as B/pre-tuned/1 by owner decision ([record](evaluation-abc/B-pretuned-pilot31.json)) although it ran on `griffin-unprepared-v1`, not r6's return checkpoint; disclosed in the record, the matrix and `EVALUATION.md`. The 139 MB video is local only.

## Situation B post-tuned candidate: `b-post-a-transfer-v1` (2026-11-06)

Supports 4a/4b (pre-registration of the post-tuned prompt): prompt-only guidance built from the Situation A heuristic baseline's general mechanisms (`mazeHeuristic.ts`), appended to Pilot-31's unchanged prompt. Text SHA-256 `60a0a013…5263`, full prompt `54605c1b…5627`, controller `f0592888`, scenario `griffin-unprepared-v1` only. Status `proposed`: paid runs refuse it until the owner approves the hash. Written after Pilot-31 was read, so disclosed as tuning on B, not an independent transfer test. Record, per-line provenance and the one prepared command: [B_POST_TUNING_TRANSFER.md](B_POST_TUNING_TRANSFER.md). Tests: `packages/agent/test/bPostTransferGuidance.test.ts`. Free mock smoke only; no paid run.

## Situation B post-tuning, observation parity and declaration r7 (2026-11-06)

Supports 2b/3b/4a/4b/5c. Session record: [docs/agent-sessions/50-claude-b-post-tuning.md](../agent-sessions/50-claude-b-post-tuning.md). Independent review of `6276656`: [agent-evidence/reviews/2026-11-06-b-post-transfer-rules-review.md](agent-evidence/reviews/2026-11-06-b-post-transfer-rules-review.md); responses in [B_POST_TUNING_TRANSFER.md](B_POST_TUNING_TRANSFER.md) §7. Observation parity with Pilot-31 for `griffin-unprepared-v1` (293/293 observations, 284/284 step hashes): `packages/agent/test/griffinObservationParity.test.ts`. Declaration r7 (`b39116b3…`) briefly made `griffin-unprepared-v1` the B scenario; by owner decision r8 (`14525a12…`) returns B to `griffin-unprepared-return-v1`, where B post-tuned (guidance owner-approved, prompt `17b89312…`) will run; r6 and r7 archived in `evaluation-abc/history/`. B pre and post are on different scenarios, disclosed. Post-tuned run prepared, not run.


## Pilot-33 post-tuned B preservation

Pilot-33 owner-requested preservation: seven source files copied byte-for-byte; trace/model replies/policy notes and video metadata preserved, video untouched/local-only. Existing offline replay verifies all 443 results, original start/end and 3057 ticks. Full video decode exit 0, 2188.88 s; 1x1 PNG SAR warning separated from decode errors. Inspected terminal frame shows finished success and Chapter 0 milestones. Owner registers Pilot-33/v4 as B post-tuned primary after outcome; r9 archives r8, failed Pilot-32/v1 preserved and disclosed, no erased failures. 51.0 game-s, 2184.4 wall-s, 251 calls, 1 invalid, 5 unusable replies, $0.554417 saved runner estimate. Nine primary rows /six observed; C three rows unrun. Changed artifact scan: 13 files, 0 findings. No new paid call or gameplay/policy/scenario edit. Same-session audit, not independent review. Links: midterms/saadsatter/EVALUATION.md; docs/midterm/evaluation-abc/B-posttuned-pilot33.json; docs/midterm/agent-evidence/skill-runs/2026-11-06-pilot33-preservation.md.
