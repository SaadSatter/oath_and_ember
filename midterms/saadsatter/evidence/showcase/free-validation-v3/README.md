# Shrine-start showcase — free validation revision 3

Code source `e5d2dfe58bff3e008bf7be29be2dc24766964b92`, Node v26.9.0. Scenario id retained by owner request; definition version 3 has a new start/hash. Prior revision evidence is historical and preserved. Excluded from official A/B/C results. No paid call or real reservation.

Normal `goddess` checkpoint, tick zero; both heroes at the shrine, no prefix or fixture. Opening greeting and quest dialogue occur within this trace. The baseline explicitly waits one game second on each opening line through ordinary actions for presentation; no server timing or model policy is changed. `opening-proof.json` extracts displayed dialogue, including the actual quest request. Ten strictly ordered first-occurrence milestones prevent an early-combat detour from qualifying later.

The free scripted baseline succeeds in 10,166 ticks (169.4 game-s), decisions 1,125/1,228, zero invalid actions and model calls. Its labelled speed-1 replay verifies every result/start/end/tick. Recovery certification, not another baseline/model result, succeeds after two real knockouts in 10,951 ticks (182.5 game-s); its privileged probe-only target and full progress snapshots are disclosed in its report. Trace gzip files decode to original bytes; hashes are in provenance. Decode into scratch beside summary.json, then use `node --import tsx scripts/midterm/replay-video.ts <trace.jsonl> --check-only`.

All nine official A/B/C traces replay exactly. Protected paths and twelve frozen run paths remain unchanged. Targeted suites pass 17/17; typecheck/build pass. See permitted-tests.txt for the broad suite, including its known recorder-timeout assertion failure; scripted S1–S3 checks pass six/skip one. No held-out/full-route tests.

The actual replay video stays local and is identified by hash in local-video.json. It is baseline gameplay, not a model showcase or submission claim. Full decode and actual opening/quest/terminal-frame inspection are documented in the current handoff. Live action-boundary wait skipping remains a timing caveat; model capture and exact-action replay must be labelled honestly.

Paid source guard remains false, revised guidance proposed with no approved hash. New exact-hash approval is required. See [current shrine-start handoff](../../../../../docs/midterm/SHOWCASE_SHRINE_START.md) for reviewer findings, timings, bounds, estimates and the proposed paid command.
