// Quest-aware scripted baseline (docs/midterm/BASELINE_PLAN.md): two
// independent players, own observation only, message-only coordination,
// one action per decision. Developed and tested on S1-S3 with the tuning
// seeds only; S4 and F are held out and never run here.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { environmentFor, SEEDS, type SituationId } from "../src/suite.js";
import { runEpisode } from "../src/runner.js";
import { TraceWriter } from "../src/trace.js";
import { PHRASE, QuestBaseline } from "../src/policies/questBaseline.js";
import type { Policy } from "../src/policies/policy.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

/** Relative imports of a source file, resolved to paths under src/. */
function imports(file: string): string[] {
  const text = readFileSync(join(SRC, file), "utf8");
  return [...text.matchAll(/from\s+"(\.[^"]+)"/g)].map((m) => join(dirname(file), m[1]).replace(/\.js$/, ".ts"));
}
function closure(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const f of imports(file)) closure(f, seen);
  return seen;
}

async function play(id: SituationId, seed: number, policies?: { sieg: Policy; coco: Policy }, limits?: { maxTicks: number }) {
  const trace = new TraceWriter();
  const env = environmentFor(id, { trace: (e) => trace.write(e), ...(limits ? { limits } : {}) });
  const p = policies ?? { sieg: new QuestBaseline("Sieg"), coco: new QuestBaseline("Coco") };
  const out = await runEpisode(env, p, trace, { seed, wallClockMs: 120_000 });
  return { out, trace, p };
}

describe("quest-aware baseline: architecture", () => {
  it("imports no engine, environment, suite, evaluator or route module, only observation types and the observation-only helpers", () => {
    const reached = [...closure("policies/questBaseline.ts")].sort();
    expect(reached).toEqual([
      "policies/combat.ts",
      "policies/navigate.ts",
      "policies/policy.ts",
      "policies/questBaseline.ts",
      "policies/questKnowledge.ts",
      "types.ts",
      // policy.ts imports the budget's types only (type-only import).
      "budget.ts",
    ].sort());
    // budget.ts itself imports only types; nothing reaches the game.
    expect(imports("budget.ts")).toEqual(["types.ts"]);
    for (const f of reached) {
      const text = readFileSync(join(SRC, f), "utf8");
      expect(text, f).not.toMatch(/from\s+"[^"]*(apps\/|shared\/|environment|suite|evaluator|route\/|perception)/);
    }
  });

  it("answers only for its own hero and returns one action per decision", async () => {
    const env = environmentFor("S1");
    await env.reset(SEEDS.tuning[0]);
    const sieg = new QuestBaseline("Sieg");
    await expect(sieg.decide({ observation: await env.observe("coco"), legal: await env.legal_actions("coco") })).rejects.toThrow(/Coco's observation/);
    const d = await sieg.decide({ observation: await env.observe("sieg"), legal: await env.legal_actions("sieg") });
    expect(d.then).toBeUndefined();
    expect(d.usage).toBeUndefined();
  });
});

describe("quest-aware baseline on the tuning scenarios", () => {
  it.each(["S1", "S3", "S2"] as SituationId[])("%s succeeds on tuning seed 0 with no invalid actions", async (id) => {
    const { out } = await play(id, SEEDS.tuning[0]);
    expect(out.status).toBe("success");
    expect(out.invalidActions).toEqual({ sieg: 0, coco: 0 });
  }, 120_000);

  it("is deterministic: the same seed gives the same trace", async () => {
    const steps = async () =>
      (await play("S3", SEEDS.tuning[1])).trace.lines.filter((l) => l.type === "step").map((l) => `${l.player}@${l.tick}:${JSON.stringify((l.data as { action: unknown }).action)}`);
    const a = await steps(),
      b = await steps();
    expect(a.length).toBeGreaterThan(100);
    expect(a).toEqual(b);
  }, 120_000);

  it("coordinates only by message: the heroes exchange the protocol phrases, and nothing else", async () => {
    const { trace } = await play("S3", SEEDS.tuning[0]);
    const sent = trace.lines
      .filter((l) => l.type === "step" && (l.data as { action: { type: string } }).action.type === "message")
      .map((l) => `${l.player}: ${(l.data as { action: { text: string } }).action.text}`);
    expect(sent).toEqual([
      `coco: ${PHRASE.pastTheCow}`,
      `sieg: ${PHRASE.readyForSlow}`,
      `coco: ${PHRASE.slowingTime}`,
      `sieg: ${PHRASE.haveKey}`,
      `coco: ${PHRASE.atGate}`,
      `sieg: ${PHRASE.gateOpen}`,
    ]);
  }, 120_000);

  it("a hero whose partner never messages waits, and the episode ends at a limit instead of hanging", async () => {
    const silent: Policy = { name: "silent", decide: async () => ({ action: { type: "wait", ticks: 30 } }) };
    const sieg = new QuestBaseline("Sieg");
    const { out } = await play("S3", SEEDS.tuning[0], { sieg, coco: silent }, { maxTicks: 3000 });
    expect(out.status).toBe("terminated");
    expect(out.reason).toBe("tick_limit");
    // Sieg cleared the guards and then waited for Coco's message about the cow.
    expect(sieg.log.some((l) => l.note.startsWith("failed"))).toBe(false);
    expect(out.invalidActions.sieg).toBe(0);
  }, 120_000);
});
