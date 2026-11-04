// P1 "Into the Forest" (packages/agent/src/prologueSituation.ts,
// docs/midterm/PROLOGUE_SITUATION.md). Free and deterministic: tuning seeds 0
// and 1, no model call. Raw authoritative state is read only by these trusted
// assertions, never by a policy. Every action goes through the five operations.
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { cutscenes, storyObjectives, TRAIL_ONWARD, storyStages } from "../../shared/src/prologue.js";
import { episodes, stateHash } from "../src/evaluator.js";
import { environmentFor, situation, SITUATIONS } from "../src/suite.js";
import { EPISODE_CAP_USD, OBS_ONLY_SITUATIONS, WALL_CLOCK_CEILING_S, checkWallSeconds, policiesFor, validatePlan, type ModelSetup } from "../src/harness.js";
import { P1, P1_HASH, P1_REVISIONS, P1_V1, P1_V1_HASH, prologueEvaluationLabel } from "../src/prologueSituation.js";
import { GARDEN_GATEWAY, onScreen, viewRect } from "../src/perception.js";
import { aldenYardFenceSolids } from "../../shared/src/environmentSolids.js";
import { maps } from "../../shared/src/maps.js";
import { NEUTRAL_TASK, taskId } from "../src/playerKnowledge.js";
import { TASK, systemPrompt } from "../src/policies/llm.js";
import { SITUATION_A_HASH, evaluationLabel } from "../src/situationA.js";
import { runEpisode } from "../src/runner.js";
import { TraceWriter, verifyTrace, type TraceLine } from "../src/trace.js";
import { QuestBaseline } from "../src/policies/questBaseline.js";
import { LLMPlayer } from "../src/policies/llm.js";
import { asTuned, planStep } from "../src/policies/navigate.js";
import { loadPlayerManual } from "../src/playerKnowledge.js";
import type { Decision, Policy } from "../src/policies/policy.js";
import type { ActionSpec, GameAction, Observation, PlayerId, StepResult } from "../src/types.js";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const heroes: PlayerId[] = ["sieg", "coco"];
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** A policy that only waits. */
class Idle implements Policy {
  readonly name = "idle";
  async decide(): Promise<Decision> {
    return { action: { type: "wait", ticks: 30 } };
  }
}

function start(seed: number, options: Parameters<typeof environmentFor>[1] = {}) {
  let room!: GameRoom;
  const env = environmentFor("P1", { ...options, room: (r) => { room = r; } });
  return { env, room: () => room };
}

async function run(seed: number, policies: Record<PlayerId, Policy>, options: Parameters<typeof environmentFor>[1] = {}) {
  const trace = new TraceWriter();
  const s = start(seed, { ...options, trace: (e) => trace.write(e) });
  const outcome = await runEpisode(s.env, policies, trace, { seed, wallClockMs: 120_000 });
  return { outcome, trace: trace.lines as TraceLine[], room: s.room(), env: s.env };
}
const baseline = () => ({ sieg: new QuestBaseline("Sieg"), coco: new QuestBaseline("Coco") });
let seed0: ReturnType<typeof run> | undefined;
const baselineSeed0 = () => (seed0 ??= run(0, baseline()));

const observations = (trace: TraceLine[], h?: PlayerId) =>
  trace
    .filter((l) => l.type === "observation" && (!h || l.player === h))
    .map((l) => ({ tick: l.tick, player: l.player as PlayerId, ...(l.data as { observation: Observation; legal: ActionSpec[] }) }));
const milestoneTick = (trace: TraceLine[], name: string) =>
  trace.find((l) => l.type === "milestone" && (l.data as { milestone: string }).milestone === name)?.tick;

/** Both heroes act together (equal durations), so game time runs. */
async function pair(env: ReturnType<typeof start>["env"], sieg: GameAction, coco: GameAction) {
  return Promise.all([env.step("sieg", sieg), env.step("coco", coco)]);
}

