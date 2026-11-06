# Situation A: pre-tuned and post-tuned model play

Declaration `oath-ember-abc-2026-11-06-r5`. Situation A is the Hedge Maze (frozen S2-local v2, seed 0, start hash `fdc49877…03ca`): obtain the Enchanted Shears. All three runs used the `model-centralized` player with OpenAI `gpt-6-luna` at medium effort. Records: pre-tuned [Pilot-28](evaluation-abc/A-pretuned-pilot28.json), post-tuned [Pilot-30](evaluation-abc/A-posttuned-pilot30.json), supplementary [Pilot-29](evaluation-abc/A-supplementary-pilot29.json), baseline [`baseline-quest`](evaluation-abc/A-baseline-quest.json).

## Results

| Condition | Run | Prompt version | Outcome | Game time | Wall time | Calls | Invalid actions | Est. cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pre-tuned | Pilot-28 | before tuning | Stopped by the owner, stuck at the cow | 125.3 s | 900.8 s | 79 | 1 | $0.094339 |
| Supplementary | Pilot-29 | round 1 only | Stopped by the owner, cow moved but never passed | 54.6 s | 1,193.6 s | 95 | 1 | $0.237263 |
| Post-tuned | Pilot-30 | rounds 1 and 2 | **Success** | 89.5 s | 1,958.1 s | 167 | 2 | $0.443258 |

Pre-tuned (Pilot-28): no success. Post-tuned (Pilot-30): success. Pilot-29 is supplementary: it shows the intermediate tuning round and is not a trial. The deterministic baseline `baseline-quest` succeeded in 52.1 game-s at $0. Pilots 28 and 29 were stopped by hand, not by a limit: neither reached the 300 s game limit, so the table says what happened, not what would have happened. Whether Pilot-28 qualifies as the official pre-tuned attempt depends on the professor's rules. Costs are the runner's estimates from list prices dated 2026-10-28, not the provider's bill. The Pilot-28 and Pilot-29 costs each include one call cut off by the stop.

## What the tuning was

The tuning changed the planner's system prompt. Everything else the model received stayed the same in all three runs: the model and effort, the public manual (`4b091a66…`), the task text, the tutorial (`2ec2f251`), the S2-local briefing (`a97d9268`), batch size 4, the limits and the game. No rule names a place, coordinate, route or puzzle step. The model's weights did not change.

Each round followed a run that failed on Situation A.

**Round 1, after Pilot-28** (`730e8b1`). Pilot-28's planner left heroes waiting, recast spells with no effect, stored attempted casts as completed subgoals, and briefly pursued the journal's wig goal. Rules added:

- Completed subgoals may list only IDs of observed facts. Claims, attempted casts and accepted inputs do not count.
- An accepted action with no observed effect is not a success. Change position, aim or assignment rather than repeat it.
- An inactivity watchdog counts game time without verified progress, across renewed waits. When it runs out, give an overdue hero new work.
- A wait can end when a named ability becomes ready.
- A Black Hole pulls toward its predicted landing point, not its firing direction. Keep heroes out of the pull path.
- The evaluation objective stays the task and briefing, even when the quest journal names a different goal.
- (Rewritten) Verified subgoals persist; new evidence IDs are appended.

**Round 2, after Pilot-29** (`9f16035`). Pilot-29's planner moved the cow out of the way but never sent a hero through the gap, trusting the cow's sign over what the screens showed. Rules added:

- Obstacles can change. After something moves, trying that way again is a reasonable test, without proof first.
- Trying a way is a test, not a claim. Only observed results count as solved.
- Signs and captions describe things; they do not measure what blocks movement now. When they disagree with the screen, test the screen.
- A move that gets through where a hero was stopped before shows the way is open. A move that stops short says where and why, so change the approach and retry after something changes.

The prompt text above is taken from the `centralSystemPrompt` source at `678b86c`, `327c34a` and `040685c`.

**Disclosure.** The same commits also changed controller code (walking, progress tracking and the trace writer) and the planner's input fields, so this is not a prompt-only controlled comparison.

## Limits of the comparison

- Historical pilots, run before the suite was declared; not preregistered trials. Situation A is a development case, not held out.
- One pre-tuned and one post-tuned run (declaration r5); they are different policies, not repeats of one frozen policy.
- No statistical claim: three runs show behaviour, not an effect size.

## Evidence

Each run's trace, summary and metadata are copied byte-for-byte under `midterms/saadsatter/evidence/traces/pilot-{28,29,30}-model-centralized-S2-local-seed0/`. All three trace chains verify, and an offline replay of each through the real engine matches every recorded step result and the end hash. Live videos: [Pilot-28 and Pilot-29](https://github.com/SaadSatter/oath_and_ember/releases/tag/pilot-28-29-pretuned-evidence), [Pilot-30](https://github.com/SaadSatter/oath_and_ember/releases/tag/pilot-30-evidence).
