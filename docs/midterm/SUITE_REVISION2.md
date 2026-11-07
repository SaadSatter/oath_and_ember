# Suite revision 2: S2/S3 swap, player manual and tutorial knowledge (2026-10-28)

Owner request (2026-10-28). Implemented by the Claude Code implementation agent (session `a209a67a-330b-4dd1-9a07-4cb129ceff9a`). Audit: [game-rules-audit](agent-evidence/skill-runs/2026-10-28-suite-revision2-tutorial.md), a same-session checkpoint, not an independent review. No paid call, held-out run, push or merge.

## Scenario mapping

| Id | Revision 2 (current) | Success | Model players also receive |
| --- | --- | --- | --- |
| S1 | unchanged | unchanged | unchanged (manual only) |
| S2 | **Hedge Maze**, shrine after the opening scene | Enchanted Shears in the shared backpack | manual, tutorial briefing, S2 episode briefing |
| S3 | **Mirror Pond**, shrine after the opening scene | Vanity Mirror in the shared backpack | manual, tutorial briefing, S3 episode briefing |
| S2-local | **Hedge Maze entrance** after ordinary travel | Enchanted Shears | manual, tutorial briefing, local briefing |
| S3-local | **Mirror Pond entrance** after ordinary travel | Vanity Mirror | manual, tutorial briefing, local briefing |
| S4, F | unchanged, held out | unchanged | unchanged |

Start states, limits, caps, seeds and success predicates are those of the revision 1 definition for the same area. The new S2 and S3 still share one start state (`5397eba5…` at seed 0). Scripted baselines receive no prompt and are unaffected.

Code: `SUITE_REVISION`, `SITUATIONS` and `HISTORICAL_SITUATIONS` in `packages/agent/src/suite.ts`; presets `S2-v2`, `S3-v2`, `S2-local-v2` and `S3-local-v2` in `evaluator.ts`.

## Historical definitions and records

The revision 1 definitions are kept unchanged and still runnable (tuning seeds only):

| Historical id | Was | Preset (unchanged) | Briefing | Superseded by |
| --- | --- | --- | --- | --- |
| S2-v1 | S2, Mirror Pond | `S2` | `S2_BRIEFING` (`·briefing-1051906a`) | S3 |
| S3-v1 | S3, Hedge Maze | `S3` | none | S2 |
| S2-local-v1 | S2-local, Mirror Pond entrance | `S2-local` | revision 1 local text | S3-local |
| S3-local-v1 | S3-local, Hedge Maze entrance | `S3-local` | revision 1 local text | S2-local |

- Because the presets are unchanged, a revision 1 reset gives the same episode id (`S2-0-5397eba5`), goal text and start hash as the old traces.
- Revision 2 episode ids carry the `-v2` preset (`S2-v2-0-5397eba5`), so they cannot be confused with old ones.
- **Every record written before revision 2 (pilot-4 to pilot-7, the phase-4 baseline summaries, the local-start evidence) uses revision 1 ids.** Its "S2" is Mirror Pond. Those records carry no `suiteRevision` field. Read them with `historicalSituationId(id, suiteRevision)`; they were not edited.
- New manifests and summaries record `suiteRevision: 2` and `scenario: {preset, title, goal, revision, tutorialId, briefing}`.
- **Model results from revision 1 and revision 2 are reported separately.** The scenarios differ, and the revision 2 prompts add the tutorial block and new episode briefings.

Frozen scripted pins (`scriptedFreeze.test.ts`) keep their keys and values and now run on S1, S2-v1 and S3-v1. **No pin exists yet for the revision 2 S2/S3. Adding one needs the owner's approval.** Expected values: quest S2 = old quest S3, quest S3 = old quest S2, explore shared and unchanged; not yet pinned.

## The player manual

- Both heroes receive `manual/Oath_and_Ember_Player_Manual.md` whole and unedited, in the system prompt of every model call. This was already true for every scenario before revision 2.
- The system prompt is the same on every call of an episode. The Anthropic adapter caches it; OpenAI caching is automatic.
- `loadPlayerManual()` and `PLAYER_MANUAL_PATH` are in `packages/agent/src/playerKnowledge.ts`. Run manifests record `manualHash`.

