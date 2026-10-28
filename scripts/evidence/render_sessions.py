"""Render the factual sections of docs/agent-sessions/*.md from extracted facts.

Usage (repository root):
    python3 -I scripts/evidence/render_sessions.py --facts <facts.json> --plan scripts/evidence/sessions.json \
        --out docs/agent-sessions [--only <slug>]

`sessions.json` (committed) lists which transcript ids make up each evidence file,
its number, slug, title and role. This script writes everything that can be
read mechanically from transcripts and git: the header table, the owner's
instructions (redacted, long ones truncated), tools/skills/subagents used, files
edited, PR links, test-summary lines and commits whose author time falls inside
the session window. It leaves one section, "What was done", between
<!-- narrative:start --> and <!-- narrative:end --> markers; existing narrative
text in the target file is preserved across re-renders.

It never creates a session link. "Session URL" is always "None" unless the plan
file supplies one the owner created.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from redact import redact  # noqa: E402

MAX_QUOTE = 420
NARR_START, NARR_END = "<!-- narrative:start -->", "<!-- narrative:end -->"


def parse_ts(s: str | None):
    if not s:
        return None
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


def git_commits() -> list[dict]:
    fmt = "%h%x1f%aI%x1f%s%x1f%(trailers:key=Co-Authored-By,valueonly,separator=;)%x1e"
    out = subprocess.run(["git", "log", "--all", "--since=2026-09-01", f"--format={fmt}"],
                         capture_output=True, text=True, check=True).stdout
    rows = []
    for rec in out.split("\x1e"):
        parts = rec.strip("\n").split("\x1f")
        if len(parts) < 4:
            continue
        sha, when, subject, trailer = parts
        if subject.startswith("Archive uncommitted Codex"):
            continue  # created while preparing this evidence, not by a historical session
        rows.append({"sha": sha, "when": parse_ts(when), "subject": subject, "coauthor": trailer.strip()})
    return rows


def clean_instruction(t: str) -> str:
    # Codex desktop wraps requests with attachment listings; keep the user's own request.
    m = re.search(r"## My request(?: for Codex)?:\s*(.+)", t, re.S)
    if m:
        files = re.findall(r"^## ([^\n:]+):", t.split("## My request")[0], re.M)
        prefix = f"[attachments: {', '.join(f.strip() for f in files)[:160]}] " if files else ""
        t = prefix + m.group(1)
    t = re.sub(r"<in-app-browser-context.*?</in-app-browser-context>", "", t, flags=re.S)
    t = re.sub(r"<pasted_content id=\"\w+\">\s*", "[pasted brief] ", t)
    t = t.replace("</pasted_content>", "")
    return re.sub(r"\s+", " ", t).strip()


def quote(t: str) -> str:
    t = clean_instruction(t)
    if len(t) > MAX_QUOTE:
        t = t[:MAX_QUOTE].rstrip() + f" … ({len(t)} characters; full text in the local transcript)"
    return t.replace("|", "\\|")


def table(rows: list[tuple[str, str]]) -> str:
    out = ["| Field | Value |", "| --- | --- |"]
    out += [f"| {k} | {v} |" for k, v in rows]
    return "\n".join(out)


def render(entry: dict, recs: list[dict], commits: list[dict]) -> str:
    first = min(parse_ts(r["first"]) for r in recs if r["first"])
    last = max(parse_ts(r["last"]) for r in recs if r["last"])
    models = sorted({m for r in recs for m in r["models"]})
    branches = sorted({b for r in recs for b in r["branches"]})
    files = [r["file"] for r in recs]
    ids = sorted({r["id"] for r in recs if r["id"]})
    tool = recs[0]["tool"]
    agent = "Claude Code (CLI)" if tool == "claude" else "Codex (desktop app)"
    rows = [
        ("Agent", f"{agent}; model id(s) recorded in the transcript: {', '.join(f'`{m}`' for m in models) or 'none recorded'}"),
        ("Role", entry["role"]),
        ("Session ID", ", ".join(f"`{i}`" for i in ids)),
    ]
    parents = sorted({r["parent_id"] for r in recs if r.get("parent_id")})
    if parents:
        rows.append(("Spawned by", ", ".join(f"`{p}`" for p in parents) +
                     (f" (agent path `{recs[0]['agent_path']}`)" if recs[0].get("agent_path") else "")))
    rows += [
        ("Window (UTC)", f"{first:%Y-%m-%d %H:%M} → {last:%Y-%m-%d %H:%M}"),
        ("Session URL", entry.get("url") or "None. Local session; no shareable URL was created."),
        ("Repository", "`https://github.com/SaadSatter/oath_and_ember`" +
         (f", branch(es) {', '.join(f'`{b}`' for b in branches)}" if branches else "")),
        ("Transcript", "Local only, not committed: " + "; ".join(f"`{f}`" for f in files)),
    ]
    md = [f"# {entry['number']:02d} — {entry['title']}", "", table(rows), ""]
    if entry.get("note"):
        md += [f"> {entry['note']}", ""]

    md += ["## Owner instructions (redacted)", ""]
    instr = []
    for r in recs:
        items = r["instructions"]
        if r["kind"] == "codex-subagent" and items:
            items = items[-1:]  # earlier entries are the parent's context, inherited at spawn
        instr += items
    seen = set()
    n = 0
    for i in sorted(instr, key=lambda x: x["ts"] or ""):
        q = quote(i["text"])
        if not q or q in seen:
            continue
        seen.add(q)
        n += 1
        md.append(f"{n}. {(i['ts'] or '')[:16].replace('T', ' ')} — {q}")
    if not n:
        md.append("No human-typed instruction is recorded in this transcript (task passed by a parent agent or tool).")
    md.append("")

    md += [NARR_START, "## What was done", "", "_To be written from the transcript; facts only._", NARR_END, ""]

    md += ["## Mechanically extracted record", ""]
    skills = sorted({s for r in recs for s in r["skills"]})
    subs = sorted({s for r in recs for s in r["subagents"]})
    md.append(f"- Skills used: {', '.join(f'`{s}`' for s in skills) or 'none'}")
    md.append(f"- Subagents used: {', '.join(f'`{s}`' for s in subs) or 'none'}")
    prs = sorted({p for r in recs for p in r["prs"]}, key=lambda u: int(u.rsplit('/', 1)[1]))
    example = " (the example URL quoted in MIDTERM_GUIDELINES.md was also printed; it is not a PR of this project and is not listed)" if any(r.get("example_prs_seen") for r in recs) else ""
    md.append(f"- Pull requests referenced in tool output: {', '.join(prs) or 'none'}{example}")
    edited = sorted({f for r in recs for f in r["files_edited"]})
    if edited:
        top: dict[str, int] = {}
        for f in edited:
            key = re.sub(r"^.*?/oath_and_ember[^/]*/", "", f)
            key = "/".join(key.split("/")[:2])
            top[key] = top.get(key, 0) + 1
        md.append(f"- Files edited through the agent's edit/patch tool: {len(edited)} (" +
                  ", ".join(f"`{k}` {v}" for k, v in sorted(top.items(), key=lambda kv: -kv[1])[:10]) + ")")
    else:
        md.append("- Files edited through the agent's edit/patch tool: none recorded (edits made by shell commands are not counted)")
    tests = []
    for r in recs:
        for t in r["test_lines"]:
            if t not in tests:
                tests.append(t)
    if tests:
        md.append(f"- Test-summary lines printed in tool output (last {min(6, len(tests))} distinct, as printed):")
        md += [f"  - `{t}`" for t in tests[-6:]]
    else:
        md.append("- Test-summary lines printed in tool output: none found")
    if any(r["typecheck_errors_seen"] for r in recs):
        md.append("- TypeScript errors (`error TS…`) appeared in tool output at least once during the session.")
    inside = [c for c in commits if first <= c["when"] <= last]
    if inside:
        md += ["", "Commits whose author time falls inside this window (any branch). A time match is not proof of"
               " authorship when sessions overlap; the co-author trailer is shown where present.", "",
               "| Commit | Author time (UTC) | Subject | Co-author trailer |", "| --- | --- | --- | --- |"]
        for c in inside:
            md.append(f"| `{c['sha']}` | {c['when'].astimezone(dt.timezone.utc):%Y-%m-%d %H:%M} | "
                      f"{redact(c['subject']).replace('|', '/')} | {c['coauthor'] or '—'} |")
    else:
        md.append("- Commits inside the session window: none")
    md.append("")
    return "\n".join(md)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--facts", required=True)
    ap.add_argument("--plan", default="scripts/evidence/sessions.json")
    ap.add_argument("--out", default="docs/agent-sessions")
    ap.add_argument("--only")
    a = ap.parse_args()
    facts = json.load(open(a.facts))
    plan = json.load(open(a.plan))
    commits = git_commits()
    os.makedirs(a.out, exist_ok=True)
    for entry in plan["files"]:
        if a.only and entry["slug"] != a.only:
            continue
        recs = [r for r in facts if any((r["id"] or "").startswith(p) and
                (not entry.get("file_contains") or entry["file_contains"] in r["file"])
                for p in entry["ids"])]
        if not recs:
            print(f"skip {entry['slug']}: no transcript found", file=sys.stderr)
            continue
        path = os.path.join(a.out, f"{entry['number']:02d}-{entry['slug']}.md")
        body = render(entry, recs, commits)
        if os.path.exists(path):
            old = open(path).read()
            if NARR_START in old and NARR_END in old:
                keep = old[old.index(NARR_START): old.index(NARR_END) + len(NARR_END)]
                body = body[: body.index(NARR_START)] + keep + body[body.index(NARR_END) + len(NARR_END):]
        open(path, "w").write(body)
        print(f"wrote {path} ({len(recs)} transcript file(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
