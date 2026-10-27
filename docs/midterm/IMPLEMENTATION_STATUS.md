# Midterm implementation and evidence status

Updated 2026-10-23. Architecture approval authorizes implementation. The user selected GPT-5.6 and approved **$5 maximum total for the pilot and evaluation**, not $5 per run. Paid calls made so far: **zero**. No credential belongs in this repository or traces. The runner reads only `OPENAI_API_KEY`; it was absent from the tool process during verification. Replace the credential disclosed in chat before a live run.

## Implemented

The trusted evaluation host starts the ordinary shrine lobby with empty inventory, drives the authoritative server at 60 ticks per second, accepts paired bounded intent plans, uses opaque observation/UI handles, and relays bounded messages. Each policy runs in a separate Node process with an independent history and restricted filesystem access. Only rendered browser information is projected into policy observations. Trace events include observations, submitted actions, model records, effective inputs, state hashes and terminal outcomes. Model requests reserve cost before dispatch using explicitly supplied prices; failed requests retain their reservation.

Native continuous browser recording is enabled for both players. Gameplay advances against real wall time at 1x, with no screenshots or accelerated frame selection. Decision and startup pauses remain in the recording. Separate WebM recordings are the primary evidence. The optional side-by-side encoder needs a full FFmpeg installation and is not yet verified; recordings must not be described as synchronized dual-view footage until their recording epochs are aligned.

## Evidence and limits

- Evaluation suite: 26 tests passed, including browser visible-DOM filtering and local fake-provider worker isolation. Additional cancellation regression added after that run; see final verification below.
- Typecheck passed; production client/server build passed.
- A development smoke run on scenario A seed 1101 executed 600 authoritative ticks (10 simulated seconds), 26 submissions per role, then terminated with `time_limit`. Cost and model calls were zero. Artifacts are in `evaluation-artifacts/development-smoke-20261023/`. This is a weak observation-only baseline smoke test, not a quest completion or formal evaluation.
- The privileged fresh-quest route helper acquired the pond reward from an empty inventory, then failed to find a route to the return point. Full fresh-quest completion remains unverified. This helper reads internal state and is never the fair baseline or model input.
- Scenarios A/B are usable development configurations. Scenario C input delay and the sealed held-out campaign are preregistered but incomplete; the runner deliberately refuses them.
- Deterministic replay scaffolding exists, but end-to-end replay with per-tick agreement and final video remains unverified.
- The current exploration baseline is intentionally weak and has not demonstrated full completion. Do not claim a meaningful performance comparison from the smoke run.
- Only the first independent application of the reusable review skill is complete. A second fresh review session and final evidence audit remain outstanding. The personal team log belongs to the user.

## Commands

Run `npm run build` first. Local development smoke:

```sh
node --import tsx scripts/evaluation/run-shrine.ts --mode baseline --seconds 10 --seed 1101 --output /tmp/oath-smoke
EVALUATION_BROWSER_TESTS=1 EVALUATION_SOCKET_TESTS=1 npx vitest run packages/evaluation/test
```

A paid run additionally requires the environment key, explicit current input/output prices and their official source, and `--max-spend-usd` within the **remaining aggregate $5 approval**. Do not launch concurrent or repeated $5 runs. Maintain a cumulative spend record before any real requests. No paid command is presented as ready until the missing completion gates above are resolved.

## Final verification for this increment

The evaluation integration suite passed **27/27**, including both new engine regressions, browser DOM filtering and independent worker isolation. Typecheck passed. The full suite completed with **560 passed, 1 failed, 2 skipped**: the remaining directional sprint test expects atlas frame 25 and receives 26 at 200ms (`apps/client/test/playerView.test.ts:512`). The evaluation identity-tag test-double failures were fixed. The production build passed earlier in this increment; no authoritative gameplay changes were made to resolve the sprint assertion. This increment is not a completed formal evaluation.
