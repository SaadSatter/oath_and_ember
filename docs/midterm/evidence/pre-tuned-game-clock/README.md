# Pre-tuned Situation A game-clock replays

Pilot-28: 7516 ticks / 125.267 game-seconds, manual-stop failure. All 641 results and start/terminal hashes match the original trace. Replay speed 1; no model calls. Pacing metadata records 125.25 seconds for 7515 paced intervals; the episode has 7516 ticks. Startup/final hold add recording overhead.

Pilot-29: supplementary tuning evidence under declaration r5, 3276 ticks / 54.6 game-seconds, manual-stop failure. All 391 results and start/terminal hashes match the original trace. Its original run had no summary.json; a scratch-only locator from original run.json supplied scenario S2-local/player/model-centralized/gitHash 327c34a to the existing replay tool. No original result file was added or changed.

Local video originals remain in `/private/tmp/oath-drive-completion/`; Pilot-28 has an owner-confirmed Drive link below. Recording metadata and decoder results are preserved here after verification. These are labelled replays, not original live captures. No new paid or held-out evaluation.

## Verification and hosting

Both full decodes exited 0 with no decode errors. Sampled start/middle/end frames contain picture content; the terminal frames were visually inspected and show `finished: manual_stop`, 125.3 s / 54.6 s respectively. Encoded lengths are 137.28 s / 67.76 s, including startup/final hold; recorder-session durations are 143.5 s / 70.1 s. Game-clock pacing follows simulation time, not model latency.

[Pilot-28 replay on Drive](https://drive.google.com/file/d/1Jj4wWyVpyuVd3cxroR3P6dD0rAyG17rJ/view?usp=drive_link), identified by the owner as Pilot-28. Pilot-29 remains local, supplementary and optional; no Drive URL supplied. Files are in `/private/tmp/oath-drive-completion/drive-upload/`.
