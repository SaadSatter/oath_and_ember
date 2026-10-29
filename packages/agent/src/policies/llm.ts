// Minimal LLM player. One instance per hero, each with its own notes and
// action log; nothing is shared with the partner except in-game messages.
// The prompt holds the public player manual, the action format and the
// task sentence, and nothing from source code, QA scripts or specs.
//
// Accounting is not done here. A player reaches a model only through a
// MeteredGateway (../budget.ts) that the runner's ModelBudget owns: it counts
// every attempt, enforces call/token/spend limits and the per-call timeout.

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { abilityNames, actionTypes, directions, type GameAction, type MovementReport, type Observation } from "../types.js";
import { stepStatus, type Decision, type Policy, type TurnReport } from "./policy.js";
import { paidTransport, assertPaidTransport, ModelCallError, type Completion, type CompletionOptions, type Gateway, type MeteredGateway, type ReplyMeta } from "../budget.js";
import { MAX_BATCH } from "../batch.js";
import { tutorialBlock, tutorialId } from "../playerKnowledge.js";
import { HeroMemory } from "../heroMemory.js";

export interface Prices {
  inputPerM: number;
  outputPerM: number;
  /** Cache write (5-minute) and cache read prices as multiples of the input price. */
  cacheWrite?: number;
  cacheRead?: number;
  /** Prompts over this many input tokens (cache reads and writes included) pay `longContext` prices instead. */
  longContextOver?: number;
  longContext?: { inputPerM: number; outputPerM: number };
  source: string;
}
const PRICING_PAGE = "https://platform.claude.com/docs/en/about-claude/pricing (verified 2026-10-27)";
/**
 * Anthropic first-party list prices, USD per 1M tokens, verified on 2026-10-27
 * against the official pricing page. Re-verify and re-date them on the day of
 * any paid run. Thinking tokens are billed as output tokens.
 */
export const anthropicPrices: Record<string, Prices> = {
  "claude-haiku-5-5": {
    inputPerM: 0.1,
    outputPerM: 0.5,
    cacheWrite: 1.25,
    cacheRead: 0.1,
    longContextOver: 100_000,
    longContext: { inputPerM: 0.5, outputPerM: 2.5 },
    source: PRICING_PAGE,
  },
  "claude-haiku-4-5": { inputPerM: 1, outputPerM: 5, cacheWrite: 1.25, cacheRead: 0.1, source: PRICING_PAGE },
  "claude-sonnet-5-5": { inputPerM: 2, outputPerM: 10, cacheWrite: 1.25, cacheRead: 0.05, source: PRICING_PAGE },
  "claude-opus-5-5": { inputPerM: 4, outputPerM: 20, cacheWrite: 1.25, cacheRead: 0.05, source: PRICING_PAGE },
};

/** Cost of one call from reported usage, with the cache and long-context rules above. */
export function anthropicCost(prices: Prices, u: { input: number; cacheWrite: number; cacheRead: number; output: number }) {
  const prompt = u.input + u.cacheWrite + u.cacheRead;
  const p = prices.longContextOver !== undefined && prompt > prices.longContextOver && prices.longContext ? { ...prices, ...prices.longContext } : prices;
  return (
    ((u.input + u.cacheWrite * (prices.cacheWrite ?? 1.25) + u.cacheRead * (prices.cacheRead ?? 0.1)) * p.inputPerM + u.output * p.outputPerM) / 1e6
  );
}

export const MAX_OUTPUT = 4000;
/** Byte upper bound plus framing margin, rather than average chars/token.
 * Only text system/user messages are supported by these adapters. Reserve the
 * maximum output (thinking included) and all input at the cache-write rate.
 */
const estimateTokens = (text: string) => Buffer.byteLength(text, "utf8") + 4096;

export type Effort = "low" | "medium" | "high";
export const EFFORTS: readonly Effort[] = ["low", "medium", "high"];

