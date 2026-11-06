# A/B/C evaluation matrix: pre-tuned, post-tuned and cheap baseline

Status of each planned cell. Machine-readable copy: [`evaluation-abc/matrix.json`](evaluation-abc/matrix.json). Updated 2026-11-06 by the Claude Code implementation agent. Only Situation A's pre-tuned cell has a registered result.

The situation labels and the row schema follow the A/B/C proposal on `codex/evaluation-suite-abc` (`0c8ef31`, `EVALUATION_ABC_PROPOSAL.md` and `EVALUATION_ABC_RESULTS_TEMPLATE.json`). That branch is not merged, and its suite is a proposal not yet approved for final runs. Nothing from it is copied here except the labels and field names.

| Situation | Pre-tuned model | Post-tuned model | Cheap baseline |
| --- | --- | --- | --- |
| **A — Full Hedge Maze** (S2-A v2 = `S2-local`, seed 0, tick 405) | **Pilot-30: success** (1 trial; 89.5 game-s, 167 calls, $0.443; [record](evaluation-abc/A-pretuned-pilot30.json), [audit](PILOT30_AUDIT.md)) | Pending ([proposal](SITUATION_A_POST_TUNING_PROPOSAL.md), not approved or run) | Pending¹ |
| **B — Partial Hedge Maze** (S2-B v2, seed 0, tick 1197) | Pending | Pending | Pending¹ |
| **C — Wig Already Obtained** (proposed) | Pending | Pending | Pending |

¹ A `baseline-quest` reference run already exists for A (v2 seed 0, offline: success, 3,128 ticks / 52.1 s, 395 decisions, end `6644f2ca…`; `midterms/saadsatter/evidence/traces/baseline-quest-S2-local-seed0-v2/`) and for B (v2 seed 0: success, 2,487 ticks, 284 decisions; [HEDGE_MAZE_SITUATIONS.md](HEDGE_MAZE_SITUATIONS.md)). They are **not registered** as the A/B/C baseline cells: which scripted player is "the cheap baseline" and how many trials it needs are still open. Note that `baseline-quest` is solution-aware, not an equal-information competitor.

## Notes on the cells

- **A, pre-tuned.** "Pre-tuned" means before explicit puzzle-solution prompt tuning, not before any development. See [PILOT30_AUDIT.md §6](PILOT30_AUDIT.md#6-what-pre-tuned-means-here). It is a pilot (ledger stage `pilot`, `final: false`) and one trial. Whether it counts as run 1 of A's planned trials is an owner decision.
- **B.** "Partial Hedge Maze" is the existing frozen S2-B (guards cleared, hedge burned, cow still in the lane). Not the historical S2-C ("Wolf and key"), which keeps its own id.
- **C.** Proposed, and frozen only on Codex's branch for offline engineering certification (`ABC-C-wig-obtained-v1`). It is not on this branch, has no model run, and is held out. Its objective is to return from the Hedge Maze with the Divine Wig and complete Chapter 0 through the normal goddess interaction (`chapter0.complete`). Not implemented or run here.
- **Players.** Pilot-30 is the `model-centralized` player (one planner for both heroes). Model cells should use the same player kind per row so that pre- and post-tuned differ only in the prompt.

## The course requirement (provisional interpretation)

The owner reports that the professor asks for **pre-tuned and post-tuned model play on each situation, plus a cheap baseline**. This is recorded as provisional until it is confirmed against the course instructions. The written guidelines ([MIDTERM_GUIDELINES.md](MIDTERM_GUIDELINES.md), "Evaluation") ask for something related but different:

- a suite declared **before tuning**, normally three situations with **two live trials** per situation;
- some cases **reserved from prompt tuning** (held out);
- the baseline run on the same cases;
- outcomes, illegal actions, limits, latency, tokens and dated cost, failures included.

They do not mention a pre/post-tuned comparison. Under the written rules, A is a tuning case and C would be the held-out case, so C should not receive a post-tuned prompt built from C. The matrix is compatible with both readings, but trial counts (one versus two per cell) need the owner's decision.

## Video delivery

Pilot-30's live video (202,356,926 bytes, SHA-256 `f5100df99e6d248f89f8ceea37e4e8bb86e223bcb01f5d131c1f9aae072c4414`) is not in Git: GitHub refuses files over 100 MiB. At the owner's choice it is delivered as a GitHub release asset: [pilot-30-model-centralized-S2-local-seed0-live.webm](https://github.com/SaadSatter/oath_and_ember/releases/download/pilot-30-evidence/pilot-30-model-centralized-S2-local-seed0-live.webm) (release [`pilot-30-evidence`](https://github.com/SaadSatter/oath_and_ember/releases/tag/pilot-30-evidence)). A downloaded copy matches the SHA-256.
