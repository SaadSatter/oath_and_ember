# Midterm agent-team evidence

Evidence for the three agent-team roles in the Columbia AI Game Development
midterm (Oath and Ember, Bald Goddess Shrine quest). Fill in each field only
with something that exists: a real session link, PR, commit or file. Leave a
field blank (or write "not yet") rather than guess.

The one-page agent-team log is written by the project owner, in their own
words, from `AGENT-TEAM.template.md`.

## Roles

| Role | Configuration | Tools and permissions |
| --- | --- | --- |
| Implementation agent | [`CLAUDE.md`](../../../CLAUDE.md) (imports `AGENTS.md`) | Full Claude Code tool set. Writes only to the allowed paths in `CLAUDE.md`; rules changes need owner approval |
| Reusable skill | [`.claude/skills/game-rules-audit/SKILL.md`](../../../.claude/skills/game-rules-audit/SKILL.md) | Runs inside a session; pre-approved for Read, Grep, Glob, `git diff/log/show` and test commands. Must not edit rules; may write only its report |
| Independent reviewer | [`.claude/agents/rules-reviewer.md`](../../../.claude/agents/rules-reviewer.md) | Read, Grep and Glob only. Edit, Write, NotebookEdit, Bash and Agent are disallowed in its configuration |

## How to invoke each role

**Implementation agent.** Start Claude Code in the repository root (`claude`).
`CLAUDE.md` loads automatically; check with `/memory`. Work on a branch, then
link the session from the PR description.

**Reusable skill.** In a Claude Code session:

```text
/game-rules-audit shrine
/game-rules-audit adapter observations and legal actions
```

Ask it to save the report to `skill-runs/` when you want it kept. Run it in two
separate sessions for the course requirement.

**Independent reviewer.** In a fresh Claude Code session that did not write the
change:

```sh
git diff origin/main...HEAD > .git/rules-review.diff   # untracked; the reviewer can read it
```

```text
Use the rules-reviewer subagent to review PR #<n> (branch <name>).
The diff is at .git/rules-review.diff. Return its report unchanged.
```

Then post the report as a PR comment (this is the record of its findings):

```sh
gh pr comment <n> --body-file <saved-report.md>
```

## Evidence checklist

| # | Item | Evidence (link or path) | Notes |
| --- | --- | --- | --- |
| 1 | Implementation-agent configuration path | `CLAUDE.md` | |
| 2 | Implementation session link | | |
| 3 | Associated PR link | | |
| 4 | Reusable skill path | `.claude/skills/game-rules-audit/SKILL.md` | |
| 5 | First skill invocation: session link | | |
| 6 | First skill invocation: target and result | `skill-runs/` | |
| 7 | Second skill invocation: session link | | |
| 8 | Second skill invocation: target and result | `skill-runs/` | |
| 9 | Independent review: session link or subagent transcript | | |
| 10 | Reviewer findings (PR comment link) | | |
| 11 | Resolution of each finding (fixed in commit / declined / deferred) | | |
| 12 | Owner's approval or rejection of significant recommendations | | Owner fills in |
| 13 | Agent-team log (owner-written) | `AGENT-TEAM.md` | Owner fills in |

## Folders

- `skill-runs/`: saved `game-rules-audit` reports, named
  `<YYYY-MM-DD>-<target>.md`.
- `reviews/`: optional copies of reviewer reports. The PR comment is the
  primary record.
