# rules-reviewer: Situation C round 2 (commit bd717ee)

| Field | Value |
| --- | --- |
| Date | 2026-11-06 |
| Reviewer | `.claude/agents/rules-reviewer.md` subagent (read-only: Read, Grep, Glob), launched in a separate invocation by implementation session e7c32221 at the owner's request; not instructed to approve. Interrupted once by a usage limit and resumed with the same scope. |
| Reviewed | `midterm/evaluation` at `bd717ee`: the owner's final briefing, updated hashes, proposed r10, pins, descriptive metrics, session record 51 |
| Note | The report below is the reviewer's output, copied verbatim. The implementation agent's responses are in docs/midterm/SITUATION_C_PREPARED.md, "Review round 2". |

---

## rules-reviewer report: Situation C (griffin-prepared-return-v1), review round 2, `midterm/evaluation` at `bd717ee`

**Reviewed:** The files at HEAD, read in full or in the relevant sections:
- `packages/agent/src/suite.ts` (140–270)
- `packages/agent/src/evaluator.ts` (all)
- `packages/agent/src/environment.ts` (260–895)
- `packages/agent/src/harness.ts` (240–370, 560–605)
- `packages/agent/src/griffinSituationC.ts`
- `packages/agent/src/policies/situationGuidance.ts`
- `packages/agent/src/policies/centralized.ts` (75–130, 380–400, 589–628)
- `packages/agent/test/griffinSituationC.test.ts`, `test/bPostCombinedV4Guidance.test.ts`, `test/bPostTransferGuidance.test.ts` (40–85), `test/helpers/pinnedRunPath.ts`
- `scripts/midterm/situation-c.ts`
- `apps/server/src/griffin.ts`, and `griffinState` / `shrineComplete` in `packages/shared`
- Docs: `docs/midterm/SITUATION_C_PREPARED.md`, `evaluation-abc/C-prepared-return-definition.json`, `evaluation-abc/proposed/declaration-r10-c.json`, `evaluation-abc/declaration.json` (r9), `evidence/situation-c-preparation-r2/summary.json`, and the r2 mock summaries (grep)
- `docs/agent-sessions/51-claude-situation-c-prepared.md` and the round-1 review

Searches:
- Route words ("prepared", mirror, shears, nest, groom, peaceful, griffin, wig) in `playerKnowledge.ts`, `llm.ts`, `centralized.ts`, `perception.ts`, `actions.ts` and `manual/`.
- Which manual file the launchers load: only `manual/Oath_and_Ember_Player_Manual.md`.
- I compared the briefing with the owner's round-2 message, using a read-only grep of the local session transcript `~/.claude/projects/-Users-saadsatter-Classes-AI-Pract-Building-Games-oath-and-ember-eval/e7c32221-ecc0-4016-9d40-3ad825cfc7ee.jsonl`, line 1201.

**Not reviewed or unverifiable:**
- I could not run anything: no typecheck, vitest, build, `situation-c.ts` or replay. Every hash below is checked for agreement between files, not recomputed. That includes r10's `declarationSha256` (97525b3e…), the definition hash fbc5a96a…, both prompt hashes and the code hash 048679a3….
- I had no git access. So I could not get the round-2 diff (`f3b718d`) or confirm these:
  - that r9 `declaration.json` is byte-unchanged;
  - that `perception.ts`, `actions.ts`, `centralized.ts`, `llm.ts` and `griffinHeuristic.ts` are byte-unchanged. I rely on the pin tests that would check this, which I could not run;
  - that `cc92bda` and `bd717ee` touched only docs and evidence.
- `.git/worktrees/oath_and_ember-eval/rules-review.diff` exists but is stale (an earlier v3/v4 guidance diff), so I did not use it.

### Summary

