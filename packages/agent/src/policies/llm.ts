// Minimal LLM player. One instance per hero, each with its own notes and
// action log; nothing is shared with the partner except in-game messages.
// The prompt holds the public player manual, the action format and the
// task sentence, and nothing from source code, QA scripts or specs.

import Anthropic from "@anthropic-ai/sdk";
import type { ActionSpec, GameAction, Observation, StepResult } from "../types.js";
import type { Decision, Policy } from "./policy.js";

export interface Completion {
  text: string;
  input: number;
  output: number;
  costUsd: number;
}
export interface Gateway {
  readonly label: string;
  complete(system: string, user: string): Promise<Completion>;
}

/** Aggregate spend cap shared by both heroes' gateways (trusted accounting only). */
export class SpendCap {
  spent = 0;
  constructor(readonly maxUsd: number) {
    if (!(maxUsd > 0)) throw Error("A positive spend cap is required.");
  }
  reserve(worstCaseUsd: number) {
    if (this.spent + worstCaseUsd > this.maxUsd)
      throw Error(`spend_limit: $${this.spent.toFixed(4)} spent of $${this.maxUsd}`);
  }
}

export interface Prices {
  inputPerM: number;
  outputPerM: number;
  source: string;
}
/** Anthropic list prices (claude-api skill table, cached 2026-10-06), USD per 1M tokens. */
export const anthropicPrices: Record<string, Prices> = {
  "claude-opus-5-5": { inputPerM: 4, outputPerM: 20, source: "claude-api skill model table, 2026-10-06" },
  "claude-sonnet-5-5": { inputPerM: 2, outputPerM: 10, source: "claude-api skill model table, 2026-10-06" },
  "claude-haiku-5-5": { inputPerM: 0.1, outputPerM: 0.5, source: "claude-api skill model table, 2026-10-06" },
};

const MAX_OUTPUT = 4000;

export class AnthropicGateway implements Gateway {
  readonly label: string;
  private client = new Anthropic();
  constructor(
    private readonly model: string,
    private readonly prices: Prices,
    private readonly cap: SpendCap,
  ) {
    this.label = `anthropic:${model}`;
  }
  async complete(system: string, user: string): Promise<Completion> {
    const estimateIn = Math.ceil((system.length + user.length) / 3);
    this.cap.reserve((estimateIn * this.prices.inputPerM * 1.25 + MAX_OUTPUT * this.prices.outputPerM) / 1e6);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_OUTPUT,
      // The manual-bearing system prompt is identical every call: cache it.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal") throw Error("model_refusal");
    const u = response.usage;
    const written = u.cache_creation_input_tokens ?? 0,
      read = u.cache_read_input_tokens ?? 0;
    const input = u.input_tokens + written + read;
    const costUsd =
      ((u.input_tokens + written * 1.25 + read * 0.1) * this.prices.inputPerM + u.output_tokens * this.prices.outputPerM) / 1e6;
    this.cap.spent += costUsd;
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return { text, input, output: u.output_tokens, costUsd };
  }
}

/** OpenAI chat completions over HTTP. Prices must be supplied explicitly. */
export class OpenAIGateway implements Gateway {
  readonly label: string;
  constructor(
    private readonly model: string,
    private readonly prices: Prices,
    private readonly cap: SpendCap,
    private readonly apiKey = process.env.OPENAI_API_KEY,
  ) {
    if (!apiKey) throw Error("OPENAI_API_KEY is not set.");
    this.label = `openai:${model}`;
  }
  async complete(system: string, user: string): Promise<Completion> {
    const estimateIn = Math.ceil((system.length + user.length) / 3);
    this.cap.reserve((estimateIn * this.prices.inputPerM + MAX_OUTPUT * this.prices.outputPerM) / 1e6);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        max_completion_tokens: MAX_OUTPUT,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw Error(`openai_http_${res.status}`);
    const body = (await res.json()) as {
      choices: { message: { content: string | null } }[];
      usage: { prompt_tokens: number; completion_tokens: number };
    };
    const costUsd =
      (body.usage.prompt_tokens * this.prices.inputPerM + body.usage.completion_tokens * this.prices.outputPerM) / 1e6;
    this.cap.spent += costUsd;
    return {
      text: body.choices[0]?.message.content ?? "",
      input: body.usage.prompt_tokens,
      output: body.usage.completion_tokens,
      costUsd,
    };
  }
}

export const TASK = "Complete the Goddess's quest together.";

export function systemPrompt(hero: "Sieg" | "Coco", manual: string) {
  const partner = hero === "Sieg" ? "Coco" : "Sieg";
  return `You are playing the cooperative game Oath and Ember as ${hero}. Another player controls ${partner}. You cannot see their screen or thoughts; you can only see what your own screen shows and the messages they send you.

Task: ${TASK}

How each turn works:
- You receive your current observation (your screen, HUD, dialogue, quest journal, backpack, recent feedback and messages), the list of actions you can take right now with their parameters, the result of your previous action, your recent actions, and the notes you wrote for yourself last turn.
- Reply with ONE JSON object and nothing else:
  {"notes": "<what you want to remember next turn, max 400 characters>", "action": { ...one action... }}
- The action must be one of the listed legal actions, e.g. {"type":"move","direction":"n","ticks":30} or {"type":"advance_dialogue"} or {"type":"message","text":"..."}.
- Time only passes while actions run (60 ticks = 1 second). Keep moves short enough to react.
- Coordinates are in tiles; y grows downward (north is up). The "screen" rows show your view: "@" you, "P" partner, "#" blocked, "~" water or gap, "." open ground, "E" enemy, "C" creature, "o" object, ">" exit, "*" projectile.

The public player manual follows.

${manual}`;
}

export class LLMPlayer implements Policy {
  readonly name: string;
  private notes = "";
  private log: string[] = [];
  private readonly system: string;
  constructor(
    hero: "Sieg" | "Coco",
    manual: string,
    private readonly gateway: Gateway,
  ) {
    this.name = `llm(${gateway.label})`;
    this.system = systemPrompt(hero, manual);
  }

  async decide(input: { observation: Observation; legal: ActionSpec[]; last?: StepResult }): Promise<Decision> {
    const user = JSON.stringify({
      your_notes: this.notes,
      recent_actions: this.log,
      last_result: input.last ?? null,
      observation: input.observation,
      legal_actions: input.legal,
    });
    const started = performance.now();
    const reply = await this.gateway.complete(this.system, user);
    const latencyMs = Math.round(performance.now() - started);
    const usage = { input: reply.input, output: reply.output, latencyMs, costUsd: reply.costUsd };
    const parsed = parseReply(reply.text);
    if (parsed.notes !== undefined) this.notes = parsed.notes.slice(0, 400);
    // An unparseable reply becomes a deliberately invalid action, so the
    // interface records it as a failure instead of silently substituting.
    const action = parsed.action ?? ({ type: "unparseable_reply" } as unknown as GameAction);
    this.log.push(JSON.stringify(action).slice(0, 160));
    if (this.log.length > 8) this.log.shift();
    return { action, usage, raw: reply.text };
  }
}

export function parseReply(text: string): { notes?: string; action?: GameAction } {
  const start = text.indexOf("{"),
    end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as { notes?: unknown; action?: unknown };
    return {
      ...(typeof value.notes === "string" ? { notes: value.notes } : {}),
      ...(value.action && typeof value.action === "object" ? { action: value.action as GameAction } : {}),
    };
  } catch {
    return {};
  }
}
