# game-rules-audit: adapter (P1 revision 2: prompt and observation boundary)

| Field | Value |
| --- | --- |
| Date | 2026-11-03 |
| Session | 2535c444-503f-4bd0-b122-23d0289cd46a. **This is the implementation session that made these changes, not a fresh session.** The audit is a self-check: it is not independent and does not count as a separate-session invocation of the skill |
| Session URL | None |
| Skill file SHA256 | `03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756` |
| Commit audited | Candidate `0fbece7` (not on any branch), parent `3a0a4c7`, checked out clean and detached in a scratch worktree. The shared working tree holds other sessions' uncommitted work and was not audited |
| Target and focus | adapter: P1 revision 2. F1 (`NEUTRAL_TASK`), F2 (house camera in `viewRect`), F4 (`garden gateway`), F6 (wall-clock ceiling); revisioning and preservation of revision 1 and S2-A |
| Files read | `AGENTS.md`, `CLAUDE.md`, `docs/midterm/MIDTERM_GUIDELINES.md` (rubric), `REQUIREMENTS_CHECKLIST.md`, the manual (searched for episode names). In the candidate: `policies/llm.ts`, `playerKnowledge.ts`, `perception.ts`, `environment.ts`, `evaluator.ts`, `suite.ts`, `harness.ts`, `prologueSituation.ts`, `test/prologueSituation.test.ts`, `test/playerKnowledge.test.ts`, `scripts/midterm/prologue-situation.ts`, `scripts/midterm/run-episode.ts`, `scripts/midterm/live.ts` (wall-clock path), `docs/midterm/PROLOGUE_SITUATION.md`. Game and client code: `apps/client/src/main.ts` (house camera, labels), `apps/client/src/environment/mapClassification.ts`, `packages/shared/src/environmentSolids.ts`, `maps.ts`, `magicShop.ts`, `villageInteriors.ts` |
| Commands run | See below |

**Commands and results:**
- `git diff --stat 3a0a4c7 0fbece7 -- apps packages/shared manual Images`: no changes.
- `git diff --name-only`: 16 files, all in `packages/agent/**`, `scripts/midterm/**`, `docs/midterm/**` and `midterms/saadsatter/EVALUATION.md`.
- `npm run typecheck`: passed.
- `npm test`: 121 files; **1,130 passed, 1 failed**. The failure is `s2Shutdown.test.ts`, "gives up on a video that never finalizes". It is pre-existing: it also fails at base `16f1a6d`, as recorded in the revision 1 audit.
- `npm run build`: built.
- `node --import tsx scripts/midterm/prologue-situation.ts --baseline --out <scratch>`: "All checks passed". Seeds 0 and 1: success, 1,058 ticks, 161 decisions, 0 invalid; end hashes `c2f3b973` and `30565934`.
- `grep` for the wall-clock paths (`wallSeconds`, `wallClockMs`, `runEpisode(`) in `scripts/midterm` and `packages/agent/src`: `live.ts` and `evaluate.ts` go through `runSuite`, which calls `checkWallSeconds`. `run-episode.ts` calls `runEpisode` directly but refuses every non-baseline policy (line 41).
- `python3 -I scripts/evidence/scan_secrets.py <16 changed files>`: 16 scanned, 0 findings.

## Findings

