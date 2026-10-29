#!/usr/bin/env python3
"""Collect and verify the Hedge Maze (S2-local) evaluation evidence.

    python3 -I scripts/midterm/collect_evidence.py                 collect, then write the manifest
    python3 -I scripts/midterm/collect_evidence.py --verify        check the committed evidence
    python3 -I scripts/midterm/collect_evidence.py --videos-out D  also copy the videos to D (outside git)

Run from the project root: the oath_and_ember repository root, or
midterms/saadsatter/ in the course repository (--verify only there).

Collect reads the owner's local run folders in evaluation-runs/ (gitignored)
and copies each run's trace and metadata into midterms/saadsatter/evidence/.
It never overwrites: an existing destination must already be byte-identical.
Before copying, every published number in EVIDENCE below is checked against
the run's own summary.json, every trace's hash chain is verified (the same
rule as verifyTrace in packages/agent/src/trace.ts), and each replay's
manifest must name the SHA-256 of the trace it replays. Videos are never
copied into the repository; their checksums are recorded and --videos-out
copies them to a separate folder for upload.

--verify needs no local run folders. It re-hashes every packaged file
against the committed manifest, re-checks the trace chains and re-derives
each outcome from the packaged summary. Source files that exist locally are
re-hashed too; missing ones are reported, not failed.
"""
import argparse, hashlib, json, os, shutil, statistics, sys

STAGE = "midterms/saadsatter/"
MANIFEST = "evidence/manifests/evidence-manifest.json"
TABLE = "evidence/manifests/evidence-manifest.md"
LIVE = "evaluation-runs/live/"

