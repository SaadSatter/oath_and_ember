# Independent rules-reviewer review: P1 revision 2 (2026-11-03)

| Field | Value |
| --- | --- |
| Reviewer | `rules-reviewer` subagent (`.claude/agents/rules-reviewer.md`), a separate invocation with fresh context. It is read-only: Read, Grep and Glob, with no shell |
| Requested by | The Claude Code implementation agent, session 2535c444-503f-4bd0-b122-23d0289cd46a. The reviewer did not build the change |
| Reviewed | Candidate `0fbece7` (tree recorded in the revision 2 commit), in a clean scratch checkout; parent `3a0a4c7` |
| Status | Findings reported. **Acting on them needs the owner's decision (CLAUDE.md).** What the implementation agent did before committing: <ul><li>wording errors in its own `PROLOGUE_SITUATION.md` corrected (doc only; no hash or code change): findings 2, 3, 6 (the note on reproducing revision 1), 7, 12, and the wording of 4;</li><li>finding 1 (missing revision 2 evidence) resolved by the evidence commit that follows the revision 2 commit;</li><li>findings 4 (approval of the name `garden gateway`), 5, 8, 9, 10 and 11 open, for the owner.</li></ul> |

The report below is recorded exactly as the reviewer returned it.

---

## rules-reviewer report

**Reviewed:** the P1 revision 2 candidate, a detached checkout at `/private/tmp/claude-501/-Users-saadsatter-Classes-AI-Pract-Building-Games-oath-and-ember-eval/2535c444-503f-4bd0-b122-23d0289cd46a/scratchpad/wt2` (parent `3a0a4c7`). I compared it against the earlier review, `docs/midterm/agent-evidence/reviews/2026-11-03-p1-rules-review.md` (F1–F10).

Files read in full or in the relevant sections:
- **Agent package:** `packages/agent/src/{prologueSituation.ts, suite.ts, evaluator.ts, harness.ts (caps, checkWallSeconds, policiesFor, runSuite, runOne), playerKnowledge.ts (NEUTRAL_TASK, taskId), policies/llm.ts (TASK, systemPrompt, LLMPlayer), perception.ts (viewRect, GARDEN_GATEWAY, prologueProps, perceive/add), environment.ts (reset, progress)}`
- **Tests:** `packages/agent/test/{prologueSituation.test.ts, playerKnowledge.test.ts}`
- **Scripts:** `scripts/midterm/{prologue-situation.ts, run-episode.ts}`, plus the wall-clock paths in `live.ts` and `evaluate.ts`
- **Docs:** `docs/midterm/{PROLOGUE_SITUATION.md, EVALUATION_SUITE.md (P1 sections), SUBMISSION_CHECKLIST.md (P1), EVIDENCE_INDEX.md (P1)}`, `midterms/saadsatter/EVALUATION.md` (P1), `docs/midterm/evidence/p1-baseline/README.md`
- **Checked against:** `apps/client/src/main.ts:1141–1475` (house predicate, removeBounds, cameraBounds centring, point markers), `apps/client/src/environment/mapClassification.ts:104–108`, `packages/shared/src/environmentSolids.ts:77–83`, `maps.ts` (MAIN_HOUSE, composedMap, villageInteriorMap), `magicShop.json` cameraBounds, `magicShop.ts`/`villageInteriors.ts` predicates, `chapter0.ts` `offstageFor`, `situationA.ts`

**Not reviewed or unverifiable:**
- **Nothing was run.** I cannot run git, tests, typecheck, build or the P1 script. I could not confirm that any pinned value matches the code: `P1_HASH 7dfac8cd…`, `P1_V1_HASH baa6b04b…`, the v2 prompt hashes, `viewsHash 5ff8926c…`, `taskId 4079cad5`, or the v2 baseline result and end hash `c2f3b973…`.
- **No diff.** I could not see exactly what else changed in `playerKnowledge.ts`, `llm.ts`, `perception.ts` or `environment.ts`. "Unchanged" claims are judged only by reading the code and from what the tests pin.
- **Not read:** the rest of `actions.ts` (`localTalk`) and the client art for the gateway. I could not see whether the fence art draws an open gap or a closed gate.

### Findings

