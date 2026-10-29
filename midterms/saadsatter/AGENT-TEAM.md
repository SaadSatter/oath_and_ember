<!--
DRAFT SCAFFOLD, NOT THE SUBMITTED LOG. Prepared by the Claude Code
implementation agent on 2026-10-29 with factual fields and evidence links
only. The course requires this one-page log in the owner's own voice: an
agent-written log counts as missing authorship. Rewrite every line in your
own words, fill each "What I decided", keep it to one page, and delete this
comment. Every link points to evidence that exists at the packaged commit.
-->

# Agent-team log: Oath and Ember midterm

## Implementation agent

- **Agent and role:** Claude Code (Claude Opus models) as the implementation agent for the interface, players, baselines, evaluation harness, tests and documentation. Codex (OpenAI) also implemented some workstreams under the same rules.
- **Configuration:** [CLAUDE.md](CLAUDE.md) (Claude role) and [AGENTS.md](AGENTS.md) (rules shared with Codex).
- **Tools and permissions:** full repository read; write limited to the paths in `CLAUDE.md` ("Allowed repository paths"). No paid model calls, held-out runs, pushes or merges without the owner's approval.
- **What it was allowed to see:** the whole repository, including source, tests and the design documents.
- **What it recommended:** _to be written by the owner_. Examples on record: the pilot diagnoses and their proposed fixes ([PILOT10_DIAGNOSIS.md](docs/midterm/PILOT10_DIAGNOSIS.md), [MODEL_MEMORY.md](docs/midterm/MODEL_MEMORY.md) §7–§8).
- **What I decided:** _owner_
- **Evidence:** 42+ session records with ids, instructions, tests and commits: [docs/agent-sessions/README.md](docs/agent-sessions/README.md).

## Reusable skill: game-rules-audit

- **Agent and role:** a Claude Code skill that audits rules and AI-player fairness and saves a report.
- **Configuration:** [.claude/skills/game-rules-audit/SKILL.md](.claude/skills/game-rules-audit/SKILL.md).
- **Tools and permissions:** read the repository, run existing tests and the secret scanner; write exactly one report file; never change code.
- **What it was allowed to see:** the repository, including source, for auditing; it is not a game-playing agent.
- **What it recommended:** _owner_. Reports: [docs/midterm/agent-evidence/skill-runs/](docs/midterm/agent-evidence/skill-runs/).
- **What I decided:** _owner_
- **Evidence:** invoked in separate fresh sessions [S24](docs/agent-sessions/24-claude-skill-game-rules-audit-adapter.md) and [S26](docs/agent-sessions/26-claude-skill-game-rules-audit-server-changes.md), and at later checkpoints.
- **Second skill:** [session-evidence](.claude/skills/session-evidence/SKILL.md), invoked in [S25](docs/agent-sessions/25-claude-skill-session-evidence-first.md) and [S27](docs/agent-sessions/27-claude-skill-session-evidence-second.md).

## Independent reviewer: rules-reviewer

- **Agent and role:** a read-only reviewer that reports findings and never edits or approves.
- **Configuration:** [.claude/agents/rules-reviewer.md](.claude/agents/rules-reviewer.md) (Read, Grep, Glob only); Codex counterpart [.codex/agents/oath-rule-reviewer.toml](.codex/agents/oath-rule-reviewer.toml).
- **What it was allowed to see:** the repository and the change under review.
- **What it recommended:** _owner_. The independent review on record: [2026-10-28-pilot6-independent-review.md](docs/midterm/agent-evidence/reviews/2026-10-28-pilot6-independent-review.md), session S37, started by the owner and not spawned by the implementer.
- **What I decided:** _owner_
- **Evidence:** also two reviews by subagents the implementer spawned, which are not independent: [docs/midterm/agent-evidence/reviews/](docs/midterm/agent-evidence/reviews/).
- **Missing at this commit:** a Codex independent review, and independent reviews of the work after 2026-10-28.

## Game-playing agents (not part of the build team)

- **Sieg and Coco players:** two separate LLM players ([policies/llm.ts](packages/agent/src/policies/llm.ts)). Each sees only its own hero's observation, legal actions and the public manual. They share nothing except in-game messages.
- **Models:** OpenAI `gpt-6-luna`, Anthropic `claude-haiku-5-5`.
- **Not tools of the build team:** they had no repository, shell or evaluator access.
