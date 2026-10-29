# Evaluation suite (declared before tuning)

**Status: frozen, provisional.**
- The owner approved this suite on 2026-10-27, pending the professor's confirmation. **The professor has not confirmed it.** Do not describe it as professor-approved until that confirmation is recorded in the change log below.
- The commit that adds this file is the freeze point. No prompt has been tuned and no scenario-specific baseline heuristic has been written before it.
- Any later change to a scenario, seed, limit or player goes in the change log, with a date and a reason. Results from before and after a change are reported separately.

The code definitions are `packages/agent/src/suite.ts` (scenarios, seeds, start states) and `packages/agent/src/evaluator.ts` (goals and limits). The suite is tested in `packages/agent/test/suite.test.ts`.

## Scenarios

Each scenario's start state is reached by **real play**. At reset, a prefix of the verified scripted route (`packages/agent/src/route/`) runs through the environment's own five operations. No fixture, teleport or item injection is used.

After the prefix:
- decisions, invalid actions and each hero's memory are cleared;
- the episode's game time starts at that tick;
- the trace's `reset` line records the prefix's name and the start-state hash.

| Id | Role | Start | Success (read from the authoritative state) | Game time | Model calls / decisions per hero | Route reference |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | tuning | the `goddess` checkpoint (tick 0) | the opening scene is finished and the party is in a quest area (Mirror Pond, Hedge Maze or Griffin Enclosure) | 90 s | 60 / 240 | 426 ticks |
| S2 | tuning | shrine after the opening scene (tick 221; prefix: opening scene) | the Vanity Mirror is in the shared backpack | 300 s | 400 / 1,600 | about 5,300 ticks (travel and pond) |
| S3 | tuning | the same start as S2 (identical start hash) | the Enchanted Shears are in the shared backpack | 300 s | 400 / 1,600 | about 4,500 ticks (travel and maze) |
| S4 | **held out** | shrine holding the Vanity Mirror and the Enchanted Shears (tick 9,979; prefix: opening, Hedge Maze, Mirror Pond) | `chapter0.complete` | 180 s | 300 / 1,200 | 2,433 ticks |
| F | **held out** | the `goddess` checkpoint (tick 0) | `chapter0.complete` | 480 s | 1,000 / 4,000 | 12,412 ticks |

Notes on the limits:
- **Game time** is simulated time (60 ticks = 1 s), measured from the scenario's start. It is roughly 3–4 times the scripted route's time for that part.
- **Model calls** are attempted calls, failed and timed-out ones included. The F cap is the owner's provisional 1,000 calls.
- **Decisions** are steps: with batching, up to 4 per model call.
- **Tokens:** 1, 4, 4, 3 and 8 million per hero (reported tokens) for S1, S2, S3, S4 and F.

**Common limits** (central `ModelBudget` in the runner):
- 30 s per-call timeout, configurable;
- SDK retries off;
- one total spend cap per episode;
- a 3,600 s real-world ceiling;
- 3 consecutive policy failures end the episode with `error`.

**Held-out rule.** S4 and F are not run by a model or by the quest-aware baseline until the final evaluation. Prompt tuning and baseline development use S1–S3 with the tuning seeds only. The scripted route has passed through all of S4 and F. That route is development evidence that the quest can be finished, not a player.

## Seeds

| Use | Seeds |
| --- | --- |
| Tuning (S1–S3 only) | 0, 1 |
| Final trials (all scenarios) | 100, 101 |

The game has no randomness. A seed fixes the room code and the seeded evaluation ids (`runtime.ts`), and so the order of id-based tie-breaks. The scripted route behaves identically for seeds 1–8. **Different seeds are therefore reported as reproducibility trials, not as different game situations**, unless a run shows that they produce different gameplay. Variation between trials of a model comes from the model.

Baseline and model runs of a scenario and seed must have the same start-state hash; the hash is recorded in each trace.

## Players

