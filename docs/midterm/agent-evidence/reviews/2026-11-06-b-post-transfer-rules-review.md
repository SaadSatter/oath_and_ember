# rules-reviewer: B post-tuned guidance b-post-a-transfer-v1 (commit 6276656)

| Field | Value |
| --- | --- |
| Date | 2026-11-06 |
| Reviewer | `.claude/agents/rules-reviewer.md` subagent (read-only: Read, Grep, Glob), launched in a separate invocation by implementation session 3a986109-9c11-48a5-902a-6631f11dc353 at the owner's request; not instructed to approve |
| Reviewed | commit `6276656` on `midterm/evaluation` (parent `ec84a4f`). Owner's focus: hidden-state leakage, solution-specific instructions, differences beyond the appended guidance block |
| Note | The report below is the reviewer's output, copied verbatim. The implementation agent's responses are in docs/midterm/B_POST_TUNING_TRANSFER.md, "Review round 1". |

---

## rules-reviewer report

**Reviewed:** commit 6276656 on `midterm/evaluation` (parent ec84a4f), as described by the caller. **I could not run `git show` or `git diff`**: my tools are read-only (Read/Grep/Glob) and there was no saved `.git/rules-review.diff`. So I reviewed the files as they stand at HEAD, not the diff itself. Files read:
- `/Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember-eval/packages/agent/src/policies/situationGuidance.ts` (full)
- `/Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember-eval/packages/agent/test/bPostTransferGuidance.test.ts` (full)
- `/Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember-eval/docs/midterm/B_POST_TUNING_TRANSFER.md` (full)
- `docs/midterm/SITUATION_B_GRIFFIN.md` §§236–278 and the appended section in `docs/midterm/EVIDENCE_INDEX.md` (:368–370)
- `packages/agent/src/policies/mazeHeuristic.ts` :140–480
- `packages/agent/src/policies/pullPreview.ts` :160–187
- `packages/agent/src/policies/centralized.ts` :65–69, :366–419, :636–665, and grep for every use of guidance, seen_earlier and known_obstacles
- `packages/agent/src/policies/llm.ts` :297–302
- `packages/agent/src/harness.ts` :80–94, :276–425, grep of :512–581
- `packages/agent/src/griffinSituations.ts` (full)
- `scripts/midterm/live.ts` (guidance lines 35, 47, 109–114, 218–225, 264, 336)
- `scripts/midterm/situation-b.ts` :93–105

**Not reviewed or unverifiable:**
- **What the diff actually touched.** I can't confirm it was limited to the five files named, or that `centralized.ts`, `harness.ts`, `llm.ts`, `live.ts`, `perception.ts` and the old `griffin-b-post-v1` text are byte-for-byte unchanged by 6276656.
- **Every hash and count.** I can't compute SHA-256 values or run tests, so I could not check text `60a0a013…`, prompt `54605c1b…`, base prompt `cbabb78b…`, the 2,537-character count, the old draft's hash `1c062840…`, or Pilot-31's trace hash `5d9cfec6…`. I did not run typecheck, test or build, and I make no claim that any of them pass (the doc says 1,315/1,316 pass).
- **The Pilot-31 timeline in §1.** I did not read the trace, so I did not check it.
- **Whether controller code changed between Pilot-31 (6df4bc0) and HEAD.** This would need `git diff 6df4bc0 HEAD -- packages/agent/src`.

### Findings

