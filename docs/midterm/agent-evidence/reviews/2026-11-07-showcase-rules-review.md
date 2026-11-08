# rules-reviewer: continuous showcase (`eeb2b59..6e528f7`)

| Field | Value |
| --- | --- |
| Date | 2026-11-07 |
| Reviewer | `rules-reviewer` subagent (`.claude/agents/rules-reviewer.md`), read-only tools, separate invocation launched from implementation session 9409e901-41c2-42f4-839f-2090bdeba517 |
| Range | `eeb2b59..6e528f7` on `midterm/evaluation` |
| Recorded by | the implementation agent; the report below is the reviewer's text, unedited. The implementation agent's responses are in `docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md`, section 10 |

---

## rules-reviewer report

**Reviewed:** range `eeb2b59..6e528f7` on `midterm/evaluation` (worktree `/Users/saadsatter/Classes/AI_Pract_Building_Games/oath_and_ember-eval`). I could not run `git diff` because I only have read-only tools. The saved `rules-review.diff` in the worktree's git dir covers an older change (B_POST_TUNING_TRANSFER / v3 guidance), not this range. So I reviewed the **current files** and found the showcase code by searching for it, not from a diff.

I read in full or in the relevant parts:
- `packages/agent/src/{showcase.ts, suite.ts (showcase parts), evaluator.ts (lines 130–298), environment.ts (showcase/knockout paths, tickOnce, watchRoom), harness.ts (caps, ceilings, validatePlan, policiesFor, runSuite/runOne), playerKinds.ts, policies/situationGuidance.ts, policies/showcaseRoute.ts, route/showcaseKnockoutProbe.ts}`
- `scripts/midterm/{showcase.ts, showcase-knockout-check.ts, replay-video.ts}` and the showcase/paid parts of `live.ts`
- `packages/agent/test/showcase.test.ts`, `test/helpers/pinnedRunPath.ts`, `bPostCombinedV4Guidance.test.ts` (pins), `griffinSituationC.test.ts:344-352`
- Engine: `apps/server/src/griffin.ts`, `shrine.ts`, `hedgeMaze.ts` (targets), `GameRoom.ts:1753-1782` (damage/respawn), inventory consumption paths
- Evidence: `midterms/saadsatter/evidence/showcase/free-validation/README.md`, `baseline-live/summary.json`; `docs/midterm/EVIDENCE_INDEX.md:394-396`; parts of `docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md`; the manual (searched for knockout, Griffin, nest and wig text: none)

**Not reviewed or unverifiable:**
- **No diff.** I cannot prove that nothing outside the showcase-gated branches changed in environment.ts, evaluator.ts, suite.ts, harness.ts or live.ts. The pin helper exempts exactly these files from the working-tree byte check (`test/helpers/pinnedRunPath.ts:18-24`), so isolation depends only on the behaviour pins.
- **Nothing was run.** I did not run tests, typecheck, build, the probe, the free baseline or a replay, and I don't claim any of them pass.
- I did not check videos, the LFS objects or `manifest.json` hashes against the files.
- `apps/server/**` is not in the changed-file list, and I saw no server edit, but I could not confirm that from a diff.

### Findings

