// Minimal LLM player. One instance per hero, each with its own notes and
// action log; nothing is shared with the partner except in-game messages.
// The prompt holds the public player manual, the action format and the
// task sentence, and nothing from source code, QA scripts or specs.
//
// Accounting is not done here. A player reaches a model only through a
// MeteredGateway (../budget.ts) that the runner's ModelBudget owns: it counts
// every attempt, enforces call/token/spend limits and the per-call timeout.

import Anthropic from "@anthropic-ai/sdk";
import type { ActionSpec, GameAction, Observation, StepResult } from "../types.js";
import type { Decision, Policy } from "./policy.js";
import { ModelCallError, type Completion, type Gateway, type MeteredGateway } from "../budget.js";
import { MAX_BATCH } from "../batch.js";

export interface Prices {
  inputPerM: number;
  outputPerM: number;
  source: string;
}
/**
 * Anthropic list prices, USD per 1M tokens, as recorded in PR #7 from the
 * claude-api skill table cached 2026-10-06. NOT re-verified: they must be
 * checked against the official pricing page and dated on the day of any paid
 * run (docs/midterm/REQUIREMENTS_CHECKLIST.md).
 */
export const anthropicPrices: Record<string, Prices> = {
  "claude-opus-5-5": { inputPerM: 4, outputPerM: 20, source: "claude-api skill model table, 2026-10-06 (unverified)" },
  "claude-sonnet-5-5": { inputPerM: 2, outputPerM: 10, source: "claude-api skill model table, 2026-10-06 (unverified)" },
  "claude-haiku-5-5": { inputPerM: 0.1, outputPerM: 0.5, source: "claude-api skill model table, 2026-10-06 (unverified)" },
};

export const MAX_OUTPUT = 4000;
/** Conservative token estimate for reserving spend before a call (about 3 characters per token). */
const estimateTokens = (text: string) => Math.ceil(text.length / 3);

export class AnthropicGateway implements Gateway {
  readonly label: string;
  /** SDK retries are off: a retry would be a model call the budget never saw. */
  readonly client = new Anthropic({ maxRetries: 0 });
  constructor(
    private readonly model: string,
    private readonly prices: Prices,
  ) {
    this.label = `anthropic:${model}`;
  }
  worstCaseUsd(system: string, user: string) {
    // Cache writes cost 1.25x input; assume the whole prompt is written.
    return (estimateTokens(system + user) * 1.25 * this.prices.inputPerM + MAX_OUTPUT * this.prices.outputPerM) / 1e6;
  }
  async complete(system: string, user: string, signal: AbortSignal): Promise<Completion> {
    const response = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: MAX_OUTPUT,
        // The manual-bearing system prompt is identical every call: cache it.
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }],
      },
      { signal, maxRetries: 0 },
    );
    const u = response.usage;
    const written = u.cache_creation_input_tokens ?? 0,
      read = u.cache_read_input_tokens ?? 0;
    const tokens = { input: u.input_tokens + written + read, output: u.output_tokens };
    const costUsd =
      ((u.input_tokens + written * 1.25 + read * 0.1) * this.prices.inputPerM + u.output_tokens * this.prices.outputPerM) / 1e6;
    if (response.stop_reason === "refusal") throw new ModelCallError("refusal", "model_refusal", { tokens, costUsd });
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return { text, tokens, costUsd, model: response.model };
  }
}