| # | Severity | File | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1 | Medium | `prologueSituation.ts:317`; `PROLOGUE_SITUATION.md:22,151`; `EVALUATION_SUITE.md:166`; `EVIDENCE_INDEX.md:282` | Revision 2's hashed `baseline.evidence` and four docs point to `docs/midterm/evidence/p1-v2-baseline/`. That folder does not exist in the candidate or in the main worktree (Glob found nothing). Only `p1-baseline/` (revision 1) exists. This repeats the pattern of the earlier F3. | Revision 2's baseline result (1,058 ticks, end hash `c2f3b973…`) is claimed with no committed traces or summaries; only an unrun test pins it. The missing path is also baked into `P1_HASH`. | Commit the v2 evidence (traces, summaries, a README naming the clean commit), or mark it pending in every doc. Do not re-pin the hash to remove the path. |
| 2 | Low | `PROLOGUE_SITUATION.md:204`; `SUBMISSION_CHECKLIST.md:59-60,76` | `PROLOGUE_SITUATION.md` says "Revision 2's own audit and independent review are recorded in the change log of EVALUATION_SUITE.md". The revision 2 change log (`EVALUATION_SUITE.md:154-167`) records neither. | This overclaims a review that had not been recorded when the candidate was cut. | Reword as pending until the audit and this review are committed. |
| 3 | Low | `PROLOGUE_SITUATION.md:149` | It says both heroes' first views are byte-identical "(views hash `27cf4ce6…ff3a`)". That is revision 1's views hash. Revision 2 pins `5ff8926c…` (`prologueSituation.ts:234`). | A stale value in the current-revision record. | Replace it with the v2 hash, or show both, labelled by revision. |
| 4 | Low | `perception.ts:519`; `PROLOGUE_SITUATION.md:38,116` | `garden gate (open)` and its `o` mark are removed, and the extent matches the collision gap exactly (x 464–496, y 432–440; tested at `prologueSituation.test.ts:226-237`). The grid keeps `#` on both cells, so no blocked cell is shown as open. However, the client never displays "garden gateway" either: it is a region id in `mapClassification.ts:104`, which is source code no player reads. That art region also spans tiles 14–15 (about x 448–512), wider than the 32 px gap listed as the extent. | This is still an interface-supplied name, now taken from source metadata instead of invented. The owner's instruction was to remove the label "unless the client displays that wording". Calling it "the art's own name" overstates its visibility. | Get the owner's explicit approval of the name `garden gateway` (or an unnamed opening entry), and say in the doc that the name comes from a source region id, not on-screen text. |
| 5 | Low | `perception.ts:603`; `PROLOGUE_SITUATION.md:40` | The extent is rounded to one decimal, so the gap's 0.25-tile height is listed as `h: 0.3` (y 13.5–13.8 instead of 13.5–13.75). | Small and disclosed; it overstates the opening by 0.05 tile vertically. Not misleading about passability across the fence line. | Acceptable. Optionally give fixed floor art two decimals for this entry. |
| 6 | Low | `prologueSituation.ts:39-178,343-346`; `suite.ts:150`; `evaluator.ts:126` | Revision 1 keeps its preset `P1`, but no situation id maps to it (no `P1-v1`, unlike `S2-v1`). The situation id is `P1` in both revisions, and `Situation.revision` is the suite revision (2) in both, so `summary.scenario.revision` does not tell them apart. Two consequences: `historicalSituationId("P1")` for a v1 record resolves to the current v2 definition, and revision 1's own `reproduce` command (`prologue-situation.ts --baseline`) now runs revision 2. Separately, `run-episode.ts --preset P1` (scripted only) runs current code under v1-style episode ids `P1-<seed>-…`. | Records stay distinguishable by `scenario.preset`, episode id prefix and `evaluation.definitionHash`, so the risk is limited. But a reader who keys on `situation` or `revision` will misattribute v1 records, and revision 1 cannot be reproduced from HEAD (the code comment admits this). | State in `PROLOGUE_SITUATION.md` that v1 is reproducible only at `b62df73`, and that records must be told apart by preset or definition hash. Consider refusing preset `P1` in `run-episode.ts`, or adding a scripted-only historical id. |
| 7 | Low | `perception.ts:185-198`; `PROLOGUE_SITUATION.md:35,91` | The house-camera branch is not limited to P1 or to the Prologue. It applies to MAIN_HOUSE, the shop floors and every village interior in any situation. The doc says "No other scene is affected" and "They apply to the Prologue's stages only". | No current situation (S1–S4, F, S2-A/B/C) visits these scenes as far as I can tell, so no frozen hash should move. The scope claim is still inaccurate: village-interior observations changed for any future situation. | Reword to "every house/interior scene, in any situation", and note that no current situation other than P1 enters them. |
| 8 | Low | `playerKnowledge.test.ts`, `situationA.test.ts` (no pin) | The claim that S2-A/S2-B/S2-C and historical prompt hashes are unchanged (`EVALUATION_SUITE.md:158`, "tested") rests on `prologueSituation.test.ts:126-127`. That test shows the default `systemPrompt` reproduces revision 1's six pinned hashes, which is strong evidence for the base prompt. No test pins `tutorialId()` (`2ec2f251`), and no test pins S2-A's full model prompt hash. `playerKnowledge.ts` is a changed file, and I cannot diff it. | If `TUTORIAL_BRIEFING` had been touched, S2-A/S2-local prompts would change with no test failing. | Pin `tutorialId()` to `2ec2f251` and S2-A's per-hero full prompt hashes, ideally checked against `promptHashes` in the committed S2-local evidence summaries. |
| 9 | Low | `scripts/midterm/run-episode.ts:53,97` | `--wall-seconds` is uncapped and calls `runEpisode` directly, bypassing `checkWallSeconds`. It is limited to the exploration baseline (paid runs are refused), works by preset rather than situation, and records no P1 label. | This is not a P1 evaluation path, so F6 holds on every labelled path (`runSuite`, which serves `evaluate.ts`, `live.ts` and `prologue-situation.ts`). It is a residual way around the ceiling for ad-hoc runs. | Optionally refuse `--preset P1/P1-v2` there, or apply the same ceiling. |
| 10 | Info | `prologueSituation.ts:341-342`; `evaluator.ts:149-159` | Two JSDoc comments are orphaned: "The evaluation label of a scenario id…" now sits above `P1_REVISIONS`, and earlier review F10 (the `stateHash` comment) is still unfixed. | Readability only. | Move the comments. |
| 11 | Info | `prologueSituation.ts:177` | `P1_V1` uses only a shallow `Object.freeze`, so its nested objects are mutable at runtime. `P1_V1_HASH` is computed at load time. | Negligible. | Freeze it deeply if convenient. |
| 12 | Info | `PROLOGUE_SITUATION.md:13` | "Any change to the … observation contract … changes this hash". `P1_HASH` covers only the reset views hash, the descriptive contract strings and the world-state end hash. A change to later observations (for example Forest Trail labels) would not change it; other tests would have to catch that. | A mild overclaim that predates this change. | Reword, or add a hash of a whole baseline episode's observations. |

