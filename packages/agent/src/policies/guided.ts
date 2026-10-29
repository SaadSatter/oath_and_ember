// Instruction-guided model player (opt-in, --player model-guided). Composes the
// existing LLM player without changing LLMPlayer, its memory, prompts or parser:
// a static, scenario-specific walkthrough is appended to every system request.
// Owner-approved walkthroughs: Hedge Maze for S2-local (2026-10-29) and Mirror
// Pond for S3-local (2026-10-29). Each carries its own ID in labels and names.
import type { Gateway, CompletionOptions } from "../budget.js";
import { MeteredGateway, type ModelBudget } from "../budget.js";
import type { PlayerId } from "../types.js";
import type { Policy } from "./policy.js";
import { LLMPlayer } from "./llm.js";
import { GUIDED_MAZE_ID, guidedMazeInstructions } from "./guidedMazeInstructions.js";
import { GUIDED_POND_ID, guidedPondInstructions } from "./guidedPondInstructions.js";

/** A static walkthrough: an ID for labels and the role-specific system text. */
export interface Guide {
  id: string;
  instructions(hero: "Sieg" | "Coco"): string;
}
export const MAZE_WALKTHROUGH: Guide = Object.freeze({ id: GUIDED_MAZE_ID, instructions: guidedMazeInstructions });
export const POND_WALKTHROUGH: Guide = Object.freeze({ id: GUIDED_POND_ID, instructions: guidedPondInstructions });
/** Which walkthrough each approved scenario uses. Nothing else may run guided. */
export const GUIDES: Readonly<Record<string, Guide>> = Object.freeze({ "S2-local": MAZE_WALKTHROUGH, "S3-local": POND_WALKTHROUGH });
export const GUIDED_SITUATIONS = Object.freeze(Object.keys(GUIDES));

/** The exact augmented prompt is priced before the normal ledger authorization. */
class GuidedGateway implements Gateway {
  readonly label: string;
  private readonly instructions: string;
  constructor(private readonly inner: Gateway, hero: "Sieg" | "Coco", guide: Guide) {
    this.label = `${inner.label}·guided-${guide.id}`;
    this.instructions = guide.instructions(hero);
  }
  worstCaseUsd(system: string, user: string, options?: CompletionOptions) {
    return this.inner.worstCaseUsd(system + this.instructions, user, options);
  }
  complete(system: string, user: string, signal: AbortSignal, options?: CompletionOptions) {
    return this.inner.complete(system + this.instructions, user, signal, options);
  }
}
export class GuidedPlayer implements Policy {
  readonly name: string;
  readonly model: MeteredGateway;
  private readonly player: LLMPlayer;
  constructor(hero: "Sieg" | "Coco", pid: PlayerId, gateway: Gateway, budget: ModelBudget, manual: string, maxBatch?: number, briefing?: string, tutorial?: string, guide: Guide = MAZE_WALKTHROUGH) {
    if ((hero === "Sieg") !== (pid === "sieg")) throw Error("Guided hero/meter identity mismatch.");
    this.model = new MeteredGateway(new GuidedGateway(gateway, hero, guide), budget, pid);
    this.player = new LLMPlayer(hero, manual, this.model, maxBatch, "history", briefing, tutorial);
    this.name = `model-guided:${this.player.name}·walkthrough-${guide.id}`;
  }
  decide(input: Parameters<Policy["decide"]>[0]) {
    // No decision, navigation, checkpoint evaluation or World access here.
    return this.player.decide(input);
  }
}