| # | Severity | File | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1 | **Major** | `packages/agent/src/harness.ts:451,526`; `scripts/midterm/live.ts:129,432`; `showcase.ts:38,70` | The owner-approved 7,200 s is only a *ceiling* (`SHOWCASE_WALL_CLOCK_CEILING`, `checkWallSeconds`). The limit actually applied is `o.wallSeconds ?? (model ? 3600 : 600)`. `SHOWCASE.limits.wallClockSeconds = 7200` goes into the definition hash, but nothing applies it. The test (`showcase.test.ts:63-65`) only checks the ceiling. The free baseline ran with `wallLimitSeconds: 600` (`baseline-live/summary.json:124`). | **Failure scenario:** once unlocked, `live.ts --scenario showcase-maze-griffin-complete-v1 --paid …` without `--wall-seconds 7200` stops at 3,600 s on wall clock, while the hashed definition says 7,200 s. The recorded limit and the enforced limit disagree. | Make 7,200 s the default for this scenario (or make `--wall-seconds 7200` mandatory for it). Add a test that `runOne`/`summary.wallLimitSeconds` equals 7200 for a showcase model run. |
| 2 | **Major** (evidence honesty) | `docs/midterm/EVIDENCE_INDEX.md:396`; `midterms/saadsatter/evidence/showcase/free-validation/README.md:10-11`; `showcase-check.json`; `baseline-live/summary.json:7,133`; `docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md:42,58-60,152` | The evidence and index give the **version 1** hashes: definition `23701f01…`, guidance `c0f7382e…`, prompt `fecf10c7…`. The baseline goal text says "with neither hero knocked out". HEAD pins guidance `7f3203b9…` and prompt `59e46825…` (`showcase.test.ts:28-29`), and `SHOWCASE.version: 2`. The 6e528f7 knockout probe has no committed evidence. `full-test-result.txt` (1,381/1,382) is from `c30d2fb` and predates the new tests. | **Failure scenario:** the owner authorizes the paid run against the documented `c0f7382e…` text, but HEAD would send different guidance. Readers may also take the README's "proposed guidance" to be the current text. This doesn't contradict a pass/fail claim, but a reader cannot tell the evidence is stale. | Label `free-validation/` as version 1 / `c30d2fb`. Regenerate `showcase-check.json`, the guidance and prompt texts, and the probe output at HEAD. Update EVIDENCE_INDEX before asking for paid approval. |
| 3 | Minor (latent until unlock) | `harness.ts:345-349`; `live.ts` (no showcase equivalent of the C check at 239-240) | Once unlocked, the paid scope check covers gateway label, batch and guidance, but **not seed (scope says 0), seed count, or one attempt**. `validatePlan` accepts `seeds: [0,1]` (tuning seeds). `live.ts` accepts `--seed 1`. A `runSuite` resume after `manual_stop` starts `-attempt2` (`harness.ts:485-489`). The scope branch has no test because the constant is `false`; the only test (`showcase.test.ts:133`) hits "locked". | **Failure scenario:** after the flip, `runSuite({seeds:[0,1], …})` makes two paid episodes, up to $4.00, against a "one attempt, seed 0" approval. | Enforce `seeds` = `[SHOWCASE_PAID_SCOPE.seed]`, add a live.ts check like C's (seed, cap ≤ $2), and refuse resume or retry for paid showcase. Test this with an injected approval flag. |
| 4 | Minor (owner decision) | `policies/situationGuidance.ts:132` (Phase 1), `:133`, `:135` | Phase 1 gives Coco "the environmental obstacles her fire, pull or flight can affect" and Sieg "the enemies, gates and anything that must be chased, struck, pushed or reached quickly". That is the maze's role-to-puzzle mapping in abstract form: the burned hedge, the cow, and the wolf that only Sieg may take the key from (`hedgeMaze.ts:47`). The word filter in the test (`showcase.test.ts:109`, no "cow/wolf/burn/key") doesn't catch the abstract form. Phase 4 states a server rule, that only Coco can reach the nest (`griffin.ts:42`); the manual has no Griffin text. Phase 2 names exits by their on-screen labels, which is allowed. | No coordinates or step sequence. It is still close to an answer key for the maze, and the design doc itself warns about this (`SHOWCASE_CONTINUOUS_EPISODE.md:152`). Acceptable only under the owner's explicit-demo allowance. | Ask the owner to confirm this exact wording is within the allowance, or reduce it to "split work by each hero's abilities". Record the decision. |
| 5 | Minor | `packages/agent/src/suite.ts:272,275` | The briefing explains the respawn rule ("the game moves the knocked-out hero"). The manual says nothing about knockout or respawn. The game's `KNOCKED_OUT` feedback (`environment.ts:194`) tells players the same thing after it happens. | A small amount of rule knowledge is given in advance that a human player learns by experience. It doesn't leak hidden state. | Accept as a disclosed demo briefing, or limit it to "a knockout does not end the episode". |
| 6 | Minor | `harness.ts:65,73`; `SHOWCASE_CONTINUOUS_EPISODE.md:24,48,151` | Comments still say "PROPOSED cap, owner approval pending" and "PROPOSED 7,200 s". The design doc still says "Any knockout" is the failure (known). | Docs and comments contradict the 2026-11-07 decisions. | Update the comments and the doc. |
| 7 | Minor | `harness.ts:341-344` vs `griffinSituationC.test.ts:346-351` | The showcase block limits which players run *on the showcase*, but nothing stops `baseline-showcase-route` running on frozen scenarios (S2-local, B, C). The C test iterates `PLAYER_KINDS`, which now includes it, and asserts it is admitted on C. | No existing result changes, but a new, unlabelled baseline can now produce output on frozen A/B/C scenarios. | Restrict `baseline-showcase-route` to `SHOWCASE_ID`, unless the owner wants otherwise. |
| 8 | Info | `environment.ts:269-271,384-385,524-538,711-717,856,930-931`; `evaluator.ts:23-24,55,218-262,297`; `harness.ts:630` | Every new runtime branch I read is gated on `preset === "showcase-maze-griffin-complete-v1"` (and `!inPrefix`). `showcaseReport()` returns null elsewhere, and the summary only adds it when it is non-null. B and C keep their knockout failure rules (`evaluator.ts:157,172,282`). Guidance texts for v4 (`1287…`) and C3 (`d750…`) are hash-pinned in `showcase.test.ts:98,101`. | Read-only evidence that A/B/C are isolated; I could not confirm it from a diff (see "Not reviewed"). | Run the existing A/B/C end-hash and prompt-hash pins at HEAD and attach the output. |
| 9 | Info | `scripts/midterm/replay-video.ts:115-135,170-179,228` | The pacing change only changes waits (`setTimeout`/`setImmediate`). Ticks are still driven by `runPaced`/`canTick`. The replay still checks start hash, every result hash, refusals, terminal and tick count (lines 184-214), and titles and metadata still say REPLAY/`passive`. `pacedTicks` misses the final tick (8,499 vs 8,500; "141.65 s" vs 141.7 game-s). The externalStop path now calls `gameClockPace` under a viewer. | I found nothing that could change ticks, order or hashes, or mislabel a replay. The small `pacedTicks` gap is cosmetic. | Optionally record `episodeTicks` beside `pacedTicks` (it already is) and note that they differ by one. |
| 10 | Info | `harness.ts:395-397` | `model-centralized` is one shared planner for both heroes. That conflicts with "separate reasoning" in principle, but it was approved earlier and is not new here. | Showcase results come from a joint planner, not two independent agents. | Disclose this in the showcase label and README. |

