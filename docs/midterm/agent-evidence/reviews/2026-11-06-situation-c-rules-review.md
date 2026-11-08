# rules-reviewer: Situation C griffin-prepared-return-v1 (commits a3ce5ab, 14a268f, 2374a2d)

| Field | Value |
| --- | --- |
| Date | 2026-11-06 |
| Reviewer | `.claude/agents/rules-reviewer.md` subagent (read-only: Read, Grep, Glob), launched in a separate invocation by the Situation C implementation session at the owner's request; not instructed to approve |
| Reviewed | `midterm/evaluation` at `2374a2d`: Situation C scenario, evaluator, start fixture, paid lock, v4 scope, tests, docs, proposed r10 |
| Note | The report below is the reviewer's output, copied verbatim. The implementation agent's responses are in docs/midterm/SITUATION_C_PREPARED.md, "Review round 1". |

---

## rules-reviewer report: Situation C (griffin-prepared-return-v1), commits a3ce5ab, 14a268f and 2374a2d on midterm/evaluation

**Reviewed:** I read these files in full or in the relevant sections, at the paths named in the brief:
- `packages/agent/src/griffinSituationC.ts`
- `packages/agent/src/suite.ts` (lines 140–289)
- `packages/agent/src/environment.ts` (StartFixture and reset at 60–385; observe and legal_actions; progress at 856–865)
- `packages/agent/src/evaluator.ts` (lines 100–240)
- `packages/agent/src/harness.ts` (lines 40–540)
- `packages/agent/src/policies/situationGuidance.ts`
- `packages/agent/src/policies/griffinHeuristic.ts` (lines 100–340)
- `packages/agent/src/policies/inventoryHeuristic.ts`
- `packages/agent/src/actions.ts`
- `packages/agent/src/perception.ts` (Griffin label, inventory targets, inventory and journal)
- `packages/agent/src/playerKnowledge.ts` (the tutorial text)
- `packages/agent/test/griffinSituationC.test.ts`
- `packages/agent/test/helpers/pinnedRunPath.ts`
- `packages/agent/test/bPostCombinedV4Guidance.test.ts`
- `scripts/midterm/situation-c.ts`
- `scripts/midterm/live.ts` (lines 90–280)
- `scripts/midterm/run-episode.ts`
- `docs/midterm/SITUATION_C_PREPARED.md`
- `docs/midterm/evaluation-abc/C-prepared-return-definition.json`
- `docs/midterm/evaluation-abc/proposed/declaration-r10-c.json`
- `docs/midterm/evidence/situation-c-preparation/summary.json` and `initial-state-diff.json`

To check the game rules the scenario relies on, I also read `apps/server/src/griffin.ts`, `inventory.ts`, `shrine.ts` and `chapter0Finale.ts`, `apps/server/src/app.ts` (the `inventory:use` handler), `packages/shared/src/shrine.ts` and `items.ts`, `apps/client/src/ui/questLog.ts`, the Player Manual (grep) and `.github/workflows/midterm-ci.yml`.

**Not reviewed or unverifiable:**
- I have read-only tools, so I could not run typecheck, tests, build, `situation-c.ts` or vitest. Every hash below is checked for consistency between files, not recomputed.
- I could not run `git diff` or `git show`. So I could not confirm the exact contents of each commit, that Pilot-31/32/33 records and B evidence are byte-unchanged, or that commit 2791bce can be reached from the CI checkout.
- I did not check that the browser client's backpack panel really shows item descriptions (the doc says it does).
- I did not check `bPostCombinedV3Guidance.test.ts` beyond its use of the shared helper.

### Summary

The scenario matches the owner's six decisions:
- **Start:** B-return's prefix, then a start fixture that only runs during reset adds the two items.
- **Id:** griffin-prepared-return-v1.
- **Success:** `wigClaimed && chapter0.complete`.
- **Failure:** knockout only.
- **Prompts:** tutorial plus a new briefing; C3 adds the frozen v4 block.
- **C2:** the unchanged B baseline. **Pins:** the B pin tests are re-pinned to history.

The world, observation and legal-action differences from B-return at the start are limited to the inventory, as claimed. I found no leak of hidden Griffin, puzzle or evaluator state to a policy. The paid lock holds in both `validatePlan` and `live.ts`, and I found no open path to a paid C run.