Excluded from the model (`MANUAL_EXCLUSIONS`):

| File | Why |
| --- | --- |
| `manual/GAME_DESIGN_RATIONALE.md` | Developer design document: verified puzzle progression conditions, quest-area design, rule/source map, evaluation scope |
| `manual/README.md` | Maintainers' notes (image provenance, fixtures, source files) |
| `manual/Oath_and_Ember_Player_Manual.pdf` | The same text, illustrated |
| `manual/images/` | Screenshots; models are text-only. Captions remain in the Markdown |

The player manual itself contains no puzzle solution and names no evaluated area or item (tested). Manual statements that differ from what the agents get (reported, not edited):
- The HUD objective line is hidden from agents (owner decision 2026-10-23).
- The manual says Flight lasts "up to 20 seconds", but a flight cannot be ended early. The tutorial briefing states the exact behaviour (owner decision 4).
- Jump and side view: the interface has no jump action. The only platformer maps are the airship maps, outside the episode.

## Tutorial-completion briefing

`TUTORIAL_BRIEFING` (`playerKnowledge.ts`, id `2ec2f251`, 7,426 characters) is its own system-prompt block. It comes after the manual and before the episode briefing. Policy names gain `·tutorial-2ec2f251`. The first draft (`4242ec52`) was never used in a run. It was replaced the same day by the Flight clarification below.

**Sources** (player-facing only):
- the Mossling Woods tutorial's guide lines and lesson goals (`packages/shared/src/prologueWoods.ts`);
- the manual's controls;
- the public action and observation format.

**Contents:**
- shared movement and interaction controls;
- combat, defending and hazards;
- a section for Sieg (Sword, Guard with its forward burst, Super Speed, Push; Heavy Break not available);
- a section for Coco (Fireball, Ward, Slow Time, Flight, Black Hole);
- the cooperation the tutorial practised (Slow Time with Super Speed, Black Hole with the sword, Flight with the shared backpack);
- how to tell labels from objects and exits;
- how to confirm movement, ability effects, area changes, damage and items from observations;
- how to communicate.

Both heroes read both sections, but each controls only their own hero. Every number is checked against the code in `playerKnowledge.test.ts`.

**Left out:**
- the woods' private HP floor;
- anything about the shrine, pond, maze, griffin or finale;
- coordinates and routes.

## Owner decisions (2026-10-28, after the first implementation)

1. **S2 Hedge Maze briefing approved**, provided it names the Enchanted Shears objective without revealing the solution. Tests check that it names no route, direction, coordinate or mechanism.
2. **No revision 2 freeze pins yet.** The historical pins stay on the `-v1` definitions.
3. **`-v1` ids are for scripted historical reproduction only.** `validatePlan` refuses any model player on them, paid or mock, including through `live.ts` and `evaluate.ts`. There is no override: a paid `-v1` evaluation needs separate owner approval and a code change.
4. **Manual unchanged.** The tutorial briefing now states Flight's behaviour, matching `movement.ts` and `GameRoom.ts`: a flight lasts 20 seconds and cannot be cancelled; it ends sooner only on defeat or area travel; Flight is not offered again until it has recharged.
5. **Cost:** S2-local re-estimated with the added prompt. See `MODEL_BUDGET.md`, "S2-local cost estimate with the tutorial briefing".

## Verification (this session)

- `npm run typecheck`: pass.
- `npm run build`: pass (existing chunk-size warning).
- Server, shared and client tests: 79 files, 563/563 pass.
- Permitted agent tests (all except `suite`, `fullQuest`, `checkpointFreeze`, `scriptedFreeze` and `finalAccess`): 27 files, 393/393 pass. `playerKnowledge.test.ts` has 16 tests; `localStarts.test.ts` now has 26, covering v1 and v2.
- `scriptedFreeze.test.ts -t 'baseline on S[123]'`: 6 pass at unchanged pins, 1 skipped (`route/seed1`).
- `finalAccess.test.ts`: 4 gate tests pass, 12 skipped.
- `suite.test.ts`: 2 declaration and source tests pass, 2 skipped.
- Not run: the full `npm test`, `checkpointFreeze`, held-out S4/F and any paid evaluation.
