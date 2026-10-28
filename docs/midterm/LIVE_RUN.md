# Watching AI players live (local launcher)

`npm run eval:live` starts the game server and a browser viewer, then lets two independent AI players, Sieg and Coco, play one tuning scenario in the real game. It is a thin front end on the Phase 4 harness (`runSuite` in `packages/agent/src/harness.ts`). It uses the same suite rules, model budget, shared spend ledger, traces and summaries as `scripts/midterm/evaluate.ts`. It is not a second evaluation framework.

Status (2026-10-27): implemented and tested offline only. **No paid call has been made through it.** Paid runs need the owner's separate approval, a one-time ledger initialization by the owner (below) and a clean committed tree.

## Commands

From the repository root:

```sh
# Offline: the scripted quest baseline, watched in the browser
npm run eval:live -- --scenario S1 --seed 0 --player baseline-quest

# Offline: the model player's full metered path with the mock gateway (no network, no cost)
npm run eval:live -- --scenario S2 --seed 1 --player model-history --gateway mock

# Paid: only after the owner authorizes it
npm run eval:live -- --scenario S1 --seed 0 --player model-history \
  --model claude-haiku-5-5 --effort medium --max-spend-usd 0.20 --paid
```

For a paid run, the launcher reads the key from `ANTHROPIC_API_KEY`. If that is unset, it asks at a hidden prompt, and only after every free check has passed. To keep the key out of shell history, leave the variable unset and use the prompt.

| Option | Meaning | Default |
| --- | --- | --- |
| `--scenario S1\|S2\|S3` | Tuning scenario (required). S4 and F are always refused | |
| `--seed 0\|1` | Tuning seed | `0` |
| `--player` | `baseline-quest`, `baseline-explore`, `model-history`, `model-obs-only` | `model-history` |
| `--gateway anthropic\|mock` | Model players only. `anthropic` needs `--paid` | `anthropic` |
| `--model`, `--effort` | Paid only. Only the owner-approved configuration: `claude-haiku-5-5` at `medium` or `low` (`APPROVED_MODELS` in `llm.ts`, enforced by the gateway) | `claude-haiku-5-5`, `medium` |
| `--max-spend-usd` | Paid only, required. The episode cap: at most the suite cap (S1 $0.20, S2/S3 $1.25). It is reserved in the ledger before the run starts | |
| `--speed` | Game-time speed while watching (1 = real time; 0 = no pacing) | `1` |
| `--no-viewer`, `--no-open` | No server or browser at all / do not open the browser | viewer on |
| `--no-record` | Do not record the viewer to video (for debugging). `--no-viewer` also turns recording off | recording on |
| `--port` | Viewer port, bound to 127.0.0.1 | `3030` |
| `--out` | Output folder | `evaluation-runs/live/<scenario>-seed<n>-<player>-<time>/` |
| `--wall-seconds`, `--max-batch`, `--mock-delay-ms`, `--linger-seconds` | Real-time limit; actions per model reply (1–4); mock thinking time; how long the viewer stays up after the end | harness defaults; 4; 300 ms; 15 s |

## What happens

1. The launcher installs its signal and exit handlers, then checks its arguments. It refuses S4, F, `--final`, `--situations`, `--seeds`, final seeds and any argument that looks like a credential. For paid runs it also checks the approved model and effort, a cap no higher than the suite's and a clean tree. It then opens the shared ledger, which refuses if the ledger is missing, replaced, locked or a legacy ledger exists, checks that the pilot stage can cover the cap, and **closes it again**. Only then does it ask for the key. No ledger lock is held during the prompt or the client build.
2. It builds the game client if `dist/client` is missing or older than the client sources.
3. It starts a local server, `createApp({ manualDriver: true, viewers: true })`, and opens `http://127.0.0.1:<port>/watch`. The page shows Sieg's and Coco's views side by side, each a real game client in view-only mode, plus a status line: who is deciding or acting, the last action, game time, model calls and spend.
4. Unless `--no-record` or `--no-viewer` is given, a headless Chromium (Playwright) opens the same `/watch` page at 1920×1080 and records it (see "Recording" below).
5. For paid runs the ledger is reopened and re-checked. `runSuite` runs one episode. `AgentEnvironment` hands the room it created to the viewer server and ticks it through `app.step()`, the server's own tick function, which also broadcasts snapshots. There is one simulation. Game time is paced to real time while actions run, and stays frozen while a hero decides, as it already did. Scenario prefixes (S2/S3) run unpaced.
6. The terminal shows each action, model call (tokens and cost), message, milestone and the end. Then it prints the result, the start and end hashes, the ledger balance and the trace, summary and results paths.