### Checklist

| # | Item | Checked? | Result |
| --- | --- | --- | --- |
| 1 | Game-rule consistency | Partly | No server file appears in the change list. Respawn is the unchanged `GameRoom.damage` (`GameRoom.ts:1768-1781`), and `watchRoom` only wraps it to observe. B and C failure rules look unchanged. I could not confirm this from a diff. |
| 2 | Legal actions | Yes | The baseline and probe only issue ordinary `move`/`wait`/`interact`/`advance_dialogue`/`choose_dialogue` actions through the environment. Neither changes the action set. |
| 3 | Observations | Yes | `showcase_knockout` trace lines, `showcaseReport` and showcase milestones are evaluator-only (trace, summary, replay-viewer notes). Players still only see the existing `KNOCKED_OUT` feedback. The baseline reads only its own observation. Findings 4–5 cover the briefing and guidance. |
| 4 | Solution leakage | Yes | No coordinates, waypoints or step lists in the guidance, task or briefing. The Phase 1 role mapping is a near-answer-key (finding 4). `EXPOSED = {20,13}` is inside the certification probe only, never sent to a model. |
| 5 | Separate reasoning | Partly | No new channel. The shared planner predates this range (finding 10). |
| 6 | Fairness | Partly | The baseline and the model use the same `runSuite`/environment path. The baseline is clearly labelled. Wall-clock defaults differ by player kind (600 vs 3,600 s, finding 1). |
| 7 | Engine-owned outcomes | Yes | `showcaseComplete` reads only authoritative state. Griffin HP reaches 0 only through `damageGriffin` (`griffin.ts:175-191`), which is blocked while grooming or after the wig. The wig comes only from `awardGriffinWig`. The combat-route nest press sets `shearsDelivered` but doesn't consume the Shears (`griffin.ts:60-81`); only grooming CUT does (`:165-170`), and it sets `toolsTaken`. The offering consumes only the wig. I found no way to satisfy it without earning each step, and no wrongful block. Predicate variants in the tests run on a `structuredClone` copy that is labelled as a fixture. |
| 8 | Deterministic evaluation | Partly | Start equals S2-A's prefix with no fixture (tests check the hash). The pinned end hash is the same as at `c30d2fb`. The wall-clock default doesn't match the approved definition (finding 1). Nothing was run. |
| 9 | Tests and CI | Partly | See below. I did not see the results of the new probe test (180 s) or the baseline test. |
| 10 | Project invariants | Partly | No art, persistence or service changes seen. No paid call is possible today. |

