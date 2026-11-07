# game-rules-audit: adapter (proposed fixes for pilot-6 review findings 1–6)

| Field | Value |
| --- | --- |
| Date | 2026-10-28 |
| Session | 4bd24137-7c42-410e-b365-f6f9798a700f (Claude Code) |
| Session URL | None unless the owner supplies one |
| Skill file SHA256 | 03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756 |
| Commit audited | 07c028f, working tree clean (before this report) |
| Target and focus | `adapter`: pre-implementation audit of the **proposed** fixes for findings 1–6 of `docs/midterm/agent-evidence/reviews/2026-10-28-pilot6-fixes-rules-review.md`, owner-approved for implementation on 2026-10-28. (1) Measure the open-ground step after `room.tick()`, from a copy of the hero taken before the tick, using the Slow Time state after the tick. (2) Count a tick toward the movement report only when the server used this move's input, and count separately the ticks in which the game itself moved the hero. Neutral feedback for both, kept distinct from collisions. (3) `asTuned` stays scripted-only; correct its comment; property tests and a committed regression test for scripted action and state hashes; no rounding change unless a material problem is shown. (4–5) Legend wording and docs claims. (6) The regression tests the review listed. Audio is deferred by the owner. No gameplay change. Nothing is implemented yet. |
| Files read | `AGENTS.md`, `CLAUDE.md`, `docs/midterm/MIDTERM_GUIDELINES.md` (rubric), `docs/midterm/REQUIREMENTS_CHECKLIST.md`, `docs/midterm/AGENT_INTERFACE.md` ("Pilot-6 fixes"), the review and its follow-up (`docs/midterm/agent-evidence/2026-10-28-pilot6-review-followup.md`), the earlier audit `2026-10-28-adapter-pilot6-fixes.md`; `apps/server/src/GameRoom.ts` (input 820–880, `tick` 883–1065, Slow Time carry 1369–1455, `damage` respawn 1765–1778, transitions 425–436 and 575–585, reconnect 340–356); `packages/shared/src/{movement,gameTypes}.ts`; `packages/agent/src/{environment,movementReport,perception}.ts`, `policies/{navigate,llm}.ts`, `route/director.ts`; `packages/agent/test/pilot6Fixes.test.ts` |
| Commands run | `git rev-parse --short HEAD` → `07c028f`; `git status --short` → clean; `shasum -a 256 .claude/skills/game-rules-audit/SKILL.md` → above. Bundled Node v24.19.0: `npm run typecheck` → exit 0; `npm run build` → exit 0 (Vite chunk-size warning only); `npx vitest run packages/agent` → 25 files, 336/336 passed. The scratch behaviour fingerprint (route seed 1; both baselines on S1–S3 seed 0; the script is in the session scratchpad, not the repository) → identical to the one recorded at `7bd0c7e`, 8.99 s wall. Full `npm test` was not run in this audit; it will run after implementation. `python3 -I scripts/evidence/scan_secrets.py` on this report → 1 file, 0 findings. |

## Findings

