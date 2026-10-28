# rules-reviewer subagent review: pilot-6 fixes (bdfcf7c, fc685e8)

| Field | Value |
| --- | --- |
| Date | 2026-10-28 |
| Reviewer | `rules-reviewer` subagent (`.claude/agents/rules-reviewer.md`: Read, Grep, Glob only) |
| Invoked from | Claude Code session `4bd24137-7c42-410e-b365-f6f9798a700f`, at the owner's request. That session wrote the reviewed code. The reviewer did not write it and was not asked to approve it. |
| Context given | A fresh subagent context. It received the two commit diffs (`git show` output), the repository path, the owner's decisions and the owner's focus questions. It was told to judge the code on its own merits rather than by the audit's or the session record's claims. It was given none of the implementing session's conclusions or verification numbers. |
| Independence | Read-only, not the author, and in a fresh context. However, it was spawned by the implementing session. Under the `session-evidence` classification rule a subagent spawned by the implementing session is not counted as an independent review; a separate reviewer session (Claude or Codex) would be. |
| Scope given by the owner | `asTuned` scope and boundary exactness; historical baseline action/state hashes; movement feedback under Slow Time, Super Speed, collisions and interruptions; side effects and cost of the copied-hero replay; cow/sign presentation and the S2 briefing against human-equivalent information; the full-suite `mirrorPondWalkthrough` timeout. |
| Session URL | None. Local session; no shareable URL was created. |
| PR comment | None. No PR exists for this branch yet. |

The reviewer's report follows unchanged. The implementing session's own
verification of its findings is recorded separately, in
`docs/midterm/agent-evidence/2026-10-28-pilot6-review-followup.md`.

---

## rules-reviewer report

**Reviewed:** branch `midterm/evaluation`, commits `bdfcf7c` (implementation) and `fc685e8` (evidence docs), using the two diffs in the scratchpad review folder. I read these files in full or in the relevant parts:
- Agent package: `packages/agent/src/{environment.ts (380–620), movementReport.ts, perception.ts (280–620), actions.ts (60–220), batch.ts, runner.ts}`, `policies/{navigate.ts, baseline.ts, questBaseline.ts (236–475), combat.ts}`, `route/{director.ts, fullQuest.ts (80–330)}`, and `test/pilot6Fixes.test.ts` (from the diff).
- Shared and server: `packages/shared/src/{movement.ts, constants.ts, maps.ts (40–80, 295–335)}`, `gameTypes.ts` (Player), and `apps/server/src/GameRoom.ts` (815–1065, 1355–1435).
- Client: `apps/client/src/environment/HedgeMazeView.ts` (label and cow lines).

**Not reviewed or unverifiable:** I could not run any code, so none of the numeric claims are verified by me. That covers typecheck, build, `npm test` 898/899, `pilot6Fixes` 16/16, route 12,412 ticks and its end hash, and baseline action/state-hash identity on S1–S3. I did not read `storyLocked`/`storyWalkInput` internals, `sceneOf`, the manual, or the HUD code in `apps/client/src/main.ts`. I did not check whether any committed golden trace or hash fixtures depend on trace contents.

### Findings

