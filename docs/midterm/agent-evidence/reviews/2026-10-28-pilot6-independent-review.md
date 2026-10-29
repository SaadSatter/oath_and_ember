# Independent review: pilot-6 movement feedback and review fixes (bdfcf7c, f48ae0e)

| Field | Value |
| --- | --- |
| Date | 2026-10-28 |
| Reviewer | Claude Code (CLI), model `claude-opus-5-5`, acting under the read-only checklist and report format of `.claude/agents/rules-reviewer.md` |
| Session | `130b0cd4-10f6-4466-a8cb-263a59da8719`. A separate top-level session started by the owner with a pasted review brief. It was not spawned by the implementing session (`4bd24137`). |
| Session URL | None. Local session; no shareable URL was created. |
| Independence | This session did not write the reviewed code and was not asked to approve it. It was told not to assume the implementation reports are correct. It used the same model family as the implementing session. |
| Commits reviewed | `bdfcf7c`, `f48ae0e` (code); `fc685e8`, `6448dc1` (evidence). Also read: `07c028f` (the earlier subagent review and its follow-up). Working tree clean at `6448dc1` before and after the checks. |
| Implementation code changed | None. The scratch reproductions are outside the repository, in the session scratchpad, and are not committed. |
| PR comment | None. No PR exists for `midterm/evaluation` yet. |

## rules-reviewer report

**Reviewed:** branch `midterm/evaluation` at `6448dc1`, which contains code commits `bdfcf7c` and `f48ae0e`. Files read:
- `packages/agent/src/{movementReport.ts, environment.ts (100–125, 380–620), perception.ts (95–115, 325–345, 425–460, 510–560, 595–615), actions.ts (84–89, 185–210), suite.ts (25–81)}`, `policies/{navigate.ts, llm.ts (legend line 219)}`, and the `asTuned` call sites.
- `packages/agent/test/{pilot6ReviewFixes, pilot6Fixes, asTuned, scriptedFreeze}.test.ts`.
- `apps/server/src/GameRoom.ts`: carry record 185; reconnect 340–360; `receiveInput`/`tick` 820–1075; return exits 1275–1285; Slow Time carry 1369–1455; `damage` 1753–1782.
- `packages/shared/src/{movement.ts (move 120–170, stepMovement 185–295), maps.ts (59–73, 345–356), gameTypes.ts neutral, constants.ts HALF}`.
- `apps/client/src/environment/HedgeMazeView.ts` (cow and label 186–188, 223); `apps/client/src/main.ts` (RETURN label 1683–1686).
- `docs/midterm/AGENT_INTERFACE.md` ("Pilot-6 fixes", "Review fixes"), the two audits, session record S36, and the earlier subagent review and its follow-up.