| # | Severity | Source (H/M) | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Medium | M | `apps/server/src/GameRoom.ts:891, 897–916, 1004`; `432, 581` | Within one tick, Slow Time expires (891) and starts (897–916) before `stepMovement` (1004). The only other places that remove `w.slowTime` are scene transition and reset (432, 581). After those the hero is in another area, and the environment reports no movement. | The proposal's post-tick Slow Time flag is the state the server's own movement used on every tick for which a report is made. | Implement proposal 1 as stated: copy the hero before the input, replay after the tick with `!!w.slowTime` from after the tick. Test Slow Time **onset** (cast on the move's first tick) and **expiry** (a move spanning the last slowed tick). |
| 2 | Medium | M | `GameRoom.ts:886–890, 962–1001`; `environment.ts` `tickOnce` | The server records the movement it used: `p.lastProcessedInputSeq = movement.seq; p.movementInput = { ...movement }` (1000–1001). `movement` is replaced in several cases: by `neutral(...)` when locked or stale (966–991); by the story's input (`storyWalkInput`, 997–999); left unchanged on a tick that returns early (886–890: not `PLAYING`, or a partner disconnected); and reset by reconnect or respawn (350–356, 1776–1777). The environment sends a fresh `seq` every tick (`neutral(++s.seq)`), with no `targetTick`, so the legacy path applies. | The test "`seq`, `moveX` and `moveY` of `p.movementInput` equal the frame sent" is reliable and comes from engine state. An early-return tick leaves the previous tick's `seq`, so it is correctly counted as not applied. | Implement proposal 2 with that test. Count `ticksApplied` and `ticksNotApplied`. Measure progress and open ground over applied ticks only. |
| 3 | Medium | H/M | `GameRoom.ts:1768–1778`; `environment.ts` interruption rule | A lethal hit respawns the hero **inside** `damage()`: HP is set back to 100, the hero teleports to spawn, `movementEpoch++` and `movementInput` becomes neutral. The environment interrupts on damage only when `me.hp < r.hp`, so a death mid-move raises **no interruption and no damage line**, and the move continues from spawn. This is pre-existing and outside findings 1–6. | Without proposal 2, the respawn teleport would be counted as walked displacement. With it, that tick is a game-moved tick (epoch change) and not a collision. The missing death and damage feedback remains. | Within scope: treat any `movementEpoch` change in a tick as a game-moved tick (respawn, flight landing, reconnect). **Out of scope:** report the silent death and respawn to the owner as a separate finding; do not fix it in this change. |
| 4 | Medium | M | `GameRoom.ts:185, 1369–1455` | Slow Time carry moves another hero by Sieg's step after their own movement (1427–1449). The record is `GameRoom.carried` (private), whose `targets` set gains the carried hero. A target can be removed from that set in the same tick it was moved, when its carry was constrained (1450–1453). | Reading only the set after the tick misses the tick on which a carry ends. | Read `carried` through a typed, read-only cast in the trusted environment. Treat the hero as carried in a tick if it is in any carry's `targets` before **or** after the tick. Never expose the set, a cause or the carrier. Document this as trusted-side engine state. |
| 5 | Low | M | proposed feedback text | A human sees their hero not respond (scene, pause) or being moved (carried, landing, respawn), but is told no cause. | Wording could leak a cause (story, carry, landing). | Neutral lines, separate from the collision lines. For example: "For N of M ticks your hero did not take your movement input." and "For N of M ticks the game moved your hero instead of your own walking." No line when both counts are 0. The collision line is computed only over applied, not game-moved ticks. When no tick was applied, use outcome `not_applied` with no collision line. |
| 6 | Low | M | `packages/agent/src/movementReport.ts:11–15`; `AGENT_INTERFACE.md` | The review (finding 5) showed the claim of counting "exactly as the server counts them" was untrue. | After proposals 1 and 2, the replay is the server's own `stepMovement` with the server's Slow Time state, but only on unobstructed ground and only for ticks that used the move's input. | Document precisely: the open-ground distance is the shared `stepMovement` on a copy, with the Slow Time state movement used that tick, over the ticks where the server applied this move's input. Not-applied and game-moved ticks are counted separately. Do not say "exactly" without that qualification. |
| 7 | Low | M | `policies/navigate.ts:17–19` | The follow-up's sweep: 0 mismatches between `asTuned(truncate2(v))` and `round1(v)` in 2,000,000 random positions and on a 1/512 px grid; mismatches only within 3.4e-14 tile below an x.x5 boundary. The fingerprint is unchanged. | Not a material compatibility problem. | No rounding change (owner condition). Correct the comment to state the measured window. Add a property test (random floats, positions reached by walking, slowed and diagonal steps, and exact boundaries), plus an explicit test documenting the known sub-1e-13 discrepancy. |
| 8 | Info | M | proposed committed regression test | The route (seed 1) plays the full quest, held-out F content, through `routeDevelopmentAccess`, as `route/fullQuest.test.ts` already does. Baselines run on tuning scenarios S1–S3 only. No checkpoint changes. | A scripted feasibility and freeze check, not an evaluation. The owner forbade held-out evaluations and re-freezing. | Use the same labelled `routeDevelopmentAccess` with a reason string; pin only already-recorded values; never update pinned values automatically. Do not run S4/F *episodes*. Disclose in the evidence. About 9 s. |
| 9 | Low | M | `policies/llm.ts` legend | Marks (`@ P E C o > * ^`, and `#` for pillars) overwrite the terrain character of the cell containing the thing's centre (`perception.ts` `put`). | The legend's "each tile shows what lies at its centre" is wrong for marked cells. | Reword: the `.`, `#` and `~` cells show what lies at the cell's centre; a hero, creature, enemy, object, exit or projectile drawn in a cell replaces that character, so the ground under it is not shown. |
| 10 | Info | M/H | traces | New fields and lines change trace bytes for scripted and model runs. They change no actions and no state hashes, because the code only reads state. | Same as the review's finding 8. | Keep the fingerprint (actions plus state hashes) as the freeze criterion; say "trace bytes differ" in the evidence. |

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass (planned) | All proposed code reads state: `p.movementInput`, `movementEpoch`, `carried`, `w.slowTime`, and positions before and after the tick. Replays run on `structuredClone` copies. |
| 2 Rules and art preserved | Pass (planned) | No file under `apps/` or `packages/shared/` needs to change. |
| 3 Real mechanics, no fixtures | Pass, with conditions | Tests that need an unapplied tick or a carry may use a **labelled** fixture to reach that engine state, as existing tests do with `room.transition`. Outcomes must still come from real inputs. |
| 4 Observations player-visible only | Findings 3, 4, 5 | Counts of not-applied and game-moved ticks describe what the hero visibly did. No cause, set or flag is exposed. |
| 5 Legal actions leak nothing | Pass | Unchanged. |
| 6 No solution in any player context | Pass | Prompt changes are general wording only. |
| 7 Independent players | Pass | Per-hero reports and history, unchanged. |
| 8 One interface | Pass | The same observation for all players; `asTuned` stays scripted-only. |
| 9 Limits and terminal reasons | N/A | Unchanged. |
| 10 Determinism and identical starts | Pass (planned) | Read-only, so state hashes are unchanged; verify with the committed fingerprint test. |
| 11 Suite and reporting | Finding 8 | No scenario, seed, limit or checkpoint change. Record the behaviour change in `EVALUATION_SUITE.md` because model observations change. |
| 12 Synchronization and recording honesty | N/A | Unchanged. |
| 13 Validation | Pass on the unchanged tree | Typecheck and build pass; `packages/agent` 336/336. Full suite after implementation. |
| 14 No overclaiming, no secrets | Finding 6 | Scan of this report: 0 findings. |

