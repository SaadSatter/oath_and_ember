# 29 — Independent review of the Phase 4 launcher, re-review fixes, and the legacy-runner paid guard

| Field | Value |
| --- | --- |
| Agent | Claude Code (CLI); model id(s) recorded in the transcript: `claude-opus-5-5` |
| Role | Mixed session under CLAUDE.md and AGENTS.md. Turn 1: read-only review of Phase 4 commits bc377ee..b612285, which a different session built, so independent of that builder (not the rules-reviewer subagent). Turns 2-3: implementation agent fixing that review's findings in oath_and_ember-eval and, with owner approval, oath_and_ember-agent. Those fixes have not been independently reviewed. Turn 4: session-evidence skill invocation (this record) |
| Session ID | `ffcdac23-0885-4f87-b386-13d2e487cf89` |
| Window (UTC) | 2026-10-27 22:00 → 2026-10-28 00:03 |
| Session URL | None. Local session; no shareable URL was created. |
| Repository | `https://github.com/SaadSatter/oath_and_ember`, branch(es) `midterm/evaluation` |
| Transcript | Local only, not committed: `~/.claude/projects/-Users-saadsatter-Classes-AI-Pract-Building-Games-oath-and-ember-eval/ffcdac23-0885-4f87-b386-13d2e487cf89.jsonl` |

## Owner instructions (redacted)

1. 2026-10-27 22:00 — [pasted brief] Perform an independent, READ-ONLY review of the newly implemented Oath and Ember Phase 4 live AI-agent evaluation launcher. You are reviewing work produced by a separate implementation session. Do not assume the implementation report is correct. First read CLAUDE.md, AGENTS.md, docs/midterm/PHASE4_HANDOFF.md, EVALUATION_SUITE.md, MODEL_BUDGET.md, LIVE_RUN.md, and the relevant agent/session evidence. Re … (2583 characters; full text in the local transcript)
2. 2026-10-27 22:46 — [pasted brief] The independent Claude review is complete. Address its confirmed findings before we authorize paid evaluations. Work in oath_and_ember-eval on midterm/evaluation. Read the existing handoff, the independent review findings, and relevant implementation files. Priority 1 — Held-out authorization: - Fix H2-a: grants must not be forgeable, reusable, or valid for an unapproved player policy. - Fix H2-b: enfo … (2147 characters; full text in the local transcript)
3. 2026-10-27 23:32 — [pasted brief] I approve Option 1 for H1-a. Make a narrowly scoped safety change in the oath_and_ember-agent worktree on midterm/agent-interface. 1. Inspect scripts/midterm/run-episode.ts and identify every path that can invoke the real Anthropic gateway. 2. Disable real paid model execution from this legacy runner. Fail closed with an actionable message directing users to the canonical Phase 4 runner in oath_and_emb … (1067 characters; full text in the local transcript)
4. 2026-10-27 23:58 — [pasted brief] Before closing this session, invoke the session-evidence skill and verify that all work from this session is documented under docs/agent-sessions/. Include the session link, objectives, worktree and branch, commits, files changed, test results, independent review findings, approvals, unresolved issues, and handoff instructions. Check whether an existing session record should be updated rather than crea … (710 characters; full text in the local transcript)

<!-- narrative:start -->
## What was done

Sources: owner instructions above, the mechanically extracted transcript, current git state, and commands run in this session. Results below are **verified** by those commands unless marked as the agent's report. The extraction is a snapshot of this ongoing session; later events are summarized here. No shareable URL was created.

