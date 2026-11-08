// Regression tests for the S2 seed 0 OpenAI diagnosis (2026-10-28): the
// per-type strict schema (attack must not carry "ticks") and whitespace
// runaway replies. Offline: no provider request is made here. Placing a
// hero by the offering plate or in the maze is a LABELLED TEST FIXTURE.
import { describe, expect, it } from "vitest";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { AgentEnvironment } from "../src/environment.js";
import { validate } from "../src/actions.js";
import { TILE } from "../src/perception.js";
import { MAX_BATCH } from "../src/batch.js";
import { openaiSchema, OPENAI_MAX_OUTPUT, splitActionTypes } from "../src/policies/openai.js";
import { LLMPlayer, readTruncated, replySchema, systemPrompt, WHITESPACE_RUNAWAY } from "../src/policies/llm.js";
import { defaultBudgetLimits, MeteredGateway, ModelBudget, type Completion, type Gateway, type ReplyMeta } from "../src/budget.js";
import { actionFields, actionTypes, type ActionSpec, type ActionType, type PlayerId } from "../src/types.js";

const roomOf = (env: AgentEnvironment) => (env as unknown as { room: GameRoom }).room;
type Obj = Record<string, unknown>;
const variants = (schema: Obj) => {
  const actions = (schema.properties as Obj).actions as Obj;
  return (actions.items as { anyOf: Obj[] }).anyOf;
};

/** Legal actions from several real situations (shrine, dialogue, offering plate, maze). */
async function legalSamples(): Promise<ActionSpec[]> {
  const specs: ActionSpec[] = [];
  const env = new AgentEnvironment({ preset: "milestone" });
  await env.reset(0);
  const grab = async () => {
    for (const id of ["sieg", "coco"] as PlayerId[]) specs.push(...(await env.legal_actions(id)));
  };
  await grab();
  // Let the opening scene start: dialogue actions appear.
  await Promise.all([env.step("sieg", { type: "wait", ticks: 60 }), env.step("coco", { type: "wait", ticks: 60 })]);
  await Promise.all([env.step("sieg", { type: "wait", ticks: 60 }), env.step("coco", { type: "wait", ticks: 60 })]);
  await grab();
  // FIXTURE: a fresh room, Sieg beside the offering plate (use_item), then the maze (abilities).
  const env2 = new AgentEnvironment({ preset: "milestone" });
  await env2.reset(1);
  const room = roomOf(env2);
  const sieg = Object.values(room.state.players).find((p) => p.role === "OATH")!;
  Object.assign(sieg, { x: 20 * TILE, y: 17 * TILE });
  for (const id of ["sieg", "coco"] as PlayerId[]) specs.push(...(await env2.legal_actions(id)));
  room.transition("HEDGE_MAZE");
  for (const id of ["sieg", "coco"] as PlayerId[]) specs.push(...(await env2.legal_actions(id)));
  return specs;
}

