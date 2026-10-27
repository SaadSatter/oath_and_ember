import type { ActionSpec, GameAction, Observation, StepResult } from "../types.js";
import type { CallRecord, MeteredGateway } from "../budget.js";

export interface Decision {
  action: GameAction;
  /**
   * Up to MAX_BATCH - 1 further actions to run after `action`, each through the
   * ordinary step() and each subject to batchStop() (packages/agent/src/batch.ts).
   */
  then?: GameAction[];
  /** The accounting record of the model call behind this decision, if any. */
  usage?: CallRecord;
  /** The model's raw reply, kept in the evaluator trace only. */
  raw?: string;
}

/**
 * A player's brain. One instance per hero; it receives only that hero's
 * observation, legal actions and last result, and keeps its own memory.
 */
export interface Policy {
  readonly name: string;
  /** Model-driven players expose their metered client so the runner can check its budget. */
  readonly model?: MeteredGateway;
  decide(input: {
    observation: Observation;
    legal: ActionSpec[];
    last?: StepResult;
    /** Every step of the previous batch with its result, and why the batch stopped early (if it did). */
    batch?: { steps: { action: GameAction; result: StepResult }[]; stopped?: string };
  }): Promise<Decision>;
}