| # | Severity | File:line | Evidence | Impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| 1 | Medium | `packages/agent/src/environment.ts:499-505` vs `apps/server/src/GameRoom.ts:891, 897-916, 1004-1019` | The open-ground replay reads `!!w.slowTime` **before** `room.tick()`. Inside `tick()`, Slow Time expires (891) and starts (897–916) **before** `stepMovement` (1004), so the replay is one tick out of step at both ends of Slow Time. At onset the replay counts a full step (3.17 px), but the server moves the hero 0.63 px. With Super Speed it counts 6.33 px against 3.17 px. For a move that starts k ticks before onset, `actual < 0.9·openGround` whenever `actual < 22.8 px`. A 30-tick move starting on the onset tick moves 19.0 px against 21.5 px of open ground (0.88), so it is reported `partial`. Any 10-tick move with k ≤ 6 is also reported `partial`. | Sieg gets a false "You moved e only … Something stopped you." when Coco casts Slow Time during his move. That feedback stops his batch (batch.ts:24). Model players see this. The test at pilot6Fixes.test.ts:"measures open ground at the hero's real speed" avoids the case by having Sieg wait 4 ticks first. | Before the input, clone the hero (and its scene). Run the replay **after** `room.tick()` using the post-tick `w.slowTime`, which is the state movement actually used on that tick. Add a test where Slow Time starts on the first tick of a partner's 10- or 30-tick move. |
| 2 | Low | `environment.ts:500-504`; `GameRoom.ts:886-890, 939-999, 1369-1440, movement.ts:213-231` | The replay always applies the agent's frame. The server instead moves the hero by something else, or not at all, in several cases: (a) `phase !== "PLAYING"` or a partner is disconnected, where tick returns before movement; (b) `storyLocked`/`lockMove` and stale input, where the input is neutral; (c) `storyWalkInput`, where the story's input is used; (d) Slow Time carry, where Coco is moved by Sieg's delta (1427–1440); (e) the flight-landing teleport. | Misleading `none`, `partial` or `full` reports, including a false "Something blocked your way". (b) usually also interrupts with "A dialogue line appeared." Not a leak. | Measure only ticks where the server applied the agent's input (for example, compare `p.lastProcessedInputSeq`/`p.movementInput` after the tick with the frame sent), or omit `movement` when the input was overridden. At minimum, document these exceptions. |
| 3 | Low | `packages/agent/src/perception.ts:104-107`, `policies/navigate.ts:17-19` | `truncate2` adds `+1e-9` to `frac*100`. Values within about 1e-11 tiles **below** an x.x5 boundary are bumped up a hundredth, which `asTuned` then rounds up. Mathematically `floor((floor(100v)+5)/10) = floor(10v+0.5)`, so the two agree everywhere else, including at exactly representable boundaries such as 0.25 and 0.75. Concrete mismatches: v = 0.15 − 1e-12 gives `round1` = 0.1 and `asTuned(truncate2)` = 0.2. v = 25.95 − 2e-12 (px ≈ 830.4 − 6.4e-11) gives 25.9 and 26.0. The cap at 99 and the float-noise cases (e.g. 0.29·100) agree. | Equivalence holds for all but a window of about 1e-10 per coordinate per observation. It is practically unreachable, but not exact as the comment at navigate.ts:14-15 ("the result round1 gave on the raw position") claims. The route and baselines could diverge only if a position landed in that window. | Correct the comment to "identical except within ~1e-11 tile below x.x5". Or shrink the epsilon to ULP scale (e.g. `Number.EPSILON * 100 * Math.max(1, n)`). Add a property test comparing `asTuned(truncate2(px/32))` with `round1(px/32)` over many float px values, including positions reached by sums of `190/60`, `0.2·190/60` and `/√2` steps. |
| 4 | Low | `policies/llm.ts:219-220` vs `perception.ts:522-542` | The legend says "Each tile shows what lies at its centre". Marks (`o C E P > * ^`, and `#` for standing pillars) overwrite the terrain character in the cell that contains the thing's centre, so a marked cell does not show its terrain. The body claim is correct: `HALF` = 13 gives 26 px ≈ 0.81 tiles, and `overlaps` uses the full box. The `@` cell claim also matches `put(Math.floor(x/TILE))`. | Minor inaccuracy in the prompt. A model may read "o" as open or blocked ground. | Change the wording to "…each "." / "#" / "~" tile shows what lies at its centre; a letter or symbol marks a thing in that tile and hides the ground under it." |
| 5 | Low | `docs/midterm/AGENT_INTERFACE.md` (Pilot-6 fixes §1), `movementReport.ts:11-15` | Claims that "Super Speed, Slow Time and Sieg's exception count exactly as the server counts them". Findings 1 and 2 show they do not at Slow Time boundaries or when input is gated. | Overclaim in the docs. | Qualify the claim, or fix it with finding 1. |
| 6 | Low (tests) | `packages/agent/test/pilot6Fixes.test.ts` | No test for: Slow Time onset during a move; Super Speed `full`; Sieg's Super-Speed exception under Slow Time; an interrupted move (damage or dialogue) measured over the ticks that ran; a move that changes area having no `movement`; a whole-episode check that state hashes are the same with and without reporting. The baseline before/after fingerprint was a "scratch" run (session record) and is not committed. | Regressions in findings 1 and 3, and in the freeze claim, would go undetected. | See Missing test coverage. |
| 7 | Info | `route/director.ts:55-57` | `measurePrompts` now measures the `asTuned` observation, so `self` has one decimal, not the two a model receives. | Prompt-size statistics from `scripts/midterm/run-route.ts` slightly understate real prompts. | Measure the raw `env.observe` result. |
| 8 | Info | `environment.ts:574`; trace | Scripted runs now write `movement` and the new move feedback lines into their `result` trace records. Policies ignore them: the scripted players read no feedback apart from the wig regex at fullQuest.ts:301, and `c.last` is stored but never read. | Actions and game-state hashes can stay identical, but trace bytes and hash chains of baseline runs differ from historical traces. "Baseline results unchanged" should not be read as "traces unchanged". | Say so in the evidence. |
| 9 | Info | `packages/agent/src/suite.ts` (S2_BRIEFING) vs `packages/shared/src/maps.ts:59-69` | "Every other area's RETURN exit leads back to the shrine" is literally false for Bridge Ruins (→ Monster Clearing) and for areas outside chapter 0. It is true for Griffin, Mirror Pond, Hedge Maze and Forest Ruins. It is also map-topology information a player learns only by travelling. The owner approved this wording verbatim. | Small, owner-approved disclosure. The briefing contains no direction, route or solution (checked). | Owner's call. No change required. |
| 10 | Info | `suite.ts:482-483` comment; `s2Briefing.test.ts` test name; `EVALUATION_SUITE.md` row; `AGENT_INTERFACE.md`; `EVIDENCE_INDEX.md`; session record 36 | These still say the briefing wording is "pending the owner" and that `asTuned` "awaits the owner's confirmation". The owner has since approved the briefing exactly as written, and accepted `asTuned` provisionally pending this review. | The docs are stale, not overclaiming. | Update the docs in a follow-up. Do not edit the audit report or the session record's narrative, which are fixed evidence. |
| 11 | Info | `apps/client/src/audio/SoundEvents.ts` (per the docs), not changed | The documented "lane cleared" chime is a human-only cue that reveals the hidden `parked` transition. | Pre-existing parity gap, correctly left for an owner decision. | None in this PR. |
| 12 | Info | `perception.ts:356-361` vs `HedgeMazeView.ts:192` | The "E · key gate" object is listed at (41, 14), but the client draws its label at (39, 16.8). This is a pre-existing as-drawn mismatch, like the dry-hedge one the audit noted. | Not introduced here. | Possibly list it for the owner. |

