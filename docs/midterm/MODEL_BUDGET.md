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

## OpenAI provider (2026-10-28, offline only)

Implemented by Codex and finished in Claude session S33. **No OpenAI or Anthropic request has been made with it.** It runs through the same `ModelBudget`, canonical shared ledger and launchers as Anthropic; it is a second gateway, not a second runner.

- **Model allowlist:** only `gpt-6-luna`, effort `low` or `medium` (`OPENAI_MODELS` in `packages/agent/src/policies/openai.ts`). `--model` is required; nothing is substituted. The OpenAI smoke call is allowed at `medium` only.
- **Request:** Responses API (`POST https://api.openai.com/v1/responses`, redirects refused, no SDK, no retries), `store: false`, `service_tier: "default"`, `max_output_tokens: 2000` (reasoning included; lowered from 4000 on 2026-10-28 with owner approval after 24 whitespace-runaway replies in the S2 seed 0 run, whose largest complete reply used 1,247 tokens), `prompt_cache_options: { mode: "implicit", ttl: "30m" }`, and the player's reply schema as strict `json_schema` structured output, with one closed object per action type (`splitActionTypes`). Optional schema fields are sent as required-nullable and the nulls are removed before parsing; no action is repaired.
- **Prices (USD per million tokens), checked against the public docs on 2026-10-28:** input $0.10, cache read $0.01 (0.1×), 30-minute cache write $0.125 (1.25×), output $0.50; above 272K input tokens 2× input and cache rates and 1.5× output. Sources: the model page, `pricing` and `guides/prompt-caching` on developers.openai.com (URLs in `OPENAI_PRICING_SOURCE`). Re-check on the day of each paid run.
- **Conservative accounting:** every computed cost is multiplied by 1.1, the documented regional/FedRAMP uplift, although the global endpoint is used. Reservations treat the whole serialized request plus a 4,096-token margin as cache-write input and assume the full output limit. A reply whose usage is missing or malformed, whose model is not `gpt-6-luna`, or whose `service_tier` is not `"default"` settles at its full reservation.
- **Dispatch guard (both providers):** a paid request needs a budget bound once to an open reservation in the canonical shared ledger, plus a one-use per-call grant re-checked against the ledger file, its lock and the initialization marker immediately before transport. The Anthropic SDK's own `fetch` is wrapped, so a direct SDK call outside `complete()` is refused too. The guard prevents accidental bypass; it cannot stop in-process code written to call the network directly.
- **Smoke command (owner approval required, not yet run):** `node --import tsx scripts/midterm/evaluate.ts --smoke --paid --gateway openai --model gpt-6-luna --effort medium`, with `OPENAI_API_KEY` set in the shell. It reserves $0.01 from the $0.10 smoke stage; the computed worst case of that call on the S1 smoke prompt was $0.0056 at the 4,000-token cap; the lower cap reduces it by 2,000 × $0.50/M × 1.1 = $0.0011.
- **Unverified until a real call:** that the account accepts `gpt-6-luna`, that responses report `service_tier: "default"` and `input_tokens_details.cache_write_tokens` (if not, every call is charged its full reservation), and real latency and reply quality.

## S2-local cost estimate with the tutorial briefing (suite revision 2, 2026-10-28)

Owner request after suite revision 2. Estimate only: no paid call was made, and prices are from the 2026-10-28 checks above. **Re-check prices on the run day.**

**Measured basis: pilot-8.**
- Revision 1 S2-local (Mirror Pond), seed 0, OpenAI `gpt-6-luna` at medium effort, git `b8ae7f0`, ledger entry `pilot-8`.
- Local run record, not committed: `evaluation-runs/live/S2-local-seed0-model-history-openai-2026-10-29T01-41-38-331Z`.
- Stopped manually at 54.9 game-seconds.
- 274 attempted calls (1 failed, with unknown usage, charged at its reservation).
- Tokens: 1,805,445 input (1,157,170 cache read, 647,456 cache write); 118,823 output.
- Charged $0.17297.
- Per call: 6,589 input tokens, 434 output tokens, **$0.000631**.

**Added prompt.**
- The revision 2 S2-local system prompt is 25,897 characters, against 18,359 for revision 1.
- The difference is 7,538 characters: the tutorial block, plus the episode briefing's area/item change.
- Counted conservatively at 3.5 characters per token: **about 2,200 tokens**, the same on every call, so cacheable.

**Per call, OpenAI** (prices × 1.1 uplift, as charged):

| Case | Added cost per call | New cost per call |
| --- | --- | --- |
| Expected: prefix read from cache ($0.01/M) | +$0.000024 | $0.000655 (+4%) |
| Worst: prefix written every call ($0.125/M) | +$0.000303 | $0.000934 (+48%) |

**Per episode.**
- At pilot-8's rate (5.0 calls per game-second), the 800-call limit (400 per hero) is reached at about 160 game-seconds, before the 300 s game-time limit.
- An episode that does not succeed therefore ends at about 800 calls.

| Episode (both heroes) | Revision 1 basis | Revision 2 expected | Revision 2 worst (no caching) |
| --- | --- | --- | --- |
| S2-local, 800 calls | $0.50 | **$0.52** | $0.75 |
| Pilot-8 length (274 calls) | $0.17 | $0.18 | $0.26 |

**Anthropic `claude-haiku-5-5`** (no measured run).
- The 2,200 added cached tokens cost about $0.000022 per call at the $0.01/M cache-read rate.
- The central and high per-call costs above become about $0.00069 and $0.00119.
- An 800-call S2-local episode: about **$0.55 (central) to $0.96 (high)**.

**Limits.**
- The per-episode cap stays **$1.25**, enforced by the `ModelBudget` and reserved in the ledger. No estimate reaches it.
- Per-call reservations rise by about $0.001 (OpenAI), because the reservation treats every request byte as a cache-write token. A call with unknown usage is charged at its reservation.

**Not measured:**
- Hedge Maze output length and call rate. Pilot-8 was Mirror Pond. The maze has combat, which may change both.
- Actual cache hits.
