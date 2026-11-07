# Situation C: Griffin Trial, Prepared, with Goddess Return

Scenario `griffin-prepared-return-v1`. Prepared 2026-11-06 by the Claude Code implementation agent, following the owner's decisions recorded below. **Status:** implemented and checked offline. The declaration ([proposed r10](evaluation-abc/proposed/declaration-r10-c.json)) is **not active**: r9 remains the active declaration. Paid model runs on C are **locked in code** (`SITUATION_C_PAID_APPROVED = false` in `packages/agent/src/griffinSituationC.ts`). No paid call, push or merge has been made.

## Owner decisions (2026-11-06)

The implementation agent asked these questions before writing code, because the owner's brief and declaration r9 disagreed. The answers below are the owner's.

| Question | r9 / brief said | Owner decided |
| --- | --- | --- |
| How the prepared start is built | r9: earn the tools through ordinary maze and pond play; never inject inventory | **Inject the items into B's start.** B-return's ordinary prefix, then a start fixture adds Vanity Mirror ×1 and Enchanted Shears ×1 to the shared backpack |
| Scenario id | r9: `griffin-prepared-v1`; brief: `griffin-prepared-return-v1` | **`griffin-prepared-return-v1`** |
| Success | r9 and the brief: Griffin HP 0 AND wig in the backpack; a peaceful wig must not count; no return | **Wig claimed by any normal route (Griffin HP does not matter) AND offered to the goddess AND `chapter0.complete`; no knockout** |
| Enclosure boundary | r9 and the brief: leaving the enclosure fails | Removed: the return requires leaving |
| Prompt for C1 and C3 | brief: C1 = the original untuned prompt; the Griffin Trial briefing contradicted the new objective | **Tutorial + a new C briefing** (draft wording below, pending the owner) |
| Existing B pin tests | Two tests pin 17 run-path files to commit 2791bce | **Re-pin, keep history:** verify the 2791bce hashes from git history, and add B-equivalence pins at HEAD |

C2 reuses the B baseline unchanged, as the brief asks. r9 had fallen back to the solution-aware `baseline-quest` for C. This choice is recorded in proposed r10 for the owner's review.

## Start state

