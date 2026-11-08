// The Hedge Maze evidence in midterms/saadsatter/evidence/ must match its
// manifest: every packaged file's SHA-256, every trace's hash chain, and every
// outcome re-derived from its summary.json (scripts/midterm/collect_evidence.py).
// Offline; reads committed files and scratch copies only.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const script = join(root, "scripts/midterm/collect_evidence.py");
const stage = existsSync(join(root, "midterms/saadsatter/evidence")) ? join(root, "midterms/saadsatter") : root;

const verify = (cwd: string) => spawnSync("python3", ["-I", script, "--verify"], { cwd, encoding: "utf8" });

// A course-folder copy: evidence/ plus pilot 11's in-place folder.
function courseCopy() {
  const dir = mkdtempSync(join(tmpdir(), "evidence-"));
  cpSync(join(stage, "evidence"), join(dir, "evidence"), { recursive: true });
  cpSync(join(root, "docs/midterm/evidence/pilot-11-model-guided"), join(dir, "docs/midterm/evidence/pilot-11-model-guided"), {
    recursive: true,
    filter: (p) => !p.endsWith(".webm"),
  });
  return dir;
}

describe("Hedge Maze evidence manifest", { timeout: 60_000 }, () => {
  it("the committed evidence verifies against its manifest", () => {
    const r = verify(root);
    expect(r.stdout + r.stderr).toContain("OK");
    expect(r.status).toBe(0);
  });

  it("publishes the documented Hedge Maze results", () => {
    const m = JSON.parse(readFileSync(join(stage, "evidence/manifests/evidence-manifest.json"), "utf8"));
    const by = Object.fromEntries(m.entries.map((e: { id: string }) => [e.id, e]));
    expect(by["baseline-quest-live"].outcome).toMatchObject({ status: "success", gameTicks: 2990, decisions: 340, invalid: 0, messages: 6, calls: 0 });
    for (const i of [1, 2, 3]) expect(by[`baseline-quest-repro-${i}`].outcome.endHash).toBe(by["baseline-quest-live"].outcome.endHash);
    expect(by["pilot-11"].outcome).toMatchObject({ status: "success", gameSeconds: 38.6 });
    expect(by["pilot-12"].outcome).toMatchObject({ status: "success", gameSeconds: 44 });
    // Unaided runs were stopped by hand: neither is a success nor a limit-based failure.
    expect(by["pilot-13"].outcome).toMatchObject({ status: "terminated", reason: "manual_stop" });
    expect(by["pilot-15"].outcome).toMatchObject({ status: "terminated", reason: "manual_stop", gameSeconds: 33.5 });
    expect(by["pilot-15"].recording.type).toBe("live");
    for (const id of ["pilot-11", "pilot-12", "pilot-13"]) expect(by[id].recording).toMatchObject({ type: "replay", matchesTrace: true });
    // One start state for every run in the comparison.
    expect(new Set(m.entries.map((e: { outcome: { startHash: string } }) => e.outcome.startHash)).size).toBe(1);
  });

  it("verifies a course-folder copy and rejects a tampered trace or summary", () => {
    const dir = courseCopy();
    expect(verify(dir).status).toBe(0);

    const trace = join(dir, "evidence/traces/pilot-15-model-memory-S2-local-seed0/trace.jsonl");
    appendFileSync(trace, "\n");
    expect(verify(dir).status).not.toBe(0);

    const dir2 = courseCopy();
    const summary = join(dir2, "evidence/traces/pilot-13-model-memory-S2-local-seed0/summary.json");
    writeFileSync(summary, readFileSync(summary, "utf8").replace('"status": "terminated"', '"status": "success"'));
    expect(verify(dir2).status).not.toBe(0);
  });
});
