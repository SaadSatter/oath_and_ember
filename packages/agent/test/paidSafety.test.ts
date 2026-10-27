// Re-review M2, M3, L1-L4: approved model and effort only, no ledger lock
// left by an interrupted launcher, model text made safe for the terminal,
// the credential redacted from terminal output, launch settings and the
// spend cap recorded in summaries, and independent mock heroes.
// No network and no paid call: every launcher case stops before the ledger or
// uses the offline mock gateway with a scratch ledger.
import { afterEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { runSuite } from "../src/harness.js";
import { reconcile, SpendLedger } from "../src/ledger.js";
import { AnthropicGateway, anthropicPrices, APPROVED_MODELS, assertApprovedModel, SMOKE_CONFIG } from "../src/policies/llm.js";
import { MockGateway } from "../src/policies/mockGateway.js";
import { canonicalLedgerPath, repoInfo } from "../src/repo.js";
import { redactStreams, safeText } from "../../../scripts/midterm/tty.js";

const ROOT = repoInfo().root;
const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "paid-safety-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const run = promisify(execFile);
async function cli(script: string, args: string[], env: Record<string, string> = {}) {
  try {
    const r = await run(process.execPath, ["--import", "tsx", script, ...args], { cwd: ROOT, env: { ...process.env, ...env }, timeout: 60_000 });
    return { code: 0, out: r.stdout + r.stderr };
  } catch (e) {
    const err = e as { code: number; stdout: string; stderr: string };
    return { code: err.code, out: err.stdout + err.stderr };
  }
}
const CANARY = "sk-ant-test-canary-1111111111111111111111";

describe("approved model and effort only (M2)", () => {
  it("allows claude-haiku-5-5 at medium or low, and nothing else, in the gateway itself", () => {
    expect(APPROVED_MODELS).toEqual({ "claude-haiku-5-5": ["medium", "low"] });
    expect(SMOKE_CONFIG).toEqual({ model: "claude-haiku-5-5", effort: "medium" });
    expect(() => assertApprovedModel("claude-haiku-5-5", "medium")).not.toThrow();
    expect(() => assertApprovedModel("claude-haiku-5-5", "low")).not.toThrow();
    expect(() => assertApprovedModel("claude-haiku-5-5", "high")).toThrow(/not approved/);
    for (const id of ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5", "toString", "__proto__"])
      expect(() => assertApprovedModel(id, "medium"), id).toThrow(/not approved/);
    expect(() => new AnthropicGateway("claude-opus-5-5", anthropicPrices["claude-opus-5-5"], "medium", "k")).toThrow(/not approved/);
    expect(() => new AnthropicGateway("claude-haiku-5-5", anthropicPrices["claude-haiku-5-5"], "high", "k")).toThrow(/not approved/);
    const g = new AnthropicGateway("claude-haiku-5-5", anthropicPrices["claude-haiku-5-5"], "low", "k");
    // The endpoint is fixed: ANTHROPIC_BASE_URL in the environment cannot redirect the key.
    expect(g.client.baseURL).toBe("https://api.anthropic.com");
  });

  it("the paid entrypoints refuse other models and efforts before the ledger or the network", async () => {
    const before = existsSync(canonicalLedgerPath());
    const cases: [string, string[], RegExp][] = [
      ["scripts/midterm/evaluate.ts", ["--smoke", "--paid", "--model", "claude-opus-5-5"], /not approved/],
      ["scripts/midterm/evaluate.ts", ["--smoke", "--paid", "--effort", "high"], /not approved/],
      ["scripts/midterm/evaluate.ts", ["--smoke", "--paid", "--effort", "low"], /smoke call is approved for claude-haiku-5-5 at medium only/],
      ["scripts/midterm/evaluate.ts", ["--player", "model-history", "--stage", "pilot", "--situations", "S1", "--paid", "--model", "claude-sonnet-5-5"], /not approved/],
      ["scripts/midterm/live.ts", ["--scenario", "S1", "--player", "model-history", "--paid", "--model", "claude-opus-5-5", "--max-spend-usd", "0.1", "--no-viewer"], /not approved/],
      ["scripts/midterm/live.ts", ["--scenario", "S1", "--player", "model-history", "--paid", "--effort", "high", "--max-spend-usd", "0.1", "--no-viewer"], /not approved/],
    ];
    for (const [script, args, expected] of cases) {
      const r = await cli(script, args, { ANTHROPIC_API_KEY: CANARY });
      expect(r.code, args.join(" ")).not.toBe(0);
      expect(r.out, args.join(" ")).toMatch(expected);
      expect(r.out).not.toContain(CANARY);
    }
    expect(existsSync(canonicalLedgerPath())).toBe(before);
  }, 120_000);
});

describe("launcher interruption leaves no ledger lock (M3)", () => {
  it("installs its signal and exit handlers before opening any ledger, prompting or building", () => {
    const src = readFileSync(join(ROOT, "scripts/midterm/live.ts"), "utf8");
    const at = (needle: string) => {
      const i = src.indexOf(needle);
      expect(i, needle).toBeGreaterThan(-1);
      return i;
    };
    const handlers = Math.max(at('process.on("SIGINT"'), at('process.on("exit"'));
    for (const later of ["openPaidLedger().close()", "SpendLedger.open(scratch", "await ask(", "spawnSync(", "await startViewer("]) expect(handlers, later).toBeLessThan(at(later));
    // The paid ledger is closed before the prompt and the build, and reopened only after them.
    expect(at("openPaidLedger().close()")).toBeLessThan(at("await ask("));
    expect(at("ledger = openPaidLedger()")).toBeGreaterThan(at("spawnSync("));
    expect(at("ledger = openPaidLedger()")).toBeGreaterThan(at("await startViewer("));
  });

  it("an exit with a reservation in progress releases the lock and keeps the hold for reconciliation", async () => {
    // The launcher's forced exit is process.exit() with its exit handler
    // registered (checked above); this runs that exact mechanism.
    const ledgerPath = join(tmp(), "ledger.json");
    const mod = JSON.stringify(new URL("../src/ledger.ts", import.meta.url).href);
    const code = `const { SpendLedger } = await import(${mod});
      const l = SpendLedger.open(${JSON.stringify(ledgerPath)});
      process.on("exit", () => l.close());
      l.reserve("pilot", "interrupted", 0.2);
      process.exit(130);`;
    const r = await run(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { cwd: ROOT }).then(() => 0, (e: { code: number }) => e.code);
    expect(r).toBe(130);
    expect(existsSync(`${ledgerPath}.lock`)).toBe(false);
    const l = SpendLedger.open(ledgerPath);
    expect(l.entries()).toMatchObject([{ status: "open", reservedUsd: 0.2 }]);
    // Without a trace, a reviewed reconciliation charges the whole hold.
    const rec = reconcile(l.entries()[0], null);
    l.settleReviewed(rec.entry, rec, "test reviewer");
    expect(l.entries()[0]).toMatchObject({ status: "settled", chargedUsd: 0.2 });
    l.close();
  }, 60_000);
});

describe("terminal output (L1, L2)", () => {
  it("shows control characters, escape sequences and bidi overrides as text", () => {
    const evil = "go\u001b]0;pwned\u0007\u001b[2J\u009b31m\r\nfake line‮evil";
    const shown = safeText(evil);
    expect(shown).not.toMatch(/[\u0000-\u001f\u007f-\u009f‮]/);
    expect(shown).toBe("go\\u{1b}]0;pwned\\u{7}\\u{1b}[2J\\u{9b}31m\\u{d}\\u{a}fake line\\u{202e}evil");
    expect(safeText("Sieg → Coco: plain text")).toBe("Sieg → Coco: plain text");
  });

  it("redacts the credential from stdout and reports that it was seen", () => {
    const writes: string[] = [];
    const original = process.stdout.write;
    process.stdout.write = ((c: unknown) => { writes.push(String(c)); return true; }) as typeof process.stdout.write;
    try {
      const seen = redactStreams(CANARY);
      process.stdout.write("nothing secret\n");
      expect(seen()).toBe(false);
      process.stdout.write(`key=${CANARY}\n`);
      expect(seen()).toBe(true);
    } finally {
      process.stdout.write = original;
    }
    expect(writes.join("")).not.toContain(CANARY);
    expect(writes.join("")).toContain("key=[REDACTED]");
  });
});

describe("summaries record how the run was launched (L3)", () => {
  it("records the launcher, pacing speed, viewer, wall limit and the spend cap", async () => {
    const out = join(tmp(), "suite");
    const ledger = SpendLedger.open(join(out, "..", "scratch-ledger.json"));
    try {
      const [s] = await runSuite({
        player: "model-history", situations: ["S1"], seeds: [0], outDir: out, gitHash: "test", wallSeconds: 60, episodeCapUsd: 0.05,
        model: { gateway: new MockGateway(0), manual: "manual", ledger, stage: "pilot", priceSource: "mock" },
        launch: { launcher: "test", speed: 2, viewer: true },
      });
      expect(s).toMatchObject({ episodeCapUsd: 0.05, wallLimitSeconds: 60, launch: { launcher: "test", speed: 2, viewer: true }, finalClaim: null });
      expect(JSON.parse(readFileSync(join(out, "run.json"), "utf8")).launch).toEqual({ launcher: "test", speed: 2, viewer: true });
      const lines = readFileSync(s.trace, "utf8").trim().split("\n").map((l) => JSON.parse(l));
      expect(lines[0]).toMatchObject({ type: "ledger_reservation", data: { reservedUsd: 0.05, stage: "pilot" } });
      expect(lines.filter((l) => l.type === "model_call_start").length).toBe(lines.filter((l) => l.type === "model_call").length);
    } finally {
      ledger.close();
    }
  }, 60_000);

  it("the live launcher records itself, an unpaced headless run and the default baseline settings", async () => {
    const out = join(tmp(), "live");
    const r = await cli("scripts/midterm/live.ts", ["--scenario", "S1", "--seed", "0", "--player", "baseline-quest", "--no-viewer", "--out", out]);
    expect(r.code, r.out).toBe(0);
    const s = JSON.parse(readFileSync(join(out, "S1-seed0", "summary.json"), "utf8"));
    expect(s).toMatchObject({ launch: { launcher: "scripts/midterm/live.ts", speed: null, viewer: false }, episodeCapUsd: null, wallLimitSeconds: 600 });
  }, 120_000);
});

describe("mock heroes are independent (L4)", () => {
  it("each hero's mock answers depend only on its own calls", async () => {
    const user = JSON.stringify({ legal_actions: [{ type: "wait", params: { ticks: { kind: "int", min: 1, max: 600 } } }, { type: "attack" }] });
    const signal = new AbortController().signal;
    const a = new MockGateway(3), b = new MockGateway(3);
    // Gateway a: Sieg alone. Gateway b: Coco calls interleaved before every Sieg call.
    const siegA: string[] = [], siegB: string[] = [];
    for (let i = 0; i < 5; i++) siegA.push((await a.complete("as Sieg", user, signal)).text);
    for (let i = 0; i < 5; i++) {
      await b.complete("as Coco", user, signal);
      siegB.push((await b.complete("as Sieg", user, signal)).text);
    }
    expect(siegB).toEqual(siegA);
  });
});