| # | Severity | Source (H/M) | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Low | M | `packages/agent/src/policies/llm.ts:252` (prompt legend) vs `perception.ts` (`garden gateway`) | The system prompt says "A visible entry with an extent is drawn across that block of tiles". The `garden gateway` entry has an extent but, deliberately, no grid mark (F4). The grid still shows `#` there | A model may expect marked cells and find none. The legend's other statement, that a `#` tile can be partly open, does describe the gap. No hidden information is involved | Disclose in `PROLOGUE_SITUATION.md`. Do not change the shared prompt without approval: a legend change would be a prompt change for every situation |
| 2 | Low | M | `perception.ts` listing precision | The gateway extent is reported as `h: 0.3`. The gap is 8 px (0.25 tiles), and fixed objects use one decimal. The x span (14.5–15.5) is exact | Cosmetic. The height of a fence line does not affect passing through it | Already disclosed in `PROLOGUE_SITUATION.md`. No change needed |
| 3 | Low | M | `scripts/midterm/run-episode.ts:46-53, 97` | The legacy script accepts `--preset P1` or `P1-v2` and any `--wall-seconds`, bypassing `checkWallSeconds`. It refuses every model policy (line 41), so only scripted baselines can run this way | The approved ceiling governs model runs. A scripted run with a longer wall clock cannot spend money or change an evaluation result | Optional: call `checkWallSeconds` there too, or document that it is scripted-only |
| 4 | Info | M | `perception.ts` `viewRect` | The house rule applies to `MAIN_HOUSE`, the shop scenes and village interiors, matching the client's `house` flag. `MAIN_HOUSE` has no `cameraBounds`, and the client's centre clamp reduces to the old formula there (tested: 760,490 → 224,280). No situation other than P1 enters these scenes | No effect on S2-A, S2-B, S2-C, S1–S4 or F (their pins pass) | None |
| 5 | Info | M | Revisioning | Revision 1 is kept as a verbatim literal, `P1_V1`; its hash is unchanged (`baa6b04b…73ac`, tested). Revision 2 runs preset `P1-v2`, so episode ids are `P1-v2-<seed>-<start>`, distinct from revision 1's `P1-…`. Revision 1's evidence folder is untouched | Provenance preserved | None |

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass | Only presentation code changed (prompt text, view rectangle, a listing). Nothing writes to the World |
| 2 Rules and art preserved | Pass | No diff under `apps/`, `packages/shared/`, `manual/` or `Images/` |
| 3 Real mechanics, no fixtures | Pass | Start, baseline and tests are unchanged in kind. The start state hashes are unchanged |
| 4 Observations player-visible only | Pass, with Findings #1 and #2 | **F2:** the view now equals the client's house camera. A point inside the shop map but outside its camera bounds (800,322) is not listed (tested). "E · UPSTAIRS" appears exactly where the client shows it. **F4:** the authored `garden gate (open)` and its `o` mark on a blocked cell are gone. `garden gateway` is the art's own region name, its extent equals the collision gap (derived from `aldenYardFenceSolids` in the test), and both straddled cells stay `#`. The full-episode leak scan still passes |
| 5 Legal actions leak nothing | Pass | `legalActions` is unchanged |
| 6 No solution in player context | Pass | **F1:** `NEUTRAL_TASK` names no place, character, item, direction or coordinate (tested on the prompt's instructions). The original `TASK` is byte-identical and remains the default for every other situation; the test shows it reproduces revision 1's pinned prompt hashes. The manual's two captions ("Forest Ruins", "the shop") are pre-existing, public and disclosed |
| 7 Independent players | Pass | Unchanged |
| 8 One interface | Pass | Baseline and models share the new observations. The baseline result is unchanged |
| 9 Limits and terminal reasons | Pass, with Finding #3 | **F6:** `checkWallSeconds` refuses a P1 wall clock above 3,600 s and accepts lower values; other scenarios have no ceiling (tested). All other P1 limits are unchanged (tested) |
| 10 Determinism | Pass | Start hashes are unchanged. The revision 2 views hash is pinned and identical at seeds 0 and 1. The baseline is identical at both seeds |
| 11 Suite and reporting | Pass | The revision 2 change-log entry is dated. Revision 1 is kept, and the docs state it was never run by a model. The three-situation and held-out gaps are still stated, not claimed met |
| 12 Synchronization and recording honesty | N/A | No recording |
| 13 Validation | Pass (1 pre-existing failure) | Counts above |
| 14 No overclaiming, no secrets | Pass | The docs record the owner's F5 confirmation and say plainly that F7 was only documented. Secret scan: 0 findings |

## Recommended tests

- Optional: a test that `run-episode.ts` cannot run a model on P1 (already enforced at line 41).

## Open questions for the owner

- Should the prompt legend's sentence on extents (Finding #1) be clarified in a future approved prompt revision?