**Commands run in this session (local Node v26.9.0):**

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm test` | 107 files, **921/921 passed** |
| `npm run build` | exit 0 (Vite chunk-size warning only) |
| `git diff --stat 7bd0c7e HEAD -- apps packages/shared` | empty: no engine, server or shared-rule change since the freeze reference |
| `scriptedFreeze.test.ts` run against a `git archive 7bd0c7e` extract (before `asTuned` existed) | **7/7 passed**: the pinned route and baseline fingerprints are those of the pre-change code |
| Scratch reproductions A–D (vitest, scratchpad only; labelled fixtures set up area, positions and HP; all outcomes come from real inputs and ticks) | results quoted in the findings |

`npm test` includes `fullQuest`, `checkpointFreeze` and `scriptedFreeze`. These are the existing scripted feasibility and freeze checks: they run in memory, write no checkpoint files, and involve no model. No model was called, no held-out (S4/F) model or baseline evaluation was run, and no checkpoint was changed.

**Not reviewed or unverifiable:** I did not view a client death or respawn effect in a running browser, so whether the client shows anything beyond the hero appearing at spawn with full HP is unverified. I did not inspect pilot-6 run records (they are not committed). I did not use a live model.

### Findings

| # | Severity | File | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1 | Medium | `packages/agent/src/movementReport.ts:99, 106–107, 124–128` | The outcome `none` uses the **unrounded** `travelled / TILE < STILL_TILES` (0.02). The collision line is gated on the **rounded** `requestedTiles >= STILL_TILES`. One slowed tick of walking is 190 / 60 / 5 = 0.633 px = **0.0198 tiles**, which is below 0.02, yet `requestedTiles` rounds to 0.02. Repro D: a legal 1-tick `move e` on open ground in Hedge Maze under Slow Time gives `{"outcome":"none","movedTiles":0.02,"requestedTiles":0.02,"from":{"x":9,"y":34},"to":{"x":9.01,"y":34}}` and the line "You did not move e (0 of 0.02 tiles); you are still at (9.01, 34). Something blocked your way." Sieg gets the same result. Repro C: when a Slow Time carry left Coco with exactly one applied tick, she got the same false line (dx 30/dy 0 and dx 27/dy 10). | A false collision line, the same class of defect as the Slow Time bug that `f48ae0e` fixed. The move is legal (`ticks.min` is 1, `actions.ts:84`), and the line stops a batch. The text also contradicts itself: "0 of 0.02" while `movedTiles` is 0.02 and the position changed. More generally, any open-ground move whose total open-ground distance is below 0.02 tiles is classified `none`. | Classify `none` relative to open ground, for example `travelled < STILL·TILE && openGround >= STILL·TILE`, or compare unrounded values in both places. Add a test: a 1-tick open-ground move under Slow Time → not `none`, no collision line. Owner approval is needed before the change. |
| 2 | Medium (pre-existing) | `packages/agent/src/environment.ts:541–542`; `apps/server/src/GameRoom.ts:1768–1781` | `damage()` respawns a hero **inside the same call**: HP becomes 100, the hero is moved to spawn and `movementEpoch` is incremented. The environment interrupts only on `me.hp < r.hp`, and "You recovered." needs `r.hp <= 0`, which never holds after an immediate respawn. Repro A, move: lethal mossling hit in Hedge Maze → no interruption and no damage line. `movement` = `{"outcome":"full","movedTiles":2.87,"from":{"x":10.03,"y":25.5},"to":{"x":6.67,"y":34},"ticks":{"applied":29,"movedByGame":1}}`, with only "For 1 of 30 ticks the game moved your hero instead of your own walking." Repro A, wait: **no feedback at all**, and HP is back to 100. The interruption rule dates from `f351278` (2026-10-23). `damage()` is unchanged since `7bd0c7e`. | The defect is pre-existing; the reviewed commits neither caused it nor fixed it. For a move, the new report now gives the only hint, and the outcome `full` is misleading next to an 8.5-tile jump. For every other action the death is silent. A human sees the hero appear at spawn with the health bar refilled. A model sees only changed numbers in the next observation and may misread its position or progress. Scoring and engine authority are unaffected. It is reachable in tuning scenarios: Hedge Maze mosslings deal 10 per hit (`enemies.ts:66`), Hedge Maze has no HP floor, and S3 (and S2 by detour, as in pilot-6) enter it. | **Should it block paid evaluation?** My recommendation: fix it before the next paid S2/S3 run. The fix is small and observation-only: treat a `movementEpoch` change with an HP rise in the same tick as an interruption with a neutral visible line, such as "You were knocked out and woke at the area's start." If the owner chooses to run first, record it as a known limitation and count respawns per run from the trace. It does not invalidate the integrity of a run already made. Owner decision. |
| 3 | Low | `packages/agent/src/perception.ts:446–447` vs `539–545`; `policies/llm.ts:219` | `self` is truncated, so its whole part is the `@` cell. Every **other** listed thing still uses `round1`, while its grid mark is drawn at `Math.floor`. Repro B: Coco at x 25.96 is listed `x: 26` but drawn as `P` in column 25. The legend explains only `self`. `AGENT_INTERFACE.md` says "Other coordinates keep one decimal" but not that they may disagree with their marked cell. | This is the same confusion pilot-6 showed for `self`, now for the partner, the cow and enemies. It matters for lane alignment next to the cow. It leaks no hidden information. | Either truncate listed coordinates the same way (this would need re-checking against the frozen scripted fingerprints, which read `visible`), or add one legend sentence: listed coordinates of other things are rounded to one decimal, and their mark is drawn in the cell of the unrounded position. Owner choice. |
| 4 | Low | `packages/agent/src/environment.ts:561–564`; no committed test | The carry check reads the private `GameRoom.carried` through an unchecked cast. If that field were renamed or reshaped, `carries` would be `undefined` and carry detection would **silently** return false. No committed test reaches a carry. Repro C shows the path works: Sieg with Super Speed under Slow Time, moving east into Coco, carried her for 24–30 ticks in 8 of 12 placements, and those ticks were counted `movedByGame` with the neutral line (aside from finding 1). | Without a test, a refactor could quietly put carry displacement back into "applied" ticks and produce false partial or collision lines. | Commit a carry test. Repro C's setup is a ready template: Hedge Maze entrance row, Sieg at (3, 33), Coco 27 px east, `super_speed` and `slow_time`, then a 30-tick `move e` for Sieg and a `move s` for Coco. Assert `movedByGame > 0` and no collision line. Optionally, assert in the test that `carried` exists. |
| 5 | Low | `packages/agent/src/environment.ts:579`; `GameRoom.ts:997–999` | "Applied" compares `seq`, `moveX` and `moveY` with the frame sent. A story walk keeps the frame's `seq` (`{...neutral(movement.seq), ...walk}`), so a story walk that happens to use the same unit direction as the move is counted as applied. The test for story walks (`pilot6ReviewFixes.test.ts:189`) uses a different direction. | Theoretical. The story walk's step would be compared with open ground, and a short walk could be labelled a collision. Moves are legal only when `storyView` is null, which limits the overlap. | Also require `!storyWalkInput(...)`, or compare against a flag the room sets, if the owner wants this closed. Otherwise document it. |
| 6 | Info | `packages/agent/src/policies/navigate.ts:23–26`; call sites `questBaseline.ts:442`, `baseline.ts:32`, `route/director.ts:55` | `asTuned` is applied only by the scripted route and the two baselines, never in `llm.ts`, and it returns a copy (`asTuned.test.ts`). I ran `scriptedFreeze.test.ts` against an extract of `7bd0c7e`, before any pilot-6 change: 7/7 pass. At `HEAD` it passes too. So the route (seed 1: 12,412 ticks, end `32e8611191b9c283`) and both baselines on S1–S3 seed 0 have the same actions, ticks, per-result state hashes and end hashes as before. The remaining window is the double just below x.x5, within about 1e-14 tile, and is documented. | Verified. The movement replay runs on every scripted move, so the identical state hashes also show that the measurement does not change gameplay state. | None. Only route seed 1 and baseline seed 0 are pinned. That is enough while seeds change only hero ids. |
| 7 | Info | `packages/agent/test/scriptedFreeze.test.ts:39, 41` | `explore/S2` and `explore/S3` have the same pinned end hash (`cc9ad696c917e214`) and digest (`53edd2605b70c7ac`). Both start from the same post-opening state, and the exploration baseline ignores the S2 briefing. | The two exploration-baseline rows are one trajectory. They should not be read as two independent results in a comparison table. | Note it in `EVALUATION.md` when results are reported. |
| 8 | Info | `movementReport.ts:81, 106–109` | `movedTiles` and `requestedTiles` are rounded, while `from`/`to` are truncated. So `movedTiles` can differ from `to − from` by 0.01 in the same line (repro D: 9 → 9.01, reported 0.02). | Cosmetic, but it contributes to finding 1's self-contradictory text. | Truncate both, or round both. |

### Checklist

| # | Item | Checked? | Result |
| --- | --- | --- | --- |
| 1 | Game-rule consistency | Yes | No change under `apps/` or `packages/shared/` since `7bd0c7e` (git diff empty). The replay calls the shared `stepMovement` on a `structuredClone`. |
| 2 | Legal actions | Yes | Unchanged. The sign is not an action target. Super Speed starts in the ability's own `tap` frame (`actions.ts:206`), so its start never falls inside a move's replay. |
| 3 | Observations | Yes | Movement counts come from `movementInput`, `movementEpoch`, the carry record and positions. The lines name no cause, carrier or flag. The cow and sign match `HedgeMazeView.ts:186–188, 223`. Findings 1, 2 and 3 concern accuracy and parity, not leaks. |
| 4 | Solution leakage | Yes | The S2 briefing gives no route, coordinate or mechanism. Its claim that "every other area's RETURN exit leads back to the shrine" is true for the areas in reach (`maps.ts:59–73`, back points 350–356), and the text is owner-approved. The legend is general. |
| 5 | Separate reasoning | Yes | `movement` is reported per hero, in that hero's own memory and history. |
| 6 | Fairness | Yes | Model and scripted players get the same observation. `asTuned` is a scripted-only copy that lowers precision (finding 6). |
| 7 | Engine-owned outcomes | Yes | `movement` is informational. Success still comes from the room. |
| 8 | Deterministic evaluation | Yes | No `Date.now` in the measurement. Freeze hashes are identical to `7bd0c7e` (finding 6). |
| 9 | Tests and CI | Partly | 921/921 pass. Gaps: findings 1, 2 and 4, plus the cases below. |
| 10 | Project invariants | Yes | Server authority holds (reads and copies only). One in-memory service. No art change. |

Owner priorities, mapped:

1. **Movement feedback categories.** Executed, collision, ignored and game-driven ticks are sorted correctly in the tested cases and in repros A and C. Wrong for short slowed moves (finding 1). A lethal respawn is classed as game-moved, but the outcome reads `full` (finding 2).
2. **Same-tick Slow Time fix.** Correct. Onset (10- and 30-tick moves), expiry, and a genuine collision under Slow Time (`partial`, then `none`) are tested and pass. Tick order confirmed: expiry at `GameRoom.ts:891` and start at 897–916 come before movement at 1004, so the post-tick flag is the one movement used.
3. **No mutation, determinism, hidden information.** Pass (checklist 1, 3 and 8; finding 6).
4. **`asTuned` scope and historical equality.** Pass, independently verified against `7bd0c7e` (finding 6).
5. **Rounding and ASCII map.** `self` is consistent with `@`. Other things are not (finding 3). The hundredths are cut by `truncate2` (0.29 reads 0.28), which is documented.
6. **Cow, sign, briefing.** Pass (checklist 3 and 4).
7. **Regression coverage.** Super Speed, a damage interruption, reconnect, an area transition, story walks and skipped ticks are covered. The carry path is not: now reproduced offline, test still missing (finding 4). A lethal hit is not covered (finding 2).
8. **Lethal respawn.** Pre-existing, reachable in S2/S3. My recommendation is to fix it before the next paid S2/S3 run, as an owner decision (finding 2).

### Missing test coverage

- `packages/agent/test/pilot6ReviewFixes.test.ts`: a 1-tick open-ground `move` under Slow Time → outcome not `none`, no collision line (fails today, finding 1).
- Same file: a Slow Time carry (setup in finding 4) → `ticks.movedByGame > 0`, no collision line.
- Same file: a lethal hit during a `move` and during a `wait` → an interruption or visible line, and `movement` not reported as a plain `full` (after the owner decides on finding 2).
- `packages/agent/test/perception.test.ts`: a listed partner or creature near a cell edge → its listed coordinate and its marked cell agree, or the legend states that they may not (finding 3).

### Uncertainty

- I did not verify what the browser client shows on death (finding 2). Watching a lethal hit in the running client would settle whether a human gets more than the jump to spawn.
- How often 1-tick moves under Slow Time occur in model play is unknown. Counting `move` actions with `ticks <= 1` during Slow Time in existing pilot traces would settle it.
- The scratch reproductions are not committed, so these results rest on this record and the session transcript.
