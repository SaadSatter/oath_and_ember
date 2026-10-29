// Review H2 (and re-review H2-a/H2-b): held-out scenarios and final seeds are
// reachable only through an owner approval tied to a clean commit, claimed in
// an append-only register, as a single-use ticket bound to the approved player
// kind and used up by AgentEnvironment.reset() itself.
// No held-out episode is played here: refused runs stop before reset, held-out
// route development access is checked with the pure gate only, and the
// permitted runs are pre-aborted S1 episodes (reset, then stopped at once).
import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { AgentEnvironment } from "../src/environment.js";
import {
  admitReset, authorizeFinalRun, bindTicket, EpisodeTicket, FinalAccessError, FinalGrant, isGrant, isTicket, readRegister, recordApproval,
  registerPath, RouteDevelopmentAccess, routeDevelopmentAccess, type FinalApproval,
} from "../src/finalAccess.js";
import { QuestBaseline } from "../src/policies/questBaseline.js";
import { Director } from "../src/route/director.js";
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

const S4_PREFIX = SITUATIONS.find((s) => s.id === "S4")!.prefix!.name;
const aborted = () => {
  const c = new AbortController();
  c.abort();
  return c.signal;
};
/** A repository with an approval covering S1, S4 and F at both final seeds for baseline-explore. */
function approved() {
  const r = repo();
  recordApproval(r.info(), approval(r.info().head));
  const grant = authorizeFinalRun({ player: "baseline-explore", stage: "final", situations: ["S1"], seeds: [100, 101] }, r.info());
  return { r, grant };
}

