"""Count which instructions the owner gave repeatedly, before and after midterm work began.

Usage (repository root):
    python3 -I scripts/evidence/recurring_instructions.py --facts <facts.json> \
        [--attachments ~/.codex/attachments] [--cutoff 2026-10-22] > docs/midterm/RECURRING_INSTRUCTIONS.data.md

Sources:
  * Long pasted briefs: Codex attachment files (`~/.codex/attachments/*/*.txt` that mention the game)
    and `<pasted_content>` blocks or messages over 1,500 characters in Claude transcripts.
  * Short chat instructions: every other human-typed instruction in the extracted facts.
Not counted: `AGENTS.md` (injected automatically into every Codex session and imported by
CLAUDE.md), which is configuration rather than a repeated instruction, and text written by agents.

The cutoff date splits "historical" instructions from those introduced for the midterm:
the midterm architecture brief was pasted on 2026-10-22. The output is a Markdown fragment.
Each theme's regular expression is printed with the counts so the method can be inspected.
"""

from __future__ import annotations

import argparse
import datetime as dt
import glob
import json
import os
import re
import sys

# Word boundaries matter: a bare "ember" also matches "remember" and "November".
GAME = re.compile(r"\boath\b|\bsieg\b|\bcoco\b|\bember\b|emberbrook", re.I)

THEMES: list[tuple[str, str, str]] = [
    ("server-authority", "Server owns gameplay truth; clients submit intent",
     r"authoritative|server[- ]owned|server owns|clients? (?:submit|send)s? intent|never trust"),
    ("preserve-rules-art", "Preserve existing rules, mechanics and approved artwork",
     r"preserv(?:e|ing) (?:the )?(?:existing|current|approved|all|gameplay|rules|mechanic|puzzle|artwork|source)"
     r"|(?:do not|don.t|never) (?:change|alter|modify|weaken|rewrite)"),
    ("test-triad", "Validate with typecheck, tests and build",
     r"typecheck|npm test|npm run build|integration tests?|regression tests?"),
    ("approval-gates", "Stop for owner approval before the next phase",
     r"for (?:my )?approval|wait for (?:my )?approval|stop (?:after|before)|before (?:implementing|changing|proceeding)|ask (?:me )?before|(?:I|owner) approve"),
    ("no-overclaim", "Do not claim unverified results",
     r"fabricat|(?:do not|don.t|never) (?:claim|invent|imply|overstate|present)|overclaim|unverified|not (?:yet )?verified"),
    ("evidence-capture", "Capture evidence: screenshots, recordings, traces, provenance",
     r"evidence|screenshots?|recorded video|record(?:ing)? (?:a|the)? ?video|video of the play|play ?through|trace|provenance"),
    ("real-mechanics", "Use real gameplay mechanics; no fixtures or teleports as a substitute",
     r"real (?:gameplay|game|engine|inputs?|browser)|ordinary (?:inputs?|intents?)|no (?:teleport|fixture)"
     r"|without (?:teleport|fixture|bypass)|instead of teleport|not (?:by )?teleport"),
    ("two-client-sync", "Check both players / two clients stay synchronized",
     r"both (?:clients|browsers|players|heroes)|two (?:clients|browsers|real)|multiplayer|synchroni[sz]"),
    ("information-boundary", "Agents see only player-visible information; no hidden-state leakage",
     r"leak|hidden (?:state|information|flags)|answer key|information boundar|(?<!multi)player-visible|only what (?:a|the) player"),
    ("baseline-evaluation", "Baseline, model player, evaluation suite and limits",
     r"baseline|model[- ]driven|evaluation suite|held[- ]out|step limit|model[- ]call"),
    ("independent-review", "Independent, read-only review",
     r"independent review|read[- ]only review|reviewer"),
]


