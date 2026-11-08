# Continuous showcase: final owner authorization, November 7, 2026

Source: explicit owner message in Codex session `01a1b479-dfba-79a0-9de7-9cca63bdc8bb`, following clean review commit `9806206`. Local session; no shareable URL was created. This supersedes prior statements that final paid authorization is pending. Historical evidence and definition metadata remain unchanged.

Authorized **one attempt**, no automatic retry:

| Setting | Authorized value |
| --- | --- |
| Scenario / seed | `showcase-maze-griffin-complete-v1` / `0` |
| Player / gateway | `model-centralized` / `openai` |
| Model / effort / maximum batch | `gpt-6-luna` / `medium` / `4` |
| Guidance | `showcase-maze-griffin-v1` |
| Guidance SHA-256 | `7f3203b954001d9e302b154cc77423cdb8fe36f63e4434c7a9ac7fc4a33d2166` |
| Full planner prompt SHA-256 | `59e46825cefa03608f7481c681b625f6204e13c2156eb6f66cb1a6b7f18183c7` |
| Spending / wall time / calls | At most $2.00 / 7,200 s / 400 per hero |

Pre-change verification: clean tree at `9806206`; both exact prompt hashes regenerated and matched. Canonical ledger: 35 entries, zero open reservations, no lock, pilot $2.130405 remaining, total $19.127484. No real reservation or provider call was made during those checks.

Minimal runtime change: flip only `SHOWCASE_PAID_APPROVED`; approve only the showcase guidance at its exact text hash. Existing scenario/model/effort/batch/seed/guidance/cap/wall limits, held-out protections and no-resume restrictions remain. The reviewed diff changes no gameplay, planner text, start state, official A/B/C definition or result. Updated tests exercise real authorization rather than mocking an open lock. This is same-session code review, not independent review.

`OPENAI_API_KEY` is unavailable to the Codex process. Configuration validation must stop safely at the missing-credential boundary. Supply a credential through the existing hidden terminal prompt or environment; never through chat, command arguments, committed files or logs. No paid attempt is consumed before a model call, and no automatic retry is authorized after execution starts.

Final launch, from this worktree after verifying clean HEAD and current ledger:

```sh
npm run eval:live -- --scenario showcase-maze-griffin-complete-v1 --seed 0 \
  --player model-centralized --guidance showcase-maze-griffin-v1 \
  --gateway openai --model gpt-6-luna --effort medium --max-batch 4 \
  --max-spend-usd 2.00 --wall-seconds 7200 --paid
```

Do not push, merge, change the course PR or submit. Preserve any failed or partial attempt; report its actual outcome. The earlier review's live-capture timing caveat remains applicable.

## Completed authorization validation

Authorization source commit: `165d5f7ffa0b792cd6a25eb011e6c22cfdf81859`. Clean-source exact CLI validation passed scenario/configuration/guidance/budget/clean-tree checks and stopped at `no OPENAI_API_KEY and no interactive terminal for the hidden prompt`. No provider call or real reservation occurred; the authorized attempt remains unstarted. Unescalated checks could not create the canonical ledger lock; rerunning the credential-free validation with required filesystem permissions reached the expected credential boundary.

Typecheck/build pass; existing showcase suites **16/16 pass**, including full prompt hash pins, approved guidance hash, rejected configurations, no resume, cap checks and the credential-free CLI check. Runtime changes are limited to the two authorization locks; harness, live launcher, server/shared code and official A/B/C definitions are unchanged. The existing definition status string is historical metadata retained to avoid silently changing its frozen hash.

Evidence: [authorization checks](evidence/showcase-authorization/command-validation.json). Changed evidence secret scan passes. Broad historical docs scan still reports the pre-existing truncated synthetic canary in the immutable October 27 recording audit; that report was preserved verbatim. No claim that the entire historical scan is clean.
