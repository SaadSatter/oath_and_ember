# Hedge Maze evidence: traces, recordings and manifest

This folder holds the evidence for the primary evaluated episode, **S2-local, the Hedge Maze** (suite revision 2: from the maze entrance, put the Enchanted Shears in the shared backpack). The results and how to read them are in [EVALUATION.md](../EVALUATION.md).

| Path | What it is |
| --- | --- |
| [manifests/evidence-manifest.json](manifests/evidence-manifest.json) | Every run: pilot id, policy, scenario, seed, git hash, model, outcome, stop reason, recording type, and each file's source path, destination, size and SHA-256 |
| [manifests/evidence-manifest.md](manifests/evidence-manifest.md) | The same, as tables (generated, do not edit) |
| `traces/<run>/` | Each run's hash-chained `trace.jsonl`, `summary.json` (authoritative result), launch records (`run.json`, `live.json`), result rows and recording manifest |
| [../docs/midterm/evidence/pilot-11-model-guided/](../docs/midterm/evidence/pilot-11-model-guided/README.md) | Pilot 11, committed earlier and referenced in place (not duplicated) |

## Runs

| Evidence | Policy | Result (authoritative `summary.json`) | Recording |
| --- | --- | --- | --- |
| `baseline-quest-live` | scripted reference | success, 49.8 game-s, 340 decisions, 0 invalid, 6 messages | **live** viewer capture |
| `baseline-quest-repro-1..3` | scripted reference | identical to the live run: same start and end hash | none (offline runs) |
| `pilot-11` | `model-guided` (LLM + walkthrough) | success, 38.6 game-s | **replay**, verified against the trace |
| `pilot-12` | `model-guided` (LLM + walkthrough) | success, 44.0 game-s | **replay**, verified against the trace (the live capture failed to save) |
| `pilot-13` | `model-memory` (unaided LLM + memory) | stopped by the owner after the key gate refused the heroes, 76.1 game-s | **replay**, verified against the trace (no live video was saved) |
| `pilot-15` | `model-memory` (unaided LLM + memory) | interrupted by the owner at the cow puzzle, 33.5 game-s. Not a terminal failure | **live** viewer capture |

**Live** means the browser viewer recorded the episode while it was played. **Replay** means `scripts/midterm/replay-video.ts` re-ran the recorded actions through the real engine afterwards, with zero model calls, and checked every step against the trace (`matchesTrace: true`, and the manifest names the trace's SHA-256). A replay shows real model choices but is not a live capture, and is labelled as one wherever it is linked.

## Recordings and delivery

Videos are **not committed** to this folder. They are generated, large (one is 95 MB), and the course asks for large generated files to stay out of the PR. Each video's SHA-256 is in the manifest, so a downloaded copy can be checked against it.

| Video | Type | Size | Capture wall time | Delivery |
| --- | --- | --- | --- | --- |
| `baseline-quest-live` | live, scripted baseline (not an LLM) | 8.2 MB | 75.3 s | **pending** |
| `pilot-11` | replay, guided LLM | 14.3 MB | 234.6 s | committed in `SaadSatter/oath_and_ember` at `docs/midterm/evidence/pilot-11-model-guided/replay.webm` (public repository). Excluded from the course package by `MANIFEST.txt` |
| `pilot-12` | replay, guided LLM | 6.8 MB | 62.1 s | **pending** |
| `pilot-13` | replay, unaided LLM | 12.3 MB | 114.1 s | **pending** |
| `pilot-15` | live, unaided LLM | 99.7 MB | 1,161.5 s | **pending**. Too large to commit comfortably (GitHub warns above 50 MB and refuses above 100 MiB) |

"Capture wall time" is the recorder's start-to-stop time from its manifest, which includes page start-up; it is not a measured video duration. Wall time is never game time: game time runs only while both heroes have an action running, so model latency does not change the game (pilot 15 spent 1,161 s of real time for 33.5 s of game time).

To build a video bundle for upload, outside the repository:

```sh
python3 -I scripts/midterm/collect_evidence.py --videos-out ~/oath-ember-video-bundle
```

It copies each available video to `recordings/<evidence>-<live|replay>.webm` and checks its SHA-256. Until a video is uploaded somewhere the instructor, TAs and peer reviewers can open, and the link has been checked, its delivery stays **pending**. Where to host them is the owner's decision.

## Known caveats of the scripted baseline recording

1. **The viewer's final clock reads 43.1 s; the authoritative result is 49.8 s** (2,990 ticks at 60 ticks per second, from `summary.json`). The episode result, not the on-screen clock, is the measurement. The clock reading was reported by the owner from the video and has not been re-measured in this session. Fixing the viewer clock is a separate follow-up; the recorder and `live.ts` were not changed here.
2. **Human HUD goal hints are visible in the video.** The browser viewer draws the HUD goal lines a human player sees. Neither the scripted players nor the model players receive them: they are deliberately hidden from every agent's observation (owner decision, 2026-10-27; `packages/agent/src/perception.ts`).
3. **Version `7022ea1+dirty`.** The run was launched while another session had uncommitted changes (`scripts/midterm/replay-video.ts`, the replay tool, which the live launcher and the baseline do not use). The three offline reproducibility runs, also at `7022ea1+dirty`, end at the same hash, `bf31311f6c56638bc7e5a6a45b9eaa621fa5042963c6e7c477e2ce74e729f936`, as the live run. The same pinned end state appears in the committed freeze test `packages/agent/test/scriptedFreeze.test.ts` ("quest/S3", the revision 1 id of the same Hedge Maze start).

## Reproduce and verify

```sh
# Check every packaged file against the manifest, re-verify the trace hash chains,
# and re-derive each outcome from its summary.json. Works in the course folder too.
python3 -I scripts/midterm/collect_evidence.py --verify

# Re-run the scripted reference baseline (free, offline, deterministic). Expect
# success, 2,990 ticks, end hash bf31311f…f936.
node --import tsx scripts/midterm/evaluate.ts --player baseline-quest --situations S2-local --seeds 0

# Re-check a replay against its trace without rendering a video.
node --import tsx scripts/midterm/replay-video.ts evidence/traces/pilot-12-model-guided-S2-local-seed0/trace.jsonl --check-only
```

`collect_evidence.py` without `--verify` re-collects from the owner's local `evaluation-runs/` folders. It never overwrites a file that differs, and it stops if any published number disagrees with a run's `summary.json`. Model runs are paid and are not re-run by any command here.