**Paid lock (question 5):** a paid run can't start today. `live.ts:118` fails first. `validatePlan` (`harness.ts:346`) refuses any non-`mock:` gateway while `SHOWCASE_PAID_APPROVED = false`. The guidance is `proposed` with no `approvedSha256`, so `harness.ts:357` and `live.ts:230` refuse it independently. `runSuite` calls `validatePlan` with the real gateway (`harness.ts:439`). Once unlocked, the scope check is incomplete (finding 3).

### Missing test coverage

- `packages/agent/test/showcase.test.ts`: a showcase model run with no `wallSeconds` → `summary.wallLimitSeconds === 7200` (it is 3600 today).
- `showcase.test.ts`: with an injected paid approval, `validatePlan` refuses `seeds:[1]`, `seeds:[0,1]`, the wrong guidance, the wrong batch, and `episodeCapUsd > 2`.
- `live.ts`-level test: `--scenario showcase… --gateway openai --paid` exits with the lock message before reading any credential.
- `showcase.test.ts`: `validatePlan({player:"baseline-showcase-route", situations:["S2-local"|B|C]})` → refused (if finding 7 is accepted).
- `showcase.test.ts`: the observation, legal list and planner input for both heroes after a knockout contain no `showcase_knockout`, `showcaseReport` or `showcase:` milestone strings.
- `showcase.test.ts`: a knockout inside the Hedge Maze (not only in the Griffin Enclosure) → maze puzzle state (key, gate, chest) preserved and the episode continues.
- `showcase.test.ts`: a peaceful (groomed) wig → `showcaseComplete` false and the episode ends on a limit, not success (only the `toolsTaken` copy variant exists today).
- `replay-video.ts`: a check-only replay of a showcase trace containing a knockout matches (start, results, terminal, ticks).

### Uncertainty

- Without the diff I can't rule out non-showcase edits in the five exempt run-path files. A `git diff eeb2b59..6e528f7 -- packages/agent/src scripts/midterm` restricted to lines without "showcase", plus the A/B/C pin tests at HEAD, would settle this.
- I don't know whether the new probe and baseline tests pass at HEAD. A fresh `npm test` at `6e528f7` would settle it.
- I can't tell whether the owner's explicit-guidance allowance covers the Phase 1 role mapping (finding 4); the owner has to decide.
- I didn't check that `gameClockPace` behaves the same when the recorder's `ready` hook delays the first tick. A video-replay check (`matchesTrace: true`) at HEAD on the baseline trace would settle it.