# Each run, what is published about it, and where its files go.
# Paths: "source" is relative to the oath_and_ember repository root;
# "dest" is relative to the submission folder (midterms/saadsatter/).
# "expect" holds the numbers the documentation publishes; collection stops if
# the run's summary.json disagrees.
EVIDENCE = [
    {
        "id": "baseline-quest-live", "pilot": None, "policy": "baseline-quest", "comparison": "primary",
        "label": "Scripted reference baseline, live viewer recording",
        "source": LIVE + "S2-local-seed0-baseline-quest-2026-10-29T15-02-46-420Z",
        "dest": "evidence/traces/baseline-quest-S2-local-seed0-live",
        "files": {"summary": "S2-local-seed0/summary.json", "trace": "S2-local-seed0/trace.jsonl",
                  "run": "run.json", "launch": "live.json", "results": "results.json",
                  "results_table": "results.md", "recording_manifest": "recording.json"},
        "video": "recording.webm", "recording_type": "live",
        "stop": "success predicate (Enchanted Shears in the shared backpack)",
        "expect": {"status": "success", "reason": "success", "gameTicks": 2990, "gameSeconds": 49.8,
                   "decisions": 340, "invalid": 0, "messages": 6, "calls": 0, "charged": 0,
                   "startHash": "2b9eddd41bdd6a25457eb66d7d5b3dde66047b2d9103b4be334b378497c8b53e",
                   "endHash": "bf31311f6c56638bc7e5a6a45b9eaa621fa5042963c6e7c477e2ce74e729f936"},
    },
    *[
        {
            "id": f"baseline-quest-repro-{i}", "pilot": None, "policy": "baseline-quest", "comparison": "primary",
            "label": f"Scripted reference baseline, offline reproducibility run {i} of 3 (2026-10-29)",
            "source": f"evaluation-runs/repro-baseline-quest-S2-local-2026-10-29/run-{i}",
            "dest": f"evidence/traces/baseline-quest-S2-local-seed0-repro/run-{i}",
            "files": {"summary": "S2-local-seed0/summary.json", "run": "run.json",
                      "results_table": "results.md"},
            "uncopied": {"trace": "S2-local-seed0/trace.jsonl"},
            "video": None, "recording_type": "none",
            "stop": "success predicate (Enchanted Shears in the shared backpack)",
            "expect": {"status": "success", "reason": "success", "gameTicks": 2990, "gameSeconds": 49.8,
                       "decisions": 340, "invalid": 0, "messages": 6, "calls": 0, "charged": 0,
                       "startHash": "2b9eddd41bdd6a25457eb66d7d5b3dde66047b2d9103b4be334b378497c8b53e",
                       "endHash": "bf31311f6c56638bc7e5a6a45b9eaa621fa5042963c6e7c477e2ce74e729f936"},
        }
        for i in (1, 2, 3)
    ],
    {
        "id": "pilot-11", "pilot": "pilot-11", "policy": "model-guided", "comparison": "primary",
        "label": "Walkthrough-guided LLM pair, success; trace-verified replay video",
        # Already committed by the owner's request (2026-10-29); referenced in place, not duplicated.
        "source": "docs/midterm/evidence/pilot-11-model-guided",
        "local_original": LIVE + "First successful S2 Hedge Maze AI Agents",
        "dest": None, "in_place": "docs/midterm/evidence/pilot-11-model-guided",
        "files": {"summary": "summary.json", "trace": "trace.jsonl", "run": "run.json", "launch": "live.json",
                  "results": "results.json", "results_table": "results.md",
                  "recording_manifest": "replay-recording.json"},
        "video": "replay.webm", "recording_type": "replay",
        "video_note": "committed in SaadSatter/oath_and_ember (owner's request, 2026-10-29); excluded from the course package by MANIFEST.txt (!*.webm)",
        "stop": "success predicate (Enchanted Shears in the shared backpack)",
        "expect": {"status": "success", "reason": "success", "gameTicks": 2316, "gameSeconds": 38.6,
                   "decisions": 177, "invalid": 0, "messages": 19, "calls": 147, "charged": 0.083545,
                   "startHash": "2b9eddd41bdd6a25457eb66d7d5b3dde66047b2d9103b4be334b378497c8b53e",
                   "endHash": "94b8bb89e4e5b8397eb343d3b5b572867e1858828caadf3a3fe6c4f6267888d9"},
    },
    {
        "id": "pilot-12", "pilot": "pilot-12", "policy": "model-guided", "comparison": "primary",
        "label": "Walkthrough-guided LLM pair, success; trace-verified replay video (the live capture failed to save)",
        "source": LIVE + "S2-local-seed0-model-guided-openai-2026-10-29T05-45-46-564Z",
        "dest": "evidence/traces/pilot-12-model-guided-S2-local-seed0",
        "files": {"summary": "S2-local-seed0/summary.json", "trace": "S2-local-seed0/trace.jsonl",
                  "run": "run.json", "launch": "live.json", "results": "results.json",
                  "results_table": "results.md", "live_recording_manifest": "recording.json",
                  "recording_manifest": "replay/recording.json"},
        "video": "replay/recording.webm", "recording_type": "replay",
        "stop": "success predicate (Enchanted Shears in the shared backpack)",
        "expect": {"status": "success", "reason": "success", "gameTicks": 2638, "gameSeconds": 44.0,
                   "decisions": 194, "invalid": 0, "messages": 21, "calls": 164, "charged": 0.088321,
                   "startHash": "2b9eddd41bdd6a25457eb66d7d5b3dde66047b2d9103b4be334b378497c8b53e",
                   "endHash": "f06df522d04f5af41c500a54fa1dc389a98601ecfa948916e202d5d68588694d"},
    },
    {
        "id": "pilot-13", "pilot": "pilot-13", "policy": "model-memory", "comparison": "primary",
        "label": "Unaided LLM pair with persistent memory; reached the key gate, stopped by the owner",
        "source": LIVE + "S2-local-seed0-model-memory-openai-2026-10-29T06-09-56-277Z",
        "dest": "evidence/traces/pilot-13-model-memory-S2-local-seed0",
        "files": {"summary": "S2-local-seed0/summary.json", "trace": "S2-local-seed0/trace.jsonl",
                  "run": "run.json", "launch": "live.json", "results": "results.json",
                  "results_table": "results.md", "live_recording_manifest": "recording.json",
                  "recording_manifest": "replay/recording.json"},
        "video": "replay/recording.webm", "recording_type": "replay",
        "stop": "manual_stop by the owner after the key gate refused the heroes (no key)",
        "expect": {"status": "terminated", "reason": "manual_stop", "gameTicks": 4568, "gameSeconds": 76.1,
                   "decisions": 434, "invalid": 0, "messages": 76, "calls": 386, "charged": 0.323391,
                   "startHash": "2b9eddd41bdd6a25457eb66d7d5b3dde66047b2d9103b4be334b378497c8b53e",
                   "endHash": "df3a574b657b0fd35c67929f5b0f4372479e757257194484e267f4922a4d185f"},
    },
    {
        "id": "pilot-15", "pilot": "pilot-15", "policy": "model-memory", "comparison": "primary",
        "label": "Unaided LLM pair with persistent memory; interrupted by the owner at the cow puzzle; live video",
        "source": LIVE + "S2-local-seed0-model-memory-openai-2026-10-29T14-31-49-822Z",
        "dest": "evidence/traces/pilot-15-model-memory-S2-local-seed0",
        "files": {"summary": "S2-local-seed0/summary.json", "trace": "S2-local-seed0/trace.jsonl",
                  "run": "run.json", "launch": "live.json", "results": "results.json",
                  "results_table": "results.md", "recording_manifest": "recording.json"},
        "video": "recording.webm", "recording_type": "live",
        "stop": "manual_stop by the owner while both heroes were at the cow (an interrupted trial, not a terminal failure)",
        "expect": {"status": "terminated", "reason": "manual_stop", "gameTicks": 2010, "gameSeconds": 33.5,
                   "decisions": 199, "invalid": 1, "messages": 20, "calls": 173, "charged": 0.123454,
                   "startHash": "2b9eddd41bdd6a25457eb66d7d5b3dde66047b2d9103b4be334b378497c8b53e",
                   "endHash": "669a2e2cdb2ef84e649a75b1f9c549353e1bccecbd169acf3308cd1bacadfcdf"},
    },
]

