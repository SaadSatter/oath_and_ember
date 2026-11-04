// Hedge Maze Situations B (cow puzzle) and C (wolf and key):
// packages/agent/src/hedgeMazeSituations.ts, docs/midterm/HEDGE_MAZE_SITUATIONS.md.
// Tuning seeds 0 and 1 only; no held-out start is built and no model is
// called (model players run against an offline fixture gateway with a scratch
// ledger). Raw authoritative state is read only by these trusted assertions.
import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { episodes, stateHash } from "../src/evaluator.js";
import { environmentFor, situation, midMazeBriefing, type SituationId } from "../src/suite.js";
import { EPISODE_CAP_USD, runSuite, validatePlan, type ModelSetup, type PlayerKind } from "../src/harness.js";
import { SITUATION_A, SITUATION_A_HASH } from "../src/situationA.js";
import { HEDGE_MAZE_SITUATIONS, SITUATION_B, SITUATION_B_HASH, SITUATION_C, SITUATION_C_HASH, mazeEvaluationLabel } from "../src/hedgeMazeSituations.js";
import { MAZE_CHECKPOINTS } from "../src/route/mazeCheckpointData.js";
import { deriveCheckpoint } from "../src/route/mazeCheckpoints.js";
import { runEpisode } from "../src/runner.js";
import { TraceWriter, verifyTrace, type TraceLine } from "../src/trace.js";
import { QuestBaseline } from "../src/policies/questBaseline.js";
import { SpendLedger } from "../src/ledger.js";
import type { Gateway } from "../src/budget.js";
import type { ActionSpec, GameAction, Observation, PlayerId } from "../src/types.js";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const stage = existsSync(join(root, "midterms/saadsatter/evidence")) ? join(root, "midterms/saadsatter") : root;
// Version 2: S2-A version 2's reference run (version 1 used ...-seed0-live/, the game before ffbdecb).
const SOURCE = join(stage, "evidence/traces/baseline-quest-S2-local-seed0-v2/trace.jsonl");
const readTrace = (path: string): TraceLine[] => readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const heroes: PlayerId[] = ["sieg", "coco"];
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const CASES = [
  { id: "S2-B", def: SITUATION_B, hash: SITUATION_B_HASH },
  { id: "S2-C", def: SITUATION_C, hash: SITUATION_C_HASH },
] as const;

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function start(id: SituationId, seed: number, options: Parameters<typeof environmentFor>[1] = {}) {
  let room!: GameRoom;
  const env = environmentFor(id, { ...options, room: (r) => { room = r; } });
  return { env, room: () => room, reset: () => env.reset(seed) };
}

/** The recorded run, replayed whole from the S2-A start, with the world hash at every tick. */
let recorded: Promise<Record<number, string>> | undefined;
function recordedHashes() {
  return (recorded ??= (async () => {
    const lines = readTrace(SOURCE);
    const hashes: Record<number, string> = {};
    const env = environmentFor("S2-local", { tick: (r) => { r.tick(); hashes[r.state.serverTick] = stateHash(r.state); } });
    await env.reset(0);
    const steps = (p: PlayerId) => lines.filter((l) => l.type === "step" && l.player === p).map((l) => (l.data as { action: GameAction }).action);
    await Promise.all(heroes.map(async (p) => { for (const a of steps(p)) if ((await env.step(p, a)).done) return; }));
    return hashes;
  })());
}

/** The rest of the recorded run after a checkpoint: each hero's remaining actions (the shortened one's remainder first). */
function suffix(id: "S2-B" | "S2-C") {
  const lines = readTrace(SOURCE);
  const cp = MAZE_CHECKPOINTS[id];
  const out: Record<PlayerId, GameAction[]> = { sieg: [], coco: [] };
  const expected: Record<PlayerId, (string | null)[]> = { sieg: [], coco: [] };
  for (const p of heroes) {
    const steps = lines.filter((l) => l.type === "step" && l.player === p);
    const n = cp.actions[p].length;
    const sh = cp.shortened?.player === p ? cp.shortened : null;
    if (sh) out[p].push({ ...(steps[sh.index].data as { action: GameAction }).action, ticks: sh.recordedTicks - sh.ticks } as GameAction);
    for (const l of steps.slice(n)) out[p].push((l.data as { action: GameAction }).action);
    // Results after the cut. The shortened action's remainder ends where the recorded one did.
    const results = lines.filter((l) => l.type === "result" && l.player === p);
    expected[p] = results.slice(n - (sh ? 1 : 0)).map((l) => (l.data as { hash?: string }).hash ?? null);
  }
  return { actions: out, expected, terminal: lines.find((l) => l.type === "terminal")!.data as { reason: string; hash: string } };
}