## Guarantees and how they are tested

| Guarantee | Mechanism | Test |
| --- | --- | --- |
| Watching does not change the game | Same ticks in the same order; the viewer only reads | `liveView.test.ts`: watched S1 (paced, server-driven, a socket viewer sending input and requests) and headless S1 have identical semantic traces, decisions and start/end hashes. Manual check: S2 seed 0 watched and headless both end at `3119923352c08724…` |
| The viewer cannot act | Server-enforced view-only tokens (`SERVER_CHANGES.md` §3) | Viewer input changes nothing; every request returns "View-only session." |
| Players see only their own observations | Unchanged `observe`/`legal_actions` and independent `LLMPlayer`s; the viewer and status page are never given to a player | Existing observation tests; the viewer module never calls the player operations |
| The credential is never on the command line, in logs or in files | Credential-like arguments refused; key removed from the process environment at startup; passed explicitly to the SDK with a fixed endpoint (so `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` cannot apply); redacted from stdout and stderr; output files scanned after the run | Launcher tests with a canary key; `paidSafety.test.ts` (redaction, fixed endpoint) |
| Model text cannot drive the terminal | Every terminal line from the trace goes through `safeText`: control characters, escape sequences and bidi overrides are shown as `\u{..}` | `paidSafety.test.ts` |
| Mock runs are offline and free | `MockGateway`: seeded legal actions, zero cost; a scratch ledger in the run folder | Legal-action and determinism tests; the mock gateway has no network code; the canonical ledger is not created |
| One spending limit for everything | Paid runs use `SpendLedger.openCanonical`, as `evaluate.ts` does (review H1) | `ledgerCanonical.test.ts` |
| Interruption keeps evidence | Before the episode starts, Ctrl-C exits at once with nothing reserved. During it, the first Ctrl-C ends the episode (`manual_stop`); the trace, summary, results and `live.json` are written and the reservation is settled (calls in flight are charged at their reservation). A second Ctrl-C forces exit. The exit handler always releases the ledger lock; an open reservation stays held until it is reconciled (below) | Ctrl-C test: exit 130, verified partial trace, settled scratch ledger, lock released; `paidSafety.test.ts`: handler order, exit releases the lock and keeps the hold |
| No held-out access | Refused by the launcher, and independently by `AgentEnvironment.reset()` for every entrypoint (re-review H2-b) | `liveView.test.ts`, `finalAccess.test.ts` |
| Watched results are identifiable | `run.json` and every `summary.json` record `launch` (launcher, pacing speed or null, viewer), `wallLimitSeconds` and `episodeCapUsd` | `paidSafety.test.ts` |

## Output

`<out>/run.json` (harness manifest), `<out>/<scenario>-seed<n>/trace.jsonl` (hash-chained trace), `summary.json`, `<out>/results.json` and `results.md`, and `<out>/live.json`. Recorded runs add `<out>/recording.webm` and `<out>/recording.json`. `live.json` holds the launcher settings, view count, git version, interruption, error, and the ledger path and balance after the run. Mock runs also have `mock-ledger.json`. Wall-clock fields differ between runs; the semantic trace and state hashes reproduce.

## Recording

Every watched run records a video unless `--no-record` is given. The code is `packages/agent/src/recorder.ts`, wired up in `live.ts`.