| Player | What it is | Status |
| --- | --- | --- |
| `model-history` | `LLMPlayer`, one per hero, batches of up to 4 actions, its own notes (400 characters) and its last 8 actions; messages only through `message`. Model: Haiku class, exact id and price to be verified | adapter done; no paid calls yet |
| `baseline-quest` | Quest-aware scripted baseline, one per hero, using only its own observation and messages; its quest knowledge is hand-coded and disclosed | planned (`docs/midterm/BASELINE_PLAN.md`) |
| `baseline-explore` | The exploration baseline from PR #7, kept as a weaker comparison | exists |
| `model-obs-only` | The same model without notes or recent actions, on S1–S3. The rubric expects bounded history to be compared with an observation-only player for partial-observation games | **proposed, needs owner approval**; if approved, add it here through the change log before any tuning |

All players get the same observations and legal actions, under the same information restriction: signs and labels as drawn, HUD goal lines hidden from everyone, health shown as bars.

**Trials.** 2 live trials per scenario on the final seeds for each model player. The scripted baselines are deterministic, so their 2 trials are expected to be identical, and that is reported as such.

## Recorded per episode

- scenario, seed, player, provider, model id as returned, game version (git short hash), start-state hash and prefix;
- outcome and terminal reason, game ticks, real seconds;
- decisions, invalid actions and batch stops;
- model calls: attempted, failed and timed out;
- latency (mean and max, over every attempt);
- input, output and cached tokens, with unknown usage marked as unknown;
- estimated cost, at prices verified and dated on the run day.

## Change log

