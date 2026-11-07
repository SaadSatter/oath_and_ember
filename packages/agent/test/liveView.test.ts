// Live viewing (scripts/midterm/live.ts): the browser viewer serves the exact
// room the agents play, pacing and the server driver change nothing, viewers
// cannot act, the mock gateway is offline and legal, and the launcher refuses
// held-out scenarios and command-line credentials. No paid call is made:
// every launcher case below stops before any ledger or network access, or
// uses the offline mock gateway with a scratch ledger.
import { afterEach, describe, expect, it } from "vitest";
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { io, type Socket } from "socket.io-client";
import { runSuite } from "../src/harness.js";
import { startViewer } from "../src/liveViewer.js";
import { MockGateway } from "../src/policies/mockGateway.js";
import { validate } from "../src/actions.js";
import { canonicalLedgerPath, repoInfo } from "../src/repo.js";
import { environmentFor } from "../src/suite.js";
import { verifyTrace, type TraceLine } from "../src/trace.js";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { neutral } from "../../shared/src/gameTypes.js";

const ROOT = repoInfo().root;
const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "live-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const readTrace = (path: string) => readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l) as TraceLine);
/** The trace without wall-clock measurements, which never reproduce. */
const semantic = (lines: TraceLine[]) =>
  lines.map(({ type, tick, player, data }) => {
    const d = structuredClone(data) as Record<string, unknown>;
    if (type === "step") delete d.waitMs;
    return { type, tick, player, data: d };
  });