describe("held-out gate at the environment boundary (every entrypoint)", () => {
  it("refuses S4, F and final seeds without a ticket, through runEpisode or a direct reset, before anything exists", async () => {
    const cases = () => [[environmentFor("S4"), 0], [environmentFor("F"), 1], [environmentFor("S1"), 100], [new AgentEnvironment({ preset: "milestone" }), 101], [new Director().env, 1]] as const;
    for (const [env, seed] of cases()) {
      const trace = new TraceWriter();
      await expect(runEpisode(env, policies(), trace, { seed, wallClockMs: 5_000 })).rejects.toThrow(FinalAccessError);
      expect(trace.lines, `${env.scenario().preset}/${seed}`).toEqual([]);
      expect(env.currentTick()).toBe(0);
    }
    // A hand-written loop calls reset() directly: the same gate refuses it.
    for (const [env, seed] of cases()) {
      await expect(env.reset(seed)).rejects.toThrow(/held out or uses a final seed/);
      expect(env.currentTick()).toBe(0);
      await expect(env.observe("sieg")).rejects.toThrow(/reset\(\) first/);
    }
  });

  it("refuses the held-out prefix under another preset", async () => {
    const env = new AgentEnvironment({ preset: "milestone", prefix: SITUATIONS.find((s) => s.id === "S4")!.prefix! });
    await expect(episode(env, 0)).rejects.toThrow(/held out/);
    await expect(env.reset(0)).rejects.toThrow(/held out/);
  });

  it("still lets tuning scenarios run on tuning seeds", async () => {
    const out = await episode(environmentFor("S1"), 0, { signal: aborted() });
    expect(out.reason).toBe("manual_stop");
  });

  it("refuses a final seed through the standalone smoke script (an alternate CLI entrypoint)", async () => {
    const out = join(tmp(), "smoke");
    const root = join(import.meta.dirname, "../../..");
    const r = await promisify(execFile)(process.execPath, ["--import", "tsx", "scripts/midterm/smoke.ts", "--seed", "100", "--out", out], { cwd: root }).then(
      () => ({ code: 0, err: "" }),
      (e: { code: number; stderr: string }) => ({ code: e.code, err: e.stderr }),
    );
    expect(r.code).not.toBe(0);
    expect(r.err).toMatch(/held out or uses a final seed/);
    expect(readFileSync(join(out, "trace.jsonl"), "utf8")).toBe("");
  }, 60_000);

  it("scripts hand players only to the gated runner, and only the route script takes route development access", () => {
    const scripts = join(import.meta.dirname, "../../../scripts/midterm");
    for (const f of readdirSync(scripts).filter((f) => f.endsWith(".ts"))) {
      const src = readFileSync(join(scripts, f), "utf8");
      // A script that builds players must hand them to the gated runner.
      if (/new (LLMPlayer|QuestBaseline|ExplorationBaseline)\b|policiesFor\(/.test(src)) expect(src, f).toMatch(/runEpisode\(|runSuite\(/);
      if (f !== "run-route.ts") expect(src, f).not.toMatch(/routeDevelopmentAccess|routeDevelopment:/);
    }
  });
});

describe("grants and tickets cannot be forged (H2-a)", () => {
  it("has no public way to make a grant, ticket or route access, and rejects look-alikes", async () => {
    const { r, grant } = approved();
    const info = r.info();
    const forge = (C: unknown, ...args: unknown[]) => () => new (C as new (...a: unknown[]) => unknown)(Symbol("finalAccess.issue"), ...args);
    expect(forge(FinalGrant, info, "fake", approval(info.head))).toThrow(/only by authorizeFinalRun/);
    expect(forge(EpisodeTicket, grant, "fake", "S4", 100)).toThrow(/only by FinalGrant.claim/);
    expect(forge(RouteDevelopmentAccess, "a forged purpose")).toThrow(/routeDevelopmentAccess/);
    expect((FinalGrant as unknown as { issue?: unknown }).issue).toBeUndefined();
    const lookalike = Object.assign(Object.create(FinalGrant.prototype), grant);
    expect(isGrant(lookalike)).toBe(false);
    expect(() => FinalGrant.prototype.claim.call(lookalike, "baseline-explore", "S1", 100, 1)).toThrow(/Not an issued grant/);
    const fakeTicket = Object.create(EpisodeTicket.prototype, { situation: { value: "S1" }, seed: { value: 100 }, player: { value: "baseline-explore" } });
    expect(isTicket(fakeTicket)).toBe(false);
    await expect(episode(environmentFor("S1"), 100, { finalTicket: fakeTicket, signal: aborted() })).rejects.toThrow(/Not an issued episode ticket/);
    expect(() => routeDevelopmentAccess("")).toThrow(/purpose/);
    // Approvals inside a grant are frozen: no widening after issue.
    expect(() => { (grant.approval as FinalApproval).player = "model-history"; }).toThrow(TypeError);
    expect(() => { (grant.approval.situations as string[]).push("S2"); }).toThrow(TypeError);
    // Nothing above reached the register.
    expect(readRegister(registerPath(info)).map((l) => l.data.event)).toEqual(["approve"]);
  });
});

describe("tickets are single-use (H2-a)", () => {
  it("admits one reset; a second run, a finished ticket, another seed or another claim are refused", async () => {
    const { grant } = approved();
    const ticket = grant.claim("baseline-explore", "S1", 100, 1);
    expect(ticket.state).toBe("claimed");
    // The wrong seed is refused before the ticket is used up.
    await expect(episode(environmentFor("S1"), 101, { finalTicket: ticket, signal: aborted() })).rejects.toThrow(/ticket is for S1 seed 100/);
    const ticket2 = grant.claim("baseline-explore", "S1", 101, 1);
    expect(() => grant.claim("baseline-explore", "S1", 101, 2)).toThrow(/already claimed/);
    const out = await episode(environmentFor("S1"), 101, { finalTicket: ticket2, signal: aborted() });
    expect(out.reason).toBe("manual_stop");
    expect(ticket2.state).toBe("used");
    // Re-running with the used ticket, on a fresh or the same environment.
    await expect(episode(environmentFor("S1"), 101, { finalTicket: ticket2, signal: aborted() })).rejects.toThrow(/is used; it cannot be bound/);
    const env = environmentFor("S1");
    expect(() => bindTicket(ticket2, "baseline-explore")).toThrow(/is used/);
    env.authorize(ticket2);
    await expect(env.reset(101)).rejects.toThrow(/is used; it cannot be used for a reset/);
    // The environment forgets a ticket after one reset.
    await expect(env.reset(101)).rejects.toThrow(/held out or uses a final seed/);
    grant.finish(ticket2, { status: "terminated", reason: "manual_stop", endHash: null, chargedUsd: null });
    expect(() => grant.finish(ticket2, { status: "x", reason: null, endHash: null, chargedUsd: null })).toThrow(/is finished/);
    await expect(episode(environmentFor("S1"), 101, { finalTicket: ticket2, signal: aborted() })).rejects.toThrow(/is finished/);
  });

  it("an unbound ticket handed straight to an environment admits nothing", async () => {
    const { grant } = approved();
    const ticket = grant.claim("baseline-explore", "S1", 100, 1);
    const env = environmentFor("S1");
    env.authorize(ticket);
    await expect(env.reset(100)).rejects.toThrow(/is claimed; it cannot be used for a reset/);
  });
});

describe("tickets are valid only for the approved player kind (H2-a)", () => {
  it("refuses other kinds, mixed pairs, shared instances and subclasses, then admits the approved kind", async () => {
    const { grant } = approved();
    const ticket = grant.claim("baseline-explore", "S1", 100, 1);
    class Tweaked extends ExplorationBaseline {}
    const wrong = [
      { sieg: new QuestBaseline("Sieg"), coco: new QuestBaseline("Coco") },
      { sieg: new ExplorationBaseline(), coco: new QuestBaseline("Coco") },
      (() => { const one = new ExplorationBaseline(); return { sieg: one, coco: one }; })(),
      { sieg: new Tweaked(), coco: new Tweaked() },
    ];
    for (const p of wrong) {
      await expect(runEpisode(environmentFor("S1"), p, new TraceWriter(), { seed: 100, wallClockMs: 5_000, finalTicket: ticket, signal: aborted() })).rejects.toThrow(/ticket is for baseline-explore/);
      expect(ticket.state).toBe("claimed");
    }
    const out = await runEpisode(environmentFor("S1"), policies(), new TraceWriter(), { seed: 100, wallClockMs: 5_000, finalTicket: ticket, signal: aborted() });
    expect(out.reason).toBe("manual_stop");
  });
});

describe("route development access (scripted route and checkpoint tests only)", () => {
  it("admits held-out resets for the route, reset-only at final seeds, and never with a ticket", () => {
    const access = routeDevelopmentAccess("finalAccess.test.ts: gate checks");
    expect(admitReset({ preset: "S4", prefix: S4_PREFIX }, 0, { routeDevelopment: access })).toEqual({ kind: "route-development", purpose: "finalAccess.test.ts: gate checks", resetOnly: false });
    expect(admitReset({ preset: "full", prefix: null }, 100, { routeDevelopment: access })).toMatchObject({ resetOnly: true });
    expect(() => admitReset({ preset: "S4", prefix: S4_PREFIX }, 0, {})).toThrow(/held out/);
    expect(() => admitReset({ preset: "S4", prefix: S4_PREFIX }, 0, { routeDevelopment: { purpose: "look-alike access" } })).toThrow(/Invalid route development/);
    const { grant } = approved();
    const ticket = grant.claim("baseline-explore", "S1", 100, 1);
    expect(() => admitReset({ preset: "S1", prefix: null }, 100, { ticket, routeDevelopment: access })).toThrow(/cannot be combined/);
    expect(() => admitReset({ preset: "S1", prefix: null }, 0, { ticket })).toThrow(/not held out/);
  });

  it("never runs players, labels its resets, and at a final seed refuses every step", async () => {
    const access = routeDevelopmentAccess("finalAccess.test.ts: final-seed reset only");
    const trace = new TraceWriter();
    await expect(runEpisode(environmentFor("S1", { routeDevelopment: access }), policies(), trace, { seed: 0, wallClockMs: 5_000 })).rejects.toThrow(/route development environment cannot run players/);
    const events: { type: string; data: unknown }[] = [];
    const env = environmentFor("S1", { routeDevelopment: access, trace: (e) => events.push(e) });
    await env.reset(100);
    expect(events[0]).toMatchObject({ type: "reset", data: { access: { kind: "route-development", resetOnly: true } } });
    expect(() => env.step("sieg", { type: "wait", ticks: 1 })).toThrow(/allows reset only/);
    expect(trace.lines).toEqual([]);
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
    expect(() => grant.claim("model-history", "S4", 100, 1)).toThrow(/does not cover/);
    const ticket = grant.claim("baseline-explore", "S4", 100, 1);
    expect(ticket).toMatchObject({ situation: "S4", seed: 100, player: "baseline-explore", state: "claimed" });
    expect(() => grant.claim("baseline-explore", "S4", 100, 2)).toThrow(/already claimed/);
    // A second grant for the same approval cannot claim it again either (register check).
    const again = authorizeFinalRun({ player: "baseline-explore", stage: "final", situations: ["S4"], seeds: [100] }, r.info());
    expect(() => again.claim("baseline-explore", "S4", 100, 2)).toThrow(/register line 2/);
    grant.finish(ticket, { status: "terminated", reason: "manual_stop", endHash: null, chargedUsd: null });
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
});

describe("final runs in the harness", () => {
  it("refuse without a grant, or with one that does not cover the plan, before writing output", async () => {
    const r = repo();
    const out = join(tmp(), "run");
    await expect(runSuite({ player: "baseline-explore", situations: ["S4"], seeds: [100], final: true, outDir: out, gitHash: "x" })).rejects.toThrow(/owner approval/);
    recordApproval(r.info(), approval(r.info().head, { situations: ["F"] }));
    const grant = authorizeFinalRun({ player: "baseline-explore", stage: "final", situations: ["F"], seeds: [100] }, r.info());
    await expect(runSuite({ player: "baseline-explore", situations: ["S4"], seeds: [100], final: true, outDir: out, gitHash: "x", finalGrant: grant })).rejects.toThrow(/does not cover/);
    await expect(runSuite({ player: "baseline-quest", situations: ["F"], seeds: [100], final: true, outDir: out, gitHash: "x", finalGrant: grant })).rejects.toThrow(/does not cover/);
    await expect(runSuite({ player: "baseline-explore", situations: ["S1"], seeds: [0], outDir: out, gitHash: "x", finalGrant: grant })).rejects.toThrow(/only used by a final run/);
    expect(existsSync(out)).toBe(false);
    mkdirSync(out);
  });
});
