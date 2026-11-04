// Situation A — Full Hedge Maze (S2-A), the frozen evaluation label for the
// current-revision S2-local scenario (packages/agent/src/situationA.ts,
// docs/midterm/SITUATION_A.md). Tuning seeds 0 and 1 only; no held-out start
// is built and no model is called. Raw authoritative state is read only by
// these trusted assertions, never by a policy.
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { spawnMazeEnemies } from "../../../apps/server/src/hedgeMaze.js";
import { maps } from "../../shared/src/maps.js";
import { newHedgeMaze } from "../../shared/src/hedgeMaze.js";
import { episodes, stateHash } from "../src/evaluator.js";
import { environmentFor, situation, SITUATIONS, HISTORICAL_SITUATIONS } from "../src/suite.js";
import { EPISODE_CAP_USD, runConfigHash, validatePlan, type ModelSetup } from "../src/harness.js";
import { SITUATION_A, SITUATION_A_HASH, SITUATION_A_V1, canonicalJson, evaluationLabel } from "../src/situationA.js";
import { runEpisode } from "../src/runner.js";
import { TraceWriter, verifyTrace, type TraceLine } from "../src/trace.js";
import { QuestBaseline } from "../src/policies/questBaseline.js";
import { briefingId } from "../src/policies/llm.js";
import { tutorialId } from "../src/playerKnowledge.js";
import type { ActionSpec, GameAction, Observation, PlayerId } from "../src/types.js";

const A = SITUATION_A;
const root = fileURLToPath(new URL("../../..", import.meta.url));
// In this repository the packaged evidence is under midterms/saadsatter/; in the course folder it is at the root.
const stage = existsSync(join(root, "midterms/saadsatter/evidence")) ? join(root, "midterms/saadsatter") : root;
/** S2-A version 2's reference run (offline, 2026-11-04). It replays under the current game. */
const REFERENCE_V2 = join(stage, "evidence/traces/baseline-quest-S2-local-seed0-v2/trace.jsonl");
/** Version 1 runs: played on the game before ffbdecb; they replay only at 96625b5. */
const COMMITTED = {
  "baseline-live": join(stage, "evidence/traces/baseline-quest-S2-local-seed0-live/trace.jsonl"),
  "pilot-11": join(root, "docs/midterm/evidence/pilot-11-model-guided/trace.jsonl"),
  "pilot-12": join(stage, "evidence/traces/pilot-12-model-guided-S2-local-seed0/trace.jsonl"),
  "pilot-13": join(stage, "evidence/traces/pilot-13-model-memory-S2-local-seed0/trace.jsonl"),
  "pilot-15": join(stage, "evidence/traces/pilot-15-model-memory-S2-local-seed0/trace.jsonl"),
} as const;
const readTrace = (path: string): TraceLine[] => readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const heroes: PlayerId[] = ["sieg", "coco"];

function start(seed: number, options: Parameters<typeof environmentFor>[1] = {}) {
  let room!: GameRoom;
  const env = environmentFor(A.situation, { ...options, room: (r) => { room = r; } });
  return { env, room: () => room, reset: () => env.reset(seed) };
}

/**
 * Each hero's own sequence of steps (tick and action) and result state hashes.
 * Per hero, because the order in which the two heroes' lines are written can
 * differ between a paced live run and an offline one; the play does not.
 */
function perHero(lines: TraceLine[]) {
  const out: Record<PlayerId, string> = { sieg: "", coco: "" };
  for (const h of heroes) {
    const d = createHash("sha256");
    for (const l of lines.filter((x) => x.player === h)) {
      const v = l.data as { action?: unknown; hash?: string };
      if (l.type === "step") d.update(JSON.stringify(["step", l.tick, v.action]));
      if (l.type === "result") d.update(JSON.stringify(["result", l.tick, v.hash ?? null]));
    }
    out[h] = d.digest("hex");
  }
  return out;
}