The problems are about how the results can be read, and about test strength:
- C2 replays B's baseline step for step (same tick count and decision counts).
- The v4 guidance is about combat, which shapes C3 differently now that a peaceful route exists.
- The other baseline candidate is visibly tuned to C's item text.
- The re-pinning permanently stops the working-tree check on five B run-path files.
- C's prompt hashes are checked only by a script, not by vitest.

### Findings

| # | Severity | File:line | Issue | Why it matters | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| 1 | Major (only if this baseline is chosen as C2) | `packages/agent/src/policies/inventoryHeuristic.ts:14-34`, `:121` | The stop-word list removes exactly the flavour words in the C item descriptions ("ornate", "proud", "enchanted", "magnificent"). The tool filter `/tool\|opens\|offer\|keep.+for/` matches the Shears text "Keep it for the Griffin's nest". With those words gone, what remains ("mirror", "griffin", "nest") matches the nest label "Griffin nest · drop mirror + shears". | The proposal says only that it was "developed with knowledge of the prepared inventory setup". In fact the code is tuned to C's literal item text. Choosing it as C2 would break the stated holdout rule (no C-specific baseline). | If the owner chooses it, record it as C-informed and say so in r10's `alternativeCandidate`, with these lines cited. Otherwise keep the unchanged B baseline. |
| 2 | Minor (disclosure) | `docs/midterm/evidence/situation-c-preparation/summary.json:21-27` vs `docs/midterm/evidence/griffin-heuristic-v1/manifest.json:12-17`; `docs/midterm/SITUATION_C_PREPARED.md:87` | C2 runs end at tick 5389 with 481/646 decisions, identical to B's baseline. The C2 trajectory is B's fight. After the visible defeat, a plain E at the nest awards the wig (`griffin.ts:80-81`), and the tools are never used. | C2 measures nothing about preparation. "C2 vs B2" is the same run, and "C2 vs C1/C3" compares a fight-only baseline with models that may take the shortcut. The doc says C2 "never takes the peaceful route" but does not say its result is B's result repeated. | Say explicitly in the doc and in r10 that C2 reproduces B2's trajectory (same ticks and decisions) and gives no information about preparation. |
| 3 | Minor (validity, not disclosed) | `packages/agent/src/policies/situationGuidance.ts:103` (steps 2–5); `docs/midterm/SITUATION_C_PREPARED.md:83` | v4 is a combat plan: find an attack position, attack, verify damage, repeat. In C, success does not need combat. | The C1→C3 difference therefore mixes general tuning transfer with a push towards fighting instead of using the items. This is not a leak, but the "Parity limits" section does not mention it. | Disclose that v4 was tuned for B's defeat objective and may bias C3 towards combat. |
| 4 | Minor | `packages/agent/test/helpers/pinnedRunPath.ts:18-24, 30`; `bPostCombinedV4Guidance.test.ts:73-76` | The re-pinning permanently drops the working-tree check for `environment.ts`, `evaluator.ts`, `suite.ts`, `harness.ts` and `live.ts`. At HEAD, B is pinned only by its prompt hashes, its start hash and a definition hash taken from a docs JSON file (`griffinHeuristic.test.ts:164-176`). B-return's limits and failure function are not pinned independently. `griffinSituationC.test.ts:41` compares C's limits to B's, which proves nothing about B. | A later edit to these five files that changes B's behaviour (limits, failure, progress markers, prefix name in summaries) would pass the pin tests. The doc's "add B-equivalence pins at HEAD" (`SITUATION_C_PREPARED.md:16`) is only partly delivered. | Pin B-return's episode definition at HEAD: limits, `failure(w, {knockedOut})` cases and the prefix name. Optionally pin a hash of the B-return entry. |
| 5 | Minor | `packages/agent/test/helpers/pinnedRunPath.ts:28`; `.github/workflows/midterm-ci.yml:26` | The pin tests depend on `git show 2791bce:<file>`. | They fail without git, in a shallow clone, or if 2791bce stops being reachable (for example, the branch is squash-merged and deleted). | Store the 2791bce blobs' hashes alongside a reachable tag, or tag 2791bce. |
| 6 | Minor (hardening) | `packages/agent/src/environment.ts:337-351` | `StartFixture.addItems` accepts any string id: it is not checked against `items`, and it could inject `griffin_wig`. It is also passed to every scenario prefix, not only C's. | Only C uses it today, and the `open` flag correctly closes it after reset. But nothing in code limits the fixture to C's two items. | Type the ids as `ItemId`, allow only `vanity_mirror` and `enchanted_shears`, and refuse unless the preset is `griffin-prepared-return-v1`. |
| 7 | Minor (test gap) | `packages/agent/test/griffinSituationC.test.ts:95-96` | The C1 and C3 prompt hashes are compared only constant to constant: the definition JSON against `griffinSituationC.ts`. Only `scripts/midterm/situation-c.ts:100-118` builds the planner to compute them. No vitest asserts that C3's system prompt equals C1's plus `guidanceBlock(v4)`. The v4 test does this for B-return (`bPostCombinedV4Guidance.test.ts:46`) but not for C. | The claim "C3 = C1 + v4 block" is not enforced in CI. | Add a test: `planner(C, v4).system === planner(C).system + guidanceBlock(v4)`, with both prompt hashes computed. |
| 8 | Minor (doc accuracy) | `docs/midterm/SITUATION_C_PREPARED.md:57` | "Coco's next E at the nest claims the wig, with the Griffin at full HP" is true only if the Griffin was never damaged. Its HP is whatever it was when grooming began. | The doc also leaves out partial delivery. Mirror alone via `use_item` starts grooming, which loops at NORTH with the Griffin immune until the Shears arrive (`griffin.ts:82-85, 153-162, 175-183`). Shears alone does nothing until the Mirror arrives. It also leaves out that a grooming Griffin never attacks: `tickGriffin` returns before its attack logic (`griffin.ts:286-289`) and the beam is cleared (`:85`). That last point matters for "C is easier". | Reword as "with the Griffin's HP unchanged". Add the partial-delivery and no-attack-while-grooming facts. |
| 9 | Minor | `scripts/midterm/live.ts:125, 231`; `docs/midterm/SITUATION_C_PREPARED.md:119-120` | Equal model, effort and batch for C1 and C3 depend on command-line flags. `--max-batch` is configurable and defaults to 4. Nothing in code fixes gpt-6-luna, medium effort and batch 4 for C. | A mismatch would show only afterwards, in the policy id or configHash. | When unlocking, add a C-specific check of model, effort and batch in `live.ts` or `validatePlan`. |
| 10 | Note | `packages/agent/src/harness.ts:321` | The `validatePlan` lock exempts any gateway whose label starts with "mock:". | The real adapters' labels are fixed (`openai.ts:187`, `llm.ts:119`). `live.ts:115` checks independently before any credential is read, `run-episode.ts:40-43` refuses all paid runs, and `runSuite` always calls `validatePlan` (`harness.ts:409`). I found no open path. The test covers only `model-centralized` (`griffinSituationC.test.ts:66-76`). | Optionally add `instanceof MockGateway`. Test the other model kinds and `live.ts`'s refusal. |
| 11 | Note | `packages/agent/src/evaluator.ts:168`; `environment.ts:377` | The evaluator goal text names the route ("by defeat or by the nest tools"). It is returned in `EpisodeState.goal` from `reset()`. | It is not passed to policies today: `runner.ts:65` keeps it, and `policiesFor` passes only briefing, tutorial and task (`harness.ts:340-343`). A future change that shows `reset()`'s result to a model would leak the route. | Make the goal wording neutral, or add a test that no prompt contains `episodes[preset].goal`. |
| 12 | Note | `packages/agent/src/suite.ts:196` | The briefing says "(Griffin Trial, prepared)". | This framing word tells players they are prepared. The wording is still a draft awaiting the owner. | Owner's choice. Record it if kept. |
| 13 | Note (existing, not C-specific) | `packages/agent/src/harness.ts:365-367` | `model-centralized` is one shared planner that sees both heroes. | This conflicts with the separate-reasoning checklist item. It is declared in r10 (`centralizedInformation`, line 74) and applies equally to C1 and C3. | None for C. Keep it disclosed. |
| 14 | Note | `scripts/midterm/situation-c.ts:69`; `griffinSituationC.test.ts:108-112` | The B/C diff compares `room.state` only. | Private `GameRoom` fields (inventory receipts and so on) are not compared. With identical prefixes a difference is unlikely, but "whole authoritative world" means `room.state`. | Clarify the wording. |