async function baselineRun(id: SituationId, seed: number) {
  const trace = new TraceWriter();
  const s = start(id, seed, { trace: (e) => trace.write(e) });
  const outcome = await runEpisode(s.env, { sieg: new QuestBaseline("Sieg"), coco: new QuestBaseline("Coco") }, trace, { seed, wallClockMs: 300_000 });
  return { outcome, trace: trace.lines, room: s.room(), env: s.env };
}

describe("Hedge Maze situations: definitions", () => {
  it("are frozen: any change changes these hashes and needs the owner's approval", () => {
    // Version 2 (2026-11-04, game change ffbdecb). Version 1: 4b3c9bb3…4207, 8032c9f2…e089, 7d9014a1…4695.
    expect(SITUATION_A_HASH).toBe("a9ee23855c17c18aa5228f5a554607362b87958642c942335fdfd4d06a58bc66");
    expect(SITUATION_B_HASH).toBe("016f1671da9a04f51d01ccde2b5c988f2d54a2907f628c3817fc51621183e919");
    expect(SITUATION_C_HASH).toBe("74b15da288fd405eca7d9451ca4781a5e88cff7c59194f66b1cc314fc5ffb890");
  });

  it("are three distinct situations with distinct ids, presets, definition hashes and start hashes", () => {
    expect(HEDGE_MAZE_SITUATIONS.map((s) => [s.label, s.situation])).toEqual([["S2-A", "S2-local"], ["S2-B", "S2-B"], ["S2-C", "S2-C"]]);
    expect(new Set(HEDGE_MAZE_SITUATIONS.map((s) => s.definitionHash)).size).toBe(3);
    const starts = [SITUATION_A.start.hashes, SITUATION_B.start.hashes, SITUATION_C.start.hashes].flatMap((h) => [h[0], h[1]]);
    expect(new Set(starts).size).toBe(6);
    for (const s of HEDGE_MAZE_SITUATIONS) expect(mazeEvaluationLabel(s.situation)).toEqual({ label: s.label, definitionHash: s.definitionHash });
    expect(mazeEvaluationLabel("S3-local")).toBeNull();
  });

  for (const { id, def } of CASES)
    it(`${id}: a development-informed tuning case with S2-A's objective, success check and limits`, () => {
      const s = situation(id);
      expect(s.heldOut).toBe(false);
      expect(s.revision).toBe(2);
      expect(def.role).toMatch(/development-informed/);
      expect(def.preset).toBe(id);
      expect(episodes[s.preset].success).toBe(episodes[SITUATION_A.preset].success);
      expect(episodes[s.preset].limits).toEqual(episodes[SITUATION_A.preset].limits);
      expect(def.limits).toEqual(SITUATION_A.limits);
      expect(EPISODE_CAP_USD[id]).toBe(EPISODE_CAP_USD["S2-local"]);
      expect(def.objective).toBe(SITUATION_A.objective);
      expect(def.start.tick).toBe(MAZE_CHECKPOINTS[id].cutTick);
    });

  it("gives B and C one briefing text, differing only in the id, with no solution, place, direction or ability", () => {
    expect(midMazeBriefing("S2-B").replace("S2-B", "X")).toBe(midMazeBriefing("S2-C").replace("S2-C", "X"));
    for (const id of ["S2-B", "S2-C"] as const) {
      const b = situation(id).briefing!;
      expect(b).toBe(midMazeBriefing(id));
      for (const spoiler of [/cow/i, /wolf/i, /key/i, /gate/i, /chest/i, /hedge(?! maze)/i, /bay/i, /lane/i, /black hole/i, /fireball/i, /push/i, /slow time/i, /super speed/i, /north|south|east|west/i, /\d/])
        expect(b.replace(id, ""), `${id} briefing mentions ${spoiler}`).not.toMatch(spoiler);
    }
  });

  it("accepts the planned players on the tuning seeds only; model-guided has no walkthrough for B or C", () => {
    for (const id of ["S2-B", "S2-C"] as const) {
      for (const kind of ["baseline-quest", "baseline-explore", "model-memory", "model-obs-only", "model-history"] as PlayerKind[]) {
        const model = kind.startsWith("model") ? { model: { stage: "pilot" } as ModelSetup } : {};
        expect(() => validatePlan({ player: kind, situations: [id], seeds: [0, 1], ...model })).not.toThrow();
        expect(() => validatePlan({ player: kind, situations: [id], seeds: [100], ...model })).toThrow();
      }
      expect(() => validatePlan({ player: "model-guided", situations: [id], seeds: [0], model: { stage: "pilot" } as ModelSetup })).toThrow(/restricted/);
    }
  });
});