/** One baseline-quest episode on S2-A, traced in memory. */
async function baselineRun(seed: number) {
  const trace = new TraceWriter();
  const s = start(seed, { trace: (e) => trace.write(e) });
  const outcome = await runEpisode(s.env, { sieg: new QuestBaseline("Sieg"), coco: new QuestBaseline("Coco") }, trace, { seed, wallClockMs: 300_000 });
  return { outcome, trace: trace.lines, room: s.room(), env: s.env };
}
let seed0: Promise<Awaited<ReturnType<typeof baselineRun>>> | undefined;
const baselineSeed0 = () => (seed0 ??= baselineRun(0));

describe("S2-A definition", () => {
  it("is frozen: any change to the definition changes this hash and needs the owner's approval", () => {
    expect(SITUATION_A_HASH).toBe("a9ee23855c17c18aa5228f5a554607362b87958642c942335fdfd4d06a58bc66");
    expect(A.version).toBe(2);
  });

  it("keeps version 1 verbatim, with its original hash, and records the succession", () => {
    expect(createHash("sha256").update(canonicalJson(SITUATION_A_V1)).digest("hex")).toBe("4b3c9bb309e7d0bcc022f1df6a7e58cf11a3767c02fd7bd6cb62dfa845cd4207");
    expect(SITUATION_A_V1).toMatchObject({ version: 1, frozenOn: "2026-10-29", situation: "S2-local", preset: "S2-local-v2" });
    expect(A.supersedes).toEqual({ version: 1, definitionHash: "4b3c9bb309e7d0bcc022f1df6a7e58cf11a3767c02fd7bd6cb62dfa845cd4207", commit: "96625b5" });
    // Version 2 changes the game, not the situation: same scenario, objective, limits and prompts.
    const v1 = SITUATION_A_V1 as never as Record<string, unknown>;
    for (const k of ["situation", "preset", "objective", "success", "goal", "limits", "prompts", "seeds", "players"] as const) expect(A[k], k).toEqual(v1[k]);
    expect((v1.start as { tick: number }).tick).toBe(A.start.tick);
    expect(A.start.hashes).not.toEqual((v1.start as { hashes: unknown }).hashes);
  });

  it("is a label for the existing S2-local scenario, adding no scenario id and changing none", () => {
    const def = situation("S2-local");
    expect(A.situation).toBe("S2-local");
    expect(A.preset).toBe(def.preset);
    expect(A.preset).toBe("S2-local-v2");
    // The scenarios that existed when S2-A was frozen are unchanged and in place;
    // S2-B and S2-C (Hedge Maze Situations B and C) were appended later.
    expect(SITUATIONS.map((s) => s.id).slice(0, 7)).toEqual(["S1", "S2", "S3", "S4", "F", "S2-local", "S3-local"]);
    expect(HISTORICAL_SITUATIONS.map((s) => s.id)).toEqual(["S2-v1", "S3-v1", "S2-local-v1", "S3-local-v1"]);
    expect(def.heldOut).toBe(false);
    // Limits, goal and spend cap are read from, and equal to, what the harness enforces.
    const { wallClockSeconds, modelCallTimeoutMs, maxConsecutivePolicyFailures, episodeSpendCapUsd, ...episodeLimits } = A.limits;
    expect(episodeLimits).toEqual(episodes[def.preset].limits);
    expect(episodeLimits).toEqual({ maxTicks: 18_000, maxDecisionsPerPlayer: 1_600, maxModelCallsPerPlayer: 400, maxTokensPerPlayer: 4_000_000 });
    expect(episodeSpendCapUsd).toBe(EPISODE_CAP_USD["S2-local"]);
    expect({ wallClockSeconds, modelCallTimeoutMs, maxConsecutivePolicyFailures }).toEqual({ wallClockSeconds: { model: 3600, scripted: 600 }, modelCallTimeoutMs: 30_000, maxConsecutivePolicyFailures: 3 });
    expect(A.goal).toBe(episodes[def.preset].goal);
    expect(A.prompts).toEqual({ tutorialId: tutorialId(def.tutorial!), briefingId: briefingId(def.briefing!) });
    // The Hedge Maze success predicate is the revision 1 S3 one, unchanged.
    expect(episodes[def.preset].success).toBe(episodes.S3.success);
  });

  it("labels only S2-local", () => {
    expect(evaluationLabel("S2-local")).toEqual({ label: "S2-A", definitionHash: SITUATION_A_HASH });
    for (const s of [...SITUATIONS, ...HISTORICAL_SITUATIONS]) if (s.id !== "S2-local") expect(evaluationLabel(s.id)).toBeNull();
  });

  it("accepts every planned player on the tuning seeds and refuses final seeds", () => {
    for (const kind of Object.values(A.players).flat()) {
      const model = kind.startsWith("model") ? { model: { stage: "pilot" } as ModelSetup } : {};
      expect(() => validatePlan({ player: kind, situations: [A.situation], seeds: [0, 1], final: false, ...model })).not.toThrow();
      expect(() => validatePlan({ player: kind, situations: [A.situation], seeds: [100], final: false, ...model })).toThrow(/seeds 0, 1 only/);
    }
    expect(A.players.primary).toEqual(["baseline-quest", "model-memory"]);
    expect(A.players.supplementary).toEqual(["model-guided"]);
  });

  it("hashes the run configuration independently of key order, and changes it with any limit", () => {
    const base = {
      situation: "S2-local" as const, preset: "S2-local-v2", suiteRevision: 2, evaluation: evaluationLabel("S2-local"), player: "model-memory" as const,
      policies: { sieg: "a", coco: "b" }, promptHashes: { sieg: "p", coco: "q" }, gateway: "openai:gpt-6-luna@medium", maxBatch: 4,
      manualHash: "m", limits: { maxTicks: 1, maxDecisionsPerPlayer: 2 }, modelLimits: null, wallLimitSeconds: 3600, episodeCapUsd: 0.6,
    };
    const reordered = { ...base, limits: { maxDecisionsPerPlayer: 2, maxTicks: 1 } };
    expect(runConfigHash(reordered)).toBe(runConfigHash(base));
    expect(runConfigHash({ ...base, episodeCapUsd: 0.3 })).not.toBe(runConfigHash(base));
    expect(runConfigHash({ ...base, promptHashes: { sieg: "p", coco: "r" } })).not.toBe(runConfigHash(base));
  });
});

