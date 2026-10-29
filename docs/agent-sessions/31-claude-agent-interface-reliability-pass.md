# 31 — Agent-interface reliability pass after the first real-LLM S1 run

| Field | Value |
| --- | --- |
| Agent | Claude Code (CLI); model id(s) recorded in the transcript: `claude-opus-5-5` |
| Role | Implementation agent under CLAUDE.md and AGENTS.md: owner-approved agent-interface reliability pass after the first real-LLM S1 run; then session-evidence skill invocation (this record). Not reviewed independently yet |
| Session ID | `47c36046-7a76-45d1-9d05-03e68d299f40` |
| Window (UTC) | 2026-10-28 01:02 → 2026-10-28 01:31 |
| Session URL | None. Local session; no shareable URL was created. |
| Repository | `https://github.com/SaadSatter/oath_and_ember`, branch(es) `midterm/evaluation` |
| Transcript | Local only, not committed: `~/.claude/projects/-Users-saadsatter-Classes-AI-Pract-Building-Games-oath-and-ember-eval/47c36046-7a76-45d1-9d05-03e68d299f40.jsonl` |

## Owner instructions (redacted)

1. 2026-10-28 01:02 — [pasted brief] I approve a focused agent-interface reliability pass based on the first real-LLM S1 evaluation diagnosis at commit 4193424. Implement the following in the canonical oath_and_ember-eval worktree: 1. Fix action-history semantics. Distinguish proposed, executed, skipped, and rejected actions. Only executed actions should appear as completed history. Preserve accurate feedback for skipped/rejected actions … (2497 characters; full text in the local transcript)

<!-- narrative:start -->
## What was done

Sources: owner instructions above, the mechanically extracted transcript, current git state, and commands run in this session. Results below are **verified** by those commands unless marked as the agent's report. The extraction is a snapshot of this ongoing session. No shareable URL was created.

- **Asked:** a focused reliability pass on `packages/agent` based on the first real-LLM S1 run at `4193424`. Six items: action-history semantics, reply handling and structured output, per-hero dialogue history, abstract-action prompt text, separate metrics, and shared-dialogue guidance. No paid calls, no S4/F, no push or merge. Commit the implementation separately from evidence. Stop before another real-LLM run.
- **Diagnosis (read-only on the S1 trace):** 90 batch actions were skipped but were logged as recent actions at decision time; 10 `advance_dialogue` presses were stale (both heroes pressed one shared line); 8 replies were unparseable, one holding a valid envelope after junk text. The server rule "one read moves a shared line on for both" was confirmed in `apps/server/src/prologue.ts` `readLine`.
- **Implemented, commit `5c3de48`:** executed/rejected/stale/skipped statuses with a per-decision `TurnReport`; history lists only executed actions. `output_config.format` JSON schema in `AnthropicGateway`, with model and effort allowlist unchanged (checked with the claude-api skill and SDK 1.2.0 types). Conservative envelope validation; unusable replies submit nothing. Safe reply metadata. Observation `dialogueLog` via the client's `storyView`. Prompt text on state-dependent actions, keys not being commands, and message-based shared-line ownership. Metrics version 2 with legacy fields kept. Details in `docs/midterm/AGENT_INTERFACE.md`, "Reliability pass".
- **Verified under Node v24.19.0:** `npm run typecheck` passed; `npm run build` passed (existing Vite bundle-size warning). `npx vitest run --maxWorkers=4` with `suite.test.ts`, `route/fullQuest.test.ts` and `checkpointFreeze.test.ts` excluded: **778/778 tests, 95 files**. Two earlier runs at default parallelism had timeout-only failures (9, then 1, in different files including untouched server tests); the 4-worker run passed in full. The staged tree alone, exported without the uncommitted recording work, passed typecheck and 187/187 agent tests (3 git-dependent files rerun inside a throwaway scratch repo). New tests: `packages/agent/test/reliability.test.ts` (41).
- **Gameplay unchanged (verified):** the scripted quest baseline replayed S1 seed 0 offline to the same start hash `d9b2359a956db64d…`, end hash `7e22d17e885d2cd2…` and 290 ticks as the recorded run. Output went to the session scratchpad, not `evaluation-runs/`.
- **Preserved (verified by SHA-256 before and after):** all six files of `evaluation-runs/live/S1-seed0-model-history-anthropic-2026-10-28T00-52-06-030Z/` and both shared-ledger files. No paid call, no ledger change, no S4/F, no push, merge or PR.
- **Overlapping work:** another session (likely `bf4d982e`, started 00:57 UTC) was editing the same worktree at the same time: `recorder.ts`, `recorder.test.ts`, `scripts/midterm/live.ts`, `LIVE_RUN.md`, `.gitignore` and a `ready` hook in `environment.ts`/`harness.ts`. None of it was committed or modified here. `5c3de48` was staged from this session's changes only.
- **Not done:** no `game-rules-audit` and no independent review (`rules-reviewer`) of `5c3de48`. Both are recommended before the next paid run. Structured output has not been exercised against the real API. The extra input tokens from the schema were not measured.
<!-- narrative:end -->

## Mechanically extracted record

- Skills used: `claude-api`, `session-evidence`
- Subagents used: none
- Pull requests referenced in tool output: none
- Files edited through the agent's edit/patch tool: 2 (`/private` 1, `packages/agent` 1)
- Test-summary lines printed in tool output (last 6 distinct, as printed):
  - `Test Files  95 passed (95)`
  - `Tests  778 passed (778)`
  - `Test Files  3 failed | 12 passed (15)`
  - `Tests  1 failed | 186 passed (187)`
  - `Test Files  3 passed (3)`
  - `Tests  30 passed (30)`
- TypeScript errors (`error TS…`) appeared in tool output at least once during the session.

Commits whose author time falls inside this window (any branch). A time match is not proof of authorship when sessions overlap; the co-author trailer is shown where present.

| Commit | Author time (UTC) | Subject | Co-author trailer |
| --- | --- | --- | --- |
| `5c3de48` | 2026-10-28 01:31 | Agent-interface reliability pass after the first real-LLM S1 run | Claude Opus 5.5 <noreply@anthropic.com> |
