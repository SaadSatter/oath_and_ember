// OpenAI alternative for the canonical metered runner. No SDK, tools, retries,
// server-side conversation history, endpoint overrides or model substitution.
import {
  paidTransport,
  assertPaidTransport,
  ModelCallError,
  type Completion,
  type CompletionOptions,
  type Gateway,
  type ReplyMeta,
} from "../budget.js";
import type { Prices, Effort } from "./llm.js";
import { actionFields, actionTypes } from "../types.js";

export const OPENAI_PRICING_SOURCE =
  "https://developers.openai.com/api/docs/models/gpt-6-luna (verified 2026-10-28); https://developers.openai.com/api/docs/pricing; https://developers.openai.com/api/docs/guides/prompt-caching";
export const OPENAI_MODELS: Readonly<Record<string, readonly Effort[]>> =
  Object.freeze({ "gpt-6-luna": Object.freeze(["low", "medium"] as Effort[]) });
export const openaiPrices: Readonly<Record<string, Prices>> = Object.freeze({
  "gpt-6-luna": Object.freeze({
    inputPerM: 0.1,
    outputPerM: 0.5,
    cacheRead: 0.1,
    cacheWrite: 1.25,
    longContextOver: 272_000,
    longContext: Object.freeze({ inputPerM: 0.2, outputPerM: 0.75 }),
    source: OPENAI_PRICING_SOURCE,
  }),
});
// Verified cache guide: Responses API GPT-5.6+ ttl "30m" is a minimum lifetime,
// writes cost 1.25x (not a surcharge); reads and writes are included in input.
export const OPENAI_CACHE_TTL = "30m";
// Conservative project estimate includes the documented 10% regional/FedRAMP
// premium even on the fixed global endpoint. Not a claim about an invoice.
export const OPENAI_PREMIUM = 1.1;
// Output cap, reasoning included. Lowered from 4000 (owner approval
// 2026-10-28): in the S2 seed 0 run the largest complete reply used 1,247
// output tokens (1,155 of them reasoning), while 24 replies ran away into
// whitespace until the cap. 2000 keeps about 60% headroom over that maximum
// and halves the cost and latency of a runaway. It also lowers each call's
// worst-case reservation, which is derived from this cap.
export const OPENAI_MAX_OUTPUT = 2000;
const MAX_OUTPUT = OPENAI_MAX_OUTPUT;
export function assertOpenAIModel(model: string, effort: string) {
  if (
    !Object.hasOwn(OPENAI_MODELS, model) ||
    !OPENAI_MODELS[model].includes(effort as Effort)
  )
    throw Error(`OpenAI model/effort ${model}@${effort} is not approved.`);
}
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const count = (x: unknown): x is number =>
  typeof x === "number" && Number.isSafeInteger(x) && x >= 0;

/** OpenAI strict mode requires every property, with null for optional fields. */
export function openaiSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  function convert(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(convert);
    if (!object(v)) return v;
    const out = Object.fromEntries(
      Object.entries(v).map(([k, value]) => [k, convert(value)]),
    );
    if (v.type === "object" && object(v.properties)) {
      const required = Array.isArray(v.required) ? v.required : [];
      out.properties = Object.fromEntries(
        Object.entries(v.properties).map(([k, value]) => [
          k,
          required.includes(k)
            ? convert(value)
            : { anyOf: [convert(value), { type: "null" }] },
        ]),
      );
      out.required = Object.keys(v.properties);
      out.additionalProperties = false;
    }
    return out;
  }
  return convert(schema) as Record<string, unknown>;
}
/**
 * Strict mode makes every property of an object required (null when unused),
 * so with one shared action object the model had to fill "ticks" on an attack
 * and often put a number there, which validate() then refused (S2 seed 0
 * OpenAI run: 79 of 81 invalid actions). Here the action object is split into
 * one object per action type that lists only that type's fields
 * (actionFields). Field schemas are copied from the public schema unchanged;
 * the action set, legality and validation are untouched.
 */