1. **Briefing.** `GRIFFIN_PREPARED_RETURN_BRIEFING` (`suite.ts:193-194`) matches the owner's text word for word: the transcript's "Proposed text: …" equals the code string. C1 and C3 get the same briefing: same `situation(ID)` entry and same planner constructor arguments, and `griffinSituationC.test.ts:295-304` checks C3 = C1 + v4 block.
   - I found no "prepared", Mirror, Shears, nest, grooming or peaceful wording in what the model receives: briefing, tutorial, planner system prompt, user-message `evaluation_objective`, v4 text or the player manual.
   - Observations do contain ordinary game text that names the route: the item descriptions, the nest target label "Griffin nest · drop mirror + shears", the server's nest message ("Drop the vanity mirror and enchanted shears at the nest… Or defeat the guardian…") and the grooming labels. This is player-visible game content, and the doc discloses the item and nest text.
   - Ids, title, prefix name and evaluator goal contain "Prepared" or name the items. As far as I can read, none of them reaches a policy.
2. **Hashes.** They agree everywhere I could compare:
   - 6dc64411… and a0c6939a…: code, definition JSON, r10, r2 `summary.json`, mock summaries, doc.
   - 048679a3…: code test, r10, `summary.json`, mock summaries, doc.
   - fbc5a96a…: test, JSON, r10, doc.
3. **r10.** It reflects the round-2 decisions. Its A and B rows, Pilot-32 and Pilot-33 classifications and B/post-tuned/1 entry match r9 as I read it. It is marked "PROPOSED, NOT ACTIVE". There are small stale or omitted items (findings 4 and 5).
4. **Pins.** The pin tests hold `perception.ts`, `actions.ts`, `centralized.ts` and `llm.ts` byte-identical in the working tree. Test `:262` pins `griffinHeuristic.ts`. The five C-registration files are exempt from the working-tree check. In `environment.ts` the new tracking is guarded by `preset === "griffin-prepared-return-v1"` and only reads state: `griffinState` and `shrineComplete` are pure, and `stateHash` hashes `room.state`, which the tracking never writes. So it cannot change gameplay, the hash or termination. `seenMilestones.add` runs for every preset but is read only by `situationCReport`.
5. **Metrics.** They are correct for the routes I traced in `griffin.ts`, including a wig claim in the same tick as a defeat and a Mirror delivered by `use_item`. There are two semantic weaknesses (findings 1 and 2). They appear only in `summary.json`; no policy reads summaries (grep of `policies/`).
6. **Disclosure.** The combat-only C2 is disclosed in four places. The offering vs `chapter0.complete` gap is disclosed. A few wording problems remain (findings 3, 6, 7).
7. **Session record.** Accurate in substance, with minor imprecision (finding 9).

### Findings

