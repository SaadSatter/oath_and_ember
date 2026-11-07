# rules-reviewer subagent review: S2 reliability fixes (3f22c66, 3573d2f)

| Field | Value |
| --- | --- |
| Date | 2026-10-28 |
| Reviewer | `rules-reviewer` subagent (`.claude/agents/rules-reviewer.md`: Read, Grep, Glob only) |
| Invoked from | Claude Code session `1d2c5393-985f-4736-86c2-40baf5a01504`, at the owner's request. That session wrote the reviewed code. The reviewer did not write it and was not asked to approve it. |
| Independence | Read-only and not the author, but spawned by the implementing session. Under the `session-evidence` classification rule a subagent spawned by the implementing session is not counted as an independent review; a separate reviewer session would be. |
| Scope given by the owner | The OpenAI strict action schema and response parsing; attack recovery feedback against human-visible gameplay; per-hero visible world-change events and hidden-state isolation; recorder shutdown, interruption handling, and ledger and trace finalization. |
| Session URL | None. Local session; no shareable URL was created. |
| PR comment | None. No PR exists for this branch yet. |

The reviewer's report follows unchanged. The implementing session's
responses are recorded separately, in `docs/agent-sessions/35-claude-s2-reliability-fixes.md`.

---

## rules-reviewer report

**Reviewed:** commits 3f22c66 (implementation) and 3573d2f (evidence docs) on `midterm/evaluation`. There was no diff file (`.git/rules-review.diff` is absent) and I cannot run git, so I reviewed the current files as they stand. Files read:
- `packages/agent/src/policies/openai.ts`, `policies/llm.ts`
- `packages/agent/src/types.ts`, `actions.ts`, `environment.ts`, `worldEvents.ts`
- `packages/agent/src/perception.ts` (lines 120–180, 270–440, 610–645)
- `packages/agent/src/recorder.ts`, `shutdown.ts`, `secretScan.ts`, `liveViewer.ts` (close), `runner.ts` (abort wiring only)
- `scripts/midterm/live.ts`
- `apps/server/src/GameRoom.ts` (lines 1000–1200, plus a grep of `receiveInput` and `scheduledCasts`)
- `packages/shared/src/abilities.ts`, `apps/client/src/environment/HedgeMazeView.ts` (grep), the manual's combat lines
- tests: `s2Feedback.test.ts`, `s2Adapter.test.ts`, `s2Shutdown.test.ts`, `openai.test.ts` (lines 120–340)
- docs: `AGENT_INTERFACE.md` (S2 reliability pass), `LIVE_RUN.md` (rows 58–77), `MODEL_BUDGET.md` (lines 95, 99), `docs/agent-sessions/35-claude-s2-reliability-fixes.md`, `EVIDENCE_INDEX.md` (S2 reliability fixes), and the pre-implementation audit `2026-10-28-adapter-s2-feedback.md`.

**Not reviewed or unverifiable:**
- I ran no tests, typecheck or build. I cannot say they pass.
- Without a diff I cannot confirm earlier behaviour. Two cases matter: whether `VIEW_PAD = 8` equals the old literal pad in `perceive`, and whether Anthropic max_tokens replies were always refused before.
- I cannot check the claimed before/after baseline hash comparison or the end-to-end Ctrl-C check. Their records are not committed.
- I could not check how a real shell, npm or tsx delivers signals (finding 1).
- The session record says full `npm test` was not run: `suite.test.ts`, `route/fullQuest.test.ts` and `checkpointFreeze.test.ts` were excluded.

### Findings

