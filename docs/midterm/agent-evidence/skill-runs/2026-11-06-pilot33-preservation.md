# game-rules-audit: Pilot-33 preservation

2026-11-06, America/New_York. Session `01a1aed2-3232-7011-bb41-5fccdea13a5c`, local, no shareable URL. Same-session preservation checkpoint, not independent review. Source/run commit `1f0ca45`. Only this report written during this read-only checkpoint. Game-rules-audit skill SHA256 `03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756`.

| Check | Evidence/result |
| --- | --- |
| Authority, rules, scenarios, art | `git diff --exit-code 1f0ca45 -- apps packages scripts/midterm scripts/evidence` passes. No gameplay/policy/frozen-scenario change. |
| Real mechanics and complete trace | Existing replay-video.ts --check-only verifies chain, start, 443 results, end success/hash and 3057 ticks. No model used during replay. |
| Outcomes | Authoritative defeat, wig holding/claim, offering and chapter0-complete milestones retained; no knockout. |
| Interface/isolation | Original centralized policy kind and joint-information exception preserved. No new player context or observations introduced. |
| Budgets/failed usage | 251 calls, 5 rejected replies, 1 invalid action, 0 failed/timed-out/unknown-usage calls; summary/trace retained. Cost $0.554417 is saved runner estimate, not invoice/current pricing. |
| Evidence immutability | Seven original run files copied byte-for-byte. Full trace includes raw replies and policy notes. Original video untouched, 188269515 bytes, SHA256 in manifest. |
| Video | All frames decode, exit 0, encoded length 2188.88 s. The 1x1 PNG sink warns about 16:9 sample aspect ratio, separately recorded; no WebM decode errors. Full-resolution last frame inspected: finished success and Chapter 0 milestones visible. |
| Clocks | 3057 game ticks =50.95 s (displayed 51.0), 2184.4 episode wall-s, 2201.3 recording-session wall-s; encoded duration distinct. No host-suspension diagnosis inferred. |
| Declaration/failures | Owner explicitly designates Pilot-33 post-tuned primary after outcome. R9 archives r8 (v1 guidance pin); failed Pilot-32/v1 retained. V4 was tuned after that failure; not a preregistered v4 primary or repeated same-policy sample. Pre-tuned Pilot-31 used different start/task/observations. |
| Held out | C unchanged/unrun; no paid evaluation launched. |
| Checks | Metadata hash/allocation check: 9 cells, 6 observed; seven file equality checks pass. Changed artifact/report scan: 13 text files, 0 findings. No typecheck/build rerun necessary for preservation/docs-only changes. |
| Sharing | Local video link only; no public upload, push or merge. No model run during preservation. |

Limitations: neither full statistical evaluation nor independent review. Metadata finalConfirmed is backed here by direct terminal-frame inspection; this does not imply every intermediate gameplay frame was visually reviewed. No fresh price verification or provider bill. Source guidance and raw event record remain inspectable at their original hashes.