## Recommended tests

- Slow Time cast on the first tick of a partner's 10- and 30-tick open-ground move → `full`, no collision line (reproduces review finding 1).
- A move spanning Slow Time **expiry** on open ground → `full`.
- A genuine collision under Slow Time → `partial`, then `none`, with the collision line.
- Super Speed on open ground → `full`, `requestedTiles` ≈ 2× walking. With Slow Time active: Sieg ≈ 1×, Coco ≈ 0.2×.
- A move interrupted by damage → measured over the ticks that ran; not a collision when unobstructed.
- A move whose ticks the server does not apply (labelled fixture producing an engine state that ignores input, such as a disconnected partner or a story lock) → `not_applied` or applied-only counting, with the neutral line and no collision line.
- A tick in which the game moves the hero (labelled fixture: `movementEpoch` change, or a carry) → counted as game-moved, not as a collision.
- An area transition during a partner's move → no `movement`.
- `asTuned` property and boundary tests.
- Committed fingerprint test: route seed 1 (ticks 12,412, end hash prefix `32e8611191b9c283`) and both baselines on S1–S3 seed 0, all equal to the values recorded at `7bd0c7e`.

## Open questions for the owner

1. Finding 3: a lethal hit mid-move currently produces no interruption and no damage line. Should that be fixed in a later change?
2. Should a game-moved tick also stop a batch? The proposal says yes, because it adds a feedback line.
