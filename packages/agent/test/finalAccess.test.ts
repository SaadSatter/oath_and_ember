// Review H2: held-out scenarios and final seeds are reachable only through an
// owner approval tied to a clean commit, claimed in an append-only register.
// No held-out episode is played here: refused runs stop before reset, and the
// one permitted run is a pre-aborted S1 episode (reset, then stopped at once).
import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentEnvironment } from "../src/environment.js";
import { authorizeFinalRun, FinalAccessError, readRegister, recordApproval, registerPath, type FinalApproval } from "../src/finalAccess.js";
import { runSuite } from "../src/harness.js";
import { ExplorationBaseline } from "../src/policies/baseline.js";
import { repoInfo } from "../src/repo.js";
import { runEpisode } from "../src/runner.js";
import { environmentFor, SITUATIONS } from "../src/suite.js";
import { TraceWriter } from "../src/trace.js";

// These tests run git many times; allow for a loaded machine.
vi.setConfig({ testTimeout: 30_000 });

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "final-")));
  dirs.push(d);
  return d;
};
function repo() {
  const root = tmp();
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  writeFileSync(join(root, "README"), "x\n");
  git("add", ".");
  git("commit", "-q", "-m", "init");
  return { root, git, info: () => repoInfo(root) };
}
const approval = (revision: string, over: Partial<FinalApproval> = {}): FinalApproval => ({
  revision, player: "baseline-explore", stage: "final", situations: ["S1", "S4", "F"], seeds: [100, 101], approvedBy: "test owner", ...over,
});
const policies = () => ({ sieg: new ExplorationBaseline(), coco: new ExplorationBaseline() });
const episode = (env: AgentEnvironment, seed: number, extra: object = {}) =>
  runEpisode(env, policies(), new TraceWriter(), { seed, wallClockMs: 5_000, ...extra });

