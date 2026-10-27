// Re-review M1, M3, M4: the shared ledger cannot be reset by deleting it,
// adoption is all-or-nothing, interrupted reservations are settled only by a
// reviewed reconciliation from the episode's verified trace (never refunding
// a started call), and stale locks are removed only when their process is gone.
// Every case uses a throwaway repository; the real ledger is never touched.
import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LedgerError, reconcile, removeStaleLock, SpendLedger, staleLock } from "../src/ledger.js";
import { canonicalLedgerPath, ledgerMarkerPath, repoInfo } from "../src/repo.js";
import { TraceWriter } from "../src/trace.js";

vi.setConfig({ testTimeout: 30_000 });

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) {
    // The marker is read-only; make it removable for cleanup.
    try { chmodSync(join(d, ".git", "oath-eval", "spend-ledger.init.json"), 0o644); } catch { /* none */ }
    rmSync(d, { recursive: true, force: true });
  }
});

function repo() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ledger-recovery-")));
  dirs.push(root);
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  writeFileSync(join(root, ".gitignore"), "evaluation-runs/\n");
  git("add", ".");
  git("commit", "-q", "-m", "init");
  return repoInfo(root);
}

describe("deleting or replacing the ledger never restores the allowance (M1)", () => {
  it("refuses a missing ledger after init, and never initializes twice", () => {
    const info = repo();
    const l = SpendLedger.initCanonical(info).ledger;
    l.reserve("pilot", "spent", 5);
    l.close();
    expect(existsSync(ledgerMarkerPath(info))).toBe(true);
    unlinkSync(canonicalLedgerPath(info));
    expect(() => SpendLedger.openCanonical(info)).toThrow(/is missing .* never re-created/);
    expect(() => SpendLedger.initCanonical(info)).toThrow(/never re-initialized, even though it is missing/);
    expect(existsSync(canonicalLedgerPath(info))).toBe(false);
  });

  it("refuses a ledger replaced by one with another id, or one without a marker", () => {
    const info = repo();
    SpendLedger.initCanonical(info).ledger.close();
    const path = canonicalLedgerPath(info);
    const data = JSON.parse(readFileSync(path, "utf8"));
    writeFileSync(path, JSON.stringify({ ...data, ledgerId: "someone-else", entries: [] }));
    expect(() => SpendLedger.openCanonical(info)).toThrow(/is not the one initialized/);
    expect(existsSync(`${path}.lock`)).toBe(false);
    // A ledger appearing with no marker (made by other means) is refused too.
    const other = repo();
    mkdirSync(join(other.commonDir, "oath-eval"), { recursive: true });
    writeFileSync(canonicalLedgerPath(other), JSON.stringify({ version: 1, config: data.config, entries: [] }));
    expect(() => SpendLedger.openCanonical(other)).toThrow(/no initialization marker/);
  });

  it("adoption is all-or-nothing: an over-cap legacy ledger creates no marker and no ledger", () => {
    const info = repo();
    const legacyPath = join(info.root, "evaluation-runs", "spend-ledger.json");
    const legacy = SpendLedger.open(legacyPath);
    legacy.reserve("pilot", "big", 8);
    legacy.close();
    // Over the pilot cap once a second (copied) ledger is added beside it.
    const raw = JSON.parse(readFileSync(legacyPath, "utf8"));
    raw.entries.push({ ...raw.entries[0], id: "pilot-2" });
    writeFileSync(legacyPath, JSON.stringify(raw));
    expect(() => SpendLedger.initCanonical(info, { adopt: [legacyPath] })).toThrow(/exceeds the pilot stage cap/);
    expect(existsSync(ledgerMarkerPath(info))).toBe(false);
    expect(existsSync(canonicalLedgerPath(info))).toBe(false);
    expect(existsSync(legacyPath)).toBe(true);
  });
});

