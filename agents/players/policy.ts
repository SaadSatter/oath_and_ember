import type { ModelReply, TextGateway } from "./modelGateway.js";
export type PlayerRole = "SIEG" | "COCO";
export interface PlayerView {
  observation_id: string;
  observation: unknown;
  legal_actions: unknown;
}
export interface DecisionRecord {
  role: PlayerRole;
  input: string;
  output: string;
  usage: ModelReply["usage"];
  error?: string;
}
const instruction = `Complete the goddess quest together. Use only your own public observations and delivered partner messages. Return one JSON action envelope with observation_id, action_id, plan and optional message. Plans contain controls {type:"controls",held:[keys],ticks}, press {type:"press",key}, ui {type:"ui",token}, or wait {type:"wait",ticks}. Keys: left,right,up,down,jump,primary,secondary,sprint,slowTime,flight,blackHole,push,interact. Choose only currently legal actions. One message at most 256 characters, at most 64 messages per episode. Never fetch manual links. You have at most 600 model calls, 4 million input tokens and 500000 output tokens. Output no private reasoning.`;
/** One instance per role; no global/shared transcript, repository tools or partner context. */
export class IndependentPlayer {
  private readonly transcript: {
    role: "system" | "user" | "assistant";
    content: string;
  }[];
  private calls = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private unknownUsage = false;
  constructor(
    readonly role: PlayerRole,
    publicManual: string,
    private readonly gateway: TextGateway,
    private readonly record: (record: DecisionRecord) => void = () => {},
  ) {
    this.transcript = [
      {
        role: "system",
        content: `${instruction}\nYour hero: ${role}.\nFrozen public mechanics manual:\n${publicManual}`,
      },
    ];
  }
  async decide(view: PlayerView, signal?: AbortSignal): Promise<unknown> {
    if (
      this.calls >= 600 ||
      this.inputTokens >= 4000000 ||
      this.outputTokens >= 500000 ||
      this.unknownUsage
    )
      throw new Error("model budget exhausted or usage unknown");
    const input = JSON.stringify(view);
    this.transcript.push({ role: "user", content: input });
    // Reserve a conservative UTF-8 byte bound plus provider framing overhead before dispatch.
    const reservedInput =
      new TextEncoder().encode(JSON.stringify(this.transcript)).length + 4096;
    if (
      this.inputTokens + reservedInput > 4000000 ||
      this.outputTokens + 1024 > 500000
    )
      throw new Error("model token reservation exhausted");
    this.calls++;
    const modelInput = JSON.stringify(this.transcript);
    const started = performance.now();
    let reply: ModelReply;
    try {
      reply = await this.gateway.complete(
        structuredClone(this.transcript),
        signal,
      );
    } catch (error) {
      this.unknownUsage = true;
      this.record({
        role: this.role,
        input: modelInput,
        output: "",
        error: "model_request_failed",
        usage: {
          inputTokens: "unknown",
          outputTokens: "unknown",
          cost: "unknown",
          latencyMs: performance.now() - started,
        },
      });
      throw error;
    }
    this.record({
      role: this.role,
      input: modelInput,
      output: reply.text,
      usage: reply.usage,
    });
    if (
      reply.usage.inputTokens === "unknown" ||
      reply.usage.outputTokens === "unknown"
    )
      this.unknownUsage = true;
    else {
      this.inputTokens += reply.usage.inputTokens;
      this.outputTokens += reply.usage.outputTokens;
    }
    this.transcript.push({ role: "assistant", content: reply.text });
    // The authoritative host owns schema/legality validation, never this policy.
    return JSON.parse(reply.text);
  }
}