describe("held-out gate in the runner (every entrypoint)", () => {
  it("refuses S4, F and final seeds without a grant, before reset", async () => {
    for (const [env, seed] of [[environmentFor("S4"), 0], [environmentFor("F"), 1], [environmentFor("S1"), 100], [new AgentEnvironment({ preset: "milestone" }), 101]] as const) {
      const lines: unknown[] = [];
      const trace = new TraceWriter();
      await expect(runEpisode(env, policies(), trace, { seed, wallClockMs: 5_000 })).rejects.toThrow(FinalAccessError);
      expect(trace.lines, `${env.scenario().preset}/${seed}`).toEqual(lines);
      expect(env.currentTick()).toBe(0);
    }
  });

  it("refuses the held-out prefix under another preset", async () => {
    const s4 = SITUATIONS.find((s) => s.id === "S4")!;
    const env = new AgentEnvironment({ preset: "milestone", prefix: s4.prefix! });
    await expect(episode(env, 0)).rejects.toThrow(/held out/);
  });

  it("still lets tuning scenarios run on tuning seeds", async () => {
    const controller = new AbortController();
    controller.abort();
    const out = await episode(environmentFor("S1"), 0, { signal: controller.signal });
    expect(out.reason).toBe("manual_stop");
  });

  it("the live launcher and the legacy runner have no way around the gate", () => {
    const scripts = join(import.meta.dirname, "../../../scripts/midterm");
    for (const f of readdirSync(scripts).filter((f) => f.endsWith(".ts"))) {
      const src = readFileSync(join(scripts, f), "utf8");
      // A script that builds players must hand them to the gated runner.
      if (/new (LLMPlayer|QuestBaseline|ExplorationBaseline)\b|policiesFor\(/.test(src)) expect(src, f).toMatch(/runEpisode\(|runSuite\(/);
    }
  });
});

describe("owner approvals and the final register", () => {
  it("issues a grant only for the approved, clean commit and the approved plan", () => {
    const r = repo();
    const head = r.info().head;
    const plan = { player: "baseline-explore", stage: "final", situations: ["S4" as const], seeds: [100] };
    expect(() => authorizeFinalRun(plan, r.info())).toThrow(/No owner approval/);
    recordApproval(r.info(), approval(head));
    expect(authorizeFinalRun(plan, r.info()).covers("baseline-explore", "S4", 100)).toBe(true);
    expect(() => authorizeFinalRun({ ...plan, player: "model-history" }, r.info())).toThrow(/No owner approval/);
    expect(() => authorizeFinalRun({ ...plan, situations: ["S2"] }, r.info())).toThrow(/No owner approval/);
    expect(() => authorizeFinalRun({ ...plan, stage: "contingency" }, r.info())).toThrow(/No owner approval/);
    writeFileSync(join(r.root, "dirty.txt"), "x");
    expect(() => authorizeFinalRun(plan, r.info())).toThrow(/clean worktree/);
    rmSync(join(r.root, "dirty.txt"));
    r.git("commit", "-q", "--allow-empty", "-m", "next");
    expect(() => authorizeFinalRun(plan, r.info())).toThrow(/No owner approval/);
  });

  it("rejects malformed approvals", () => {
    const r = repo();
    const head = r.info().head;
    expect(() => recordApproval(r.info(), approval(head.slice(0, 12)))).toThrow(/40-character/);
    expect(() => recordApproval(r.info(), approval(head, { seeds: [0] }))).toThrow(/seeds 100, 101/);
    expect(() => recordApproval(r.info(), approval(head, { approvedBy: " " }))).toThrow(/who approved/);
    expect(existsSync(registerPath(r.info()))).toBe(false);
  });

  it("claims each episode once, re-checks the commit, and keeps a verifiable chain", () => {
    const r = repo();
    recordApproval(r.info(), approval(r.info().head));
    const grant = authorizeFinalRun({ player: "baseline-explore", stage: "final", situations: ["S4"], seeds: [100] }, r.info());
    expect(() => grant.claim("baseline-explore", "S2", 100, 1)).toThrow(/does not cover/);
    const claim = grant.claim("baseline-explore", "S4", 100, 1);
    expect(grant.hasClaim("S4", 100)).toBe(true);
    expect(() => grant.claim("baseline-explore", "S4", 100, 2)).toThrow(/already claimed/);
    grant.finish(claim, { status: "terminated", reason: "manual_stop", endHash: null, chargedUsd: null });
    const lines = readRegister(registerPath(r.info()));
    expect(lines.map((l) => l.data.event)).toEqual(["approve", "claim", "finish"]);
    // A commit after the grant blocks further claims.
    r.git("commit", "-q", "--allow-empty", "-m", "moved");
    expect(() => grant.claim("baseline-explore", "S4", 101, 1)).toThrow(/does not cover|HEAD is/);
  });

  it("refuses an edited or truncated-mid-line register", () => {
    const r = repo();
    recordApproval(r.info(), approval(r.info().head));
    recordApproval(r.info(), approval(r.info().head, { situations: ["F"] }));
    const path = registerPath(r.info());
    const text = readFileSync(path, "utf8");
    writeFileSync(path, text.replace('"S1","S4","F"', '"S1","S4","F","S2"'));
    expect(() => readRegister(path)).toThrow(/hash chain is broken/);
    expect(() => authorizeFinalRun({ player: "baseline-explore", stage: "final", situations: ["F"], seeds: [100] }, r.info())).toThrow(/hash chain/);
    writeFileSync(path, text.slice(0, -5));
    expect(() => readRegister(path)).toThrow(/mid-line/);
  });

  it("lets a claimed final-seed episode through the runner", async () => {
    const r = repo();
    recordApproval(r.info(), approval(r.info().head));
    const grant = authorizeFinalRun({ player: "baseline-explore", stage: "final", situations: ["S1"], seeds: [100] }, r.info());
    await expect(episode(environmentFor("S1"), 100, { finalGrant: grant })).rejects.toThrow(/not claimed/);
    grant.claim("baseline-explore", "S1", 100, 1);
    const controller = new AbortController();
    controller.abort();
    const out = await episode(environmentFor("S1"), 100, { finalGrant: grant, signal: controller.signal });
    expect(out.reason).toBe("manual_stop");
    expect(out.decisions).toEqual({ sieg: 0, coco: 0 });
  });
});

describe("final runs in the harness", () => {
  it("refuse without a grant, or with one that does not cover the plan, before writing output", async () => {
    const r = repo();
    const out = join(tmp(), "run");
    await expect(runSuite({ player: "baseline-explore", situations: ["S4"], seeds: [100], final: true, outDir: out, gitHash: "x" })).rejects.toThrow(/owner approval/);
    recordApproval(r.info(), approval(r.info().head, { situations: ["F"] }));
    const grant = authorizeFinalRun({ player: "baseline-explore", stage: "final", situations: ["F"], seeds: [100] }, r.info());
    await expect(runSuite({ player: "baseline-explore", situations: ["S4"], seeds: [100], final: true, outDir: out, gitHash: "x", finalGrant: grant })).rejects.toThrow(/does not cover/);
    await expect(runSuite({ player: "baseline-explore", situations: ["S1"], seeds: [0], outDir: out, gitHash: "x", finalGrant: grant })).rejects.toThrow(/only used by a final run/);
    expect(existsSync(out)).toBe(false);
    mkdirSync(out);
  });
});
