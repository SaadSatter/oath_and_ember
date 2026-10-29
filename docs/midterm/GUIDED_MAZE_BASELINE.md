# Instruction-guided Hedge Maze baseline — 2026-10-29

Implementation: `3b7115b`, based on `346cdd4`, branch `midterm/evaluation`. Owner-approved implementation only; **no paid run is authorized or executed by this work**. Current suite revision 2 **S2-local is Hedge Maze**. Older pre-revision-2 S2-local records refer to Mirror Pond and are not this scenario.

## Treatment and isolation

`--player model-guided` is a new opt-in treatment, restricted to current S2-local tuning seeds 0/1. It intentionally receives a complete source-verified solution. Report its results separately from unaided `model-history`: their knowledge is not equal. A successful scripted route does not establish that an LLM follows the guide successfully.

The runtime [policy](../../packages/agent/src/policies/guidedMaze.ts) composes the existing LLM player without editing `llm.ts`, its parser, history or notes. It does not implement the separate persistent-memory work. Each hero retains the existing rolling history/400-character notes and its own model/meter; the permanent solution instructions are in every system request, independently of those notes. They are static, not checkpoint progress computed by code.

`GuidedGateway` appends exactly the same role-specific system text in both `worstCaseUsd` and `complete`, **inside** the existing `MeteredGateway`. Thus authorization reserves for the full guide before transport. Provider SDK/API behavior, schema, cancellations, timeouts, unknown usage accounting and persistent ledger are unchanged. A stubbed-fetch test proves that the actual OpenAI adapter cannot dispatch through this wrapper without persistent authorization.

`model-history` and `model-obs-only` never receive the guide. Their captured system prompts remain byte-identical to the pre-existing system/manual/tutorial/briefing construction. No observation, legal action, action validation, game rule, checkpoint, scenario or baseline pin was edited. The distinct player kind appears in manifests, summaries, output names and ledger run keys; policy and call labels carry the walkthrough ID **975e5580671c** (`hedge-maze-walkthrough-v1`).

## Walkthrough and checkpoints

Full persistent role instructions, turning points and expected observations: [guidedMazeInstructions.ts](../../packages/agent/src/policies/guidedMazeInstructions.ts). Provenance: the Maze-only `hedgeMaze` function in `route/fullQuest.ts`, `shared/hedgeMaze.ts`, `server/hedgeMaze.ts` and ordinary inventory validation. No held-out state or outcome was inspected or constructed for this task.

| Stage | Instructions and observable completion |
| --- | --- |
| A Arrival | Sieg starts at (4,34), Coco (5.56,34), tiles. Read the normal arrival dialogue; Sieg advances shared lines and Coco avoids duplicate presses. |
| B Guards / hedge | Follow the entrance corridor east at y=34.5 via x=10 then 16.5, with Sieg one tile ahead. Clear visible guards. Coco fires east from (16.5,34.5); check the dry hedge near (19,34) disappears. |
| C Cow | Coco walks via (20.5,34.5) to (20.5,25.5) and casts Black Hole east. Sieg waits back near (17.5,34.5), out of the cow's path. Advance simulated time and verify the actual 4x4 cow moves west toward x=23.8; its caption remains stationary. No Push or E at captions. |
| D North | Both use the south detour (20.5,27.5), (21.5,27.5), (21.5,30.5), (27.5,30.5). Coco stages via (27.5,19.5) to (32.5,19.5). Sieg follows (27.5,15.5), (11.5,15.5), (11.5,7.5), (19.5,7.5) into the northern loop. |
| E Wolf / key | Sieg requests Slow Time once positioned; Coco casts it, Sieg activates Super Speed. Sieg tracks the currently visible moving wolf in short moves and presses E when the nearby target offers the wolf. Search top/lower connected lanes if needed, re-coordinate after cooldowns. Confirm Hedge Gate Key in shared inventory; never claim success from attempting E. |
| F Gate | Sieg approaches (39.5,14.5) from the top or row-12.5 lane, using the route appropriate to his actual catch position. E uses the shared key. Check gate open and key consumed; notify Coco. |
| G Chest | Coco approaches via (33.5,18.5), (39.5,18.5), (39.5,15.8), waits for opening, then follows (39.5,15.5), (44.5,15.5), (44.5,6.5). E opens the nearby Shears Chest with no item offering. Confirm Enchanted Shears in shared inventory; stop there. |

The west/east northern-loop connectors (x=11.5 and x=39.5 between rows 4.5 and 12.5) are explicit and verified against the authored floor. The model must choose every actual direction, tick count, attack, ability, message and interaction. There is no runtime scripted action queue, navigation solver, live checkpoint detector, World read, teleport or state mutation. The guide tells agents to verify current observations, keep their checkpoint/next turning point in their own notes, communicate significant changes, and recover from block/death rather than trusting an old report. Flight is not needed for this solution.

## Offline verification

Node **v24.19.0**:

