# Model selection and budget proposal (for approval)

No paid call has been made. This proposal needs the owner's approval before any.

## Verified availability and prices (2026-10-27)

Sources, read on 2026-10-27:
- `https://platform.claude.com/docs/en/about-claude/pricing` (prices);
- `https://platform.claude.com/docs/en/about-claude/models/overview` (ids, defaults, retirement);
- `https://platform.claude.com/docs/en/build-with-claude/thinking` (billing of thinking).

These are Anthropic first-party API prices in USD per million tokens. They must be re-checked on the day of each paid run.

| Model id | Status | Input | 5-min cache write | Cache read | Output | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `claude-haiku-5-5` | current; retirement not sooner than 2027-10-07 | $0.10 | $0.125 | $0.01 | $0.50 | Prompts over 100,000 tokens pay $0.50 / $0.625 / $0.05 / $2.50. Adaptive thinking on by default, default effort `medium` |
| `claude-haiku-4-5` | legacy, still available | $1 | $1.25 | $0.10 | $5 | |
| `claude-sonnet-5-5` (comparison) | current | $2 | $2.50 | $0.10 | $10 | |

- **Thinking tokens are billed as output tokens**, even when the thinking text is not returned, and they count toward `max_tokens`. Haiku 5.5 thinks by default, so output per call is much larger than the reply alone.
- `packages/agent/src/policies/llm.ts` now holds these verified prices, the cache multipliers and Haiku 5.5's over-100K-token tier (tested in `budget.test.ts`). Our prompts are about 5K tokens, far below that tier.

**Recommendation: `claude-haiku-5-5`.** It is the current Haiku and about 10× cheaper than Haiku 4.5 on this workload. Whether to run it at the default effort (`medium`) or at `low` is an open choice: see "Decisions".

## Cost per call (Haiku 5.5)

From the scripted route's measurements (`ROUTE_LOG.md`):
- about 1,400 uncached input tokens (observation, legal actions, notes, last turn);
- about 3,400 cached input tokens (instructions and manual);
- output, thinking included: about 1,000 tokens assumed as the central case, 2,000 as the high case. **The pilot must measure this.**

| | Central | High |
| --- | --- | --- |
| Per call | $0.00067 | $0.00117 |

## Cost per episode if every allowed call is used (both heroes)

| Scenario | Calls (2 heroes × cap) | Central | High |
| --- | --- | --- | --- |
| S1 | 120 | $0.08 | $0.14 |
| S2 | 800 | $0.54 | $0.94 |
| S3 | 800 | $0.54 | $0.94 |
| S4 | 600 | $0.40 | $0.70 |
| F | 2,000 | $1.35 | $2.35 |

## Staged plan and proposed caps

| Stage | What | Spend cap |
| --- | --- | --- |
| 0. Smoke | Credential pre-check, then **one** paid call through the metered gateway; check tokens, cost, the reported model id and the cache fields | $0.10 |
| 1. Pilot and tuning | S1–S3, tuning seeds 0 and 1 only; at most 4 prompt or configuration iterations; measure output and thinking tokens per call and decide the effort level; S4 and F not run | $8.00 |
| 2. Final | `model-history`: S1–S4 and F × 2 trials (seeds 100, 101), about $10.14 at the high case. `model-obs-only`, if approved: S1–S3 × 2 trials, about $4.04 | $15.00 |
| Contingency | Re-runs after a recorded infrastructure failure (counted and reported) | $1.90 |
| **Total hard cap** | | **$25.00** |

**Caps per episode** (`--max-spend-usd`, enforced centrally by the `ModelBudget`): S1 $0.20, S2 $1.25, S3 $1.25, S4 $1.00, F $3.00.

A **cumulative spend ledger** across runs is now implemented in `packages/agent/src/ledger.ts`, integrated by `harness.ts` and `scripts/midterm/evaluate.ts`. It reserves the full episode cap before dispatch, counts crash-left reservations, locks concurrent users, and refuses malformed ledgers. Nine ledger tests pass (2026-10-27); see `PHASE4_HANDOFF.md`. The configured $25 allocation remains subject to approval before paid execution; implementing this mechanism is not permission to spend.