- **Passive.** The recorder is one more read-only viewer of `/watch`: a headless Chromium with Playwright's `recordVideo` at 1920×1080. It uses Playwright's full Chromium build (`channel: "chromium"`), which draws WebGL on the GPU. Playwright's default headless shell draws it in software, and with two 1080p game views it fell behind real time: in a recorded S1 run the video still showed 4.3 s of game time when recording stopped. If the full build cannot start, the recorder falls back to the headless shell and records a warning. `recording.json` names the browser used. It loads the page and reads the DOM, nothing else. The server rejects any input or request from viewer sessions anyway (`SERVER_CHANGES.md` §3). It never sees the room or the players, and the players never see it.
- **Before the first action.** The environment has a trusted `ready` hook, awaited at the end of `reset()`: after a scenario prefix and the `reset` trace line, before any hero observes. Game time is frozen while it waits. The recorder waits there until both hero frames show `body[data-playing="true"]`, a sized game canvas, and the HUD's `#stats` line ("… · Connected"). That line is written only by the game scene's update loop, which starts after the assets have loaded. It then waits three animation frames. The runner's wall-clock limit starts after `reset()` returns, so this wait is not counted against it; `summary.json`'s measured `wallSeconds` does include it (asset load was about 5–26 s here, depending on machine load). If the viewer is not confirmed within 60 s, the episode starts anyway and the metadata says `readyConfirmed: false`.
- **End.** After the episode, the recorder waits up to 15 s until the viewer's own status line shows "finished: …", then keeps recording for 3 s so the final screen is in the video. After Ctrl-C it waits at most 3 s and adds no tail; another Ctrl-C cuts these waits short. Then the context is closed and Playwright finalizes the file. `finalConfirmed` in the metadata says whether the end was shown. On the first Ctrl-C the episode stops, its records are written, and the video is saved; exit code 130 as before. A second Ctrl-C forces exit: the video is not finalized and `recording.json` says so.
- **Failure.** If Chromium cannot start, or the video cannot be saved or is empty, the terminal prints `RECORDING FAILED: …`, `recording.json` has `status: "failed"` and `path: null`, and the evaluation continues with its records unchanged. The exit code still reflects the evaluation, not the recording.
- **Metadata** (`recording.json`): run id (the output folder name), scenario, seed, player, model and effort (paid) or gateway label, speed, git version, status (`saved`/`failed`), path, bytes, resolution, browser, `readyConfirmed`, `finalConfirmed`, start, ready and stop times, wall-clock length, `completion` (`success`, `failure`, `timeout`, `interrupted`, `error`, `no_episode`), the episode's reason and hashes, errors and warnings.
- **Unchanged records.** Traces, summaries, `run.json`, `results.*` and `live.json` have the same format. Tested: a recorded S1 run has the same semantic trace and end hash as a headless one (`recorder.test.ts`).
- **Not committed.** `recording.webm`, `recording.json` and `.recording-tmp/` are gitignored wherever `--out` puts them, as is all of `evaluation-runs/`.
- **Tests** (`packages/agent/test/recorder.test.ts`, offline): recorder startup, single save and cleanup, launch failure, unconfirmed viewer, Ctrl-C while waiting, waiting for and holding the final screen, an end that is not shown in time, Ctrl-C during the end wait, save failure (fake browser); the `ready` hook's order and determinism; the launcher with `--no-record`, with a missing browser (`PLAYWRIGHT_BROWSERS_PATH` pointing at an empty folder), a real recorded run, and Ctrl-C during a recorded mock run. The two real-browser cases are skipped when Playwright's Chromium is not installed.

## Shared ledger (owner, once)

```sh
node --import tsx scripts/midterm/ledger.ts          # read-only inventory of every ledger and its balance
node --import tsx scripts/midterm/ledger.ts init     # create the canonical ledger; typed confirmation
```

The ledger is `<git common dir>/oath-eval/spend-ledger.json`. Every worktree shares it. A paid run never creates it. If a legacy `evaluation-runs/spend-ledger.json` exists in any worktree, paid runs refuse until it is adopted with `init --adopt <path>`, which copies its charges and open holds and renames the file. The 2026-10-27 inventory found no ledger anywhere.

`init` also writes a permanent, read-only marker, `spend-ledger.init.json`, with the ledger's id. **Initialization happens once.** If the ledger is later deleted or replaced, paid runs refuse and `init` refuses; restore the ledger from a backup and review the spend. Deleting the ledger never restores the $25.

