# 40 — Pilot-10 diagnosis: spatial memory, the cow passage and the stale dry-hedge request

| Field | Value |
| --- | --- |
| Agent | Claude Code (CLI); model id(s) recorded in the transcript: `claude-opus-5-5` |
| Role | Implementation agent under CLAUDE.md and AGENTS.md, read-only for this task: investigated the owner's paid pilot-10 run from its existing local trace (no paid call), wrote docs/midterm/PILOT10_DIAGNOSIS.md, checked whether the browser client shows a hero's own sent messages, and invoked session-evidence for this record. No implementation change, no subagent, no independent review |
| Session ID | `ce758032-c10c-4fec-b3f8-849454eb6c81` |
| Window (UTC) | 2026-10-29 04:55 → 2026-10-29 05:03 |
| Session URL | None. Local session; no shareable URL was created. |
| Repository | `https://github.com/SaadSatter/oath_and_ember`, branch(es) `midterm/evaluation` |
| Transcript | Local only, not committed: `~/.claude/projects/-Users-saadsatter-Classes-AI-Pract-Building-Games-oath-and-ember-eval/ce758032-c10c-4fec-b3f8-849454eb6c81.jsonl` |

> Documentation only. No observation, memory, prompt, gameplay, baseline or pin change; no tests run; no paid call, S4/F or route/seed1 inspection, push or merge.

## Owner instructions (redacted)

1. 2026-10-29 04:55 — [pasted brief] My assessment The perception fixes were worthwhile. But pilot-10 suggests that the next bottleneck is spatial memory and exploration planning, rather than Black Hole mechanics. I would not change the game rules or add explicit directions to the shears. Instead, I recommend a read-only investigation of: 1. What map history each agent receives across model calls. 2. Whether previously seen terrain is ret … (1011 characters; full text in the local transcript)
2. 2026-10-29 05:01 — [pasted brief] Please document the completed pilot-10 investigation. 1. Create docs/midterm/PILOT10_DIAGNOSIS.md, including: - Pilot metadata, result, cost and trace location. - Exact model-call context and memory limitations. - The cow passage visibility timeline and what each hero did. - The stale dry-hedge request and lost completion fact. - The unexplored northern loop and missing wolf encounter. - Proposed fixes … (1116 characters; full text in the local transcript)

<!-- narrative:start -->
## What was done

Sources: owner instructions above, commands run in this session, and Git state. Results below are **verified** by those commands unless marked otherwise. The extraction is a snapshot of this ongoing session, taken before its commit. No shareable URL was created.

- The owner asked for a read-only investigation of pilot-10 (S2-local, seed 0, OpenAI `gpt-6-luna` at medium, git `d31d76a`, manual stop): map history per call, retained terrain, visibility of the opening around the cow, walked versus unexplored corridors, and why Coco kept searching for the dry hedge.
- The agent read `docs/midterm/PILOT9_FIXES.md`, `packages/agent/src/policies/llm.ts`, `policies/openai.ts`, `perception.ts`, `environment.ts` and `packages/shared/src/hedgeMaze.ts`, and analysed the owner's local run record under `evaluation-runs/live/` (not committed) with Python scripts run only on the local trace. No model was called.
- **Verified in code:** each model call is a fresh single-turn request (no rolling conversation; OpenAI `store: false`), and the only persistent spatial memory is the coarse 4×4-block `exploredRows`. A hero's observation lists only messages received from the partner.
- **Verified in the trace:** the lane east of the cow was open on both screens from about tick 1761. Sieg walked through it and did not report it. Sieg's tick-406 request about the dry hedge stayed among Coco's last six received messages after she burned the hedge at tick 588, and her own "already cleared" messages left her 8-action log by about tick 1470. Neither hero went north of y 10.4 or ever had the wolf on screen.
- The agent first told the owner the completion fact was lost by tick 1347. Re-checking showed that her action log still held it at 1347; the diagnosis records the corrected timeline.
- **Browser client check (verified by search):** `apps/client/src`, `apps/server/src` and `packages/shared/src` have no chat or player-to-player message feature, so the client shows no sent messages at all.
- The agent wrote `docs/midterm/PILOT10_DIAGNOSIS.md`, with proposed fixes ranked by expected impact and risks for hidden-state leakage, dynamic objects, human-player parity and frozen baselines. **No fix was implemented.**
- **Secret scan:** `scan_secrets.py docs/agent-sessions docs/midterm` reports 1 finding: the pre-existing `anthropic-key` pattern at line 18 of `docs/midterm/agent-evidence/skill-runs/2026-10-27-recording.md` (committed in `4193424`, unchanged, may not be edited; documented as the synthetic canary in `INTEGRATION_VERIFICATION.md`). The value was not printed. This session's files (this record, `PILOT10_DIAGNOSIS.md`, the README, `EVIDENCE_INDEX.md` and `sessions.json`) scan with 0 findings.
- **Not done:** no implementation change, no tests run (documentation only), no paid call, no S4/F or `route/seed1` inspection, no pin change, no push or merge. No independent review.
<!-- narrative:end -->

## Mechanically extracted record

- Skills used: `session-evidence`
- Subagents used: none
- Pull requests referenced in tool output: none
- Files edited through the agent's edit/patch tool: 1 (`docs/midterm` 1)
- Test-summary lines printed in tool output: none found
- Commits inside the session window: none