**For comparison** (same token profile, per-call cost at the high case): Haiku 4.5 costs about $0.0117 per call (about 10× Haiku 5.5), and Sonnet 5.5 about $0.0231 (about 20×). The same plan would therefore need roughly $250 or $500 at its caps.

## Before any paid call

1. **Owner approval** of the model, the effort setting, the total cap and the stage caps.
2. **A cumulative spend ledger** (`<git common dir>/oath-eval/spend-ledger.json`, shared by every worktree and kept out of git; review H1, 2026-10-27) and the refusal rule above, with tests.
3. **The credential:** `ANTHROPIC_API_KEY` is set by the owner in the shell, and never written to the repository or to traces.
4. **Prices re-checked and dated** on the run day.

## Decisions

1. **Model:** `claude-haiku-5-5` (recommended).
2. **Effort:** `medium` (the default) or `low`. `low` thinks less, so it is cheaper and faster but possibly weaker. I recommend choosing during the pilot, on S1–S3 only, and recording it in the suite's change log before any final run.
3. **Total cap and stage caps** as above ($25).
4. **Whether to add `model-obs-only`** (S1–S3) to the suite. The rubric expects history to be compared with observation-only play for partial-observation games.

## Offline smoke readiness (2026-10-27)

Configured next smoke: `claude-haiku-5-5`, explicit `output_config.effort: medium`, `max_tokens: 4000` (thinking included), one attempted call maximum, 30 s call timeout. The smoke reserves **$0.01** from the **$0.10** smoke stage. The global cap is **$25**; the other stage caps remain pilot $8, final $15, contingency $1.90. This is configured infrastructure, not authorization to spend.

Rechecked on 2026-10-27 against [Anthropic's model overview](https://platform.claude.com/docs/en/models/haiku-5-5/overview) and [pricing](https://platform.claude.com/docs/en/about-claude/pricing): identifier, medium default effort, and the inherited Haiku 5.5 prices/cache tiers match. Short prompts: $0.10 input / $0.50 output per million tokens, $0.125 five-minute cache write and $0.01 cache read. Prompts over 100K tokens use $0.50 / $2.50, $0.625 write and $0.05 read. No provider request or credential check was performed.

Reservations now use UTF-8 byte length plus a 4,096-token framing margin, all input at the cache-write rate and maximum output at the applicable tier. The meter rejects non-finite limits/reservations; missing or malformed usage is explicitly unknown and conservatively charged. Ledger charges round upward to microdollars. Cross-process locks, crash-left reservations, concurrent hero calls and global exhaustion across restarts are covered offline.

The canonical paid CLI ledger is `<git common dir>/oath-eval/spend-ledger.json` (review H1, 2026-10-27: it was previously resolved from the shell's working directory, so each worktree could get its own $25). `evaluate.ts` and `live.ts` both open it with `SpendLedger.openCanonical`, which refuses when it is missing (it is created once by the owner with `scripts/midterm/ledger.ts init`, after an inventory) or while a legacy per-worktree ledger exists; alternate ledger CLI paths are disabled. The legacy `run-episode.ts` helper refuses model policies and points to `evaluate.ts`. Preserve the ledger across all stages and restarts. After a killed process, verify the PID recorded in its lock is dead before removing only that stale lock; retained reservations still count. `--resume` checks configuration/trace integrity, skips completed episodes without new calls, and restarts interrupted episodes in new attempt directories without erasing prior charges. Unknown reservations are never automatically reclaimed.

Re-review fixes (2026-10-27): only `claude-haiku-5-5` at `medium` or `low` can be used for paid runs (`APPROVED_MODELS`, enforced by `AnthropicGateway`); the smoke call only at `medium`. Ledger initialization writes a permanent marker, so a deleted or replaced ledger is refused and never re-created. Interrupted reservations are settled only with `scripts/midterm/ledger.ts reconcile`, from the episode's verified trace: recorded calls at their charges plus the whole hold of every call that started without a record, and the whole reservation if the trace is missing or unverifiable. See `LIVE_RUN.md`. The `oath_and_ember-agent` worktree still contains a runner that can make paid calls outside the ledger; its handling awaits the owner's decision.

The $25 bound depends on this ledger being retained and on the provider honoring the verified rates/output limit. Mock tests cannot establish account access, actual billing, cache effectiveness or live response quality. The next action requires the owner's paid-smoke approval.