describe("Hedge Maze situations: checkpoint provenance", () => {
  it("names a committed, hash-verified source trace", () => {
    const raw = readFileSync(SOURCE);
    verifyTrace(readTrace(SOURCE));
    for (const { id, def } of CASES) {
      expect(MAZE_CHECKPOINTS[id].source.sha256).toBe(createHash("sha256").update(raw).digest("hex"));
      expect(def.provenance.traceSha256).toBe(MAZE_CHECKPOINTS[id].source.sha256);
      expect(def.provenance.trace).toBe("midterms/saadsatter/evidence/traces/baseline-quest-S2-local-seed0-v2/trace.jsonl");
    }
  });

  it("the committed checkpoint data is exactly what the trace derives (re-derived here)", () => {
    const lines = readTrace(SOURCE);
    for (const id of ["S2-B", "S2-C"] as const) {
      const cp = MAZE_CHECKPOINTS[id];
      expect(deriveCheckpoint(lines, cp.cutTick)).toEqual({ actions: cp.actions, shortened: cp.shortened });
    }
    expect(MAZE_CHECKPOINTS["S2-B"].shortened).toEqual({ player: "coco", index: 63, recordedTicks: 59, ticks: 53 });
    // In version 2, Coco is 1 tick into a 20-tick wait at 1962 (version 1: both between actions).
    expect(MAZE_CHECKPOINTS["S2-C"].shortened).toEqual({ player: "coco", index: 84, recordedTicks: 20, ticks: 1 });
    expect(MAZE_CHECKPOINTS["S2-B"].actions.sieg).toHaveLength(59);
    expect(MAZE_CHECKPOINTS["S2-C"].actions.coco).toHaveLength(85);
  });

  it("checkpoint replay uses only the five operations (no room, state or puzzle access)", () => {
    const src = readFileSync(new URL("../src/route/mazeCheckpoints.ts", import.meta.url), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const forbidden of ["GameRoom", "apps/server", ".room", "puzzles", "receiveInput", "transition(", "state."]) expect(src).not.toContain(forbidden);
    expect(src).toContain("env.step(");
  });

  it("refuses a cut that would need a non-movement action shortened", () => {
    const lines = readTrace(SOURCE);
    // Coco's Black Hole (tick 1337, 2 ticks) is running at tick 1338.
    expect(() => deriveCheckpoint(lines, 1338)).toThrow(/cannot be shortened/);
  });
});

