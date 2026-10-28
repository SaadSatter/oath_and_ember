# 34 — OpenAI provider integration: Codex implementation finished and verified

| Field | Value |
| --- | --- |
| Agent | Claude Code (CLI); model id(s) recorded in the transcript: `claude-opus-5-5` |
| Role | Implementation agent under CLAUDE.md and AGENTS.md: continued Codex's uncommitted OpenAI provider work (session 33), reviewed the dispatch guards, fixed two defects, verified offline and committed it; then session-evidence skill invocation (this record). Not an independent review of Codex's work and not reviewed independently yet |
| Session ID | `9e618f25-b52c-4d7a-8940-be7414095404` |
| Window (UTC) | 2026-10-28 05:05 → 2026-10-28 05:21 |
| Session URL | None. Local session; no shareable URL was created. |
| Repository | `https://github.com/SaadSatter/oath_and_ember`, branch(es) `midterm/evaluation` |
| Transcript | Local only, not committed: `~/.claude/projects/-Users-saadsatter-Classes-AI-Pract-Building-Games-oath-and-ember-eval/9e618f25-b52c-4d7a-8940-be7414095404.jsonl` |

## Owner instructions (redacted)

1. 2026-10-28 05:05 — [pasted brief] Continue the unfinished OpenAI provider integration left by Codex in the canonical Oath and Ember evaluation worktree. Codex hit its usage limit during final verification. Its changes are already present locally. Do not restart the implementation, reset files, or overwrite existing work. Current progress: - OpenAI adapter and launcher wiring implemented. - Explicit OpenAI model allowlist and Responses … (2671 characters; full text in the local transcript)

<!-- narrative:start -->
## What was done

Sources: owner instructions above, commands run in this session, and Git state. Results below are **verified** by those commands unless marked otherwise. The extraction is a snapshot of this ongoing session. No shareable URL was created. Codex's inherited work is recorded in file 33.

- **Asked:** continue Codex's uncommitted OpenAI integration without restarting or overwriting it; review both providers' dispatch guards; finish tests; run typecheck, build, secret scan and the offline suite under Node 24 without `suite.test.ts`, `route/fullQuest.test.ts` or `checkpointFreeze.test.ts`; check S1 determinism and recording; record evidence; commit implementation and evidence separately. No API call, no S4/F, no ledger change, no push, merge or PR.
- **Inherited work reviewed:** the full diff and the two new source files. A paid request needs a budget bound once to an open reservation in the canonical ledger, then a one-use grant re-checked against the ledger file, its lock and the initialization marker right before transport. Both gateways pass through `paidTransport`, and the Anthropic SDK's `fetch` wrapper refuses any request outside that context, including direct SDK calls. Anthropic's defaults, model allowlist and smoke configuration are unchanged.
- **OpenAI facts checked against the public docs (read only):** the `gpt-6-luna` model page, `pricing` and `guides/prompt-caching` on developers.openai.com match the code: $0.10 input, $0.01 cache read, $0.125 30-minute cache write, $0.50 output; 2× input/cache and 1.5× output above 272K; `prompt_cache_options` `mode`/`ttl` fields; a documented 10% regional/FedRAMP uplift (applied as a conservative margin).
- **Corrections in this session (`b20953e`):** (1) a ledger refusal raised inside the guard was relabelled by the OpenAI adapter as "OpenAI transport failed.", which failed the noncanonical-ledger test; no request had been sent. Grant checks now always raise a `ModelCallError` that keeps the reason. (2) Codex's type-only import of `ledger.ts` in `budget.ts` failed the existing quest-baseline architecture test (budget.ts may import only `types.ts`). It now declares a structural `ReservationLedger` interface; the existing test was not edited. (3) An OpenAI section was added to `docs/midterm/MODEL_BUDGET.md`.
- **Checks under Node v24.22.1** (official tarball, SHA-256 checked, unpacked in the scratchpad): typecheck and build pass (Vite chunk-size warning only). Offline suite with the three files excluded and 4 workers: first run 817/818 (the architecture test above), after the fix **818/818 tests in 96 files**. The excluded files did not run. The computed worst case of the OpenAI smoke call on the S1 prompt is $0.0056, under its $0.01 reservation.
- **S1 baseline and recording (no model, no paid call):** `npm run eval:live -- --scenario S1 --seed 0 --player baseline-quest` succeeded: 290 ticks, start hash `d9b2359a956db64d…`, end hash `7e22d17e885d2cd2…`, 0 model calls, $0. Its 237-line semantic trace equals S32's recorded run. The video recorded with GPU Chromium, ready and final frames confirmed (gitignored, not committed).
- **Ledger and secrets:** the shared ledger was only listed and hashed, not opened by any run: last modified 2026-10-27 20:54 local, no lock. Secret scan over `docs/agent-sessions`, `docs/midterm`, `packages/agent` and `scripts/midterm`: 5 matches, all the known synthetic canaries in unchanged files (documented 2026-10-27); none in new files.
- **Not done:** no OpenAI or Anthropic request, so account access to `gpt-6-luna`, the real `service_tier` value and the presence of `cache_write_tokens` remain unverified. No `game-rules-audit` run and no independent review of this change. No push, merge or PR.
<!-- narrative:end -->

## Mechanically extracted record

- Skills used: `session-evidence`
- Subagents used: none
- Pull requests referenced in tool output: none
- Files edited through the agent's edit/patch tool: none recorded (edits made by shell commands are not counted)
- Test-summary lines printed in tool output (last 6 distinct, as printed):
  - `Test Files  1 failed | 95 passed (96)`
  - `Tests  1 failed | 817 passed (818)`
  - `Test Files  2 passed (2)`
  - `Tests  45 passed (45)`
  - `Test Files  96 passed (96)`
  - `Tests  818 passed (818)`

Commits whose author time falls inside this window (any branch). A time match is not proof of authorship when sessions overlap; the co-author trailer is shown where present.

| Commit | Author time (UTC) | Subject | Co-author trailer |
| --- | --- | --- | --- |
| `b20953e` | 2026-10-28 05:20 | Add the OpenAI provider and a shared paid-dispatch guard for both providers | Claude Opus 5.5 <noreply@anthropic.com> |