describe("per-type strict schema for OpenAI", () => {
  const wire = openaiSchema(splitActionTypes(replySchema()));

  it("gives attack no ticks field, and every type exactly its own fields", () => {
    const vs = variants(wire);
    expect(vs.map((v) => ((v.properties as Obj).type as { enum: string[] }).enum[0])).toEqual([...actionTypes]);
    for (const v of vs) {
      const t = ((v.properties as Obj).type as { enum: ActionType[] }).enum[0];
      expect(Object.keys(v.properties as Obj).sort(), t).toEqual(["type", ...Object.keys(actionFields[t])].sort());
    }
    const attack = vs.find((v) => ((v.properties as Obj).type as { enum: string[] }).enum[0] === "attack")!;
    expect(Object.keys(attack.properties as Obj)).toEqual(["type", "direction"]);
  });

  it("is valid strict-mode JSON schema: closed objects with every property required", () => {
    function check(v: unknown, path: string) {
      if (!v || typeof v !== "object") return;
      const o = v as Obj;
      if (o.type === "object") {
        expect(o.additionalProperties, path).toBe(false);
        expect(o.required, path).toEqual(Object.keys(o.properties as Obj));
      }
      for (const [k, x] of Object.entries(o)) check(x, `${path}.${k}`);
    }
    check(wire, "$");
    // The root stays an object (strict mode does not allow anyOf at the root).
    expect(wire.type).toBe("object");
  });

  it("keeps optional fields nullable and copies field schemas unchanged", () => {
    const pub = ((replySchema().properties as Obj).actions as { items: { properties: Obj } }).items.properties;
    const ability = variants(wire).find((v) => ((v.properties as Obj).type as { enum: string[] }).enum[0] === "ability")!;
    const props = ability.properties as Obj;
    expect(props.ability).toEqual(pub.ability);
    expect(props.direction).toEqual({ anyOf: [pub.direction, { type: "null" }] });
    expect(props.ticks).toEqual({ anyOf: [pub.ticks, { type: "null" }] });
  });

  it("splits the single-action and no-memory reply schemas too", () => {
    for (const [name, pub] of [["single action", replySchema(1)], ["no memory", replySchema(4, "none")], ["single, no memory", replySchema(1, "none")]] as const) {
      const split = splitActionTypes(pub);
      const props = split.properties as Obj;
      const node = (props.action ?? (props.actions as Obj).items) as { anyOf: Obj[] };
      expect(node.anyOf, name).toHaveLength(actionTypes.length);
      const attack = node.anyOf.find((v) => ((v.properties as Obj).type as { enum: string[] }).enum[0] === "attack")!;
      expect(Object.keys(attack.properties as Obj), name).toEqual(["type", "direction"]);
      expect("notes" in props, name).toBe(!name.includes("no memory"));
    }
  });

  it("fails loudly if the action object is not found, so the split can never silently do nothing", () => {
    const pub = replySchema() as Obj;
    const items = ((pub.properties as Obj).actions as Obj).items as { properties: { type: { enum: string[] } } };
    const reordered = structuredClone(pub);
    (((reordered.properties as Obj).actions as Obj).items as typeof items).properties.type.enum = [...items.properties.type.enum].reverse();
    expect(() => splitActionTypes(reordered)).toThrow(/expected exactly one action object/);
    const subset = structuredClone(pub);
    (((subset.properties as Obj).actions as Obj).items as typeof items).properties.type.enum = ["move", "wait"];
    expect(() => splitActionTypes(subset)).toThrow(/found 0/);
    expect(() => splitActionTypes({ type: "object", properties: {} })).toThrow();
  });

  it("does not change the public schema or the Anthropic path", () => {
    const pub = replySchema();
    const before = JSON.stringify(pub);
    splitActionTypes(pub);
    expect(JSON.stringify(pub)).toBe(before);
    expect(JSON.stringify(pub)).not.toContain("anyOf");
  });

  it("names only the public action vocabulary: no scenario content", () => {
    expect(JSON.stringify(wire)).not.toMatch(/cow|hedge|mirror|griffin|wig|shrine|maze|bay|black hole/i);
  });

  it("matches the parameters legal_actions offers in real situations", async () => {
    const specs = await legalSamples();
    const seen = new Set<string>();
    for (const spec of specs) {
      seen.add(spec.type);
      const params = spec.params ?? {};
      expect(Object.keys(params).sort(), spec.type).toEqual(Object.keys(actionFields[spec.type]).sort());
      for (const [k, p] of Object.entries(params))
        expect("optional" in p && p.optional ? "optional" : "required", `${spec.type}.${k}`).toBe(actionFields[spec.type][k]);
    }
    for (const t of ["move", "wait", "attack", "defend", "ability", "interact", "use_item", "advance_dialogue", "message"]) expect(seen, t).toContain(t);
  });

  it("a reply shaped by the schema validates; the old failure shape is still refused, unchanged", async () => {
    const env = new AgentEnvironment({ preset: "milestone" });
    await env.reset(0);
    const legal = await env.legal_actions("sieg");
    expect(validate({ type: "attack", direction: "e" }, legal)).toBeUndefined();
    expect(validate({ type: "attack" }, legal)).toBeUndefined();
    // validate() is not loosened: the S2 failure is still an invalid action.
    expect(validate({ type: "attack", direction: "e", ticks: 1 }, legal)).toBe('Unexpected field "ticks".');
  });
});