| # | Severity | Area | File:line | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Medium | 4 | `scripts/midterm/live.ts:136-162`; `shutdown.ts:23-27` | SIGHUP goes through the same counter as Ctrl-C: `signalAction(phase, interrupts++)`, and any second signal while running is `force-exit`. When a terminal closes, a foreground job can get SIGHUP twice (once from the kernel and once from the shell passing it on). A Ctrl-C under `npm run`/tsx may also arrive twice if the wrapper relays it. The second signal would then force-exit mid-run, so the ledger reservation stays held and the trace has no outcome line. After a hangup, `console.error` writes to a closed TTY could also throw before `finally` runs. Unverified: I could not run it. | `LIVE_RUN.md:60` says "SIGHUP … handled like Ctrl-C", but in practice a hangup may be a forced exit. The ledger fails closed, so this costs evidence, not money. | Test with a real subprocess: send SIGHUP twice in quick succession, and send Ctrl-C through `npm run eval:live`. Consider ignoring signals that arrive within a few hundred ms of the first, and say in the doc what happens to stdout after a hangup. |
| 2 | Medium | 4 | `LIVE_RUN.md:74` vs `live.ts:139-156`, `LIVE_RUN.md:60,75` | Line 74 still says that after Ctrl-C "another Ctrl-C cuts these waits short". In the code, a second signal after a running-phase Ctrl-C is `force-exit` (`interrupts` is already 1), not `finish-now`. | The doc contradicts itself and the code about what a second Ctrl-C does. | Fix line 74 to match `signalAction`. |
| 3 | Medium | 4 | `packages/agent/test/s2Shutdown.test.ts:102-111` | The launcher is only tested by grepping its source text (`toContain('process.on("SIGHUP"')`, `not.toMatch(/await viewer\??\.close\(\)/)`). No test runs live.ts and checks the exit handler (`live.ts:130-135`), the `recordingFinal` flag, or the order of `finally` (live.json, ledger close, scan) before `recorder.stop`. | A wiring regression (wrong phase, `recordingFinal` set at the wrong time) would pass. | Add a subprocess test (mock gateway, fake driver or `--no-viewer`): one signal during running, then exit 130, `live.json` written, scratch ledger settled, trace ends with a terminal line. Add a second variant with two signals that checks `recording.json` status `failed`. |
| 4 | Low | 2 | `environment.ts:509,531,545`; `GameRoom.ts:1052-1078` | With Heavy Break, frame 1 starts `heavyCharge` and the strike only happens on release (frame 2). If the action is interrupted on tick 1 (damage, arrival, dialogue), `finish()` reports `attack: "none"` and "Your sword did not swing." The release, and so the swing, then happens during the next action, where it is not attributed. | Wrong "nothing happened" feedback in that case. `heavy` is not a starting skill (`abilities.ts:2-7`, cost 1), so it is unlikely in the goddess episode. | Either keep a pending-strike watch across the next action, or say in `AGENT_INTERFACE.md` §1 that an interrupted heavy press may be misreported. Add a test if Heavy Break is reachable. |
| 5 | Low | 1 | `llm.ts:356-367` | If `raw` is complete JSON with trailing blanks but `parseReply(text)` fails (wrong envelope, unknown field), the code falls through. Because the trailing run is ≥200, it returns "It broke off inside the JSON after N blank characters…", which is false, and `parseReply`'s real reason is lost. | Misleading feedback to the player. It never accepts or repairs anything. | When `complete` is true, return `parseReply`'s failure reason. |
| 6 | Low | 1 | `llm.ts:300-301` | `readTruncated` runs for any provider with `stopReason === "max_tokens"`. For Anthropic `rawText` is undefined, so a complete reply with trailing whitespace now passes there too. `AGENT_INTERFACE.md:48-49` says only that "the Anthropic schema is unchanged". `openai.test.ts:305` is still named "never uses a truncated plan". | An undisclosed behaviour change on the Anthropic path. It is benign (the JSON is complete), but the docs and test name overstate. | Either limit it to OpenAI or document that it applies to both providers. Rename the test and add an Anthropic case. |
| 7 | Low | 1 | `openai.ts:93-97,118` | `isActionObject` matches only when `JSON.stringify(type.enum) === JSON.stringify(actionTypes)`. Any reorder or subset in `replySchema` makes the split silently do nothing, which brings back the `ticks` failure. Tests cover only `replySchema()` with the defaults (batch 4, history). They do not cover `maxBatch=1` (`properties.action`) or `memory="none"`. | A silent regression path. | Throw if no action object was replaced. Add tests for `replySchema(1)` and `replySchema(4,"none")`. |
| 8 | Low | 3 | `worldEvents.ts:53` | "The dry hedge … burned away." The client hides the shrubs only (`HedgeMazeView.ts:222`; no burn visual found by grep). The audit (finding 4) asked for "an object … is no longer drawn" with no cause. | A slight cause attribution, though the as-drawn label already says "FIREBALL · dry hedge". It leaks no puzzle state. | Consider "The dry hedge at (19, 34) disappeared." or keep it with an explicit owner decision. |
| 9 | Info | 1 | `harness.ts:99-100,126` | The `recoveredReplies` metric is documented as "recovered from extra text around one envelope". It now also counts trailing-whitespace max_tokens replies. | The metric's meaning changes between runs before and after this commit. | Split it into a separate counter or update the doc comment. |
| 10 | Info | 2 | `perception.ts:630,638`; prompt `llm.ts:226` | J "recovering"/"ready" is reported although the HUD draws no J indicator. This is audit finding 1, accepted and not new. The new prompt now tells the model to read it. | It comes from a cooldown the HUD does not draw. A human can infer it from the missing animation. | Owner awareness only. Already disclosed by the audit. |
| 11 | Info | 4 | `live.ts:416-428` vs `436-441` | The credential scan runs before `recorder.stop()`, so the final `recording.webm` and the later `recording.json` writes are never scanned. Probably pre-existing ordering. | The risk is low: the browser never holds the key. | Note it in `LIVE_RUN.md`, or scan again after the recording finalizes. |
| 12 | Info | 1 | `MODEL_BUDGET.md:99` | "the lower cap reduces it by … $0.0011" ignores that the split schema makes the serialized request (and so the input reservation, `openai.ts:207-212`) larger. | A small overstatement in the cost note. | Recompute it from `worstCaseUsd` on the current request. |

