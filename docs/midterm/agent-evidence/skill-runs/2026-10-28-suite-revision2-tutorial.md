# game-rules-audit: suite (revision 2: S2/S3 swap, manual and tutorial knowledge)

| Field | Value |
| --- | --- |
| Date | 2026-10-28 |
| Session | a209a67a-330b-4dd1-9a07-4cb129ceff9a (the implementation session; this is a same-session checkpoint, not an independent review) |
| Session URL | None unless the owner supplies one |
| Skill file SHA256 | `03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756` |
| Commit audited | `b8ae7f0`, working tree dirty (the uncommitted revision 2 change below) |
| Target and focus | suite: revision 2 swaps S2/S3 (S2 Hedge Maze / Enchanted Shears, S3 Mirror Pond / Vanity Mirror, likewise S2-local/S3-local). Revision 1 definitions are kept as S2-v1, S3-v1, S2-local-v1 and S3-local-v1. Model players in the revised S2/S3 and local starts get the tutorial-completion briefing (`playerKnowledge.ts`); the verbatim player manual was already in every model prompt |
| Files read | `AGENTS.md`, `CLAUDE.md`, `docs/midterm/MIDTERM_GUIDELINES.md`, `REQUIREMENTS_CHECKLIST.md`, `EVALUATION_SUITE.md`, `LOCAL_STARTS.md`, `PILOT7_FIXES.md`, `manual/Oath_and_Ember_Player_Manual.md`, `manual/README.md`, `manual/GAME_DESIGN_RATIONALE.md` (headings), `packages/shared/src/prologueWoods.ts`, `abilities.ts`, `movement.ts`, `blackHole.ts`, `constants.ts`, `maps.ts` (modes), `apps/server/src/GameRoom.ts` (cooldowns, `damage`, strikes), `packages/agent/src/{types,actions,perception,environment,suite,evaluator,finalAccess,harness,playerKnowledge}.ts`, `policies/llm.ts`, `scripts/midterm/{live,evaluate,run-episode}.ts`, and the changed tests |
| Commands run | See "Validation" below |

## Validation (run in this session, Node v24, working tree as audited)