describe("live viewer", () => {
  it("serves the agents' own room; pacing, the server driver and an attached viewer leave the episode unchanged", async () => {
    const plainDir = join(tmp(), "plain");
    const [plain] = await runSuite({ player: "baseline-quest", situations: ["S1"], seeds: [0], outDir: plainDir, gitHash: "test" });

    const viewer = await startViewer({ root: ROOT, port: 0, speed: 0, title: "test" });
    const sockets: Socket[] = [];
    let attached: Promise<{ snapshots: number; refusals: string[] }> | undefined;
    let served: GameRoom | undefined;
    try {
      const watchedDir = join(tmp(), "watched");
      const [watched] = await runSuite({
        player: "baseline-quest", situations: ["S1"], seeds: [0], outDir: watchedDir, gitHash: "test",
        environment: {
          room: (r) => {
            viewer.hooks.room(r);
            served = r;
            attached = (async () => {
              // The same path a browser takes: /watch/sieg issues a token and redirects.
              const res = await fetch(viewer.url + "/sieg", { redirect: "manual" });
              const q = new URL(res.headers.get("location")!, viewer.url).searchParams;
              const s = io(new URL(viewer.url).origin, { forceNew: true, transports: ["websocket"] });
              sockets.push(s);
              await new Promise<void>((d) => s.on("connect", d));
              let snapshots = 0;
              s.on("game:snapshot", () => snapshots++);
              const ack = (event: string, p: unknown) => new Promise<any>((d) => (s as any).emit(event, p, d));
              const attach = await ack("view:attach", { roomCode: q.get("room"), playerId: q.get("player"), viewToken: q.get("view") });
              expect(attach.ok).toBe(true);
              // A viewer trying to play: input and requests while the episode runs.
              const refusals: string[] = [];
              for (let i = 0; i < 20; i++) {
                s.emit("player:input", { ...neutral(1000 + i), moveX: 1, primaryHeld: true, interactHeld: true });
                refusals.push((await ack("story:read", {})).error);
                refusals.push((await ack("inventory:use", { item: "vanity_mirror" })).error);
                await new Promise((d) => setTimeout(d, 5));
              }
              return { snapshots, refusals };
            })();
          },
          tick: (r) => viewer.hooks.tick(r),
          pace: () => new Promise((d) => setTimeout(d, 2)),
        },
      });
      const seen = await attached!;
      expect(served!.state.roomCode).toBe("EVAL0");
      expect(seen.snapshots).toBeGreaterThan(0);
      expect(new Set(seen.refusals)).toEqual(new Set(["View-only session."]));
      expect(viewer.viewsIssued).toBe(1);
      // Identical episode: start, every decision and result, and the end state.
      expect(watched.startHash).toBe(plain.startHash);
      expect(watched.endHash).toBe(plain.endHash);
      expect(watched.decisions).toEqual(plain.decisions);
      const a = readTrace(plain.trace), b = readTrace(watched.trace);
      verifyTrace(b);
      expect(semantic(b)).toEqual(semantic(a));
    } finally {
      sockets.forEach((s) => s.disconnect());
      await viewer.close();
    }
  }, 120_000);

  it("is local-only and read-only by construction", () => {
    const src = readFileSync(join(ROOT, "packages/agent/src/liveViewer.ts"), "utf8");
    expect(src).toMatch(/listen\(o\.port, "127\.0\.0\.1"/);
    expect(src).toMatch(/createApp\(\{ manualDriver: true, viewers: true \}\)/);
    // The viewer never reaches the agents' policies, memories or the environment's player operations.
    const code = src.replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\.(observe|legal_actions|outcome)\(|policies\/|PlayerMemory|AgentEnvironment\b/);
    // Its only .step() is the server's manual tick driver.
    expect(code.match(/\.step\(/g)).toEqual([".step("]);
    expect(code).toMatch(/tick: \(r\) => game\.step\(r\.state\.roomCode\)/);
  });
});

describe("mock gateway (offline)", () => {
  it("answers with legal actions only, deterministically per seed, at zero cost", async () => {
    const env = environmentFor("S1");
    await env.reset(0);
    const observation = await env.observe("sieg"), legal = await env.legal_actions("sieg");
    const user = JSON.stringify({ observation, legal_actions: legal });
    const a = new MockGateway(7), b = new MockGateway(7), c = new MockGateway(8);
    const ra = await a.complete("", user, new AbortController().signal);
    const rb = await b.complete("", user, new AbortController().signal);
    expect(ra.text).toBe(rb.text);
    expect(a.worstCaseUsd()).toBe(0);
    expect(ra.costUsd).toBe(0);
    for (let i = 0; i < 30; i++) {
      const r = await c.complete("", user, new AbortController().signal);
      for (const action of JSON.parse(r.text).actions) expect(validate(action, legal), JSON.stringify(action)).toBeUndefined();
    }
  });

  it("makes no network request", () => {
    const src = readFileSync(join(ROOT, "packages/agent/src/policies/mockGateway.ts"), "utf8");
    expect(src).not.toMatch(/fetch\(|node:http|node:https|@anthropic-ai|openai|import .*net/);
  });
});

// ── The launcher CLI ─────────────────────────────────────────────────────────
const run = promisify(execFile);
const CANARY = "sk-ant-test-canary-0000000000000000000000";
async function launch(args: string[], env: Record<string, string> = {}) {
  try {
    const r = await run(process.execPath, ["--import", "tsx", "scripts/midterm/live.ts", ...args], { cwd: ROOT, env: { ...process.env, ...env }, timeout: 120_000 });
    return { code: 0, out: r.stdout + r.stderr };
  } catch (e) {
    const err = e as { code: number; stdout: string; stderr: string };
    return { code: err.code, out: err.stdout + err.stderr };
  }
}
const allText = (dir: string): string =>
  readdirSync(dir, { withFileTypes: true }).map((e) => (e.isDirectory() ? allText(join(dir, e.name)) : readFileSync(join(dir, e.name), "utf8"))).join("\n");

describe("live launcher", () => {
  it("refuses held-out scenarios, final runs, final seeds and command-line credentials", async () => {
    const cases: [string[], RegExp][] = [
      [["--scenario", "S4", "--player", "baseline-quest"], /S4 is held out/],
      [["--scenario", "F", "--player", "model-history", "--gateway", "mock"], /F is held out/],
      [["--scenario", "s4"], /S4 is held out/],
      [["--scenario", "S1", "--final"], /--final is not available/],
      [["--scenario", "S1", "--situations", "S1,S4"], /not available here/],
      [["--scenario", "S1", "--seed", "100"], /tuning seeds 0, 1 only/],
      [["--scenario", "S1", "--api-key", "abc"], /never accepted as arguments/],
      [["--scenario", "S1", "--key=abc"], /never accepted as arguments/],
      [["--scenario", "S1", CANARY], /never accepted as arguments/],
      [["--scenario", "S1", "--player", "model-history"], /paid run. Pass --paid/],
      [["--scenario", "S1", "--player", "model-history", "--gateway", "mock", "--paid"], /only for --gateway anthropic/],
      [["--scenario", "S1", "--player", "baseline-quest", "--gateway", "mock"], /use no gateway/],
    ];
    for (const [args, expected] of cases) {
      const r = await launch(args);
      expect(r.code, args.join(" ")).toBe(2);
      expect(r.out, args.join(" ")).toMatch(expected);
      expect(r.out).not.toContain(CANARY);
    }
  }, 120_000);

  it("refuses a paid cap above the scenario's before any ledger or network access, without echoing the key", async () => {
    const ledgerBefore = existsSync(canonicalLedgerPath());
    const r = await launch(["--scenario", "S1", "--player", "model-history", "--paid", "--max-spend-usd", "0.5", "--no-viewer"], { ANTHROPIC_API_KEY: CANARY });
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/clean, committed tree|never raise it/);
    expect(r.out).not.toContain(CANARY);
    expect(existsSync(canonicalLedgerPath())).toBe(ledgerBefore);
  }, 60_000);

  it("runs offline with the mock gateway and a scratch ledger, and writes no credential", async () => {
    const ledgerBefore = existsSync(canonicalLedgerPath());
    const out = join(tmp(), "mock");
    const r = await launch(["--scenario", "S1", "--seed", "1", "--player", "model-history", "--gateway", "mock", "--no-viewer", "--mock-delay-ms", "0", "--out", out], { ANTHROPIC_API_KEY: CANARY });
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/Trace: /);
    const run = JSON.parse(readFileSync(join(out, "run.json"), "utf8"));
    expect(run.model.gateway).toBe("mock:random-legal@1");
    const live = JSON.parse(readFileSync(join(out, "live.json"), "utf8"));
    expect(live).toMatchObject({ paid: false, viewer: false, ledger: { scratch: true } });
    const ledger = JSON.parse(readFileSync(join(out, "mock-ledger.json"), "utf8"));
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]).toMatchObject({ stage: "pilot", status: "settled", chargedUsd: 0 });
    expect(existsSync(join(out, "mock-ledger.json.lock"))).toBe(false);
    const summary = JSON.parse(readFileSync(join(out, "S1-seed1", "summary.json"), "utf8"));
    expect(summary.modelCalls.attempted).toBeGreaterThan(0);
    verifyTrace(readTrace(summary.trace));
    expect(allText(out)).not.toContain(CANARY);
    expect(r.out).not.toContain(CANARY);
    expect(existsSync(canonicalLedgerPath())).toBe(ledgerBefore);
  }, 120_000);

  it("keeps the partial trace, settles the reservation and releases the ledger on Ctrl-C", async () => {
    const out = join(tmp(), "interrupted");
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/midterm/live.ts", "--scenario", "S2", "--seed", "0", "--player", "model-history", "--gateway", "mock", "--no-viewer", "--mock-delay-ms", "40", "--out", out], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let text = "";
    const exited = new Promise<number | null>((d) => child.on("exit", (code) => d(code)));
    await new Promise<void>((d) => {
      const onData = (b: Buffer) => {
        text += b.toString();
        if ((text.match(/model call #/g) ?? []).length >= 3) { child.stdout!.off("data", onData); d(); }
      };
      child.stdout!.on("data", onData);
    });
    child.kill("SIGINT");
    const code = await exited;
    expect(code).toBe(130);
    const summary = JSON.parse(readFileSync(join(out, "S2-seed0", "summary.json"), "utf8"));
    expect(summary.reason).toBe("manual_stop");
    const lines = readTrace(summary.trace);
    verifyTrace(lines);
    expect(lines.at(-1)!.type).toBe("outcome");
    expect(lines.filter((l) => l.type === "model_call").length).toBeGreaterThanOrEqual(3);
    const ledger = JSON.parse(readFileSync(join(out, "mock-ledger.json"), "utf8"));
    expect(ledger.entries.every((e: { status: string }) => e.status !== "open")).toBe(true);
    expect(existsSync(join(out, "mock-ledger.json.lock"))).toBe(false);
    expect(JSON.parse(readFileSync(join(out, "live.json"), "utf8")).interrupted).toBe(true);
    expect(statSync(join(out, "results.json")).size).toBeGreaterThan(0);
  }, 120_000);
});
