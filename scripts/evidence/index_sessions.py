"""Write the transcript inventory table for docs/agent-sessions/README.md.

Usage (repository root):
    python3 -I scripts/evidence/index_sessions.py --facts <facts.json> > <scratch>/inventory.md

Lists every local transcript the extractor found, its classification and the
evidence file that records it (from scripts/evidence/sessions.json).
"""

import argparse
import json

LABEL = {
    "claude-session": "Claude Code session",
    "codex-work-session": "Codex work session",
    "codex-subagent": "Codex subagent",
    "codex-permission-check": "Codex permission check (`codex-auto-review`); approves or denies tool calls. **Not a review.**",
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--facts", required=True)
    ap.add_argument("--plan", default="scripts/evidence/sessions.json")
    a = ap.parse_args()
    facts = json.load(open(a.facts))
    plan = json.load(open(a.plan))["files"]

    def where(rec):
        for e in plan:
            if any((rec["id"] or "").startswith(p) for p in e["ids"]):
                return f"[{e['number']:02d}]({e['number']:02d}-{e['slug']}.md)"
        return "—"

    print("| # | Tool | Session id | Started (UTC) | Model | Classification | Evidence file |")
    print("| --- | --- | --- | --- | --- | --- | --- |")
    for n, r in enumerate(facts, 1):
        kind = LABEL.get(r["kind"], r["kind"])
        if r.get("agent_path"):
            kind += f" `{r['agent_path']}`"
        print(f"| {n} | {r['tool']} | `{r['id']}` | {(r['first'] or '')[:16].replace('T', ' ')} | "
              f"{', '.join(r['models']) or '—'} | {kind} | {where(r)} |")
    counts = {}
    for r in facts:
        counts[r["kind"]] = counts.get(r["kind"], 0) + 1
    print()
    print("Totals: " + ", ".join(f"{LABEL.get(k, k).split('(')[0].split(';')[0].strip()} {v}" for k, v in sorted(counts.items())))


if __name__ == "__main__":
    main()