### Checked, no issue

**Area 1 (OpenAI schema and parsing)**
- The root stays an object. The split replaces only `actions.items` or `properties.action`.
- After `openaiSchema`, every branch is `type:object`, `additionalProperties:false`, with all keys required and optional fields `anyOf [x, null]`.
- Field schemas are copied unchanged.
- `actionFields` matches `legalActions` (`actions.ts:89-133`): move, wait, attack, defend, ability, interact, use_item, choose_dialogue and message all agree, including which fields are optional. A test checks this against real `legal_actions` samples.
- `validate()` is unchanged in meaning, and an attack with `ticks` is still refused.
- `normalize` only deletes nulls from the six listed fields.
- `readTruncated` accepts only when `JSON.parse(raw)` succeeds and trailing blanks exist. A root object that parses must have closed, so nothing incomplete is accepted and nothing is repaired.
- `MAX_OUTPUT` is used for both the request (`openai.ts:192`) and the reservation (`:212`), so budget reservations stay consistent. The Anthropic gateway is unchanged (`MAX_OUTPUT = 4000`).
- The "Playing efficiently" text has no coordinates, puzzle words or new action types. The 0.45 s and 0.6 s timings it points to are in the manual (lines 96 and 121).

**Area 2 (attack feedback)**
- A strike always writes `p.combat` with `seq = serverTick` and sets `cooldowns.attack` to 0.45 or 0.6, after the per-tick decrement (`GameRoom.ts:1026-1037,1102-1109`). The `> 0` check therefore holds on the strike tick, slow time included.
- Black Hole writes `combat` but not `attack`. It cannot fire from attack frames, which contain no `blackHoleHeld`.
- Scheduled casts need `movementQueue`, which agent inputs do not create.
- Sieg's delayed sword contact does not affect the swing report.
- `recovering` is taken when the action starts, which matches the hero's observation.
- The line has no time, hit or damage. It goes only to the acting hero's `r.feedback`, memory and `StepResult` (`environment.ts:545-553`). A test checks that the partner does not get it.

