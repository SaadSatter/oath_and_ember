# Pilot-11: first LLM success on the Hedge Maze (S2-local), with a replay video

The owner's paid tuning pilot on 2026-10-29: revision 2 `S2-local`, seed 0, player `model-guided`, OpenAI `gpt-6-luna` at medium effort, git `74adda8`, ledger entry `pilot-11`.

**Result: success** in 2,316 game ticks (38.6 game-seconds).
- 147 model calls (Sieg 101, Coco 46), $0.083545 charged.
- 0 invalid actions.

**This is the model-guided baseline.** `model-guided` receives a static, source-verified walkthrough of the Hedge Maze in its system prompt (`docs/midterm/GUIDED_MAZE_BASELINE.md`). It is not information-equal to `model-history` or `model-memory`, and it must never be reported as an unaided model result.

## Files

All files are copied byte for byte from the owner's local run folder (`evaluation-runs/`, which is not committed). They contain the run's local absolute paths, which include only the owner's public GitHub login.

| File | What it is |
| --- | --- |
| `trace.jsonl` | The hash-chained evaluator trace: every observation, action, result, model call and the outcome. SHA-256 `7441f0a52ce4f3a92074f2210dd2adcd61e1a718ef87d51063cab6ab6c53d22f` |
| `summary.json`, `results.json`, `results.md` | The episode summary and the harness's result rows |
| `run.json`, `live.json` | The launch configuration and the launcher's record (paid, cap $0.30, not interrupted) |
| `replay.webm` | The video, 1280×720, 234.6 s wall time |
| `replay-recording.json` | The video's manifest |

## The video is a replay, not a live capture

The live run recorded no video of its own. `replay.webm` was rendered afterwards by a replay tool that re-runs the recorded actions through the real game engine and records the browser viewer at normal speed. It makes 0 model calls.

The manifest records what was checked:
- `kind: "replay"`;
- the source trace's SHA-256 (it equals this `trace.jsonl`);
- `matchesTrace: true` with no mismatches;
- `endReason: "success"` at 2,316 episode ticks.

The tool was run from a working tree at `88587ce` with uncommitted changes (`gitHash: "88587ce+dirty"`): the replay tool itself, `scripts/midterm/replay-video.ts`, which was committed afterwards in `444bc55`. `node --import tsx scripts/midterm/replay-video.ts docs/midterm/evidence/pilot-11-model-guided/trace.jsonl --check-only` re-checks the replay against this trace without a viewer or video.

Rubric check 5c asks for a recording of live model play. This video shows real model play, replayed from its trace, and is labelled as a replay wherever it is linked. The repository's `.gitignore` excludes `recording.webm` files from run folders; this copy is committed deliberately at the owner's request (2026-10-29) as the submission's recording.
