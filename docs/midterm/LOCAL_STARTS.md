# S2-local and S3-local: additive tuning starts

Owner approval: implement these two variants only (2026-10-28). Implementation: `115c542`, based on `fb844ae`, on `midterm/evaluation`. Preflight: [game-rules-audit](agent-evidence/skill-runs/2026-10-28-suite-local-starts-preflight.md). This is an implementer audit, not independent review.

## Protocol

Both variants reset through the existing goddess checkpoint and existing opening prefix, then walk and interact through the five-operation environment. Preparation ends immediately on the ordinary party transition. No arrival reader or local puzzle action follows it. Existing environment reset clears agent memory, messages, feedback, decisions and measured episode time; it preserves the resulting authoritative world and absolute tick. No new checkpoint, gameplay change, item grant, private observation field or travel restriction is introduced.

| ID | Entrance | Success predicate and limits | Seed 0 absolute tick | Seed 0 start hash |
| --- | --- | --- | --- | --- |
| S2-local | Mirror Pond, normal role-specific pond spawns | Same function and limits as S2: Vanity Mirror held | 387 | `3038943b1b0363edeae0b54424e3d4d689cc692823a2a048c24035b4cdce821a` |
| S3-local | Hedge Maze, Sieg (128,1088), Coco (178,1088) pixels | Same function and limits as S3: Enchanted Shears held | 405 | `2b9eddd41bdd6a25457eb66d7d5b3dde66047b2d9103b4be334b378497c8b53e` |

These are separate scenarios, with their own manifest IDs, hashes and `<ID>-seed<seed>` output paths. Report their results separately from travel-inclusive S2/S3; do not pool or directly compare them. Existing scenario definitions, route constants, frozen checkpoints, expected historical hashes and historical traces were not edited. The local briefings disclose only the approved start/objective and ordinary travel availability. Both providers receive the same prepared state through existing independent observations. Each local variant retains its parent's $1.25 episode cap and existing shared-ledger authorization. No paid execution is authorized by this implementation.

The live launcher recognizes the two new IDs, case-insensitively. Its recorder, paid guards, model allowlists and ledger behavior are unchanged. No new recording or paid-model result is claimed.

## Offline verification

Node v24.19.0. Because another owner-confirmed session is actively editing the canonical worktree, verification uses a disposable archive of `fb844ae` plus exactly the eight implementation files in `115c542`, with existing dependencies. It excludes the other session's environment/perception/navigation/movement changes. Typecheck also passed in the shared tree earlier; final isolation prevents concurrent edits from contaminating the result.

- `localStarts.test.ts`: 14/14 passed. Seeds 0 and 1: repeated reset equality, full authoritative ordinary-prefix equivalence, both heroes' positions, pristine puzzles/enemies, objectives absent, predicates false, fresh memories/messages/counters, no post-transition actions or pending actions. Normal return and cross-area travel pass. Provider-labelled mock gateways verify identical initial observations/start hashes, fresh policy context, isolated manifests and hash-chained traces. No provider request is sent.
- Historical `scriptedFreeze.test.ts`, selected by `--testNamePattern 'baseline on S[123], seed 0'`: 6 passed, 1 whole-quest case skipped. The six expected action/state hashes were not changed.
- `npm run typecheck`: passed in isolation.
- `npm run build`: passed in isolation; existing Vite chunk-size warning remains.
- Permitted agent regression suite: 23 files passed; 337/338 assertions passed, with one obsolete S2-only briefing assertion failing because the approved local briefings now exist. That assertion was scoped to the original scenarios in the implementation commit. Targeted rerun of the corrected file plus localStarts: 2 files, 24/24 passed (1.79 s). No production source changed after the broader run.
- Secret scanning: all task-owned implementation/evidence files pass with zero findings (17 task-owned text files scanned). The required broad documentation scan reports 84 files / one existing historical finding at `2026-10-27-recording.md:18`. Its SHA256 exactly matches the committed synthetic-canary proof (`e542de075a382bf5a94ce50aebcacf3446cd9e4f69e6735cce0a12921863ed37`). The old report and scanner were preserved; no global suppression. The broad scan is therefore not claimed as zero findings.

Broad agent testing excludes `suite.test.ts`, `route/fullQuest.test.ts`, `route/checkpointFreeze.test.ts`, `scriptedFreeze.test.ts`, and `finalAccess.test.ts`. These can execute or reconstruct held-out starts. Only the six permitted historical freeze cases are run separately. No held-out start, episode or test was executed by this session.

Initial tests exposed test assumptions: summary prefixes are strings; the runtime maze return point is assigned from its spawn; arrival dialogue interrupts waits before the cooldown has elapsed. Assertions and normal-action waits were corrected. No gameplay or observation fix was made. A duplicate broad validation process was stopped after CPU contention caused a default-timeout failure in the parent-hash test; it is not counted as a passing run.

## Scope and remaining risks

No real API call, canonical ledger initialization/mutation, gameplay edit, historical result edit, held-out reconstruction, push or merge. Test ledgers/output were disposable scratch fixtures. Other-session edits remain unstaged and uncommitted by this session. The canonical worktree therefore cannot be represented as clean or ready for a paid run. Integration with the other session's final commit needs a subsequent permitted verification. Live video and actual provider behavior on these variants remain unverified. Owner approval is required before any paid execution or further variant.

## Read-only implementation checkpoint

`oath-rule-information-boundary` applied to commit `115c542`, session `01a17e49-e8f5-7150-8932-837cfe871fe3`; skill SHA256 `553399eafd554c3b9062efa8b9d1fd9080c99bfadb151cb817ea40b77437fb21`. No new blocking finding in this scoped diff. `route/localStarts.ts` uses only normal environment actions; `suite.ts` adds objective/start briefings without solution or hidden-state fields. Raw state appears only in trusted test assertions. Existing validation, independent policy histories, tick owner and video/ledger dispatch paths are unchanged; mock traces retain absolute reset ticks and relative outcome timing. The six historical action/state fingerprints pass. Limitations: live video/provider behavior unverified, other-session edits excluded, no independent review claimed. These checks do not approve paid execution.
