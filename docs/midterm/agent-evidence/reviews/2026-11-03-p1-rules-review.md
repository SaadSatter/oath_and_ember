# Independent rules-reviewer review: P1 "Into the Forest" (2026-11-03)

| Field | Value |
| --- | --- |
| Reviewer | `rules-reviewer` subagent (`.claude/agents/rules-reviewer.md`), a separate invocation with fresh context. It is read-only: Read, Grep and Glob, with no shell |
| Requested by | The Claude Code implementation agent, session 2535c444-503f-4bd0-b122-23d0289cd46a. The reviewer did not build the change |
| Reviewed | The candidate tree `8a80b65bbca5`, in a clean scratch checkout; base `16f1a6d`. This tree was later committed unchanged as `b62df73` |
| Note | The reviewer reviewed the candidate that already included the two audit fixes (the test's null narrowing and the S2-A id-list expectation). Its tree equals that of commit `b62df73` |
| Status | Findings reported. **Acting on them needs the owner's decision (CLAUDE.md).** Finding 3, the missing evidence folder, is resolved by the evidence commit that follows `b62df73`. The rest are open |

The report below is recorded exactly as the reviewer returned it.

---

## rules-reviewer report

**Reviewed:** Candidate checkout at `/private/tmp/claude-501/-Users-saadsatter-Classes-AI-Pract-Building-Games-oath-and-ember-eval/2535c444-503f-4bd0-b122-23d0289cd46a/scratchpad/wt`. The change adds P1 "Into the Forest" on top of base 16f1a6d.
- **Agent package, read in full or in the relevant sections:** `packages/agent/src/{prologueSituation.ts, perception.ts, actions.ts, evaluator.ts, environment.ts (reset/progress/checkEnd), harness.ts (caps, runOne, wall clock), suite.ts, policies/questBaseline.ts, policies/questKnowledge.ts, policies/llm.ts (systemPrompt/TASK)}`.
- **Tests:** `packages/agent/test/{prologueSituation, situationA, guidedMaze, playerKnowledge, suite}.test.ts`.
- **Script:** `scripts/midterm/prologue-situation.ts`.
- **Docs:** `docs/midterm/{PROLOGUE_SITUATION.md, PROLOGUE_SITUATION_PROPOSAL.md, EVALUATION_SUITE.md, EVIDENCE_INDEX.md, SUBMISSION_CHECKLIST.md}` and `midterms/saadsatter/EVALUATION.md`.
- **Game code checked against:**
  - `apps/server/src/prologue.ts` (`tickStory`, `storyTravel`, `readLine`, `prologueBlocksExit`)
  - `apps/server/src/storyCheckpoints.ts`
  - `apps/server/src/GameRoom.ts` (constructor/reset, E handling for door/travel)
  - `packages/shared/src/{prologue.ts, maps.ts, composedScenes.ts, magicShop.json, prologueForest.json, environmentSolids.ts, storyCheckpoints.ts}`
  - `apps/client/src/main.ts` (`sealedExit`, map-point labels, E keydown handler, camera, HUD goal)
  - `apps/client/src/entities/AldenView.ts`
  - `apps/client/src/ui/questLog.ts`
  - `apps/client/src/environment/mapClassification.ts`
  - `manual/Oath_and_Ember_Player_Manual.md`

**Not reviewed or unverifiable:**
- **No base diff.** I cannot run git and was given no diff file, so I could not diff against 16f1a6d. I judged "unchanged" claims (Situation A hash, Hedge Maze views) only by reading the code paths and the pinned test values.
- **Nothing was run.** I could not run `npm run typecheck`, `npm test`, `npm run build` or the P1 script. I cannot confirm that any pinned hash (`P1_HASH`, start hashes, `viewsHash`, prompt hashes, `endHash`, `SITUATION_A_HASH`) matches, or that any test passes.
- **Not read:** `docs/midterm/agent-evidence/skill-runs/2026-11-03-adapter-p1-prologue.md` in full, and the `midterms/saadsatter/README.md` diff.

### Findings

| # | Severity | File | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1 | Medium | `packages/agent/src/policies/llm.ts:161` (`TASK`), used by every P1 model prompt | `TASK = "Complete the Goddess's quest together."` is in the system prompt P1 pins (`prologueSituation.ts:106-110`). The manual never mentions the Goddess (0 matches). In P1 the Goddess is future story content and is not the episode's objective. The docs say the players have "only the dialogue, the quest journal, what the world shows, and the manual" and "the normal system prompt" (`EVALUATION.md:115`, `PROLOGUE_SITUATION.md:38`). Neither the docs nor the skill run (`…adapter-p1-prologue.md:48`) note that the prompt states a different quest. | The model is given a wrong task statement that names a later story character. This misdirects it, mildly leaks future story, and confounds any comparison against the baseline. It is not a solution leak. | Owner decision. Either disclose it in `PROLOGUE_SITUATION.md` as a known limitation, or approve a neutral per-scenario task line. That would be a prompt change, so P1 would need re-hashing before any run. Do not change it silently, because P1 pins the prompt hash. |
| 2 | Medium | `packages/agent/src/perception.ts:177-187` (`viewRect`) vs `apps/client/src/main.ts:1148, 1382-1404` | For "house" scenes (MAIN_HOUSE, HOUSE_INTERIOR, HOUSE_UPPER) the client clamps the camera to `map.cameraBounds` (HOUSE_INTERIOR: x 64–768, y 128–640; HOUSE_UPPER: x 128–704, w 576 < 640, so centred). `viewRect` ignores `cameraBounds` and clamps to the full map (832×704). At reset, Coco at (590,322): the client's view is x≈128–768, the interface's is x 192–832. "E · UPSTAIRS" at (142,310) is on the human's screen but not in Coco's observation. The test pins this: `names(coco) == ["creature:Alden"]` (`prologueSituation.test.ts:157`), and so does `viewsHash`. The interface also shows a strip (768–832) that the client never displays. | P1's screen does not match what the client draws, which contradicts the observation contract ("exactly as the client draws them"). The cause pre-dates this change, but P1 is the first situation to use the composed indoor scenes, and the mismatch is now frozen into `viewsHash`. No hidden state leaks; mostly less information. | Either honour `cameraBounds` for house scenes in `viewRect` (P1-only scenes, so it should not move Hedge Maze hashes; verify), or document it as a known difference in `PROLOGUE_SITUATION.md`. Either way, fix or disclose before any paid run. A change re-freezes P1. |
| 3 | Medium | `prologueSituation.ts:142` (hashed `evidence` field), `PROLOGUE_SITUATION.md:122`, `SUBMISSION_CHECKLIST.md:58`, `EVALUATION.md:120` | `docs/midterm/evidence/p1-baseline/` does not exist in the candidate checkout (Glob found nothing). The checklist still marks the P1 baseline "complete", with evidence in that folder. | The baseline result (1,058 ticks, end hash `c2f3b973…`) is claimed with no committed traces or summaries. Only the test pins it, and I could not run the test. | Commit the traces, summaries and the folder README naming the commit, or mark the checklist row as pending until they exist. |
| 4 | Low | `perception.ts:488-492`; `prologueSituation.test.ts:162-163` | `garden gate (open)` is an interface-authored name and is not one of the owner-approved wordings ("door", "tipped cart"). The client art has a "garden-gateway" region (`mapClassification.ts:104`), so a gateway exists, but "(open)" asserts a state the game does not model. The geometry claim is correct: the gap is x 464–496 at y 432–440, and tile centres 464 and 496 both fall inside fence rects because `inRect` is inclusive, so the grid draws "#". However, the "o" is put only in column 15, whose centre (496,432) is itself blocked. The passable line is x=480, the boundary between columns 14 and 15. | A cell-based navigator steering to the marked cell's centre will hit the fence. The extra name is an observation addition the owner has not approved; the doc does flag it for review. | Get the owner's explicit approval of the name, or drop "(open)". Consider documenting that the listed x (15.0) and not the marked cell is the passable line. |
| 5 | Low | `evaluator.ts:104-110`; `PROLOGUE_SITUATION.md:34-35, 43` | The proposal (`PROLOGUE_SITUATION_PROPOSAL.md:74`) proposed 800 decisions and 1,000,000 tokens per hero. The implementation uses S2-A's 1,600 and 4,000,000, read as "retained". The owner instruction I was given ("other safety limits retained") is ambiguous between the two. | The limits may not be the ones the owner intended. | Record the owner's explicit confirmation of 1,600 decisions and 4M tokens in the PR description. |
| 6 | Low | `harness.ts:331, 409` | `wallSeconds` may be any finite positive value, so a run can raise P1's wall clock above the approved 3,600 s. The spend cap, by contrast, is "lower, never raise" (`episodeCap`, l.304-308). This behaviour pre-dates the change. | The approved wall-clock limit is recorded (`configHash` includes `wallLimitSeconds`) but not enforced as a ceiling. | Reject `wallSeconds` above the approved value for P1 (and ideally for all frozen situations), as is done for the spend cap. |
| 7 | Low | `prologueSituation.ts:106-110` | P1 pins the shared system-prompt hashes, and those prompts are also the ones tuned on S1–S3 (allowed by AGENTS.md). | Any permitted S1–S3 prompt tuning fails the P1 test and forces a P1 revision. "Excluded from prompt tuning" therefore effectively freezes the shared prompt too. | State this coupling in `PROLOGUE_SITUATION.md` / `EVALUATION_SUITE.md`, so a P1 test failure after tuning is not "fixed" by re-pinning without the owner's approval. |
| 8 | Info | `actions.ts:217-219, 298-313` | `localTalk` returns an instant, 0-tick, `ok:true` result that writes nothing. I checked it against the client's E handler (`main.ts:319-404`): same order (trail cargo within 50 px, then the door/exit 50 px guard including the sealed `cart` point, then Alden), same `aldenIdleLines` fallback, and E falls through to the server where the client lets it through. Differences: it is limited to `inPrologue`, while the client handler is not stage-limited, and the client's modal dialogue box costs real time while the interface's costs none. | Correct for P1's range. Repeated E at Alden costs decisions but no game time. | Info only. If later situations include Chapter 0 stages with Alden present, extend or disclose. |
| 9 | Info | `perception.ts:68-83, 510-516` | The interface supplies area names ("Main house", "Alden's Magic Shop", "Forest Trail") and the name "Alden". The client draws neither an area title nor a name over Alden's sprite. Both are corroborated by public text: the journal step "Visit Alden's magic shop" (`questLog.ts:26`) and the dialogue speaker "Alden". "Mossling Woods" and "Forest Clearing" appear only once those areas are visited. The "E Talk" rule matches AldenView (`!promptHidden && nearAlden`). | No hidden-information leak found. | None. |
| 10 | Info | `evaluator.ts:146-167` | `prologueMilestones` was inserted between the `stateHash` JSDoc and `stateHash`, which leaves that comment orphaned. | Readability only. | Move `prologueMilestones` above the comment. |

### Checklist

| # | Item | Checked? | Result |
| --- | --- | --- | --- |
| 1 | Game-rule consistency | Yes | No server, shared or client gameplay code is in the changed list. `localTalk` re-implements a client presentation rule only (no state written). Start is the real `prologue` checkpoint via `GameRoom` → `beginStoryCheckpoint` → `beginPrologue`, with no fixture or prefix. |
| 2 | Legal actions | Yes | No new action types. `interact` either sends the real E input frame or returns local dialogue pages without touching the server, as the client does. Nothing sets position, flags or state. |
| 3 | Observations | Yes | No flags, stage names, scene ids or HUD goal lines found in P1 observations. Story-flag reads in `prologueProps` (`prologue.cart`) mirror the client's `sealedExit` exactly. Issues: the house-scene camera mismatch (F2), the gate naming (F4), and `TASK` naming the Goddess (F1). |
| 4 | Solution leakage | Yes | `PROLOGUE` route is imported only by `questBaseline.ts` and `prologueSituation.ts` (hashing). `P1`/`goal` text is not passed to `LLMPlayer` (`EpisodeState.goal` is not used in prompts). No briefing, tutorial or walkthrough. `model-guided` is refused on P1. |
| 5 | Separate reasoning | Partly | No new shared channel was introduced. The baseline coordinates by nothing (0 messages). The `LLMPlayer` per-hero construction is unchanged; I did not re-audit it. |
| 6 | Fairness between players | Yes | The baseline reads only `Observation`, its journal and dialogue log, plus disclosed route constants, and acts through `step`. It is labelled solution-aware. Same environment, observations and legal-action checks as model players. |
| 7 | Engine-owned outcomes | Yes | Success is `stageReached(w.story,"WOODS")` on the authoritative room, checked in `checkEnd`. Only `storyTravel` (E at the trail's `exit` with `prologue.cart` set) sets WOODS. The milestones are evaluator-only and go to the trace. Cooperation claim verified: visit, fork and cart have no EMBER-audience or `choose` lines; `readLine` accepts any cast member; the fork, travel and cart triggers accept either hero; only the visit trigger needs OATH. "Coco not required" is correct in code and is tested (Idle Coco). |
| 8 | Deterministic evaluation | Partly | Seeded `GameRoom`. Start, views, prompt and end hashes are pinned and `P1_HASH` covers them, but I could not run anything to confirm they hold. The wall clock can be raised (F6). Wall-clock termination is inherently time-dependent, as before. |
| 9 | Tests and CI | Partly | Good coverage of definition, reset, success predicate, inner-narration privacy, the sealed cart and exit, Alden and barrel local talk, the Idle-Coco success, and the tick and decision limits. Gaps are listed below. Not run by me. |
| 10 | Project invariants | Yes | Server authority is preserved. No persistence or service added, and no art or sprite changes. Situation A hash and S2-local wiring are untouched in the code I read; I could not verify the hash by running. |

### Missing test coverage

- `packages/agent/test/prologueSituation.test.ts`: E beside a door or exit while Alden is in reach → `localTalk` returns undefined and the E input reaches the server (the client's door guard, `actions.ts:309`).
- `prologueSituation.test.ts`: while a story line is on a hero's screen → Alden's `details` has no "E Talk" and `interact` does not return local pages.
- `prologueSituation.test.ts`: E at the trail's crates/barrel before the cart is found, and Coco's version of the inspection text → per-role pages.
- `prologueSituation.test.ts` or a perception test: HOUSE_INTERIOR/HOUSE_UPPER on-screen extent vs the client's `cameraBounds` framing → e.g. "E · UPSTAIRS" visible to Coco at reset if the client shows it (F2).
- `prologueSituation.test.ts`: names-only label mode for P1 props (`east road`/`west road`, no `E · INSPECT`) → no as-drawn text leaks.
- Harness test: P1 run with `wallSeconds` > 3600 → rejected (F6, if adopted).
- A regression that Hedge Maze/S2-A observations are byte-identical with `prologueProps`/`localTalk` present (beyond the pinned `SITUATION_A_HASH`). I could not confirm that the existing S2-A views hash test covers this.

### Uncertainty

- **Pinned values unconfirmed.** I could not run tests or the P1 script, so I do not know whether the pinned hashes match the code. Running `npx vitest run packages/agent/test/prologueSituation.test.ts packages/agent/test/situationA.test.ts` plus `npm run typecheck && npm test && npm run build` would settle this.
- **Camera framing (F2).** The exact client viewport in world units depends on `pixelZoom` and the window size. The 640×360 footprint assumption in `perception.ts` is the project's convention; the mismatch above assumes it.
- **Gate approval.** I could not confirm whether the owner explicitly approved the "garden gate (open)" naming or the interior "door" naming for `leave`. My instructions list only "Shop door labelled 'door'" and "tipped cart".
- **No base comparison.** Without a base diff I cannot rule out unlisted edits to existing tests that weaken prior assertions. What I read of `situationA`, `guidedMaze`, `playerKnowledge` and `suite` tests looks append-only for P1.