describe("whitespace runaway replies", () => {
  const good = JSON.stringify({ notes: "n", actions: [{ type: "wait", ticks: 10 }] });

  it("caps OpenAI output at 2000 tokens", () => {
    expect(OPENAI_MAX_OUTPUT).toBe(2000);
  });

  it("reads a complete reply followed only by blank characters exactly as written, and marks it recovered", () => {
    const raw = good + " \r\n\t".repeat(900);
    const r = readTruncated(raw, good);
    expect(r).toMatchObject({ ok: true, actions: [{ type: "wait", ticks: 10 }], notes: "n" });
    expect(r.ok && r.recovered).toMatch(/3600 blank characters followed it/);
  });

  it("refuses a reply cut off inside the JSON after a whitespace run, and says so; nothing is repaired", () => {
    // The S2 seed 0 shape: valid start, then blanks until the limit.
    const raw = '{"notes":"search","actions":[{"type":"move","direction":"e","ticks":60' + "  \r\n ".repeat(400);
    const r = readTruncated(raw, raw);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/cut off at the output limit.*broke off inside the JSON after \d+ blank characters/);
  });

  it("keeps the plain message for an ordinary cut-off reply", () => {
    const raw = '{"notes":"' + "x".repeat(300);
    expect(readTruncated(raw, raw)).toEqual({ ok: false, reason: "The reply was cut off at the output limit (stop reason max_tokens)." });
    expect(WHITESPACE_RUNAWAY).toBeGreaterThan(50);
  });

  it("gives the real reason for a complete but unusable reply followed by blanks, not a false cut-off story", () => {
    const raw = JSON.stringify({ notes: "n", actions: [{ type: "wait", ticks: 10 }], extra: 1 }) + " ".repeat(500);
    const r = readTruncated(raw, raw);
    expect(r).toEqual({ ok: false, reason: 'The reply had an unexpected field "extra".' });
    const empty = JSON.stringify({ actions: [] }) + "\n".repeat(300);
    expect(readTruncated(empty, empty)).toEqual({ ok: false, reason: 'The "actions" list was empty.' });
  });

  it("refuses complete JSON that ends exactly at the limit with no blanks (nothing shows it was finished)", () => {
    expect(readTruncated(good, good)).toEqual({ ok: false, reason: "The reply was cut off at the output limit (stop reason max_tokens)." });
  });

  it("does not accept a truncated reply that only looks complete after trimming inner text", () => {
    const raw = good.slice(0, -2) + " ".repeat(500);
    expect(readTruncated(raw, raw).ok).toBe(false);
  });
});

describe("prompt guidance", () => {
  const prompt = systemPrompt("Sieg", "MANUAL", MAX_BATCH);
  it("covers batching, J recovery, recharge waits, repeated messages and compact replies", () => {
    expect(prompt).toMatch(/send them together in one reply, up to 4/);
    expect(prompt).toMatch(/"recovering", pressing J does nothing/);
    expect(prompt).toMatch(/recharging \(Ns\)/);
    expect(prompt).toMatch(/Do not repeat a message your partner has not answered/);
    expect(prompt).toMatch(/compact JSON/);
  });
  it("adds no scenario content, answer or new action type", () => {
    const guidance = prompt.slice(prompt.indexOf("Playing efficiently:"), prompt.indexOf("Shared dialogue:"));
    expect(guidance).not.toMatch(/cow|hedge|mirror|griffin|wig|pond|maze|bay|black hole|fireball at|\(\d+, \d+\)/i);
    for (const word of guidance.match(/"type":"(\w+)"/g) ?? []) expect(actionTypes).toContain(word.split('"')[3]);
  });
});

/** A fake provider that always stops at the output limit with the given text. */
class CutOff implements Gateway {
  readonly label = "cut-off";
  constructor(private readonly provider: "openai" | "anthropic", private readonly raw: string, private readonly text = raw) {}
  worstCaseUsd() {
    return 0.001;
  }
  async complete(): Promise<Completion> {
    const meta = { provider: this.provider, stopReason: "max_tokens", blocks: [], structured: true } as unknown as ReplyMeta;
    return { text: this.text, rawText: this.provider === "openai" ? this.raw : undefined, tokens: { input: 10, output: 2000 }, costUsd: 0.0001, meta };
  }
}

describe("cut-off replies by provider", () => {
  const complete = JSON.stringify({ notes: "n", actions: [{ type: "wait", ticks: 10 }] });
  const padded = complete + " \n\t".repeat(300);
  async function decide(g: Gateway) {
    const env = new AgentEnvironment({ preset: "milestone" });
    await env.reset(0);
    const player = new LLMPlayer("Sieg", "manual", new MeteredGateway(g, new ModelBudget(defaultBudgetLimits), "sieg"));
    return player.decide({ observation: await env.observe("sieg"), legal: await env.legal_actions("sieg") });
  }

  it("OpenAI: a complete reply followed by blanks is used as written and marked recovered", async () => {
    const d = await decide(new CutOff("openai", padded, complete));
    expect(d.action).toEqual({ type: "wait", ticks: 10 });
    expect(d.recovered).toMatch(/blank characters followed it/);
  });

  it("Anthropic: any cut-off reply is still refused, as before this change", async () => {
    const d = await decide(new CutOff("anthropic", padded));
    expect(d.action).toBeUndefined();
    expect(d.replyProblem).toBe("The reply was cut off at the output limit (stop reason max_tokens).");
  });
});