describe("Hedge Maze situations: reset", { timeout: 120_000 }, () => {
  for (const { id, def } of CASES)
    it(`${id}: each start is the recorded run's exact world at the cut tick (seed 0)`, async () => {
      const hashes = await recordedHashes();
      const r = await start(id, 0).reset();
      expect(r.tick).toBe(def.start.tick);
      expect(r.startHash).toBe(hashes[def.start.tick]);
      expect(r.startHash).toBe(def.start.hashes[0]);
    });

  for (const { id, def } of CASES)
    for (const seed of [0, 1])
      it(`${id} seed ${seed}: the documented, repeatable start state with fresh agent memories`, async () => {
        const s = start(id, seed);
        const r = await s.reset();
        const w = structuredClone(s.room().state);
        expect(r.startHash).toBe(def.start.hashes[seed]);
        expect(r.episode).toBe(`${id}-${seed}-${def.start.hashes[seed].slice(0, 8)}`);
        expect(w.sceneId).toBe("HEDGE_MAZE");
        const maze = w.puzzles.hedgeMaze.maze!;
        expect(maze.burned).toBe(true);
        expect(maze.cow.parked).toBe(id === "S2-C");
        expect(maze.runner.caught).toBe(false);
        expect(w.puzzles.hedgeGate.complete).toBe(false);
        expect(Object.keys(w.enemies)).toHaveLength(0);
        expect(w.inventory!.claimed ?? []).not.toContain("hedge-runner-key");
        expect(w.inventory!.claimed ?? []).not.toContain("hedge-shears-chest");
        expect(w.inventory!.counts.enchanted_shears ?? 0).toBe(0);
        expect(episodes[situation(id).preset].success(w)).toBe(false);
        for (const p of Object.values(w.players)) {
          expect(p.sceneId).toBe("HEDGE_MAZE");
          expect(p.hp).toBeGreaterThan(0);
        }
        for (const h of heroes) {
          const o = await s.env.observe(h);
          expect(o.messages).toEqual([]); // messages sent while reaching the checkpoint are not carried over
          expect(o.feedback).toEqual([]);
          expect(o.dialogue).toBeNull();
          expect(o.discovered.areas).toEqual(["Hedge Maze"]);
        }
        expect(await s.env.outcome()).toMatchObject({ status: "ongoing", ticks: 0, decisions: { sieg: 0, coco: 0 }, invalidActions: { sieg: 0, coco: 0 }, modelCalls: { sieg: 0, coco: 0 } });
        const views = await Promise.all(heroes.flatMap((h) => [s.env.observe(h), s.env.legal_actions(h)]));
        expect(await s.reset()).toEqual(r);
        expect(s.room().state).toEqual(w);
        expect(await Promise.all(heroes.flatMap((h) => [s.env.observe(h), s.env.legal_actions(h)]))).toEqual(views);
      });

  for (const { id } of CASES)
    it(`${id}: seed 1 shows both heroes exactly what seed 0 does (a repeated trial)`, async () => {
      const a = start(id, 0), b = start(id, 1);
      await a.reset();
      await b.reset();
      for (const h of heroes) {
        expect(await b.env.observe(h)).toEqual(await a.env.observe(h));
        expect(await b.env.legal_actions(h)).toEqual(await a.env.legal_actions(h));
      }
    });
});

describe("Hedge Maze situations: reachability and unchanged mechanics", { timeout: 120_000 }, () => {
  for (const id of ["S2-B", "S2-C"] as const)
    it(`${id}: the rest of the recorded play, from the checkpoint, reproduces every recorded state and reaches success`, async () => {
      const { actions, expected, terminal } = suffix(id);
      const got: Record<PlayerId, (string | null)[]> = { sieg: [], coco: [] };
      let end: { reason: string; hash: string } | undefined;
      let refused = 0;
      const env = environmentFor(id, {
        trace: (e) => {
          if (e.type === "result" && e.player) got[e.player as PlayerId].push((e.data as { hash?: string }).hash ?? null);
          if (e.type === "terminal") end = e.data as { reason: string; hash: string };
          if (e.type === "invalid_action") refused++;
        },
      });
      await env.reset(0);
      await Promise.all(heroes.map(async (h) => { for (const a of actions[h]) if ((await env.step(h, a)).done) return; }));
      expect(refused).toBe(0);
      // The shortened action's remainder ends at a different point from the recorded one only in where it started.
      for (const h of heroes) expect(got[h].slice(1)).toEqual(expected[h].slice(1));
      expect({ reason: end?.reason, hash: end?.hash }).toEqual({ reason: "success", hash: terminal.hash });
    });
});

