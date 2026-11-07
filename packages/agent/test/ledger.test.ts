// Persistent spend ledger: approved $25 allocation, fail closed.
import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APPROVED_LEDGER, LedgerError, SpendLedger, writeRawLedger } from "../src/ledger.js";

const dirs: string[] = [];
const fresh = () => {
  const d = mkdtempSync(join(tmpdir(), "ledger-"));
  dirs.push(d);
  return join(d, "spend-ledger.json");
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("spend ledger", () => {
  it("uses the approved allocation: $25 total; smoke $0.10, pilot $8, final $15, contingency $1.90", () => {
    expect(APPROVED_LEDGER).toEqual({ totalCapUsd: 25, stages: { smoke: 0.1, pilot: 8, final: 15, contingency: 1.9 } });
    const stages = Object.values(APPROVED_LEDGER.stages).reduce((a, b) => a + b, 0);
    expect(stages).toBeCloseTo(25, 9);
  });

  it("refuses a reservation above a stage's remainder or the total", () => {
    const l = SpendLedger.open(fresh());
    expect(() => l.reserve("smoke", "r1", 0.11)).toThrow(LedgerError);
    const a = l.reserve("pilot", "S2-0", 3);
    l.settle(a, 2.5);
    expect(l.remaining("pilot")).toBeCloseTo(5.5);
    expect(() => l.reserve("pilot", "S2-1", 5.6)).toThrow(/Stage "pilot"/);
    expect(() => l.reserve("nope", "x", 1)).toThrow(/Unknown stage/);
    expect(() => l.reserve("pilot", "x", 0)).toThrow(/positive/);
    l.close();
  });

  it("counts open reservations as spent, and keeps them after a crash", () => {
    const p = fresh();
    const l = SpendLedger.open(p);
    l.reserve("final", "F-100", 3);
    expect(l.remaining("final")).toBeCloseTo(12);
    expect(l.remaining()).toBeCloseTo(22);
    // Simulate a crash: the process ends without settling or closing.
    rmSync(`${p}.lock`);
    const again = SpendLedger.open(p);
    expect(again.remaining("final")).toBeCloseTo(12);
    expect(again.entries()[0]).toMatchObject({ status: "open", reservedUsd: 3 });
    again.close();
  });

  it("charges the whole reservation when spend is unknown", () => {
    const l = SpendLedger.open(fresh());
    const id = l.reserve("pilot", "S1-0", 0.2);
    l.settle(id, null, "provider usage missing");
    expect(l.entries()[0]).toMatchObject({ status: "settled-unknown", chargedUsd: 0.2, note: "provider usage missing" });
    expect(l.committed()).toBeCloseTo(0.2);
    l.close();
  });

  it("persists across reopen and writes valid JSON", () => {
    const p = fresh();
    const l = SpendLedger.open(p);
    l.settle(l.reserve("smoke", "smoke-1", 0.05), 0.0004);
    l.close();
    expect(JSON.parse(readFileSync(p, "utf8")).entries).toHaveLength(1);
    const again = SpendLedger.open(p);
    expect(again.remaining("smoke")).toBeCloseTo(0.0996);
    again.close();
  });

  it("fails closed on a locked, unreadable, inconsistent or reconfigured ledger", () => {
    const p = fresh();
    const l = SpendLedger.open(p);
    expect(() => SpendLedger.open(p)).toThrow(/locked/);
    l.close();
    expect(existsSync(`${p}.lock`)).toBe(false);
    writeRawLedger(p, "{ not json");
    expect(() => SpendLedger.open(p)).toThrow(/unreadable/);
    writeRawLedger(p, JSON.stringify({ version: 1, config: APPROVED_LEDGER, entries: [{ id: "x", reservedUsd: -1, chargedUsd: null, status: "open" }] }));
    expect(() => SpendLedger.open(p)).toThrow(/inconsistent/);
    writeRawLedger(p, JSON.stringify({ version: 1, config: { ...APPROVED_LEDGER, totalCapUsd: 100 }, entries: [] }));
    expect(() => SpendLedger.open(p)).toThrow(/differs/);
    expect(existsSync(`${p}.lock`)).toBe(false);
  });

  it("creates the parent directory for a fresh persistent ledger", () => {
    const path = join(fresh(), "nested", "ledger.json");
    const ledger = SpendLedger.open(path);
    expect(existsSync(path)).toBe(true);
    ledger.close();
  });

  it("fails closed on malformed stage, status, duplicate id and non-finite amounts", () => {
    const path = fresh();
    const entry = { id: "pilot-1", stage: "pilot", run: "previous", reservedUsd: 8, chargedUsd: 8, status: "settled", openedAt: "2026-10-27" };
    for (const entries of [
      [{ ...entry, stage: "wrong-stage" }],
      [{ ...entry, status: "nonsense" }],
      [entry, entry],
      [null],
      [{ ...entry, status: "settled-unknown", chargedUsd: 0 }],
    ]) {
      writeRawLedger(path, JSON.stringify({ version: 1, config: APPROVED_LEDGER, entries }));
      expect(() => SpendLedger.open(path)).toThrow(/inconsistent/);
      expect(existsSync(`${path}.lock`)).toBe(false);
    }
    writeRawLedger(path, JSON.stringify({ version: 1, config: APPROVED_LEDGER, entries: [entry] }).replace('"chargedUsd":8', '"chargedUsd":1e999'));
    expect(() => SpendLedger.open(path)).toThrow(/inconsistent/);
  });

  it("refuses to use a closed ledger and to settle twice", () => {
    const l = SpendLedger.open(fresh());
    const id = l.reserve("pilot", "S3-0", 1);
    l.settle(id, 0.3);
    expect(() => l.settle(id, 0.3)).toThrow(/No open reservation/);
    l.close();
    expect(() => l.reserve("pilot", "S3-1", 1)).toThrow(/closed/);
  });
  it("serializes same-process concurrent reservations at the stage boundary", async () => {
    const ledger = SpendLedger.open(fresh());
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => Promise.resolve().then(() => ledger.reserve("pilot", `concurrent-${i}`, 1))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(8);
    expect(ledger.committed("pilot")).toBe(8);
    expect(ledger.remaining("pilot")).toBe(0);
    ledger.close();
  });

  it("excludes another process and retains a killed owner's reservation on recovery", async () => {
    const path = fresh();
    const module = new URL("../src/ledger.ts", import.meta.url).href;
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import { SpendLedger } from ${JSON.stringify(module)};
      const ledger = SpendLedger.open(${JSON.stringify(path)});
      ledger.reserve("pilot", "interrupted-process", 7.9);
      process.stdout.write("reserved");
      setInterval(() => {}, 1000);
    `], { stdio: ["ignore", "pipe", "pipe"] });
    try {
      await once(child.stdout!, "data");
      const output = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
        import { SpendLedger } from ${JSON.stringify(module)};
        try { SpendLedger.open(${JSON.stringify(path)}); process.exit(1); }
        catch (e) { if (!e.message.includes("locked")) process.exit(2); console.log("locked"); }
      `], { encoding: "utf8" });
      expect(output.trim()).toBe("locked");
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
      expect(() => process.kill(child.pid!, 0)).toThrow();
      expect(() => SpendLedger.open(path)).toThrow(/locked/);
      // Documented recovery: only remove the stale lock after confirming its owner is dead.
      rmSync(`${path}.lock`);
      const resumed = SpendLedger.open(path);
      expect(resumed.committed("pilot")).toBe(7.9);
      expect(() => resumed.reserve("pilot", "too-much", 0.2)).toThrow();
      resumed.reserve("pilot", "resume", 0.1);
      expect(resumed.committed("pilot")).toBe(8);
      resumed.close();
    } finally { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }
  }, 15_000);

  it("cannot increase the allocation or bypass stage names, and rounds charges up", () => {
    expect(() => SpendLedger.open(fresh(), { totalCapUsd: 26, stages: { pilot: 8 } })).toThrow(/allocation/);
    const ledger = SpendLedger.open(fresh());
    for (const stage of ["constructor", "__proto__", "toString"]) {
      expect(() => ledger.reserve(stage, "x", 0.1)).toThrow(/Unknown stage/);
      expect(() => ledger.remaining(stage)).toThrow(/Unknown stage/);
    }
    ledger.settle(ledger.reserve("smoke", "fractional", 0.001), 0.0000001);
    expect(ledger.committed()).toBe(0.000001);
    ledger.close();
  });

});