describe("S2-A reset", () => {
  for (const seed of A.seeds.tuning)
    it(`seed ${seed}: the documented start state — maze entrance, pristine puzzle, nothing pre-completed`, async () => {
      const s = start(seed);
      const r = await s.reset();
      const w = s.room().state;
      expect(r.startHash).toBe(A.start.hashes[seed]);
      expect(stateHash(w)).toBe(r.startHash);
      expect(r.tick).toBe(A.start.tick);
      expect(r.episode).toBe(`S2-local-v2-${seed}-${A.start.hashes[seed].slice(0, 8)}`);
      expect(w.sceneId).toBe("HEDGE_MAZE");
      // Both heroes at the normal entrance spawn, full health, in the maze.
      const players = Object.values(w.players);
      expect(players.map((p) => p.role).sort()).toEqual(["EMBER", "OATH"]);
      for (const [i, p] of players.entries()) {
        expect({ x: p.x, y: p.y }).toEqual({ x: maps.HEDGE_MAZE.spawn.x + i * 50, y: maps.HEDGE_MAZE.spawn.y });
        expect(p.hp).toBe(100);
        expect(p.sceneId).toBe("HEDGE_MAZE");
      }
      // Dry hedge unburned, cow in the lane, wolf free with the key, gate shut, chest unclaimed.
      expect(w.puzzles.hedgeMaze.maze).toEqual(newHedgeMaze());
      expect(w.puzzles.hedgeGate.complete).toBe(false);
      expect(w.enemies).toEqual(spawnMazeEnemies());
      expect(w.inventory!.claimed ?? []).not.toContain("hedge-runner-key");
      expect(w.inventory!.claimed ?? []).not.toContain("hedge-shears-chest");
      expect(w.inventory!.counts.enchanted_shears ?? 0).toBe(0);
      expect(episodes[A.preset].success(w)).toBe(false);
      expect(w.story!.flags).not.toContain("chapter0.maze-banter");
      // The shared backpack holds exactly what the historical S2-local runs started with.
      const held = Object.fromEntries(Object.entries(w.inventory!.counts).filter(([, n]) => (n ?? 0) > 0));
      expect(held).toEqual({ moonleaf: 1, crystal_vial: 2, candlewick: 1, fresh_bread: 1, honey_pastry: 1, alden_journal: 1, strange_cloth: 1, star_drawing: 1 });
      expect(await s.env.outcome()).toMatchObject({ status: "ongoing", ticks: 0, decisions: { sieg: 0, coco: 0 }, invalidActions: { sieg: 0, coco: 0 }, modelCalls: { sieg: 0, coco: 0 } });
    });

  it("repeated resets give identical hashes, authoritative state and observations", async () => {
    const s = start(0);
    const first = await s.reset();
    const world = structuredClone(s.room().state);
    const views = await Promise.all(heroes.flatMap((h) => [s.env.observe(h), s.env.legal_actions(h)]));
    for (let i = 0; i < 3; i++) {
      expect(await s.reset()).toEqual(first);
      expect(s.room().state).toEqual(world);
      expect(await Promise.all(heroes.flatMap((h) => [s.env.observe(h), s.env.legal_actions(h)]))).toEqual(views);
    }
    // A fresh environment (a new process's view) gives the same start too.
    expect((await start(0).reset()).startHash).toBe(first.startHash);
  });

  it("gives each hero exactly the observation the historical S2-local runs began with", async () => {
    const s = start(0);
    await s.reset();
    const committed = readTrace(COMMITTED["baseline-live"]);
    for (const h of heroes) {
      const first = committed.find((l) => l.type === "observation" && l.player === h)!.data as { observation: Observation; legal: ActionSpec[] };
      expect(await s.env.observe(h)).toEqual(first.observation);
      expect(await s.env.legal_actions(h)).toEqual(first.legal);
    }
  });

  it("seed 1 differs from seed 0 only in the room code and hero ids: a repeated trial, not a new situation", async () => {
    const a = start(0), b = start(1);
    await a.reset();
    await b.reset();
    const strip = (w: GameRoom["state"]) => {
      const c = structuredClone(w) as unknown as Record<string, unknown> & { players: Record<string, { id: string }> };
      delete c.roomCode;
      c.players = Object.fromEntries(Object.values(c.players).map((p) => [`#${(p as unknown as { role: string }).role}`, { ...p, id: "#" }]));
      return c;
    };
    expect(strip(b.room().state)).toEqual(strip(a.room().state));
    for (const h of heroes) {
      expect(await b.env.observe(h)).toEqual(await a.env.observe(h));
      expect(await b.env.legal_actions(h)).toEqual(await a.env.legal_actions(h));
    }
  });
});