/** OpenAI chat completions over HTTP. Prices must be supplied explicitly; fetch never retries. */
export class OpenAIGateway implements Gateway {
  readonly label: string;
  constructor(
    private readonly model: string,
    private readonly prices: Prices,
    private readonly apiKey = process.env.OPENAI_API_KEY,
  ) {
    if (!apiKey) throw Error("OPENAI_API_KEY is not set.");
    this.label = `openai:${model}`;
  }
  worstCaseUsd(system: string, user: string) {
    return (estimateTokens(system + user) * this.prices.inputPerM + MAX_OUTPUT * this.prices.outputPerM) / 1e6;
  }
  async complete(system: string, user: string, signal: AbortSignal): Promise<Completion> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
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
    if (!res.ok) throw new ModelCallError("error", `openai_http_${res.status}`);
    const body = (await res.json()) as {
      model?: string;
      choices: { message: { content: string | null } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const tokens = body.usage ? { input: body.usage.prompt_tokens, output: body.usage.completion_tokens } : null;
    const costUsd = tokens ? (tokens.input * this.prices.inputPerM + tokens.output * this.prices.outputPerM) / 1e6 : null;
    return { text: body.choices[0]?.message.content ?? "", tokens, costUsd, ...(body.model ? { model: body.model } : {}) };
  }
}

export const TASK = "Complete the Goddess's quest together.";

export function systemPrompt(hero: "Sieg" | "Coco", manual: string, maxBatch = MAX_BATCH) {
  const partner = hero === "Sieg" ? "Coco" : "Sieg";
  return `You are playing the cooperative game Oath and Ember as ${hero}. Another player controls ${partner}. You cannot see their screen or thoughts; you can only see what your own screen shows and the messages they send you.

Task: ${TASK}

How each turn works:
- You receive your current observation (your screen, HUD, dialogue, quest journal, backpack, recent feedback and messages), the list of actions you can take right now with their parameters, the results of your previous turn, your recent actions, and the notes you wrote for yourself last turn.
- Reply with ONE JSON object and nothing else:
  ${maxBatch > 1 ? `{"notes": "<what you want to remember next turn, max 400 characters>", "actions": [ ...1 to ${maxBatch} actions, done in order... ]}` : `{"notes": "<what you want to remember next turn, max 400 characters>", "action": { ...one action... }}`}
- Each action must be one of the listed legal actions, e.g. {"type":"move","direction":"n","ticks":30} or {"type":"advance_dialogue"} or {"type":"message","text":"..."}.${maxBatch > 1 ? `
- Your actions are done one after another. The rest are skipped as soon as anything happens: an invalid action, damage, a new place, dialogue, any feedback, a change to your backpack or journal, a message from your partner, or the end of the episode. Then you are asked again with what you now see.` : ""}
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
  private readonly maxBatch: number;
  constructor(
    hero: "Sieg" | "Coco",
    manual: string,
    /** Bound by the runner's budget to this hero; the player cannot reach a model any other way. */
    readonly model: MeteredGateway,
    /** Actions accepted per reply: MAX_BATCH (default) or 1 for the unbatched player. */
    maxBatch: number = MAX_BATCH,
  ) {
    this.maxBatch = Math.max(1, Math.min(MAX_BATCH, maxBatch));
    this.name = `llm(${model.label})${this.maxBatch > 1 ? `·batch${this.maxBatch}` : ""}`;
    this.system = systemPrompt(hero, manual, this.maxBatch);
  }

  async decide(input: Parameters<Policy["decide"]>[0]): Promise<Decision> {
    const user = JSON.stringify({
      your_notes: this.notes,
      recent_actions: this.log,
      last_turn: input.batch
        ? { results: input.batch.steps.map((s) => ({ action: s.action, result: s.result })), ...(input.batch.stopped ? { stopped_early_because: input.batch.stopped } : {}) }
        : input.last
          ? { results: [{ result: input.last }] }
          : null,
      observation: input.observation,
      legal_actions: input.legal,
    });
    // Throws ModelCallError or BudgetExhausted; the runner handles both.
    const reply = await this.model.complete(this.system, user);
    const usage = reply.record;
    const parsed = parseReply(reply.text);
    if (parsed.notes !== undefined) this.notes = parsed.notes.slice(0, 400);
    // An unparseable reply becomes a deliberately invalid action, so the
    // interface records it as a failure instead of silently substituting.
    const actions = (parsed.actions ?? (parsed.action ? [parsed.action] : [])).slice(0, this.maxBatch);
    const action = actions[0] ?? ({ type: "unparseable_reply" } as unknown as GameAction);
    for (const a of actions.length ? actions : [action]) {
      this.log.push(JSON.stringify(a).slice(0, 160));
      if (this.log.length > 8) this.log.shift();
    }
    return { action, ...(actions.length > 1 ? { then: actions.slice(1) } : {}), usage, raw: reply.text };
  }
}

export function parseReply(text: string): { notes?: string; action?: GameAction; actions?: GameAction[] } {
  const start = text.indexOf("{"),
    end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as { notes?: unknown; action?: unknown; actions?: unknown };
    const list = Array.isArray(value.actions) ? value.actions.filter((a) => a && typeof a === "object") : undefined;
    return {
      ...(typeof value.notes === "string" ? { notes: value.notes } : {}),
      ...(value.action && typeof value.action === "object" ? { action: value.action as GameAction } : {}),
      ...(list && list.length ? { actions: list as GameAction[] } : {}),
    };
  } catch {
    return {};
  }
}
