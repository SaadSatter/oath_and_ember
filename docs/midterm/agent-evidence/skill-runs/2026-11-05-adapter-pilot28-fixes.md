# game-rules-audit: adapter — Pilot-28 fixes

| Field | Value |
| --- | --- |
| Date | 2026-11-05, America/New_York |
| Session | `01a1aed2-3232-7011-bb41-5fccdea13a5c` |
| Session URL | None. Local session; no shareable URL was created. |
| Role | Owner-authorized implementation; same-session audit, not independent review |
| Commit audited | `678b86c` plus this worktree's changes, branch `midterm/evaluation`; local commit authorized after verification |
| game-rules-audit SHA256 | `03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756` |
| session-evidence SHA256 | `df8200c4e4afc378360e26453041435f1b946df754e43f44d42f006ef39ac248` |
| Scope | Centralized policy, observation-only progress/pull helpers, terminal recording presentation |
| Prior diagnosis | [Pilot-28](2026-11-05-pilot28-diagnosis.md), copied unchanged from the older chat checkout |

## Findings and decisions

| # | Severity | Source | Evidence | Impact / decision |
| --- | --- | --- | --- | --- |
| 1 | High, addressed | H/M | Pilot-28 renewed holds and waits; new cumulative-clock, renewal, conditional-expiry and moving-watch tests | Track game time since observed progress independently of calls and intention renewal; require recovery after 30 seconds |
| 2 | High, addressed within observed geometry | H/M | Exact Pilot-28 cast fixtures, four radial-boundary cases, three body-obstruction cases; swept segment predicate compared with engine on 100 synthetic inputs | Identify visible hero obstruction and uncertain boundary targets without reading engine state |
| 3 | Medium, addressed | M | Cast acceptance/cooldown activation tests and evidence-ID completion filtering | Attempt, acceptance, visible execution, observed effect and completed subgoal remain separate |
| 4 | Medium, addressed for the verified smoke | H | Pilot-28 encoded tail lacked terminal overlay despite metadata; first fixed smoke exposed double subtraction of prefix time | Keep three-second manual-stop paint tail; viewer uses outcome elapsed seconds directly. Second encoded tail visibly reads `finished: manual_stop · 15.2 s` |
| 5 | Limitation | M | Generic progress proxies, approximate visible geometry, policy can still choose poor changed orders | No assertion of improved paid completion or latency; confirm those only in a separately approved live run |

## Changes

- New `policies/centralProgress.ts`: per-hero game-time clock, observed evidence, bounded attempt history, normalized equivalent assignments, and one-use conditional wait deadlines. Clock resets only on a supported observable change, not planning, damage to the hero or recharge countdown. New floor/first visits and advancing dialogue are activity progress but cannot complete puzzle subgoals. Other progress includes inventory gains, new completed journal lines, area changes, directly seen blocked-to-open floor, enemy health-bar reduction, and creature displacement following that hero's recent ability attempt. This last relation is recorded as correlation, never proven causation.
- The controller interrupts an assignment after 30 game seconds without progress and reports elapsed time, failed/repeated attempts and obstacles in the next context. Renewed empty/hold plans cannot satisfy recovery. Bounded waits can name an exact observed `ability` or a visible actor/effect to watch. Readiness ends a cooldown wait. An unchanged condition retains its first deadline, including across new orders; motion of the watched actor cannot invent a new condition. A cast and cooldown wait are valid together when the ability starts ready.
- Equivalent presses with two accepted attempts but no relevant effect within the six-second observation window require changed position/aim/assignment. The position equivalence uses quarter tiles. Assignment equivalence ignores durations and small coordinate jitter. Three refused recovery replies prevent further model dispatch; the existing runner handles bounded policy errors with terminal `error`. All dispatched calls remain metered and recorded. No fallback game action or synthetic success is inserted.
- Subgoals select completion-eligible `observed_evidence` IDs. The saved subgoal text is the observation's fact, with ID/tick in `completed_subgoal_evidence`, not arbitrary model prose. Unsupported claims are discarded and reported. `evaluation_objective` sends the supplied episode briefing as primary, separately from the broader journal; no scenario solution content was added to the generic prompt.
- New `policies/pullPreview.ts`: opt-in for centralized mode, with public projectile and hero body dimensions, visible extents, observed blocked cells and swept segment contact. The original navigator preview, ID and prompt remain unchanged. `within_pull` excludes boundary candidates; those appear in `near_pull_boundary`. Visible heroes intersecting a target's possible swept body are named in ordinary spatial language. The four Pilot-28 boundary casts are now uncertain rather than promised hits. The westward pull warns that Coco is in its path.
- `live.ts` retains the existing normal three-second recording tail on manual stop. `viewerGameSeconds` fixes the outcome clock (already elapsed time), with a regression using the actual prefix offset. This changes presentation only.
- Existing capture fixture now stops when its narrowly scoped key-capture assertion is satisfied, rather than intentionally issuing holds until the new inactivity recovery rejects them. Engine outcomes, scenario definitions and baseline pins are untouched. The old test asserting persistence of the unsupported word `entered` now asserts its rejection.

