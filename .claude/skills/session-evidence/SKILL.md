---
name: session-evidence
description: Write or refresh the redacted evidence record for one or more Claude Code or Codex sessions in docs/agent-sessions/, using the committed extraction scripts, and update the session index and evidence index. Records session ids, roles, the owner's instructions, what was done, test results, commits, PRs and artifacts. Never invents session links, invocations or results. Use after an implementation, skill or review session, or to document historical sessions.
argument-hint: "<session id prefix(es) | latest> [role] [title]"
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(python3 -I scripts/evidence/extract_sessions.py:*), Bash(python3 -I scripts/evidence/render_sessions.py:*), Bash(python3 -I scripts/evidence/scan_secrets.py:*), Bash(git log:*), Bash(git show:*), Bash(git branch:*), Bash(git rev-parse:*), Bash(gh pr view:*), Bash(gh pr list:*), Bash(shasum:*), Bash(ls:*)
---

# Session evidence

Sessions to record: **$ARGUMENTS**

Turn local session transcripts into evidence files that a grader can check,
the way `docs/agent-sessions/` already does. You record what happened. You do
not judge the work, and you never fill gaps with likely-sounding facts.

## Where this comes from

- **Repeated owner instructions** (`docs/midterm/RECURRING_INSTRUCTIONS.md`):
  capture evidence, do not claim anything unverified, keep owner approvals
  visible.
- **`docs/midterm/MIDTERM_GUIDELINES.md`**, "What counts as agent-team
  evidence": each role needs an inspectable artifact and a link to a session
  or review. The agent-team log is the owner's own writing.

## Hard rules

1. **No fabrication.** Session URL is "None. Local session; no shareable URL
   was created." unless the owner gives you a link in this session. Never
   build a URL from an id. Never record a test, commit, PR, skill invocation
   or review that the transcript or git does not show.
2. **Separate the sources.** Mark a claim **verified** only when git, GitHub or
   a command you ran in this session confirms it. A claim that comes only from
   the recorded agent's own message is the **agent's report**.
3. **Classify honestly.**
   - Codex `codex-auto-review` (guardian) transcripts are permission checks,
     not reviews.
   - Configuration smoke tests are not skill invocations.
   - A subagent spawned by the implementing session is not an independent review.
   - A skill counts as invoked only if the transcript shows it was loaded or
     read by name.
4. **Redact.** Everything passes through `scripts/evidence/redact.py`. Before
   finishing, run
   `python3 -I scripts/evidence/scan_secrets.py docs/agent-sessions docs/midterm`.
   It must report 0 findings. If the owner gave you a `--known-sha256` value
   for a leaked token, pass it too. Never print a secret, even to explain a
   finding.
5. **Never commit raw transcripts**, and never copy whole long briefs. Quote
   them, truncated, through the renderer.
6. **Do not write the owner's voice.** Leave `AGENT-TEAM.md`, decisions and
   reflections to the owner.

## Procedure

1. **Extract.** Write to a scratch path outside the repository:
   `python3 -I scripts/evidence/extract_sessions.py --out <scratch>/facts.json`.
   For `latest`, choose the most recent transcript for this repository in the
   output, excluding the session you are running in.
2. **Plan.** Add or update the session's entry in `scripts/evidence/sessions.json`:
   - the next unused `number`, a `slug`, `ids` (id prefixes) and `title`;
   - a `role` that states the agent's role and its instruction file;
   - for a reviewer, whether it is independent of the builder;
   - optionally a `note`, for example that a credential was redacted.
3. **Render.** `python3 -I scripts/evidence/render_sessions.py --facts <scratch>/facts.json --only <slug>`.
   This writes the header table, the owner's instructions, the extracted record
   and commits in the session window. Text between the narrative markers is
   kept on later renders.
4. **Narrate.** Replace the placeholder between `<!-- narrative:start -->` and
   `<!-- narrative:end -->`:
   - Start with the standard sources line used in the existing files.
   - Then 3–8 bullets: what the owner asked, what was done, what was verified,
     what was not done or failed.
   - Read the transcript, or the facts file's `final_message`, for detail. Then
     check commits with `git log`/`git show` and PRs with `gh pr view`.
   - When a time-window commit could belong to an overlapping session, say so.
5. **Index.** Update the row for this session in `docs/agent-sessions/README.md`,
   and add it to the rubric rows it supports in `docs/midterm/EVIDENCE_INDEX.md`.
   Change a checklist status in `docs/midterm/REQUIREMENTS_CHECKLIST.md` only
   when the evidence now exists, and link to it.
6. **Scan and report.** Run the secret scanner. Then tell the owner:
   - which files you wrote or changed;
   - the session ids you recorded;
   - anything you could not verify;
   - the scanner result.

## Output

One `docs/agent-sessions/NN-<slug>.md` per session or session group, plus the
index updates. Do not commit unless the owner asks.

## Invocation

```text
/session-evidence latest
/session-evidence 618e460d implementation "Evidence foundation and integration preparation"
/session-evidence 01a16965 review
```

The course counts a reusable skill when it is invoked by name in at least two
separate sessions. Record each invocation of this skill in the evidence file
of the session it ran in.
