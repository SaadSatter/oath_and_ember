# Showcase takeover: equivalent read-only rules audit

Provenance: Codex session `01a1b479-dfba-79a0-9de7-9cca63bdc8bb`, November 7, 2026. Reviewed code `20d9d28` after completing follow-up fixes in that same session. **Not independent review.** Equivalent read-only application of game-rules-audit and information-boundary checks; no playable policy received this audit. Information-boundary skill SHA-256: `553399eafd554c3b9062efa8b9d1fd9080c99bfadb151cb817ea40b77437fb21`.

Original Claude reviewer report is complete and preserved verbatim, including its provenance header, in `c242906`; SHA-256 `25a4e31b66e5bda873e1abfc6771e09a0e4d1cd3dbe4e01b2be5d70e5ba4c91a`. It came from an implementing-session reviewer subagent, not a separate top-level session. The ten finding responses are in [the handoff](../../SHOWCASE_CONTINUOUS_EPISODE.md#reviewer-findings-disposition).

## Findings and boundaries

No unresolved critical/major implementation finding was identified in this follow-up scope. Major wall-default and current-evidence issues have regression coverage and new revision-2 evidence. Remaining owner decision: authorize the exact proposed guidance/full prompt before a reviewed paid unlock. Strong role/nest hints are disclosed as demonstration-specific tuning, not transfer evidence.

- Observations/actions: existing perception/action paths are byte-identical to `eeb2b59`; structured public observations and ordinary engine validation retained. No showcase evaluator metadata appears in probe observations/legal action lists. No hidden-state policy input or engine reward injection added.
- Histories/capabilities: one centralized planner intentionally controls two heroes; separate per-hero observation memories in scripted comparison. Neither is represented as two independent LLMs. Reviewer information stays outside gameplay policy context.
- Baseline equality: showcase scripted policy limited to this scenario; frozen A/B/C policies unchanged. Privileged recovery certification target is explicitly probe-only and excluded from fair baseline/model claims.
- Scheduling/transitions/bounds: existing shared tick owner unchanged. Model showcase default is actually 7,200 s in manifest and run summary. Exact seed/config/cap and no-resume/no-retry checks precede dispatch. Paid approval stays false and proposed guidance has no approved hash.
- Recovery/success precedence: real Griffin damage produces ordinary respawn to 100 HP, without resetting full flags, claims, backpack or completed maze progress. Two knockouts do not terminate the probe; combat defeat, wig, offering and actual chapter completion follow. The public manual explicitly documents respawn; original reviewer statement to the contrary is preserved and corrected in response.
- Freeze/replay: twelve frozen run-path files byte-identical; protected server/shared/manual/art/declaration/official trace diff empty. All nine official traces replay exactly. Baseline 2,025, probe 2,085 and mock 1,154 step results also replay exactly.
- Recording: actual normal-speed baseline replay saved locally, exact hash matching and game-clock pacing verified, full video decode passed, terminal frame visually checked. 8,499 paced ticks versus 8,500 episode ticks disclosed. Live action-boundary wait skipping remains a timing caveat. No final model capture or 3–5 minute submission clip claimed.
- Budget: read-only canonical balance and scratch-copy $2 reservation checked; no real reservation/provider call. Pilot remaining $2.130405, total $19.127484; recheck at dispatch.

## Validation and limitations

Typecheck/build pass; targeted 53/53. Permitted broad suite: 1,355 pass, one pre-existing recorder-timeout message assertion failure (`s2Shutdown.test.ts:59`), 139 files. Separate S1–S3 scripted group six pass/one skip. No held-out/full-route or paid run. Dedicated maze-local knockout and end-to-end real planner recovery coverage remain additional checks, not claimed results. Provider availability remains untested; model stalls/recovery can consume bounded time/calls/spend.

[Evidence package](../../../../midterms/saadsatter/evidence/showcase/free-validation-v2/README.md) contains actual logs, hashes, recovery snapshots, freeze proof, replay results and recording metadata. Original audit/reviewer documents were not rewritten. No push, merge, course PR update or submission.