| Item | Value |
| --- | --- |
| Seed / tick | 0 / 540 (the same tick as B-return) |
| Start hash (seed 0) | `28777a85eebd55998461e7bbfff9ca36fd0bb0d68ba5d9888bc676acf84414d7` |
| Start hash (seed 1; only the ids differ) | `dc638ff166d36edfc777d36c24f155f77d013fcb72633b4becda330aa63ccab7` |
| Prefix actions SHA-256 | `1cf7940acb58e02d7509b7567c6e63457c48231b0424f9f77b6ae781d8fff81d` (200 Sieg + 60 Coco, identical to B-return's) |
| Definition file | [C-prepared-return-definition.json](evaluation-abc/C-prepared-return-definition.json), `9c91accdecc529a6284dff61306ea9ebbbb753db5c86a74888a360b987b2ea94` |
| Code definition hash | `SITUATION_GRIFFIN_C_HASH` = `d563c6eb948063a6d4e0c854fa5eed3ef957b592530b67c806df71ca1ab3ba11` |
| Heroes | Sieg (18.5, 33) and Coco (21.5, 33), 100/100 HP, the same ability states as B-return |
| Griffin | 640/640 HP, NEST at (640, 112) px, four pillars standing, no tool delivered, wig unclaimed |
| Backpack | B-return's eight items + `vanity_mirror` 1 + `enchanted_shears` 1; `griffin_wig` 0 |

### Diff against B-return (`45b1a6aa…`)

Produced by `scripts/midterm/situation-c.ts` over the whole authoritative world, both heroes' observations and their legal actions (`evidence/situation-c-preparation/initial-state-diff.json`):

| Path | B-return | C |
| --- | --- | --- |
| `inventory.counts.enchanted_shears` | absent | 1 |
| `inventory.counts.vanity_mirror` | absent | 1 |
| `inventory.revision` | 14 | 15 |
| Observations, both heroes | eight items | `inventory.items` also lists the two tools, with their in-game descriptions |
| Legal actions | identical | identical |

Nothing else differs: hero positions, HP, cooldowns, facing, story flags, claims, journal, Griffin and pillars. The inventory difference is the only one at the start.

**Consequences of injecting rather than earning the items** (disclosed, not hidden):
- The Hedge Maze and Mirror Pond chests remain unclaimed, and their banter flags are unset. A player who travels there could collect a second copy. No player needs to.
- The item descriptions now visible are ordinary game text: "A shared enchanted garden tool. Keep it for the Griffin's nest." and "An ornate mirror for the proud Griffin. A shared quest tool." The nest's own label reads "Griffin nest · drop mirror + shears". In B-return the players would see the same nest label, but not the item descriptions.

## Mirror and Shears under ordinary rules

Verified in `apps/server/src/griffin.ts` and by tests (`packages/agent/test/griffinSituationC.test.ts`, "Mirror and Shears under ordinary game rules"). No mechanic was added or changed.

1. Only Coco can use the nest, which lies over water, so she has to fly there. A plain E at the nest drops every tool the party holds.
2. **If the Griffin is alive,** the Mirror starts grooming: the Griffin returns to the nest and admires itself, then cuts its hair with the Shears, takes both tools and flies away, dropping the wig. While it grooms, `damageGriffin` ignores all hits. Once the wig is claimed, the Griffin can never be damaged again. Coco's next E at the nest claims the wig, with the Griffin at full HP.
3. **If the Griffin is at 0 HP,** E at the nest awards the wig at once. The tools stay in the backpack.
4. The tools add no combat ability. Their only effect is the peaceful route, which under the owner's C rule is a legal way to obtain the wig.

## Success and failure (`griffinWigReturned`, `packages/agent/src/evaluator.ts`)

- **Success:** authoritative `griffin.wigClaimed` AND `story.flags` contains `chapter0.complete`. Griffin HP is not part of the predicate.
- **Not enough on its own:** entering the enclosure; waking, damaging or defeating the Griffin; delivering the tools; holding the wig; the offering without `chapter0.complete`.
- **Failure:** any authoritative knockout, checked before success on every tick (the game respawns a downed hero at full HP, so final HP would not show it). Leaving the enclosure is not a failure.
- **Limits:** the same as B-return. 18,000 ticks (300 game-s); per hero 1,600 decisions, 400 calls and 4M tokens; 30 s per call; three consecutive policy failures; 3,600 s model and 600 s baseline wall time; $0.75 per episode.
- **Tests (each pair below is checked separately):** defeat alone → no; defeat + wig, no `chapter0.complete` → no; + `chapter0.complete` → yes; peaceful wig at 640 HP + `chapter0.complete` → yes; `chapter0.complete` without a claimed wig → no; a lethal hit → `knocked_out`; all heroes at the shrine → not a failure.

## Conditions

| Cell | Player | Prompt / policy identity |
| --- | --- | --- |
| C1 pre-tuned | `model-centralized`, gpt-6-luna, medium effort, batch 4 | `centralized-f0592888(…)·batch4·tutorial-2ec2f251·briefing-63b9fbdc`, system prompt `a6fa78a05e368b6f128844eff22b4b891d4892a772a27fba9c6fac066fab079e`, no guidance |
| C2 baseline | `baseline-griffin-heuristic-v1`, source `a7c9ea78…2edc`, unchanged | none (no prompt) |
| C3 post-tuned | as C1 + `b-post-combined-v4` | `…·briefing-63b9fbdc·guidance-12874542`, system prompt `be19b8b5e9c350ecaf7ff7f4a478b3ca96bb1b3864d2527744823e2908548db8` = C1's prompt + v4's block |

**Pilot-33's guidance, verified.** The recorded `guidanceHash` is `12874542…f1bdf34`, and the check script reproduces Pilot-33's recorded full prompt hash `7ff08ba8…2144` and Pilot-31's `cbabb78b…bb6a` at HEAD. The v4 text is unchanged and still owner-approved. The one change is that its allowed situations now include C, as the owner instructed. It contains no word about the Mirror, Shears, nest, grooming, wig or Griffin (tested).

**C briefing (DRAFT, pending the owner's wording).** It sets out the goal and the survival rule only. It does not mention the items, the nest, any route, any attack pattern, or whether the Griffin must be defeated (tested):

> Episode briefing (Griffin Trial, prepared), the same for both players: you start at the entrance of the Griffin Enclosure. Your objective is to obtain the Griffin's wig, bring it back to the Bald Goddess at the shrine, offer it to her and see Chapter 0 through to its end. Neither hero may be knocked out: if either hero's health runs out, the episode ends as a failure. Use your normal observations, actions and messages to your partner.

**Parity limits.** C1 and C3 differ only by the guidance block. C1 is not byte-identical to any earlier pre-tuned prompt: it reuses Pilot-31's tutorial but adds a new briefing. B-return (Pilot-33) used a task line with no tutorial or briefing, so C3 and Pilot-33 share the v4 block but not their framing. Do not report B to C as an inventory-only or prompt-only contrast.

## C2 baseline, free preparation runs (unregistered)

`baseline-griffin-heuristic-v1`, unchanged. It reads observations only, keeps separate per-hero memories, makes no model calls, and has no Griffin coordinates or route. It fights first and uses the nest only after a visible defeat, so it never takes the peaceful route and does not reason about the Mirror or Shears. Adding that reasoning would be a C-specific branch, which the holdout rule forbids.

| Run | Seed | Result | Game-s | Decisions (Sieg/Coco) | Invalid | Model calls |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | success | 89.8 | 481 / 646 | 0 | 0 |
| 2 | 0 | success (identical end hash) | 89.8 | 481 / 646 | 0 | 0 |
| 3 | 1 | success | 89.8 | 481 / 646 | 0 | 0 |

These runs were made to certify the scenario. They are not the registered C2 cell, which should be a fresh free run at the approved commit. Identical deterministic repeats are not independent evidence.

## Mock model episodes (launcher checks, not results)

`npm run eval:live -- --scenario griffin-prepared-return-v1 --seed 0 --player model-centralized [--guidance b-post-combined-v4] --gateway mock --no-viewer`. The mock gateway picks random legal actions and costs $0.

- C3 mock: ended `error` (the planner's stall watchdog tripped) at 32.6 game-s, 9 calls.
- C1 mock: ended `knocked_out` at 43.7 game-s, 23 calls. This exercised the knockout failure in actual play.

Both traces replay exactly with `scripts/midterm/replay-video.ts --check-only`: start hash, every step result, end hash and tick count.

## Commands

```sh
# Free checks: resets, B/C diff, baseline x3, prompt identities, paid lock
node --import tsx scripts/midterm/situation-c.ts [--evidence <new dir>]
npx vitest run packages/agent/test/griffinSituationC.test.ts

# C2 baseline (free)
npm run eval:live -- --scenario griffin-prepared-return-v1 --seed 0 --player baseline-griffin-heuristic

# C1 / C3, after the owner approves r10 and flips SITUATION_C_PAID_APPROVED in a reviewed commit:
npm run eval:live -- --scenario griffin-prepared-return-v1 --seed 0 --player model-centralized --gateway openai --model gpt-6-luna --effort medium --max-spend-usd 0.75 --paid
npm run eval:live -- --scenario griffin-prepared-return-v1 --seed 0 --player model-centralized --guidance b-post-combined-v4 --gateway openai --model gpt-6-luna --effort medium --max-spend-usd 0.75 --paid
```

Maximum paid spend: 2 runs × $0.75 cap = **$1.50**, both from the pilot stage of the shared ledger. For reference, Pilot-33 cost $0.554 and Pilot-32 $0.206. Prices must be re-checked before any paid call.

## Limitations

- The start is set up by injection (the owner's decision), not reached through play. The fixture runs only during reset, is never given to a policy, and writes only the two counts and the backpack revision.
- `Situation.heldOut` is `false` in code, as it is for B. A code-level holdout would refuse the tuning-path launcher that `model-centralized` requires. The holdout is enforced by the paid lock and the declaration.
- The C2 outcome is known before any model run (3/3 free preparation successes). No model policy changed after it.
- One run per cell with a small sample: no statistical claim.
- The pre-existing `s2Shutdown` recorder test fails on HEAD both with and without these changes (a 200 ms timing assertion). It is unrelated to C.