describe("reviewed reconciliation of interrupted reservations (M4)", () => {
  const entry = { id: "pilot-1", reservedUsd: 1.25, run: "model-history/S2/seed0/abc1234" };
  function trace(build: (t: TraceWriter) => void) {
    const t = new TraceWriter();
    build(t);
    return t.lines.map((l) => JSON.stringify(l) + "\n").join("");
  }
  const reservation = (t: TraceWriter, e = entry) => t.write({ type: "ledger_reservation", tick: 0, data: { entry: e.id, stage: "pilot", run: e.run, reservedUsd: e.reservedUsd, ledger: "x" } });

  it("charges recorded calls plus the whole hold of every call that started without a record", () => {
    const text = trace((t) => {
      reservation(t);
      t.write({ type: "model_call_start", tick: 1, player: "sieg", data: { player: "sieg", attempt: 1, reservedUsd: 0.01 } });
      t.write({ type: "model_call", tick: 1, player: "sieg", data: { player: "sieg", attempt: 1, chargedUsd: 0.0021 } });
      t.write({ type: "model_call_start", tick: 2, player: "coco", data: { player: "coco", attempt: 1, reservedUsd: 0.012 } });
      t.write({ type: "model_call_start", tick: 2, player: "sieg", data: { player: "sieg", attempt: 2, reservedUsd: 0.011 } });
    });
    const r = reconcile(entry, { path: "t.jsonl", text });
    expect(r.chargedUsd).toBeCloseTo(0.0021 + 0.012 + 0.011, 9);
    expect(r.calls).toEqual({ recorded: 1, startedWithoutRecord: 2 });
    expect(r.evidence?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("drops only a trailing half-written line, and then charges that call's whole hold", () => {
    const text = trace((t) => {
      reservation(t);
      t.write({ type: "model_call_start", tick: 1, player: "sieg", data: { player: "sieg", attempt: 1, reservedUsd: 0.01 } });
      t.write({ type: "model_call", tick: 1, player: "sieg", data: { player: "sieg", attempt: 1, chargedUsd: 0.002 } });
    });
    const cut = text.slice(0, text.length - 20);
    expect(reconcile(entry, { path: "t", text: cut })).toMatchObject({ chargedUsd: 0.01, calls: { recorded: 0, startedWithoutRecord: 1 } });
  });

  it("charges the whole reservation when the trace is missing, edited, or for another reservation", () => {
    const good = trace((t) => reservation(t));
    expect(reconcile(entry, null).chargedUsd).toBe(1.25);
    expect(reconcile(entry, { path: "t", text: good.replace('"tick":0', '"tick":5') }).basis).toMatch(/does not verify/);
    expect(reconcile(entry, { path: "t", text: `garbage\n${good}` }).chargedUsd).toBe(1.25);
    expect(reconcile({ ...entry, id: "pilot-9" }, { path: "t", text: good }).basis).toMatch(/does not name this reservation/);
    const noStartHold = trace((t) => {
      reservation(t);
      t.write({ type: "model_call_start", tick: 1, player: "sieg", data: { player: "sieg", attempt: 1, reservedUsd: null } });
    });
    expect(reconcile(entry, { path: "t", text: noStartHold }).chargedUsd).toBe(1.25);
  });

  it("settles only the matching open reservation, with the reviewer and evidence recorded", () => {
    const info = repo();
    const l = SpendLedger.initCanonical(info).ledger;
    const id = l.reserve("pilot", entry.run, 1.25);
    const text = trace((t) => {
      reservation(t, { ...entry, id });
      t.write({ type: "model_call_start", tick: 1, player: "sieg", data: { player: "sieg", attempt: 1, reservedUsd: 0.01 } });
    });
    const r = reconcile({ id, reservedUsd: 1.25, run: entry.run }, { path: "trace.jsonl", text });
    expect(() => l.settleReviewed(id, r, " ")).toThrow(/names the reviewer/);
    expect(() => l.settleReviewed(id, { ...r, entry: "pilot-7" }, "owner")).toThrow(/another reservation/);
    l.settleReviewed(id, r, "owner");
    const e = l.entries().find((x) => x.id === id)!;
    expect(e).toMatchObject({ status: "settled", chargedUsd: 0.01 });
    expect(e.note).toMatch(/reviewed settlement by owner: .*sha256 [0-9a-f]{64}/);
    expect(() => l.settleReviewed(id, r, "owner")).toThrow(/No open reservation/);
    l.close();
  });
});

describe("stale locks (M3, M4)", () => {
  it("refuses a lock whose process is alive, and removes one whose process is gone", async () => {
    const info = repo();
    SpendLedger.initCanonical(info).ledger.close();
    const path = canonicalLedgerPath(info);
    const live = SpendLedger.openCanonical(info);
    expect(staleLock(path)).toEqual({ refused: "the lock is held by this process" });
    live.close();
    // A child that dies holding the lock.
    const child = spawn(process.execPath, ["-e", `require("fs").writeFileSync(${JSON.stringify(`${path}.lock`)}, String(process.pid)); setInterval(() => {}, 1000);`]);
    await new Promise((d) => setTimeout(d, 300));
    expect(staleLock(path)).toEqual({ refused: `process ${child.pid} is still running` });
    expect(() => removeStaleLock(path, child.pid!)).toThrow(LedgerError);
    child.kill("SIGKILL");
    await once(child, "exit");
    expect(staleLock(path)).toEqual({ pid: child.pid });
    expect(() => removeStaleLock(path, child.pid! + 1)).toThrow(/not the stale lock/);
    removeStaleLock(path, child.pid!);
    expect(existsSync(`${path}.lock`)).toBe(false);
    SpendLedger.openCanonical(info).close();
  });

  it("close() is idempotent and tolerates a removed lock", () => {
    const info = repo();
    const l = SpendLedger.initCanonical(info).ledger;
    unlinkSync(`${canonicalLedgerPath(info)}.lock`);
    l.close();
    l.close();
    expect(() => l.reserve("pilot", "after close", 0.1)).toThrow(/closed/);
  });
});