def briefs(facts: list[dict], attach_dir: str) -> list[dict]:
    out = []
    for path in glob.glob(os.path.join(attach_dir, "*", "*.txt")):
        text = open(path, errors="ignore").read()
        if not GAME.search(text):
            continue
        when = dt.datetime.fromtimestamp(os.path.getmtime(path)).date()
        out.append({"source": "codex-attachment", "id": os.path.basename(os.path.dirname(path))[:8],
                    "date": when, "title": text.strip().splitlines()[0][:80], "text": text})
    for r in facts:
        if r["tool"] != "claude":
            continue
        for i in r["instructions"]:
            t = i["text"]
            if "[pasted brief]" in t or "<pasted_content" in t or len(t) > 1500:
                if t.startswith(("<bash", "This session is being continued")):
                    continue
                body = re.sub(r"<pasted_content id=\"\w+\">\s*", "", t).strip()
                out.append({"source": "claude-pasted", "id": r["id"][:8],
                            "date": dt.date.fromisoformat(i["ts"][:10]), "title": body.splitlines()[0][:80], "text": body})
    return sorted(out, key=lambda b: b["date"])


def chat(facts: list[dict]) -> list[dict]:
    out = []
    for r in facts:
        if r["kind"] not in ("claude-session", "codex-work-session"):
            continue
        for i in r["instructions"]:
            t = i["text"]
            if len(t) > 1500 or "<pasted_content" in t:
                continue
            out.append({"id": r["id"][:8], "tool": r["tool"], "date": dt.date.fromisoformat(i["ts"][:10]), "text": t})
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--facts", required=True)
    ap.add_argument("--attachments", default=os.path.expanduser("~/.codex/attachments"))
    ap.add_argument("--cutoff", default="2026-10-22")
    a = ap.parse_args()
    cutoff = dt.date.fromisoformat(a.cutoff)
    facts = json.load(open(a.facts))
    B = briefs(facts, a.attachments)
    C = chat(facts)
    pre_b = [b for b in B if b["date"] < cutoff]
    post_b = [b for b in B if b["date"] >= cutoff]
    pre_c = [c for c in C if c["date"] < cutoff]
    post_c = [c for c in C if c["date"] >= cutoff]

    print(f"Generated by `scripts/evidence/recurring_instructions.py` (cutoff {cutoff}).\n")
    print(f"- Pasted briefs: {len(B)} ({len(pre_b)} before the cutoff, {len(post_b)} on or after).")
    print(f"- Short chat instructions in implementation sessions: {len(C)} ({len(pre_c)} before, {len(post_c)} on or after).")
    print("- A theme counts once per brief, and once per session for chat instructions.\n")
    print("| Theme | Briefs before cutoff | Briefs from cutoff | Sessions with a chat instruction (before / from) | First seen | Classification |")
    print("| --- | --- | --- | --- | --- | --- |")
    for key, label, rx in THEMES:
        pat = re.compile(rx, re.I)
        nb_pre = sum(1 for b in pre_b if pat.search(b["text"]))
        nb_post = sum(1 for b in post_b if pat.search(b["text"]))
        sc_pre = len({c["id"] for c in pre_c if pat.search(c["text"])})
        sc_post = len({c["id"] for c in post_c if pat.search(c["text"])})
        dates = [b["date"] for b in B if pat.search(b["text"])] + [c["date"] for c in C if pat.search(c["text"])]
        first = min(dates).isoformat() if dates else "—"
        pre_total_sessions = len({b["id"] for b in pre_b if pat.search(b["text"])}) + sc_pre
        if nb_pre >= 3 or pre_total_sessions >= 3:
            cls = "Historical, repeated"
        elif nb_pre + sc_pre >= 1:
            cls = "Historical, occasional"
        else:
            cls = "Introduced for the midterm"
        print(f"| {label} (`{key}`) | {nb_pre}/{len(pre_b)} | {nb_post}/{len(post_b)} | {sc_pre} / {sc_post} | {first} | {cls} |")
    print("\n### Briefs counted\n")
    print("| Date | Source | Id | First line |")
    print("| --- | --- | --- | --- |")
    for b in B:
        print(f"| {b['date']} | {b['source']} | `{b['id']}` | {b['title'].replace('|', '/')} |")
    print("\n### Theme patterns\n")
    for key, _, rx in THEMES:
        print(f"- `{key}`: `{rx}`")
    return 0


if __name__ == "__main__":
    sys.exit(main())