describe("S2-A information boundary over a full baseline episode", { timeout: 120_000 }, () => {
  it("each hero sees only its own screen, its partner's messages, and no hidden state", async () => {
    const { trace, room } = await baselineRun(0);
    const ids = Object.keys(room.state.players);
    const forbidden = [
      ...ids, room.state.roomCode, "chapter0.", "puzzles", "hedgeMaze", "hedgeGate", "hedge-runner-key", "hedge-shears-chest",
      // Internal state keys. (Plain words such as "fleeing" may appear on the maze's painted signs, which players read.)
      '"runner":', '"waypoint":', '"fleeing":', '"roam":', '"parked":', '"burned":', '"caught":', "serverTick", "startHash", "stateHash", "milestone",
      // The HUD's Hedge Maze goal lines (apps/client/src/main.ts) are hidden from every agent.
      "defeat the guards, then Coco burns", "into the cow's left flank", "catch the wolf and press E to take its key",
      "Use the shared key at the eastern gate", "Open the shears chest with E",
    ];
    const sent: Record<PlayerId, string[]> = { sieg: [], coco: [] };
    let observations = 0;
    for (const l of trace) {
      if (l.type === "message") sent[l.player as PlayerId].push((l.data as { text: string }).text);
      if (l.type !== "observation") continue;
      observations++;
      const h = l.player as PlayerId;
      const { observation: o, legal } = l.data as { observation: Observation; legal: ActionSpec[] };
      const text = JSON.stringify(o);
      expect(o.player).toBe(h);
      expect(o.hero).toBe(h === "sieg" ? "Sieg" : "Coco");
      for (const f of forbidden) expect(text, `${h} observation at tick ${l.tick} leaks "${f}"`).not.toContain(f);
      expect(text).not.toMatch(UUID);
      // Partner and enemy health only as bars.
      expect(text).not.toMatch(/"HP \d|HP \d+\/\d+/);
      // Messages come only from the partner, and only ones the partner actually sent.
      const partner = h === "sieg" ? "coco" : "sieg";
      for (const m of o.messages) {
        expect(m.from).toBe(partner === "sieg" ? "Sieg" : "Coco");
        expect(sent[partner]).toContain(m.text);
      }
      for (const own of sent[h]) expect(o.messages.map((m) => m.text)).not.toContain(own);
      // Legal actions leak nothing either.
      const legalText = JSON.stringify(legal);
      for (const f of forbidden) expect(legalText, `${h} legal actions at tick ${l.tick} leak "${f}"`).not.toContain(f);
      expect(legalText).not.toMatch(UUID);
    }
    expect(observations).toBe(A.baselineReference.decisions);
    expect(sent.sieg.length + sent.coco.length).toBe(6);
  });

  it("legal actions are real game inputs whose options come only from that hero's own observation", async () => {
    const { trace } = await baselineRun(0);
    const known = new Set(["move", "attack", "defend", "ability", "interact", "use_item", "advance_dialogue", "choose_dialogue", "wait", "message"]);
    const sieg = new Set(["push", "super_speed", "heavy_break"]);
    const coco = new Set(["slow_time", "flight", "black_hole", "fireball", "ward"]);
    for (const l of trace.filter((x) => x.type === "observation")) {
      const h = l.player as PlayerId;
      const { observation: o, legal } = l.data as { observation: Observation; legal: ActionSpec[] };
      for (const spec of legal) {
        expect(known.has(spec.type), spec.type).toBe(true);
        const p = (spec.params ?? {}) as Record<string, unknown>;
        if (spec.type === "ability") {
          const values = (p.ability as { values: string[] }).values;
          for (const v of values) expect((h === "sieg" ? sieg : coco).has(v), `${h} offered ${v}`).toBe(true);
        }
        if (spec.type === "use_item") {
          expect(o.inventory.nearbyTarget, "use_item is offered only beside a target shown in the backpack panel").toBeDefined();
          const items = (p.item as { values: string[] }).values;
          for (const v of items) expect(o.inventory.items.map((i) => i.id)).toContain(v);
        }
        if (spec.type === "choose_dialogue")
          expect((p.option as { values: number[] }).values).toEqual((o.dialogue?.choices ?? []).map((c) => c.option));
      }
    }
  });
});

describe("S2-A baseline and terminal outcome", { timeout: 120_000 }, () => {
  it("baseline-quest completes the objective through the five operations with the committed reference result", async () => {
    const { outcome, trace, env, room } = await baselineSeed0();
    const ref = A.baselineReference;
    expect(outcome).toMatchObject({ status: "success", reason: "success", ticks: ref.gameTicks, seconds: ref.gameSeconds });
    expect(outcome.decisions.sieg + outcome.decisions.coco).toBe(ref.decisions);
    expect(outcome.invalidActions).toEqual({ sieg: 0, coco: 0 });
    expect(outcome.modelCalls).toEqual({ sieg: 0, coco: 0 });
    expect(trace.filter((l) => l.type === "message")).toHaveLength(ref.messages);
    expect(env.evaluatorReport().stateHash).toBe(ref.endHash);
    // Success is the evaluator's reading of authoritative state, not a claim.
    expect(room.state.inventory!.counts.enchanted_shears).toBe(1);
    expect(room.state.inventory!.claimed).toEqual(expect.arrayContaining(["hedge-runner-key", "hedge-shears-chest"]));
    expect(room.state.puzzles.hedgeGate.complete).toBe(true);
    expect(episodes[A.preset].success(room.state)).toBe(true);
    verifyTrace(trace);
  });

  it("plays the puzzle exactly as the committed version 2 reference did: same actions and the same authoritative state after every action", async () => {
    const { trace } = await baselineSeed0();
    expect(perHero(trace)).toEqual(perHero(readTrace(REFERENCE_V2)));
  });

  it("reports success only when the evaluator sees the Shears; a run that runs out of time ends tick_limit, not success", async () => {
    const s = start(0, { limits: { maxTicks: 120 } });
    await s.reset();
    const wait: GameAction = { type: "wait", ticks: 60 };
    for (let i = 0; i < 3; i++) await Promise.all([s.env.step("sieg", wait), s.env.step("coco", wait)]);
    const o = await s.env.outcome();
    expect(o).toMatchObject({ status: "terminated", reason: "tick_limit", ticks: 120 });
    expect(episodes[A.preset].success(s.room().state)).toBe(false);
    expect(await s.env.legal_actions("sieg")).toEqual([]);
  });

  it("seed 1 repeats seed 0's trajectory step for step", async () => {
    const [a, b] = [await baselineSeed0(), await baselineRun(1)];
    const actions = (t: TraceLine[]) => t.filter((l) => l.type === "step").map((l) => [l.player, l.tick, (l.data as { action: unknown }).action]);
    expect(actions(b.trace)).toEqual(actions(a.trace));
    expect(b.outcome).toMatchObject({ status: "success", ticks: a.outcome.ticks, decisions: a.outcome.decisions });
  });
});

describe("version 1 S2-local traces stay identifiable", { timeout: 120_000 }, () => {
  // They were played on the game before ffbdecb (no cow posts, griffin 320 HP),
  // so they replay step for step only at commit 96625b5. Here each one is
  // checked for integrity and for its recorded version 1 start; the current
  // start differs, so their episode ids cannot be confused with version 2's.
  const v1 = SITUATION_A_V1 as never as { start: { tick: number; hashes: Record<number, string> } };
  for (const [name, path] of Object.entries(COMMITTED))
    it(`${name}: an intact trace that began at version 1's start`, async () => {
      const lines = readTrace(path);
      verifyTrace(lines);
      const reset = lines.find((l) => l.type === "reset")!.data as { episode: string; seed: number; startHash: string; tick: number };
      expect(reset.startHash).toBe(v1.start.hashes[0]);
      expect(reset.tick).toBe(v1.start.tick);
      expect(reset.episode).toBe(`S2-local-v2-0-${v1.start.hashes[0].slice(0, 8)}`);
      const r = await start(reset.seed).reset();
      expect(r.startHash).not.toBe(reset.startHash);
      expect(r.episode).not.toBe(reset.episode);
    });

  // The version 2 reference replays end to end: each hero's recorded actions,
  // re-submitted in order, reproduce every result's state hash and the terminal state.
  for (const [name, path] of [["baseline-v2", REFERENCE_V2]] as const)
    it(`${name}: replays to the same results and terminal state`, async () => {
      const lines = readTrace(path);
      const reset = lines.find((l) => l.type === "reset")!.data as { seed: number };
      const terminal = lines.find((l) => l.type === "terminal")!.data as { reason: string; hash: string };
      const actions: Record<PlayerId, GameAction[]> = { sieg: [], coco: [] };
      const expected: Record<PlayerId, (string | null)[]> = { sieg: [], coco: [] };
      for (const l of lines) {
        const p = l.player as PlayerId | undefined;
        if (l.type === "action" && p) actions[p].push((l.data as { action: GameAction }).action);
        if (l.type === "result" && p) expected[p].push((l.data as { hash?: string }).hash ?? null);
      }
      const got: Record<PlayerId, (string | null)[]> = { sieg: [], coco: [] };
      let end: { reason: string; hash: string } | undefined;
      let refused = 0;
      const env = environmentFor(A.situation, {
        trace: (e) => {
          if (e.type === "result" && e.player) got[e.player as PlayerId].push((e.data as { hash?: string }).hash ?? null);
          if (e.type === "terminal") end = e.data as { reason: string; hash: string };
          if (e.type === "invalid_action") refused++;
        },
      });
      await env.reset(reset.seed);
      await Promise.all(heroes.map(async (h) => { for (const a of actions[h]) if ((await env.step(h, a)).done) return; }));
      expect(refused).toBe(0);
      expect(got).toEqual(expected);
      expect({ reason: end?.reason, hash: end?.hash }).toEqual({ reason: terminal.reason, hash: terminal.hash });
      expect(end!.reason).toBe("success");
    });
});
