# Showcase north-next prompt clarification and budget transfer

Owner-directed, outcome-informed tuning after Pilot-37, November 7, 2026; Codex session `01a1b479-dfba-79a0-9de7-9cca63bdc8bb`. Prompt source `4db504f`, final south-exit/budget correction `95c01c30bfe282c958e10c14c4ed9f1edd4c1aad`. No new paid call or recording. Official A/B/C definitions, traces and guidance unchanged.

## Observed problem and preserved run

[Original Pilot-37 evidence](../../midterms/saadsatter/evidence/showcase/pilot-37-original/README.md): actual paid run at `14646d3`, stopped manually at 90.2 game-s after 177 attempted calls. The model finished the maze/Shears at 65.93 s, returned to the Goddess Shrine at 78.65 s, then both heroes entered **Bridge Ruins** at tick 4994 (83.23s). The shrine south sign explicitly reads “START / RETURN · E · Puzzle Map 2”; north reads “NORTH · GRIFFIN TRAIL” in the ordinary public observation contract (`perception.ts`). The user identified the same detour. No Griffin-entry milestone occurred. This is a partial run, not a success.

Original trace/summary/run/recording metadata are preserved byte-for-byte, trace compressed losslessly. All 589 step results replay exactly to the original manual-stop end hash/tick. Original 202 MB video remains untouched/local-only and is identified by hash; no full decode or visual review of that paid video is claimed here. Ledger charge $0.450387 includes conservative unknown-usage accounting, not independently verified provider billing. Original failure/unknown fields are unchanged.

## Prompt change

After the shared backpack confirms the Shears: stop maze exploration, use the maze RETURN exit to the shrine, then find and use the visible **NORTH · GRIFFIN TRAIL** exit. Explicitly avoid the shrine’s south **START / RETURN · E · Puzzle Map 2** exit. If observations show Bridge Ruins/Puzzle Map2, use visible normal exits to return to the shrine and resume the northbound leg instead of repeating old trials. Confirm Griffin Enclosure before the combat phase. After combat defeat and Wig collection, stop enclosure exploration, return to the Goddess, offer the Wig and finish dialogue.

Only showcase guidance changes. No engine/navigation implementation, observation, legal-action list, start state, quest predicate or maze solution changed. The prior v3 free baseline/video remains valid mechanics evidence; it is not model validation of this new prompt. There is no guarantee this prompt prevents every future navigation error.

| Identity | SHA-256 |
| --- | --- |
| Definition, unchanged | `ec827f19555e5456d987f866c6f50414827f8875efd911859f351aeafe532831` |
| Revised guidance | `1bd73ba9714f78e1b4bdf23975ffff2f4ec6ff4fc4129d95a5e5394b0ccb18f2` |
| Revised full planner prompt | `89f34d173193e616c5356834aa8b29f7a97437ba2e88d75a4b1914da2663a8a6` |

Guidance `showcase-maze-griffin-v1` is proposed/no approved hash; `SHOWCASE_PAID_APPROVED=false`. Previous exact-hash authorization was consumed by Pilot-37 and does not authorize a new retry or these changed hashes. Another run needs explicit final approval for this revised prompt and one new attempt. Target episode cap/model/seed/time/call bounds remain unchanged.

## Owner-approved allocation change

The owner selected: **Move $1 from contingency: pilot cap $9, total stays $25**. New allocation: smoke $0.10, pilot $9, final $15, contingency $0.90. Canonical config migrated atomically under the existing exclusive ledger lock, with a private scratch backup; all 37 entries/charges/ledger identity preserved, no open reservation or new charge. Approved code config and existing boundary/global-cap/cross-worktree tests updated to the new allocation. Older worktrees with the former allocation fail closed on config mismatch until their approved configuration is updated; none was overwritten.

Remaining: **pilot $2.667402**, contingency $0.90, total $18.664481. A new $2 reservation fits, leaving pilot $0.667402, but none was made. Total authorization remains $25; no additional money added. [Migration proof and balances](evidence/showcase-north-next/reallocation.json).

## Checks and next step

Typecheck passes. **59/59 affected tests across six files pass**, including prompt pins, paid lock, baseline/recovery, stage boundaries, global cap, cross-process/cross-worktree exclusion and accounting/reconciliation. An old insufficient-stage fixture was adjusted from $7.9 to $8.9 prior spend to retain the same $0.10 remainder under the new cap; no protection was weakened. Same-session read-only diff check: changes confined to showcase guidance/lock, allocation constants and their existing tests. No new independent review or paid-model validation is claimed.

Source 95c01c3 has all runtime changes committed; hash-report dirty marker comes from untracked evidence pending this documentation commit. Final worktree is committed clean after evidence preservation. [Exact prompt and validation artifacts](evidence/showcase-north-next/).

Proposed command, only after new exact-hash/one-attempt owner approval and a reviewed unlock:

```sh
npm run eval:live -- --scenario showcase-maze-griffin-complete-v1 --seed 0 \
  --player model-centralized --guidance showcase-maze-griffin-v1 \
  --gateway openai --model gpt-6-luna --effort medium --max-batch 4 \
  --max-spend-usd 2.00 --wall-seconds 7200 --paid
```

No automatic retry, push, merge, course PR modification or submission. Session-evidence procedure preserves this same ongoing chat; no student-authored team-log content changed.