describe("Hedge Maze situations: scripted baseline", { timeout: 180_000 }, () => {
  it("S2-B: baseline-quest, unchanged, completes the objective", async () => {
    const { outcome, trace, env, room } = await baselineRun("S2-B", 0);
    const ref = SITUATION_B.baselineReference as Record<string, number | string>;
    expect(outcome).toMatchObject({ status: "success", reason: "success", ticks: ref.gameTicks, seconds: ref.gameSeconds });
    expect(outcome.decisions.sieg + outcome.decisions.coco).toBe(ref.decisions);
    expect(outcome.invalidActions).toEqual({ sieg: 0, coco: 0 });
    expect(trace.filter((l) => l.type === "message")).toHaveLength(ref.messages as number);
    expect(env.evaluatorReport().stateHash).toBe(ref.endHash);
    expect(room.state.inventory!.counts.enchanted_shears).toBe(1);
    expect(room.state.puzzles.hedgeMaze.maze!.cow.parked).toBe(true);
  });

  it("S2-C: baseline-quest, unchanged, cannot resume mid-maze and ends at the tick limit (a known limitation, not a game failure)", async () => {
    const { outcome, env } = await baselineRun("S2-C", 0);
    const ref = SITUATION_C.baselineReference as Record<string, number | string>;
    expect(outcome).toMatchObject({ status: "terminated", reason: "tick_limit", ticks: 18_000 });
    expect(outcome.invalidActions).toEqual({ sieg: 0, coco: 0 });
    expect(env.evaluatorReport().stateHash).toBe(ref.endHash);
  });
});

