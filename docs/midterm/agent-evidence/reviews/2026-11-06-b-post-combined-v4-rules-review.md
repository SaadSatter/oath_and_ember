# rules-reviewer: B guidance b-post-combined-v4 (commit af81ccc)

| Field | Value |
| --- | --- |
| Date | 2026-11-06 |
| Reviewer | `.claude/agents/rules-reviewer.md` subagent (read-only: Read, Grep, Glob), launched in a separate invocation by implementation session 3a986109-9c11-48a5-902a-6631f11dc353 at the owner's request; not instructed to approve |
| Reviewed | `midterm/evaluation` at `af81ccc`: proposed supplementary guidance `b-post-combined-v4`; saved diffs 68b20f8→af81ccc and code/config since 2791bce |
| Note | The report below is the reviewer's output, copied verbatim. The implementation agent's responses are in docs/midterm/B_POST_TUNING_TRANSFER.md §13. |

---

## rules-reviewer report

**Reviewed:** `b-post-combined-v4` at af81ccc (branch midterm/evaluation). I read both saved diffs in full: `.git/worktrees/oath_and_ember-eval/rules-review-v4.diff` (68b20f8→af81ccc) and `rules-review-v4-code-since-pilot32.diff` (2791bce→af81ccc). I also read these files:
- `packages/agent/src/policies/situationGuidance.ts` (all of it)
- `packages/agent/src/policies/centralized.ts`: lines 76–131 (`centralSystemPrompt`), 500–587 (reply handling, `validateAssignments`, stall guard) and the watchdog lines 905–908
- `packages/agent/src/policies/centralProgress.ts` (`due`, `permit`, `view`)
- `packages/agent/src/perception.ts`: 296–336 (Griffin warnings)
- `packages/agent/test/bPostCombinedV4Guidance.test.ts`
- `docs/midterm/B_POST_TUNING_TRANSFER.md` (all of it)
- `docs/midterm/DECLARED_EVALUATION_SUITE.md`: r7 and r8 sections and the B row
- greps of `docs/midterm/evaluation-abc/declaration.json`
- `docs/midterm/evaluation-abc/declared-results.json`, B/post-tuned/1 row
- `docs/midterm/evaluation-abc/B-posttuned-pilot32.json`
- Pilot-32 `summary.json`
- the v3 review's findings table

**Not reviewed or unverifiable:**
- I could not run tests, typecheck, the build, the mock episode, or recompute any hash or character count. None of the SHA-256 values (text `12874542…`, prompts `7ff08ba8…` and `473bf220…`, the 8 file pins, "3,219 characters") is verified by me, and I make no claim that tests pass.
- The claim "nothing outside packages/agent changed since 2791bce" rests only on the provided diff, which covers packages/, apps/, scripts/, manual/ and the root config files. Within that scope it shows only `situationGuidance.ts` plus three new test files.
- I did not read `scripts/midterm/live.ts` or `griffinWitness.ts` this round. For the leak comparison I used the draft `griffin-b-post-v1` text (situationGuidance.ts:38–46) and the drawn-warning code in perception.ts.

### Findings

