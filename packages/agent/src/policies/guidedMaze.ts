// Opt-in composition: no change to LLMPlayer, its memory, prompts or parser.
import type { Gateway, CompletionOptions } from "../budget.js";
import { MeteredGateway, type ModelBudget } from "../budget.js";
import type { PlayerId } from "../types.js";
import type { Policy } from "./policy.js";
import { LLMPlayer } from "./llm.js";
import { GUIDED_MAZE_ID, guidedMazeInstructions } from "./guidedMazeInstructions.js";

/** The exact augmented prompt is priced before the normal ledger authorization. */
class GuidedGateway implements Gateway {
  readonly label: string;
  private readonly instructions: string;
  constructor(private readonly inner: Gateway, hero: "Sieg" | "Coco") {
    this.label = `${inner.label}·guided-${GUIDED_MAZE_ID}`;
    this.instructions = guidedMazeInstructions(hero);
  }
  worstCaseUsd(system: string, user: string, options?: CompletionOptions) {
    return this.inner.worstCaseUsd(system + this.instructions, user, options);
  }
  complete(system: string, user: string, signal: AbortSignal, options?: CompletionOptions) {
    return this.inner.complete(system + this.instructions, user, signal, options);
  }
}
export class GuidedMazePlayer implements Policy {
  readonly name: string;
  readonly model: MeteredGateway;
  private readonly player: LLMPlayer;
  constructor(hero: "Sieg" | "Coco", pid: PlayerId, gateway: Gateway, budget: ModelBudget, manual: string, maxBatch?: number, briefing?: string, tutorial?: string) {
    if ((hero === "Sieg") !== (pid === "sieg")) throw Error("Guided hero/meter identity mismatch.");
    this.model = new MeteredGateway(new GuidedGateway(gateway, hero), budget, pid);
    this.player = new LLMPlayer(hero, manual, this.model, maxBatch, "history", briefing, tutorial);
    this.name = `model-guided:${this.player.name}·walkthrough-${GUIDED_MAZE_ID}`;
  }
  decide(input: Parameters<Policy["decide"]>[0]) {
    // No decision, navigation, checkpoint evaluation or World access here.
    return this.player.decide(input);
  }
}
