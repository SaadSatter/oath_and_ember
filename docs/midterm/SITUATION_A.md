# Situation A: S2-A — Full Hedge Maze (version 1, frozen 2026-10-29)

Situation A is the first of a **proposed** three-situation Hedge Maze suite. Situations B and C are proposals only (below); they are not implemented and have not been approved. The course's three-situation requirement is **not** met by this document.

Prepared by the Claude Code implementation agent at the owner's request (2026-10-29). No paid model call, no held-out start, no push.

## What S2-A is

S2-A is an **evaluation label** for the existing current-revision scenario `S2-local` (preset `S2-local-v2`). It is not a new scenario. It adds no scenario id and changes no start state, success predicate, limit, prompt, observation or game rule. So:

- episode ids stay `S2-local-v2-<seed>-<start hash prefix>`;
- every historical S2-local trace and replay keeps working (tested);
- runs are still launched with `--scenario S2-local` / `--situations S2-local`.

Run summaries written from now on carry `evaluation: { label: "S2-A", definitionHash }`. Older summaries lack the field; their `situation: "S2-local"` with `suiteRevision: 2` is the same situation.

Code: [`packages/agent/src/situationA.ts`](../../packages/agent/src/situationA.ts). Tests: [`packages/agent/test/situationA.test.ts`](../../packages/agent/test/situationA.test.ts). Free check script: [`scripts/midterm/situation-a.ts`](../../scripts/midterm/situation-a.ts).

Definition hash (SHA-256 of the canonical definition): `4b3c9bb309e7d0bcc022f1df6a7e58cf11a3767c02fd7bd6cb62dfa845cd4207`. The test pins it, so any change to the definition fails CI until the owner approves a new version.

## Starting conditions

Reached by real play, never by fixtures: the `goddess` checkpoint, the scripted opening scene, then an ordinary walk to the shrine's east exit and an E press. Preparation stops on the area transition, before the maze's arrival dialogue. Memory, messages, decisions and episode time are then reset.

| | Seed 0 (reference) | Seed 1 (repeated trial) |
| --- | --- | --- |
| Start tick (absolute) | 405 | 405 |
| Start hash | `2b9eddd41bdd6a25457eb66d7d5b3dde66047b2d9103b4be334b378497c8b53e` | `ebea7d5c286dd896e85031e783cc4620a822671e92ae280f336a952c97fb8f02` |
| Episode id | `S2-local-v2-0-2b9eddd4` | `S2-local-v2-1-ebea7d5c` |