**Things I checked and found correct:**
- **F1 task line.** `NEUTRAL_TASK` names no place, character, item, route, direction or future event. It covers the owner's points: current observation and legal actions, objectives found through play, coordination, no assumptions about later events, no walkthrough or hidden state. `TASK` is byte-identical to the string quoted in the first review and remains the default in both `systemPrompt` and `LLMPlayer`. The task reaches the prompt only through `situation(id).task` in `policiesFor`, and only P1 sets it (tested at `prologueSituation.test.ts:146`). Provenance is recorded three ways: `·task-<id>` in policy names (which go into `configHash`), `prompts.task` in the hashed definition, and the pinned prompt hashes.
- **F2 indoor camera.** `viewRect` matches the client: the same `house` predicate (`main.ts:1142-1143`), the same centring rule (`main.ts:1391-1399`), and `cameraBounds` falling back to the full map. MAIN_HOUSE has no `cameraBounds`, and for it the new branch is algebraically identical to the old clamp. HOUSE_INTERIOR at Coco's start (590, 322) gives x 128–768, so "E · UPSTAIRS" at (142, 310) is shown and the east strip (x > 768) is not. Hedge Maze, shrine, Mirror Pond, Griffin and the composed forest scenes keep the old rule. Their `cameraBounds` are correctly ignored, because the client uses `setBounds(0, 0, width, height)` for non-house scenes. The remaining differences are the existing conventions: the client's smoothed camera position and real viewport size against the fixed 640×360 view.
- **F6 wall clock.** `checkWallSeconds` runs in `runSuite` before anything starts. `runOne` uses the same `o.wallSeconds`, and the defaults (3,600 s model, 600 s scripted) are within the ceiling. Other scenarios have no ceiling and are unchanged (tested).
- **Limits.** These are unchanged: 10,800 ticks, 250 calls, 1,600 decisions, 4M tokens per hero, a 30 s call timeout, and $0.60.

