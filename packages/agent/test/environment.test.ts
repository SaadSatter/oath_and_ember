import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { AgentEnvironment } from "../src/environment.js";
import { runEpisode } from "../src/runner.js";
import { TraceWriter, verifyTrace } from "../src/trace.js";
import { ExplorationBaseline } from "../src/policies/baseline.js";
import { LLMPlayer, parseReply, SpendCap, systemPrompt, type Gateway } from "../src/policies/llm.js";
import type { GameAction, PlayerId } from "../src/types.js";

const roomOf = (env: AgentEnvironment) => (env as unknown as { room: GameRoom }).room;
/** Lets queued promise callbacks run without advancing game time. */
const settle = () => new Promise((r) => setTimeout(r, 0));

async function playScript(seed: number) {
  const env = new AgentEnvironment({ preset: "full" });
  await env.reset(seed);
  const script: [GameAction, GameAction][] = [
    [{ type: "move", direction: "n", ticks: 40 }, { type: "move", direction: "ne", ticks: 40 }],
    [{ type: "attack", direction: "w" }, { type: "ability", ability: "black_hole", direction: "e" }],
    [{ type: "wait", ticks: 60 }, { type: "move", direction: "s", ticks: 60 }],
  ];
  for (const [a, b] of script) {
    // Equal-length pairs keep both heroes at the same decision point.
    const ta = a.type === "attack" || a.type === "ability" ? 2 : (a as { ticks: number }).ticks;
    const tb = b.type === "attack" || b.type === "ability" ? 2 : (b as { ticks: number }).ticks;
    expect(ta).toBe(tb);
    await Promise.all([env.step("sieg", a), env.step("coco", b)]);
  }
  return { env, report: env.evaluatorReport(), sieg: await env.observe("sieg"), coco: await env.observe("coco") };
}

describe("reset", () => {
  it("starts a fresh goddess-checkpoint episode with both heroes and their starting abilities", async () => {
    const env = new AgentEnvironment();
    const state = await env.reset(3);
    const w = roomOf(env).state;
    expect(w.phase).toBe("PLAYING");
    expect(w.sceneId).toBe("GODDESS_SHRINE");
    expect(w.story?.stage).toBe("GODDESS");
    expect(w.inventory?.claimed).toEqual([]);
    expect(w.inventory?.completed).toEqual([]);
    const sieg = await env.observe("sieg"),
      coco = await env.observe("coco");
    expect(sieg.abilities.map((a) => a.name)).toEqual(["Sword", "Guard", "Push", "Super Speed"]);
    expect(coco.abilities.map((a) => a.name)).toEqual(["Fireball", "Ward", "Slow Time", "Flight", "Black Hole"]);
    expect(state.tick).toBe(0);
    expect((await env.outcome()).status).toBe("ongoing");
  });

  it("is reproducible: same seed and actions give identical state hashes and observations", async () => {
    const a = await playScript(11),
      b = await playScript(11);
    expect(a.report.stateHash).toBe(b.report.stateHash);
    expect(a.sieg).toEqual(b.sieg);
    expect(a.coco).toEqual(b.coco);
    const e1 = new AgentEnvironment(),
      e2 = new AgentEnvironment();
    expect((await e1.reset(5)).startHash).toBe((await e2.reset(5)).startHash);
  });

  it("discards the previous episode", async () => {
    const env = new AgentEnvironment();
    await env.reset(1);
    await Promise.all([env.step("sieg", { type: "move", direction: "n", ticks: 20 }), env.step("coco", { type: "wait", ticks: 20 })]);
    await env.reset(1);
    expect((await env.outcome()).ticks).toBe(0);
    expect((await env.outcome()).decisions).toEqual({ sieg: 0, coco: 0 });
  });
});

