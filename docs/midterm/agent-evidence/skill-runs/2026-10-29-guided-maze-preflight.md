# game-rules-audit: baseline — guided Hedge Maze preflight

Date: 2026-10-29. Session: Codex 01a17e49-e8f5-7150-8932-837cfe871fe3 (implementer, not independent review). No session URL.
Skill SHA256: 03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756.
Revision inspected: d31d76a; 346cdd4 subsequently records the other session's diagnosis. Its initially pending files were preserved.
Scope: owner-approved opt-in model-guided for revision 2 S2-local (Hedge Maze), no paid or held-out execution.

## Findings

No approval requirement beyond the owner's explicit guided-baseline exception. Source-derived solutions are authorized only in this separate policy, not model-history or observations. This is not an information-equal comparison to the unguided player.

| # | Severity | Source | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| 1 | Info | M | Suite revision 2 swaps the older S2/S3 mapping. | Use current S2-local only; preserve scenarios and pins. |
| 2 | Info | H/M | Persistent-memory work is independent. | New composition policy and static instructions; leave llm.ts and existing memory unchanged. |
| 3 | Info | M | Added prompt text must be priced before dispatch. | Transform worstCaseUsd and complete with identical full guided system text, inside MeteredGateway. |

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass, design | LLM selects all runtime actions; server validates. |
| 2 Rules and art | Pass, design | No gameplay, audio, checkpoint or observation changes. |
| 3 Real mechanics | Pass, design | Static walkthrough follows existing maze route; separately labelled offline proof, never runtime scripting. |
| 4 Observations | Pass, design | Same existing observations; no World/private partner state input. |
| 5 Legal actions | Pass, design | Same schema, environment and validation. |
| 6 Solutions | Explicit owner exception | Guide only in model-guided system prompt; disclose and hash its version. |
| 7 Independent players | Pass, design | Two instances; own contexts; message-only live coordination. |
| 8 One interface | Pass, design | Knowledge added, no automatic navigation or computed actions. |
| 9 Limits | Pass, design | Existing persistent ledger, call and episode caps; full augmented prompt reserved. |
| 10 Determinism | Implementation tests pending | Preserve old prompts, raw reset hashes and pins. |
| 11 Suite/reporting | Pass, design | New player kind restricted to current tuning local scenario; existing scenarios unchanged. |
| 12 Recording | Unverified live | Existing recorder retained; no LLM success claimed. |
| 13 Validation | Pending implementation | Node 24.19.0, permitted offline tests/typecheck/build only. |
| 14 Evidence/secrets | Pass, scope | No credentials, raw transcripts or held-out outcomes recorded. |

Read AGENTS/CLAUDE and applicable skills; rubric, requirements, recurring instructions, evidence/handoff, baseline/budget/route/interface references; current revision 2 suite; Maze-only route function; shared/server Maze mechanics; inventory validation; observation captions; policy/gateway/harness/launcher wiring. Git status/log read. No code edited during audit; no S4/F reset or outcome inspection, paid call or test executed for this preflight. Initial report write permission review timed out (not a safety rejection); retry uses this report copy.

Open questions: none blocking. Stop before paid calls, held-out work, gameplay changes or expanding guide scope.
