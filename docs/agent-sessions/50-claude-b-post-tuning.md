# 50 — Situation B post-tuning: A-derived guidance, observation parity, declaration r7 and preflight

| Field | Value |
| --- | --- |
| Agent | Claude Code (CLI); model id(s) recorded in the transcript: `claude-opus-5-5` |
| Role | Claude Code implementation agent under CLAUDE.md: Situation B post-tuned prompt-only guidance (b-post-a-transfer-v1) from the Situation A heuristic baseline, owner-approved observation parity for griffin-unprepared-v1, declaration r7 and the paid-run preflight; session-evidence invoked by name in this session. The rules-reviewer subagent was launched by this session in a separate invocation at the owner's request, read-only and not instructed to approve; its findings are committed verbatim. |
| Session ID | `3a986109-9c11-48a5-902a-6631f11dc353` |
| Window (UTC) | 2026-11-06 22:08 → 2026-11-06 22:28 |
| Session URL | None. Local session; no shareable URL was created. |
| Repository | `https://github.com/SaadSatter/oath_and_ember`, branch(es) `midterm/evaluation` |
| Transcript | Local only, not committed: `~/.claude/projects/-Users-saadsatter-Classes-AI-Pract-Building-Games-oath-and-ember-eval/3a986109-9c11-48a5-902a-6631f11dc353.jsonl` |

> Guidance written after Pilot-31 (B pre-tuned) was run and its trace read: the B pre/post contrast is tuning on B, not a transfer test. No paid call, no push, no merge. Commits 6276656, 732c998, ec135fe and this record's commit.

## Owner instructions (redacted)

1. 2026-11-06 22:08 — [pasted brief] 1. Inspect the completed B pre-tuned run and baseline, preserving their evidence. 2. Extract general-purpose heuristics from the successful Situation A baseline, especially spatial reasoning, systematic positioning, search, and feedback-based recovery. 3. Add those heuristics as prompt-only guidance to the existing B model controller. 4. Keep the Griffin's rules, observations, controller code, model, a … (870 characters; full text in the local transcript)
2. 2026-11-06 22:18 — [pasted brief] Proceed with the following decisions for Situation B. 1. **Prompt:** Conditional approval of `b-post-a-transfer-v1`, hash `60a0a013…`. Do not modify its text. Request an independent `rules-reviewer` pass on commit `6276656`, specifically checking for hidden-state leakage, solution-specific instructions, and differences beyond the appended guidance block. 2. **Observations:** Approved to make the smalle … (1511 characters; full text in the local transcript)

<!-- narrative:start -->
## What was done

Sources: the local Claude Code transcript, Git state and commands executed in this session. The claims below are **verified** by those commands unless marked as the agent's report; this is implementation evidence, not an independent review or the owner's personal team log.

- **Asked:** inspect the B pre-tuned run (Pilot-31) and the B baseline without changing their evidence; take general heuristics from the successful Situation A heuristic baseline; add them as prompt-only guidance to the existing B planner; keep rules, observations, controller, model and start unchanged; freeze the prompt and prepare one B post-tuned run. The owner noted that inspecting Pilot-31 would make this tuning on B, acceptable if documented.
- **Inspection:** Pilot-31's trace was read in full (timeline in `docs/midterm/B_POST_TUNING_TRANSFER.md` §1); its trace SHA-256 still matches its record. No evidence file was changed.
- **Guidance `b-post-a-transfer-v1`** (commit `6276656`; text `60a0a013…5263`, unchanged since). **Post-hoc B tuning caveat:** it was written after Pilot-31 was run and read, so B pre/post is tuning on B, not an independent transfer test.
- **A-derived vs Pilot-31-influenced** (per line, `B_POST_TUNING_TRANSFER.md` §2, corrected after review):
  - *From the A baseline* (`mazeHeuristic.ts`): seen-earlier things may have moved, record tried position/aim combinations, frontier search with backtracking, notes on searched areas, forgetting blocked results when the world changes.
  - *A mechanism, extended after Pilot-31:* blocking bodies includes "enemies"; candidate positions for "a ranged attack" with "a clear straight line"; expected results include "a target's shown health falls"; "two tries… timing… which hero"; recharging ability not a reason to stand still (from A, chosen because Coco waited 26 times).
  - *Shaped by Pilot-31:* "do not stand on top of a target" (Coco overlapped the Griffin), and "move off any area an effect is about to cross… do not wait for damage". The reviewer judged that last line a B-specific dodge rule in effect, and its last sentence has no A source.
  - *Left out:* a health-budget line, because the A baseline has no such mechanism.