- `guidedMaze.test.ts`: initially 8/8 in isolation; final canonical file **9/9**, including the paid-authorization regression.
- Selected shared provider/budget/ledger/parser/action/Maze observation/server regressions: **12 files, 187/187**. This initial run included the earlier 8 guided tests. Separate existing `harness.test.ts`: **13/13**. With the final additional guided test, **201 distinct permitted cases** passed; duplicate executions are not counted twice.
- `npm run typecheck`: pass, repeated after the final test addition.
- `npm run build`: pass; existing large-client-bundle warning.
- Captured prompts prove opt-in-only instructions, role specificity on every call, independent empty initial notes, unchanged ordinary policy prompts, and byte-identical observations in user context. `decide` itself changes no world state.
- A fake model asking Sieg to use Flight is rejected by ordinary role validation. The run writes a normal hash-chained trace/manifest and settles its persistent scratch ledger.
- Insufficient full-prompt budget refuses before transport; unknown usage charges the full guided reservation; unbound actual-provider dispatch fails before the stubbed network function is called.
- **Maze-only engineering proof**, seeds 0/1: existing scripted route through the five operations reaches Shears. Test intercepts completion to stop before its return-to-shrine leg. It checks burned hedge, moved cow, caught wolf, consumed key, open gate and Shears, and verifies the guide's role turning-point sequences match the proven route. No fixture position, HP, item or reward injection. This is not a guided LLM trial.
- Existing frozen pins are byte-unchanged; no re-pin or held-out freeze/full-quest test was run. No existing scenario definition changed.

Selected command:

```sh
npx vitest run packages/agent/test/guidedMaze.test.ts   packages/agent/test/budget.test.ts packages/agent/test/ledger.test.ts   packages/agent/test/ledgerCanonical.test.ts packages/agent/test/ledgerRecovery.test.ts   packages/agent/test/modelPlayers.test.ts packages/agent/test/openai.test.ts   packages/agent/test/reliability.test.ts packages/agent/test/batch.test.ts   packages/agent/test/paidSafety.test.ts packages/agent/test/pilot9Fixes.test.ts   apps/server/test/hedgeMaze.test.ts --maxWorkers=2
npx vitest run packages/agent/test/harness.test.ts --maxWorkers=2
```

No full suite, S4/F, final-seed reset, paid API call, push or merge. Other-session prompt-capture helper/scratch files were preserved and excluded from commits. Both isolated and canonical new tests passed; the canonical source also passed the selected regressions/typecheck/build. The first audit-report write permission review timed out; its single simpler copy retry was approved, before code implementation.

## Proposed first paid pilot — requires owner approval

From the canonical evaluation worktree using Node 24.19.0, after other sessions stop and the tree is clean:

```sh
npm run eval:live -- --scenario S2-local --seed 0   --player model-guided --gateway openai --model gpt-6-luna   --effort medium --max-spend-usd 0.10 --paid
```

This is a proposed command, **not executed here**. Load `OPENAI_API_KEY` securely or use the launcher's hidden prompt; never put a key in the command or evidence. Existing video recording remains on by default. The launcher records policy/provider metadata, observations/actions, notes in model replies, messages, state hashes, milestones, usage and spend.

Cost constraints: explicit **$0.10 for both heroes together**, within the existing **$1.25 S2-local episode ceiling**, **$8 pilot-stage allocation** and **$25 shared global hard cap**. Existing 30-second call timeout and OpenAI 2,000-output-token cap (thinking included), verified model allowlist and unknown/cancelled-call conservative charging remain unchanged. No retry or budget increase is authorized by this report.

Offline full-request pricing on initial seed-0 observations: Sieg system 33,365 bytes, user 4,196 bytes, worst-case hold **$0.00731885**; Coco system 33,113 bytes, user 4,266 bytes, hold **$0.00729575**. Combined initial holds **$0.0146146**. Role-guide additions are 6,623 and 6,371 bytes. These are conservative byte-bound reservations including schema/framing, maximum output, cache writes, applicable tier and the existing 10% processing-premium allowance. They are not predicted invoice charges. Later history changes reservation sizes; the run may stop below $0.10 when another worst-case call no longer fits. The $0.10 exploratory cap is not a claim that the complete route can be finished within it.

Pricing source checked read-only: [official GPT-6 Luna documentation](https://developers.openai.com/api/docs/models/gpt-6-luna). Actual usage/cost, following accuracy, completion and video are unverified until a separately authorized live pilot. No model substitution, dynamic memory extension or automatic recovery policy was added.

## Evidence

[Preflight audit](agent-evidence/skill-runs/2026-10-29-guided-maze-preflight.md), [implementation checkpoint](agent-evidence/skill-runs/2026-10-29-guided-maze-checkpoint.md), and [S41 same-session supplement](../agent-sessions/41-codex-guided-maze-supplement.md). These are not independent reviews. Final owned implementation/evidence scan: 17 text files / zero findings (earlier evidence-only scan: 9 files / zero findings). Broad session/midterm scan: 97 text files / one pre-existing synthetic-canary finding at `2026-10-27-recording.md:18`. Its fingerprint matches the committed proof (`e542de075a382bf5a94ce50aebcacf3446cd9e4f69e6735cce0a12921863ed37`); matched text was not printed. Historical evidence and scanner rules are unchanged; no global suppression.