# Earlier paid pilots: inventoried with checksums, not copied, not part of the comparison.
HISTORICAL = [
    ("pilot-2", "model-history", LIVE + "S1-seed0-model-history-anthropic-2026-10-28T00-52-06-030Z", "S1-seed0", "S1, Anthropic"),
    ("pilot-4", "model-history", LIVE + "S2-seed0-model-history-openai-2026-10-28T05-45-18-865Z", "S2-seed0", "suite revision 1: S2 was Mirror Pond"),
    ("pilot-5", "model-history", LIVE + "S2-seed0-model-history-openai-2026-10-28T17-08-29-877Z", "S2-seed0", "suite revision 1: S2 was Mirror Pond"),
    ("pilot-6", "model-history", LIVE + "S2-seed0-model-history-openai-2026-10-28T17-52-53-702Z", "S2-seed0", "suite revision 1: S2 was Mirror Pond"),
    ("pilot-7", "model-history", LIVE + "S2-local-seed0-model-history-openai-2026-10-28T21-54-43-337Z", "S2-local-seed0", "suite revision 1: S2-local was Mirror Pond"),
    ("pilot-8", "model-history", LIVE + "S2-local-seed0-model-history-openai-2026-10-29T01-41-38-331Z", "S2-local-seed0", "suite revision 1: S2-local was Mirror Pond"),
    ("pilot-9", "model-history", LIVE + "S2-local-seed0-model-history-openai-2026-10-29T03-03-42-084Z", "S2-local-seed0", "Hedge Maze, before the pilot-9 interface fixes"),
    ("pilot-10", "model-history", LIVE + "S2-local-seed0-model-history-openai-2026-10-29T04-35-10-438Z", "S2-local-seed0", "Hedge Maze"),
    ("pilot-14", "model-memory", LIVE + "S2-local-seed0-model-memory-openai-2026-10-29T14-29-21-174Z", "S2-local-seed0", "Hedge Maze; stopped at 1.6 s, pilot-15 was launched from the same commit a minute later"),
    ("pilot-16", "model-guided", LIVE + "S3-local-seed0-model-guided-openai-2026-10-29T14-53-53-771Z", "S3-local-seed0", "Mirror Pond, guided (exploratory, outside the Hedge Maze comparison)"),
]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def chain_ok(path):
    """The verifyTrace rule: seq increments, prev links, hash = sha256(JSON of the line without hash)."""
    prev = "0" * 64
    with open(path, encoding="utf-8") as f:
        for i, line in enumerate(f):
            try:
                body = json.loads(line)
                h = body.pop("hash")
            except (ValueError, KeyError, AttributeError):
                return f"line {i} is not a trace record"
            text = json.dumps(body, separators=(",", ":"), ensure_ascii=False)
            if body.get("seq") != i or body.get("prev") != prev or hashlib.sha256(text.encode()).hexdigest() != h:
                return f"hash chain broken at line {i}"
            prev = h
    return None


