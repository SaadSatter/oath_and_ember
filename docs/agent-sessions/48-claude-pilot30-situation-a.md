# 48 — Pilot-30 evidence audit, Situation A pre-tuned registration, A/B/C matrix and post-tuning proposal

| Field | Value |
| --- | --- |
| Agent | Claude Code (CLI); model id(s) recorded in the transcript: `claude-opus-5-5` |
| Role | Claude Code implementation agent under CLAUDE.md: evidence preservation, verification and reporting for Pilot-30 (Situation A pre-tuned); session-evidence invoked by name; not independent review. |
| Session ID | `13d00d43-3fa6-48e9-a7b0-009f310f5e14` |
| Window (UTC) | 2026-11-06 16:38 → 2026-11-06 16:57 |
| Session URL | None. Local session; no shareable URL was created. |
| Repository | `https://github.com/SaadSatter/oath_and_ember`, branch(es) `midterm/evaluation` |
| Transcript | Local only, not committed: `~/.claude/projects/-Users-saadsatter-Classes-AI-Pract-Building-Games-oath-and-ember-eval/13d00d43-3fa6-48e9-a7b0-009f310f5e14.jsonl` |

> No paid calls, model episodes, gameplay, scenario, policy or pin changes. The original run folder was not modified. The owner asked for the commits to be pushed.

## Owner instructions (redacted)

1. 2026-11-06 16:38 — [pasted brief] # Task: Register Pilot-30 as Situation A — Pre-Tuned Model Evaluation We have our first successful model-driven Hedge Maze episode. I want to preserve it as **Situation A / Pre-Tuned** in the midterm evaluation. This is an **evidence preservation, verification, and reporting task only**. Do not run any paid models, change gameplay, tune prompts, or alter the original evidence. ## 1. Identify the succes … (5179 characters; full text in the local transcript)

<!-- narrative:start -->
## What was done

Sources: the local Claude Code transcript, Git state and commands executed in this session. The claims below are **verified** by those commands; this is implementation evidence, not an independent review or the owner's personal team log.

