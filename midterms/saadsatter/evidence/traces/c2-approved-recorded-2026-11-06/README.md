# C2 approved baseline, recorded

Owner requested this recording after approving the unchanged `baseline-griffin-heuristic-v1` (not the exploratory inventory baseline). Run at clean commit `19e5d87`, seed 0, `griffin-prepared-return-v1`, speed 1. Success in 5389 ticks / 89.8 game seconds and 103.3 episode wall seconds; 1127 decisions, zero counted invalid actions, zero model calls/tokens/cost. Actual `chapter0.complete`, no knockout. Start `28777a85…`, end `0e419e63…`.

Route: combat defeat. Mirror and Shears were only marked delivered after HP reached zero, with no peaceful grooming. This run does not demonstrate prepared-item benefit. Stale concurrent dialogue presses appear in trace but are excluded by the runner's invalid-action accounting.

[Watch local recording](../../../../../evaluation-runs/live/c2-approved-recorded-2026-11-06/recording.webm). Saved 13,804,248 bytes, 1280×720, 112.5 recording-session wall seconds, ready/final confirmed. Video is local-only, not committed. Full decode passed; terminal frame inspected. Deterministic replay matched start, every result and terminal hash. See recording.json, verification.json, terminal.png and manifest.json. No model run, policy change or declaration activation. Active r9 remains unchanged; this is a recorded C2 result for the separately approved C candidate, not a silent activation of proposed r10.