def median_latency(trace_path):
    lat = []
    with open(trace_path, encoding="utf-8") as f:
        for line in f:
            j = json.loads(line)
            if j["type"] == "model_call" and isinstance(j["data"].get("latencyMs"), (int, float)):
                lat.append(j["data"]["latencyMs"])
    return round(statistics.median(lat) / 1000, 1) if lat else None


def outcome(summary, trace_path=None):
    s = summary
    total = lambda d: sum((d or {}).values())
    out = {
        "status": s["status"], "reason": s["reason"], "success": s["success"],
        "gameTicks": s["gameTicks"], "gameSeconds": s["gameSeconds"], "wallSeconds": s["wallSeconds"],
        "decisions": total(s["decisions"]), "invalid": total(s["invalidActions"]),
        "messages": total(s["messages"]), "calls": s["modelCalls"]["attempted"],
        "failedCalls": s["modelCalls"]["failed"], "tokensIn": s["tokens"]["input"],
        "tokensOut": s["tokens"]["output"], "charged": s["spendUsd"]["charged"],
        "startHash": s["startHash"], "endHash": s["endHash"],
    }
    if trace_path and s["modelCalls"]["attempted"]:
        out["medianLatencySeconds"] = median_latency(trace_path)
    return out


class Paths:
    def __init__(self):
        if os.path.isdir(STAGE):
            self.mode, self.prefix = "repository", STAGE
        elif os.path.isfile(MANIFEST):
            self.mode, self.prefix = "course", ""
        else:
            sys.exit("Run from the oath_and_ember repository root or from midterms/saadsatter/.")

    def sub(self, p):
        """A submission-folder path, on disk from here."""
        return self.prefix + p if p.startswith("evidence/") else p


def fail(errors):
    for e in errors:
        print("FAIL", e)
    sys.exit(1)


