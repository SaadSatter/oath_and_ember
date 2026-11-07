# Situation C: Griffin Trial, Prepared, with Goddess Return

Scenario `griffin-prepared-return-v1`. Prepared 2026-11-06 by the Claude Code implementation agent, following the owner's decisions recorded below. **Status:** declaration r10 **active** (owner final authorization 2026-11-06). Paid runs are allowed only in the authorized scope (`C_PAID_SCOPE`: model-centralized, openai:gpt-6-luna@medium, batch 4, seed 0, ≤ $0.75 per episode). Results are in the "Official C results" section once they are run.

## Owner decisions (2026-11-06)

The implementation agent asked these questions before writing code, because the owner's brief and declaration r9 disagreed. The answers below are the owner's.

| Question | r9 / brief said | Owner decided |
| --- | --- | --- |
| How the prepared start is built | r9: earn the tools through ordinary maze and pond play; never inject inventory | **Inject the items into B's start.** B-return's ordinary prefix, then a start fixture adds Vanity Mirror ×1 and Enchanted Shears ×1 to the shared backpack |
| Scenario id | r9: `griffin-prepared-v1`; brief: `griffin-prepared-return-v1` | **`griffin-prepared-return-v1`** |
| Success | r9 and the brief: Griffin HP 0 AND wig in the backpack; a peaceful wig must not count; no return | **Wig claimed by any normal route (Griffin HP does not matter) AND offered to the goddess AND `chapter0.complete`; no knockout** |
| Enclosure boundary | r9 and the brief: leaving the enclosure fails | Removed: the return requires leaving |
| Prompt for C1 and C3 | brief: C1 = the original untuned prompt; the Griffin Trial briefing contradicted the new objective | **Tutorial + a new C briefing**; round 2: the owner's neutral text, verbatim (below) |
| Existing B pin tests | Two tests pin 17 run-path files to commit 2791bce | **Re-pin, keep history:** verify the 2791bce hashes from git history, and add B-equivalence pins at HEAD |

C2 reuses the B baseline unchanged, as the brief asks. r9 had fallen back to the solution-aware `baseline-quest` for C.

**Round 2 (owner, 2026-11-06):** C2 = `baseline-griffin-heuristic-v1`, approved. `baseline-inventory-heuristic-v1` is a C-specific exploratory baseline, excluded from the official evaluation (preserved). Scenario, injected start and success rule approved: a peaceful completion is valid. Briefing replaced by the owner's neutral text, with no agent-facing "prepared". C1/C3 prompt comparison approved in principle. Descriptive route metrics added (below). One official run per cell, never selected by route. r10 is not activated and the paid lock stays on.

## Start state