### Checks (the caller's questions)

| Q | Result | Note |
| --- | --- | --- |
| 1 `asTuned` scope | Pass | All call sites: `questBaseline.ts:442`, `baseline.ts:32`, `director.ts:55` (`Director.obs`, which also backs `self`, `see`, `go`, `fight` and `dialogue`). `director.ts:105` reads the raw observation for `tick` only. No call in `llm.ts`, `harness.ts`, `runner.ts`, `environment.ts`, `perception.ts` or traces. `runner.ts:92-94` traces the raw observation. `asTuned` returns a new object, so the environment's observation is not changed. Side issue: finding 7. |
| 2 `asTuned(truncate2(v))` = `round1(v)` | Finding 3 | Exact identity in real arithmetic. Agrees at exactly representable boundaries (k/4) and in float-noise cases thanks to the epsilon. Disagrees only within about 1e-11 tile below x.x5 (v = 0.15−1e-12 → 0.1 vs 0.2). |
| 3 Can historical hashes stay unchanged? | Pass by code reading; numbers unverified | Grid: the sign has no mark, and the cow keeps "C" at the same position. `visible`: one new `object` in Hedge Maze shifts later `object-n` refs, but refs are never used (`ref` appears only at perception.ts:440). Scripted code matches no cow or sign names (it uses `FIREBALL · dry hedge`, `FOREST WOLF`, mirrors, spikes, exits with `kind==="exit"`, enemies). The new feedback lines and `movement` are not read by the scripted players; the wig regex is unaffected. The baselines return single actions, so the batch stop does not apply. `self` is the only changed field they read, and finding 3 covers its window. Traces differ (finding 8). |
| 4 Movement reporting | Findings 1 and 2 | Correct: Super Speed onset and expiry (same code path in `stepMovement`); Sieg's exception during steady Slow Time; diagonal normalisation; corner slides and blocked diagonals (reported as `partial` by progress); first and last ticks (one replay per frame actually sent); interrupted moves, which count the ticks that ran; area change (no report); episode end via `release` (no report). Wrong at Slow Time onset and expiry (finding 1) and wherever the server overrides input (finding 2). PLATFORMER maps would add gravity to the replay, but they are outside this episode. |
| 5 Clone side effects and cost | Pass | `stepMovement` and `move` mutate only `p`. `map` is shallow-copied and not mutated, `frame` is copied, and there is no global state. A Player is a small flat record (gameTypes.ts:51-90), so a `structuredClone` per moving hero per tick is negligible. The test checks that room JSON is unchanged after one call. A full-episode hash check is not tested. |
| 6 Cow, sign, briefing, legend | Pass, with findings 4 and 9 | The cow is a neutral "cow" at its live position, as `HedgeMazeView.ts:186,223` draws it. The sign is fixed at (26, 27.7) as at `HedgeMazeView.ts:188` and is not interactable (`nearbyTarget` uses inventory targets). Nothing reports `parked` or a cause. Briefing: no direction, coordinate, mechanism or step. The legend is mostly accurate (finding 4). |
| 7 Other | Findings 6, 7, 8 and 10 | No protocol change, so no socket test is needed. Determinism: the replay is pure with fixed `DT`, no `Date.now`. The pre-existing real-time 250 ms check on Slow Time (`GameRoom.ts:906`) is unchanged. |
| Docs overclaim | Findings 5 and 10 | "Nothing under apps/ or packages/shared/ was edited" is true per the diff. The test count of 16 matches. The numeric results are unverified by me. |

