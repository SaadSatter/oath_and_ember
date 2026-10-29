# Requirements checklist

Maps every rubric check in `docs/midterm/MIDTERM_GUIDELINES.md` to its deliverable, its verification and its status. The statuses are:

- **done**: the evidence exists and is linked;
- **partial**;
- **todo**;
- **at risk**: still todo and likely to slip;
- **owner**: the owner's own work.

Evidence pointers are in `docs/midterm/EVIDENCE_INDEX.md`. Updated 2026-10-27, after phase 2 (server changes, runner budget, information boundary).

## Rubric checks

| Check | Deliverable | Verification | Status |
| --- | --- | --- | --- |
| 1a | `docs/midterm/RULE_SOURCE_MAP.md`: every episode rule labelled code/manual/observed/assumed/design with locators; links to D1–D11 | `game-rules-audit` on shrine, pond, maze and griffin | partial: D1–D11 exist; no rule map for the episode |
| 1b | README scope statement: episode bounds, exclusions (village, prologue, airship, campaign), adaptations | Reviewer; playtest | partial: bounds decided (S17, S22); README todo; course PR on hold for the professor |
| 1c | README "Sources and terms" quoting each license or term | Reviewer; `scan_secrets.py`; asset provenance files | partial: provenance files exist; terms not consolidated |
| 2a | Scripted route `goddess` → `chapter0.complete` through interface actions only; a human playthrough | Route test in CI; trace committed | partial: **route done (2026-10-27)**. `packages/agent/test/route/fullQuest.test.ts` reaches success at tick 12,412 with 0 invalid actions, is deterministic, and verifiably uses only the interface. Evidence in `docs/midterm/evidence/route/seed1/`, log in `docs/midterm/ROUTE_LOG.md`. **Human playthrough: the owner reports completing the full episode through normal gameplay** (`docs/midterm/playtests/2026-10-27-owner-full-episode.md`; owner-reported, no recording or trace). Route not yet in CI |
| 2b | LLM players (Sieg and Coco) with no tools; fallbacks labelled | Fake-model tests; live traces | partial: adapter done and tested offline; batching of up to 4 actions (`batch.test.ts`); prices verified 2026-10-27; budget proposal `docs/midterm/MODEL_BUDGET.md` awaiting approval; no live run |
| 2c | Per-role observations and leak-free legal actions, matching what a human player sees | Leak tests; `game-rules-audit adapter` | partial: signs and labels as drawn, HUD goal lines hidden (documented restriction), partner/enemy health as an eighths bar, departed griffin no longer listed; tests in `packages/agent/test/{environment,perception}.test.ts`. Independent review todo |
| 3a | README commands from `midterms/saadsatter/` on a fresh clone | Fresh-clone rehearsal recorded in `EVALUATION.md` | todo |
| 3b | Step, call, token, spend, per-call timeout and wall-clock limits; failed calls counted; explicit terminal reasons | Runner tests | partial: central `ModelBudget` (every attempted call counted, exact per-hero cap, 30 s configurable timeout, SDK retries off, token cap, one episode spend cap, unknown usage marked), game-time `tick_limit` separate from `wall_clock_limit`; 13 tests in `packages/agent/test/budget.test.ts`. No live run yet |
| 3c | Course workflow covering invariants, legal/illegal actions, terminal outcome, an observed regression, and limits | Green run on the course PR | todo: no course workflow yet. The full suite is green (589/589, 2026-10-27); the sprint-frame expectation was outdated and fixed, with no gameplay change |
| 3d | `CLAUDE.md`; skills `game-rules-audit` and `session-evidence`, each invoked in two fresh sessions; independent Claude and Codex reviews | Skill reports in `docs/midterm/agent-evidence/skill-runs/`; reviews as PR comments and in `agent-evidence/reviews/`; session records in `docs/agent-sessions/` | partial: configuration and historical evidence done (`docs/agent-sessions/`, files 00–26). `game-rules-audit` has two recorded invocations in separate fresh sessions ([S24](../agent-sessions/24-claude-skill-game-rules-audit-adapter.md), [S26](../agent-sessions/26-claude-skill-game-rules-audit-server-changes.md)). `session-evidence` has one recorded ([S25](../agent-sessions/25-claude-skill-session-evidence-first.md)); its second invocation (`83ac1132`) ran but is not yet recorded. Independent reviews todo |
| 4a | Choices with the alternative each beat (vocabulary, baseline, memory, suite, recording) | Reviewer | partial |
| 4b | Quest-aware two-player scripted baseline, plus the exploration baseline as secondary | Baseline results on the frozen suite | todo: plan written (`docs/midterm/BASELINE_PLAN.md`), awaiting owner approval |
| 5a | `docs/midterm/EVALUATION_SUITE.md` frozen before tuning; `EVALUATION.md` table with every field, failures included | `git log` of the suite file; `game-rules-audit suite` | partial: **suite frozen 2026-10-27, provisional** (owner-approved; professor confirmation pending). S1–S3 tuning, S4 and F held out; start states reached by real play (`suite.ts`, `suite.test.ts`). No results yet |
| 5b | `AGENT-TEAM.md`, limitations, peer notes | — | owner |
| 5c | 3–5 min recording of live model play with on-screen actions and stated limits | `game-rules-audit recording` | todo |