/**
 * The only model and efforts the owner approved for paid runs (2026-10-27):
 * claude-haiku-5-5 at "medium", with "low" as the S1-S3 pilot comparison.
 * Other price-table entries exist for cost comparisons only (MODEL_BUDGET.md).
 * Enforced by AnthropicGateway itself, so no entrypoint can bypass it
 * (re-review M2). Changing this needs the owner's approval.
 */
export const APPROVED_MODELS: Readonly<Record<string, readonly Effort[]>> = Object.freeze({
  "claude-haiku-5-5": Object.freeze(["medium", "low"] as Effort[]),
});
/** The approved smoke configuration: one call at the default effort. */
export const SMOKE_CONFIG = Object.freeze({ model: "claude-haiku-5-5", effort: "medium" as Effort });

export function assertApprovedModel(model: string, effort: string) {
  const efforts = Object.hasOwn(APPROVED_MODELS, model) ? APPROVED_MODELS[model] : undefined;
  if (!efforts) throw Error(`Model ${model} is not approved for paid runs (approved: ${Object.keys(APPROVED_MODELS).join(", ")}).`);
  if (!efforts.includes(effort as Effort)) throw Error(`Effort "${effort}" is not approved for ${model} (approved: ${efforts.join(", ")}).`);
}
/** The provider endpoint, fixed so ANTHROPIC_BASE_URL in the environment cannot redirect the key. */
const ANTHROPIC_BASE_URL = "https://api.anthropic.com";

export class AnthropicGateway implements Gateway {
  readonly label: string;
  /** SDK retries are off: a retry would be a model call the budget never saw. */
  readonly client: Anthropic;
  constructor(
    private readonly model: string,
    private readonly prices: Prices,
    /**
     * output_config.effort. Owner decision 2026-10-27: start at "medium"
     * (Haiku 5.5's default) and compare with "low" in the S1-S3 pilot.
     * Always sent explicitly so the trace records what was used.
     */
    readonly effort: Effort = "medium",
    /**
     * The credential, held only by the SDK client in memory. When omitted the
     * SDK reads ANTHROPIC_API_KEY. Never part of the label, traces or summaries.
     */
    apiKey?: string,
    /**
     * Ask the API to constrain replies to the player's JSON schema
     * (output_config.format) when the player supplies one. It changes the
     * reply format only, never the model or the effort. The reply is still
     * validated by parseReply() either way.
     */
    readonly structured = true,
  ) {
    assertApprovedModel(model, effort);
    this.label = `anthropic:${model}@${effort}`;
    // An explicit key also stops the SDK from reading ANTHROPIC_AUTH_TOKEN.
    this.client = new Anthropic({ maxRetries: 0, baseURL: ANTHROPIC_BASE_URL, ...(apiKey ? { apiKey } : {}),
      fetch: (input, init) => { assertPaidTransport(); return fetch(input, { ...init, redirect: "error" }); },
    });
  }
  worstCaseUsd(system: string, user: string, options?: CompletionOptions) {
    // Assume the whole prompt (schema included) is a cache write and the full output budget is used.
    const schema = this.structured && options?.schema ? JSON.stringify(options.schema) : "";
    return anthropicCost(this.prices, { input: 0, cacheWrite: estimateTokens(system + user + schema), cacheRead: 0, output: MAX_OUTPUT });
  }
  async complete(system: string, user: string, signal: AbortSignal, options?: CompletionOptions): Promise<Completion> {
    const format = this.structured && options?.schema ? { format: { type: "json_schema" as const, schema: options.schema } } : {};
    const response = await paidTransport(signal, () => this.client.messages.create(
      {
        model: this.model,
        max_tokens: MAX_OUTPUT,
        // The manual-bearing system prompt is identical every call: cache it.
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }],
        output_config: { effort: this.effort, ...format },
      },
      { signal, maxRetries: 0 },
    ));
    const u = response.usage;
    const written = u.cache_creation_input_tokens ?? 0,
      read = u.cache_read_input_tokens ?? 0;
    const tokens = { input: u.input_tokens + written + read, output: u.output_tokens };
    const costUsd = anthropicCost(this.prices, { input: u.input_tokens, cacheWrite: written, cacheRead: read, output: u.output_tokens });
    if (response.stop_reason === "refusal") throw new ModelCallError("refusal", "model_refusal", { tokens, costUsd });
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    // Diagnosis only: block types and lengths, never thinking text.
    const meta: ReplyMeta = {
      stopReason: response.stop_reason ?? null,
      blocks: response.content.map((b) => ({ type: b.type, chars: b.type === "text" ? b.text.length : b.type === "thinking" ? b.thinking.length : 0 })),
      structured: "format" in format,
    };
    return { text, tokens, costUsd, model: response.model, cache: { read, write: written }, meta };
  }
}