describe("Hedge Maze situations: information boundary, legal and illegal actions", { timeout: 120_000 }, () => {
  async function scan(id: "S2-B" | "S2-C", maxTicks: number) {
    const trace = new TraceWriter();
    const s = start(id, 0, { trace: (e) => trace.write(e), limits: { maxTicks } });
    await runEpisode(s.env, { sieg: new QuestBaseline("Sieg"), coco: new QuestBaseline("Coco") }, trace, { seed: 0, wallClockMs: 300_000 });
    const room = s.room();
    const forbidden = [
      ...Object.keys(room.state.players), room.state.roomCode, "chapter0.", "puzzles", "hedgeMaze", "hedgeGate", "hedge-runner-key", "hedge-shears-chest",
      '"runner":', '"waypoint":', '"fleeing":', '"roam":', '"parked":', '"burned":', '"caught":', "serverTick", "startHash", "stateHash", "milestone",
      "defeat the guards, then Coco burns", "into the cow's left flank", "catch the wolf and press E to take its key", "Use the shared key at the eastern gate", "Open the shears chest with E",
      // Nothing about the checkpoint or its source reaches a player.
      "checkpoint", "baseline", "recorded", "S2-B", "S2-C", "S2-local",
    ];
    let n = 0;
    for (const l of trace.lines.filter((x) => x.type === "observation")) {
      n++;
      const h = l.player as PlayerId;
      const { observation: o, legal } = l.data as { observation: Observation; legal: ActionSpec[] };
      expect(o.player).toBe(h);
      const text = JSON.stringify(o) + JSON.stringify(legal);
      for (const f of forbidden) expect(text, `${id} ${h} at tick ${l.tick} leaks "${f}"`).not.toContain(f);
      expect(text).not.toMatch(UUID);
      expect(text).not.toMatch(/"HP \d|HP \d+\/\d+/);
      const abilities = legal.find((a) => a.type === "ability");
      if (abilities) for (const v of (abilities.params!.ability as unknown as { values: string[] }).values) expect(h === "sieg" ? ["push", "super_speed", "heavy_break"] : ["slow_time", "flight", "black_hole", "fireball", "ward"]).toContain(v);
      for (const m of o.messages) expect(m.from).toBe(h === "sieg" ? "Coco" : "Sieg");
    }
    return n;
  }
  it("S2-B: every observation and legal-action list over a full baseline episode", async () => {
    expect(await scan("S2-B", 18_000)).toBeGreaterThan(200);
  });
  it("S2-C: every observation and legal-action list over the first 20 game-seconds", async () => {
    expect(await scan("S2-C", 1200)).toBeGreaterThan(20);
  });

  for (const id of ["S2-B", "S2-C"] as const)
    it(`${id}: refuses illegal actions without changing the world`, async () => {
      const s = start(id, 0);
      await s.reset();
      const before = stateHash(s.room().state);
      for (const [p, a] of [
        ["sieg", { type: "ability", ability: "black_hole" }],
        ["coco", { type: "ability", ability: "super_speed" }],
        ["sieg", { type: "move", direction: "up", ticks: 10 }],
        ["coco", { type: "use_item", item: "enchanted_shears" }],
        ["sieg", { type: "teleport", x: 40, y: 12 }],
      ] as [PlayerId, GameAction][]) {
        const r = await s.env.step(p, a);
        expect(r.accepted, JSON.stringify(a)).toBe(false);
        expect(r.error).toBeTruthy();
      }
      expect(stateHash(s.room().state)).toBe(before);
      expect((await s.env.outcome()).invalidActions).toEqual({ sieg: 3, coco: 2 });
    });

  for (const id of ["S2-B", "S2-C"] as const)
    it(`${id}: ends at the tick limit, not success, when nothing is done`, async () => {
      const s = start(id, 0, { limits: { maxTicks: 120 } });
      await s.reset();
      const wait: GameAction = { type: "wait", ticks: 60 };
      for (let i = 0; i < 3; i++) await Promise.all([s.env.step("sieg", wait), s.env.step("coco", wait)]);
      expect(await s.env.outcome()).toMatchObject({ status: "terminated", reason: "tick_limit", ticks: 120 });
      expect(episodes[id].success(s.room().state)).toBe(false);
    });
});

describe("Hedge Maze situations: scripted and model players start from the same checkpoint", { timeout: 180_000 }, () => {
  for (const id of ["S2-B", "S2-C"] as const)
    it(`${id}: baseline-quest, model-memory and model-obs-only record one start hash and distinct configuration hashes`, async () => {
      const dir = mkdtempSync(join(tmpdir(), "maze-situations-"));
      dirs.push(dir);
      const ledger = SpendLedger.open(join(dir, "mock-ledger.json"));
      const systems: string[] = [];
      const firstObservation: Record<string, unknown> = {};
      try {
        const results = [];
        for (const player of ["baseline-quest", "model-memory", "model-obs-only"] as PlayerKind[]) {
          const controller = new AbortController();
          const isModel = player !== "baseline-quest";
          const gateway: Gateway = {
            label: "offline-fixture",
            worstCaseUsd: () => 0,
            complete: async (system, user) => {
              systems.push(system);
              const u = JSON.parse(user);
              firstObservation[player] ??= u.observation;
              controller.abort();
              return { text: '{"notes":"","actions":[{"type":"wait","ticks":1}]}', tokens: { input: 0, output: 0 }, costUsd: 0 };
            },
          };
          let steps = 0;
          const [s] = await runSuite({
            player, situations: [id], seeds: [0], gitHash: "offline-test", outDir: join(dir, player),
            ...(isModel ? { model: { gateway, manual: "PUBLIC MANUAL", ledger, stage: "pilot", priceSource: "offline fixture" } } : {}),
            signal: controller.signal, wallSeconds: 60,
            onTrace: (l) => { if (!isModel && l.type === "step" && ++steps === 2) controller.abort(); },
          });
          results.push(s);
        }
        expect(results.map((r) => r.startHash)).toEqual(Array(3).fill((id === "S2-B" ? SITUATION_B : SITUATION_C).start.hashes[0]));
        expect(new Set(results.map((r) => r.configHash)).size).toBe(3);
        for (const r of results) expect(r.evaluation).toEqual(mazeEvaluationLabel(id));
        // The model players' prompts carry the shared briefing and nothing about the checkpoint.
        for (const sys of systems) {
          expect(sys).toContain(midMazeBriefing(id));
          for (const f of ["checkpoint", "recorded", "baseline", "cutTick", "1197", "1962"]) expect(sys).not.toContain(f);
        }
        expect(firstObservation["model-memory"]).toEqual(firstObservation["model-obs-only"]);
      } finally {
        ledger.close();
      }
    });
});