| # | Severity | File:line | Issue | Why it matters | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| 1 | Minor | `evaluator.ts:197-198`; `SITUATION_C_PREPARED.md:112` | `itemsDeliveredWhileGriffinAlive` is true whenever the *first* `mirrorDelivered` or `shearsDelivered` occurs at HP > 0. That includes `use_item` with the Shears alone while the Griffin is alive, which has no effect (`griffin.ts:75-79,82`: grooming needs the Mirror). A run that wastes the Shears and then wins by combat would show `itemsDeliveredWhileGriffinAlive: true, wigRoute: "defeat"`. The doc calls this "the prepared-item-use marker". | A reader could count an ineffective delivery as prepared-item use. | Describe it as "a tool was delivered while the Griffin was alive (it may have had no effect)". Or record the Mirror and Shears delivery HP separately. Point readers to `peacefulGroomingOccurred` and `wigRoute` as the effective-use markers. |
| 2 | Minor (latent) | `evaluator.ts:203` | `wigRoute` is `"peaceful"` whenever `wigClaimed` is true and `griffinHpAtWigClaim` is `null`, that is, when the claim was never seen by `checkEnd`. I found no current path that does this: the claim always happens inside a tick or instant action, and `checkEnd` follows. But the fallback is wrong by construction. | If code changes so that a claim is not observed (for example a summary taken from a different environment state), the route would be mislabelled "peaceful". | Return `"unknown"` when `griffinHpAtWigClaim === null && wigClaimed`, or derive the route from `seen.has("griffin:grooming")` together with `toolsTaken`. Add a unit test. |
| 3 | Minor (doc consistency) | `SITUATION_C_PREPARED.md:60` vs `:101`, `:111`, `:168`; r10 `trajectoryNote` and `routeDisclosure` (`declaration-r10-c.json:52-53`) | Line 60 correctly says that after a defeat "the tools stay in the backpack" (`griffin.ts:80-81`, test `:255`). Lines 101, 111 and 168 and r10 say "the tools are dropped … by the post-defeat E", and the metrics then show `mirrorDelivered`/`shearsDelivered`/`itemInteractionUsed` = true for C2. | A reader of the C2 row may think C2 used or gave up the items. In fact only flags were set and nothing left the backpack. | Say: "the post-defeat E sets the delivery flags; nothing leaves the backpack and the items have no effect". |
| 4 | Minor | `declaration-r10-c.json:284` | `amendmentR10.decisions` still says "C prompt = tutorial + new C briefing (draft)". Line 289 records the owner's replacement text. | A stale "draft" label in a document meant for activation. | Edit the line, then recompute `declarationSha256`. |
| 5 | Minor | `declaration-r10-c.json:246-251` vs r9 `declaration.json:174-179` | r9's first holdout step "Complete A/B tuning and freeze all policy/manual/guidance hashes" was replaced by "Owner final authorization: activate r10 …". The explicit freeze step is gone. Also, `model.postGuidanceB.situations` (`:87-90`) still lists only the B scenarios, while the code's v4 scope now includes C. `postGuidanceC.scopeChange` records this. | It weakens the stated holdout procedure in the declaration text. A reader comparing `postGuidanceB` with the code could see a mismatch. | Keep the freeze step, for example "freeze all hashes (listed in C) → owner authorization → C1, C3, C2". Note in `postGuidanceB` that it is the r9 record. |
| 6 | Minor (disclosure) | `SITUATION_C_PREPARED.md:129-131` vs mock summaries `gitHash: "f3b718d+dirty"` | The doc presents the round-2 mock episodes as run at `f3b718d`. Their summaries record a dirty tree. The baseline and prompt summary records a clean `f3b718d`. | It is unclear what was uncommitted, plausibly only the new evidence directory. Prompt hashes match the pins, so the impact is likely nil. | Say what was dirty, or rerun the mocks from a clean checkout. |
| 7 | Note (validity) | `suite.ts:194`; `centralized.ts:83-84`; v4 step 8 (`situationGuidance.ts:103`) | The briefing ends at "Complete the offering". Success also needs the post-offering scenes to reach `chapter0.complete`. The generic task line "Complete the Goddess's quest together." covers this, and v4's step 8 ("follow the task to its end") reinforces it for C3 only. The doc (`:85`) and r10 (`consequences[4]`) disclose the gap but not this C1/C3 asymmetry. | C1 could stop after the offering where C3 would not. That is part of the guidance effect, not only "transfer". | Add one sentence to the parity limits. |
| 8 | Note | `environment.ts:511-513` | The comment "Evaluator-only progress report. Never pass this to a player." now sits above the new `situationCReport` doc block, so `evaluatorReport()` (`:518`) has lost its warning. | Cosmetic, but the warning protects an evaluator-only API. | Move the line back above `evaluatorReport`. |
| 9 | Note | `docs/agent-sessions/51-claude-situation-c-prepared.md:13,25` | The summary line lists "tutorial plus owner's neutral briefing" among the first in-session decisions. In fact round 1 used the agent's draft "(Griffin Trial, prepared)" (round-1 finding 12), and the owner's text arrived in round 2 (`:44` says this correctly). "Files edited … 5 (… `~/.claude` 1 …)" cannot be checked from the repository. | Slight time compression in a factual record. | Split it into round-1 and round-2 decisions. |
| 10 | Note (coverage) | none (absence) | No test or script checks r10's `declarationSha256` or r9's (616c1824…). So "r9 unchanged" and "r10 hash correct" are asserted only in documents. | Hash drift after an edit (finding 4) would go unnoticed. | Add a vitest that recomputes both, sorted compact `ensure_ascii` JSON without the field, and pins r9's file hash. |