describe("shared clock scheduler", () => {
  it("advances the simulation once for two simultaneous submissions", async () => {
    const env = new AgentEnvironment();
    await env.reset(1);
    const [a, b] = await Promise.all([
      env.step("sieg", { type: "move", direction: "n", ticks: 30 }),
      env.step("coco", { type: "move", direction: "n", ticks: 30 }),
    ]);
    expect(a.ticks).toBe(30);
    expect(b.ticks).toBe(30);
    expect((await env.outcome()).ticks).toBe(30);
  });

  it("pauses game time while a hero is deciding, without waiting on the partner's longer action", async () => {
    const env = new AgentEnvironment();
    await env.reset(1);
    const long = env.step("sieg", { type: "wait", ticks: 50 });
    const short = await env.step("coco", { type: "wait", ticks: 10 });
    expect(short.ticks).toBe(10);
    await settle();
    // Coco is deciding: the clock must not move until Coco submits.
    expect((await env.outcome()).ticks).toBe(10);
    await settle();
    expect((await env.outcome()).ticks).toBe(10);
    const next = env.step("coco", { type: "wait", ticks: 60 });
    expect((await long).ticks).toBe(50);
    expect((await env.outcome()).ticks).toBe(50);
    void next;
  });

  it("refuses a second action while one is pending", async () => {
    const env = new AgentEnvironment();
    await env.reset(1);
    void env.step("sieg", { type: "wait", ticks: 10 });
    const again = await env.step("sieg", { type: "wait", ticks: 10 });
    expect(again.accepted).toBe(false);
    expect((await env.outcome()).invalidActions.sieg).toBe(1);
  });
});

describe("action validation", () => {
  const bad: [string, unknown][] = [
    ["unknown type", { type: "teleport", x: 1, y: 2 }],
    ["duration too long", { type: "move", direction: "n", ticks: 61 }],
    ["fractional ticks", { type: "wait", ticks: 2.5 }],
    ["bad direction", { type: "move", direction: "up", ticks: 5 }],
    ["extra field", { type: "wait", ticks: 5, hp: 100 }],
    ["other hero's ability", { type: "ability", ability: "flight" }],
    ["no dialogue open", { type: "advance_dialogue" }],
    ["no object nearby", { type: "use_item", item: "griffin_wig" }],
    ["empty message", { type: "message", text: "  " }],
    ["message too long", { type: "message", text: "x".repeat(201) }],
    ["not an object", "move north"],
  ];
  it.each(bad)("rejects %s without changing state", async (_, action) => {
    const env = new AgentEnvironment();
    await env.reset(2);
    const before = env.evaluatorReport().stateHash;
    const result = await env.step("sieg", action as GameAction);
    expect(result.accepted).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.ticks).toBe(0);
    expect(env.evaluatorReport().stateHash).toBe(before);
    expect((await env.outcome()).invalidActions.sieg).toBe(1);
  });

  it("lists only actions the hero can perform, with no target outcomes", async () => {
    const env = new AgentEnvironment();
    await env.reset(2);
    const sieg = await env.legal_actions("sieg");
    expect(sieg.map((a) => a.type)).toEqual(["move", "attack", "defend", "ability", "interact", "wait", "message"]);
    const ability = sieg.find((a) => a.type === "ability")!;
    expect(ability.params!.ability).toEqual({ kind: "enum", values: ["push", "super_speed"] });
  });

  it("an ability on cooldown leaves the legal set", async () => {
    const env = new AgentEnvironment();
    await env.reset(2);
    await Promise.all([env.step("sieg", { type: "wait", ticks: 2 }), env.step("coco", { type: "ability", ability: "slow_time" })]);
    const coco = (await env.legal_actions("coco")).find((a) => a.type === "ability")!;
    expect(coco.params!.ability).toEqual({ kind: "enum", values: ["flight", "black_hole"] });
  });

  it("binds a dialogue press to the line the hero saw, so double presses cannot skip lines", async () => {
    const env = new AgentEnvironment();
    await env.reset(2);
    // Walk into the shrine until the goddess's scene opens.
    while (!(await env.observe("sieg")).dialogue)
      await Promise.all([env.step("sieg", { type: "wait", ticks: 20 }), env.step("coco", { type: "wait", ticks: 20 })]);
    const line = (await env.observe("sieg")).dialogue!.text;
    const [a, b] = await Promise.all([env.step("sieg", { type: "advance_dialogue" }), env.step("coco", { type: "advance_dialogue" })]);
    expect(a.accepted).toBe(true);
    expect(b.accepted).toBe(false);
    const story = roomOf(env).state.story!.cutscene!;
    expect(story.line).toBe(1);
    expect((await env.observe("coco")).dialogue!.text).not.toBe(line);
  });
});