export { OpenAIGateway } from "./openai.js";

export const TASK = "Complete the Goddess's quest together.";

/**
 * "history": the player keeps its own notes (400 characters), its last 8
 * executed actions, its last 4 refused or stale ones, and the fate of every
 * action of its previous turn.
 * "none" (observation-only): each call holds only the current observation and
 * legal actions. The observation's own recent feedback, dialogue log and
 * messages remain, because they are on the hero's screen.
 * "persistent" (the opt-in model-memory player, docs/midterm/MODEL_MEMORY.md):
 * everything "history" has, plus a per-hero HeroMemory built only from this
 * hero's own observations and action results (remembered map, last-seen
 * things, verified events, sent messages). The "history" and "none" prompts
 * and user messages are unchanged by it (pinned in modelMemory.test.ts).
 */
export type Memory = "history" | "none" | "persistent";

/** Executed actions kept as completed history (history memory). */
export const COMPLETED_LOG = 8;
/** Refused or stale actions kept as a separate, clearly labelled list. */
export const REJECTED_LOG = 4;

/**
 * The JSON schema of a reply: the public action format of types.ts and
 * nothing else (no game content, no answer). It uses only schema features the
 * Anthropic structured-output API accepts (no numeric or length limits); the
 * environment's validate() still checks every parameter against the actions
 * legal at that moment.
 */
export function replySchema(maxBatch: number = MAX_BATCH, memory: Memory = "history"): Record<string, unknown> {
  const action = {
    type: "object",
    properties: {
      type: { type: "string", enum: [...actionTypes] },
      direction: { type: "string", enum: [...directions] },
      ticks: { type: "integer" },
      ability: { type: "string", enum: [...abilityNames] },
      item: { type: "string" },
      option: { type: "integer" },
      text: { type: "string" },
    },
    required: ["type"],
    additionalProperties: false,
  };
  const notes = memory !== "none" ? { notes: { type: "string" } } : {};
  return maxBatch > 1
    ? { type: "object", properties: { ...notes, actions: { type: "array", items: action } }, required: ["actions"], additionalProperties: false }
    : { type: "object", properties: { ...notes, action }, required: ["action"], additionalProperties: false };
}

/**
 * The model-memory player's explanation of its memory field (persistent
 * memory only). It explains the record's meaning and limits; it holds no
 * game content, route, coordinates or puzzle step.
 */
export const MEMORY_SECTION = `

Your memory (the "memory" field):
- It is built only from your own earlier screens, the results of your own actions and the messages you sent. It holds nothing your partner saw and nothing your screen never showed. It never tells you where to go or what to do: choose your own route and actions.
- Your current observation is the truth about the present. Everything in memory is history: what you saw or were told, and when.
- memory.remembered_map is this area as your screen last showed each tile. Its first two rows give each column's x (tens digit, then units digit); every other row starts with its y. "?" never on your screen; "#" blocked; "." open ground you have seen but never walked on; "+" ground you walked on; "~" water or gap; "o" an object; ">" an exit; "^" a raised hazard; ":" seen, but something stood on it, so the ground was not shown; "@" you now. on_screen_now is the part your screen shows now; tiles outside it may have changed since you saw them.
- Seen is not visited: "." only means your screen showed that ground. other_areas counts what you saw and walked in other areas.
- Creatures, enemies, your partner and other moving things are not drawn on the remembered map. memory.last_seen_things lists things you saw earlier that are not on your screen now, with where and when you last saw them. They may have moved or gone since.
- memory.verified_events lists changes your own screen showed (two of your views of the same tiles or the same thing that differ) and lines the game's feedback showed you, each with its tick. A newer event about the same tiles replaces an older one (superseded_by). An event stays true until something you see shows otherwise. An action being accepted is never listed there; only what you saw happen.
- memory.recent_sent_messages lists the messages you sent; observation.messages lists the ones you received. Messages are what someone said, not verified facts, yours included. An older request from your partner does not override a verified event or your current observation: if they show the request is already done, tell your partner rather than doing it again.
- your_notes is for your own plans and guesses. They are not verified.`;

