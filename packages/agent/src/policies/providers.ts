// Trusted launcher configuration only; never given to a game-playing policy.
import {
  AnthropicGateway,
  anthropicPrices,
  assertApprovedModel,
  SMOKE_CONFIG,
  type Effort,
} from "./llm.js";
import { OpenAIGateway, assertOpenAIModel, openaiPrices } from "./openai.js";
import type { Gateway } from "../budget.js";
export function providerConfig(
  provider: string,
  requested: string | undefined,
  effort: string,
  smoke = false,
) {
  if (provider !== "anthropic" && provider !== "openai")
    throw Error("--gateway must be anthropic or openai.");
  const model =
    requested ?? (provider === "anthropic" ? "claude-haiku-5-5" : "");
  if (!model)
    throw Error("--model is required for OpenAI; no model is substituted.");
  if (provider === "anthropic") {
    assertApprovedModel(model, effort);
    if (
      smoke &&
      (model !== SMOKE_CONFIG.model || effort !== SMOKE_CONFIG.effort)
    )
      throw Error(
        `The smoke call is approved for ${SMOKE_CONFIG.model} at ${SMOKE_CONFIG.effort} only.`,
      );
  } else {
    assertOpenAIModel(model, effort);
    if (smoke && effort !== "medium")
      throw Error(
        "The OpenAI smoke configuration is gpt-6-luna at medium only.",
      );
  }
  const prices =
    provider === "anthropic" ? anthropicPrices[model] : openaiPrices[model];
  return {
    provider,
    model,
    effort: effort as Effort,
    keyName: provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY",
    source: prices.source,
    create: (key: string): Gateway =>
      provider === "anthropic"
        ? new AnthropicGateway(model, prices, effort as Effort, key)
        : new OpenAIGateway(model, prices, key, effort as Effort),
  };
}
