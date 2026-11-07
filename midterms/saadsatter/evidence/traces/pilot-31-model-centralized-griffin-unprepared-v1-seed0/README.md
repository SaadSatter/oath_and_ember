# Pilot-31: model-centralized on griffin-unprepared-v1 (Situation B), seed 0 — pre-tuned

**Model-driven play** (OpenAI `gpt-6-luna`, medium effort) by the `model-centralized` player (one LLM planner, two legal per-hero controllers; [MODEL_CENTRALIZED.md](../../../../../docs/midterm/MODEL_CENTRALIZED.md)). Launched by the owner on 2026-11-06 at clean commit `6df4bc0` (live viewer, speed 1, $0.75 cap, ledger entry `pilot-31`). Local run folder: `evaluation-runs/live/griffin-unprepared-v1-seed0-model-centralized-openai-2026-11-06T20-02-49-455Z/` (gitignored). Registered by the owner as **B/pre-tuned/1** ([record](../../../../../docs/midterm/evaluation-abc/B-pretuned-pilot31.json)).

- **Scenario.** The enclosure-only `griffin-unprepared-v1` (definition `bbbbc435…1374`, start `1a270d7b…0051`, tick 439), not declaration r6's `griffin-unprepared-return-v1`. See the record for why the owner counts it as B pre-tuned.
- **Outcome.** `knocked_out` at 3,007 ticks (50.1 game-s), 1,486.5 s wall clock. Sieg's health ran out (16 HP, then a hit during HEADBUTT CHARGE) while the Griffin showed `152/640`. No wig. 287 decisions (Sieg 146, Coco 141), 1 invalid action, 0 messages, 117 model calls (0 failed), $0.265961 charged.
- **Policy.** `centralized-f0592888(openai:gpt-6-luna@medium)·batch4·tutorial-2ec2f251·briefing-5fa93722`, no guidance; prompt hash `cbabb78b…bb6a` for both heroes.
- **Files.** Byte-for-byte copies of the run folder's files (`trace.jsonl` and `summary.json` from its `griffin-unprepared-v1-seed0/` subfolder); absolute local paths remain as written. SHA-256 values are in [verification.json](verification.json).
- **Verification.** The trace chain verifies (1,804 lines). An offline replay (`replay-video.ts --check-only`) at `6df4bc0` matches the start hash, all 284 step results, the end (`knocked_out`, `c5f341f5…9a61`) and 3,007 ticks.
- **Video.** Live capture, 1280×720, 1,504.6 s, 138.7 MB, SHA-256 `5e7c3588…7f0a`. Not committed; it stays in the local run folder.