### Checklist

| # | Item | Checked? | Result |
| --- | --- | --- | --- |
| 1 | Game-rule consistency | Yes | No server, shared or client code is in the changed list. The view, label and prompt changes are interface-side only. |
| 2 | Legal actions | Partly | There are no new action types. The gateway entry is an `object` with no mark and adds no action. I did not re-read `actions.ts`. |
| 3 | Observations | Yes | The camera now matches the client for house scenes, with nothing outside the client's view. The gateway name comes from source metadata and is not shown on screen (F4 above). No flags, ids or future lines are added. |
| 4 | Solution leakage | Yes | `NEUTRAL_TASK` has no route or answer. The gateway extent is geometry a human sees in the art. The baseline route is not exposed to model players. |
| 5 | Separate reasoning | Partly | No new shared channel. `LLMPlayer` is still built per hero; I did not re-audit memory. |
| 6 | Fairness between players | Yes | Baselines get no prompt. Both heroes get the same task text, and model and baseline players use the same environment. |
| 7 | Engine-owned outcomes | Yes | `P1-v2` reuses `P1_EPISODE.success` (`stageReached(…, "WOODS")`), and the same function object is tested. |
| 8 | Deterministic evaluation | Partly | Start hashes are pinned and unchanged, and the v2 episode ids differ (`P1-v2-…`). The wall-clock ceiling is enforced. Nothing was run, so the pins are unconfirmed. |
| 9 | Tests and CI | Partly | Good new tests: neutral task and default prompts, the camera rule, stairs visibility, the gateway gap, names-only mode, the ceiling. Gaps are listed below. Not run. |
| 10 | Project invariants | Yes | Server authority is intact. There is no persistence, and no art or sprite changes. |

### Missing test coverage

- `packages/agent/test/playerKnowledge.test.ts`: pin `tutorialId()` to `"2ec2f251"` → S2/S3 tutorial block is unchanged.
- `packages/agent/test/situationA.test.ts`: S2-A per-hero full system prompt hashes (`policiesFor("model-memory"|"model-history", …, "S2-local")`) → equal to the hashes in the committed S2-local evidence summaries.
- `prologueSituation.test.ts`: HOUSE_UPPER after Coco climbs the stairs → "E · DOWNSTAIRS" listed, and nothing outside the centred view (x 96–736).
- `prologueSituation.test.ts`: `runSuite({situations:["P1"], wallSeconds: 3601, …})` rejects before writing `run.json`. The current test calls `checkWallSeconds` only, not the integration.
- `prologueSituation.test.ts`: a P1 baseline run's summary carries `scenario.preset === "P1-v2"`, episode id prefix `P1-v2-`, and `policies` with no `·task-` for baselines.
- A test that the committed `p1-baseline/` summaries still carry `definitionHash baa6b04b…`, which guards against later edits to v1 evidence.
- Optional: a test that `run-episode.ts` refuses or caps `--wall-seconds` for P1 presets.

### Uncertainty

- **Pinned values unconfirmed.** Running `npx vitest run packages/agent/test/prologueSituation.test.ts packages/agent/test/playerKnowledge.test.ts packages/agent/test/situationA.test.ts`, `node --import tsx scripts/midterm/prologue-situation.ts --baseline`, and `npm run typecheck && npm test && npm run build` would settle it.
- **Unseen changes.** Without a diff I cannot rule out changes to `TUTORIAL_BRIEFING`, `localTalk` or other parts of `perception.ts`/`environment.ts` beyond what I read.
- **Gateway art.** I could not see whether the fence art at the gateway looks open or like a closed gate. If it looks closed, listing a passable "gateway" would tell agents more than the screen does.
- **Owner approvals.** I could not confirm the owner approved the name "garden gateway". I take F5 as confirmed and F7 as documented only, as you stated.
- **v1 evidence.** I did not verify that the `p1-baseline/` files are byte-unchanged since `3a0a4c7`, because I cannot run git.