| Date | Change | Reason |
| --- | --- | --- |
| 2026-10-27 | Initial declaration (owner-approved, provisional; professor confirmation pending) | — |
| 2026-10-28 | **S2 episode briefing for model players** (owner-approved). Both model heroes now receive a fixed S2-only block after the general prompt (`S2_BRIEFING`, `packages/agent/src/suite.ts`). It says: the episode is Mirror Pond; Bridge Ruins (the area the shrine's "START / RETURN · E · Puzzle Map 2" sign leads back to) is already completed and out of scope, so do not return there; the goddess's offering is the overall quest goal, not this episode's objective; solve it with normal observations, actions and messages. It gives no direction, position, item or step. Briefed policies are named `…·briefing-<id>`. Scripted baselines receive no prompt and are unchanged. Scenarios, seeds, start states, limits and goals are unchanged. | In pilot-5 (S2 seed 0, OpenAI) the party took the shrine's way back to Bridge Ruins 2.3 game seconds in. Players had only been told "Complete the Goddess's quest together." and could not tell which part of the quest S2 evaluates. Entering Bridge Ruins re-creates its bridge puzzle, which must be solved again to return. **S2 model results before this change (pilot-4, pilot-5) and after it are reported separately.** Audit: `agent-evidence/skill-runs/2026-10-28-suite-s2-briefing.md`. |
| 2026-10-28 | **S2 briefing revised** (owner's text, verbatim). It now also states the objective: "Your objective is to obtain the **Vanity Mirror** and add it to the shared quest inventory." That is S2's success condition, the one the evaluator checks; the item is named, not how to get it. The other points are unchanged apart from wording. The policy-name id changes, so runs with this revision (`·briefing-da2b791e`) are told apart from the first version (`·briefing-` plus that version's id). | The owner decided the open question from the briefing audit (`agent-evidence/skill-runs/2026-10-28-suite-s2-briefing.md`, question 1). No paid run used the first version. |
| 2026-10-28 | **S2 briefing second revision and pilot-6 interface fixes** (owner-approved content; the briefing's wording is the implementation agent's draft, pending the owner's final wording). Briefing: only the shrine's "START / RETURN · E · Puzzle Map 2" sign leads to Bridge Ruins, which stays out of scope; every other area's RETURN exit leads back to the shrine and may be used; visiting another area such as Hedge Maze is not a failure and its objectives may be completed, but only the Vanity Mirror completes the episode. Runs with it are `·briefing-1051906a`. For every scenario and both providers: move results report how far the hero went against open ground (`movement`), the Hedge Maze cow is listed as "cow" with its sign fixed where the client draws it, `self` is truncated to two decimals, and the general prompt gains a screen legend for position and footprint and the line "Tell your partner when your plan changes or when you observe an important change in the world." Scenarios, seeds, start states, limits and success conditions are unchanged. The scripted route and both baselines round `self` back to one decimal internally, so their actions, the S2–S4 start states and the baseline results are unchanged (checked before and after: route seed 1, both baselines on S1–S3 seed 0). | In pilot-6 (S2 seed 0, OpenAI, `·briefing-da2b791e`) both players treated the Hedge Maze's own RETURN exit as forbidden; blocked moves came back looking successful (Coco made 8 moves of 0.0 tiles in a row); the cow kept the label "blocks the lane" after it moved; and Sieg's position read 26.0 while he was drawn in column 25. **S2 model results before this change (pilot-4 to pilot-6) and after it are reported separately; S1 and S3 model results likewise, because the general prompt and observation changed.** Audit: `agent-evidence/skill-runs/2026-10-28-adapter-pilot6-fixes.md`. |
| 2026-10-28 | **Movement report and position fixes after the rules review** (owner-approved, findings 1–6). A move's `movement` now compares only the ticks on which the server moved the hero by that move's input, at the Slow Time state movement actually used; ticks the server did not take the input, or moved the hero itself, are counted separately with their own neutral lines and outcome `not_applied`. `self` truncation no longer has a rounding guard. Prompt legend wording for marked cells. Scenarios, seeds, start states, limits, briefing and success conditions are unchanged; the scripted route and both baselines are pinned unchanged by `scriptedFreeze.test.ts`. | A move starting with Slow Time was falsely reported as blocked (review finding 1, confirmed); server-overridden ticks were counted as walking (finding 2); the guard changed scripted players' rounding on positions reached by walking (property test). **S1–S3 model results from before this change are reported separately.** Audit: `agent-evidence/skill-runs/2026-10-28-adapter-pilot6-review-fixes.md`. |
| 2026-10-28 | **Observation fixes after the independent review** (owner-approved, findings 1–5). Short moves are judged against open ground on unrounded distances; a lethal hit adds a neutral defeat-and-respawn line to the hero's running action (not an interruption); partners, enemies, creatures, projectiles and effects are listed truncated to two decimals like `self`; story-walk ticks are not counted as the hero's walking. Scenarios, seeds, start states, limits, briefing and success conditions are unchanged; scripted behaviour is pinned unchanged (`scriptedFreeze.test.ts`). **Note:** the `explore/S2` and `explore/S3` baseline runs are one trajectory and must not be counted as two independent results. | Independent review (session 37, `fb844ae`): a false collision line on short slowed moves, silent lethal respawns, listed coordinates disagreeing with their drawn cell, and a same-direction story walk counted as walking (reproduced). **S1–S3 model results from before this change are reported separately.** Audit: `agent-evidence/skill-runs/2026-10-28-adapter-independent-review-fixes.md`. |
| 2026-10-28 | **Pilot-7 observation and prompt fixes** (owner-approved; implementation `5ab4693`, record `PILOT7_FIXES.md`). Mirror Pond spike columns are drawn and listed at their full four-tile height (current phase only). The pond's painted text is listed as kind `label` with no screen character. An E press that changes nothing reports "You pressed E; nothing responded." The system prompt gains general communication rules. The shared exploration S2/S3 baseline pin was re-pinned (old values kept in the record). Scenarios, seeds, limits and goals are unchanged. | Pilot-7: a single-cell spike drawing and `o`-marked painted text misled both heroes. **Model results before and after `5ab4693` are reported separately.** |


## 2026-10-28 change log: approved additive local starts

Owner-approved S2-local and S3-local were added in `115c542`. Original scenarios and frozen route/checkpoints remain unchanged. These tuning variants end preparation at ordinary area entry, preserve arrival dialogue and the authoritative world, and reuse parent success predicates/limits with separate identities and results. Do not pool them with travel-inclusive scenarios. Protocol, hashes and restricted test selection: [LOCAL_STARTS.md](LOCAL_STARTS.md). No further local variant is implemented or authorized.