Centralized player ID is **`9ab2dec9`**, replacing `c497a631` for this policy revision. The scenario retains definition hash `7efb771a7b91d35422b719676f09c9b36063c5d95ede2de9e5dc681dd93e0eab` and start hash `fdc49877…`. All scope changes are in the policy/observation helpers, tests, recording metadata presentation and evidence documentation.

## Verification

| Command / check | Result |
| --- | --- |
| `npm run typecheck` | Pass after final source edits |
| `npm run build` | Pass; existing Vite large-bundle warning only |
| Selected policy/interface/clock/observation tests, 16 files | **266/266 passed**; exact file list below |
| `npx vitest run packages/agent/test/scriptedFreeze.test.ts -t 'baseline on'` | **6 passed, 1 deliberately unselected route test**; no pin update |
| `npx vitest run packages/agent/test/recorder.test.ts -t 'recorder \(fake browser\)'` | **8 passed, 6 deliberately unselected integration/browser cases** |
| Free `baseline-quest`, S2-local seed 0, no viewer | Success; **3128 ticks / 52.1 s**, 395 decisions, 0 invalid, 6 messages, 0 model calls |
| Baseline end hash | **`6644f2cac04b945444c3ec609d59d798cd767ecad80405d49ce8cd26314c7f56`**, exactly pinned |
| Free `model-centralized`, mock gateway, S2-local seed 0, manual stop | Two recording checks; each **15.2 game seconds**, 110 decisions, 17 mock calls, 1 invalid shared-dialogue advance, 0 messages, **$0**. Not a quest success |
| Final mock end hash | `ec313caa3e7d4d2c897a500de2d8f87701f284d67e2fa3c999b733d9fbcdf79e` |
| Whole-file final WebM decode | Exit 0, **no errors**, **27.76 s**, 1280×720, **2,579,459 bytes** |
| Final encoded frame | Visually inspected: `finished: manual_stop · 15.2 s game time · 17 model calls · $0.0000` |
| Frozen/game/baseline source diff | No changes in suite, evaluator, environment, actions, perception, public types, shared/game server/client, navigator or baseline sources |
| `git diff --check` and secret scan | Pass; scanner result recorded after final evidence writes |

Final selected files: `centralProgress`, `centralized`, `navigator`, `promptFreeze`, `recorderShutdown`, `batch`, `budget`, `modelPlayers`, `openai`, `modelMemory`, `navigatorIntents`, `playerKnowledge`, `environment`, `perception`, `runtime`, `situationA` (all `.test.ts` under `packages/agent/test/`). The new progress/geometry file has 23 tests. Tests use exact observed Pilot-28 configurations and labelled synthetic fixtures; the engine's pure `segmentHits` is imported in a test only, never in player code.

Earlier verification exposed four TypeScript union-field accesses, corrected by narrowing `GameAction`; the initial old expectation/import tests and the intentionally indefinitely holding capture fixture failed against the new semantics. These were corrected as described above; no game rule or frozen expectation was relaxed. Subsequent review added regression coverage for paired cast/wait, recovery call bounds, expired dependency deadlines and moving-watch renewal. Final results supersede intermediate counts (34-test first run had 4 failures; the next 52-test run had 1 remaining fixture failure).

Full `npm test` was not run because its route/suite/final-access tests can execute held-out material. No held-out evaluation or final-seed run occurred. The previously documented `s2Shutdown` finalize-timeout failure was not rerun here. The permitted historical baseline tests explicitly excluded the full-quest route. Required focused verification passed without re-pinning.

## Evidence and expected behavior