| # | Severity | File | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1 | Medium | `situationGuidance.ts:103` (opening, "a hero whose plan still fits its situation carries on without one") vs `centralized.ts:96,570–585,499,535` | `validateAssignments` loops over **both** heroes whenever `progress.due()` is true, whether or not that hero asked. An overdue hero with no order hits line 585 ("empty order … cannot satisfy the watchdog"). That rejects the **whole** reply, including the other hero's orders. Three such replies in a row make line 499 throw the stall error. v4 now tells the planner that withholding an order is the normal case. It has no exception for overdue heroes (`progress.<hero>.reconsider_assignments`), so it pulls against base-prompt line 96. | v3's mandatory-order problem (v3 finding 2) is swapped for a different refusal path. The episode can still end in `error`, with no game outcome at all. This is most likely in long defend/scout stretches, which step 1 now encourages for a low-health hero. | Owner's call (text change = new id/hash). Possible wording: "…carries on without one, unless its progress shows it must be reconsidered." Or disclose this interaction in §12 the way v3 finding 11 was disclosed. |
| 2 | Medium | `situationGuidance.ts:103` (opening) vs `centralized.ts:105,107,110` | v4 says "current plan" for each hero. The base prompt uses **plan** for the shared plan text and **intention** for each hero's state. Ambiguous cases: a `go_to` that ends after the walk check-in (line 110: "you are then asked and may simply send it again"), or a hero reporting "this hero has no intention". The planner may decide the plan "still fits" and send nothing. Line 107 then puts the hero on a 30 s hold. | Heroes may stall mid-route and hold where the base prompt expects a re-sent `go_to`. That feeds finding 1 (holds are passive under the watchdog). | Use the base prompt's terms, e.g. "a hero whose intention is still running and still fits…". Owner decision. |
| 3 | Medium | `DECLARED_EVALUATION_SUITE.md:18`, `:219–228`; `evaluation-abc/declaration.json` r8 block (~l.186–191); `declared-results.json:247–297`; `B-posttuned-pilot32.json:6` | The owner's "v4 is supplementary; Pilot-32 stays B/post-tuned/1" decision appears only in B_POST_TUNING_TRANSFER.md §12 (line 306) and the code provenance string (situationGuidance.ts:110). The declaration and results files say nothing about it. The B/post-tuned/1 row is still `"status": "not-run"` with every outcome field null. Line 292 still says "paid run not yet executed", and DECLARED_EVALUATION_SUITE.md:18 still says "post-tuned approved and prepared, not run". That stale wording was flagged in v3 review finding 12 and is still not fixed. Mitigation: the row pins `policyId …guidance-60a0a013`, `promptHash 17b89312…` and `guidanceHash 60a0a013…`, so a v4 result would not match it. | An empty official cell plus a second run on the same scenario, seed and start hash leaves room to swap results. A careful reader would catch it from the pinned hashes, but no file of record states the rule. There is also no defined label, results slot or ledger designation for a supplementary B trial. | Owner: fill the B/post-tuned/1 row with Pilot-32 and record the supplementary rule (and where a v4 result would be filed) in the declaration or results files before any v4 run. The implementation agent should not do this unilaterally. |
| 4 | Low | `situationGuidance.ts:103` step 1 vs `perception.ts:317–335`, draft `situationGuidance.ts:41–42,44` | "visible attack warning … (such as a marked line or area)" fits exactly the two drawn telegraphs in this scenario: "griffin beam warning line" and "griffin charge mark" (an orange line "to a circle here"). Its rule ("move that hero off it or have it defend before it lands") is still the draft's l.41 beam tactic. "Let the healthier hero take the riskier task" is still the draft's l.42/l.44 structure. Removing "charging" fixes v3 finding 5's wording echo, but the observation itself names "charge mark", so the planner sees the same term anyway. | Not a hidden-state leak: every referent is drawn on screen and listed in observations. But the guidance remains tuned to the Griffin. The new header ("general-purpose … based on what the heroes' screens show") is accurate about information sources but could be read as claiming the guidance is neutral about this enemy. | Keep the §10 coverage row's overlap disclosure in force for v4. §12's table cites finding 4 only for the header, and its "Not changed" line (B_POST_TUNING_TRANSFER.md:318) does not list finding 4. Add finding 4 to that line. |
| 5 | Low | `situationGuidance.ts:103` steps 1, 6, 7 | These overlap within v4 and with the base prompt. Step 1's "rather than defending without a threat" restates step 6's "defend only against a concrete, imminent threat". Step 1 "prefer short actions over long walks" pulls against step 6's frontier exploration and base line 110 ("use go_to for walking more than a couple of tiles"). Step 7's "keep both heroes alive" restates step 1. Step 2's two overlap forms (v3 finding 8) are unchanged. | Small risk of mixed priorities. No outright contradiction. | Owner's call, as for v3 findings 8 and 9. |
| 6 | Low | `bPostCombinedV4Guidance.test.ts:140–163` | Appended-block equality (`post.system === base.system + guidanceBlock`) is checked only on `griffin-unprepared-return-v1`. v3's test (lines 155–165 of its file) checked both scenarios and also `maxBatch`. v3's coordinate-regex smoke check is also missing. The pins cover 8 files but not `llm.ts`, which supplies `guidanceBlock`/`guidanceId` (situationGuidance.ts:151). Also unpinned: `centralProgress.ts` (the watchdog), `navigate.ts`, `combat.ts`, `budget.ts`, `heroMemory.ts`, `runner.ts`, `openai.ts` and `scripts/midterm/live.ts`, all pinned for v1 at 6df4bc0. | The "differs only in guidance" claim is correct by the diff today, but tests do not guard it for the watchdog or the block format. | Add the pins and the v1-scenario and `maxBatch` checks listed under Missing test coverage. |
| 7 | Low | `B_POST_TUNING_TRANSFER.md:3` | The status line still reads "v2 and v3 are proposed and locked (§9–§11)" and does not mention v4 or §12. | Stale summary. | Update it. |
| 8 | Info | `B_POST_TUNING_TRANSFER.md:351–355` | The "only in guidance" list is accurate for inputs: scenario, start `45b1a6aa…`, tick 540, observations code, evaluator, controller files per the pins and the diff, limits, $0.75 cap and 3,600 s wall all match Pilot-32's summary.json. Unlisted differences: `gitHash`, ledger entry, guidance id/sha/status, and a longer prompt. v4 is about 3,219 characters against v1's about 2,537, so more input tokens per call and the token/$ caps arrive slightly sooner (noted for v3 as finding 16, not repeated in §12). The mock check used `--no-viewer`; Pilot-32 ran with `viewer: true`, which the proposed command presumably keeps. The model samples non-deterministically, so a single run per prompt is not a controlled effect estimate. | It is fair to describe this as a prompt-only pair, but it is n=1 per arm. | Add the token-length note and the single-run caveat to §12. |
| 9 | Info | `situationGuidance.ts:106–112` | v4 is `proposed` with no `approvedSha256`, so `guidanceApproved` is false. The test asserts paid-run refusal, scenario restriction, the non-B refusal and the `final` refusal. | Locked as described. | — |