export function splitActionTypes(schema: Record<string, unknown>): Record<string, unknown> {
  const isActionObject = (v: Record<string, unknown>) => {
    const props = object(v.properties) ? v.properties : undefined;
    const type = props && object(props.type) ? props.type : undefined;
    return v.type === "object" && Array.isArray(type?.enum) && JSON.stringify(type.enum) === JSON.stringify(actionTypes);
  };
  function walk(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(walk);
    if (!object(v)) return v;
    if (isActionObject(v)) {
      const props = v.properties as Record<string, unknown>;
      return {
        anyOf: actionTypes.map((t) => {
          const fields = actionFields[t];
          return {
            type: "object",
            properties: {
              type: { type: "string", enum: [t] },
              ...Object.fromEntries(Object.keys(fields).map((k) => [k, props[k]])),
            },
            required: ["type", ...Object.keys(fields).filter((k) => fields[k] === "required")],
            additionalProperties: false,
          };
        }),
      };
    }
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
  }
  return walk(schema) as Record<string, unknown>;
}
/** Only the documented nullable optional fields are removed; no action is repaired. */
function normalize(text: string) {
  try {
    const v: unknown = JSON.parse(text);
    if (!object(v)) return text;
    if (v.notes === null) delete v.notes;
    const actions = Array.isArray(v.actions) ? v.actions : [v.action];
    for (const a of actions)
      if (object(a))
        for (const k of [
          "direction",
          "ticks",
          "ability",
          "item",
          "option",
          "text",
        ])
          if (a[k] === null) delete a[k];
    return JSON.stringify(v);
  } catch {
    return text;
  }
}
export function openaiCost(u: {
  input: number;
  output: number;
  read: number;
  write: number;
}) {
  const p = openaiPrices["gpt-6-luna"];
  const tier = u.input > p.longContextOver! ? p.longContext! : p;
  return (
    (((u.input -
      u.read -
      u.write +
      u.read * p.cacheRead! +
      u.write * p.cacheWrite!) *
      tier.inputPerM +
      u.output * tier.outputPerM) /
      1e6) *
    OPENAI_PREMIUM
  );
}