describe("P1 definition", () => {
  it("is frozen: any change to the definition changes this hash and is a new revision", () => {
    expect(P1_HASH).toBe("7dfac8cd2b91b5d096328265a4eba068a8a86055750c204896394ebdc6b1a655");
    expect(P1.version).toBe(2);
    expect(prologueEvaluationLabel("P1")).toEqual({ label: "P1", definitionHash: P1_HASH });
    expect(prologueEvaluationLabel("S2-local")).toBeNull();
  });

  it("keeps revision 1 verbatim, with its original hash, and records the succession", () => {
    expect(P1_V1_HASH).toBe("baa6b04b7de3d56e479cbb092d5d8a10875a290c89748b836917e32a895f73ac");
    expect(P1_V1).toMatchObject({ version: 1, preset: "P1" });
    expect(P1.supersedes).toEqual({ version: 1, definitionHash: P1_V1_HASH, commit: "b62df73" });
    expect(P1_REVISIONS.map((r) => [r.version, r.preset, r.definitionHash])).toEqual([[1, "P1", P1_V1_HASH], [2, "P1-v2", P1_HASH]]);
    // Revision 1's preset stays defined, unchanged, so its records stay readable.
    expect(episodes.P1).toMatchObject({ preset: "P1", checkpoint: "prologue" });
    expect(episodes["P1-v2"].limits).toEqual(episodes.P1.limits);
    expect(episodes["P1-v2"].success).toBe(episodes.P1.success);
  });

  it("is read from the code the harness runs: preset, checkpoint, success, limits, cap, players", () => {
    const def = situation("P1");
    expect(def).toMatchObject({ id: "P1", preset: "P1-v2", heldOut: false, revision: 2, task: NEUTRAL_TASK });
    expect(def.prefix).toBeUndefined();
    expect(def.briefing).toBeUndefined();
    expect(def.tutorial).toBeUndefined();
    expect(SITUATIONS.at(-1)!.id).toBe("P1");
    const ep = episodes["P1-v2"];
    expect(ep.checkpoint).toBe("prologue");
    // The owner's values (game time, calls) and S2-A's retained decision and token limits.
    expect(ep.limits).toEqual({ maxTicks: 10_800, maxDecisionsPerPlayer: 1_600, maxModelCallsPerPlayer: 250, maxTokensPerPlayer: 4_000_000 });
    expect(P1.limits).toMatchObject({ ...ep.limits, wallClockSeconds: { model: 3600, scripted: 600 }, modelCallTimeoutMs: 30_000, maxConsecutivePolicyFailures: 3, episodeSpendCapUsd: 0.6, wallClockCeilingSeconds: 3600 });
    expect(WALL_CLOCK_CEILING_S).toEqual({ P1: 3600 });
    expect(EPISODE_CAP_USD.P1).toBe(0.6);
    expect(OBS_ONLY_SITUATIONS).toContain("P1");
    expect(P1.prompts).toMatchObject({ briefing: null, tutorial: null, walkthrough: null });
  });

  it("succeeds exactly when the authoritative story stage reaches WOODS", () => {
    const at = (stage: string) => ({ story: { stage, flags: [] } }) as never;
    for (const stage of storyStages) expect(episodes["P1-v2"].success(at(stage)), stage).toBe(storyStages.indexOf(stage) >= storyStages.indexOf("WOODS"));
    expect(episodes["P1-v2"].success({} as never)).toBe(false);
  });

  it("model players get the episode-neutral task and the normal prompt only: no briefing, tutorial or walkthrough; prompts frozen", () => {
    const { text, sha256 } = loadPlayerManual(root);
    expect(sha256).toBe(P1.prompts.manualSha256);
    const memory = { "model-history": "history", "model-obs-only": "none", "model-memory": "persistent" } as const;
    for (const [kind, mem] of Object.entries(memory))
      for (const [h, hero] of [["sieg", "Sieg"], ["coco", "Coco"]] as const) {
        const d = situation("P1");
        const p = new LLMPlayer(hero, text, { label: "test" } as never, 4, mem, d.briefing, d.tutorial, d.task);
        expect(p.promptHash, `${kind} ${h}`).toBe(P1.prompts.systemPromptSha256[kind as keyof typeof memory][h]);
        expect(p.name).not.toMatch(/tutorial|briefing/);
        expect(p.name).toContain(`·task-${taskId(NEUTRAL_TASK)}`);
        // Revision 1's prompts were built with the original task: the default is byte-identical.
        const original = new LLMPlayer(hero, text, { label: "test" } as never, 4, mem);
        expect(original.promptHash, `${kind} ${h} default`).toBe((P1_V1 as never as { prompts: { systemPromptSha256: Record<string, Record<string, string>> } }).prompts.systemPromptSha256[kind][h]);
        expect(original.name).not.toContain("·task-");
      }
    // No walkthrough exists for P1.
    const setup = { gateway: { label: "test" }, manual: text, ledger: undefined as never, stage: "pilot", priceSource: "test", maxBatch: 4 } as unknown as ModelSetup;
    expect(() => policiesFor("model-guided", undefined, setup, "P1")).toThrow(/model-guided requires/);
  });

  it("F1: the P1 prompt names no character, place or event of any episode; other situations keep the original task", () => {
    expect(P1.prompts.task).toEqual({ id: taskId(NEUTRAL_TASK), text: NEUTRAL_TASK });
    // The prompt's own instructions, without the public manual (which every
    // player receives and which is not part of this fix).
    for (const hero of ["Sieg", "Coco"] as const) {
      const prompt = systemPrompt(hero, "", 4, "persistent", NEUTRAL_TASK);
      expect(prompt).toContain(`Task: ${NEUTRAL_TASK}`);
      expect(prompt).not.toMatch(/Goddess|shrine|Alden|forest|Mossling|cart|shop|Emberbrook|wig|Hedge Maze|Mirror Pond|Griffin|Prologue/i);
    }
    expect(NEUTRAL_TASK).not.toMatch(/\b(north|south|east|west)\b|\(\s*\d/i);
    expect(TASK).toBe("Complete the Goddess's quest together.");
    for (const s of SITUATIONS.filter((x) => x.id !== "P1")) expect(s.task, s.id).toBeUndefined();
  });

  it("F6: a run may lower P1's wall clock but never raise it; other scenarios are unchanged", () => {
    expect(() => checkWallSeconds({ situations: ["P1"], wallSeconds: 1800 })).not.toThrow();
    expect(() => checkWallSeconds({ situations: ["P1"], wallSeconds: 3600 })).not.toThrow();
    expect(() => checkWallSeconds({ situations: ["P1"] })).not.toThrow();
    expect(() => checkWallSeconds({ situations: ["P1"], wallSeconds: 3601 })).toThrow(/never raise/);
    expect(() => checkWallSeconds({ situations: ["S2-local", "P1"], wallSeconds: 7200 })).toThrow(/P1's wall-clock limit is 3600 s/);
    expect(() => checkWallSeconds({ situations: ["S2-local"], wallSeconds: 7200 })).not.toThrow();
  });

  it("plans: baseline and unaided model players on tuning seeds; never final seeds without approval", () => {
    validatePlan({ player: "baseline-quest", situations: ["P1"], seeds: [0, 1], final: false });
    validatePlan({ player: "model-memory", situations: ["P1"], seeds: [0, 1], final: false, model: { stage: "pilot" } as ModelSetup });
    expect(() => validatePlan({ player: "baseline-quest", situations: ["P1"], seeds: [100], final: false })).toThrow();
  });

  it("leaves Situation A untouched", () => {
    expect(SITUATION_A_HASH).toBe("4b3c9bb309e7d0bcc022f1df6a7e58cf11a3767c02fd7bd6cb62dfa845cd4207");
    expect(evaluationLabel("S2-local")?.label).toBe("S2-A");
    expect(episodes["S2-local-v2"].checkpoint).toBeUndefined();
  });
});

describe("P1 reset", () => {
  it("starts at the game's own Prologue opening, deterministically, at seeds 0 and 1", async () => {
    const views: string[] = [];
    for (const seed of [0, 1]) {
      const s = start(seed);
      const first = await s.env.reset(seed);
      expect(first).toMatchObject({ tick: 0, startHash: P1.start.hashes[seed] });
      expect(first.episode).toBe(`P1-v2-${seed}-${P1.start.hashes[seed].slice(0, 8)}`);
      const w = s.room().state;
      expect(stateHash(w)).toBe(first.startHash);
      expect(w.story).toMatchObject({ stage: "ARRIVAL", flags: [] });
      const [sieg, coco] = ["OATH", "EMBER"].map((r) => Object.values(w.players).find((p) => p.role === r)!);
      expect(sieg).toMatchObject({ sceneId: "MAIN_HOUSE", x: 760, y: 490, hp: 100 });
      expect(coco).toMatchObject({ sceneId: "HOUSE_INTERIOR", x: 590, y: 322, hp: 100 });
      expect(w.story!.alden).toMatchObject({ scene: "HOUSE_INTERIOR", action: "idle" });
      const v = JSON.stringify([await s.env.observe("sieg"), await s.env.legal_actions("sieg"), await s.env.observe("coco"), await s.env.legal_actions("coco")]);
      expect(createHash("sha256").update(v).digest("hex")).toBe(P1.start.viewsHash);
      views.push(v);
      expect((await s.env.reset(seed)).startHash).toBe(first.startHash);
    }
    expect(views[0]).toBe(views[1]);
  });

  it("shows each hero only their own scene: Sieg the yard, Coco the shop with Alden", async () => {
    const s = start(0);
    await s.env.reset(0);
    const sieg = await s.env.observe("sieg"),
      coco = await s.env.observe("coco");
    expect(sieg.area.name).toBe("Main house");
    expect(coco.area.name).toBe("Alden's Magic Shop");
    const names = (o: Observation) => o.visible.map((v) => `${v.kind}:${v.name}`);
    expect(names(sieg)).toEqual(expect.arrayContaining(["exit:door", "object:garden gateway", "exit:EMBERBROOK →"]));
    expect(JSON.stringify(sieg)).not.toContain("garden gate (open)");
    expect(names(sieg).some((n) => n.startsWith("partner") || n.includes("Alden"))).toBe(false);
    // F2: the client's shop camera shows the stairs from where Coco starts.
    expect(names(coco)).toEqual(["exit:E · UPSTAIRS", "creature:Alden"]);
    // Out of reach: no "E Talk" yet.
    expect(coco.visible.find((v) => v.name === "Alden")!.details).toBeUndefined();
    // F4: the opening is listed with its exact passable span; the grid keeps
    // each centre's truth ("#" on both straddled cells), so no blocked cell is shown as open.
    const gateway = sieg.visible.find((v) => v.name === "garden gateway")!;
    expect(gateway.extent).toEqual({ x: 14.5, y: 13.5, w: 1, h: 0.3 });
    const { originX, originY, rows } = sieg.screen;
    expect(rows[13 - originY][14 - originX]).toBe("#");
    expect(rows[13 - originY][15 - originX]).toBe("#");
    // The journal names the current step; no HUD goal line anywhere.
    expect(sieg.journal.current).toEqual({ quest: "Prologue · A Promise Kept", step: "Visit Alden's magic shop", done: [] });
    for (const o of [sieg, coco]) {
      const text = JSON.stringify(o);
      for (const goal of Object.values(storyObjectives.ARRIVAL!)) expect(text).not.toContain(goal.slice(11, 50));
    }
  });
});

describe("P1 revision 2 observation fixes", () => {
  it("F4: the listed gateway is exactly the gap between the fence's collision rectangles", () => {
    const fence = aldenYardFenceSolids.filter((r) => r.y === GARDEN_GATEWAY.y && r.h === GARDEN_GATEWAY.h);
    expect(fence).toHaveLength(2);
    const [left, right] = [...fence].sort((a, b) => a.x - b.x);
    expect(left.x + left.w).toBe(GARDEN_GATEWAY.x);
    expect(right.x).toBe(GARDEN_GATEWAY.x + GARDEN_GATEWAY.w);
    // Nothing else of the yard's solids covers the gap.
    const blocks = (x: number) => maps.MAIN_HOUSE.walls.some((r) => x > r.x && x < r.x + r.w && 436 > r.y && 436 < r.y + r.h);
    for (let x = GARDEN_GATEWAY.x + 1; x < GARDEN_GATEWAY.x + GARDEN_GATEWAY.w; x++) expect(blocks(x), `x ${x}`).toBe(false);
    expect(blocks(GARDEN_GATEWAY.x - 1)).toBe(true);
    expect(blocks(GARDEN_GATEWAY.x + GARDEN_GATEWAY.w + 1)).toBe(true);
  });

  it("F2: indoors the view is the client's house camera: inside cameraBounds, centred when narrower than the screen", () => {
    const at = (scene: string, x: number, y: number) =>
      viewRect({ sceneId: scene, players: {} } as never, { sceneId: scene, x, y } as never);
    // The shop floor: bounds x 64-768, y 128-640.
    expect(maps.HOUSE_INTERIOR.cameraBounds).toEqual({ x: 64, y: 128, w: 704, h: 512 });
    expect(at("HOUSE_INTERIOR", 590, 322)).toEqual({ x: 128, y: 142, w: 640, h: 360 });
    expect(at("HOUSE_INTERIOR", 800, 700)).toEqual({ x: 128, y: 280, w: 640, h: 360 });
    expect(at("HOUSE_INTERIOR", 0, 0)).toEqual({ x: 64, y: 128, w: 640, h: 360 });
    // Upstairs: bounds narrower than the screen are centred.
    const up = maps.HOUSE_UPPER.cameraBounds!;
    expect(up.w).toBeLessThan(640);
    expect(at("HOUSE_UPPER", 0, 0).x).toBe(up.x + up.w / 2 - 320);
    // The main house has no cameraBounds: the same view as before.
    expect(at("MAIN_HOUSE", 760, 490)).toEqual({ x: 224, y: 280, w: 640, h: 360 });
    // The Hedge Maze is not a house: unchanged rule.
    expect(at("HEDGE_MAZE", 0, 0)).toEqual({ x: 0, y: 0, w: 640, h: 360 });
  });

  it("F2: Coco sees 'E · UPSTAIRS' where the client shows it, and nothing outside the client's camera", async () => {
    const s = start(0);
    await s.env.reset(0);
    const w = s.room().state;
    const coco = Object.values(w.players).find((p) => p.role === "EMBER")!;
    const sieg = Object.values(w.players).find((p) => p.role === "OATH")!;
    const stairs = maps.HOUSE_INTERIOR.points.upstairs;
    expect(onScreen(w, coco, stairs)).toBe(true);
    // A point inside the shop map but outside the client's camera bounds is never listed.
    expect(onScreen(w, coco, { x: 800, y: 322 })).toBe(false);
    const o = await s.env.observe("coco");
    expect(o.visible.find((v) => v.name === "E · UPSTAIRS")).toMatchObject({ kind: "exit", x: 4.4, y: 9.7 });
    expect(o.screen.originX).toBe(4);
    // Sieg, outside, never sees the shop's stairs.
    expect(sieg.sceneId).toBe("MAIN_HOUSE");
    expect(JSON.stringify(await s.env.observe("sieg"))).not.toContain("UPSTAIRS");
  });

  it("names-only labels show no drawn instruction text", async () => {
    const s = start(0, { labels: "names-only" });
    await s.env.reset(0);
    const names = (await s.env.observe("sieg")).visible.map((v) => v.name);
    expect(names).toEqual(expect.arrayContaining(["door", "garden gateway", "east road"]));
    expect(names).not.toContain("EMBERBROOK →");
    expect((await s.env.observe("coco")).visible.map((v) => v.name)).toContain("stairs up");
  });
});

describe("P1 progression and the scripted baseline", { timeout: 120_000 }, () => {
  it("baseline-quest completes P1 through the five operations with the frozen reference result", async () => {
    const { outcome, trace, env, room } = await baselineSeed0();
    const ref = P1.baseline.reference;
    expect(outcome).toMatchObject({ status: "success", reason: "success", ticks: ref.gameTicks, seconds: ref.gameSeconds });
    expect(outcome.decisions.sieg + outcome.decisions.coco).toBe(ref.decisions);
    expect(outcome.invalidActions).toEqual({ sieg: 0, coco: 0 });
    expect(outcome.modelCalls).toEqual({ sieg: 0, coco: 0 });
    expect(trace.filter((l) => l.type === "message")).toHaveLength(ref.messages);
    expect(env.evaluatorReport().stateHash).toBe(ref.endHash);
    expect(room.state.story!.stage).toBe("WOODS");
    expect(room.state.sceneId).toBe("PROLOGUE_WOODS");
    verifyTrace(trace);
  });

  it("seed 1 is a repeated trial: the same play, step for step", async () => {
    const a = await baselineSeed0(),
      b = await run(1, baseline());
    const steps = (t: TraceLine[]) => t.filter((l) => l.type === "step").map((l) => [l.player, l.tick, (l.data as { action: unknown }).action]);
    expect(steps(b.trace)).toEqual(steps(a.trace));
    expect(b.outcome).toMatchObject({ status: "success", ticks: a.outcome.ticks });
  });

  it("follows the game's own order: shop visit, road fork, forest trail, cart, Mossling Woods", async () => {
    const { trace } = await baselineSeed0();
    const order = ["prologue:shop-visit", "prologue:road-fork", "prologue:forest-trail", "prologue:cart-found", "prologue:mossling-woods"];
    const ticks = order.map((m) => milestoneTick(trace, m));
    expect(ticks.every((t) => t !== undefined)).toBe(true);
    expect([...ticks].sort((x, y) => x! - y!)).toEqual(ticks);
    // The episode ends on the tick the game moved the story to WOODS, and no earlier.
    const terminal = trace.find((l) => l.type === "terminal")!;
    expect(terminal.data).toMatchObject({ reason: "success" });
    expect(terminal.tick).toBe(milestoneTick(trace, "prologue:mossling-woods"));
    // The last action before it is Sieg's E at the trail's exit.
    const last = trace.filter((l) => l.type === "step" && l.player === "sieg").at(-1)!;
    expect((last.data as { action: GameAction }).action.type).toBe("interact");
  });
});

describe("P1 information boundary over a full baseline episode", { timeout: 120_000 }, () => {
  it("no hidden state, HUD goal line, scene id, flag or future dialogue reaches either hero", async () => {
    const { trace, room } = await baselineSeed0();
    const later = ["woods", "woods-attack", "woods-defend", "woods-time", "woods-flight", "woods-black_hole", "woods-done", "ambush", "rescue", "home", "farewell", "morning"];
    const forbidden = [
      ...Object.keys(room.state.players), room.state.roomCode, "prologue.", "chapter0.", "serverTick", "startHash", "stateHash", "milestone",
      "ARRIVAL", "LEAVING", "FOREST_BOUND", "MAIN_HOUSE", "HOUSE_INTERIOR", "PROLOGUE_", '"stage"', '"flags"', "CART", "CENTRE",
      // HUD goal lines (storyObjectives, TRAIL_ONWARD) and the map hint line.
      ...Object.values(storyObjectives).flatMap((r) => Object.values(r!).map((g) => g.replace(/^Prologue · /, ""))),
      ...Object.values(TRAIL_ONWARD).map((g) => g.replace(/^Prologue · /, "")),
      "E by the front door: enter house",
      // Lines of scenes P1 never reaches.
      ...later.flatMap((id) => cutscenes[id].lines.map((l) => l.text).filter((t) => t.length > 24)),
    ];
    let count = 0;
    for (const { tick, player, observation: o, legal } of observations(trace)) {
      count++;
      const text = JSON.stringify(o) + JSON.stringify(legal);
      expect(o.player).toBe(player);
      for (const f of forbidden) expect(text, `${player} at tick ${tick} leaks "${f}"`).not.toContain(f);
      expect(text).not.toMatch(UUID);
      expect(text).not.toMatch(/[0-9a-f]{64}/);
    }
    expect(count).toBeGreaterThan(100);
  });

  it("the cart is never signposted, and the trail's way on appears only after the cart scene", async () => {
    const { trace } = await baselineSeed0();
    const cartTick = milestoneTick(trace, "prologue:cart-found")!;
    const firstCartLine = cutscenes.cart.lines[0].text;
    let sawCart = false,
      sawExit = false;
    for (const { tick, observation: o } of observations(trace)) {
      if (o.area.name !== "Forest Trail") continue;
      const cart = o.visible.find((v) => v.name === "tipped cart");
      if (cart) {
        sawCart = true;
        expect(cart).toMatchObject({ kind: "object" });
        expect(cart.details).toBeUndefined();
      }
      const exit = o.visible.find((v) => v.kind === "exit");
      if (tick < cartTick) {
        expect(exit, `exit listed at tick ${tick}, before the cart`).toBeUndefined();
        expect(JSON.stringify(o)).not.toContain(firstCartLine);
      } else if (exit) {
        sawExit = true;
        expect(exit.name).toBe("E · FOLLOW THE TRACKS");
      }
    }
    expect(sawCart && sawExit).toBe(true);
  });

  it("inner narration is shown only to its hero; the partner sees the neutral line and cannot move it on", async () => {
    // Sieg reads each line a few ticks after it appears, and Coco looks every
    // tick, so Coco's own screen is observed on every line of the road scene.
    class SlowReader implements Policy {
      readonly name = "slow-reader";
      private inner = new QuestBaseline("Sieg");
      private paused = "";
      async decide(input: { observation: Observation; legal: ActionSpec[]; last?: StepResult }): Promise<Decision> {
        const d = input.observation.dialogue;
        if (d?.canAdvance && this.paused !== d.text) {
          this.paused = d.text;
          return { action: { type: "wait", ticks: 3 } };
        }
        return this.inner.decide(input);
      }
    }
    class Watcher implements Policy {
      readonly name = "watcher";
      async decide(): Promise<Decision> {
        return { action: { type: "wait", ticks: 1 } };
      }
    }
    const { trace, outcome } = await run(0, { sieg: new SlowReader(), coco: new Watcher() });
    expect(outcome.status).toBe("success");
    const own = cutscenes.fork.lines.filter((l) => l.audience === "OATH");
    let cocoSawElsewhere = 0;
    for (const { player, observation: o, legal } of observations(trace)) {
      const log = JSON.stringify(o.dialogueLog) + JSON.stringify(o.dialogue);
      if (player === "coco") for (const l of own) expect(log).not.toContain(l.text);
      const d = o.dialogue;
      if (player === "coco" && d && d.text === own[0].elsewhere) {
        cocoSawElsewhere++;
        expect(d.canAdvance).toBe(false);
        expect(d.waiting).toBe("Your partner's line.");
        expect(legal.map((a) => a.type)).not.toContain("advance_dialogue");
      }
    }
    expect(cocoSawElsewhere).toBeGreaterThan(0);
    const sieg = observations(trace, "sieg").map((x) => JSON.stringify(x.observation.dialogueLog)).join("");
    for (const l of own) expect(sieg).toContain(l.text);
  });

  it("legal actions are real inputs: during a scene only dialogue, waiting and messages; otherwise movement and E", async () => {
    const { trace } = await baselineSeed0();
    for (const { player, observation: o, legal } of observations(trace)) {
      const types = legal.map((a) => a.type);
      if (o.dialogue) {
        expect(types.every((t) => ["advance_dialogue", "choose_dialogue", "wait", "message"].includes(t)), `${player} ${types}`).toBe(true);
        expect(types.includes("advance_dialogue")).toBe(o.dialogue.canAdvance);
      } else expect(types).toEqual(expect.arrayContaining(["move", "interact", "wait"]));
      const ability = legal.find((a) => a.type === "ability");
      const values = ((ability?.params as { ability?: { values: string[] } } | undefined)?.ability?.values ?? []) as string[];
      for (const v of values) expect((player === "sieg" ? ["push", "super_speed"] : ["slow_time", "flight", "black_hole"]).includes(v), `${player} offered ${v}`).toBe(true);
      expect(types).not.toContain("use_item");
    }
  });
});

describe("P1 interactions a human player would see", { timeout: 60_000 }, () => {
  it("E beside Alden reads his line as the client shows it, and sends nothing to the game", async () => {
    const s = start(0);
    await s.env.reset(0);
    // Coco walks to her father through the ordinary interface; Sieg waits.
    for (let i = 0; i < 40; i++) {
      const o = asTuned(await s.env.observe("coco"));
      if (o.visible.find((v) => v.name === "Alden")?.details === "E Talk") break;
      const alden = o.visible.find((v) => v.name === "Alden")!;
      const st = planStep(o, { x: alden.x + 1, y: alden.y }, { tolerance: 0.3, maxTicks: 10 });
      if (st.kind !== "move") break;
      await pair(s.env, { type: "wait", ticks: st.ticks }, { type: "move", direction: st.direction, ticks: st.ticks });
    }
    const before = await s.env.observe("coco");
    expect(before.visible.find((v) => v.name === "Alden")?.details).toBe("E Talk");
    // Both heroes decide together: Sieg waits a tick while Coco presses E. The
    // world is read the moment her press resolves, before any tick runs.
    const hash = stateHash(s.room().state);
    let after = "";
    let r!: StepResult;
    await Promise.all([
      s.env.step("sieg", { type: "wait", ticks: 1 }),
      s.env.step("coco", { type: "interact" }).then((x) => {
        r = x;
        after = stateHash(s.room().state);
        return s.env.step("coco", { type: "wait", ticks: 1 });
      }),
    ]);
    expect(after).toBe(hash);
    expect(r.accepted).toBe(true);
    expect(r.ticks).toBe(0);
    expect(r.feedback[0]).toBe('Alden: "Coco, if you are going to hover, hover somewhere away from the catalysts."');
    expect(r.feedback).toHaveLength(2);
    expect(s.room().state.story).toMatchObject({ stage: "ARRIVAL", flags: [] });
  });

  it("E at the trail's barrel gives each hero's own words, as the client shows them", async () => {
    // Sieg plays the baseline until the cart's scene has played on the trail, then
    // walks to the barrel ("E · INSPECT") and presses E.
    class Inspector implements Policy {
      readonly name = "inspector";
      private inner = new QuestBaseline("Sieg");
      private arrived?: number;
      pressed?: StepResult;
      private phase: "play" | "walk" | "press" | "done" = "play";
      async decide(input: { observation: Observation; legal: ActionSpec[]; last?: StepResult }): Promise<Decision> {
        const o = asTuned(input.observation);
        if (this.phase === "press") {
          this.pressed = input.last;
          this.phase = "done";
        }
        if (this.phase === "done") return { action: { type: "wait", ticks: 30 } };
        if (o.area.name === "Forest Trail") this.arrived ??= o.tick;
        const heard = this.arrived !== undefined && !o.dialogue && o.dialogueLog.some((l) => l.tick >= this.arrived!);
        if (this.phase === "play" && !heard) return this.inner.decide(input);
        this.phase = "walk";
        const barrel = o.visible.find((v) => v.name === "barrel")!;
        expect(barrel.details).toBe("E · INSPECT");
        const st = planStep(o, { x: barrel.x, y: barrel.y + 0.9 }, { tolerance: 0.3 });
        if (st.kind === "move") return { action: { type: "move", direction: st.direction, ticks: st.ticks } };
        this.phase = "press";
        return { action: { type: "interact" } };
      }
    }
    const sieg = new Inspector();
    const { room } = await run(0, { sieg, coco: new QuestBaseline("Coco") }, { limits: { maxTicks: 1500 } });
    expect(sieg.pressed).toMatchObject({ accepted: true, ticks: 0, feedback: ['Sieg: "The barrel\'s full. Nobody stops to drink when they\'re running."'] });
    expect(room.state.story!.stage).toBe("TRAIL");
  });

  it("the story waits for Sieg: with both heroes idle, nothing starts", async () => {
    const { outcome, room, trace } = await run(0, { sieg: new Idle(), coco: new Idle() }, { limits: { maxTicks: 1800 } });
    expect(outcome).toMatchObject({ status: "terminated", reason: "tick_limit", ticks: 1800 });
    expect(room.state.story).toMatchObject({ stage: "ARRIVAL", flags: [] });
    expect(trace.filter((l) => l.type === "milestone")).toHaveLength(0);
  });

  it("Coco is not required: Sieg alone completes P1 while Coco only waits", async () => {
    const { outcome, room } = await run(0, { sieg: new QuestBaseline("Sieg"), coco: new Idle() });
    expect(outcome).toMatchObject({ status: "success", reason: "success" });
    expect(room.state.story!.stage).toBe("WOODS");
  });
});

describe("P1 episode limits", { timeout: 60_000 }, () => {
  it("ends at the decision limit with that reason", async () => {
    const { outcome } = await run(0, { sieg: new Idle(), coco: new Idle() }, { limits: { maxDecisionsPerPlayer: 5 } });
    expect(outcome).toMatchObject({ status: "terminated", reason: "decision_limit" });
  });

  it("the full game-time limit is 180 s: idle heroes end at exactly 10,800 ticks", async () => {
    const { outcome } = await run(0, { sieg: new Idle(), coco: new Idle() });
    expect(outcome).toMatchObject({ status: "terminated", reason: "tick_limit", ticks: 10_800, seconds: 180 });
  });
});

describe("P1 documentation", () => {
  it("the record states the definition hash, the limitation and the reproduction commands", () => {
    const doc = readFileSync(join(root, "docs/midterm/PROLOGUE_SITUATION.md"), "utf8");
    expect(doc).toContain(P1_HASH);
    expect(doc).toMatch(/Coco's participation is not required/);
    for (const c of P1.reproduce) expect(doc).toContain(c);
  });
});