### Checklist

| # | Item | Checked? | Result |
| --- | --- | --- | --- |
| 1 | Game-rule consistency | Yes | No rule, tuning or map change. The movement replay reuses shared `stepMovement` but timing differs (finding 1). |
| 2 | Legal actions | Yes | Unchanged. The sign is not an action target. |
| 3 | Observations | Yes | No hidden state added. The cow and sign are shown as drawn. Movement feedback is per hero only (tested). |
| 4 | Solution leakage | Yes | No route, direction or answer in the prompt, briefing or feedback. The topology sentence is owner-approved (finding 9). |
| 5 | Separate reasoning | Yes | `movement` is kept in each player's own `completed` list. No shared state. |
| 6 | Fairness | Yes | `asTuned` only reduces the baselines' precision, so it is no advantage. All players get the same environment observation. |
| 7 | Engine-owned outcomes | Yes | `movement` is informational. Success still comes from the evaluator and the room. |
| 8 | Deterministic evaluation | Partly | The replay is deterministic. Freeze claims are unverified by me (finding 3 window). |
| 9 | Tests and CI | Partly | 16 new tests. Gaps below. I did not run them. |
| 10 | Project invariants | Yes | Server authority holds (copy only). One service. No art change. |

### Missing test coverage

- `packages/agent/test/pilot6Fixes.test.ts`: Coco casts Slow Time on the first tick of Sieg's 10- and 30-tick open-ground moves → `movement.outcome === "full"` and no move feedback line (fails today).
- Same file: Sieg uses Super Speed then moves on open ground → `full`, `requestedTiles ≈ 2×` walking. With Slow Time also active, Sieg gets `requestedTiles ≈ 1×` (the exception) and Coco 0.2×.
- Same file: a move interrupted by damage or dialogue → `requestedTiles` covers only the ticks that ran, and the outcome is consistent.
- Same file: a move that crosses an exit → `movement` is undefined.
- Same file: one episode run twice, with and without reporting (or the replay stubbed out) → identical state hashes for every tick.
- New property test: `asTuned(truncate2(px/32)).self` equals `round1(px/32)` over a sweep of float px values built from walking, slow and diagonal steps, plus values within 1e-9 tile of x.x5.
- Committed regression for the baselines: actions and state hashes of `QuestBaseline` and `ExplorationBaseline` on S1–S3 seed 0, matching recorded pre-change values.

### Uncertainty

- Whether finding 1 occurs in practice depends on how often Slow Time starts during a partner's short move. Rerunning pilot-6-style S2 offline with a scripted cast would settle it.
- I did not verify how often `storyWalkInput`/`lockMove` overlap a legal `move` (move is legal only when `storyView` is null). Reading `storyLocked` and the walk timing would settle it.
- I did not check whether any test or fixture pins baseline trace hashes, which finding 8 would change. Grepping the tests for trace digests would settle it.
- None of the implementer's numbers (route ticks and hash, baseline identity, test counts) could be checked without running code.