### Checklist

| # | Item | Checked? | Result |
| --- | --- | --- | --- |
| 1 | Game-rule consistency | Yes | No server, shared or rule file is changed by the C work. The fixture's write (counts plus `revision++`, no `claimed`) matches a chest pickup minus the claim (`inventory.ts:119-121,156`). The doc's account of the rules is accurate apart from finding 8. |
| 2 | Legal actions | Yes | The Mirror and Shears are real `ItemId`s (`items.ts:9-19`), allowed by the socket schema (`app.ts:200-205`), and reach the server through `usableItems` / `use_item` → `room.useItem` (`actions.ts:67-73,228-237`). Nest use is checked by the server: Coco only (`griffin.ts:42`), item owned (`:57`). Legal actions at the start are identical to B's (evidence diff, `legalActions: []`). |
| 3 | Observations | Yes | The only start difference is `inventory.items`, with the items' ordinary descriptions. Journal (`questLog`) and Griffin label are unaffected. Grooming labels are what `GriffinView` draws (`perception.ts:279-294`). The nest target label is visible in B-return as well. |
| 4 | Solution leakage | Yes | The briefing, tutorial and v4 text name no item, nest or route (tested at `griffinSituationC.test.ts:53,61`). The manual has no mirror, shears, nest or wig text. The evaluator goal text names the route but does not reach policies (finding 11). |
| 5 | Separate reasoning | Partly | The fixture closure is closed after reset (`environment.ts:352-354`) and never reaches a policy. Per-hero memory is reset after the prefix. The shared planner predates this work (finding 13). |
| 6 | Fairness | Partly | The baseline reads observations only and has no C branch (source hash pinned, test at line 254). C2 replays B2 (finding 2). The alternative baseline is tuned to C (finding 1). |
| 7 | Engine-owned outcomes | Yes | `griffinWigReturned` reads `wigClaimed` and the story flag. `chapter0.complete` needs the `depart` → `watcher` scenes, which need `shrineComplete`, which needs a `griffin_wig` count, which only `awardGriffinWig` gives (and it sets `wigClaimed`). So I found no false positive without the wig, and every wig route sets `wigClaimed`. Knockout is checked before success (`environment.ts:798`). |
| 8 | Deterministic evaluation | Partly | The fixture is deterministic. Start hashes for seeds 0 and 1 are pinned; seed 1 is checked in the script only, not in vitest. Not run by me. |
| 9 | Tests and CI | Partly | Gaps in findings 4, 5 and 7 and in the list below. CI `fetch-depth: 0` was added. |
| 10 | Project invariants | Yes | The server stays authoritative. The fixture mutation is owner-approved and limited to setting up the start. No art or service changes. |