**Area 3 (world events)**
- Events are checked per tick against the post-tick camera with `onScreen`, which is the same `inRect(…, VIEW_PAD)` as `perceive:417`. A grid test checks they agree.
- They fire only for heroes in `HEDGE_MAZE`.
- `parked` is not read (the snapshot holds only `burned` and the cow's x, y).
- A burn that happened off-screen is never reported later. The cow is folded into one line per action.
- Events are pure functions of state, so deterministic. `lastWorld` is set at reset, before and after the prefix, and after instant actions. Event lines are noted only in the acting hero's memory.

**Area 4 (shutdown)**
- The `finally` block (`live.ts:405-430`) is synchronous: no signal handler can run between `phase="finished"` and the live.json write, ledger close and scan. The new code therefore opens no new early-exit window before trace, summary or ledger settlement.
- `recorder.stop` bounds `waitFinished` (timeout + 5 s), the hold (abortable) and `close` (120 s or 60 s).
- `Promise.race` keeps a late rejection from becoming unhandled. Deadline timers are cleared, and `bounded` clears its timer.
- `.recording-tmp` is kept only on a close timeout, and the status is then `failed` with path null.
- The exit handler marks the recording `failed` only when `recordingFinal` is false. Lines 440-441 run with no gap after `await stop()`.
- The chunked byte scan carries `needle.length - 1` bytes across chunk boundaries. It is equivalent to the old UTF-8 string `includes` for an ASCII key, or stricter.

### Checklist

| # | Item | Checked? | Result |
| --- | --- | --- | --- |
| 1 | Game-rule consistency | Yes | No server, shared or client change. Attack detection reads the engine's outcome. |
| 2 | Legal actions | Yes | The action set and `validate` are unchanged. The schema is provider-side only. |
| 3 | Observations | Yes | Per-tick camera rule. No hidden flags. Pre-existing J "recovering" noted (#10). Wording nit (#8). |
| 4 | Solution leakage | Yes | Prompt and schema contain no scenario content. |
| 5 | Separate reasoning | Yes | Event and attack lines are per hero. Shared lines are only the existing backpack and journal changes. |
| 6 | Fairness | Partly | Feedback comes from the environment for every policy. Baseline-unchanged claim not verifiable. |
| 7 | Engine-owned outcomes | Yes | `performed`/`none` comes from `combat.seq` and the cooldown. No agent-reported outcomes. |
| 8 | Deterministic evaluation | Partly | Events are pure. Signal-handling robustness unverified (#1). |
| 9 | Tests and CI | Partly | Good unit coverage. Launcher only grep-tested (#3). Gaps in #4, #6 and #7. |
| 10 | Project invariants | Yes | Server stays authoritative. No asset or rendering change. |

### Missing test coverage

- `s2Shutdown.test.ts` or a new subprocess test: SIGINT during a running mock episode → exit 130, `live.json` and terminal trace line present, scratch ledger settled. A double SIGHUP and a second SIGINT while the video finalizes → `recording.json` `failed`.
- `s2Adapter.test.ts`: `splitActionTypes(replySchema(1))` and `replySchema(4,"none")` produce per-type variants. An unmatched schema throws, or the test pins the fallback.
- `s2Adapter.test.ts`: `readTruncated` on complete JSON with trailing blanks but an invalid envelope → returns `parseReply`'s reason.
- `openai.test.ts` or `reliability.test.ts`: an Anthropic stub with `stop_reason:"max_tokens"` and complete JSON plus trailing blanks → the behaviour you intend.
- `s2Feedback.test.ts`: an attack interrupted on its first tick (damage), and Heavy Break if it is reachable → the attack report is correct.

### Uncertainty

- Whether `npm run eval:live` (npm/tsx) delivers one Ctrl-C twice to node, and whether zsh plus the kernel deliver SIGHUP twice. A real subprocess run would settle both.
- Whether `VIEW_PAD = 8` equals the previous literal in `perceive`, and whether Anthropic truncated replies were refused before. `git show 3f22c66 -- packages/agent/src/perception.ts packages/agent/src/policies/llm.ts` would settle both.
- Whether Playwright kills the Chromium child on `process.exit` after a force-exit.

**Verdict:** I found no blocker for a short, capped S2 OpenAI pilot. The closest is finding 1, which affects the evidence an interrupted run keeps, not spending, because the ledger fails closed. I have not run any tests, so this is not an approval.