- **Turn 1, read-only review** (worktree `oath_and_ember-eval`, branch `midterm/evaluation`, HEAD `b612285`) of commits `bc377ee`, `d701242`, `ab7ae51`, `5f9074f`, `aea9570`, `b612285`, which an earlier, separate session built. Nothing was modified. The review ran 6 targeted test files, **70/70 passed**, plus the 2 static `checkpointFreeze` tests (its S4 resets were skipped on purpose). A throwaway `/tmp` git repo confirmed four defects: a forged `FinalGrant` passed the runner gate with zero approvals; a finished claim still admitted further runs; the gate took no player kind; and a deleted ledger re-initialized to $25. Findings as reported: High: H2-a (forgeable/reusable grants, player kind ignored), H2-b (gate only in `runEpisode`), H1-a (`oath_and_ember-agent` at `f351278` had a paid `run-episode.ts` outside the ledger). Medium: M1 (ledger deletion), M2 (model/effort not restricted), M3 (stale lock during launcher build), M4 (no reconciliation), M5 (S4 resets at final seeds in `npm test`). Low: L1–L7. Recommendation: GO offline watched evaluation; GO ledger initialization; conditional GO one smoke call; NO-GO held-out final evaluation. This review is independent of the builder session, but it is **not** the `rules-reviewer` subagent. The full findings text is in the local transcript only.
- **Turn 2, fixes in `oath_and_ember-eval`** (owner-approved), as local commits: `37f4c66` (H2-a/H2-b/M5: module-private grants, single-use `EpisodeTicket` bound to the exact player class, gate in `AgentEnvironment.reset()`, labelled `routeDevelopmentAccess` that never runs players and is reset-only at final seeds); `c6761a7` (M1/M4: permanent ledger init marker, in-memory adoption check, traced `ledger_reservation`/`model_call_start`, `reconcile()`, `ledger.ts open/unlock/reconcile`, read-only unmetered-worktree warning); `f5cf5cf` (M2/M3/L1–L4: `APPROVED_MODELS` = `claude-haiku-5-5` at medium/low enforced in `AnthropicGateway`, smoke only at medium, launcher lock window closed and exit handler, `safeText`, key redaction and fixed endpoint, `launch`/`wallLimitSeconds`/`episodeCapUsd`/`finalClaim` in summaries, per-hero mock streams); `8837f88` (stale-lock test polls instead of sleeping); `6bee662` (`LIVE_RUN.md`, `MODEL_BUDGET.md`, `PHASE4_HANDOFF.md`). Diff `b612285..6bee662`: 27 files, +1,404/−221 (verified with `git diff --stat`). New tests: `finalAccess.test.ts` (rewritten), `ledgerRecovery.test.ts`, `paidSafety.test.ts`. Existing tests edited: `checkpointFreeze`, `ledgerCanonical`, `harness`, `suite`, `route/fullQuest`; the last two were not run (held-out policy). Most edits were made through shell/Python scripts, so the extracted "files edited" count (4) understates them; `git show --stat` on each commit is authoritative.
- **Turn 2 checks:** `npm run typecheck` pass; `npm test -- --exclude packages/agent/test/suite.test.ts --exclude packages/agent/test/route/fullQuest.test.ts` **730/730 tests, 94 files** after the flaky-test fix (one earlier full run: 729/730, failing on the stale-lock timing fixed in `8837f88`); `npm run build` pass (Vite chunk-size warning only); `git diff --check` pass. The 730-test run includes `checkpointFreeze.test.ts`, which resets S4 at seeds 0, 1, 100 and 101 under route-development access (reset only, no player); the pinned hashes matched. The `error TS…` lines in the extraction came from intermediate states that were fixed before each commit.
- **Turn 3, H1-a fix** (owner approved Option 1) in worktree `oath_and_ember-agent`, branch `midterm/agent-interface`: commit `b18cd0f` changes `scripts/midterm/run-episode.ts` (+18/−40) and adds `packages/agent/test/legacyRunner.test.ts`. `--policy anthropic` and `--policy openai` now fail closed before any gateway, key read or output, pointing to `evaluate.ts` in `oath_and_ember-eval`. The baseline is unchanged. Checks there: new test **4/4**; `npm run typecheck` pass; `npm run build` pass; `npm test` **567/568**. The one failure, `apps/client/test/playerView.test.ts` (expected 25, got 26), was reproduced on an untouched `git archive` export of `f351278`, so it predates the change; it was not fixed. Back in `oath_and_ember-eval`: no changes, the ledger inventory reports `unmeteredWorktrees: []`, and 5 harness/paid-safety/ledger/access test files passed **55/55**.
- **Approvals recorded in owner instructions:** fix the confirmed findings without paid calls, held-out episodes, ledger initialization, push, merge or PR (turn 2); H1-a Option 1 in the agent worktree only (turn 3); this evidence record (turn 4). Not done, as instructed: no paid model call, no ledger initialization (`.git/oath-eval/` does not exist), no S4/F episode with a player, no push, merge, rebase or PR, no change to the main worktree (which already had unrelated uncommitted changes), no worktree deleted.
- **Skills:** `session-evidence` invoked by name in turn 4 (this record). `game-rules-audit` was **not** invoked in this session. No subagents were used.
- **Unresolved:** the turn 2–3 fixes have not had an independent review (`rules-reviewer` in a separate session). Remaining risks, as documented in `PHASE4_HANDOFF.md`: in-process code can still deliberately misuse a real ticket after an owner approval; deleting both ledger and marker allows re-initialization; register truncation is not detected by the chain; the clean-tree check ignores gitignored files (this worktree's `node_modules` is a symlink into `oath_and_ember-agent`); live provider behaviour and billing are untested. The untracked `docs/midterm/agent-evidence/skill-runs/2026-10-27-recording.md` (not from this session) keeps the eval tree dirty, so paid runs refuse until it is committed or removed.
- **Handoff:** (1) independent re-review of `b612285..6bee662` and `b18cd0f`, using the commands at the end of the turn-2 report and in `PHASE4_HANDOFF.md`; (2) the owner initializes the ledger with `node --import tsx scripts/midterm/ledger.ts` then `... ledger.ts init`, from `oath_and_ember-eval`; (3) a separately approved smoke call, `node --import tsx scripts/midterm/evaluate.ts --smoke --paid --model claude-haiku-5-5 --effort medium`, on a clean tree, preferably after a `game-rules-audit` checkpoint.
<!-- narrative:end -->

## Mechanically extracted record

- Skills used: `session-evidence`
- Subagents used: none
- Pull requests referenced in tool output: none
- Files edited through the agent's edit/patch tool: 4 (`packages/agent` 4)
- Test-summary lines printed in tool output (last 6 distinct, as printed):
  - `Tests  2 passed | 7 skipped (9)`
  - `Tests  4 passed (4)`
  - `Test Files  1 failed | 75 passed (76)`
  - `Tests  1 failed | 567 passed (568)`
  - `Tests  1 failed | 17 passed (18)`
  - `Tests  55 passed (55)`
- TypeScript errors (`error TS…`) appeared in tool output at least once during the session.

Commits whose author time falls inside this window (any branch). A time match is not proof of authorship when sessions overlap; the co-author trailer is shown where present.

| Commit | Author time (UTC) | Subject | Co-author trailer |
| --- | --- | --- | --- |
| `b18cd0f` | 2026-10-27 23:34 | Disable paid model runs in the legacy episode runner (re-review H1-a) | Claude Opus 5.5 <noreply@anthropic.com> |
| `6bee662` | 2026-10-27 23:14 | Document the re-review fixes, ledger recovery and the held-out test policy | Claude Opus 5.5 <noreply@anthropic.com> |
| `8837f88` | 2026-10-27 23:14 | Wait for the child's lock in the stale-lock test | Claude Opus 5.5 <noreply@anthropic.com> |
| `f5cf5cf` | 2026-10-27 23:09 | Restrict paid runs to the approved model and harden the launchers (re-review M2, M3, L1-L4) | Claude Opus 5.5 <noreply@anthropic.com> |
| `c6761a7` | 2026-10-27 23:09 | Make the shared ledger tamper-evident and its interruptions reconcilable (re-review M1, M4, H1-a warning) | Claude Opus 5.5 <noreply@anthropic.com> |
| `37f4c66` | 2026-10-27 22:57 | Gate held-out resets in the environment with single-use tickets (re-review H2-a, H2-b) | Claude Opus 5.5 <noreply@anthropic.com> |
