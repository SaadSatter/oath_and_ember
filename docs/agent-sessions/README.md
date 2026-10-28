# Agent sessions: evidence records

One file per development session, or group of related sessions, that built or reviewed Oath and Ember. The structure follows the owner's Prince of Persia midterm (`docs/agent-sessions/` there).

## What each file contains

- **Header table:** agent and model ids, role and instruction file, session id, UTC window, session URL, branches and local transcript path.
- **Owner instructions:** redacted, with long briefs truncated.
- **What was done:** written from the transcript. Claims checked in git or GitHub are marked *verified*; claims taken from the agent's own final message are marked *agent's report*.
- **Mechanically extracted record:** skills and subagents used, PRs referenced, files edited through the agent's edit tool, test-summary lines as printed, and commits whose author time falls inside the session window.

## Rules

- **Session URL** is "None" for every historical session. They were local CLI or desktop sessions, and no shareable link was created. No link has been invented.
- **Raw transcripts are not committed.** They stay in `~/.claude/projects/…` and `~/.codex/sessions/…` on the owner's machine.
- **Redaction.** Every quoted string passes through `scripts/evidence/redact.py`, which handles API keys, bearer tokens, credentials in URLs, `*_KEY=`/`*_TOKEN=` assignments and home paths. `scripts/evidence/scan_secrets.py` runs over these files before every commit.
- **PixelLab token.** Sessions 03 and 04 contained a PixelLab token in the owner's commands. It is redacted here, and the owner is rotating it before any evidence is published.
- **Codex permission checks** (`codex-auto-review`, the "guardian" subagent) decide whether a tool call may run. They are listed below for completeness and are **not** counted as reviews.
- **Configuration smoke tests** (20) are not skill invocations.
- **Implementer-spawned reviewers** (18, 21) are not independent reviews.
- **Skill sessions launched by the implementer** (24, 25, 26) are skill invocations in fresh contexts. The implementing session wrote their prompts, so they are not independent reviews.

## Reproduce

These commands need the owner's local transcripts.

```sh
python3 -I scripts/evidence/extract_sessions.py --out /tmp/facts.json --exclude <current-session-id>
python3 -I scripts/evidence/render_sessions.py --facts /tmp/facts.json      # keeps hand-written narratives
python3 -I scripts/evidence/index_sessions.py --facts /tmp/facts.json       # the table below
python3 -I scripts/evidence/prelog_briefs.py > docs/agent-sessions/00-pre-log-codex-briefs.md
python3 -I scripts/evidence/scan_secrets.py docs/agent-sessions docs/midterm
```

New sessions are added with the `session-evidence` skill (`.claude/skills/session-evidence/SKILL.md`).

## Files

Latest record: [31 — Agent-interface reliability pass after the first real-LLM S1 run](31-claude-agent-interface-reliability-pass.md), session `47c36046-7a76-45d1-9d05-03e68d299f40` (implementation under `CLAUDE.md`/`AGENTS.md`; not independently reviewed yet).