### Missing test coverage

- `griffinSituationC.test.ts`: C3's system prompt equals C1's plus `guidanceBlock(v4)`, with both hashes computed from a real `CentralPlanner` (finding 7).
- `griffinSituationC.test.ts`: the peaceful route from the wig claim through the shrine offering to `chapter0.complete`, asserting `outcome().reason === "success"`. Today the predicate is tested only with fixtures, and the baseline only exercises the defeat route.
- `griffinSituationC.test.ts`: `StartFixture.addItems` throws after `reset()` returns, and rejects bad counts. A policy's `decide` input never contains the fixture.
- `griffinSituationC.test.ts`: `reset(1)` start hash equals `C.start.hashes[1]`.
- `griffinSituationC.test.ts`: the paid lock refuses `model-history`, `model-obs-only`, `model-memory` and `model-navigator` on C with a non-mock gateway. A test of `live.ts --paid --scenario griffin-prepared-return-v1` exiting non-zero.
- `griffinSituationC.test.ts`: partial delivery. Mirror alone causes immune grooming with no wig; Shears alone causes no grooming.
- B pins: B-return's limits, `failure` cases and prefix name pinned at HEAD (finding 4).

### Uncertainty

- Whether the tests, typecheck, build and `situation-c.ts` pass at 2374a2d. Running `npx vitest run packages/agent/test/griffinSituationC.test.ts packages/agent/test/bPostCombinedV*Guidance.test.ts` and the script would settle it.
- Whether Pilot-31/32/33 records and B evidence are byte-unchanged. `git diff 9f4ac38..2374a2d -- docs/midterm/evaluation-abc docs/midterm/evidence/griffin-heuristic-v1` would settle it.
- Whether B-return's prefix name or summary fields changed when the prefix was extracted into `unpreparedReturnEntry` (`suite.ts:176,245`). Comparing with `git show 2791bce:packages/agent/src/suite.ts` would settle it.
- Whether the browser client shows item descriptions to human players, which would make the new observation text "what a player could read". Inspecting `apps/client`'s inventory panel would settle it.
