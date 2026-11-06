# Proposal: Situation A post-tuned comparison

**Proposal only.** Nothing here is implemented or run. The active centralized policy, its prompt and every pin are unchanged. Written 2026-11-06 by the Claude Code implementation agent for the owner's approval.

## Question

Does explicit Hedge Maze solution guidance in the prompt change how `model-centralized` does on Situation A, compared with Pilot-30 (pre-tuned, success in 89.5 game-s, 167 calls, $0.443)?

## What stays fixed

| Item | Value (as in Pilot-30) |
| --- | --- |
| Model and effort | `openai:gpt-6-luna@medium` |
| Scenario and seed | S2-A v2 = `S2-local`, seed 0; start hash `fdc49877…03ca` |
| Game rules, interface | Commit `040685c` game code; the five operations, observations and legal actions unchanged |
| Player and controller | `model-centralized`, centralized id `f0592888`, navigator controller, batch 4 |
| Other prompt blocks | Manual `4b091a66…`, tutorial `2ec2f251`, S2-local briefing `a97d9268`, the centralized system prompt text |
| Limits and harness | 18,000 ticks; per hero 1,600 decisions, 400 calls, 4M tokens; 30 s per call; $0.75 cap; 3,600 s wall clock; live viewer at speed 1 |

## The one change

One added prompt block, **"Hedge Maze strategy guidance"**, placed after the briefing and labelled as solution guidance. It would get its own id, included in the policy id (for example `…·briefing-a97d9268·guidance-<id>`). A test would pin that `CENTRAL_ID` stays `f0592888` and that the system prompts differ from Pilot-30's only by this block. Then the run's `configHash` differs from Pilot-30's only through the prompt hash and policy id.

### What the guidance would say

Recommended: **strategy level**. The order of the obstacles and which ability solves each, with no coordinates or routes:

1. Read the arrival conversation; one hero advances a shared line.
2. Defeat the guards near the entrance.
3. Coco's Fireball burns the dry hedge that blocks the eastern passage.
4. The cow is too wide for the gap between the stone posts. Coco's Black Hole, cast from beside it, pulls it sideways into its grazing bay. Heroes stay out of the pull path. Then the heroes pass through the posts' opening.
5. The forest wolf carries the Hedge Gate Key and runs. Coco's Slow Time with Sieg's Super Speed lets Sieg catch it and tag it with E (not attack it).
6. With the key held, E at the key gate opens it.
7. E at the Shears Chest gives the Enchanted Shears. This is the goal.

Alternative: **walkthrough level**. The same steps with coordinates and routes, adapted from the existing `hedge-maze-walkthrough-v2` (`guidedMazeInstructions.ts`) for a single planner (no messages). That measures route-following more than strategy, and largely duplicates the existing `model-guided` supplement, so it is not recommended as the main post-tuned condition.

### What it must not say

- This remains A-only Hedge Maze guidance. New B is the unprepared Griffin trial; C is the prepared Griffin trial and proposed model-outcome holdout. No Griffin/prepared-case solution, nest sequence or C-specific hint may enter this block. (The existing walkthrough's step G mentions "no return, goddess offering" and must not be copied.)
- Nothing from hidden state: no puzzle-state keys, flags, the HUD's goal lines or the evaluator's checks.

## Why this is prompt tuning, not fine-tuning

The model's weights are not changed and the model id is the same. Only the text in each request changes. The guidance is ordinary input, visible in the prompt hash, removable by dropping the block, and costing tokens on every call. Fine-tuning would train a new model version on examples. That is not proposed, and the provider id would show it.

## Comparison design

- **Minimum:** one post-tuned trial at seed 0, compared with Pilot-30. One trial against one cannot separate the guidance from ordinary model variation; report it as a paired demonstration only.
- **Better:** two trials per condition (seed 0 and seed 1; seed 1 is a repeated trial of the same start). That means one more pre-tuned trial too.
- **Report:** outcome, terminal reason, game and wall time, decisions, invalid actions, calls, tokens, cost, latency, and the confirmed subgoals with their ticks (which shows where the guidance changed behaviour).
- **Budget estimate:** about $0.45 per episode at Pilot-30's rate. The guidance adds roughly 300–500 input tokens per call, mostly cached, under $0.01 per episode. The pilot stage has $4.030561 left. Two post-tuned plus one extra pre-tuned trial: about $1.35 expected, $2.25 reserved at the $0.75 cap.

## Risks

1. **Small sample.** One or two trials per cell show behaviour, not a reliable effect size.
2. **Situation A is a development case.** The controller was built on A. A post-tuned success on A says nothing about held-out play.
3. **The wall clock** (3,600 s) may still end runs. Pilot-30 used 1,958 s.
4. **Drift.** Any controller or game commit between the two conditions breaks the comparison. Both should run at the same commit, recorded in `gitHash`.
5. **Guidance leaking into C.** If the same block were used on C it would be irrelevant or misleading there. It must be scoped to A only. B is now a different Griffin task, not a suffix of A; C must not receive this maze block or a C-specific walkthrough. Any post-tuned C condition uses only transferable guidance frozen from A/B before C model outcomes.

## Decisions for the owner

1. Approve the change and its level (strategy, recommended; or walkthrough).
2. Approve the wording of the guidance block once drafted.
3. The number of trials per condition, and whether Pilot-30 counts as A's first pre-tuned trial.
4. The paid budget, cap and stage.
5. Whether the same guidance applies to B's post-tuned cell.
