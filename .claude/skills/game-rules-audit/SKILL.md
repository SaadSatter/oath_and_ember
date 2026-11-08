---
name: game-rules-audit
description: Audit Oath and Ember's game rules and AI-player evaluation for correctness and fairness, and save the report as evidence. Checks server authority, preserved rules and artwork, real mechanics instead of fixtures, player-visible-only observations and leak-free legal actions, independent Sieg and Coco memories, one interface for model and baseline, episode limits and failed-call accounting, suite freeze and held-out cases, and honest reporting. Use at implementation checkpoints and before evaluation runs, on a target (shrine, pond, maze, griffin, adapter, route, baseline, suite, recording, server-changes, or a path).
argument-hint: "<target: shrine | pond | maze | griffin | adapter | route | baseline | suite | recording | server-changes | path> [focus]"
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git rev-parse:*), Bash(git status:*), Bash(shasum:*), Bash(npx vitest run:*), Bash(npm test:*), Bash(npm run typecheck:*), Bash(npm run build:*), Bash(python3 -I scripts/evidence/scan_secrets.py:*)
---

# Game rules audit

Audit target: **$ARGUMENTS**

You are auditing, not implementing. Report what you find; do not fix it.

- Never edit game rules, mechanics, tuning, story, maps, tests, the agent
  interface or evaluation code during an audit, even when a fix looks obvious.
  Put the fix in the Recommendation column.
- Write exactly one file: the report, at
  `docs/midterm/agent-evidence/skill-runs/<YYYY-MM-DD>-<target>[-<n>].md`.
  Write nothing else, and do not commit.
- Commands are for reading (`git diff/log/show/status/rev-parse`), hashing
  this skill file, running existing tests and checks, and the secret scanner.
  Report every result exactly as it ran, including failures and anything you
  skipped.

## Where these checks come from

Each check is tagged with its source, so the audit does not pass off new
midterm requirements as long-standing project practice
(`docs/midterm/RECURRING_INSTRUCTIONS.md`):

- **H**: repeated in the owner's development briefs before the midterm:
  server authority, preserving rules and approved art, the typecheck/test/build
  triad, two-client synchronization, approval gates, no overclaiming, evidence
  capture.
- **M**: required by `docs/midterm/MIDTERM_GUIDELINES.md` or the owner's
  midterm briefs (2026-10-22 onward): information boundary, legal-action
  leakage, independent players, limits and terminal reasons, suite freeze,
  baseline fairness, recording honesty.

## Read first

1. `AGENTS.md` and `CLAUDE.md` (project invariants and the implementation role).
2. `docs/midterm/MIDTERM_GUIDELINES.md`, the rubric section (1a–5c). Never edit it.
3. `docs/midterm/REQUIREMENTS_CHECKLIST.md` and `docs/midterm/AGENT_INTERFACE.md`.
4. `manual/Oath_and_Ember_Player_Manual.md`. This is everything a player may
   know, apart from what the game shows on screen.

## Targets

Resolve the target to these starting files, then follow the code. A path audits
that path. If the target is unknown, say so and stop.

| Target | Start from |
| --- | --- |
| `shrine` | `packages/shared/src/shrine.ts`, `apps/server/src/shrine.ts`, `packages/shared/src/chapter0Finale.ts`, `apps/server/src/chapter0Finale.ts`, `apps/server/src/storyCheckpoints.ts`, `packages/shared/src/items.ts`, `apps/server/src/inventory.ts` |
| `pond` | `packages/shared/src/mirrorPond.ts`, `apps/server/src/mirrorPond.ts` |
| `maze` | `packages/shared/src/hedgeMaze.ts`, `apps/server/src/hedgeMaze.ts` |
| `griffin` | `packages/shared/src/griffin.ts`, `apps/server/src/griffin.ts` |
| `adapter` | `packages/agent/src/*` (environment, perception, actions, evaluator, runner, trace, policies), `scripts/midterm/*`, `packages/agent/test/*` |
| `route` | The scripted full-quest route used in tests (search `packages/agent/test` for the route) and the code that derives S2–S4 start states |
| `baseline` | `packages/agent/src/policies/*` (both baselines) compared with the LLM player |
| `suite` | `docs/midterm/EVALUATION_SUITE.md`, its git history, `EVALUATION.md`, `evaluation-runs/` or committed traces |
| `recording` | The recording and presentation code, the video files and their manifests, and the matching traces |
| `server-changes` | `docs/midterm/SERVER_CHANGES.md` and `git diff` of `apps/server/src`, `apps/client/src`, `packages/shared/src` |

Shared code for every target: `apps/server/src/GameRoom.ts` (input, `tick`,
`damage`, transitions), `apps/server/src/app.ts`, `packages/shared/src/protocol.ts`,
`packages/shared/src/movement.ts`, `packages/shared/src/abilities.ts`.

## Procedure

Do every step. Record what you checked even when nothing was wrong. Mark a step
**N/A** or **Unverified** with a reason rather than guessing.

