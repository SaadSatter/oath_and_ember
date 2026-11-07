# 42 — Opt-in persistent memory player (model-memory)

| Field | Value |
| --- | --- |
| Agent | Claude Code (CLI); model id(s) recorded in the transcript: `claude-opus-5-5` |
| Role | Implementation agent (Claude Code, CLAUDE.md and AGENTS.md) on midterm/evaluation: Workstream B, the opt-in model-memory player (per-hero persistent memory). Invoked game-rules-audit (same-session checkpoint, not an independent review) and session-evidence for this record. No subagent and no independent review. |
| Session ID | `682df3aa-7696-4130-bea0-211def84d0f6` |
| Window (UTC) | 2026-10-29 05:06 → 2026-10-29 05:49 |
| Session URL | None. Local session; no shareable URL was created. |
| Repository | `https://github.com/SaadSatter/oath_and_ember`, branch(es) `midterm/evaluation` |
| Transcript | Local only, not committed: `~/.claude/projects/-Users-saadsatter-Classes-AI-Pract-Building-Games-oath-and-ember-eval/682df3aa-7696-4130-bea0-211def84d0f6.jsonl` |

> No paid call, held-out S4/F run or inspection, pin change, gameplay change, push or merge. The full npm test, route/seed1, checkpointFreeze, suite.test.ts and finalAccess.test.ts were not run because they reach held-out content. The model-guided session edited the same worktree concurrently; this session paused shared-file edits until its commits (3b7115b, 74adda8) landed.

## Owner instructions (redacted)

1. 2026-10-29 05:06 — [pasted brief] You are working on Workstream B: Persistent Agent Memory for the Oath and Ember midterm evaluation. Repository: oath_and_ember Worktree: oath_and_ember-eval Branch: midterm/evaluation Read CLAUDE.md, docs/midterm/PILOT10_DIAGNOSIS.md, and the relevant evaluation architecture before making changes. ## Background Pilot-10 (S2-local Hedge Maze, seed 0) was manually stopped after 44.8 game-seconds, 221 mod … (7923 characters; full text in the local transcript)

<!-- narrative:start -->
## What was done

Sources: owner instructions above, commands run in this session, and Git state. Results below are **verified** by those commands unless marked otherwise. The extraction is a snapshot of this ongoing session, taken before its commits, so it lists no commits; `dc00de2` is verified with `git log`. No shareable URL was created.

- The owner asked for an opt-in `model-memory` player for the two LLM heroes. It was to have a per-hero tile map (seen versus walked), dated sightings, verified events and the hero's own sent messages, with no pathfinding or solution, and with existing players and baselines unchanged. Offline only.
- **Concurrent session.** Mid-session, another session (the `model-guided` workstream) was found editing the same worktree's shared registration files with uncommitted changes. The agent stopped and asked; the owner chose "Wait for guided to commit". The agent developed in a scratch export of HEAD outside the repository and moved its files into the worktree only after the guided commits `3b7115b` and `74adda8` had landed and the tree was clean.
- Before any change, the agent recorded prompt digests of a scripted 40-decision S2-local seed-0 episode for `model-history` and `model-obs-only`, at `346cdd4` and `3b7115b`. They were identical at both commits and are now pinned in a test.
- **Implementation `dc00de2` (verified):**
  - new `packages/agent/src/heroMemory.ts` (imports types only);
  - a `persistent` memory mode and `MEMORY_SECTION` prompt in `policies/llm.ts`;
  - `steps[k].after` (the mid-batch observation) on the turn report in `runner.ts`/`policy.ts`;
  - `model-memory` registered in `playerKinds.ts`, `kind.ts`, `harness.ts`, `live.ts` and `evaluate.ts`, restricted to S1–S3 tuning runs;
  - new `packages/agent/test/modelMemory.test.ts` (27 tests) and `test/helpers/promptCapture.ts`;
  - `docs/midterm/MODEL_MEMORY.md` and pointers in `AGENT_INTERFACE.md`, `LIVE_RUN.md`, `EVALUATION_SUITE.md` and `EVIDENCE_INDEX.md`.
- **Checks run in this session (verified):**
  - typecheck pass; `modelMemory.test.ts` 27/27;
  - permitted agent files 438/445, the 7 failures timeouts or a recording-timing check at load average ~59; the 6 affected files then 107/107 with `--maxWorkers=1`;
  - `scriptedFreeze -t 'baseline on S[123]'` 6 pass, 1 skipped (`route/seed1`);
  - quest and exploration baselines on S2, S3, S2-local and S3-local identical before (`74adda8`) and after;
  - server/shared/client 557/558 (`npcTalk.test.ts` failed once, then passed 3/3 alone); build pass; secret scan of changed files 0 findings.
- The agent first ran the wider test set in the scratch export, where launcher tests failed with "not a git repository". Those results were not used.
- `game-rules-audit` was invoked by name at the checkpoint: `docs/midterm/agent-evidence/skill-runs/2026-10-29-adapter-model-memory.md`, with 6 findings (2 Medium, 4 Low), no Critical or High. It is a same-session audit, **not an independent review**.
- **Not done:** no paid call; no S4/F, `route/seed1`, `checkpointFreeze`, `suite.test.ts` or `finalAccess.test.ts` run; no full `npm test`; no pin change; no push or merge; no `rules-reviewer` run. The proposed S2-local pilot command in `MODEL_MEMORY.md` §6 was not run.
<!-- narrative:end -->

## Mechanically extracted record

- Skills used: `game-rules-audit`, `session-evidence`
- Subagents used: none
- Pull requests referenced in tool output: none
- Files edited through the agent's edit/patch tool: 5 (`/private` 2, `docs/midterm` 2, `packages/agent` 1)
- Test-summary lines printed in tool output (last 6 distinct, as printed):
  - `Tests  6 passed | 1 skipped (7)`
  - `Test Files  1 failed | 77 passed (78)`
  - `Tests  1 failed | 557 passed (558)`
  - `Tests  4 passed (4)`
  - `Tests  1 failed | 35 passed (36)`
  - `Tests  9 passed (9)`

Commits whose author time falls inside this window (any branch). A time match is not proof of authorship when sessions overlap; the co-author trailer is shown where present.

| Commit | Author time (UTC) | Subject | Co-author trailer |
| --- | --- | --- | --- |
| `dc00de2` | 2026-10-29 05:45 | Add the opt-in model-memory player: per-hero remembered map, last-seen things, verified events and sent messages | Claude Opus 5.5 <noreply@anthropic.com> |
| `74adda8` | 2026-10-29 05:20 | Record guided Maze walkthrough, rule audits, offline verification and pilot proposal | — |
| `3b7115b` | 2026-10-29 05:15 | Add opt-in LLM-guided Hedge Maze baseline with metered static instructions | — |
