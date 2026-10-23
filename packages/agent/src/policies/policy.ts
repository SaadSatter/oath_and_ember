import type { ActionSpec, GameAction, Observation, StepResult } from "../types.js";

export interface ModelUsage {
  input: number;
  output: number;
  latencyMs: number;
  costUsd: number;
}

export interface Decision {
  action: GameAction;
  /** Present when a model was called for this decision. */
  usage?: ModelUsage;
  /** The model's raw reply, kept in the evaluator trace only. */
  raw?: string;
}

/**
 * A player's brain. One instance per hero; it receives only that hero's
 * observation, legal actions and last result, and keeps its own memory.
 */
export interface Policy {
  readonly name: string;
  decide(input: { observation: Observation; legal: ActionSpec[]; last?: StepResult }): Promise<Decision>;
}