No critical or major findings.

### Checklist

| # | Item | Checked? | Result |
| --- | --- | --- | --- |
| 1 | Game-rule consistency | Yes (no git diff) | No server or shared rule file is involved in round 2. The doc's mechanics (`:58-61`) match `griffin.ts`, apart from the "dropped" wording (finding 3). |
| 2 | Legal actions | Partly | `actions.ts` is pinned byte-identical by tests I could not run. The legal-action diff at the start is empty, as recorded in evidence. |
| 3 | Observations | Partly | `perception.ts` is pinned byte-identical. The new metrics are summary-only and no policy reads summaries. Observations name the tools and the nest through ordinary game text, as in B-return. |
| 4 | Solution leakage | Yes | The briefing matches the owner's text verbatim. No route words in the tutorial, the system prompt, v4 or the manual. The goal text (which names the items) is kept out of the prompt (test `:302`). Ids, title and prefix name reach only traces and summaries. |
| 5 | Separate reasoning | Partly | Unchanged in round 2. The centralized planner sees both heroes; this was already disclosed and applies equally to C1 and C3. |
| 6 | Fairness | Yes | C1 and C3 differ only by the v4 block (test). C2 is the unchanged baseline, which wins by combat (disclosed). Note finding 7. |
| 7 | Engine-owned outcomes | Yes | Success is `wigClaimed && chapter0.complete`, read from state. Knockout is checked before success. The metrics are descriptive and never feed termination. |
| 8 | Deterministic evaluation | Partly (not run) | The tracking is read-only and does not affect the hash or termination. Repeated baseline end hashes in evidence are identical; the trace hashes differ, presumably because traces contain wall-clock fields. |
| 9 | Tests and CI | Partly | Gaps: findings 1, 2, 10 and the list below. |
| 10 | Project invariants | Yes | Server authority is kept. The fixture is limited to reset. No art, service or persistence change. |

### Missing test coverage

- `griffinSituationC.test.ts`: Shears alone by `use_item` while the Griffin is alive → no grooming; the report shows `itemsDeliveredWhileGriffinAlive: true` and `peacefulGroomingOccurred: false`. This pins the semantics of finding 1.
- `griffinSituationC.test.ts`: Mirror alone by `use_item`, then the report → `griffinHpAtFirstItemDelivery > 0`, `peacefulGroomingOccurred: true`, `wigRoute: "none"`.
- `griffinSituationC.test.ts`: the defeat route on the same tick. A unit fixture sets HP 0 and Coco presses E at the nest in the same tick → `griffinHpAtWigClaim: 0`, `wigRoute: "defeat"`.
- `griffinSituationC.test.ts`: the peaceful route through the offering to `chapter0.complete` with `outcome().reason === "success"`. This was already requested in round 1 and is still missing.
- B presets: `env.situationCReport()` returns `null`, and B-return's milestone trace is unchanged.
- A declaration test that recomputes r10's and r9's `declarationSha256` (finding 10).

### Uncertainty

- Whether tests, typecheck and build pass at `bd717ee`. The round-1 caveat still applies, and the session record shows `1 failed | 1364 passed`, attributed to `s2Shutdown`. Running `npm run typecheck && npm test && npm run build` and `node --import tsx scripts/midterm/situation-c.ts` would settle it.
- Whether r9 and the B/Pilot evidence are byte-unchanged since round 1. `git diff 2374a2d..bd717ee -- docs/midterm/evaluation-abc/declaration.json docs/midterm/evidence/griffin-heuristic-v1` would settle it.
- Whether round 2 changed `progress()` for C or any B path. `git diff 4121bff..f3b718d -- packages/agent/src` would show it. The HEAD code I read is C-guarded.
- Whether the `+dirty` state of the mock runs was only the untracked evidence directory (finding 6).
- Whether r10's `declarationSha256` matches its content. I could not recompute it.