- **Owner's request.** Preserve Pilot-30 (S2-local seed 0, `model-centralized`, `gpt-6-luna` medium, success) as Situation A's pre-tuned result: verify the evidence, register it additively, update the A/B/C matrix, propose a post-tuned comparison without implementing it, and list risks. No paid calls, new episodes, gameplay, scenario or policy changes, or evidence overwrites. In chat the owner also asked to push the commits, the logs and the recording.
- **Verified.** Trace hash chain (`verifyTrace`, 3,823 lines); offline replay with `replay-video.ts --check-only` at `040685c` matched the start hash, 644 step results, end hash `6deca113…` and 5,369 ticks; `situation-a.ts` confirmed definition hash `7efb771a…` and start hash `fdc49877…`; per-call sums equal the summary (167 calls, $0.443258, tokens); the ledger entry `pilot-30` settled at $0.443259; `verify-video.ts` fully decoded the 1,962.56 s video and the final frame shows "finished: success"; the HUD hint text is absent from the trace; secret scan 0 findings.
- **Committed.** `e6da000`: byte-for-byte copies of the run's trace and JSON files plus `README.md` and `verification.json` in `midterms/saadsatter/evidence/traces/pilot-30-model-centralized-S2-local-seed0/`. `ff11a44`: `PILOT30_AUDIT.md`, `evaluation-abc/A-pretuned-pilot30.json` (row schema of the template on `codex/evaluation-suite-abc` `0c8ef31`, read only), `EVALUATION_ABC_MATRIX.md`, `evaluation-abc/matrix.json`, evidence index entry. `de29af1`: `SITUATION_A_POST_TUNING_PROPOSAL.md`.
- **Video.** At the owner's choice (asked in this session), the unchanged 202 MB video was uploaded as a GitHub release asset ([`pilot-30-evidence`](https://github.com/SaadSatter/oath_and_ember/releases/tag/pilot-30-evidence)); a downloaded copy matched SHA-256 `f5100df9…4414`. Branch `midterm/evaluation` was pushed at the owner's request (`840a8ce..ba88d2a`).
- **Not done.** The video is not in a commit (over GitHub's 100 MiB limit). The provider's actual bill and the recorded prompt and config hashes were not independently recomputed. `npm run typecheck`, `npm test` and `npm run build` were not run: the change is documentation and evidence only. Codex's worktree was not modified.
- **Owner's follow-up.** The owner reclassified Pilot-30 as post-tuned, asked what changed between Pilots 28 and 30, then asked to register Pilots 28 and 29 as pre-tuned, describe the comparison through the prompt tuning only, and start from Codex's declared suite. This session fast-forwarded `midterm/evaluation` onto `codex/pilot30-griffin-planning` (`5388b23`, Codex's declaration r3 and EVALUATION.md). It then wrote declaration r4: Pilot-28's row filled from its own `summary.json` (r3 had nulls), Pilot-29 added as A/pre-tuned/2, and `A_PROMPT_TUNING.md` built from the planner prompt source at `678b86c`, `327c34a` and `040685c`. The agent kept a one-sentence disclosure that controller code changed in the same commits and told the owner why.
- **Verified (follow-up).** Pilot-28 and Pilot-29 evidence copied byte-for-byte; both trace chains verify; offline replays match all step results and end hashes (Pilot-29's through a scratch stand-in summary, since none was written); manual, task, tutorial, briefing, model, batch, limits and game code are identical across the three runs.
- **Follow-up commits and videos.** `0ff5345` (declaration r4, records, `A_PROMPT_TUNING.md`, docs) and `2528948` (Pilot-28/29 evidence), pushed at the owner's request. The unchanged Pilot-28 and Pilot-29 videos are in the release [`pilot-28-29-pretuned-evidence`](https://github.com/SaadSatter/oath_and_ember/releases/tag/pilot-28-29-pretuned-evidence); downloaded copies match their SHA-256, and `verify-video.ts` fully decoded both.
- **Revision 5 (owner decision).** The owner set one pre-tuned, one post-tuned and one baseline run per situation, with Pilot-29 as supplementary. Declaration r5 reduces the results to 9 rows and archives r4 under `evaluation-abc/history/`. The agent ran `baseline-quest` on S2-local seed 0 twice offline at `af0f19e`: success in 52.1 game-s, identical actions, end hash `6644f2ca…` (the pinned value), $0. It is preserved in `midterms/saadsatter/evidence/traces/baseline-quest-A-cheap-baseline-S2-local-seed0/`. Situation A is complete; no paid call.
- **Secret scan:** `scan_secrets.py docs/agent-sessions docs/midterm` plus the Pilot-30 evidence folder reports 1 finding: the pre-existing `anthropic-key` pattern at line 18 of `docs/midterm/agent-evidence/skill-runs/2026-10-27-recording.md` (committed in `4193424`, unchanged, may not be edited; recorded in S32, S36 and S40). The value was not printed. This session's files scan with 0 findings.
<!-- narrative:end -->

## Mechanically extracted record

- Skills used: `session-evidence`
- Subagents used: none
- Pull requests referenced in tool output: none
- Files edited through the agent's edit/patch tool: 4 (`docs/midterm` 3, `midterms/saadsatter` 1)
- Test-summary lines printed in tool output: none found

Commits whose author time falls inside this window (any branch). A time match is not proof of authorship when sessions overlap; the co-author trailer is shown where present.

| Commit | Author time (UTC) | Subject | Co-author trailer |
| --- | --- | --- | --- |
| `de29af1` | 2026-11-06 16:57 | Propose a controlled Situation A post-tuned comparison (not implemented) | Claude Opus 5.5 <noreply@anthropic.com> |
| `ff11a44` | 2026-11-06 16:56 | Register Pilot-30 as Situation A's pre-tuned result and add the A/B/C matrix | Claude Opus 5.5 <noreply@anthropic.com> |
| `e6da000` | 2026-11-06 16:54 | Preserve Pilot-30 evidence: model-centralized success on S2-A seed 0 | Claude Opus 5.5 <noreply@anthropic.com> |