| File | Sessions | Role |
| --- | --- | --- |
| [01 — Bald Goddess quest maps: Hedge Maze, Mirror Pond, Griffin Enclosure, shrine hub](01-codex-bald-goddess-quest-maps.md) | `01a13672` | Implementation agent (instructions: `AGENTS.md`, auto-loaded by Codex) |
| [02 — Animation and movement smoothness, first pass](02-claude-animation-smoothness.md) | `c5d40999` | Implementation agent (no `CLAUDE.md` existed yet; `AGENTS.md` only) |
| [03 — Smoothness study against Zelda: Mystery of Solarus DX, attack and fireball fixes, PixelLab setup](03-claude-smoothness-study-and-sprites.md) | `bfddd89c` | Implementation agent (`AGENTS.md`) |
| [04 — 60 Hz movement, playtest shortcut (PR #1), title screen, villagers, statue puzzle](04-claude-60hz-playtest-shortcut-title-screen.md) | `2d0672b3` | Implementation agent (`AGENTS.md`) |
| [05 — Griffin nest and haircut, puzzle-map target fix, village and town maps](05-codex-griffin-nest-and-villages.md) | `01a1460e` | Implementation agent (`AGENTS.md`) |
| [06 — Chest opening and item reveal animations](06-codex-chest-animations.md) | `01a14c16` | Implementation agent (`AGENTS.md`) |
| [07 — Chapter 0 prologue (PR #2) and Part 1 (PR #3)](07-claude-chapter0-prologue-and-part1.md) | `d2b75ea8` | Implementation agent (`AGENTS.md`) |
| [08 — Prologue house fixes, title-screen story checkpoints, Mossling attack animation](08-codex-prologue-fixes-checkpoints-mossling.md) | `01a14d63` | Implementation agent (`AGENTS.md`) |
| [09 — Chapter 0 finale, The Forgotten Shrine (PR #4)](09-claude-chapter0-finale.md) | `bea14c52` | Implementation agent (`AGENTS.md`) |
| [10 — Commit the Mossling attack to main](10-claude-commit-mossling-attack.md) | `04d06bff` | Implementation agent (`AGENTS.md`) |
| [11 — Prologue forest touch-ups, revised finale scenes, puzzle fixes](11-claude-prologue-forest-and-finale-revisions.md) | `9c6f50f1` | Implementation agent (`AGENTS.md`) |
| [12 — Sound design plan and integration](12-codex-sound-design.md) | `01a15749` | Implementation agent (`AGENTS.md`) |
| [13 — Sound remapping, quest journal, prologue as default, jump removed from controls](13-claude-sound-remap-quest-journal.md) | `a2128edc` | Implementation agent (`AGENTS.md`) |
| [14 — Player manual, design rationale D1–D11, midterm architecture, superseded Codex evaluation (PR #5)](14-codex-manual-rationale-midterm-architecture.md) | `01a16225` | Implementation agent (`AGENTS.md`); orchestrator of subagents 18, 19 and 21 |
| [15 — Render deployment and commits to main](15-codex-render-deployment.md) | `01a16235` | Implementation agent (`AGENTS.md`) |
| [16 — Mirror Pond push and reflection, Bald Goddess checkpoint, wig mystery](16-claude-mirror-pond-goddess-checkpoint.md) | `5fb3c7ac` | Implementation agent (`AGENTS.md`) |
| [17 — Midterm agent team configuration (PR #6) and the woods tutorial request](17-claude-agent-team-setup.md) | `2ef44cdb` | Implementation agent (`AGENTS.md`; wrote `CLAUDE.md` in this session) |
| [18 — Pre-implementation information-boundary review (Codex subagent)](18-codex-preimplementation-boundary-review.md) | `01a166c4` | Read-only reviewer subagent spawned by the implementation session (14). Not independent of the builder's session |
| [19 — Superseded Codex evaluation implementation: engine, browser observer and video, players and traces](19-codex-evaluation-subagents.md) | `01a166d4` | Implementation subagents spawned by session 14 |
| [20 — PR #6 configuration checks: role, skill and reviewer discovery, reviewer read-only enforcement](20-claude-agent-team-config-checks.md) | `894c52f7`, `d9dbc9ba`, `d8f2c33e`, `e6c5752b` | Configuration smoke tests for PR #6 (non-interactive `claude -p`). Not skill invocations and not reviews |
| [21 — Information-boundary review, session A (Codex skill invocation)](21-codex-boundary-review-session-a.md) | `01a16965` | Reviewer subagent applying the Codex skill `oath-rule-information-boundary`, spawned by session 14. A skill invocation; weak as an independent review |
| [22 — Two-player five-operation agent interface (PR #7)](22-claude-agent-interface.md) | `3d2319ad` | Implementation agent (`CLAUDE.md`, which imports `AGENTS.md`) |
| [23 — Gap analysis and evidence foundation (phase 1); server runtime injection, view-only browsers and model budgets (phase 2); scripted route, batching and suite freeze (phase 3); Phase 4 code handed to Codex uncommitted](23-claude-gap-analysis-evidence-foundation.md) | `618e460d` | Implementation agent (`CLAUDE.md`, which imports `AGENTS.md`); launched skill sessions 24–27. Final render by the session itself |
| [24 — game-rules-audit, first invocation: adapter](24-claude-skill-game-rules-audit-adapter.md) | `3a0642f5` | Skill invocation (`game-rules-audit`) in a fresh `claude -p` session launched by 23; resumed once to save. Report: [`2026-10-27-adapter.md`](../midterm/agent-evidence/skill-runs/2026-10-27-adapter.md). Not an independent review |
| [25 — session-evidence, first invocation: record of session 23](25-claude-skill-session-evidence-first.md) | `f7e2bf18` | Skill invocation (`session-evidence`) in a fresh `claude -p` session launched by 23. Output: file 23 (phase 1 narrative). Not an independent review |
| [26 — game-rules-audit, second invocation: server changes and re-check of the adapter findings](26-claude-skill-game-rules-audit-server-changes.md) | `fb09128d` | Skill invocation (`game-rules-audit`) in a fresh `claude -p` session launched by 23. Report: [`2026-10-27-server-changes.md`](../midterm/agent-evidence/skill-runs/2026-10-27-server-changes.md). Not an independent review |
| [27 — session-evidence, second invocation: files 24-26 and phase 2 of file 23 (interrupted)](27-claude-skill-session-evidence-second.md) | `83ac1132` | Skill invocation (`session-evidence`) in a fresh `claude -p` session launched by 23; interrupted by the usage limit, recorded by 23 |
| [28 — Continue the evaluation worktree and validate existing Phase 4 work](28-codex-evaluation-handoff.md) | `01a17e49` | Implementation handoff under `AGENTS.md` and `CLAUDE.md`; same-session `session-evidence` and `game-rules-audit` use. Not an independent review |
| [29 — Independent review of the Phase 4 launcher, re-review fixes, and the legacy-runner paid guard](29-claude-phase4-review-and-fixes.md) | `ffcdac23` | Read-only review of `bc377ee..b612285` (built by a different session; not the `rules-reviewer` subagent), then implementation of its fixes (`37f4c66`, `c6761a7`, `f5cf5cf`, `8837f88`, `6bee662` on `midterm/evaluation`; `b18cd0f` on `midterm/agent-interface`) and a `session-evidence` invocation. The fixes are not independently reviewed |
| [30 — Paid-entrypoint safety audit supplement](30-codex-paid-entrypoint-audit-supplement.md) | `01a17e49` (same session as 28) | Archived paid-path guard, canonical safety audit, Node 24 validation and preservation/finalization of pending evidence. Same-session skill use; not independent review |
| [31 — Agent-interface reliability pass after the first real-LLM S1 run](31-claude-agent-interface-reliability-pass.md) | `47c36046` | Implementation (`5c3de48`): action statuses, structured output and envelope validation, per-hero dialogue log, prompt clarifications, metrics v2. Same-session `session-evidence` invocation; not independent review |
| [00 — Codex briefs without a surviving transcript](00-pre-log-codex-briefs.md) | attachments only | Owner's instructions; no session record |

Sessions after 2026-10-26 (this evidence work onward) are added here as they are recorded.

## Inventory of all local transcripts (as of 2026-10-27, including the running session 618e460d)

| # | Tool | Session id | Started (UTC) | Model | Classification | Evidence file |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | codex | `01a13672-f3eb-7470-98d1-30c3595be099` | 2026-10-15 01:50 | gpt-6.1-sol | Codex work session | [01](01-codex-bald-goddess-quest-maps.md) |
| 2 | codex | `01a14097-8364-7721-b77b-ba1cc2adda12` | 2026-10-15 17:23 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 3 | codex | `01a141f4-962a-7f01-a497-3ca06095a4eb` | 2026-10-15 23:45 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 4 | codex | `01a142e7-dac8-74f3-97f4-1a92a8f38367` | 2026-10-16 04:10 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 5 | claude | `c5d40999-b26c-4ce5-85e3-ef03967e93ea` | 2026-10-16 04:27 | claude-opus-5-5 | Claude Code session | [02](02-claude-animation-smoothness.md) |
| 6 | claude | `bfddd89c-2088-49a4-8b6e-5c28d4283c7b` | 2026-10-16 05:46 | claude-opus-5-5 | Claude Code session | [03](03-claude-smoothness-study-and-sprites.md) |
| 7 | claude | `2d0672b3-2e83-4103-b94d-502643c179ab` | 2026-10-16 17:15 | claude-opus-5-5 | Claude Code session | [04](04-claude-60hz-playtest-shortcut-title-screen.md) |
| 8 | codex | `01a1460e-7bbe-7593-bb22-af451d660e0e` | 2026-10-16 18:53 | gpt-6.1-sol | Codex work session | [05](05-codex-griffin-nest-and-villages.md) |
| 9 | codex | `01a14612-4540-71e2-9d01-867e4d33dd5b` | 2026-10-16 18:56 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 10 | codex | `01a1460e-7bbe-7593-bb22-af451d660e0e` | 2026-10-16 20:25 | gpt-6.1-sol | Codex work session | [05](05-codex-griffin-nest-and-villages.md) |
| 11 | codex | `01a14665-2d5d-7780-9972-e21682501226` | 2026-10-16 20:26 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 12 | codex | `01a147ed-3d30-77b1-8ed9-20c1886962ed` | 2026-10-17 03:34 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 13 | codex | `01a14c16-c87e-7c30-9bd0-ae75bf8d0e74` | 2026-10-17 22:59 | gpt-6.1-sol | Codex work session | [06](06-codex-chest-animations.md) |
| 14 | codex | `01a14c35-d08b-7c01-b353-a273b1049b8d` | 2026-10-17 23:32 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 15 | claude | `d2b75ea8-1938-4614-810c-e3bd65a4a188` | 2026-10-18 01:04 | claude-opus-5-5 | Claude Code session | [07](07-claude-chapter0-prologue-and-part1.md) |
| 16 | codex | `01a14d63-db93-7383-ab4e-0d7347f04cbc` | 2026-10-18 05:04 | gpt-6.1-sol | Codex work session | [08](08-codex-prologue-fixes-checkpoints-mossling.md) |
| 17 | codex | `01a151c0-0c6a-77f3-b29e-5301caecd046` | 2026-10-19 01:21 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 18 | claude | `bea14c52-6493-45d1-bceb-1f2dde2e1e36` | 2026-10-19 22:09 | claude-opus-5-5 | Claude Code session | [09](09-claude-chapter0-finale.md) |
| 19 | claude | `04d06bff-bfea-4557-bb63-dc288ba3f985` | 2026-10-20 03:06 | claude-opus-5-5 | Claude Code session | [10](10-claude-commit-mossling-attack.md) |
| 20 | claude | `9c6f50f1-02f0-48c4-b351-0d495d2adaa8` | 2026-10-20 03:10 | claude-opus-5-5 | Claude Code session | [11](11-claude-prologue-forest-and-finale-revisions.md) |
| 21 | codex | `01a15749-c4ba-7073-9b00-81521ed4ceb3` | 2026-10-20 03:11 | gpt-6.1-sol | Codex work session | [12](12-codex-sound-design.md) |
| 22 | codex | `01a1575c-a0c9-7a92-8391-8145ba25bec0` | 2026-10-20 03:30 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 23 | codex | `01a15b42-4605-7f40-900a-e0c8a91e680b` | 2026-10-20 21:40 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 24 | claude | `a2128edc-a9b9-4a20-8199-ffecd81c16d2` | 2026-10-21 19:33 | claude-opus-5-5 | Claude Code session | [13](13-claude-sound-remap-quest-journal.md) |
| 25 | codex | `01a16225-4316-7110-92c8-8cfb77c7a2d1` | 2026-10-22 05:49 | gpt-6.1-sol | Codex work session | [14](14-codex-manual-rationale-midterm-architecture.md) |
| 26 | codex | `01a16229-ba9a-7371-a97b-74be6560e6ab` | 2026-10-22 05:51 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 27 | codex | `01a16235-4adb-79c2-afe4-d19c74c08b01` | 2026-10-22 06:04 | gpt-6.1-sol | Codex work session | [15](15-codex-render-deployment.md) |
| 28 | codex | `01a16239-bcb3-7fd0-96b6-b4644a4df102` | 2026-10-22 06:08 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 29 | claude | `5fb3c7ac-b66f-44af-b968-67a376a4cfec` | 2026-10-22 16:13 | claude-opus-5-5 | Claude Code session | [16](16-claude-mirror-pond-goddess-checkpoint.md) |
| 30 | codex | `01a16235-4adb-79c2-afe4-d19c74c08b01` | 2026-10-22 17:39 | gpt-6.1-sol | Codex work session | [15](15-codex-render-deployment.md) |
| 31 | codex | `01a164b2-e1eb-75f3-b6aa-9bda5f03a6ac` | 2026-10-22 17:40 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 32 | codex | `01a166a1-7868-7833-b843-98ab2d78b974` | 2026-10-23 02:40 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 33 | claude | `2ef44cdb-70a8-49b7-a4b5-5560be22d8d6` | 2026-10-23 02:44 | claude-opus-5-5 | Claude Code session | [17](17-claude-agent-team-setup.md) |
| 34 | codex | `01a166c4-0f6f-7182-8eb0-330acb1ced9f` | 2026-10-23 03:18 | gpt-6.1-sol | Codex subagent `/root/information_boundary_review` | [18](18-codex-preimplementation-boundary-review.md) |
| 35 | codex | `01a166d4-39c2-74e2-b993-c49951cc19df` | 2026-10-23 03:35 | gpt-6.1-sol | Codex subagent `/root/evaluation_engine` | [19](19-codex-evaluation-subagents.md) |
| 36 | codex | `01a166d4-6f51-77e0-9eba-dcd8031ca4d4` | 2026-10-23 03:36 | gpt-6.1-sol | Codex subagent `/root/visible_observer_video` | [19](19-codex-evaluation-subagents.md) |
| 37 | codex | `01a166d4-ab1c-7620-9f79-eba9cf7472dc` | 2026-10-23 03:36 | gpt-6.1-sol | Codex subagent `/root/players_baseline_trace` | [19](19-codex-evaluation-subagents.md) |
| 38 | claude | `894c52f7-af63-4750-8726-c05ff4ec9b0a` | 2026-10-23 03:36 | claude-opus-5-5 | Claude Code session | [20](20-claude-agent-team-config-checks.md) |
| 39 | claude | `d9dbc9ba-2011-42d3-b647-65227fe0d2cf` | 2026-10-23 03:36 | claude-opus-5-5 | Claude Code session | [20](20-claude-agent-team-config-checks.md) |
| 40 | claude | `d8f2c33e-2cfb-4a62-be84-57de8d165b73` | 2026-10-23 03:36 | claude-opus-5-5 | Claude Code session | [20](20-claude-agent-team-config-checks.md) |
| 41 | claude | `e6c5752b-32bb-44ce-baf9-b38ff3c73749` | 2026-10-23 03:37 | claude-opus-5-5 | Claude Code session | [20](20-claude-agent-team-config-checks.md) |
| 42 | codex | `01a16965-49a5-7650-8c11-fd353b7539de` | 2026-10-23 15:33 | gpt-6.1-sol | Codex subagent `/root/boundary_review_session_a` | [21](21-codex-boundary-review-session-a.md) |
| 43 | codex | `01a16968-b8a8-7b22-b7c6-f7a8f5234e1e` | 2026-10-23 15:37 | codex-auto-review | Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.** | — |
| 44 | claude | `3d2319ad-79d1-4d3d-a243-e5cd03a8b685` | 2026-10-23 18:47 | claude-opus-5-5 | Claude Code session | [22](22-claude-agent-interface.md) |
| 45 | claude | `618e460d-d442-4e5f-a60f-7a9c556e8095` | 2026-10-27 03:04 | claude-opus-5-5 | Claude Code session | [23](23-claude-gap-analysis-evidence-foundation.md) |
| 46 | claude | `3a0642f5-f755-47cd-8fef-7c886d9d6133` | 2026-10-27 04:14 | claude-opus-5-5 | Claude Code session | [24](24-claude-skill-game-rules-audit-adapter.md) |
| 47 | claude | `f7e2bf18-e439-4d94-9cb9-3179f521e9f8` | 2026-10-27 04:14 | claude-opus-5-5 | Claude Code session | [25](25-claude-skill-session-evidence-first.md) |
| 48 | claude | `fb09128d-3065-4ecc-a277-aae735265c63` | 2026-10-27 04:48 | claude-opus-5-5 | Claude Code session | [26](26-claude-skill-game-rules-audit-server-changes.md) |
| 49 | claude | `83ac1132-fb79-427f-8be5-499c4f385687` | 2026-10-27 04:58 | claude-opus-5-5 | Claude Code session | [27](27-claude-skill-session-evidence-second.md) |

Totals: Claude Code session 20, Codex permission check 15, Codex subagent 5, Codex work session 9
