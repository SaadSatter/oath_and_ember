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
| `--model`, `--effort` | Paid only. A model must have a verified price in `llm.ts` | `claude-haiku-5-5`, `medium` |
| `--max-spend-usd` | Paid only, required. The episode cap: at most the suite cap (S1 $0.20, S2/S3 $1.25). It is reserved in the ledger before the run starts | |
| `--speed` | Game-time speed while watching (1 = real time; 0 = no pacing) | `1` |
| `--no-viewer`, `--no-open` | No server or browser at all / do not open the browser | viewer on |
| `--port` | Viewer port, bound to 127.0.0.1 | `3030` |
| `--out` | Output folder | `evaluation-runs/live/<scenario>-seed<n>-<player>-<time>/` |
| `--wall-seconds`, `--max-batch`, `--mock-delay-ms`, `--linger-seconds` | Real-time limit; actions per model reply (1–4); mock thinking time; how long the viewer stays up after the end | harness defaults; 4; 300 ms; 15 s |

## What happens

1. The launcher checks its arguments. It refuses S4, F, `--final`, `--situations`, `--seeds`, final seeds and any argument that looks like a credential. For paid runs it also checks for a clean tree, a known price and a cap no higher than the suite's. It then opens the shared ledger, which refuses if the ledger is missing, locked or a legacy ledger exists, and checks that the pilot stage can cover the cap. Only then does it ask for the key.
2. It builds the game client if `dist/client` is missing or older than the client sources.
3. It starts a local server, `createApp({ manualDriver: true, viewers: true })`, and opens `http://127.0.0.1:<port>/watch`. The page shows Sieg's and Coco's views side by side, each a real game client in view-only mode, plus a status line: who is deciding or acting, the last action, game time, model calls and spend.
4. `runSuite` runs one episode. `AgentEnvironment` hands the room it created to the viewer server and ticks it through `app.step()`, the server's own tick function, which also broadcasts snapshots. There is one simulation. Game time is paced to real time while actions run, and stays frozen while a hero decides, as it already did. Scenario prefixes (S2/S3) run unpaced.
5. The terminal shows each action, model call (tokens and cost), message, milestone and the end. Then it prints the result, the start and end hashes, the ledger balance and the trace, summary and results paths.

## Guarantees and how they are tested

| Guarantee | Mechanism | Test |
| --- | --- | --- |
| Watching does not change the game | Same ticks in the same order; the viewer only reads | `liveView.test.ts`: watched S1 (paced, server-driven, a socket viewer sending input and requests) and headless S1 have identical semantic traces, decisions and start/end hashes. Manual check: S2 seed 0 watched and headless both end at `3119923352c08724…` |
| The viewer cannot act | Server-enforced view-only tokens (`SERVER_CHANGES.md` §3) | Viewer input changes nothing; every request returns "View-only session." |
| Players see only their own observations | Unchanged `observe`/`legal_actions` and independent `LLMPlayer`s; the viewer and status page are never given to a player | Existing observation tests; the viewer module never calls the player operations |
| The credential is never on the command line, in logs or in files | Credential-like arguments refused; key removed from the process environment at startup; held only by the SDK client; output scanned for it after the run | Launcher tests with a canary key: refusal, mock run output and stdout never contain it |
| Mock runs are offline and free | `MockGateway`: seeded legal actions, zero cost; a scratch ledger in the run folder | Legal-action and determinism tests; the mock gateway has no network code; the canonical ledger is not created |
| One spending limit for everything | Paid runs use `SpendLedger.openCanonical`, as `evaluate.ts` does (review H1) | `ledgerCanonical.test.ts` |
| Interruption keeps evidence | First Ctrl-C ends the episode (`manual_stop`); the trace, summary, results and `live.json` are written and the reservation is settled (calls in flight are charged at their reservation). A second Ctrl-C forces exit, leaving any open reservation held (fails closed) | Ctrl-C test: exit 130, verified partial trace, settled scratch ledger, lock released |
| No held-out access | Refused by the launcher, and independently by `runEpisode` (review H2) | `liveView.test.ts`, `finalAccess.test.ts` |

## Output

`<out>/run.json` (harness manifest), `<out>/<scenario>-seed<n>/trace.jsonl` (hash-chained trace), `summary.json`, `<out>/results.json` and `results.md`, and `<out>/live.json`. `live.json` holds the launcher settings, view count, git version, interruption, error, and the ledger path and balance after the run. Mock runs also have `mock-ledger.json`. Wall-clock fields differ between runs; the semantic trace and state hashes reproduce.

## Shared ledger (owner, once)

```sh
node --import tsx scripts/midterm/ledger.ts          # read-only inventory of every ledger and its balance
node --import tsx scripts/midterm/ledger.ts init     # create the canonical ledger; typed confirmation
```

The ledger is `<git common dir>/oath-eval/spend-ledger.json`. Every worktree shares it. A paid run never creates it. If a legacy `evaluation-runs/spend-ledger.json` exists in any worktree, paid runs refuse until it is adopted with `init --adopt <path>`, which copies its charges and open holds and renames the file. The 2026-10-27 inventory found no ledger anywhere.

## Held-out runs (not through this launcher)

S4, F and the final seeds run only through `evaluate.ts --final`, after the owner records an approval for the exact clean commit:

```sh
node --import tsx scripts/midterm/final-approve.ts --player <kind> --situations S1,S2,S3,S4,F --seeds 100,101 --by "<owner>"
```

This appends a hash-chained approval to `<git common dir>/oath-eval/final-register.jsonl`. Each episode is claimed in the register before it starts, once per approval, and finished afterwards. `runEpisode` refuses held-out or final-seed episodes without a claimed grant, whatever the entrypoint. No approval has been recorded.

## Known limits

- A process with shell access could still write the register or ledger through the library. The hash chain makes edits evident, not impossible, and deleting the newest register lines is not detected.
- The status line and the client's HUD are for the human watcher. The HUD shows hints that players' observations omit (an owner decision); players never receive it.
- The route still uses the shared navigation and combat helpers (`policies/navigate.ts`, `combat.ts`). The pinned start hashes in `test/route/checkpointFreeze.test.ts` would catch any drift they cause.