describe("player isolation and hidden information", () => {
  it("delivers messages only to the partner", async () => {
    const env = new AgentEnvironment();
    await env.reset(4);
    // Coco's wait runs once Sieg decides again; it is not awaited here.
    void env.step("coco", { type: "wait", ticks: 5 });
    await env.step("sieg", { type: "message", text: "canary-7f3a" });
    const coco = JSON.stringify(await env.observe("coco"));
    expect(coco).toContain("canary-7f3a");
    expect((await env.observe("sieg")).messages).toEqual([]);
  });

  it("keeps each hero's own action feedback private", async () => {
    const env = new AgentEnvironment();
    await env.reset(4);
    const r = await env.step("sieg", { type: "use_item", item: "nothing" } as GameAction);
    expect(r.accepted).toBe(false);
    void env.step("coco", { type: "wait", ticks: 5 });
    await env.step("sieg", { type: "message", text: "hello" });
    expect((await env.observe("sieg")).feedback).toContain("Message sent.");
    expect((await env.observe("coco")).feedback).not.toContain("Message sent.");
  });

  it("never exposes internal state, ids or hidden quest flags", async () => {
    const env = new AgentEnvironment();
    await env.reset(4);
    const room = roomOf(env);
    // Test fixture: put the party in each quest area to inspect its screens.
    for (const scene of ["GODDESS_SHRINE", "MIRROR_POND", "HEDGE_MAZE", "GRIFFIN_ENCLOSURE"] as const) {
      if (room.state.sceneId !== scene) room.transition(scene);
      for (const id of ["sieg", "coco"] as PlayerId[]) {
        const text = JSON.stringify(await env.observe(id)) + JSON.stringify(await env.legal_actions(id));
        for (const forbidden of [
          "chapter0.", // story flag names
          "puzzles",
          "serverTick",
          "groomingStage",
          "waypoint",
          "timer",
          "cooldown\":",
          room.state.players[Object.keys(room.state.players)[0]].id,
          // HUD goal lines the owner chose to hide (main.ts)
          "Fly to the northern nest",
          "Super Speed (2) and Coco",
          "Search West: Mirror Pond",
          // instruction labels dropped in names-only mode
          "FIREBALL · dry hedge",
          "BLACK HOLE → grazing bay",
          "drop mirror + shears",
          "Hold 1 near one end",
        ])
          expect(text, `${scene}/${id} leaks "${forbidden}"`).not.toContain(forbidden);
      }
    }
  });

  it("shows other areas' objects only when the hero is there", async () => {
    const env = new AgentEnvironment();
    await env.reset(4);
    const names = (await env.observe("sieg")).visible.map((v) => v.name).join(" ");
    expect(names).not.toMatch(/griffin|mirror M1|cow/i);
  });

  it("gives the model only the public manual and the task sentence", () => {
    const manual = readFileSync("manual/Oath_and_Ember_Player_Manual.md", "utf8");
    const prompt = systemPrompt("Coco", manual);
    expect(prompt).toContain(manual);
    for (const spoiler of [/mirror pond/i, /hedge maze/i, /griffin/i, /\bwig\b/i, /shears/i, /packages\//, /scripts\//, /\.ts\b/])
      expect(prompt).not.toMatch(spoiler);
  });
});

describe("termination", () => {
  it("ends at the tick limit and refuses further actions", async () => {
    const env = new AgentEnvironment({ limits: { maxTicks: 25 } });
    await env.reset(1);
    const [a] = await Promise.all([env.step("sieg", { type: "wait", ticks: 60 }), env.step("coco", { type: "wait", ticks: 60 })]);
    expect(a.done).toBe(true);
    const out = await env.outcome();
    expect(out).toMatchObject({ status: "terminated", reason: "tick_limit", ticks: 25 });
    expect((await env.step("sieg", { type: "wait", ticks: 1 })).accepted).toBe(false);
    expect(await env.legal_actions("sieg")).toEqual([]);
  });

  it("ends at the decision limit", async () => {
    const env = new AgentEnvironment({ limits: { maxDecisionsPerPlayer: 2 } });
    await env.reset(1);
    const both = (t: string) =>
      Promise.all([env.step("sieg", { type: "message", text: t }), env.step("coco", { type: "message", text: t })]);
    await both("a");
    await both("b");
    await both("c");
    expect((await env.outcome()).reason).toBe("decision_limit");
  });

  it("ends at the model-call limit and records token usage", async () => {
    const env = new AgentEnvironment({ limits: { maxModelCallsPerPlayer: 1 } });
    await env.reset(1);
    env.recordModelCall("coco", { input: 100, output: 20 });
    expect((await env.outcome()).status).toBe("ongoing");
    env.recordModelCall("coco", { input: 100, output: 20 });
    expect(await env.outcome()).toMatchObject({ reason: "model_call_limit", tokens: { coco: { input: 200, output: 40 } } });
  });

  it("a stop releases a hero waiting on the barrier", async () => {
    const env = new AgentEnvironment();
    await env.reset(1);
    const waiting = env.step("sieg", { type: "wait", ticks: 30 });
    env.stop("wall_clock_limit");
    expect((await waiting).done).toBe(true);
    expect((await env.outcome()).ticks).toBe(0);
  });

  it("detects success from authoritative state: the baseline finishes the bounded milestone", async () => {
    const trace = new TraceWriter();
    const env = new AgentEnvironment({ preset: "milestone", trace: (e) => trace.write(e) });
    const out = await runEpisode(env, { sieg: new ExplorationBaseline(), coco: new ExplorationBaseline() }, trace, { seed: 1, wallClockMs: 30_000 });
    expect(out).toMatchObject({ status: "success", reason: "success" });
    expect(out.ticks).toBeLessThan(90 * 60);
    expect(roomOf(env).state.story!.flags).toContain("chapter0.goddess-meet");
    expect(roomOf(env).state.sceneId).not.toBe("GODDESS_SHRINE");
    verifyTrace(trace.lines);
    expect(trace.lines.at(-1)!.type).toBe("outcome");
  });
});

describe("LLM policy adapter (offline fake model)", () => {
  class FakeGateway implements Gateway {
    readonly label = "fake";
    seen: string[] = [];
    constructor(private replies: string[]) {}
    async complete(_system: string, user: string) {
      this.seen.push(user);
      return { text: this.replies.shift() ?? "{}", input: 50, output: 10, costUsd: 0 };
    }
  }
  it("submits the model's action, records usage, and records unparseable replies as invalid", async () => {
    const trace = new TraceWriter();
    const env = new AgentEnvironment({ limits: { maxModelCallsPerPlayer: 3 }, trace: (e) => trace.write(e) });
    const sieg = new FakeGateway([
      '{"notes":"start","action":{"type":"move","direction":"n","ticks":20}}',
      "I think I will go north",
      '{"action":{"type":"wait","ticks":20}}',
    ]);
    const coco = new FakeGateway(['{"action":{"type":"wait","ticks":20}}', '{"action":{"type":"wait","ticks":20}}', '{"action":{"type":"wait","ticks":20}}']);
    const out = await runEpisode(env, { sieg: new LLMPlayer("Sieg", "manual", sieg), coco: new LLMPlayer("Coco", "manual", coco) }, trace, { seed: 1, wallClockMs: 10_000 });
    expect(out.reason).toBe("model_call_limit");
    expect(out.modelCalls.sieg).toBeGreaterThanOrEqual(3);
    expect(out.invalidActions.sieg).toBe(1);
    expect(out.tokens.sieg.input).toBeGreaterThanOrEqual(150);
    // Each model only ever saw its own hero's observation.
    expect(sieg.seen.every((u) => u.includes('"player":"sieg"') && !u.includes('"player":"coco"'))).toBe(true);
    expect(coco.seen.every((u) => u.includes('"player":"coco"'))).toBe(true);
    expect(trace.lines.filter((l) => l.type === "model_call").length).toBe(out.modelCalls.sieg + out.modelCalls.coco);
  });

  it("parses replies defensively", () => {
    expect(parseReply('ok {"notes":"n","action":{"type":"interact"}} done')).toEqual({ notes: "n", action: { type: "interact" } });
    expect(parseReply("no json")).toEqual({});
  });

  it("enforces the aggregate spend cap before calling", () => {
    const cap = new SpendCap(0.01);
    cap.spent = 0.009;
    expect(() => cap.reserve(0.002)).toThrow(/spend_limit/);
  });
});
