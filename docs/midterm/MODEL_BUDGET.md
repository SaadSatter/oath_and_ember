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

A **cumulative spend ledger** across runs is still to be built (see "Before any paid call"). The evaluation script would refuse to start a run whose episode cap would push recorded spend past the stage cap or the $25 total.

**For comparison** (estimated with the same token profile): the same staged plan would cost about $140 on Haiku 4.5, and about $280 on Sonnet 5.5.

## Before any paid call

1. **Owner approval** of the model, the effort setting, the total cap and the stage caps.
2. **A cumulative spend ledger** (`evaluation-runs/spend-ledger.json`, kept out of git) and the refusal rule above, with tests.
3. **The credential:** `ANTHROPIC_API_KEY` is set by the owner in the shell, and never written to the repository or to traces.
4. **Prices re-checked and dated** on the run day.

## Decisions

1. **Model:** `claude-haiku-5-5` (recommended).
2. **Effort:** `medium` (the default) or `low`. `low` thinks less, so it is cheaper and faster but possibly weaker. I recommend choosing during the pilot, on S1–S3 only, and recording it in the suite's change log before any final run.
3. **Total cap and stage caps** as above ($25).
4. **Whether to add `model-obs-only`** (S1–S3) to the suite. The rubric expects history to be compared with observation-only play for partial-observation games.