Portable metadata is in [`docs/midterm/evidence/pilot28-fixes/`](../../evidence/pilot28-fixes/): baseline and final mock summaries, recording metadata, and decoder report. Full local artifacts are `/tmp/p28-fix-baseline/`, `/tmp/p28-fix-smoke/`, `/tmp/p28-fix-smoke-2/`, and `/tmp/p28-fix-smoke-2-video/`. Video is not committed. The first repaired smoke proved terminal paint but showed the wrong elapsed clock; the second proves both. Original Pilot-28 artifacts were not edited.

In a future model run, renewed holds should lead to an explicit recovery request at 30 idle game seconds. Useful cooldown waits should finish on readiness or their first deadline. An unchanged cast should be reported as accepted/executed separately from any missing effect, and repeated identical ineffective attempts should be refused. The model should see why a hero's body blocks the possible pull and why boundary targets are uncertain. It still must choose a useful changed assignment; no walkthrough or fallback solution was added.

Remaining limitations: observations do not prove causation or every semantic subgoal. Creature motion after an ability can still be coincidental; completed facts cannot upgrade that to puzzle success. Rounded positions/full blocked cells make the pull preview approximate, and possible swept paths need not equal actual terrain-constrained motion. The six-second effect window and quarter-tile equivalence are conservative policy bounds. The watchdog can convert indefinite waiting into an explicit failure if the model refuses recovery; it cannot guarantee quest completion. Prompt/context size, provider behavior, paid call count, latency and completion rate remain unmeasured for this revision. The recording paint fix is verified on the local free mock, not every browser/host configuration.

## Audit checklist

| Step | Result | Evidence / scope |
| --- | --- | --- |
| 1 Server authority | Pass | Policies emit ordinary validated actions; no outcome/HP/position writes |
| 2 Rules and approved art | Pass | No game/shared/client/server/scenario/baseline diff |
| 3 Real mechanics | Pass | Real engine baseline and mock; fixtures explicitly test-only |
| 4 Player-visible-only observations | Pass in changed scope | Input-only helpers, import checks, hidden-field canary; existing real-play screen provenance test |
| 5 Legal action leakage | Unchanged | Five-operation interface and legal-action production unchanged |
| 6 No solution knowledge | Pass in changed scope | Generic policy strings; scenario names/coordinates only in regression fixtures and evidence |
| 7 Independent players | Disclosed exception | Owner-approved centralized mode only; other players unchanged |
| 8 Baseline parity | Preserved / disclosed | Baseline code and pinned trajectories unchanged; centralized combined-view experiment remains separately labelled |
| 9 Limits and failures | Pass in changed scope | Existing meter/runner unchanged; recovery stops dispatch, legitimate calls still charged normally |
| 10 Determinism/start | Pass | Baseline pinned end/start, six permitted frozen trajectories |
| 11 Suite/reporting | Pass in changed scope | No re-freeze, held-out run or paid trial; new centralized ID and limitations documented |
| 12 Recording honesty | Pass for smoke | Full decode plus visible manual-stop/time label; mock clearly labelled |
| 13 Validation | Pass for requested scope | Typecheck, build and focused offline checks above; exclusions explicit |
| 14 No overclaiming/secrets | Pass after scan | No paid success claim or credentials; no raw transcript committed |

This is a same-session implementation audit, not an independent reviewer sign-off. Session evidence: [S47](../../../agent-sessions/47-codex-pilot28-fixes.md). No paid API call, push or merge. Only the owner-authorized local commit is intended after successful checks.


### Secret-scan scope clarification

The broad scan of `docs/agent-sessions`, `docs/midterm` and changed source reported **178 text files / 1 finding**. It is a pre-existing explicitly fake canary example in `docs/midterm/agent-evidence/skill-runs/2026-10-27-recording.md:18`, unchanged at HEAD. Its redacted context confirms that the historical finding itself describes the scanner flagging a fake test value. No credential was printed. That historical audit finding is preserved. The follow-up scan excludes only that named historical example and scans all other session/midterm documentation plus changed source; changed files are also scanned explicitly. Their results are recorded with the final commit. This qualification supersedes any implication that the unfiltered whole-doc scan had zero findings.

Final scan results: **176 text files / 0 findings** with only the named historical fake-canary example excluded; **all 18 changed text files / 0 findings**, no exclusions. `git diff --check` passes. Typecheck and build were rerun after the final source changes and passed. The local commit containing this record is authorized; its resulting hash is reported in the session final response.

Implementation committed locally as `730e8b1`. The recorder metadata copy uses `recording-metadata.json` because the repository intentionally ignores files named `recording.json`; the saved content is unchanged. A documentation-only follow-up commits this portable metadata and records the implementation commit.