1. **(H) Server authority.** Agents, baselines and browsers submit intent only.
   Nothing outside the server sets position, HP, damage, puzzle progress,
   inventory, skills or cooldowns. Flag any write to `World`/`GameRoom` state
   outside the server's own handlers, except the documented reset.
2. **(H) Rules and art preserved.** `git diff` the target against its base.
   Flag any change to mechanics, tuning, story, maps or approved artwork, and any
   rule bent to suit tooling or art. Server-side changes must match
   `docs/midterm/SERVER_CHANGES.md` and default to production behaviour.
3. **(H/M) Real mechanics, no fixtures.** Agent runs, the scripted route and
   evaluation start states must come from ordinary actions through the
   interface. Flag puzzle completion, inventory or flags injected after reset,
   teleports, and reliance on privileged helpers (`scripts/*-playthrough.ts`,
   `scripts/qa-*.ts`). Labelled unit-test fixtures are allowed.
4. **(M) Observations are player-visible only.** Each observation field must be
   something that hero's own screen, dialogue, journal, backpack, HUD or the
   manual shows. Values must not be more exact than what is drawn (HP shown as
   a bar, not a number). Flag hidden puzzle state, timers, AI targets, ids,
   other areas, future dialogue and the partner's private lines.
5. **(M) Legal actions leak nothing.** The legal list must depend only on what
   the player could know (visible ability cooldowns, nearby interactables shown
   by the client). Flag lists that reveal hidden objects, correct choices or
   solution order. Check validation feedback text for the same leaks.
6. **(M) No solution in any player context.** Search prompts, system messages,
   observation text and the manual given to players for answers, waypoints,
   angles, orders or coordinates from `docs/`, tests or QA scripts.
7. **(M) Independent players.** Sieg and Coco keep separate memories, contexts
   and model requests. They share only the game world and the `message` action.
8. **(M) One interface.** Model players and both baselines get the same
   observations, legal actions and validation. Disclose any asymmetry, such as
   the scripted baseline's hand-coded quest knowledge or its compute.
9. **(M) Limits and terminal reasons.** Step, tick, model-call, token, spend,
   per-call timeout and wall-clock limits are enforced by the runner, not by the
   policy. Failed and timed-out calls count toward the call budget. A fallback
   is never recorded as a model move. Every episode ends with an explicit reason.
10. **(H/M) Determinism and identical starts.** Reset gives the same start hash
    every time. Baseline and model runs of a case share that start hash. The
    same inputs give the same state hashes. Note any wall-clock or random-id
    dependency.
11. **(M) Suite and reporting.** The suite was committed before baseline or
    prompt tuning, and changes appear in its change log. Held-out cases were
    not used in tuning. Reports include failures, invalid actions, limits,
    latency, tokens and dated cost.
12. **(H) Synchronization and recording honesty.** Both clients see the same
    authoritative state. A recording shows real agent play at the stated speed.
    A replay is labelled and matched to its trace. A scripted baseline is
    never presented as an LLM.
13. **(H) Validation.** Run what applies: `npm run typecheck`, `npm test` (or
    the targeted `npx vitest run <path>`), `npm run build`. Report exact counts.
    Name known failures, such as the directional sprint-frame test, rather than
    hiding them.
14. **(H) No overclaiming, no secrets.** Compare docs, PR text and reports in
    scope with what the code and test runs show. Run
    `python3 -I scripts/evidence/scan_secrets.py <changed docs and artefacts>`.

## Output: save this report

```markdown
# game-rules-audit: <target>

| Field | Value |
| --- | --- |
| Date | <YYYY-MM-DD> |
| Session | <Claude Code session id, as shown by the transcript path or /status; "unknown" if you cannot see it> |
| Session URL | None unless the owner supplies one |
| Skill file SHA256 | <shasum -a 256 .claude/skills/game-rules-audit/SKILL.md> |
| Commit audited | <git rev-parse --short HEAD>, working tree clean/dirty |
| Target and focus | <arguments> |
| Files read | <list> |
| Commands run | <each command with its result> |

## Findings

| # | Severity | Source (H/M) | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |

Severity: **Critical** (breaks authority or fairness: hidden-state or solution
leak, client-owned outcome, injected progress) · **High** (wrong rules,
unenforced limit, non-deterministic evaluation) · **Medium** (missing test or
validation, manual mismatch) · **Low** (clarity, docs) · **Info**.

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass / Finding #n / N/A / Unverified | |
| … | | |

## Recommended tests

## Open questions for the owner
```

A clean audit is valid. Write "No findings" and keep the checks table filled in.

## Invocation

```text
/game-rules-audit adapter limits and failed calls
/game-rules-audit route
/game-rules-audit server-changes
```

The course requires this skill to be invoked in at least two separate sessions.
Each invocation must be a new Claude Code session, and the saved report is that
session's evidence. `docs/agent-sessions/` records the session itself, written
with the `session-evidence` skill.