export class OpenAIGateway implements Gateway {
  readonly label: string;
  constructor(
    readonly model: string,
    // Kept for the disabled legacy helper's compile compatibility. Unverified
    // caller-supplied prices are refused, never used for paid accounting.
    prices: Prices = openaiPrices[model],
    private readonly apiKey = process.env.OPENAI_API_KEY,
    readonly effort: Effort = "medium",
  ) {
    assertOpenAIModel(model, effort);
    if (!apiKey?.trim()) throw Error("OPENAI_API_KEY is not set.");
    if (JSON.stringify(prices) !== JSON.stringify(openaiPrices[model]))
      throw Error("OpenAI requires the verified model price registry.");
    this.label = `openai:${model}@${effort}`;
  }
  private request(system: string, user: string, options?: CompletionOptions) {
    if (!options?.schema)
      throw Error("OpenAI requires the public structured action schema.");
    return {
      model: this.model,
      instructions: system,
      input: [{ role: "user", content: user }],
      store: false,
      service_tier: "default",
      reasoning: { effort: this.effort },
      max_output_tokens: MAX_OUTPUT,
      prompt_cache_options: { mode: "implicit", ttl: OPENAI_CACHE_TTL },
      text: {
        format: {
          type: "json_schema",
          name: "agent_actions",
          strict: true,
          schema: openaiSchema(splitActionTypes(options.schema)),
        },
      },
    };
  }
  worstCaseUsd(system: string, user: string, options?: CompletionOptions) {
    // Full serialized request, schema and framing; assume every byte is an
    // input token and every input token a write. Includes tier and premium.
    const input =
      Buffer.byteLength(
        JSON.stringify(this.request(system, user, options)),
        "utf8",
      ) + 4096;
    return openaiCost({ input, output: MAX_OUTPUT, read: 0, write: input });
  }
  async complete(
    system: string,
    user: string,
    signal: AbortSignal,
    options?: CompletionOptions,
  ): Promise<Completion> {
    const body = JSON.stringify(this.request(system, user, options));

    let response: Response;
    try {
      response = await paidTransport(signal, () => {
        assertPaidTransport();
        return fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          redirect: "error",
          signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.apiKey}`,
          },
          body,
        });
      });
    } catch (error) {
      if (error instanceof ModelCallError) throw error;
      throw new ModelCallError(
        signal.aborted ? "aborted" : "error",
        signal.aborted ? "OpenAI request aborted." : "OpenAI transport failed.",
      );
    }
    if (!response.ok)
      throw new ModelCallError("error", `openai_http_${response.status}`);
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new ModelCallError("error", "OpenAI response was not JSON.");
    }
    if (!object(value))
      throw new ModelCallError("error", "OpenAI response was not an object.");
    const u = object(value.usage) ? value.usage : {};
    const details = object(u.input_tokens_details)
      ? u.input_tokens_details
      : {};
    const outputDetails = object(u.output_tokens_details)
      ? u.output_tokens_details
      : {};
    const valid =
      count(u.input_tokens) &&
      count(u.output_tokens) &&
      count(details.cached_tokens) &&
      count(details.cache_write_tokens) &&
      details.cached_tokens + details.cache_write_tokens <= u.input_tokens &&
      (outputDetails.reasoning_tokens === undefined ||
        (count(outputDetails.reasoning_tokens) &&
          outputDetails.reasoning_tokens <= u.output_tokens));
    const tokens = valid
      ? { input: u.input_tokens as number, output: u.output_tokens as number }
      : null;
    const cache = valid
      ? {
          read: details.cached_tokens as number,
          write: details.cache_write_tokens as number,
        }
      : undefined;
    const modelMatches = value.model === this.model;
    const tierMatches = value.service_tier === "default";
    // Unknown model/tier/usage cannot create a cheap or NaN settlement.
    const costUsd =
      tokens && cache && modelMatches && tierMatches
        ? openaiCost({ ...tokens, ...cache })
        : null;
    const blocks: ReplyMeta["blocks"] = [];
    const texts: string[] = [];
    let refused = false;
    if (Array.isArray(value.output))
      for (const item of value.output) {
        if (!object(item)) continue;
        if (item.type === "message" && Array.isArray(item.content))
          for (const c of item.content) {
            if (!object(c)) continue;
            if (c.type === "output_text" && typeof c.text === "string") {
              texts.push(c.text);
              blocks.push({ type: "text", chars: c.text.length });
            } else if (c.type === "refusal") {
              refused = true;
              blocks.push({ type: "refusal", chars: 0 });
            }
          }
        else
          blocks.push({
            type: typeof item.type === "string" ? item.type : "unknown",
            chars: 0,
          });
      }
    const incomplete = object(value.incomplete_details)
      ? value.incomplete_details.reason
      : undefined;
    const meta: ReplyMeta = {
      provider: "openai",
      requestedModel: this.model,
      effort: this.effort,
      stopReason: refused
        ? "refusal"
        : value.status === "incomplete" && incomplete === "max_output_tokens"
          ? "max_tokens"
          : value.status === "completed"
            ? "end_turn"
            : "error",
      blocks,
      structured: true,
      serviceTier:
        typeof value.service_tier === "string" ? value.service_tier : "unknown",
      cacheTtl: OPENAI_CACHE_TTL,
      pricingPremium: OPENAI_PREMIUM,
      ...(count(outputDetails.reasoning_tokens)
        ? { reasoningTokens: outputDetails.reasoning_tokens }
        : {}),
    };
    const partial = {
      tokens,
      costUsd,
      ...(cache ? { cache } : {}),
      ...(typeof value.model === "string" ? { model: value.model } : {}),
      meta,
    };
    if (!modelMatches || !tierMatches)
      throw new ModelCallError(
        "error",
        "OpenAI returned an unapproved model or processing tier.",
        partial,
      );
    if (refused) throw new ModelCallError("refusal", "model_refusal", partial);
    if (meta.stopReason === "error")
      throw new ModelCallError(
        "error",
        "OpenAI returned an unusable completion status.",
        partial,
      );
    const text = texts.join("");
    return { ...partial, text: normalize(text), rawText: text };
  }
}
