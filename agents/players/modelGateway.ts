import {
  CostBudget,
  type CostPolicy,
} from "../../packages/evaluation/src/costBudget.js";
/** Provider adapter only: never receives an environment handle or a file-reading tool. */
export interface ModelUsage {
  inputTokens: number | "unknown";
  outputTokens: number | "unknown";
  cost: number | "unknown";
  latencyMs: number;
}
export interface ModelReply {
  text: string;
  usage: ModelUsage;
}
export interface TextGateway {
  complete(
    messages: readonly {
      role: "system" | "user" | "assistant";
      content: string;
    }[],
    signal?: AbortSignal,
  ): Promise<ModelReply>;
}
export interface GatewayConfig {
  endpoint: string;
  model: string;
  apiKey: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  costPolicy?: CostPolicy;
}
/** Explicit opt-in OpenAI-compatible HTTP transport; no provider is selected by default. */
export class HttpTextGateway implements TextGateway {
  private readonly budget?: CostBudget;
  constructor(private readonly config: GatewayConfig) {
    this.budget = config.costPolicy
      ? new CostBudget(config.costPolicy)
      : undefined;
    const url = new URL(config.endpoint);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1")
      )
    )
      throw new Error("Gateway requires HTTPS");
  }
  async complete(
    messages: Parameters<TextGateway["complete"]>[0],
    signal?: AbortSignal,
  ): Promise<ModelReply> {
    const start = performance.now();
    const reservation = this.budget?.reserve(
      new TextEncoder().encode(JSON.stringify(messages)).length + 4096,
      this.config.maxOutputTokens ?? 1024,
    );
    const responses = new URL(this.config.endpoint).pathname.endsWith(
      "/responses",
    );
    const timeout = AbortSignal.timeout(this.config.timeoutMs ?? 120000);
    const response = await fetch(this.config.endpoint, {
      method: "POST",
      redirect: "error",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        ...(responses
          ? {
              input: messages,
              max_output_tokens: this.config.maxOutputTokens ?? 1024,
            }
          : {
              messages,
              max_completion_tokens: this.config.maxOutputTokens ?? 1024,
            }),
        stream: false,
      }),
    });
    if (!response.ok) throw new Error(`Model HTTP ${response.status}`);
    const body = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
      output?: { content?: { type?: string; text?: string }[] }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        input_tokens?: number;
        output_tokens?: number;
      };
    };
    const text = responses
      ? body.output
          ?.flatMap((x) => x.content ?? [])
          .filter((x) => x.type === "output_text")
          .map((x) => x.text ?? "")
          .join("")
      : body.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.length > 32768)
      throw new Error("Invalid or oversized model output");
    const token = (v: unknown): number | "unknown" =>
      typeof v === "number" && Number.isSafeInteger(v) && v >= 0
        ? v
        : "unknown";
    const inputTokens = token(
      responses ? body.usage?.input_tokens : body.usage?.prompt_tokens,
    );
    const outputTokens = token(
      responses ? body.usage?.output_tokens : body.usage?.completion_tokens,
    );
    const cost =
      reservation && inputTokens !== "unknown" && outputTokens !== "unknown"
        ? reservation.settle(inputTokens, outputTokens)
        : "unknown";
    return {
      text,
      usage: {
        inputTokens,
        outputTokens,
        cost,
        latencyMs: performance.now() - start,
      },
    };
  }
}