| Command | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run build` | pass; the existing warning about a client chunk over 500 kB |
| `npx vitest run --exclude 'packages/agent/**'` (server, shared, client) | 79 files, 563/563 pass |
| `npx vitest run` on the permitted agent files (all of `packages/agent/test` except `suite.test.ts`, `route/fullQuest.test.ts`, `route/checkpointFreeze.test.ts`, `scriptedFreeze.test.ts`, `finalAccess.test.ts`) | 27 files, 393/393 pass. The first two runs failed: an import cycle (`finalAccess` read `SITUATIONS` during module load), tests still treating `S2-local` as Mirror Pond, and a `toBe(expect.any)` misuse in a new assertion. All were fixed before this run |
| `npx vitest run packages/agent/test/scriptedFreeze.test.ts -t 'baseline on S[123]'` | 6 pass, 1 skipped (`route/seed1`, held-out content). Pinned values unchanged, now run on S1, S2-v1 and S3-v1 |
| `finalAccess.test.ts -t` (four gate tests: refusal before any world exists, held-out prefix refusal, pure `admitReset` checks, S1 at tuning seed) | 4 pass, 12 skipped |
| `suite.test.ts -t` (declaration list; source has no privileged calls) | 2 pass, 2 skipped (both build held-out starts) |
| `python3 -I scripts/evidence/scan_secrets.py` on the new source and test files | 3 files, 0 findings |
| Full `npm test` | **Not run**: it includes held-out S4/F reconstructions, which the owner excluded |

## Findings

| # | Severity | Source (H/M) | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Medium | M | `packages/agent/src/suite.ts` (`S2_MAZE_BRIEFING`, `S3_BRIEFING`) | The revision 2 S2 (Hedge Maze) briefing is the implementation agent's adaptation of the owner-approved Mirror Pond text. S3 now has a briefing; revision 1 S3 had none | The model's instructions for both scenarios changed, using wording the owner has not approved | Owner approves or rewrites both texts before any paid run. Report revision 2 results apart from revision 1 |
| 2 | Medium | M | `packages/agent/test/scriptedFreeze.test.ts` | Pins are kept for the revision 1 definitions only. The current S2/S3 have no scripted pin. They share the same start hash and predicates as S3-v1/S2-v1, so they are expected to reproduce those pins swapped, but this was not run as a pin | A scripted-behaviour regression on the current S2/S3 ids would not be caught by the freeze test | Owner decides whether to add revision 2 pins (expected: quest S2 = old quest S3, quest S3 = old quest S2, explore shared). Do not add them without approval |
| 3 | Medium | M | `docs/midterm/EVALUATION_SUITE.md`, `LOCAL_STARTS.md`, `LIVE_RUN.md`, `AGENT_INTERFACE.md` | At audit time the docs still describe S2 as Mirror Pond | Docs and code disagree until updated | Add a change-log row, the revision note and the versioned ids before committing |
| 4 | Low | M | `docs/midterm/evidence/phase4/quest-tuning-summary.json` and earlier run records | Committed records name `"situation": "S2"` with no `suiteRevision`. In them, S2 is Mirror Pond | A reader could take them to mean the current S2 (Hedge Maze) | Don't edit the evidence. Document that records without `suiteRevision` use revision 1 ids (`historicalSituationId()`), and point to it from `EVIDENCE_INDEX.md` |
| 5 | Low | M | `manual/Oath_and_Ember_Player_Manual.md` vs `packages/shared/src/movement.ts` | The manual says Flight lasts "up to 20 seconds", but a flight cannot be ended early; the press only starts it (`flightRemaining = 20`, `cooldowns.flight = 27`). The manual also describes the HUD objective line, which agents do not receive (owner decision 2026-10-23). The tutorial briefing discloses the HUD difference and avoids claiming early landing | Minor mismatch between the manual and both the code and the agents' view. The manual was not modified | Owner decides whether the manual wording should change (needs approval; `manual/**`) |
| 6 | Low | M | `packages/agent/src/harness.ts` | The manifest gains `suiteRevision`, so `resume` of an output directory written before this change now fails "Resume configuration does not match" | Old runs cannot be resumed under new code. They were complete, and their gitHash differs anyway | Accept and disclose |
| 7 | Info | M | `scripts/midterm/live.ts`, `harness.ts` | The `-v1` ids are runnable (tuning seeds only) with their original $1.25 caps, for reproduction | A paid model run on a historical definition is possible once the owner authorizes spending | Owner decides whether `-v1` ids should be allowed for paid model runs or for baselines only |
| 8 | Info | M | `playerKnowledge.ts` | The tutorial block adds 7,331 characters (roughly 1.8k tokens) to every system prompt. It is cached by the Anthropic adapter (system `cache_control`); OpenAI caching is automatic | Cost per call rises slightly | Re-estimate the pilot budget (`MODEL_BUDGET.md`) before the next paid run |

No Critical or High findings.

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass | No change under `apps/server`, `apps/client` or `packages/shared`. New code only builds prompt text and suite metadata |
| 2 Rules and art preserved | Pass | `git diff --stat`: only `packages/agent/**`, `scripts/midterm/live.ts` and tests. The revision 1 evaluator entries (presets `S2`, `S3`, `S2-local`, `S3-local`, goals, limits, predicates) are byte-identical; a test pins their goal text |
| 3 Real mechanics, no fixtures | Pass | The revision 2 starts reuse the same `afterOpening` / `localEntry` prefixes (ordinary actions). Start hashes are equal to the revision 1 counterparts (tested: `5397eba5…` at seed 0; local starts cross-checked by the localStarts suite on v1 and v2) |
| 4 Observations player-visible only | Pass | No observation change |
| 5 Legal actions leak nothing | Pass | No legal-action change |
| 6 No solution in player context | Pass, with Finding 1 | The tutorial briefing names no quest area, item, mechanism, coordinate or cardinal direction. It contains no quest-baseline phrase (tested). It covers only the Mossling Woods lessons, the manual's controls and the public interface. It excludes the woods' private HP floor. The manual names no evaluated area (tested). `GAME_DESIGN_RATIONALE.md` (puzzle progression conditions) and `manual/README.md` are excluded (`MANUAL_EXCLUSIONS`), and no text from them reaches the prompt (tested). The episode briefings name the area and objective item only |
| 7 Independent players | Pass | The same static text goes to each hero's own `LLMPlayer`. There is no shared memory, and per-hero gateways are unchanged |
| 8 One interface | Pass | Baselines receive no prompt (tested: no tutorial in their names). Model and baseline observations and legal actions are unchanged |
| 9 Limits and terminal reasons | Pass | The revision 2 presets spread the revision 1 limits and predicates of the same area (tested identity). Caps are unchanged ($1.25) |
| 10 Determinism and identical starts | Pass | Episode ids are distinct (`S2-v2-0-5397eba5` vs historical `S2-0-5397eba5`). Revision 1 resets reproduce the old episode ids. The historical scripted pins pass unchanged |
| 11 Suite and reporting | Finding 3, 4 | The suite revision is explicit (`SUITE_REVISION = 2`, `suiteRevision` and `scenario{preset,title,goal,revision,tutorialId,briefing}` in every summary and manifest). The change log is pending at audit time. Held-out S4/F are untouched and were not run |
| 12 Sync and recording honesty | N/A | No recording or presentation change |
| 13 Validation | Pass (partial) | See the table above. The full `npm test`, `suite.test.ts` (2 of 4), `checkpointFreeze.test.ts` and the rest of `finalAccess.test.ts` were not run because they build held-out starts. `checkpointFreeze` calls `environmentFor("S2")`, whose start state is unchanged, so its S2 pins are expected to hold. **Unverified** |
| 14 No overclaiming, no secrets | Pass | Secret scan 0 findings. No paid call, push or merge |

## Recommended tests

- With approval: revision 2 scripted pins for quest/explore on the current S2 and S3 (Finding 2).
- An owner-run, or a later permitted run, of `checkpointFreeze.test.ts` to confirm that the S2 start pins still hold under the `S2-v2` preset.

## Open questions for the owner

1. Approve or rewrite the revision 2 S2 (Hedge Maze) and S3 (Mirror Pond) episode briefings (Finding 1).
2. Add revision 2 freeze pins (Finding 2)?
3. Should the `-v1` historical ids be allowed for paid model runs, or for scripted reproduction only (Finding 7)?
4. Should the manual's Flight "up to 20 seconds" wording be clarified (Finding 5)?
