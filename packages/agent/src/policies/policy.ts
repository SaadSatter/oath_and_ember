import type { ActionSpec, GameAction, Observation, StepResult } from "../types.js";
import type { CallRecord, MeteredGateway } from "../budget.js";

export interface Decision {
  /**
   * The first action to run. Absent only when a model's reply could not be
   * used (`replyProblem` says why): nothing is then submitted to the game.
   */
  action?: GameAction;
  /**
   * Up to MAX_BATCH - 1 further actions to run after `action`, each through the
   * ordinary step() and each subject to batchStop() (packages/agent/src/batch.ts).
   */
  then?: GameAction[];
  /** Actions the reply proposed beyond the player's batch limit; never run. */
  dropped?: GameAction[];
  /** Why a model reply could not be used (no valid action envelope). */
  replyProblem?: string;
  /** How a usable reply was recovered from extra text, if it was. */
  recovered?: string;
  /** The accounting record of the model call behind this decision, if any. */
  usage?: CallRecord;
  /** The model's raw reply, kept in the evaluator trace only. */
  raw?: string;
}

/**
 * What happened to one proposed action that was submitted:
 * - executed: the game accepted and ran it;
 * - rejected: the game refused it (not legal now, or the game said no);
 * - stale: a dialogue press for a line that had already moved on; nothing happened.
 */
export type StepStatus = "executed" | "rejected" | "stale";

export function stepStatus(result: StepResult): StepStatus {
  return result.accepted ? "executed" : result.stale ? "stale" : "rejected";
}

/** The previous decision's fate, step by step (runner.ts builds it). */
export interface TurnReport {
  /**
   * Every submitted action, in order, with its result and status. `after` is
   * the hero's own observation the runner took right after that step, when
   * another action of the batch followed (the same observation the trace
   * records with inBatch). Only the model-memory player reads it.
   */
  steps: { action: GameAction; result: StepResult; status: StepStatus; after?: Observation }[];
  /** Proposed actions that were never submitted, and why. They did not happen. */
  skipped: { action: GameAction; reason: string }[];
  /** Why the batch stopped before its end, if it did. */
  stopped?: string;
  /** The previous reply could not be used, so nothing was submitted. */
  replyProblem?: string;
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
    /** What happened to the previous decision: executed, rejected, stale and skipped actions. */
    batch?: TurnReport;
  }): Promise<Decision>;
}
