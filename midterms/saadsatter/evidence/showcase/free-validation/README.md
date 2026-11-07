# Showcase free validation

> **Prompt-tuned continuous gameplay demonstration — excluded from official A/B/C evaluation results.**

Free (no model, no network, $0) validation of `showcase-maze-griffin-complete-v1` before any paid call. Design and decisions: [docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md](../../../../../docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md). Every run here was made from the clean implementation commit `c30d2fb`. The replay video was made at `6fc3102`, which only changes how the replay script waits between ticks.

| Path | What it is |
| --- | --- |
| `showcase-check.json` | Definition hash, start hashes at seeds 0 and 1 (each equal to S2-A's and identical on repeat), guidance and full-prompt hashes, proposed limits and paid scope |
| `guidance-showcase-maze-griffin-v1.txt` | The proposed guidance text, exactly (SHA-256 `c0f7382e…9c61`) |
| `planner-system-prompt.txt` | The planner's whole system prompt for the proposed paid run (SHA-256 `fecf10c7…f753`) |
| `baseline-live/` | The free scripted baseline (`baseline-showcase-route-v1`, **a baseline, not a model**), played live in the viewer at speed 1 and recorded: `summary.json`, `run.json`, `live.json`, `results.*`, `recording.json`, the gzipped hash-chained `trace.jsonl.gz`, `replay-check.txt` and `video-check.json` |
| `baseline-replay/` | The same episode re-rendered from its trace by `replay-video.ts` with game-clock pacing: `recording.json` (`matchesTrace: true`, paced 141.65 s for 141.65 game-s) and `video-check.json` |
| `mock-model/` | `model-centralized` + the proposed guidance with the **mock gateway** (random legal actions). A launcher and prompt-path check, **not a result** |
| `full-test-result.txt` | `npm test` at the implementation: 1,381 of 1,382 pass; the one failure is the pre-existing recorder timing test (fails identically at `eeb2b59`) |
| `manifest.json` | SHA-256 and size of every file here, of each uncompressed trace, and of the two local videos |

## Results

| Run | Outcome | Game time | Decisions (Sieg / Coco) | Invalid | Model calls | Start → end hash |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline, live, recorded | **success** | 141.7 s (8,500 ticks) | 962 / 1,064 | 0 | 0 | `fdc49877…` → `2678c3a0…` |
| Mock model | `error` (planner stall watchdog) | 240.3 s | 1,074 total | 3 | 108 (mock, $0) | `fdc49877…` → `2dc8b8b2…` |

Baseline milestones (game-s): maze complete 31.5 · Griffin HP 0 at 85.2 · wig claimed after the defeat 127.9 · offering accepted 138.7 · `chapter0.complete` 141.7. Both traces replay exactly through the real engine (start hash, every step result, end hash and ticks).

## Videos (local only, not committed)

| Video | Length | Notes |
| --- | --- | --- |
| `evaluation-runs/live/showcase-free-baseline-c30d2fb-seed0/recording.webm` | 209.2 s | Live capture, 1280×720. Includes viewer start-up, the unpaced start prefix and the end hold; full decode OK |
| `evaluation-runs/live/showcase-free-baseline-seed0-replay-6fc3102/recording.webm` | 151.7 s | Verified replay, 1280×720, titled "REPLAY … (recorded actions, no model calls)"; the episode part plays in real time; full decode OK |

SHA-256 values are in `manifest.json`. These are free baseline videos, not the showcase recording, which needs the owner-approved paid run.