def collect(paths, videos_out):
    errors, entries = [], []
    for e in EVIDENCE:
        src = e["source"]
        if not os.path.isdir(src):
            errors.append(f"{e['id']}: source folder missing: {src}")
            continue
        summary = json.load(open(os.path.join(src, e["files"]["summary"])))
        trace_rel = e["files"].get("trace") or e.get("uncopied", {}).get("trace")
        trace_src = os.path.join(src, trace_rel)
        broken = chain_ok(trace_src)
        if broken:
            errors.append(f"{e['id']}: {trace_src}: {broken}")
        got = outcome(summary, trace_src)
        for k, v in e["expect"].items():
            if got[k] != v:
                errors.append(f"{e['id']}: published {k}={v!r} but summary.json says {got[k]!r}")
        trace_sha = sha256(trace_src)
        rec = None
        if e["recording_type"] != "none":
            meta = json.load(open(os.path.join(src, e["files"]["recording_manifest"])))
            rec = {"type": e["recording_type"], "captureWallSeconds": meta.get("wallSeconds"),
                   "resolution": meta.get("resolution"), "viewerGitHash": meta.get("gitHash"),
                   "delivery": "pending: not in git; upload and link (see evidence/README.md)"}
            if e["recording_type"] == "replay":
                rec["matchesTrace"] = meta.get("matchesTrace")
                rec["replaysTraceSha256"] = meta["source"]["sha256"]
                rec["ledgerEntry"] = meta["source"].get("ledgerEntry")
                if meta["source"]["sha256"] != trace_sha or meta.get("matchesTrace") is not True:
                    errors.append(f"{e['id']}: replay manifest does not match this trace")
            else:
                ep = meta.get("episode") or {}
                if meta.get("status") != "saved" or ep.get("endHash") != got["endHash"]:
                    errors.append(f"{e['id']}: live recording manifest is not a saved capture of this episode")
        files = []
        for kind, rel in e["files"].items():
            s = os.path.join(src, rel)
            if e["dest"]:
                d = f"{e['dest']}/{os.path.basename(rel) if kind != 'live_recording_manifest' else 'live-recording.json'}"
                if kind == "recording_manifest" and e["recording_type"] == "replay":
                    d = f"{e['dest']}/replay-recording.json"
                dd = paths.sub(d)
                if os.path.exists(dd):
                    if sha256(dd) != sha256(s):
                        errors.append(f"{e['id']}: {dd} exists and differs from {s}; not overwritten")
                else:
                    os.makedirs(os.path.dirname(dd), exist_ok=True)
                    shutil.copy2(s, dd)
            else:
                d = f"{e['in_place']}/{rel}"
            files.append({"kind": kind, "source": s, "dest": d, "bytes": os.path.getsize(s), "sha256": sha256(s), "copied": True})
        for kind, rel in e.get("uncopied", {}).items():
            s = os.path.join(src, rel)
            files.append({"kind": kind, "source": s, "dest": None, "bytes": os.path.getsize(s), "sha256": sha256(s), "copied": False})
        if e.get("local_original"):
            lo = os.path.join(e["local_original"], "S2-local-seed0/trace.jsonl")
            if os.path.exists(lo) and sha256(lo) != trace_sha:
                errors.append(f"{e['id']}: committed trace differs from the owner's original run folder")
        if e["video"]:
            v = os.path.join(src, e["video"])
            vid = {"kind": "video", "source": v, "dest": None, "bytes": os.path.getsize(v), "sha256": sha256(v), "copied": False}
            if e.get("video_note"):
                vid["note"] = e["video_note"]
            name = f"{e['id']}-{e['recording_type']}.webm"
            vid["bundleName"] = f"recordings/{name}"
            if videos_out:
                out = os.path.join(videos_out, "recordings", name)
                os.makedirs(os.path.dirname(out), exist_ok=True)
                if os.path.exists(out):
                    if sha256(out) != vid["sha256"]:
                        errors.append(f"{out} exists and differs; not overwritten")
                else:
                    shutil.copy2(v, out)
                    if sha256(out) != vid["sha256"]:
                        errors.append(f"{out}: checksum mismatch after copy")
            files.append(vid)
        entries.append({
            "id": e["id"], "pilot": e["pilot"], "policy": e["policy"], "comparison": e["comparison"],
            "label": e["label"], "scenario": summary["situation"], "suiteRevision": summary["suiteRevision"],
            "seed": summary["seed"], "gitHash": summary["gitHash"], "models": summary.get("modelIds") or [],
            "gateway": (json.load(open(os.path.join(src, e["files"]["run"]))).get("model") or {}).get("gateway"),
            "stop": e["stop"], "outcome": got, "recording": rec, "files": files,
        })
    historical = []
    for pid, policy, src, sub, note in HISTORICAL:
        sp, tp = os.path.join(src, sub, "summary.json"), os.path.join(src, sub, "trace.jsonl")
        if not os.path.exists(sp):
            errors.append(f"{pid}: missing {sp}")
            continue
        s = json.load(open(sp))
        if chain_ok(tp):
            errors.append(f"{pid}: trace chain broken")
        historical.append({"pilot": pid, "policy": policy, "scenario": s["situation"], "suiteRevision": s.get("suiteRevision", 1),
                           "seed": s["seed"], "gitHash": s["gitHash"], "models": s.get("modelIds") or [], "note": note,
                           "outcome": outcome(s, tp),
                           "files": [{"kind": "summary", "source": sp, "sha256": sha256(sp), "copied": False},
                                     {"kind": "trace", "source": tp, "sha256": sha256(tp), "copied": False}]})
    if errors:
        fail(errors)
    manifest = {
        "about": "Hedge Maze (S2-local) evaluation evidence. Generated by scripts/midterm/collect_evidence.py; check with --verify. "
                 "Sources are relative to the oath_and_ember repository root (evaluation-runs/ is local and gitignored); "
                 "dest paths are relative to the submission folder midterms/saadsatter/.",
        "observationOnly": "model-obs-only has never been run: no evidence exists for it.",
        "entries": entries, "historical": historical,
    }
    os.makedirs(os.path.dirname(paths.sub(MANIFEST)), exist_ok=True)
    with open(paths.sub(MANIFEST), "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    with open(paths.sub(TABLE), "w") as f:
        f.write(table(manifest))
    print(f"collected {len(entries)} runs, inventoried {len(historical)} historical pilots; wrote {paths.sub(MANIFEST)}")


def table(m):
    rows = ["# Evidence manifest (generated)", "",
            "Generated by `scripts/midterm/collect_evidence.py` from `evidence-manifest.json`; do not edit by hand. "
            "Game seconds are authoritative episode time (60 ticks per second). Videos are not in git.", "",
            "## Hedge Maze runs", "",
            "| Evidence | Pilot | Policy | Scenario / seed | Git | Outcome | Game s | Decisions | Invalid | Messages | Calls | Charged USD | Recording | Start → end hash |",
            "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
    for e in m["entries"]:
        o = e["outcome"]
        rec = e["recording"]["type"] if e["recording"] else "none"
        rows.append(f"| `{e['id']}` | {e['pilot'] or '—'} | `{e['policy']}` | {e['scenario']} / {e['seed']} | `{e['gitHash']}` | "
                    f"{o['status']} ({o['reason']}) | {o['gameSeconds']} | {o['decisions']} | {o['invalid']} | {o['messages']} | "
                    f"{o['calls']} | {o['charged']} | {rec} | `{o['startHash'][:8]}…` → `{o['endHash'][:8]}…` |")
    rows += ["", "## Files", "", "| Evidence | Kind | Destination (submission folder) | Bytes | SHA-256 |", "| --- | --- | --- | --- | --- |"]
    for e in m["entries"]:
        for fl in e["files"]:
            if fl["dest"]:
                dest = f"`{fl['dest']}`"
            elif fl.get("note"):
                dest = f"`{fl['source']}`: {fl['note']}"
            else:
                dest = "not copied: local `" + fl["source"] + "`" + (f"; video bundle `{fl['bundleName']}`" if fl.get("bundleName") else "")
            rows.append(f"| `{e['id']}` | {fl['kind']} | {dest} | {fl['bytes']:,} | `{fl['sha256']}` |")
    rows += ["", "## Historical pilots (inventory only, not copied, not in the comparison)", "",
             "| Pilot | Policy | Scenario (rev.) | Git | Outcome | Game s | Calls | Charged USD | Note |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
    for h in m["historical"]:
        o = h["outcome"]
        rows.append(f"| {h['pilot']} | `{h['policy']}` | {h['scenario']} (rev. {h['suiteRevision']}) | `{h['gitHash']}` | {o['status']} ({o['reason']}) | "
                    f"{o['gameSeconds']} | {o['calls']} | {o['charged']} | {h['note']} |")
    rows += ["", m["observationOnly"], ""]
    return "\n".join(rows)


def verify(paths):
    errors, notes, checked = [], [], 0
    m = json.load(open(paths.sub(MANIFEST)))
    for e in m["entries"]:
        for fl in e["files"]:
            if fl["copied"]:
                p = paths.sub(fl["dest"])
                if not os.path.exists(p):
                    # pilot-11's video is linked, not packaged, in the course folder.
                    (notes if fl["kind"] == "video" else errors).append(f"{e['id']}: missing {p}")
                    continue
                if sha256(p) != fl["sha256"]:
                    errors.append(f"{e['id']}: {p} checksum differs from the manifest")
                checked += 1
                if fl["kind"] == "trace" and chain_ok(p):
                    errors.append(f"{e['id']}: {p}: {chain_ok(p)}")
                if fl["kind"] == "summary":
                    trace = next((paths.sub(x["dest"]) for x in e["files"] if x["kind"] == "trace" and x["copied"]), None)
                    if outcome(json.load(open(p)), trace) != e["outcome"]:
                        errors.append(f"{e['id']}: outcome in the manifest differs from {p}")
            if paths.mode == "repository" and os.path.exists(fl["source"]):
                if sha256(fl["source"]) != fl["sha256"]:
                    errors.append(f"{e['id']}: source {fl['source']} changed since collection")
            elif paths.mode == "repository" and not fl["copied"]:
                notes.append(f"{e['id']}: local source not present: {fl['source']}")
    if paths.mode == "repository":
        for e in EVIDENCE:
            if e["id"] not in {x["id"] for x in m["entries"]}:
                errors.append(f"{e['id']} is declared but not in the manifest; re-run collection")
    if errors:
        fail(errors)
    for n in notes:
        print("note", n)
    print(f"verified {checked} packaged files against {paths.sub(MANIFEST)}: OK")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verify", action="store_true")
    ap.add_argument("--videos-out", help="folder outside the repository for the video bundle")
    a = ap.parse_args()
    paths = Paths()
    if a.verify:
        verify(paths)
        return
    if paths.mode != "repository":
        sys.exit("Collection runs in the oath_and_ember repository, where evaluation-runs/ exists.")
    if a.videos_out and os.path.abspath(a.videos_out).startswith(os.path.abspath(".") + os.sep):
        sys.exit("--videos-out must be outside the repository so that videos are never committed.")
    collect(paths, a.videos_out)


if __name__ == "__main__":
    main()
