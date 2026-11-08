# Agent-team log: Oath and Ember midterm

## Implementation agent

- **Agent and role:** Claude Code (Claude Opus models) as the implementation agent for the interface, players, baselines, evaluation harness, tests and documentation. Codex (OpenAI) also implemented some workstreams under the same rules.
- **Configuration:** [CLAUDE.md](CLAUDE.md) (Claude role) and [AGENTS.md](AGENTS.md) (rules shared with Codex).
- **Tools and permissions:** full repository read; write limited to the paths in `CLAUDE.md` ("Allowed repository paths"). No paid model calls, held-out runs, pushes or merges without the owner's approval.
- **What it was allowed to see:** The whole repository, including source, tests and the design documents.
- **What it recommended:** The implementation agents proposed technical solutions to gameplay and evaluation problems, including fixing invalid action schemas, improving player feedback, adding persistent spatial memory, and preventing agents from repeatedly attempting actions without making progress.
- **What I decided:** I reviewed their diagnoses and approved targeted fixes while preserving the game's existing mechanics and the evaluation's information boundaries. For example, I approved reliability fixes after the S2 evaluation failures and later authorized progress-tracking improvements after Pilot-28. I required offline verification before further paid evaluations.
- **Example evidence lives:** The original instructions, recommendations, approvals, implementation summaries, tests, and commits are recorded in:
docs/agent-sessions/35-claude-s2-reliability-fixes.md, docs/agent-sessions/40-claude-pilot10-diagnosis.md, docs/agent-sessions/47-codex-pilot28-fixes.md, and docs/midterm/agent-evidence/skill-runs/2026-11-05-adapter-pilot28-fixes.md.
- **All Evidence:** 42+ session records with ids, instructions, tests and commits: [docs/agent-sessions/README.md](docs/agent-sessions/README.md).

## Reusable skills: game-rules-audit and session-evidence

- **Agent and role:** Two Claude Code skills: `game-rules-audit` reviews gameplay rules, AI-player fairness, and information boundaries; `session-evidence` collects and documents agent sessions, instructions, decisions, tests, and commits.
- **Configuration:** `.claude/skills/game-rules-audit/SKILL.md` and `.claude/skills/session-evidence/SKILL.md`.
- **Tools and permissions:** `game-rules-audit` can read source code, run existing tests and secret scans, and write audit reports without modifying implementation code. `session-evidence` extracts and redacts session records for documentation.
- **What they were allowed to see:** Repository source, tests, evaluation infrastructure, and relevant development records. `session-evidence` also accessed local Claude/Codex session transcripts.
- **What they recommended:** `game-rules-audit` identified potential information leaks, discrepancies between AI observations and human-visible gameplay, and evaluation reliability risks. `session-evidence` documented the development process and identified gaps in recorded evidence.
- **What I decided:** I used the audit findings to prioritize fixes that preserved gameplay rules and fair agent observations. I also required session evidence to be collected throughout development so that agent recommendations, my approvals, and implementation results could be traced.
- **Where the evidence lives:** `docs/agent-sessions/24-claude-skill-game-rules-audit-adapter.md`, `docs/agent-sessions/25-claude-skill-session-evidence-first.md`, `docs/agent-sessions/26-claude-skill-game-rules-audit-server-changes.md`, `docs/agent-sessions/27-claude-skill-session-evidence-second.md`, `docs/midterm/agent-evidence/skill-runs/`, and `docs/agent-sessions/README.md`.

## Independent reviewer: rules-reviewer

- **Agent and role:** A read-only Claude Code reviewer that independently examines implementation changes, identifies bugs and rule violations, and reports findings without modifying or approving code.
- **Configuration:** `.claude/agents/rules-reviewer.md`; Codex counterpart `.codex/agents/oath-rule-reviewer.toml`.
- **Tools and permissions:** Read, Grep, and Glob for the configured reviewer; no implementation edits or approval authority. Separate owner-directed review sessions could also run permitted offline verification commands.
- **What it was allowed to see:** The repository, relevant gameplay rules, evaluation interface, tests, and the implementation changes under review.
- **What it recommended:** The reviewer identified misleading movement feedback under Slow Time, missing knockout/respawn feedback, and inconsistencies between displayed map coordinates and agent observations. It recommended targeted corrections and additional tests without changing the underlying gameplay rules.
- **What I decided:** I used the review findings to prioritize fixes that would make AI observations more accurate and consistent with human-visible gameplay. I kept implementation changes separate from the review process and required further verification before paid evaluations.
- **Where the evidence lives:** `docs/agent-sessions/37-claude-independent-review-pilot6.md`, `docs/midterm/agent-evidence/reviews/2026-10-28-pilot6-independent-review.md`, and `docs/midterm/agent-evidence/reviews/`.

## Game-playing agents (not part of the build team)

- **Sieg and Coco players:** One centralized model-driven player coordinating two hero controllers, with each hero acting through the game's five-operation interface.
- **Models:** OpenAI `gpt-6-luna` and Anthropic `claude-haiku-5-5`, depending on the evaluation configuration.
- **Not tools of the build team:** The game-playing agents had no repository, shell, or evaluator access. They interacted with the game through the provided observation and action interface.