## Owner decisions in force (2026-10-27)

- **Server changes.** Approved: deterministic clock and id injection, the `manualDriver` option, and server-enforced view-only browser sessions. Production behaviour is the default. Equivalence and integration tests are required (`docs/midterm/SERVER_CHANGES.md`).
- **Interface.** PR #7's `packages/agent` is primary. Codex's Playwright recording and browser presentation are reused. The competing Codex evaluation is archived on `codex/evaluation-archive` (`4d144f4`).
- **Skills.** `game-rules-audit` and `session-evidence` are approved; both must be invoked with recorded evidence. Independent reviews run in fresh Claude and Codex sessions.
- **Seeds.** No artificial randomness. Independent model trials measure behavioural variation, and the S1–S4/F situations test different challenges. Baseline and model runs must have identical start hashes.
- **Suite.** S1–S4 and F, provisional until the professor confirms. Sub-quest starts come only from replaying real actions. The full scripted route must be proven before the suite is frozen.
- **Baselines.** A quest-aware two-player scripted baseline using only permitted observations and messages; the exploration baseline is kept as secondary.
- **Model runs.** No paid runs yet. After the route works, measure decision counts, estimate cost, recommend a model and a hard budget, and ask for approval. Investigate action batching and prompt caching within the information boundary.
- **Recording.** Live capture of model-controlled play is preferred. A replay must be labelled and verified against its trace. A baseline is never presented as an LLM.
- **Information boundary.** Griffin HP, attack phases, signs and labels exactly as a human player sees them. No internal-only state.
- **Security.** The owner rotates the PixelLab token before evidence is published. All committed evidence and artefacts are scanned.
- **Sprint-frame test (2026-10-27, phase 2 item 8).** "Fix it if the test expectation is outdated … Do not change approved gameplay behavior merely to make the test pass." The expectation was outdated: the owner had asked for a faster Super Speed run animation (Codex session 01a15749, 2026-10-22). Only the test changed (`7c9f025`).
- **Time limits (2026-10-27).** 480 s means game time (`tick_limit`). The real-world ceiling for model runs is 3,600 s (`wall_clock_limit`), separate and configurable.
- **Model-call limit (2026-10-27).** 400 calls per hero is provisional. Reassess it, and the cost, after the scripted route is complete. No paid calls yet.
- **Hero ids (2026-10-27).** Seeded and deterministic (`packages/agent/src/runtime.ts`). The same seed gives the same hero ids and id-based tie-breaks; different seeds may vary the tie order. Hero ids depend only on the seed (they are drawn at reset, before any action). The seed and the raw start-state hash are in each trace's `reset` line. Production rooms keep random UUIDs.
- **Griffin label (2026-10-27).** Agents receive the griffin's exact HP and phase text (`GRIFFIN <hp>/320 · <PHASE>`) because the game draws that label on screen (`GriffinView.ts`). This is a deliberate, documented choice. The HUD goal lines stay hidden from both the baseline and the model.
- **Submission.** Prepare Oath and Ember, but do not replace Prince of Persia in course PR #57 until the professor resolves the scope and submission questions.

## CI test groups required by 3c (planned)

| Group | Planned tests | Status |
| --- | --- | --- |
| Rule invariants | Existing server rule tests (selected subset), equivalence tests for the server changes | todo |
| Legal and illegal actions | `packages/agent/test/environment.test.ts` validation tests | exists, not in CI |
| Terminal outcome | The scripted route reaching `chapter0.complete` (`fullQuest.test.ts`); the milestone baseline | exists, not in CI |
| Observed regression | A real defect found during this work, with its test. Candidates: failed calls not counted (`budget.test.ts`); the departed griffin still listed (`perception.test.ts`); a hero asked to choose was told "Your partner's line." (found by the route, `fullQuest.test.ts`) | candidates exist |
| Episode limits | Runner limit tests (tick, decision, model-call, token, spend, timeout, wall clock) | exists, not in CI |
