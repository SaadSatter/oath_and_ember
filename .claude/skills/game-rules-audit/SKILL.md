---
name: game-rules-audit
description: Audit Oath and Ember's game mechanics and AI-player integration for correctness. Checks that legal actions match the real rules, observations hold only player-visible information, no hidden state or puzzle solutions leak, the Sieg and Coco agents keep separate memories, model and baseline players share one interface, and resets, limits and termination are deterministic. Use when asked to audit a quest, puzzle or the evaluation adapter (shrine, pond, maze, griffin, adapter, or a path).
argument-hint: "<target: shrine | pond | maze | griffin | adapter | path> [focus]"
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(npx vitest run:*), Bash(npm test:*), Bash(npm run typecheck:*)
---

# Game rules audit

Audit target: **$ARGUMENTS**

You are auditing, not implementing. Report what you find; do not fix it.

- **Never** edit game rules, mechanics, tuning, story, maps, tests or the
  adapter as part of an audit, even when a fix looks obvious. Put the fix in
  the Recommendation column.
- The only file you may write is the report, and only if the user asks for it,
  at `docs/midterm/agent-evidence/skill-runs/<YYYY-MM-DD>-<target>.md`.
- Commands are for reading (`git diff/log/show`) and running existing tests.
  Report test results exactly as they ran.

## Targets

Resolve the target to the files below, then follow the code from there. A
path argument audits that path directly. If the target is unknown, say so and
stop.

| Target | Start from |
| --- | --- |
| `shrine` | `packages/shared/src/shrine.ts`, `apps/server/src/shrine.ts`, `packages/shared/src/chapter0Finale.ts`, `apps/server/src/chapter0Finale.ts`, `apps/server/src/storyCheckpoints.ts` (`goddess`), `packages/shared/src/items.ts`, `apps/server/src/inventory.ts` |
| `pond` | `packages/shared/src/mirrorPond.ts`, `apps/server/src/mirrorPond.ts` |
| `maze` | `packages/shared/src/hedgeMaze.ts`, `apps/server/src/hedgeMaze.ts` |
| `griffin` | `packages/shared/src/griffin.ts`, `apps/server/src/griffin.ts` |
| `adapter` | The AI-player interface, runners, observation builders, baselines and evaluator (see `CLAUDE.md` for their paths; search `packages/agent`, `apps/agent-runner`, `scripts/midterm` if moved) |

Shared code for every target: `apps/server/src/GameRoom.ts` (input handling,
`tick`, `damage`, `transition`), `packages/shared/src/movement.ts`,
`packages/shared/src/abilities.ts`, `packages/shared/src/protocol.ts`,
`apps/server/src/app.ts` (input schema).

**Evaluated episode** (from `CLAUDE.md`): starts at the `goddess` story
checkpoint (stage `GODDESS`, at `GODDESS_SHRINE`); succeeds when the story
records `chapter0.complete` ("CHAPTER 0 COMPLETE").

## Procedure

Work through every step. For each, record what you checked even if nothing
was wrong.

1. **Read the player-facing rules.** Read the relevant sections of
   `manual/Oath_and_Ember_Player_Manual.md`, plus the dialogue, quest-journal
   and objective text players see for this target
   (`apps/client/src/ui/questLog.ts`, objective strings in
   `apps/client/src/main.ts`, scene lines in `packages/shared/src/*.ts`). This
   is everything a player is allowed to know. Then read the implementation.
2. **Legal actions are real rules.** Every action an agent may take must map to
   an input the server already accepts and validates (`InputFrame`,
   `story:read`, `story:choose`, inventory intents). Flag actions the game does
   not have, actions that skip validation, and real inputs the interface omits.
3. **Observations are player-visible only.** Each field must be something that
   hero's player could see on their own screen or read in the manual, dialogue,
   journal, inventory or map. Flag anything taken from `World` or `GameRoom`
   that is not rendered to that player (hidden puzzle state, exact timers or
   hit points not shown, other heroes' private lines, enemy AI targets, future
   story stages, internal ids).
4. **No solution leakage.** Search prompts, system messages, tool descriptions,
   observation text and baselines that a model can see for puzzle answers,
   waypoints, required orders, coordinates of hidden objects, or text copied
   from `scripts/*playthrough*.ts`, `scripts/qa-*.ts`, `docs/` (other than
   `manual/`) or tests.
5. **Independent memories.** Sieg's and Coco's agents must not share memory,
   context, scratchpads, model sessions or hidden reasoning. They may learn
   about each other only through the game itself (what each screen shows,
   shared dialogue, the shared backpack, any in-game chat the players have).
6. **One interface for everyone.** Model players and baselines must call the
   same operations with the same observations and the same legal-action
   checks. Flag privileged paths (direct `World` access, extra fields, skipped
   cooldowns) for either side.
7. **Reset, limits, termination, determinism.** Check that reset produces the
   same start state every time (seeds, tick, positions, inventory, story
   flags), that step and time limits are enforced by the evaluator rather than
   by the agent, that success is read from the authoritative engine, and that
   the same inputs give the same trace. Note disconnect pauses and wall-clock
   dependencies (`Date.now()` in input freshness).
8. **Manual vs implementation.** List every place where the manual (or what
   players are told) disagrees with the code, in either direction.
9. **Tests.** Run the existing tests for the target if relevant and report the
   results. Recommend concrete new tests (file, scenario, assertion) for each
   gap you found.

If a check cannot be done (for example, the adapter does not exist yet), mark
it **Not applicable** or **Unverified** and say why. Do not guess.

## Output format

```markdown
# game-rules-audit: <target>

- Date: <YYYY-MM-DD>
- Commit: <git rev-parse --short HEAD>
- Scope: <files and directories read>

## Findings

| # | Severity | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1 | High | `path/file.ts:123` | What the code or manual says (quote or summary) | What goes wrong for players, agents or evaluation | Concrete fix or test; "needs owner decision" if it changes rules |

Severity: **Critical** (breaks fairness or authority: hidden-state leak,
solution leak, client-owned outcome) · **High** (wrong rules or
non-deterministic evaluation) · **Medium** (manual mismatch, missing
validation or test) · **Low** (clarity, docs) · **Info** (observation, no
action needed).

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Player-facing rules read | Done / Unverified / N/A | |
| … | | |
| 9 Tests | Passed x / Failed y / Not run | exact command |

## Recommended tests

- `<test file>`: <scenario> → <assertion>

## Open questions for the owner
```

A clean audit is valid: say "No findings" and keep the checks table filled in.

## Invocation examples

```text
/game-rules-audit shrine
/game-rules-audit adapter observations and legal actions
/game-rules-audit apps/server/src/mirrorPond.ts
```

To keep the result as evidence, ask: "save the report to
docs/midterm/agent-evidence/skill-runs/". Each of the two required course
invocations must be a separate Claude Code session; record each session's link
in `docs/midterm/agent-evidence/README.md`.