- **Independent review:** the `rules-reviewer` subagent was launched in a separate invocation on `6276656` at the owner's request (read-only, not asked to approve). It found no hidden-state leak; the guidance path changes only the prompt and policy metadata; there are 4 Medium findings on provenance wording, controller evidence and the nest observation. Report verbatim: `docs/midterm/agent-evidence/reviews/2026-11-06-b-post-transfer-rules-review.md`; responses in `B_POST_TUNING_TRANSFER.md` §7. Planner and controller files verified byte-identical to `6df4bc0` and pinned by test.
- **Observation parity** (owner-approved, commit `732c998`): the straw-nest entry from `4c9cf9f` is omitted for `griffin-unprepared-v1` only. The new test replays Pilot-31's actions: 293/293 observations byte-identical, 284/284 step hashes match.
- **Declarations:** r7 (`ec135fe`) made `griffin-unprepared-v1` the B scenario, per the owner's second message. The owner then decided to run B post-tuned on `griffin-unprepared-return-v1`, as B/post-tuned/1, with the guidance approved for both scenarios. r8 records this, and r6 and r7 are archived byte for byte. Code allows `model-centralized` on the return scenario (3,600 s wall ceiling). On that scenario the prompt is `17b89312…` (no tutorial or briefing), and B pre and post differ in scenario, framing and observations, which is disclosed.
- **Not done:** no paid call, push or merge. The recorded mock preflight (viewer + video) was stopped by the owner before it finished, so it has no result. A free headless mock check on the return scenario and a paid-refusal check (before approval) were run. A free, unregistered baseline run on `griffin-unprepared-v1` succeeded (76.1 game-s). The `session-evidence` skill was invoked by name in this session.
<!-- narrative:end -->

## Mechanically extracted record

- Skills used: `session-evidence`
- Subagents used: `rules-reviewer`
- Pull requests referenced in tool output: none (the example URL quoted in MIDTERM_GUIDELINES.md was also printed; it is not a PR of this project and is not listed)
- Files edited through the agent's edit/patch tool: 5 (`packages/agent` 3, `docs/midterm` 2)
- Test-summary lines printed in tool output (last 6 distinct, as printed):
  - `Tests  1 failed | 1315 passed (1316)`
  - `Tests  1 failed | 1 passed (2)`
  - `Tests  2 passed (2)`
  - `Tests  5 passed (5)`
  - `Test Files  6 passed (6)`
  - `Tests  51 passed (51)`

Commits whose author time falls inside this window (any branch). A time match is not proof of authorship when sessions overlap; the co-author trailer is shown where present.

| Commit | Author time (UTC) | Subject | Co-author trailer |
| --- | --- | --- | --- |
| `ec135fe` | 2026-11-06 22:27 | Declaration r7: griffin-unprepared-v1 is the official Situation B pre/post scenario | Claude Opus 5.5 <noreply@anthropic.com> |
| `732c998` | 2026-11-06 22:25 | Restore Pilot-31 observation parity for griffin-unprepared-v1; record review round 1 | Claude Opus 5.5 <noreply@anthropic.com> |
| `6276656` | 2026-11-06 22:17 | Freeze B post-tuned candidate b-post-a-transfer-v1 (proposed, not approved) | Claude Opus 5.5 <noreply@anthropic.com> |
