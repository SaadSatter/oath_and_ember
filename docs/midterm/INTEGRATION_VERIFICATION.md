# Combined evaluation integration verification — 2026-10-28

**Result: permitted offline integration passes.** Verified `midterm/evaluation` at `e1829af`; the four provisionally approved commits `115c542`, `17487d1`, `3c893f3`, `e1829af` are ancestors. Working tree was clean at the start. The sole test correction is committed separately as `c35f6c5`. No implementation, checkpoint, gameplay, audio or historical result was changed by this verification.

## Checks and counts

Node **v24.19.0**, from the configured cached runtime. All checks ran in the canonical evaluation worktree on the combined source, rather than the earlier isolated pre-observation snapshot.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run build` | Pass; existing Vite >500 kB chunk warning |
| Complete permitted offline suite, command below | **104 files / 916 tests passed**, 148.58 s |
| Safe static `suite.test.ts` checks after correction | **2 passed / 2 skipped**, 673 ms |
| Historical S1–S3 freeze checks | **6 passed / 1 whole-quest case skipped**, 91.27 s; existing actions/state hashes unchanged |
| Local-start tests, included in the 916 | **14 passed**, tuning seeds 0 and 1 |
| S2 briefing tests, included in the 916 | **10 passed**, existing approved text and original-scenario uniqueness assertion |
| Additional disposable cross-scenario observation probe | **20 cases passed** across both local scenarios |
| Disposable mocked accounting probe | **4 runs passed**, 8 mock calls, $0.008 synthetic settlement; no actual spend |

Broad command:

```sh
npm test -- --exclude packages/agent/test/suite.test.ts   --exclude packages/agent/test/route/fullQuest.test.ts   --exclude packages/agent/test/route/checkpointFreeze.test.ts   --exclude packages/agent/test/scriptedFreeze.test.ts   --exclude packages/agent/test/finalAccess.test.ts --maxWorkers=4
```

These five files can construct or play held-out starts, so an unfiltered `npm test` is deliberately **not** claimed. The safe additions were:

```sh
npx vitest run packages/agent/test/suite.test.ts   --testNamePattern 'declares S1-S3|reaches start states only through the interface' --maxWorkers=1
npx vitest run packages/agent/test/scriptedFreeze.test.ts   --testNamePattern 'baseline on S[123], seed 0' --maxWorkers=2
```

Total selected Vitest checks after correction: **924 passing tests**, with three cases explicitly skipped in the two selected files; three other held-out-capable files were not launched. This total includes the local-start, briefing and observation-regression tests; they are not counted twice. All eligible files outside the five exclusions ran. No S4/F episode, held-out start reconstruction, final seed or further local variant was run by this session.

## Two reported suite failures

1. The registry assertion still enumerated five IDs. The safe static selection reproduced the failure (one pass, one failure, two skips). `c35f6c5` adds S2-local and S3-local as tuning cases and retains the original order/held-out flags.
2. The mixed reset test assumed every start was Goddess Shrine, and that only three distinct hashes existed. The correction recognizes Mirror Pond and Hedge Maze starts, includes their existing journal-stage expectation, and expects five distinct hashes across the full registry. Its held-out-capable loop was **not executed**. The 14 permitted local tests and the four-run probe verify the relevant tuning reset behavior directly; held-out assertions remain unverified under this restriction.

The S2 briefing test already says “S2 only among the original scenarios” and matches the second-revision text exactly, including the Vanity Mirror-only goal and permission to use other areas' RETURN exits. Neither briefing nor prompt was edited. New local briefings allow normal travel and do not inherit S2's separate travel-inclusive restriction.

## Local state and observation integration

The 14 existing local tests pass on the combined source: normal scripted checkpoint/opening/travel, immediate stop at entry, pristine puzzle/enemy state, objective items absent, original parent predicates and limits by identity, both heroes' spawn positions, unchanged HP/world/cooldowns/absolute ticks, initial success false, cleared memories/messages/feedback/counters, no pending actions, unread arrival dialogue, provider-independent starts, normal return/cross-area travel, and trace timing/integrity.

Seed 0 remains:

| Variant | Area | Absolute start tick | Start hash |
| --- | --- | --- | --- |
| S2-local | Mirror Pond | 387 | `3038943b1b0363edeae0b54424e3d4d689cc692823a2a048c24035b4cdce821a` |
| S3-local | Hedge Maze | 405 | `2b9eddd41bdd6a25457eb66d7d5b3dde66047b2d9103b4be334b378497c8b53e` |

The supplemental offline probe (`/tmp/oath-integration-probe.mts`) tests each local environment after its normal reset. Both heroes' one-tick moves are full and unblocked with and without Slow Time. Visible partner coordinates at two rounding boundaries stay truncated in their drawn cell. Labelled test-only fixtures cause one real `GameRoom.damage` lethal hit during each hero's move and wait; each reports the neutral defeat line once, restores full health, keeps that line private to the affected hero, and counts the respawn tick as game-moved rather than walking/collision. These fixtures are not scenario preparation or evaluated player results.

Initial scratch-probe errors were harness assumptions: a `.ts` file outside the ESM package needed `.mts`; overlapping partner/self cells correctly draw `@`, so the coordinate fixture was moved to a distinct visible cell; the accounting fixture initially omitted the required manual. Only scratch scripts were corrected. No implementation failure or behavioral change was found.

## IDs, budgets and history isolation

The additional accounting probe (`/tmp/oath-integration-accounting.mts`) uses one temporary ledger and separate scratch outputs for S2, S3, S2-local and S3-local. Each run aborts after two wait actions selected by a mock gateway, not a provider API. It verifies repeated reset hashes, exact scenario ID in `run.json`/summary, `<scenario>-seed0` trace directory, hash-chain integrity, unique ledger run key and reservation ID, inherited $1.25 episode cap, and settled cost equal to recorded usage. Four settled reservations each charge $0.002 in **synthetic test money**. The canonical ledger is never opened or mutated by these probes. Existing ledger, provider, interruption and fail-closed regressions are included in the 916 passing tests.

Local results remain distinct from travel-inclusive S2/S3 and must not be pooled as directly comparable trials. Historical definitions, pinned fingerprints, checkpoints, recorded traces and evaluation outcomes are preserved.

## Audit, evidence and limits

Pre-correction [game-rules-audit](agent-evidence/skill-runs/2026-10-28-suite-combined-integration.md) found only the stale expectations and the need for held-out-safe test selection; it is a same-session audit, not independent review. The `oath-rule-information-boundary` skill was also read and applied to this combined verification; the same source boundaries and live-video limitation apply. Session evidence: [S38 supplement](../agent-sessions/38-codex-local-starts-supplement.md), same session `01a17e49-e8f5-7150-8932-837cfe871fe3` as its earlier records.

Final owned-file scan: 9 text files / zero findings. Required broad documentation scan: 86 text files / one historical finding at `2026-10-27-recording.md:18`. Its SHA256 matches the committed synthetic-canary proof (`e542de075a382bf5a94ce50aebcacf3446cd9e4f69e6735cce0a12921863ed37`); the matched value was never printed. The old file, findings and scanner rules are preserved; the broad scan is not misreported as zero findings.

Remaining limits: no real local-start provider response or video has been verified; held-out cases intentionally remain unexecuted; existing large-client-bundle warning persists. Defeat notification intentionally does not interrupt an otherwise ongoing action, as approved; tests verify reporting, not a new interruption policy. Normal paid-launch preflight and explicit owner authorization are still required before any pilot. No paid call, push or merge was performed.