export function systemPrompt(hero: "Sieg" | "Coco", manual: string, maxBatch = MAX_BATCH, memory: Memory = "history") {
  const partner = hero === "Sieg" ? "Coco" : "Sieg";
  const notesField = memory !== "none" ? `"notes": "<what you want to remember next turn, max 400 characters>", ` : "";
  return `You are playing the cooperative game Oath and Ember as ${hero}. Another player controls ${partner}. You cannot see their screen or thoughts; you can only see what your own screen shows and the messages they send you.

Task: ${TASK}

How each turn works:
- You receive your current observation (your screen, HUD, dialogue, the dialogue lines your screen showed recently, quest journal, backpack, recent feedback and messages) and the list of actions you can take right now with their parameters${memory !== "none" ? ", plus what happened to each action of your previous turn, the actions you have completed, recent refused actions, and the notes you wrote for yourself last turn" : ". You keep no memory between turns: each turn you see only what is on your screen now"}.
- Reply with ONE JSON object and nothing else:
  ${maxBatch > 1 ? `{${notesField}"actions": [ ...1 to ${maxBatch} actions, done in order... ]}` : `{${notesField}"action": { ...one action... }}`}
- Each action must be one of the listed legal actions, e.g. {"type":"move","direction":"n","ticks":30} or {"type":"advance_dialogue"} or {"type":"message","text":"..."}.${maxBatch > 1 ? `
- Your actions are done one after another. The rest are skipped as soon as anything happens: an invalid action, damage, a new place, dialogue, any feedback, a change to your backpack or journal, a message from your partner, or the end of the episode. Then you are asked again with what you now see. Skipped actions did not happen.` : ""}
- Time only passes while actions run (60 ticks = 1 second). Keep moves short enough to react.
- Coordinates are in tiles; y grows downward (north is up). The "screen" rows show your view, one character per tile: "@" you, "P" partner, "#" blocked, "~" water or gap, "." open ground, "E" enemy, "C" creature, "o" object, ">" exit, "*" projectile, "^" a raised hazard. Labels (kind "label") are text painted or floating in the world: they are listed in visible without a screen character, to be read. A visible entry with an extent is drawn across that block of tiles (x and y of its top-left tile, w and h in tiles).
- Your x and y (self) are given to two decimals, cut off rather than rounded; "@" is drawn in the tile whose column and row are their whole-number parts. A ".", "#" or "~" tile shows what lies at its centre, so an obstacle can cover part of a "." tile or leave part of a "#" tile open. A hero, creature, enemy, object, exit or projectile drawn in a tile replaces that character, so the ground under it is not shown. Your body is a square about 0.8 tiles wide centred on your x and y, and you fit only where all of it is clear.
- ${memory !== "none" ? `A move's result includes movement: how far your own walking took you in that direction compared with how far that move would have taken you on open ground ("full", "partial", "none", or "not_applied" when the game did not take your movement input at all), with where you started and ended. ` : ""}A Push with a direction reports your walking the same way, and a line says whether anything moved while you pushed: walking while pushing is not the same as moving an object. When a move falls short, a feedback line says so; it does not say what stopped you. Separate lines say when, for some ticks, your hero did not take your movement input or the game moved your hero; those are not obstacles.

Your actions:
- You act only through the actions in legal_actions. That list is rebuilt every turn from your situation: where you stand, what is next to you, whether a dialogue line is waiting for you, and which abilities are ready. For example, use_item appears only when you stand next to an object, and advance_dialogue only when the line on your screen is yours to move on. An action that is not listed is not available right now; move closer or wait for the situation to change.
- The player manual below is written for people using a keyboard. You cannot press keys. Each control it describes corresponds to one of your actions (walking is move, E is interact or advance_dialogue, J is attack, K is defend, number keys are ability, the backpack panel is use_item, numbered responses are choose_dialogue), and only when that action is in legal_actions.${memory !== "none" ? `
- last_turn reports every action you proposed last turn with its status: "executed" (it happened), "rejected" (the game refused it; only its feedback happened), "stale" (a dialogue press for a line that had already moved on; nothing happened) or "skipped" (never tried, because the turn stopped first). completed_actions lists only executed actions. Do not treat a skipped or rejected action as done.` : ""}${memory === "persistent" ? MEMORY_SECTION : ""}

Playing efficiently:
- Every reply takes real time, and while you think the game waits for you (and your partner waits too).${maxBatch > 1 ? ` When the next few steps are clear (walking a stretch, waiting, a planned sequence), send them together in one reply, up to ${maxBatch}; the rest stop by themselves as soon as anything happens.` : ""}
- Your J attack needs a moment between uses (the manual says how long). While abilities shows J as "recovering", pressing J does nothing: the result says the sword did not swing or no fireball was cast. Do not press J again at once; move, guard or wait briefly first${maxBatch > 1 ? `, or send an attack followed by a short wait in the same reply` : ""}.
- An ability marked "recharging (Ns)" cannot be used for N more seconds. Use that time for something else or wait in longer steps, rather than checking every few ticks.
- If an action failed or a result says nothing happened, change your approach (position, direction, timing or a different action) rather than repeating it without new information.
- Send a message when you have something new to say or ask. Do not repeat a message your partner has not answered yet: they may be busy, and every message costs a turn. Read your recent messages before you write.
- Report only progress your own observation supports (your area, position, backpack, journal, feedback). Say clearly when something is a guess ("I think…", "maybe") rather than something you saw happen.
- When your own latest observation disagrees with something your partner reported earlier, or with your own older notes, trust what you see now, and tell your partner what changed.
- When your partner asks you a direct question, answer it before repeating your own request.
- Tell your partner when your plan changes or when you observe an important change in the world.
- Report significant changes you see as soon as you see them, with where they happened: for example a creature or object that moved, a passage that opened, or something that appeared or disappeared.
- Do not repeat information your partner has already acknowledged, answered or reported back to you.
- Send a message only when you have new information or need to coordinate an action, and keep it short. One message usually covers it; several messages in one turn are rarely needed.
- Reply with compact JSON and no padding or blank lines.

Shared dialogue:
- When you are both in a scene you read the same dialogue box, and one press from either of you moves a shared line on for both. If you both press at once, only the first press counts; the other comes back "stale" and changes nothing.
- Agree with your partner by message who moves shared lines on (for example, whoever is speaking, or one of you for the whole scene) and let the other wait while reading. A line meant only for one of you can be moved on only by that hero.
- dialogue_log in your observation keeps the lines your own screen showed, including lines that moved on while you were busy or waiting.

The public player manual follows.

${manual}`;
}

/**
 * A scenario's episode briefing as its own block, appended after the general
 * prompt (systemPrompt stays the same for every scenario). The same text goes
 * to both heroes, whichever provider serves them: it is part of the one
 * system string LLMPlayer hands to its gateway.
 */
export function briefingBlock(briefing: string) {
  return `\n\n=== Episode briefing ===\n${briefing.trim()}\n=== End of episode briefing ===`;
}
/** Short id of a briefing for policy names, so briefed runs are told apart in traces and results. */
export const briefingId = (briefing: string) => createHash("sha256").update(briefing).digest("hex").slice(0, 8);

export class LLMPlayer implements Policy {
  readonly name: string;
  private notes = "";
  /** Executed actions only, oldest first. */
  private completed: { action: GameAction; ticks: number; interrupted?: string; movement?: MovementReport }[] = [];
  /** Refused or stale actions, oldest first, kept apart from completed history. */
  private rejected: { action: GameAction; status: "rejected" | "stale"; error: string }[] = [];
  private readonly system: string;
  private readonly schema: Record<string, unknown>;
  private readonly maxBatch: number;
  readonly memory: Memory;
  /** persistent memory only: this hero's own HeroMemory, and the observation its last decision answered. */
  private readonly heroMemory?: HeroMemory;
  private lastObservation?: Observation;
  constructor(
    hero: "Sieg" | "Coco",
    manual: string,
    /** Bound by the runner's budget to this hero; the player cannot reach a model any other way. */
    readonly model: MeteredGateway,
    /** Actions accepted per reply: MAX_BATCH (default) or 1 for the unbatched player. */
    maxBatch: number = MAX_BATCH,
    memory: Memory = "history",
    /** The scenario's episode briefing (suite.ts), if it has one. */
    readonly briefing?: string,
    /**
     * Tutorial-completion knowledge (playerKnowledge.ts), if the scenario gives
     * it. Its own block after the manual, before the episode briefing, so the
     * system string stays identical for every call of the episode.
     */
    readonly tutorial?: string,
  ) {
    if (!Number.isInteger(maxBatch) || maxBatch < 1 || maxBatch > MAX_BATCH) throw Error(`maxBatch must be an integer from 1 to ${MAX_BATCH}.`);
    this.maxBatch = maxBatch;
    this.memory = memory;
    if (memory === "persistent") this.heroMemory = new HeroMemory(hero);
    if (briefing !== undefined && !briefing.trim()) throw Error("An episode briefing must not be empty.");
    if (tutorial !== undefined && !tutorial.trim()) throw Error("A tutorial briefing must not be empty.");
    this.name = `llm(${model.label})${this.maxBatch > 1 ? `·batch${this.maxBatch}` : ""}${memory === "none" ? "·obs-only" : memory === "persistent" ? "·memory" : ""}${tutorial ? `·tutorial-${tutorialId(tutorial)}` : ""}${briefing ? `·briefing-${briefingId(briefing)}` : ""}`;
    this.system = systemPrompt(hero, manual, this.maxBatch, memory) + (tutorial ? tutorialBlock(tutorial) : "") + (briefing ? briefingBlock(briefing) : "");
    this.schema = replySchema(this.maxBatch, memory);
  }

  /** Files the previous turn's outcome: executed actions as completed, refused and stale ones apart. */
  private remember(turn: TurnReport) {
    for (const s of turn.steps) {
      if (s.status === "executed") {
        this.completed.push({
          action: s.action,
          ticks: s.result.ticks,
          ...(s.result.interrupted ? { interrupted: s.result.interrupted } : {}),
          ...(s.result.movement ? { movement: s.result.movement } : {}),
        });
        if (this.completed.length > COMPLETED_LOG) this.completed.shift();
      } else {
        this.rejected.push({ action: s.action, status: s.status, error: (s.result.error ?? s.result.feedback[0] ?? "").slice(0, 200) });
        if (this.rejected.length > REJECTED_LOG) this.rejected.shift();
      }
    }
  }

  async decide(input: Parameters<Policy["decide"]>[0]): Promise<Decision> {
    let user: string;
    if (this.memory === "none") user = JSON.stringify({ observation: input.observation, legal_actions: input.legal });
    else {
      if (input.batch) this.remember(input.batch);
      const hero = this.heroMemory;
      if (hero) {
        // Only this hero's own observations and results go in (heroMemory.ts).
        if (input.batch) hero.recordTurn(input.batch, this.lastObservation);
        hero.observe(input.observation);
        this.lastObservation = input.observation;
      }
      user = JSON.stringify({
        your_notes: this.notes,
        completed_actions: this.completed,
        recent_rejected_actions: this.rejected,
        last_turn: describeTurn(input),
        ...(hero ? { memory: hero.view(input.observation) } : {}),
        observation: input.observation,
        legal_actions: input.legal,
      });
    }
    // Throws ModelCallError or BudgetExhausted; the runner handles both.
    const reply = await this.model.complete(this.system, user, { schema: this.schema });
    const usage = reply.record;
    const truncated = reply.meta?.stopReason === "max_tokens";
    // Cut-off replies: OpenAI's are classified by readTruncated (whitespace
    // runaways, S2 seed 0). Anthropic keeps its earlier rule: always refused.
    const parsed = !truncated
      ? parseReply(reply.text, this.maxBatch)
      : reply.meta?.provider === "openai"
        ? readTruncated(reply.rawText ?? reply.text, reply.text, this.maxBatch)
        : ({ ok: false, reason: CUT_OFF } as const);
    // An unusable reply is never turned into an action: the runner submits
    // nothing, records the problem, and tells this player next turn.
    if (!parsed.ok) return { replyProblem: parsed.reason, usage, raw: reply.rawText ?? reply.text };
    if (parsed.notes !== undefined && this.memory !== "none") this.notes = parsed.notes.slice(0, 400);
    const [action, ...then] = parsed.actions;
    return {
      action,
      ...(then.length ? { then } : {}),
      ...(parsed.dropped.length ? { dropped: parsed.dropped } : {}),
      ...(parsed.recovered ? { recovered: parsed.recovered } : {}),
      usage,
      raw: reply.rawText ?? reply.text,
    };
  }
}

/** The previous turn as the model sees it: one status per proposed action. */
function describeTurn(input: Parameters<Policy["decide"]>[0]) {
  const t = input.batch;
  if (!t) return input.last ? { results: [{ status: stepStatus(input.last), result: input.last }] } : null;
  if (t.replyProblem) return { reply_problem: `${t.replyProblem} Nothing was done.` };
  return {
    results: [
      ...t.steps.map((s) => ({ action: s.action, status: s.status, result: s.result })),
      ...t.skipped.map((s) => ({ action: s.action, status: "skipped" as const, reason: s.reason })),
    ],
    ...(t.stopped ? { stopped_early_because: t.stopped } : {}),
  };
}

/** Blank characters in a row that mark a whitespace runaway rather than ordinary formatting. */
export const WHITESPACE_RUNAWAY = 200;
const CUT_OFF = "The reply was cut off at the output limit (stop reason max_tokens).";

/**
 * An OpenAI reply that stopped at the output limit (used only for OpenAI; an
 * Anthropic cut-off reply is always refused). It is never repaired. Two cases
 * seen in the S2 seed 0 OpenAI run are told apart:
 *   - the JSON was complete and only blank characters followed it until the
 *     limit: JSON itself ignores trailing whitespace (JSON.parse accepts it),
 *     so the reply is read exactly as written and marked as recovered;
 *   - the reply broke off inside the JSON after a long run of blank
 *     characters (the "whitespace runaway"): refused, with a reason that says
 *     so, which the player sees next turn.
 * `raw` is the provider's text; `text` the adapter's normalized form of it.
 */
export function readTruncated(raw: string, text: string, maxBatch: number = MAX_BATCH): ParsedReply {
  const trailing = raw.length - raw.trimEnd().length;
  let complete = false;
  try {
    JSON.parse(raw);
    complete = true;
  } catch {
    // Not a complete JSON document.
  }
  if (complete) {
    // The JSON closed, so nothing broke off: judge it as any reply, and if it
    // is unusable say why, not that it was cut off mid-JSON.
    const parsed = parseReply(text, maxBatch);
    if (!parsed.ok) return parsed;
    if (trailing > 0 && !parsed.recovered)
      return { ...parsed, recovered: `The reply was complete, but ${trailing} blank characters followed it up to the output limit; they were ignored.` };
    return { ok: false, reason: CUT_OFF };
  }
  const longest = Math.max(0, ...(raw.match(/\s+/g) ?? []).map((run) => run.length));
  if (longest >= WHITESPACE_RUNAWAY)
    return {
      ok: false,
      reason: `${CUT_OFF} It broke off inside the JSON after ${longest} blank characters (spaces, tabs or line breaks) in a row. Reply with compact JSON and no padding.`,
    };
  return { ok: false, reason: CUT_OFF };
}

export type ParsedReply =
  | { ok: true; notes?: string; actions: GameAction[]; dropped: GameAction[]; recovered?: string }
  | { ok: false; reason: string };

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const looksLikeAction = (v: unknown) => isPlain(v) && typeof v.type === "string";

/** Every top-level {...} span in `text` that parses as JSON (string-aware brace matching). */
function jsonObjects(text: string): unknown[] {
  const out: unknown[] = [];
  let depth = 0,
    start = -1,
    inString = false,
    escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (depth > 0 && inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (depth > 0 && c === '"') inString = true;
    else if (c === "{") {
      if (depth++ === 0) start = i;
    } else if (c === "}" && depth > 0 && --depth === 0) {
      try {
        out.push(JSON.parse(text.slice(start, i + 1)));
      } catch {
        // Not JSON: treated as extra text.
      }
    }
  }
  return out;
}

/**
 * Reads a reply's action envelope: {"notes"?, "actions": [...]} or
 * {"notes"?, "action": {...}}. Conservative by design. It accepts a single
 * envelope surrounded by extra text (or repeated identically), and refuses
 * anything ambiguous: no envelope, several different envelopes, action
 * objects outside the envelope, unknown fields, an empty list, or an entry
 * that is not an action object. It never invents or repairs an action.
 * Parameter legality is not judged here; step() validates each action.
 */
export function parseReply(text: string, maxBatch: number = MAX_BATCH): ParsedReply {
  if (!text.trim()) return { ok: false, reason: "The reply was empty." };
  let objects: unknown[];
  let extra = false;
  try {
    objects = [JSON.parse(text)];
  } catch {
    objects = jsonObjects(text);
    extra = true;
  }
  const envelopes = objects.filter((o) => isPlain(o) && ("actions" in o || "action" in o)) as Record<string, unknown>[];
  if (!envelopes.length) return { ok: false, reason: 'The reply had no JSON object with an "actions" list.' };
  const distinct = [...new Set(envelopes.map((e) => JSON.stringify(e)))];
  if (distinct.length > 1) return { ok: false, reason: "The reply had several different action lists; none was used." };
  if (objects.some((o) => !envelopes.includes(o as Record<string, unknown>) && looksLikeAction(o)))
    return { ok: false, reason: "The reply had action objects outside the action list; none was used." };
  const env = envelopes[0];
  const unknown = Object.keys(env).find((k) => !["notes", "actions", "action"].includes(k));
  if (unknown) return { ok: false, reason: `The reply had an unexpected field "${unknown}".` };
  if ("actions" in env && "action" in env) return { ok: false, reason: 'The reply had both "action" and "actions".' };
  if (env.notes !== undefined && typeof env.notes !== "string") return { ok: false, reason: '"notes" must be text.' };
  let list: unknown[];
  if ("actions" in env) {
    if (!Array.isArray(env.actions)) return { ok: false, reason: '"actions" must be a list.' };
    list = env.actions;
  } else list = [env.action];
  if (!list.length) return { ok: false, reason: 'The "actions" list was empty.' };
  const bad = list.findIndex((a) => !looksLikeAction(a));
  if (bad >= 0) return { ok: false, reason: `Action ${bad + 1} is not an action object with a "type".` };
  const actions = list as GameAction[];
  const notes = typeof env.notes === "string" ? env.notes : undefined;
  const recovered = extra
    ? `Used the one action list found in the reply; ${objects.length - envelopes.length + (envelopes.length - 1)} other JSON object(s) and the surrounding text were ignored.`
    : undefined;
  return {
    ok: true,
    ...(notes !== undefined ? { notes } : {}),
    actions: actions.slice(0, maxBatch),
    dropped: actions.slice(maxBatch),
    ...(recovered ? { recovered } : {}),
  };
}