### Checklist

| # | Item | Checked? | Result |
| --- | --- | --- | --- |
| 1 | Game-rule consistency | Yes | No rule, tuning, story or scenario file changed (diff since 2791bce: `situationGuidance.ts` plus tests only). The guidance restates no mechanic beyond what is drawn on screen. |
| 2 | Legal actions | Yes | All instructions map to existing actions and intentions (move, defend, attack, go_to, wait_until, known_obstacles, plan). No messaging (base prompt line 81 says no messages; the test asserts there is no "message"). No unsupported action. Interaction with the watchdog: findings 1 and 2. |
| 3 | Observations | Yes | v4 changes no observation. Its referents (warning line, charge mark/circle, health/label, "?" map cells) are drawn and listed (perception.ts:300–335). No hidden-state leak found. |
| 4 | Solution leakage | Yes | No coordinates, nest/wig step, shore position, aiming rule or flight-vs-sword fact. The draft's dodge and healthier-hero structure is still there in generic words (finding 4). Not compared against `griffinWitness.ts` this round. |
| 5 | Separate reasoning | Partly | This is a centralized-planner condition by design. v4 adds no new shared channel. |
| 6 | Fairness | Partly | The same controller, limits and cap as Pilot-32. Baselines are not affected. |
| 7 | Engine-owned outcomes | Yes | Step 8 relies on observed evidence. The evaluator is pinned (by the test, unverified by me) and unchanged per the diff. |
| 8 | Deterministic evaluation | Partly | The start hash, tick and limits match Pilot-32's summary per the doc. I could not run the mock. Model non-determinism and n=1 apply (finding 8). |
| 9 | Tests and CI | Partly | 5 offline tests. Gaps: finding 6. Not run by me. |
| 10 | Project invariants | Yes | Server authority intact. Nothing outside `packages/agent` changed per the diff. |
| Task 5 | v1, v2, v3 and draft byte-identical | Yes (by diff) | The v4 diff only adds lines. v1 (`60a0a013`), v2 (`38adcbce`), v3 (`c94a7bb5`) and the draft (`1c062840`) are pinned in the test (hashes not recomputed by me). |
| Task 2 | v3 problems resolved? | Yes | The mandatory order is removed, but finding 1 replaces it with a different refusal path. The health ordering is resolved: step 1 says "Before any offensive order, check … health", and the "first step that applies" rule is gone. New conflicts: findings 1, 2 and 5. Step 6 is consistent with step 1's defend rule. |

### Missing test coverage

- `bPostCombinedV4Guidance.test.ts`: on `griffin-unprepared-v1`, assert `post.system === base.system + guidanceBlock(t)` and `post.maxBatch === base.maxBatch`.
- `bPostCombinedV4Guidance.test.ts`: pin `llm.ts`, `centralProgress.ts`, `navigate.ts`, `combat.ts`, `budget.ts`, `heroMemory.ts`, `runner.ts`, `openai.ts` and `scripts/midterm/live.ts` to their 2791bce hashes.
- `bPostCombinedV4Guidance.test.ts`: the coordinate-pattern smoke check from the v3 test.
- No automated test that `live.ts --paid --guidance b-post-combined-v4` is refused before credentials are read. This gap is carried over from v1/v3.
- No test exercises the case in finding 1: an overdue hero, an empty order for it plus a valid order for the partner, and the whole reply refused. A unit test with MockGateway would document this behaviour for the trial.

### Uncertainty

- Whether finding 1 matters in practice depends on how often a hero goes 30 s without verified progress. That reset (`centralProgress.ts:308–309`) needs an observed effect. Counting `recoveryRefusals` in a v4 mock or real trace would settle it. The v3 mock already ended in a stall `error` (doc line 276); the v4 mock reportedly reached `tick_limit`, but random replies are not representative.
- All hashes, character counts and the "mock identical to Pilot-32" comparison are taken from the doc and test as written. I did not recompute any of them.
- I did not check whether anything outside the given diff scope (for example `evaluation-runs/` or the ledger files) would affect a v4 launch.
