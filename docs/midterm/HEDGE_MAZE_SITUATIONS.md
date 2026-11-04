# Hedge Maze situations A, B and C (version 2, frozen 2026-11-04)

## Version 2 (2026-11-04): the game changed

After the owner's game change `ffbdecb` (stone posts around the cow, griffin 640 HP, new story lines; see [SITUATION_A.md](SITUATION_A.md)), all three situations moved to version 2. Version 1 was never committed and never run by a model.

- **Source trace.** The checkpoints are now derived from S2-A version 2's reference run, `midterms/saadsatter/evidence/traces/baseline-quest-S2-local-seed0-v2/trace.jsonl` (SHA-256 `c8d8098ce45d1c1ee57928003ce1b0efc521916271b5da266f3a65ef259bd079`, offline `baseline-quest`, `ea654e8+dirty`).
- **Cuts.** The same ticks, chosen by the same rules. B: 1197, identical prefix to version 1 (Sieg 59 actions, Coco 64, Coco's move west shortened 59 → 53). C: 1962. In version 2 no tick after the cow moves has both heroes between actions; at 1962 Sieg starts an action and Coco is 1 tick into a 20-tick wait, so that wait is shortened 20 → 1 (Sieg 96 actions, Coco 85).

| | Definition hash (v1 → v2) | Start hash seed 0 / 1 (v2) | Baseline-quest, seed 0 (v1 → v2) |
| --- | --- | --- | --- |
| S2-A | `4b3c9bb3…` → `a9ee2385…` | `fdc49877…` / `febddd1a…` | success 2,990 → 2,974 ticks, 340 → 339 decisions |
| S2-B | `8032c9f2…` → `016f1671…` | `8e3b386b…` / `c4349ca0…` | success 2,334 → 2,313 ticks, 224 → 225 decisions, end `b77d51ff…` |
| S2-C | `7d9014a1…` → `74b15da2…` | `6d59c47c…` / `c4884758…` | tick_limit (unchanged limitation), 1,561 → 1,562 decisions, end `0fca3656…` |

**The rest of this document describes version 1** unless it says otherwise.

---


These are three distinct starting tasks inside the one Hedge Maze environment. All three are **development-informed tuning situations, not held-out cases**:
- the B and C cuts were chosen from a run of the solution-aware scripted baseline;
- S2-local (A) had already been used for prompt and interface tuning (pilots 9–15).

They are implemented and their start states are frozen. **No live trial has been run on B or C, and no new live trial on A.** Implemented by the Claude Code implementation agent at the owner's request (2026-10-29). No paid model call, no held-out start, no push.

| Label | Name | Scenario id | Start | Definition hash |
| --- | --- | --- | --- | --- |
| S2-A | Full Hedge Maze | `S2-local` (unchanged; [SITUATION_A.md](SITUATION_A.md)) | maze entrance, tick 405 | `4b3c9bb3…cd4207` |
| S2-B | Cow puzzle | `S2-B` | guards defeated, dry hedge burned, cow in the lane; tick 1197 | `8032c9f2…64e089` |
| S2-C | Wolf and key | `S2-C` | cow moved out of the lane, wolf still holds the key; tick 1962 | `7d9014a1…4e4695` |

Code:
- definitions: `packages/agent/src/hedgeMazeSituations.ts`;
- scenarios: `suite.ts` and `evaluator.ts`;
- checkpoint replay: `packages/agent/src/route/mazeCheckpoints.ts`;
- generated checkpoint data: `route/mazeCheckpointData.ts`.

Tests: `packages/agent/test/hedgeMazeSituations.test.ts` (30). S2-A is unchanged: its definition hash, start hashes, episode ids and run configuration hash (`414ba199…`) are the same as at `16f1a6d`.

## How the B and C checkpoints are reached

The checkpoints come from real gameplay, not an invented state. Each one is a prefix of the committed live baseline run:
- trace `midterms/saadsatter/evidence/traces/baseline-quest-S2-local-seed0-live/trace.jsonl`;
- SHA-256 `ef0c2a5738eff06f3e7664102788771e94a2ff39cb30553f466b2e03cacdba4b`;
- recorded with `baseline-quest` on S2-local, seed 0, at `7022ea1+dirty`.

At reset, the environment does three things:
1. It reaches S2-A's start the usual way: the opening scene, then a normal walk into the maze.
2. Through its own `step()`, it re-submits each hero's recorded actions that began before the cut tick, in order. Both heroes act concurrently, as in the recording.
3. It clears both heroes' memory, messages, feedback, decision counters and episode clock.

There is no fixture, teleport, flag or state write. Every prefix action must be accepted, or the reset fails.

If a hero's last action is still running at the cut, only its duration is shortened, so it ends at the cut. Inputs before the cut are unchanged, so the world at the cut is the recorded world at that tick. Only a move or a wait may be shortened; the derivation refuses anything else.

| | Cut tick | Sieg actions | Coco actions | Shortened | State at the cut (from the recording) |
| --- | --- | --- | --- | --- | --- |
| S2-B | 1197 | first 59 | first 64 | Coco's action 63 (move west), 59 → 53 ticks | The last guard falls at 1197. The hedge burned at 626. The cow is untouched (Black Hole cast at 1337, cow moved at 1434) |
| S2-C | 1962 | first 96 | first 84 | none (both heroes are between actions) | The cow moved at 1434. The wolf is free (caught at 2763). The gate is shut (opened at 3240) |

**Choosing the cuts.**
- **B:** the guards are cleared at tick 1197, Coco casts Black Hole at 1337, and the two heroes share no action boundary in between. The cut is at 1197, the earliest point with the hedge burned and no guard left, so B tests the cow and what follows without combat.
- **C:** 1962 is the first tick after the cow is moved at which both heroes are between actions.

**Provenance is tested.**
- The test re-derives both checkpoints from the trace and compares them with the committed data.
- It checks the trace's SHA-256 and hash chain.
- It checks that each start hash equals the world hash at the cut tick in an uncut replay of the whole recording.
- `node --import tsx scripts/midterm/derive-maze-checkpoints.ts --check` checks the generated file.

**Messages before the cut are not carried over.** In C's prefix, Coco sent "Cow moved. I'm past it, waiting by the gate side." The reset clears it, so neither hero starts with any message.

## Starting conditions (checked at seeds 0 and 1)

| | S2-B | S2-C |
| --- | --- | --- |
| Area | Hedge Maze, both heroes, HP above 0 | same |
| Guards | none left | none left |
| Dry hedge | burned | burned |
| Cow | in the lane (not parked) | parked in the grazing bay |
| Wolf and key | free, carrying the key | free, carrying the key |
| Gate | shut | shut |
| Chest and Shears | unclaimed; no Shears in the backpack | same |
| Agent state | no messages, feedback or dialogue; decisions, invalid actions and episode time at 0; the discovered map is only what is on screen now | same |
| Start hash, seed 0 | `b902d7893c1af431e73569474dea57d14e735986db0ed9d9c565417ca0a8e129` | `3aa042d67508799cdddd01285a7d906886c84fe4d595fe43eb12d5501df4c908` |
| Start hash, seed 1 | `ed0d08ae85ec9ff6a164b7a3915a8e6d0a1d939ef999d6395949594d7be41861` | `43dcb09c96416c1e29030f7f7d8dde0fd4873ec8120e353c8941f6ea570695e8` |
| Episode id, seed 0 | `S2-B-0-b902d789` | `S2-C-0-3aa042d6` |

The prefix replays seed 0's recording at every seed. Seed 1 differs only in the room code and hero ids, and both heroes see exactly what they see at seed 0 (tested). **Seed 1 is a repeated trial, not a new situation**, as for S2-A.

## Objective, success, limits and termination

All three have the same rules:
- **Objective:** obtain the Enchanted Shears into the shared backpack through normal gameplay.
- **Success:** the evaluator finds `enchanted_shears` held in the authoritative shared inventory. This is the same predicate function as S2-A.
- **Limits:** the same as S2-A:
  - 18,000 ticks (300 game-seconds), measured from the situation's start;
  - per hero, 1,600 decisions, 400 model calls and 4,000,000 tokens;
  - 30 s per call;
  - 3 consecutive failures end the run with `error`;
  - $1.25 per episode (a run may set a lower cap);
  - a 3,600 s wall clock for model players, 600 s for scripted ones.

  One rule for all three keeps the situations comparable. B and C have less left to do, so the same game-time limit is relatively more generous.
- **Terminal reasons:**
  - `success`;
  - `tick_limit`;
  - `decision_limit`;
  - `model_call_limit`;
  - `token_limit`;
  - `spend_limit`;
  - `wall_clock_limit`;
  - `error`;
  - `manual_stop`.

## What each situation tests

| | S2-A Full | S2-B Cow puzzle | S2-C Wolf and key |
| --- | --- | --- | --- |
| Guards (combat) | yes | — | — |
| Dry hedge (Coco's Fireball) | yes | — | — |
| Cow blocking the lane (Black Hole; Push where it applies) | yes | **yes** | — |
| Wolf chase (Slow Time with Super Speed) and key | yes | yes | **yes** |
| Gate and chest | yes | yes | yes |
| Messages between heroes | yes | yes | yes |

## Players and information

| Player | Information | Role |
| --- | --- | --- |
| `baseline-quest` | **Solution-aware** scripted heroes (hand-coded quest knowledge), with the same observations, legal actions and messages | Scripted reference |
| `model-memory` | **Unaided:** the manual, tutorial briefing (`2ec2f251`), episode briefing, its own notes, recent history, and per-hero memory built from its own observations | **Proposed primary LLM policy** |
| `model-obs-only` | **Unaided:** the same model, the current observation and legal actions only | Control (see below) |
| `model-guided` | A **solution-informed** walkthrough of the whole maze | Supplementary, S2-A only. Not prepared for B or C: its walkthrough starts at the entrance, and `validatePlan` refuses it on B and C |

**Episode briefings.** B and C share one briefing text, which differs only in the id (B `db5d6bde`, C `82ca7279`). It says the heroes start partway through the Hedge Maze, that some obstacles may already have been dealt with, and that the objective is the Enchanted Shears. It names no obstacle, place, direction or ability (tested). **The wording is the implementation agent's draft, pending the owner's.**

**Information boundary.** The test scans every observation and legal-action list of a full baseline episode on B, and of the first 20 game-seconds on C. It finds:
- no ids, room code, story flags, puzzle-state keys or state hashes;
- none of the HUD's goal lines;
- no exact partner or enemy HP;
- no mention of the checkpoint, the recording or the baseline.

The same scan checks two more rules:
- each hero is offered only its own abilities;
- messages come only from the partner.

Illegal actions are refused and leave the world unchanged: Sieg's Black Hole, Coco's Super Speed, a bad direction, an unusable item and an unknown action type.

**Same checkpoint for every player.** With an offline fixture gateway, `baseline-quest`, `model-memory` and `model-obs-only` record the same start hash on B and on C, with three distinct configuration hashes. `model-memory` and `model-obs-only` receive the same first observation. The model prompts contain the shared briefing and nothing about the checkpoint.

### Is `model-obs-only` a meaningful control? Yes, as it stands.

No change to the policy is needed:
- `validatePlan` already accepts it on all three situations.
- Each call sends only the current observation and the legal actions. There are no notes, no completed or refused action history, no previous-turn results and no movement reports.
- The observation itself still carries the game's recent feedback, partner messages, recent dialogue lines and the explored outline of the area.

So the control measures what the extra memory adds over a screen plus a short game-provided log. That is the comparison the guidelines ask for in a partial-observation game.

Caveats:
- It has never run against a live model.
- Its screen window is small (20×12 tiles), so in B and C the cow and the wolf are often off screen. Expect it to do poorly; that is the point of a control, but it means its runs mostly measure a floor.
- Its cost per call is lower than `model-memory`'s (smaller requests), but not by enough to change the budget much.

## Scripted baseline results (free, run 2026-10-29)

`baseline-quest`, unchanged, through the five operations:

| Situation | Seed | Outcome | Game time | Decisions | Invalid | Messages | Calls | Start | End |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S2-A | 0 | success | 49.8 s | 340 | 0 | 6 | 0 | `2b9eddd4` | `bf31311f` |
| S2-A | 1 | success | 49.8 s | 340 | 0 | 6 | 0 | `ebea7d5c` | `df9069a0` |
| S2-B | 0 | success | 38.9 s | 224 | 0 | 6 | 0 | `b902d789` | `597f6240` |
| S2-B | 1 | success | 38.9 s | 224 | 0 | 6 | 0 | `ed0d08ae` | `6476b40a` |
| S2-C | 0 | **tick limit** | 300 s | 1,561 | 0 | 0 | 0 | `3aa042d6` | `66203cc3` |
| S2-C | 1 | **tick limit** | 300 s | 1,561 | 0 | 0 | 0 | `43dcb09c` | `3cd26e4b` |

**The baseline fails C, and the reason is the baseline, not the situation.** Its maze script is a fixed sequence written for a start at the entrance. From C:
- Coco restarts at the guard positions and then tries to walk into the cow, which is already parked.
- Sieg waits for good for the "cow moved" message, which Coco sent before the cut.

The baseline was **not** changed, because that would change a player's design, which needs the owner's decision. C is still shown to be completable through normal play. From the C checkpoint, the rest of the recorded run, re-submitted through `step()`, reproduces every recorded state and ends in success with the recorded terminal hash. The same is shown for B. Options for C are under "Decisions needed".

## Reproduction

```sh
# Free: definitions, resets at seeds 0 and 1, plan validation, baseline on all three
node --import tsx scripts/midterm/hedge-maze-situations.ts --baseline

# Free: tests
npx vitest run packages/agent/test/hedgeMazeSituations.test.ts packages/agent/test/situationA.test.ts

# Free: the checkpoint data still matches the committed trace
node --import tsx scripts/midterm/derive-maze-checkpoints.ts --check
```

## Proposed trial matrix (prepared, **not run**)

Two live trials per situation: seed 0 and seed 1. These are repeated trials of the same start, labelled as such.

| Player | S2-A | S2-B | S2-C | Episodes | Paid |
| --- | --- | --- | --- | --- | --- |
| `baseline-quest` | 2 | 2 | 2 | 6 | no (already run above) |
| `model-memory` (primary) | 2 | 2 | 2 | 6 | yes |
| `model-obs-only` (control) | 2 | 2 | 2 | 6 | yes |
| `model-guided` (supplementary) | historical pilots 11, 12 only | — | — | 0 new | — |

These commands are **not run**. Each needs the owner's approval, a clean commit, the key and the shared ledger:

```sh
npm run eval:live -- --scenario <S2-local|S2-B|S2-C> --seed <0|1> --player <model-memory|model-obs-only> \
  --gateway openai --model gpt-6-luna --effort medium --max-spend-usd <cap> --paid --no-viewer
```

### Estimated budget

This uses the `gpt-6-luna` prices verified on 2026-10-28 ($0.10 input, $0.50 output per million tokens, with the runner's 1.1 uplift). The per-call cost and pace come from the S2-local pilots: these are historical exploratory numbers, not measurements of B or C.

| | `model-memory` | `model-obs-only` (proxy: `model-history`, pilot 10) |
| --- | --- | --- |
| Cost per call | $0.00071–$0.00084 (pilots 15, 13) | about $0.00066 |
| Calls per wall second (both heroes) | 0.13–0.15 | similar |
| Calls before the 3,600 s wall clock | about 450–540 | about 450–540 |
| Expected cost per episode | **$0.32–$0.45** (likely ended by the wall clock) | **$0.30–$0.36** |
| Ceiling per episode | the episode cap; 800 calls would cost about $0.67 | the same |

| Plan | Expected | Reserved at a $0.60 cap |
| --- | --- | --- |
| `model-memory`, 6 episodes | $1.90–$2.70 | $3.60 |
| `model-obs-only`, 6 episodes | $1.80–$2.20 | $3.60 |
| Both | $3.70–$4.90 | **$7.20** |

The ledger's pilot stage has **$6.17** left. These are tuning seeds, so the final stage does not apply.
- `model-memory` alone fits.
- Both together fit only with a lower cap (for example $0.50, reserving $6.00), with some contingency, or with budget moved between stages. That is the owner's decision.
- Wall time: up to 3,600 s per episode, so up to 12 hours for all 12 model episodes run one after another.

## Risks and remaining rubric gaps

1. **No held-out case.** All three situations are development-informed tuning cases (owner direction). Rubric 5a expects held-out cases. S4 and F remain held out and unrun.
2. **No live trial on B or C, and no new one on A.** The "two live trials per situation" requirement is prepared, not met. Earlier pilots are historical exploratory evidence, not trials of this suite.
3. **The baseline fails C** for a reason unrelated to the task. Without a decision, the scripted reference has no success on one of the three situations, which weakens rubric 4b ("a real competitor").
4. **The wall clock will probably end model runs** at roughly 90–105 game-seconds (the S2-local pilots' pace), well before the 300 s limit. A `wall_clock_limit` is a latency limit and must be reported as such. The scripted baseline is not subject to it in practice.
5. **The cuts come from the solution-aware baseline's play.** The heroes' positions at the cut reflect that play. For example, at the C cut Coco has just walked to the gate side. The briefing does not reveal this, but the start is not neutral. It is the same start for every player.
6. **Unequal information** between the solution-aware baseline and the unaided models, as for S2-A.
7. **Professor approval** of a three-situation Hedge Maze suite is not recorded. The suite is still provisional.
8. **Existing tests changed.** Four tests pin the scenario registry exactly: `suite.test.ts`, `situationA.test.ts`, `guidedMaze.test.ts` (the count of 7, now 9; it also now checks that `model-guided` is refused on B and C) and `playerKnowledge.test.ts` (the id/preset list). Their expectations were updated to include S2-B and S2-C. Nothing else in them changed. `suite.test.ts`'s start-state test builds the held-out S4/F starts, so it was not run in this session. Its updated expectations for B and C (Hedge Maze, 7 distinct starts) are unverified there; the B and C parts are covered by `hedgeMazeSituations.test.ts`.

## Decisions needed

- **C and the baseline.** Choose one:
  - accept the baseline's C failure and report it;
  - approve a resume capability for `baseline-quest`, chosen from what each hero observes at the start. This would have to leave every frozen historical trajectory unchanged, which the pins would check;
  - approve a separate scripted player for C.
- **The B and C briefing wording.**
- **Which players to run, the per-episode cap, and the stage.**
- **Whether to raise the 3,600 s wall clock** for these runs.