| # | Severity | File | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1 | Medium | situationGuidance.ts:65; B_POST_TUNING_TRANSFER.md:50 | "After acting, move the hero off any path or area the screen shows an effect is about to cross, before it lands … Do not wait for damage to show that a place was unsafe." In A (mazeHeuristic.ts:432–448, :180–194) the hero only moves out of its *own* Black Hole's swept cow body. In B, the only effects telegraphed on screen are the Griffin's beam warning line and charge mark, so this line is in effect the old draft's tactic (griffin-b-post-v1, :41 "Before BEAM starts, hold defend or leave the line"), written without Griffin words. The doc does disclose it as "shaped by Pilot-31". | The guidance is a B-specific dodge tactic, not a carried-over A mechanism. The sentence "Do not wait for damage…" isn't in the A baseline at all; it answers Pilot-31's failure ("reacted to warnings only after the damage arrived", doc :35). | Owner decision. Either keep it and report it as a B-specific tactic (not "A heuristics"), or limit it to the hero's own effect as in A. List the "do not wait for damage" sentence separately in the provenance table. |
| 2 | Medium | B_POST_TUNING_TRANSFER.md:15, :43–56 | The table marks only 2 lines as shaped by Pilot-31, but these other wordings have no A counterpart and match Pilot-31's failures or the Griffin fight: (a) :70 "a target's shown health falls" is listed first as the expected result; A checks cow *displacement* only (mazeHeuristic.ts:196–201). (b) :71 says "two tries", but A never repeats a signature, and the options "timing" and "which hero does it" don't exist in A (only Coco pulls; there is no timing variable); the old draft's :43 fireball tip is about timing. (c) :62 lists "a ranged attack" first, but A's positioning is pull-only. "Prefer … a clear straight line to the target" isn't checked in mazeHeuristic (it ignores `line_blocked_on_your_map`); compare the old draft's :43 "flies straight". (d) :59 adds "enemies"; A's `open()` blocks only `kind === "creature"` (mazeHeuristic.ts:463–471). (e) :72 "A recharging ability is not a reason to stand still" does come from A (:451), but Coco's 26 waits in Pilot-31 make picking it B-driven too. | §2's per-line provenance overstates how much is a faithful transfer. The overall "tuning on B" disclosure (:15) is honest, but the table understates it. | Mark (a)–(d) as "Yes, reworded/extended after Pilot-31", or reword them to match A. |
| 3 | Medium | B_POST_TUNING_TRANSFER.md:64; bPostTransferGuidance.test.ts:40–41; centralized.ts:69 | The doc says "Controller code: Unchanged. CENTRAL_ID f0592888 (pinned by the new test)". But `CENTRAL_ID = sha256(JSON.stringify({ CENTRAL, NAV_ID, PROGRESS, PULL_PREVIEW }))` hashes tuning constants only, not controller or perception logic. The test's `expect(CENTRAL_ID).toBe("f0592888")` therefore can't detect a controller code change. The doc itself (:73) admits `perception.ts` changed after Pilot-31 (4c9cf9f, the `nest` object). | The "same controller" claim isn't supported by the evidence cited for it. Observations already differ from Pilot-31's. | Check with `git diff 6df4bc0 HEAD -- packages/agent/src` and record the result. Reword the claim to "same CENTRAL_ID constants". Resolve the `nest` difference before the run (doc §6.2). |
| 4 | Medium | B_POST_TUNING_TRANSFER.md:73; perception.ts (via 4c9cf9f) | The post-tuned run at HEAD would see a `nest` observation entry that Pilot-31 did not. | The pre/post contrast is no longer prompt-only, which conflicts with the commit's "prompt-only" framing (doc :9–10, EVIDENCE_INDEX :370 "appended to Pilot-31's unchanged prompt"). The doc discloses this. | Owner decision (already raised as §6.2). Until it is settled, don't call the run prompt-only. |
| 5 | Low | griffinSituations.ts:94; scripts/midterm/situation-b.ts:95, :99, :103 | `conditions.postTuned` still names `griffin-b-post-v1`, and that object feeds `SITUATION_GRIFFIN_B_HASH`, which every run summary records (:130–135). `situation-b.ts` still prints the old post-tuned command and validates the old id. SITUATION_GRIFFIN_B.md:277 discloses the stale text. | A B/post-tuned/1 summary will carry a definition that names a different post-tuned guidance from the one used. A packet operator could copy the wrong command. | Owner decision: either version the definition (new hash), or add a run-record note. Update `situation-b.ts`. |
| 6 | Low | B_POST_TUNING_TRANSFER.md:41; test :60; situationGuidance.ts:51, :72 | The doc says the word-list test covers "ability", but the test regex has no `ability`, and the text contains "A recharging ability" (:72). The code comment says the text "names no … enemy, attack" while it says "enemies" (:59) and "a ranged attack" (:62). These are generic uses, but the claims as written are false. | Inaccurate doc claim. | Fix the doc and comment, or add `ability` to the regex (the current text would then fail). |
| 7 | Low | bPostTransferGuidance.test.ts:57–61 | The word-list test is a weak check against leakage: it would not catch descriptions of the Griffin's mechanics in generic words (as finding 1 shows). It also doesn't cover "health"/"defend"/"nearer hero" phrasing from the old draft. | False assurance. | Treat it as a smoke check only. Rely on review for leakage. |
| 8 | Info | centralized.ts:395, :399; harness.ts:311–319, :353, :411, :581; llm.ts:298–302; live.ts:111–112, :220–224, :264, :336 | Checked: guidance is only (a) appended to `CentralPlanner.system` after the briefing, (b) added as `·guidance-<8hex>` to the policy name, and (c) recorded via `guidanceRecord` in the manifest and summary. `promptHash` is derived from the system text. `CentralizedController` (:653–663) reads the planner's system text, and NavigatorPlayer isn't given the guidance. I found no other read of the guidance in `packages/agent/src`. validatePlan limits it to model-centralized, non-final runs, the listed situations, and mock-gateway runs unless approved; live.ts repeats these checks before reading credentials. | No change to observations, legal actions, limits, budget caps or start state through this path, as far as I read. One side effect: a longer prompt uses more input tokens per call, so it reaches the token and $0.75 limits sooner, and paid latency may differ. | Mention the token and spend side effect in the result record. |
| 9 | Info | situationGuidance.ts:56–74 | Hidden-state check. The only field and notation names used are `seen_earlier`, `known_obstacles`, listed extents and "?" map cells, and all of them already appear in the planner's observation and prompt (centralized.ts:88–104, :622; perception.ts:800). The text has no coordinates, digits, World/GameRoom fields, puzzle state or future story. | No hidden-state leak found in the text. The author did write it after reading Pilot-31's trace, which may include evaluator-side state; that is tuning-side knowledge, not text the model sees. | None beyond findings 1 and 2. |
| 10 | Info | harness.ts:317 | The paid-run lock depends on the gateway label prefix `mock:`. | It's fine as long as no paid gateway label ever starts with `mock:`. | None. |