The inventory also lists other worktrees whose `scripts/midterm/run-episode.ts` can make paid calls outside this ledger (on 2026-10-27: `oath_and_ember-agent`). Never run paid commands there. Paid entrypoints print the same warning.

### Recovering an interrupted reservation

```sh
node --import tsx scripts/midterm/ledger.ts open                      # open reservations and the lock's state
node --import tsx scripts/midterm/ledger.ts unlock                    # only if the lock's process is gone; typed confirmation
node --import tsx scripts/midterm/ledger.ts reconcile <entry> --trace <episode>/trace.jsonl --by "<name>"
node --import tsx scripts/midterm/ledger.ts reconcile <entry> --no-trace --by "<name>"   # charges the whole reservation
```

`reconcile` verifies the trace's hash chain and checks that its `ledger_reservation` line names the entry. It charges every recorded call at its charge plus the **whole hold of every call that started without a record**. A missing, edited or mismatched trace charges the whole reservation. It shows the amount, basis and trace sha256, asks for a typed confirmation, and records the reviewer and evidence in the entry. Nothing is refunded automatically.

## Held-out runs (not through this launcher)

S4, F and the final seeds run only through `evaluate.ts --final`, after the owner records an approval for the exact clean commit:

```sh
node --import tsx scripts/midterm/final-approve.ts --player <kind> --situations S1,S2,S3,S4,F --seeds 100,101 --by "<owner>"
```

This appends a hash-chained approval to `<git common dir>/oath-eval/final-register.jsonl`. Each episode is claimed in the register before it starts, once per approval, and finished afterwards. A claim yields a single-use ticket for one scenario, seed and player kind. `runEpisode` binds it only to policies of that exact kind, and `AgentEnvironment.reset()`, which every entrypoint reaches, admits a held-out or final-seed reset only with a bound, unused ticket and uses it up. Grants and tickets can only come from `authorizeFinalRun()` and `claim()`. No approval has been recorded.

**Route development (not evaluation).** The scripted route (`run-route.ts`) and the route, suite and checkpoint tests reach held-out start states with an explicitly named `routeDevelopmentAccess(purpose)`. It is labelled in the trace's `reset` line, `runEpisode` refuses it (so it never runs a player or produces a result), and at a final seed it allows reset only: any step throws. Policy (re-review M5): `npm test` may build held-out start states this way (`checkpointFreeze.test.ts` pins S4 start hashes at seeds 0, 1, 100 and 101); tests that play held-out content to an outcome (`suite.test.ts`, `route/fullQuest.test.ts`) stay excluded from routine runs.

## Known limits

- A process with shell access could still write the register or ledger through the library. The hash chain makes edits evident, not impossible, and deleting the newest register lines is not detected; summaries record their `finalClaim` hash so a missing claim can be noticed. Code in the same process can still bind a real ticket and then drive other policies by hand, but only after a recorded owner approval, and it leaves a claim in the register.
- Deleting both the ledger and its marker would allow a new initialization. The marker makes accidental loss loud; it cannot stop deliberate deletion.
- The clean-tree check ignores gitignored files. This worktree's `node_modules` is a symlink to `oath_and_ember-agent/node_modules`, so dependencies can change without the commit changing.
- Pacing uses real time against the wall-clock limit (3,600 s for model runs). Compare watched runs with headless ones only when `launch.speed` is recorded, `episodeCapUsd` equals the suite cap, and the episode did not end on `wall_clock_limit`.
- Recordings are VP8 WebM, which is Playwright's only format. Chrome, Firefox and VLC play it; QuickTime does not. At 1920×1080 the existing `/watch` layout leaves the lower part of the frame empty.
- The status line and the client's HUD are for the human watcher. The HUD shows hints that players' observations omit (an owner decision); players never receive it.
- The route still uses the shared navigation and combat helpers (`policies/navigate.ts`, `combat.ts`). The pinned start hashes in `test/route/checkpointFreeze.test.ts` would catch any drift they cause.
