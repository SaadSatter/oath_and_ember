# game-rules-audit: baseline inventory overlay

Date: 2026-11-06. Session: `01a1aed2-3232-7011-bb41-5fccdea13a5c`. Session URL: None. Same-session implementation checkpoint, not independent review. Base: `9f4ac38`, dirty concurrent checkout. Skill SHA256: `03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756`.

Read: project instructions, midterm guidelines/checklist/evidence/handoff, agent interface, player manual, inventoryHeuristic, unchanged GriffinHeuristic fallback, kind/factory registration and synthetic tests. Scope is the new policy overlay; concurrent C fixtures/registration are excluded.

## Findings

| Severity | Source | Evidence | Recommendation |
| --- | --- | --- | --- |
| Info | M | No C execution; only synthetic overlay tests and existing A/B regressions. | Freeze scenario separately, retain both baseline attempts before reporting performance. |
| Info | M | Policy intentionally prefers tools for Coco, uses public inventory descriptions and inherits B combat/return heuristics. | Disclose knowledge and role asymmetry; do not describe it as solution-free general intelligence. |
| Medium | M | Generic matching and movement have no demonstrated C completion. | Report performance as unverified; do not tune model on C outcomes. |

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Authority | Pass in scope | Policy returns actions only; no engine imports or state writes. |
| 2 Rules/art | Pass in scope | No gameplay/art edits; A/B policy diff against HEAD empty. |
| 3 Mechanics/fixtures | Pass policy; C unverified | Synthetic fixtures explicitly unit tests; concurrent scenario construction excluded. |
| 4 Observations | Pass in scope | Own observation, observed terrain memory, inventory and displayed target text only. |
| 5 Legal actions | Pass in scope | Same action validation; overlay adds no legal-list data. |
| 6 Solution context | Disclosed | No route or fixed tool sequence; inherits existing B rules and sees public item descriptions. |
| 7 Independence | Pass | Factory creates separate policy/fallback instances for each hero. |
| 8 Interface | Pass | Same Policy and legal-action inputs, zero calls. |
| 9 Limits | Unchanged | Runner enforcement unchanged; local item dependency fixed deadline tested. |
| 10 Determinism | Partial | Synthetic history deterministic; C reset not executed. |
| 11 Suite | Pending | Separate proposal only; no C outcomes or active declaration amendment. |
| 12 Recording | N/A | No episode or recording produced. |
| 13 Validation | Pass targeted | Typecheck/build passed; 29 tests across inventory, maze and Griffin heuristic files passed. Full suite skipped during concurrent verification. |
| 14 Reporting/secrets | Scoped reporting checked | No success claim; scanner results preserved in session evidence. |

Commands: `npm run typecheck` passed; targeted `npm test -- packages/agent/test/inventoryHeuristic.test.ts packages/agent/test/mazeHeuristic.test.ts packages/agent/test/griffinHeuristic.test.ts` 29/29; `npm run build` passed with bundle warning; `git diff --exit-code HEAD -- packages/agent/src/policies/mazeHeuristic.ts packages/agent/src/policies/griffinHeuristic.ts` passed. No paid calls or C reset/run.

Recommended next verification: approved identical-start C baseline attempts, real item effects and chapter0 terminal evidence. Open decision: scenario owner must finish/freeze concurrent C definition before an outcome can count.
