# game-rules-audit: recording

| Field | Value |
| --- | --- |
| Date | 2026-10-29 |
| Session | 01a1862b-11b1-73a1-9828-21459c7588fc |
| Session URL | None. Local session; no shareable URL was created. |
| Skill file SHA256 | 03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756 |
| Commit audited | 88587ce, dirty with recording changes and an unrelated .DS_Store change |
| Target and focus | recording: stage diagnostics, owned process cleanup, independent viewer grace |
| Files read | AGENTS.md, CLAUDE.md, midterm guidelines/checklist/recurring instructions/evidence index/handoff/interface/plans, player manual, recorder.ts, shutdown.ts, live.ts, liveViewer.ts, server app close handler, recorder tests, installed Playwright lifecycle implementation, pilot-11/12 summaries and traces |
| Commands run | git diff/status/rev-parse/diff --check; skill SHA256; Node 24 typecheck/build; focused and full recorder Vitest commands; existing secret scanner; local offline recording/playback/forced-timeout probes. Exact commands and final results in the session evidence. |

## Findings

| # | Severity | Source | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Info | H/M | recorder.ts | The earlier 1080p full recorder test attempt failed a 240 s browser-test deadline and interrupted recording failed; one new test had an overstrict 20 ms active-stage assertion. | Earlier attempt is not green. | Preserve these failures in evidence. Rerun after the final-capture barrier, 720p default and corrected timing assertion. At audit time that full rerun is pending. |
| 2 | Low | H | recorder.ts | Forced encoder cleanup uses bounded POSIX ps inspection, checks direct parent pid and this recording's unique artifact directory. A real forced context-close timeout terminated its encoder and browser, confirmed encoder exit and found no remaining owned encoder. | Windows process inspection and permission-restricted ps are not validated; diagnostics report inspection failure. SIGKILL of the launcher itself cannot execute normal cleanup. | Retain this platform limitation. Do not claim universal process-cleanup guarantees. |

This is a same-session implementation checkpoint, not independent review.

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass in diff scope | Passive recording/viewer lifecycle only; no gameplay writes added. |
| 2 Rules and art preserved | Pass in diff scope | No server/shared/client/artwork edits; unrelated .DS_Store preserved. |
| 3 Real mechanics, no fixtures | Pass | Offline recording uses ordinary S1 baseline and existing runSuite/viewer. The forced cleanup probe uses an explicitly synthetic HTML page, not claimed as gameplay. |
| 4 Observation boundaries | N/A | No observation or perception changes. |
| 5 Legal actions | N/A | Unchanged. |
| 6 Player context | N/A | No player prompt, knowledge or policy changes. |
| 7 Independent players | N/A | Unchanged. |
| 8 One interface | Pass in diff scope | Existing runSuite and baseline reused. Video resolution changes presentation only. |
| 9 Limits/reasons | Pass in diff scope | Recording deadline remains 120 s. Test-only forced probe uses 1 ms. No model/game budget changes. |
| 10 Determinism | Pass for S1 probe | Headless and recorded seed-0 final hashes match: 7e22d17e885d2cd2e1a25258f046a8d2a29c1c02da00d47e488a6bc78d861bae. Both traces pass integrity checks. |
| 11 Suite/reporting | Pass in diff scope | No suite, pins, baseline policy, historical trace or held-out material changed or executed. Pilot-11/12 existing S2-local traces were read and hash-verified only. |
| 12 Sync/recording honesty | Pass with limits | Actual dual hero views in final screenshot; 4.8 game seconds, 42.76 encoded seconds including startup/pauses/tail. 1280x720, 3,723,034 bytes. Playback and near-end seek verified in Chromium. No Pilot replay video claimed. |
| 13 Validation | Partial at audit time | Initial 8 new checks passed; broad attempt 19 passed/3 failed; selected rerun 20 passed/2 skipped. Typecheck and build passed. Final full recorder rerun pending. Full npm test deliberately not run because unrelated suites reach held-out content. |
| 14 Secrets/reporting | Pass for owned scan | Eight source/diagnostic files scanned with zero findings; final evidence docs scanned separately. Earlier failures and remaining platform/replay limitations disclosed. |

## Recommended tests

Finish the in-progress recorder test rerun; record its exact results. Broader gameplay tests are not required for this presentation-only change and held-out tests remain prohibited.

## Open questions for the owner

Pilot-11/12 traces contain per-hero action streams, intermediate result hashes, terminal hashes and Shears milestones, but the active system still has no trace-to-viewer adapter. A small offline adapter using the existing environment/scheduler/viewer/recorder would need separate approval before implementation. Matching all recorded hashes must precede accepting a recovered video.