| Item | Value |
| --- | --- |
| Seed / tick | 0 / 540 (the same tick as B-return) |
| Start hash (seed 0) | `28777a85eebd55998461e7bbfff9ca36fd0bb0d68ba5d9888bc676acf84414d7` |
| Start hash (seed 1; only the ids differ) | `dc638ff166d36edfc777d36c24f155f77d013fcb72633b4becda330aa63ccab7` |
| Prefix actions SHA-256 | `1cf7940acb58e02d7509b7567c6e63457c48231b0424f9f77b6ae781d8fff81d` (200 Sieg + 60 Coco, identical to B-return's) |
| Definition file | [C-prepared-return-definition.json](evaluation-abc/C-prepared-return-definition.json), `fbc5a96af3f409f65f85ea516af47b519a5b3bcd0fb29557adeb2ac1201ca027` |
| Code definition hash | `SITUATION_GRIFFIN_C_HASH` = `048679a38eea4e15177af2990fac94c19b2cd4f0c40de33a92c559a57f22d4a4` |
| Heroes | Sieg (18.5, 33) and Coco (21.5, 33), 100/100 HP, the same ability states as B-return |
| Griffin | 640/640 HP, NEST at (640, 112) px, four pillars standing, no tool delivered, wig unclaimed |
| Backpack | B-return's eight items + `vanity_mirror` 1 + `enchanted_shears` 1; `griffin_wig` 0 |

### Diff against B-return (`45b1a6aa…`)

Produced by `scripts/midterm/situation-c.ts` over the whole serialized authoritative world (`room.state`; private `GameRoom` fields are not compared), both heroes' observations and their legal actions (`evidence/situation-c-preparation/initial-state-diff.json`):

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
2. **If the Griffin is alive,** the Mirror starts grooming: the Griffin returns to the nest and admires itself, then cuts its hair with the Shears, takes both tools and flies away, dropping the wig. While it grooms, `damageGriffin` ignores all hits and the Griffin does not attack (its tick returns before any attack logic, and any beam is cleared). Once the wig is claimed, the Griffin can never be damaged again. Coco's next E at the nest claims the wig, with the Griffin's HP unchanged from when grooming began. Partial delivery: the Mirror alone (`use_item`) starts grooming that loops without ever cutting, leaving the Griffin immune, until the Shears arrive. The Shears alone start nothing until the Mirror arrives (the Mirror-only case is tested; the Shears-only case is read from source).
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
| C1 pre-tuned | `model-centralized`, gpt-6-luna, medium effort, batch 4 | `centralized-f0592888(…)·batch4·tutorial-2ec2f251·briefing-1ba46753`, system prompt `6dc64411b2373596f925360334680211657c266a3fe5487b4f687868740e3701`, no guidance |
| C2 baseline | `baseline-griffin-heuristic-v1`, source `a7c9ea78…2edc`, unchanged (owner-approved) | none (no prompt) |
| C3 post-tuned | as C1 + `b-post-combined-v4` | `…·briefing-1ba46753·guidance-12874542`, system prompt `a0c6939af45f82a10ef80dfcbcd2c40c60ca82f01d91a55f330d624292fb9323` = C1's prompt + v4's block (tested) |

**Pilot-33's guidance, verified.** The recorded `guidanceHash` is `12874542…f1bdf34`, and the check script reproduces Pilot-33's recorded full prompt hash `7ff08ba8…2144` and Pilot-31's `cbabb78b…bb6a` at HEAD. The v4 text is unchanged and still owner-approved. The one change is that its allowed situations now include C, as the owner instructed. It contains no word about the Mirror, Shears, nest, grooming, wig or Griffin (tested).

**C briefing (the owner's text, round 2, verbatim; identical for C1 and C3).** It contains no "prepared", Mirror, Shears, nest, grooming or peaceful-solution wording, and no defeat requirement (tested). The planner wraps it in its usual `=== Episode briefing ===` block; nothing else was adapted:

> You and your companion are at the Griffin Enclosure. Your objective is to obtain the Magnificent Griffin Wig and bring it to the Goddess as an offering. Complete the offering without either hero being knocked out. You may use your available abilities, inventory, and ordinary interactions. Determine how to proceed from what you observe.

The briefing ends at the offering. Success also needs `chapter0.complete`, which the game reaches through the dialogue scenes that follow an accepted offering. The planner's generic task line, "Complete the Goddess's quest together.", is still present. Code identifiers such as `GRIFFIN_PREPARED_RETURN_BRIEFING`, the scenario id and the scenario title contain "prepared", but none of them reaches a player; a test checks that neither C prompt contains the word.

**Parity limits.** C1 and C3 differ only by the guidance block. C1 is the original untuned planner prompt (`f0592888`, no guidance) with Pilot-31's tutorial and the owner's C briefing. It is not byte-identical to any earlier pre-tuned prompt, because the briefing is new. B-return (Pilot-33) used a task line with no tutorial or briefing, so C3 and Pilot-33 share the v4 block but not their framing. Do not report B to C as an inventory-only or prompt-only contrast. One asymmetry belongs to the guidance effect: only C3's v4 step 8 ("follow the task to its end") pushes the planner past the offering to `chapter0.complete`. C1 relies on the generic task line alone.

## C2 baseline, free preparation runs (unregistered)

`baseline-griffin-heuristic-v1`, unchanged. It reads observations only, keeps separate per-hero memories, makes no model calls, and has no Griffin coordinates or route. It fights first and uses the nest only after a visible defeat, so it never takes the peaceful route and does not reason about the Mirror or Shears. Adding that reasoning would be a C-specific branch, which the holdout rule forbids.

| Run | Seed | Result | Game-s | Decisions (Sieg/Coco) | Invalid | Model calls |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | success | 89.8 | 481 / 646 | 0 | 0 |
| 2 | 0 | success (identical end hash) | 89.8 | 481 / 646 | 0 | 0 |
| 3 | 1 | success | 89.8 | 481 / 646 | 0 | 0 |

These runs were made to certify the scenario. They are not the registered C2 cell, which should be a fresh free run at the approved commit. Identical deterministic repeats are not independent evidence.

**The approved C2 wins through combat and does not demonstrate prepared-item use.** Its descriptive report shows: route `defeat`, Griffin HP 0, `itemsDeliveredWhileGriffinAlive` false and `peacefulGroomingOccurred` false. The E at the nest after the defeat only sets the tools' delivery flags: nothing leaves the backpack and the items have no effect. On C it replays B-return's baseline trajectory exactly (5,389 ticks, 481/646 decisions), so it gives no information about the value of preparation.

`baseline-inventory-heuristic-v1` (`4f9695b`, another session) is classified by the owner as a **C-specific exploratory baseline, excluded from the official evaluation**. Its code and history are preserved. It has not been run on C.

## Descriptive route metrics (owner request, round 2)

Every C summary carries `situationCReport`, read from authoritative state at the end plus the evaluator milestones seen during the episode (`evaluator.ts` `situationCReport`). **None of these is a success requirement**, and none is shown to a player:

- `objectiveSuccess`, `terminalReason`
- `griffinHpAtEnd`, `griffinPhaseAtEnd`, `griffinDefeated`
- `mirrorDelivered`, `shearsDelivered`, `itemInteractionUsed`: any E at the nest drops held tools, so these are also true after a combat defeat
- `griffinHpAtFirstItemDelivery`, `itemsDeliveredWhileGriffinAlive`: a tool was delivered while the Griffin was alive; this may have had no effect (the Shears alone do nothing)
- `griffinHpAtMirrorDelivery`: the delivery that can start grooming
- `peacefulGroomingOccurred`, `toolsTakenByGriffin`: the peaceful-route markers. Together with `wigRoute`, these are the effective prepared-item-use markers
- `wigAcquired`, `griffinHpAtWigClaim`, `wigRoute` (`defeat` / `peaceful` / `none`, or `unknown` if the evaluator never observed the claim)
- `offeringAccepted`, `chapter0Complete`

Game time, wall time, decisions, calls, cost and invalid actions are ordinary summary fields. Both routes are tested: the baseline's combat win, and the fixture-positioned peaceful grooming.

**Selection rule:** one official run per cell (C1, C2, C3), recorded whatever route it takes. A run is never chosen, replaced or repeated because of its route or outcome.

## Mock model episodes (launcher checks, not results)

`npm run eval:live -- --scenario griffin-prepared-return-v1 --seed 0 --player model-centralized [--guidance b-post-combined-v4] --gateway mock --no-viewer`. The mock gateway picks random legal actions and costs $0.

Round 1 (`a3ce5ab`, earlier briefing; `evidence/situation-c-preparation/`):
- C3 mock: ended `error` (the planner's stall watchdog tripped) at 32.6 game-s, 9 calls.
- C1 mock: ended `knocked_out` at 43.7 game-s, 23 calls. This exercised the knockout failure in actual play.

Round 2 (`f3b718d`, the owner's briefing; `evidence/situation-c-preparation-r2/`). The mock summaries record `f3b718d+dirty`: they ran after the new, still uncommitted evidence folder had been written. No source file was modified, and their prompt hashes match the pins.
- C1 mock: ended `error` (stall watchdog) at 93.9 game-s, 17 calls. The prompt hash `6dc64411…` matches the pin.
- C3 mock: ended `error` (stall watchdog) at 123.7 game-s, 53 calls. The prompt hash `a0c6939a…` matches the pin.
- Both summaries carry `situationCReport`: Griffin untouched at 640 HP, no item delivery, no wig.

All four traces replay exactly with `scripts/midterm/replay-video.ts --check-only`: start hash, every step result, end hash and tick count. Round 2's C2 preparation runs (3/3, route `defeat`) are in `situation-c-preparation-r2/summary.json`.

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

## Review round 1 (2026-11-06)

The independent `rules-reviewer` report is saved verbatim in [agent-evidence/reviews/2026-11-06-situation-c-rules-review.md](agent-evidence/reviews/2026-11-06-situation-c-rules-review.md). It had no critical findings. The implementation agent's responses:

| # | Finding | Response |
| --- | --- | --- |
| 1 | Major, if chosen: `baseline-inventory-heuristic-v1` is tuned to C's literal item text | Recorded in r10's `alternativeCandidate`. The C2 choice remains the owner's. |
| 2 | C2 reproduces B2's trajectory exactly | Disclosed here and in r10. **C2 gives no information about the value of preparation.** It wins by fighting, as in B; the E at the nest after the defeat only sets the tools' delivery flags (nothing leaves the backpack). |
| 3 | v4 is a combat plan, and may bias C3 toward fighting | Disclosed in r10 (`transferCaveat`) and here. C1 to C3 mixes general transfer with that bias. Guidance text not changed. |
| 4 | Working-tree pins on five B files were dropped | Added a test pinning B-return's limits, failure cases, prefix name, task and missing briefing/tutorial at HEAD, alongside the existing start-hash and prompt-hash pins. |
| 5 | The pins need git history | CI now checks out full history. If `2791bce` ever becomes unreachable (for example after a squash merge), tag it first. Not tagged here (owner's choice). |
| 6 | The start fixture accepted any item, in any preset | Fixed: tool items only, `griffin-prepared-return-v1` only, closed after reset (tested). |
| 7 | C prompt hashes were checked only by the script | Added a vitest: C3's prompt = C1's + v4 block, both hashes computed by the real planner. |
| 8 | Mechanics wording | Corrected above: HP is unchanged rather than full, no attacks while grooming, partial delivery (Mirror-only case tested). |
| 9 | Model, effort and batch are only command-line flags | To be enforced when C is unlocked. The registered commands above fix them, and the policy id and configHash record them. |
| 10 | The mock exemption is by gateway label | Kept. A new test refuses every model player kind on C with a paid gateway. |
| 11 | The evaluator goal text named the route | Reworded to neutral text; a test checks it is absent from C's prompt. The code definition hash is now `f68bf85b3bd571be186b04c46083040a179941d0d54fba3eab3f74523d197400`. The evidence summaries recorded at `a3ce5ab` keep the earlier hash `d563c6eb…`, correctly for that commit. |
| 12 | "(Griffin Trial, prepared)" in the briefing | Owner's wording decision; flagged for approval. |
| 13 | The centralized planner sees both heroes | Existing, disclosed, the same for C1 and C3. |
| 14 | The diff compares `room.state` only | Wording clarified above. |

Reviewer uncertainties, settled by the implementation agent with git: the Pilot-31/32/33 records, B evidence and declaration r9 are byte-unchanged since `9f4ac38`; B-return's prefix name is identical to `2791bce`'s; the game client's backpack panel shows item descriptions (`apps/client/src/ui/inventory.ts:196-198`), so they are ordinary player-visible text.

## Review round 2 (2026-11-06)

Report saved verbatim: [agent-evidence/reviews/2026-11-06-situation-c-round2-rules-review.md](agent-evidence/reviews/2026-11-06-situation-c-round2-rules-review.md). It had no critical or major findings. The reviewer confirmed:
- the briefing matches the owner's text verbatim;
- C1 and C3 get identical tutorial and briefing;
- no route words appear in any prompt;
- the hashes agree across files;
- the tracking is read-only and C-guarded;
- r10 preserves r9's A/B rows.

Responses:

| # | Finding | Response |
| --- | --- | --- |
| 1 | `itemsDeliveredWhileGriffinAlive` counts ineffective deliveries | Reworded. Added `griffinHpAtMirrorDelivery`. Tested: Shears alone → no grooming, ineffective delivery reported. Effective markers: `peacefulGroomingOccurred`, `wigRoute`. |
| 2 | `wigRoute` fell back to "peaceful" if a claim was never seen | Now `unknown` (tested). |
| 3 | "Dropped" wording vs "tools stay in the backpack" | Corrected here and in r10: the post-defeat E only sets flags. |
| 4 | Stale "(draft)" in r10 decisions | Fixed. |
| 5 | Freeze step dropped from the holdout order; `postGuidanceB` scope | Freeze step restored as the first step. `postGuidanceB` marked as the r9 record. |
| 6 | Mock summaries recorded `+dirty` | Disclosed above: only the uncommitted evidence folder. |
| 7 | C1/C3 asymmetry past the offering | Added to the parity limits and to r10's consequences. |
| 8 | Evaluator-only warning displaced | Moved back above `evaluatorReport`. |
| 9 | Session record compressed rounds 1 and 2 | Session record note split. |
| 10 | No test of the declaration hashes | Added: recomputes r9 (pinned `616c1824…`, so unchanged) and r10 (`989046a9…`). |

Not added: an end-to-end peaceful run through the offering to `chapter0.complete`, which would need a scripted route through the shrine scenes. The peaceful path is covered up to the wig claim, and success after that by the predicate tests. The same-tick defeat-and-claim case is also not added; the reviewer traced it as correct.

Reviewer uncertainties, settled with git: r9 and the B evidence are byte-unchanged since `9f4ac38`. Round 2's source changes are confined to C-guarded code, the summary field and the briefing.

## Official C1 result (Pilot-34, declaration r10)

Run by the owner at `f9edeb7` (ledger entry `pilot-34`). **Success by the peaceful route:**

| Metric | Value |
| --- | --- |
| Game time / wall time | 133.3 game-s (7,997 ticks) / 2,479.7 s |
| Griffin | HP 418 throughout (never defeated); grooming started at the first Mirror delivery (HP 418) |
| Wig / offering / Chapter 0 | claimed (route `peaceful`) / accepted / `chapter0.complete` |
| Decisions / invalid actions | Sieg 378 / Coco 359; 1 + 1 invalid |
| Model calls | 278 attempted, 0 failed, 0 timed out; mean latency 8.35 s (max 21.1 s) |
| Tokens / cost | 5,449,743 input (2,065,866 cache read, 3,383,043 cache write), 179,558 output; **$0.586742** |
| Prompt / config | `6dc64411…` (as pinned) / `178f2ce5…` |
| Start / end hash | `28777a85…` / `a5090db2…` |

Replay verified: start hash, 734 step results, end and 7,997 ticks all match. Evidence: [`midterms/saadsatter/evidence/traces/pilot-34-model-centralized-griffin-prepared-return-v1-seed0/`](../../midterms/saadsatter/evidence/traces/pilot-34-model-centralized-griffin-prepared-return-v1-seed0/). The 217 MB video is local-only, and its SHA-256 is in the manifest.

## r11 (active): C3 = v4 + inventory/nest hint (owner request, after C1)

After C1 had run, the owner asked that the post-tuned C3 also tell the planner to check the inventory and read what is at the Griffin's nest, as a hint toward the solution but not the solution itself. The official C3 is replaced (owner's choice). **Active since the owner's approval** (`1fd604c2…`), classified as **outcome-informed, C-specific supplementary tuning, not independent B-to-C transfer**. Proposal: [proposed/declaration-r11-c3-hint.json](evaluation-abc/proposed/declaration-r11-c3-hint.json), `5f55307efe676bbc2f86b21ced5babeb4a10d3e8675e19848117ad7ed565b01c`.

- **Guidance `c-post-v4-inventory-hint-v1`** (`d750861b…`, **approved by the owner**, exact text): the v4 text byte for byte, a blank line, then:

  > Additional guidance for this task:
  > Before choosing how to reach the objective, check the shared inventory and read each item's description. Read the labels and messages on objects near the objective, such as the Griffin's nest: they can describe what an item is for. Consider whether an item offers a way to reach the objective besides combat.

- **C3 prompt:** `d50dc0623921ed00bedb811841d72153fe9b943e072ee180c63bc7856b52dd54` = C1's prompt plus this one block (tested). C1's prompt is unchanged.
- **Disclosures:**
  - **Outcome-informed:** the hint was requested after C1's peaceful success was known.
  - **C-specific tuning:** C3 is no longer a B→C transfer test, and C is no longer a clean holdout for C3.
  - **Strong hint:** in ordinary play, the nest label it points to reads "Griffin nest · drop mirror + shears".
  - r10's v4-only C3 (`a0c6939a…`) was never run.
- **Budget:** C1 cost $0.587, leaving $0.913 of the $1.50 combined cap, so C3's $0.75 cap fits.
