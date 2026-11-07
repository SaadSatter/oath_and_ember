// Review H1: one spend ledger for every worktree, independent of the shell's
// working directory, never created implicitly, and legacy ledgers inventoried.
import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LedgerError, SpendLedger } from "../src/ledger.js";
import { canonicalLedgerPath, ledgerInventory, repoInfo } from "../src/repo.js";

// These tests run git many times; allow for a loaded machine.
vi.setConfig({ testTimeout: 30_000 });

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A throwaway repository with a second worktree. */
function twoWorktrees() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "ledger-repo-")));
  dirs.push(base);
  const a = join(base, "a"), b = join(base, "b");
  mkdirSync(a);
  const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { stdio: "pipe" });
  git(a, "init", "-q", "-b", "main");
  git(a, "config", "user.email", "test@example.com");
  git(a, "config", "user.name", "test");
  writeFileSync(join(a, "README"), "x\n");
  writeFileSync(join(a, ".gitignore"), "evaluation-runs/\n");
  git(a, "add", ".");
  git(a, "commit", "-q", "-m", "init");
  git(a, "worktree", "add", "-q", b, "-b", "other");
  return { a, b, base };
}

const module = (name: string) => JSON.stringify(new URL(`../src/${name}`, import.meta.url).href);

describe("canonical spend ledger (H1)", () => {
  it("resolves one ledger path in the git common directory from every worktree", () => {
    const { a, b } = twoWorktrees();
    const ra = repoInfo(a), rb = repoInfo(b);
    expect(ra.root).toBe(a);
    expect(rb.root).toBe(b);
    expect(ra.commonDir).toBe(rb.commonDir);
    expect(canonicalLedgerPath(ra)).toBe(canonicalLedgerPath(rb));
    expect(canonicalLedgerPath(ra)).toBe(join(a, ".git", "oath-eval", "spend-ledger.json"));
  });

  it("checks the named worktree, not the process's working directory", () => {
    const { a, b } = twoWorktrees();
    writeFileSync(join(b, "untracked.txt"), "dirty\n");
    expect(repoInfo(a).dirty).toBe(false);
    expect(repoInfo(b).dirty).toBe(true);
    // Run from an unrelated cwd (this project): the answer depends only on the path given.
    const out = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import { repoInfo } from ${module("repo.ts")};
      console.log(JSON.stringify([repoInfo(${JSON.stringify(a)}).dirty, repoInfo(${JSON.stringify(b)}).dirty]));
    `], { cwd: process.cwd(), encoding: "utf8" });
    expect(JSON.parse(out)).toEqual([false, true]);
  });

  it("refuses to spend when the canonical ledger is missing, and creates nothing", () => {
    const { a } = twoWorktrees();
    expect(() => SpendLedger.openCanonical(repoInfo(a))).toThrow(/No ledger/);
    expect(existsSync(canonicalLedgerPath(repoInfo(a)))).toBe(false);
    expect(existsSync(`${canonicalLedgerPath(repoInfo(a))}.lock`)).toBe(false);
  });

  it("shares spend and the lock across worktrees; init happens once", () => {
    const { a, b } = twoWorktrees();
    const { ledger } = SpendLedger.initCanonical(repoInfo(a));
    expect(() => SpendLedger.initCanonical(repoInfo(b))).toThrow(/already exists|locks exist|never re-initialized/);
    ledger.reserve("pilot", "from-a", 3);
    expect(() => SpendLedger.openCanonical(repoInfo(b))).toThrow(/locked/);
    ledger.close();
    expect(() => SpendLedger.initCanonical(repoInfo(b))).toThrow(/never re-initialized/);
    const fromB = SpendLedger.openCanonical(repoInfo(b));
    expect(fromB.remaining("pilot")).toBe(5);
    expect(fromB.remaining()).toBe(22);
    expect(() => fromB.reserve("pilot", "too-much", 5.01)).toThrow(LedgerError);
    fromB.close();
  });

  it("excludes another process opening from the other worktree", async () => {
    const { a, b } = twoWorktrees();
    SpendLedger.initCanonical(repoInfo(a)).ledger.close();
    const holder = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import { SpendLedger } from ${module("ledger.ts")};
      import { repoInfo } from ${module("repo.ts")};
      const l = SpendLedger.openCanonical(repoInfo(${JSON.stringify(a)}));
      l.reserve("pilot", "held", 1);
      process.stdout.write("held");
      setInterval(() => {}, 1000);
    `], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
    try {
      await once(holder.stdout!, "data");
      const out = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
        import { SpendLedger } from ${module("ledger.ts")};
        import { repoInfo } from ${module("repo.ts")};
        try { SpendLedger.openCanonical(repoInfo(${JSON.stringify(b)})); process.exit(1); }
        catch (e) { console.log(e.message.includes("locked") ? "locked" : e.message); }
      `], { cwd: process.cwd(), encoding: "utf8" });
      expect(out.trim()).toBe("locked");
    } finally {
      const exited = once(holder, "exit");
      holder.kill("SIGKILL");
      await exited;
    }
    // The killed holder's reservation still counts; the stale lock is removed by hand.
    rmSync(`${canonicalLedgerPath(repoInfo(a))}.lock`);
    const l = SpendLedger.openCanonical(repoInfo(b));
    expect(l.committed("pilot")).toBe(1);
    l.close();
  }, 20_000);

  it("inventories legacy per-worktree ledgers and refuses to ignore them", () => {
    const { a, b } = twoWorktrees();
    const legacy = SpendLedger.open(join(b, "evaluation-runs", "spend-ledger.json"));
    const id = legacy.reserve("pilot", "old-open", 2);
    legacy.reserve("smoke", "old-smoke", 0.01);
    legacy.settle(legacy.entries()[1].id, 0.004);
    legacy.close();
    expect(id).toBeTruthy();
    const inv = ledgerInventory(repoInfo(a));
    expect(inv.filter((i) => i.exists).map((i) => [i.kind, i.path])).toEqual([["legacy", join(b, "evaluation-runs", "spend-ledger.json")]]);
    expect(() => SpendLedger.initCanonical(repoInfo(a))).toThrow(/adopted explicitly/);
    expect(() => SpendLedger.initCanonical(repoInfo(a), { adopt: ["/nowhere/spend-ledger.json"] })).toThrow(/adopted explicitly|not a legacy/);
    expect(existsSync(canonicalLedgerPath(repoInfo(a)))).toBe(false);
    const { ledger, adopted } = SpendLedger.initCanonical(repoInfo(a), { adopt: [join(b, "evaluation-runs", "spend-ledger.json")] });
    expect(adopted).toHaveLength(1);
    // The open hold and the settled charge both carry over.
    expect(ledger.committed("pilot")).toBe(2);
    expect(ledger.committed("smoke")).toBe(0.004);
    expect(ledger.entries().every((e) => e.note?.includes("migrated from"))).toBe(true);
    ledger.close();
    expect(existsSync(join(b, "evaluation-runs", "spend-ledger.json"))).toBe(false);
    expect(readdirSync(join(b, "evaluation-runs")).some((f) => f.startsWith("spend-ledger.json.migrated-"))).toBe(true);
    const reopened = SpendLedger.openCanonical(repoInfo(b));
    expect(reopened.remaining()).toBe(22.996);
    reopened.close();
  });

  it("refuses to open the canonical ledger while a legacy ledger appears", () => {
    const { a, b } = twoWorktrees();
    SpendLedger.initCanonical(repoInfo(a)).ledger.close();
    SpendLedger.open(join(b, "evaluation-runs", "spend-ledger.json")).close();
    expect(() => SpendLedger.openCanonical(repoInfo(a))).toThrow(/Legacy ledgers exist/);
  });

  it("has no paid entrypoint that builds a ledger path from the working directory", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["../../../scripts/midterm/evaluate.ts", "../../../scripts/midterm/live.ts"]) {
      const src = readFileSync(new URL(f, import.meta.url), "utf8");
      expect(src, f).not.toMatch(/evaluation-runs\/spend-ledger/);
      expect(src, f).toMatch(/SpendLedger\.openCanonical\(/);
      expect(src, f).not.toMatch(/execSync\("git/);
    }
  });
});
