# Pilot-33 — B post-tuned model success

Owner-recorded `model-centralized` run on `griffin-unprepared-return-v1`, seed 0, commit `1f0ca45`, `gpt-6-luna` medium, guidance **b-post-combined-v4**. Success: actual combat defeat, wig acquisition, offering acceptance and `chapter0.complete`, no knockout.

**51.0 game seconds / 3,057 ticks**, 2,184.4 episode wall seconds, 445 decisions, 251 calls, 1 invalid action, 5 unusable replies; $0.554417 runner estimate. Input tokens 4,871,133 (cache included), output 157,250; cache read 1,595,500/write 3,274,880. Mean call latency 8,492 ms, max 28,053 ms. Zero failed/timed-out/unknown-usage calls. Recording session wall time is separately 2,201.3 s. Recording started November 6, 2026, 18:57 EST and stopped 19:33 EST.

- [Complete trace with model responses and policy notes](trace.jsonl)
- [Summary](summary.json) · [Launch configuration](run.json) · [Results](results.json)
- [Recording metadata](live-recording.json) · [SHA256 manifest](manifest.json)
- [Watch original local recording](../../../../../evaluation-runs/live/griffin-unprepared-return-v1-seed0-model-centralized-openai-2026-11-06T23-57-08-007Z/recording.webm) (local evaluation checkout only; 188,269,515 bytes, SHA256 `6af860495e545d94343a8674360e4d341509421f5bab30261bd1528bb5e879c3`). Video not committed or uploaded.

The original trace chain verifies. Offline replay (no model calls) matches the start, all 443 results, terminal success/end hash and 3,057 ticks. Start `45b1a6aa2c164b2c31885d6e5d514fc8d7eae190ef76d7aad4422445f38db9b8`, end `6fd8c37f7fe956e48e04adace7265b6318842da30302947a703e4198c9b89da0`. Seven archived run files match their originals byte-for-byte. [Video/replay verification](verification.json): full decode exit 0; encoded duration 2188.88 s; no WebM decode errors. A 1x1 PNG-sink sample-aspect-ratio warning is recorded separately. The inspected full-resolution final frame shows `finished: success` and Chapter 0 completion milestones. [Inspection frame](terminal-frame.png) is supplementary verification, not a substitute for the original video.

The owner allocated Pilot-33 to B/post-tuned/1 after seeing its outcome. R8 pinned earlier guidance used by the **failed Pilot-32**, retained in its original record and evidence. This is not a preregistered v4 primary trial, not two same-policy repetitions, and not a prompt-only comparison against Pilot-31 (different checkpoint/task/observations). No failures are erased. No new paid run, scenario change, push or upload occurred during preservation.
