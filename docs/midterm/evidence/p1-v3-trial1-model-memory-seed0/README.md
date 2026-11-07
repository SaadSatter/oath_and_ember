# P1 revision 3, first live trial: `model-memory`, seed 0 (pilot-17)

**Outcome: success.** The authoritative story stage reached `WOODS` (the party entered the Mossling Woods) after 1,574 ticks (26.2 game-seconds).

Run by the Claude Code implementation agent on 2026-11-04 UTC (2026-11-03 local), with the owner's approval of exactly one trial.
- **Commit:** a clean checkout of `b61035f`.
- **Command:**

```sh
node --import tsx scripts/midterm/evaluate.ts --player model-memory --situations P1 --seeds 0 --stage pilot \
  --gateway openai --model gpt-6-luna --effort medium --max-spend-usd 0.15 --paid --out <dir>
```

- **Not done:** no manual action selection, no walkthrough, no briefing.
- **Not repeated:** no second trial was started.

## Configuration

| | |
| --- | --- |
| Situation | P1 "Into the Forest", revision 3. Preset `P1-v3`; episode `P1-v3-0-688b2462`; definition hash `05a2e7442d5271f04af135ddcfec687c23c756e3cc9e6894f43182dd0d7161aa` |
| Player | `model-memory`, one LLM per hero, batches of up to 4 actions. Policy name `llm(openai:gpt-6-luna@medium)·batch4·memory·task-4079cad5` |
| Model | OpenAI `gpt-6-luna` at medium effort (the provider returned `gpt-6-luna`); max output 2,000 tokens per call |
| Prompts | System prompt SHA-256: Sieg `3902600e…5279`, Coco `37d7fd97…64ae5`. Both equal the values pinned in revision 3. The task line is the episode-neutral `NEUTRAL_TASK` (`4079cad5`). The manual is the committed one (`4b091a66…`) |
| Prices | Checked on 2026-11-03 against https://developers.openai.com/api/docs/models/gpt-6-luna: $0.10 input, $0.01 cache read, $0.125 cache write, $0.50 output per million tokens; above 272K input, 2× input and 1.5× output. The runner adds a 1.1 safety uplift |
| Limits | 10,800 ticks; per hero 250 model calls, 1,600 decisions and 4,000,000 tokens; 30 s per call; 3,600 s wall clock; episode spend cap **$0.15** (owner's cap for this trial, below P1's $0.60) |
| Ledger | Canonical shared ledger, entry `pilot-17`. Afterwards: $6.0541 left in pilot, $23.0526 in total |
| Config hash | `916e7baf037bfeebcd18d8b1d06768446b8c85ef5605d89c639ce57053a60438` |

## Results

| Field | Value |
| --- | --- |
| Terminal reason | `success`, read by the evaluator from authoritative state |
| Game time | 1,574 ticks (26.2 s) of the 10,800-tick limit |
| Wall time | 840.5 s (launcher 05:57:20Z to 06:11:21Z) |
| Decisions | 217 (Sieg 136, Coco 81) |
| Invalid actions | 0 / 0 |
| Model calls | 177 attempted, 0 failed, 0 timed out, 0 unknown usage |
| Latency | mean 5.0 s, max 27.7 s per call |
| Tokens | 1,403,993 input (897,925 cache read, 505,537 cache write), 58,087 output |
| Cost | $0.111395 charged (known $0.111395), against the $0.15 cap |
| Messages | 20 (Sieg 8, Coco 12) |
| Batches | 29 batch stops, 31 skipped actions, 4 stale dialogue presses, 0 rejected by the game, 0 parse failures |
| Start hash | `688b246237f8183790ca7f1f0d38a5b96570ffd323c3d662683ca04cf1b71530` (the frozen seed-0 start) |
| End hash | `df298be79393561ee1946eb8b80b1eb65006f10727a9ca4a1ddfeb5e02b9ac46` |
| Trace SHA-256 | `2a19f879031ed75e381a830d92f1058963f58862b597169901790c0ef1c1dde1` (hash chain verified) |

**Progress** (evaluator markers in the trace, by game tick):

| Tick | Milestone | Triggered by |
| --- | --- | --- |
| 566 | shop visit | Sieg, by entering the shop |
| 622 | road fork | — |
| 888 | forest trail | Coco: E at "← FOREST" |
| 1,120 | cart found | Coco, by the crates |
| 1,574 | Mossling Woods (success) | Coco: E at the trail's exit |

## What the players did (from the trace)

**Sieg:**
- He pressed E at nothing a few times, then walked through the garden gap to the shop door. He entered the shop at tick 506, which started the visit scene.
- He read most shared lines: 29 dialogue presses to Coco's 8.
- After the road scene he tried the closed "EMBERBROOK →" road four times; the game responded "nothing responded".
- On the trail he inspected the barrel and crates.

**Coco:**
- While waiting, she talked to Alden twice.
- After the road scene she went west on her own and pressed E at "← FOREST", taking the party to the trail.
- Near the crates she started the cart scene. She inspected the barrel and crates, and tried Black Hole once at the cart.
- She pressed E at the trail's exit, which ended the episode.

**Messages.** The heroes exchanged 20 messages: positions, what each read, and that a scene was holding movement.

**Cooperation.** Success did not require Coco (see `PROLOGUE_SITUATION.md`), but in this trial she made two of the decisive moves.

## Recording

`replay.webm` (1280×720, 34.6 s) is a **trace-verified replay**, not a live capture. It was made with `scripts/midterm/replay-video.ts` at a clean checkout of `b61035f`.
- **Verification:** it reports "REPLAY MATCHES THE TRACE: start hash, 217 step results, end (success, df298be7…) and 1574 ticks". The details are in `replay-recording.json` (`matchesTrace: true`).
- **Labelling:** the video is titled "REPLAY of pilot-17 … (recorded actions, no model calls)".
- **Timing:** it plays the recorded actions at game speed, so model latency is not shown.
- **What the viewer adds:** the HUD goal lines and an evaluator milestone strip. **No agent received either.**

Video SHA-256: `8dea8ce06e55e43dafb1dbd7afb62022f90535b9cd033a4c66ff7bcf61bb791c`.

## Infrastructure

- No errors: 0 failed calls, 0 timeouts, no warnings in `launcher-output.txt` (the launcher's console output).
- Secret scan: 0 findings. The trace's only "sk-" substring is the `task-4079cad5` id in the policy name.

**Interpretation.** This is one trial at one seed. It shows one unaided completion, not a success rate. No prompt or configuration was changed in response to it.