### Checklist

| # | Item | Checked? | Result |
| --- | --- | --- | --- |
| 1 | Game-rule consistency | Partly | No rules or mechanics code in the files I read; the guidance only changes prompt text. I could not confirm via diff that no `apps/` or `packages/shared/` files changed. |
| 2 | Legal actions | Yes | The guidance path doesn't touch the action schema or validation (`centralSchema` unchanged by guidance, :397). |
| 3 | Observations | Partly | The guidance doesn't change observations. A separate `nest` observation change since Pilot-31 exists (finding 4). |
| 4 | Solution leakage | Yes | No coordinates or answer keys. One line encodes a B-specific dodge tactic in generic words, and several wordings are B-shaped beyond what the doc says (findings 1, 2). |
| 5 | Separate reasoning | Partly | Unchanged: the same centralized planner as Pilot-31 (a shared planner by design for model-centralized). Not affected by this commit. |
| 6 | Fairness between players | Partly | Guidance is limited to model-centralized and never reaches baselines (harness.ts:313). The B baseline comparison runs on a different scenario (doc :37). |
| 7 | Engine-owned outcomes | Partly | Not changed by this commit. The success predicate comes from the evaluator (griffinSituations.ts:68). |
| 8 | Deterministic evaluation | Partly | The start state, seed and limits are not affected by guidance. The token and latency side effect is noted in finding 8. Hashes unverified. |
| 9 | Tests and CI | Partly | 4 new tests read, not run. Gaps listed below. |
| 10 | Project invariants | Partly | Nothing in the files I read touches server authority, assets or services. |

### Missing test coverage

- `packages/agent/test/bPostTransferGuidance.test.ts`: the planner's `schema`, `maxBatch`, briefing and tutorial ids, and controller `navState` defaults for pre vs post should be compared as equal, and `post.name` should be asserted equal to `pre.name + "·guidance-60a0a013"`. These would back up "only the prompt changes" better than the `CENTRAL_ID` pin.
- There is no test that the controller and perception logic match Pilot-31's commit. `CENTRAL_ID` doesn't cover this, so it needs a recorded diff or a code-hash pin.
- `scripts/midterm/live.ts`: no automated test that `--guidance b-post-a-transfer-v1` with a paid gateway is refused before credentials are read, or that `--guidance` with a non-centralized player fails.
- Word-list test: `ability` is claimed in the doc but missing from the regex (finding 6).

### Uncertainty

- Whether 6276656 touched any file beyond the five described. `git show --stat 6276656` would settle it.
- Whether the old draft `griffin-b-post-v1` text is unchanged. Hash :38–46 and compare with `1c062840…` (SITUATION_B_GRIFFIN.md:81).
- Whether controller and perception code differ between 6df4bc0 and HEAD beyond the disclosed `nest` entry.
- Whether all the pinned hashes hold. Running `npx vitest run packages/agent/test/bPostTransferGuidance.test.ts` would settle it.
- How far finding 2 matters depends on how the owner reads "general heuristics from A". It's a judgement call that I've flagged rather than settled.
