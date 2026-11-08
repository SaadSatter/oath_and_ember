# Shrine-start showcase: same-session equivalent rules audit

Provenance: Codex session `01a1b479-dfba-79a0-9de7-9cca63bdc8bb`, November 7, 2026. Read-only follow-up inspection of `e5d2dfe58bff3e008bf7be29be2dc24766964b92` after this same session implemented the changes. **Not independent review.** `game-rules-audit` checklist SHA-256 `03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756`; information-boundary skill SHA-256 `553399eafd554c3b9062efa8b9d1fd9080c99bfadb151cb817ea40b77437fb21`. No model policy receives these instructions or this report.

Scope: diff from `cee0713`, showcase scenario/reset, success/milestone evaluation, observation-only baseline, guidance, tests, recording and frozen-path evidence. Essential project/course/phase/interface material and prior review/session evidence were consulted. [Separate read-only subagent review](../reviews/2026-11-07-showcase-shrine-review.md) found a major ordering gap and stale comments; [follow-up](../reviews/2026-11-07-showcase-shrine-followup.md) confirms the fixes. Both reports retain original provenance and findings. The subagent did not implement code but belongs to this implementing session, not an independent top-level session.

## Findings

No unresolved critical/major implementation finding in this final scope. Known nonblocking issue: `s2Shutdown.test.ts:59` expects an additional recorder-timeout error phrase; unchanged behavior fails that existing assertion. Paid model behavior, provider availability and model reliability from this revised start remain unverified. Exact-hash owner approval is required before the revised paid locks can open.

## Checks performed

| Check | Result and evidence |
| --- | --- |
| 1 Server authority | Preserved; actions go through ordinary engine validation. No gameplay mutation in the diff. |
| 2 Rules/art | Protected server/client/shared/manual/art paths unchanged; original Claude work retained. |
| 3 Real mechanics | Normal goddess checkpoint, no prefix/fixture; a showcase prefix is refused. Legal dialogue, movement, exits, combat and offering recorded. |
| 4 Observations | Perception unchanged; both heroes' opening observations include their displayed greeting and quest request. |
| 5 Legal actions | Validator unchanged; evaluator history never added to legal-action lists/observations. Recovery probe reports zero metadata leaks. |
| 6 Context/solutions | Only showcase briefing/task/phase order revised; no maze answer, coordinate or hidden-state addition. Frozen B/C guidance text unchanged. |
| 7 Player architecture | Owner-authorized centralized planner retained; baseline has separate per-hero observation memories. No claim of two independent LLMs. |
| 8 Interface/fairness | Baseline uses the public interface and observed exits. Recovery certification is explicitly privileged probe-only, not a fair comparison player. Opening one-second legal waits are a disclosed baseline presentation choice. |
| 9 Limits/failures | Paid guard false; guidance proposed/no approved hash. Target $2/7,200 s/400 calls per hero, exact seed/config and no resume unchanged. Normal knockouts nonterminal; limit/watchdog failures remain possible. |
| 10 Determinism | Seed-0/1 starts repeat and equal ordinary S1 shrine checkpoint; seed zero tick 0. Baseline and probe replay exactly; all nine official traces match. |
| 11 Freeze/reporting | Separate showcase revision 3, excluded from A/B/C. Protected-path diff empty, twelve immutable run paths identical. Old showcase evidence remains historical and unchanged. |
| 12 Recording | Actual labelled speed-1 baseline replay, all 2,352 step results match. 10,165 paced ticks =169.4167 game-s/169.42 wall-s; episode10,166 ticks. Full decode succeeds; actual greeting, Quest request and terminal success frames inspected. Video decoded length182.12 s, recorder wall187 s including overhead. Live boundary-wait caveat retained. |
| 13 Validation | Typecheck/build pass. Targeted 17/17. Broad permitted suite 1,356 pass/one known failure in 139 files; separate S1–S3 six pass/one skip. Held-out/full-route tests excluded. Recovery succeeds with two knockouts, all 2,412 results replay exactly. |
| 14 Honesty/secrets | No paid model result claimed; canonical ledger 36 entries, zero open, pilot $2.117789 / total $19.114868 remaining. Changed artifact scan performed at finalization. Broad historical scan has one previously known synthetic canary in immutable October27 audit, preserved/reported. |

All ten ordered first-occurrence timestamps must be present. Tests remove each milestone and reject an early Griffin-defeat timestamp despite otherwise complete final world state. The baseline's actual episode follows the requested sequence; ordinary two-knockout recovery retains all progress and completes that same sequence. No confidence/reliability estimate inferred from one scripted success.

[Free evidence v3](../../../../midterms/saadsatter/evidence/showcase/free-validation-v3/README.md) preserves trace bytes, hashes, logs, opening proof, official replay verification, recording identity and ledger inventory. Video remains in the ignored local recording archive, byte-identical to its scratch original. No paid call/reservation, push, merge, course PR modification or submission.
