# game-rules-audit: baseline — guided Maze implementation checkpoint

Date: 2026-10-29. Session: Codex 01a17e49-e8f5-7150-8932-837cfe871fe3; same implementing session, not independent review. No session URL.
Commit audited: 3b7115b on midterm/evaluation, based on 346cdd4. Other-session prompt-capture helper remains untracked and untouched.
Game-rules-audit SHA256: 03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756.
Also applied read-only oath-rule-information-boundary, SHA256 553399eafd554c3b9062efa8b9d1fd9080c99bfadb151cb817ea40b77437fb21. The owner's explicit source-solution exception applies only to this disclosed guided policy.

## Findings

No blocking finding in the scoped implementation. The scripted engineering proof is not evidence of guided LLM success. Static solution knowledge is deliberately unequal to model-history; report it as a distinct treatment. Existing recorder-finalization/load limitations remain untested here.

| Step | Result | Evidence |
| --- | --- | --- |
| 1 Authority | Pass | Runtime guided modules do not call environment, server, step, observe or state mutation; they delegate LLM decisions to existing validation. |
| 2 Rules/art | Pass | No apps, shared gameplay, audio, scenario, checkpoint, observation, action-validation or pin edit. |
| 3 Mechanics | Pass | Existing Maze route succeeds in current S2-local at seeds 0/1; test stops at Shears, before returning to shrine. No fixture rewards/positions. |
| 4 Observations | Pass | Captured model user observations exactly equal ordinary observations; no World/puzzles fields; only system knowledge differs. |
| 5 Legal actions | Pass | Mock Sieg Flight is rejected by ordinary role validation; no guided bypass. |
| 6 Solutions | Authorized exception | Only GuidedGateway appends role-specific static walkthrough; model-history and model-obs-only prompts remain byte-identical. |
| 7 Independence | Pass | Separate policies/meters/notes; first notes empty independently; live coordination remains the message action. |
| 8 Interface/fairness | Pass with disclosure | Same five operations. Prior knowledge is intentionally privileged; no automatic navigator or checkpoint detector. |
| 9 Accounting | Pass | Same augmented prompt priced and dispatched. Insufficient cap blocks before mock transport; unknown usage charges full hold; actual paid adapter without persistent authorization cannot reach stubbed fetch. |
| 10 Determinism | Pass, scoped | Guide hash 975e5580671c; both tuning-seed route proofs pass; mock run reset hash matches ordinary reset. No existing pin changed or re-pinned. |
| 11 Suite | Pass | Distinct model-guided kind/name, current S2-local tuning only; final/other scenario plans rejected. Scenario definitions unchanged. |
| 12 Recording | Unverified live | Existing launcher and recording path retained; no new recording or paid success claimed. |
| 13 Validation | Pass | Node v24.19.0; 187 tests in 12 selected files, 13 harness tests, final 9 guided tests all pass (201 distinct cases). Typecheck and build pass. |
| 14 Evidence/secrets | Pass for implementation | Eight implementation files scanned, zero findings. Evidence scan after final writing; preserve known historical synthetic finding. |

Read the eight implementation files, existing normal gateway/runner validation and the new nine-test file. Source locators for mechanics: route/fullQuest.ts: hedgeMaze only; shared/hedgeMaze.ts; server/hedgeMaze.ts; inventory.ts. Read required AGENTS/CLAUDE/skills and refreshed requirements/evidence/plans in preflight. Scope excludes persistent-memory implementation and all held-out scenario state/outcomes.

Commands/results: npm run typecheck pass (repeated after final test addition); npm run build pass (existing Vite bundle warning); targeted Vitest files pass as above; git diff against 346cdd4 confirms llm.ts, scenarios, evaluator, environment, perception, actions, shared/server/client files and scriptedFreeze pins untouched; secret scan of implementation eight files has zero findings. No full suite, held-out tests or paid calls run. No push or merge.

Open questions: actual LLM completion, cost and recording await a separately approved paid pilot. No further implementation permission required for this completed scope.