Checked by the tests at both seeds:
- **Heroes:** Sieg and Coco at the normal Hedge Maze entrance spawn (128, 1088) and (178, 1088) px, 100 HP each, with their normal abilities. Sieg has Sword, Guard, Push and Super Speed; Coco has Fireball, Ward, Slow Time, Flight and Black Hole.
- **Puzzle:** pristine (`newHedgeMaze()`): the dry hedge is unburned, the cow is in the lane, and the wolf is free and carrying the key. The key gate is shut. The key and chest are unclaimed. The guards are as spawned.
- **Shared backpack:** the same eight held items as every historical S2-local run (moonleaf, crystal vial ×2, candlewick, fresh bread, honey pastry, Alden's journal, strange cloth, drawing of seven stars). It has no Enchanted Shears.
- **Observations and legal actions:** identical, for both heroes, to the first observation in the committed live baseline trace.

These match the brief's assumed starting conditions. No discrepancy was found.

## Objective, success and termination

- **Objective:** obtain the Enchanted Shears into the shared backpack through normal gameplay.
- **Success:** the evaluator reads the authoritative state and finds `enchanted_shears` held in the shared inventory. This is the revision 1 S3 predicate, unchanged. An agent's claim never counts.
- **Terminal reasons:**
  - `success`;
  - `tick_limit`;
  - `decision_limit`;
  - `model_call_limit`;
  - `token_limit`;
  - `spend_limit`;
  - `wall_clock_limit`;
  - `error` (3 consecutive policy failures);
  - `manual_stop` (the owner's stop signal: neither a success nor a limit-based failure).

## Limits (all enforced in code)

| Limit | Value | Where |
| --- | --- | --- |
| Game time | 18,000 ticks (300 game-seconds) | `evaluator.ts` (revision 1 S3 limits) |
| Decisions | 1,600 per hero | same |
| Model calls | 400 per hero, failed and timed-out calls included | same, `ModelBudget` |
| Tokens | 4,000,000 per hero (reported) | same |
| Per-call timeout | 30 s, SDK retries off | `budget.ts` |
| Consecutive policy failures | 3 → `error` | `runner.ts` |
| Spend | $1.25 per episode (suite cap); a run may set a lower cap, never a higher one | `harness.ts` `EPISODE_CAP_USD` |
| Wall clock | 3,600 s for model players, 600 s for scripted players | `harness.ts` |

## Seeds: seed 1 is a repeated trial

The game adds no randomness. Seeds 0 and 1 differ **only** in the room code (`EVAL0`/`EVAL1`) and the two seeded hero ids. Everything else in the authoritative state is identical. Both heroes' observations and legal actions at reset are byte-identical. The scripted baseline plays the same trajectory step for step (2,990 ticks at both seeds). So **seed 1 is a repeated trial of the same situation, not a distinct situation.**

One caveat: id-based tie-breaks may order simultaneous events differently in a model run. Any difference between model trials still comes almost entirely from the model's replies.

## Information boundary

S2-A changes nothing a player sees. The test plays a full baseline episode and checks every one of the 340 observations and legal-action lists:
- no hero id or room code;
- no story flags;
- no puzzle-state keys (`"burned":`, `"parked":`, `"runner":`, `"fleeing":`, `"caught":` and similar);
- no state hashes;
- none of the HUD's Hedge Maze goal lines;
- no exact partner or enemy HP.

The same test checks two message rules: a hero sees only messages its partner sent, and never its own. It also checks that legal actions offer only:
- each hero's own abilities;
- backpack items the hero can see;
- dialogue options on its own screen.

The maze's painted signs, for example "Chase the fleeing key carrier", are drawn by the game and remain visible, as before. Unaided model players receive the manual, the tutorial briefing (`2ec2f251`) and the S2-local briefing (`a97d9268`), which name the objective but no solution. Only `model-guided` receives a walkthrough.

## Scripted baseline verification (free, run 2026-10-29)

`baseline-quest`, through the same five operations as the model players:

| Seed | Outcome | Game time | Decisions | Invalid | Messages | Model calls | Start hash | End hash |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | success | 2,990 ticks (49.8 s) | 340 (177 Sieg, 163 Coco) | 0 | 6 | 0 | `2b9eddd4…` | `bf31311f…f936` |
| 1 | success | 2,990 ticks (49.8 s) | 340 | 0 | 6 | 0 | `ebea7d5c…` | `df9069a0…` |

The seed 0 run matches the committed evidence (`midterms/saadsatter/evidence/traces/baseline-quest-S2-local-seed0-live/`). It has the same success, ticks, decisions, invalid actions, messages, calls and end hash `bf31311f6c56638bc7e5a6a45b9eaa621fa5042963c6e7c477e2ce74e729f936`. Each hero's sequence of actions and post-action state hashes is identical to the committed live trace. Only the order in which the two heroes' lines were written differs between the paced live run and the offline one. The seed 1 end hash differs only because its ids differ. The baseline was not changed.

## Planned comparison (prepared, not run)

| Role | Player | Information | Seeds |
| --- | --- | --- | --- |
| **Primary** | `baseline-quest` | Solution-aware scripted reference | 0, 1 |
| **Primary** | `model-memory` | Unaided: manual, briefings, notes, recent history, per-hero memory from its own observations | 0, 1 |
| Secondary | `model-obs-only` | Unaided, current observation only (the rubric's observation-only comparison). Supported on S2-local; never run | 0, 1 |
| Supplementary | `model-guided` | A written Hedge Maze walkthrough. Reported apart, never as the unaided result | 0, 1 |
| Floor | `baseline-explore` | Quest-free scripted exploration; reaches the tick limit | 0, 1 |

All five plans pass `validatePlan` (tuning seeds only, no held-out case).

### What each run records

Each run writes `summary.json`, a hash-chained `trace.jsonl` and `run.json`.

**Already recorded:**
- scenario, suite revision and seed;
- player and per-hero policy names (which include the tutorial and briefing ids);
- gateway (provider, model and effort) and the model ids the provider returned;
- `gitHash` (the game version, with `+dirty` if the tree was dirty; paid runs refuse a dirty tree);
- start and end hash, outcome and terminal reason;
- game ticks and seconds, and wall seconds;
- decisions, invalid actions, messages and batch stops;
- model calls (attempted, failed, timed out, unknown usage), latency, and tokens (input, output, cache);
- `spendUsd` (estimated from dated prices) and the ledger entry;
- the trace path;
- recording provenance in `live-recording.json` / `replay-recording.json`.

**New in this change** (additive fields; older summaries lack them):
- `evaluation`: the label `S2-A` and the definition hash;
- `promptHashes`: the SHA-256 of each hero's full system prompt, or null for scripted players;
- `configHash`: the SHA-256 of the run configuration. It covers the scenario, label, player, policy names, prompt hashes, gateway, batch size, manual hash, episode limits, model-budget limits, wall limit and spend cap.

Two runs with the same `configHash`, `gitHash` and seed differ only in model replies.

**Not recorded:** the provider's **actual billed cost**. `spendUsd.charged` is the runner's estimate from dated list prices with a 1.1 uplift. The actual bill is only in the provider's dashboard.

## Reproduction

From the repository root (or `midterms/saadsatter/` in the course repository):

```sh
# Free: definition, resets at seeds 0 and 1, plan validation, and the scripted baseline on both seeds
node --import tsx scripts/midterm/situation-a.ts --baseline

# Free: the tests
npx vitest run packages/agent/test/situationA.test.ts

# Free: the same baseline through the ordinary evaluator
node --import tsx scripts/midterm/evaluate.ts --player baseline-quest --situations S2-local --seeds tuning

# Free: verify the committed evidence
python3 -I scripts/midterm/collect_evidence.py --verify
```

The paid runs below are listed for the owner's approval only. **They have not been run.** Each needs the owner's authorization, a clean commit, the key and the shared ledger.

```sh
npm run eval:live -- --scenario S2-local --seed 0 --player model-memory   --gateway openai --model gpt-6-luna --effort medium --max-spend-usd <cap> --paid --no-viewer
npm run eval:live -- --scenario S2-local --seed 1 --player model-memory   --gateway openai --model gpt-6-luna --effort medium --max-spend-usd <cap> --paid --no-viewer
npm run eval:live -- --scenario S2-local --seed 0 --player model-obs-only --gateway openai --model gpt-6-luna --effort medium --max-spend-usd <cap> --paid --no-viewer
npm run eval:live -- --scenario S2-local --seed 1 --player model-obs-only --gateway openai --model gpt-6-luna --effort medium --max-spend-usd <cap> --paid --no-viewer
```

## Relationship to historical S2-local runs

The pilots and baseline runs already in `EVALUATION.md` were played on exactly this situation at seed 0: the same start hash `2b9eddd4…` and the same definition. They stay labelled as **historical tuning pilots** (pilots 11–15 and the 2026-10-29 baseline runs). They are not relabelled as S2-A trials. The code changed between those pilots, so they are not one configuration. Their summaries have no `configHash`. A planned S2-A comparison would be new runs, recorded with the new fields.

## Risks to fairness, reproducibility and the rubric

1. **The wall clock will probably end unaided runs, not the game limit.** Pilot 13 (`model-memory`) used 3,068 wall seconds for 76 game-seconds. At that rate the 3,600 s wall clock ends a run near 90 game-seconds, far below the 300 s tick limit. The 400-call cap per hero would bind around 160 game-seconds. The scripted baseline finishes in 49.8 game-seconds and about 2 wall seconds. Raising the wall clock is an owner decision; without it, a `wall_clock_limit` result is a latency limit, not a game failure, and must be reported as such.
2. **Spend cap.** Pilot 13 cost $0.32 for 76 game-seconds. The pilots used $0.30–$0.60 caps against the suite's $1.25. Choosing the cap is the owner's decision. A low cap makes `spend_limit` likely.
3. **Unequal information.** `baseline-quest` knows the solution; `model-memory` does not. The primary comparison measures unaided problem solving against a solution-aware reference, not two equal players. It should be read that way. `baseline-explore` is the only quest-free scripted player, and it never succeeds.
4. **Seeds are not situations.** Seed 1 adds a second trial, not a second situation. Two trials per player on S2-A are still one situation.
5. **No held-out case.** S2-A is a tuning scenario that has been used for prompt and interface tuning (pilots 9–15). Results on it are not held-out results.
6. **Post-hoc choice.** S2-local was added after the suite freeze and made the primary episode after pilots ran. This is disclosed in `EVALUATION_SUITE.md` and `EVALUATION.md`.
7. **Manual stops.** Earlier unaided trials were stopped by hand. For S2-A trials to count as failures or successes, they need to run to a terminal reason.
8. **Replay of interrupted traces.** The committed `manual_stop` traces (pilots 13 and 15) are checked here for their start state only. Their full action replay depends on `replay-video.ts`'s external-stop handling, which another session is editing (uncommitted) and this change does not touch.

## Proposal: Situations B and C (not implemented)

The goal is three distinct Hedge Maze situations that test different challenges, each reached by real play. This uses the existing method: the start is a prefix of real actions through the five operations, never fixtures or flags. Proposed:

| | S2-B — Cow and wolf | S2-C — Wolf and gate |
| --- | --- | --- |
| Start | The dry hedge is burned and the guards are cleared. Both heroes are beside the burned gap | The cow is parked. Both heroes are near the grazing bay, and the wolf still holds the key |
| Remaining challenge | Move the cow out of the lane (Black Hole or Push), then catch the wolf, open the gate and the chest | Catch the wolf (Slow Time with Super Speed), take the key, open the gate and the chest |
| What it isolates | Ability reasoning about a large blocker. Pilot 15 stalled here | Timed two-hero coordination. Pilots 10 and 13 stalled here |
| Success | Enchanted Shears held (the same predicate as S2-A) | the same |
| Role | Tuning | **Held out** (never used for prompt tuning) |

Open questions for the owner:
- **How the starts are reached.** Proposal: replay the committed `baseline-quest` action prefix up to an observable milestone, through `step()`. That uses solution knowledge only to set up the start, which `CLAUDE.md` allows for "the documented start state". The alternative is the scripted route's maze segment (`route/fullQuest.ts`).
- **Limits.** Proposal: proportionally shorter game-time limits (for example 200 s and 120 s), with the same per-call, token and spend rules.
- **Briefings.** Each needs its own owner-approved local briefing. It would state what is already done (visible on screen anyway) but no solution.
- **Professor.** Whether the instructor accepts three Hedge Maze situations as the suite, or a reduced suite.
- **Approval.** Implementing B and C, freezing them before any tuning on them, and the budget for 2 live trials × 3 situations × the chosen players.
