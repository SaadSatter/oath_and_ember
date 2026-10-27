// Trusted episode runner. Starts one independent decision loop per hero
// against a single shared environment. Each loop sees only its own
// observation and legal actions; policies never receive the environment.

import { AgentEnvironment } from "./environment.js";
import type { Policy } from "./policies/policy.js";
import type { TraceWriter } from "./trace.js";
import { BudgetExhausted, ModelCallError, type ModelBudget } from "./budget.js";
import {
  playerIds,
  type GameOutcome,
  type PlayerId,
  type StepResult,
} from "./types.js";

export interface RunOptions {
  seed: number;
  /** Real-world time limit for the whole episode, separate from the game-time tick limit. */
  wallClockMs: number;
  /** Consecutive policy failures (API errors, timeouts, bad JSON) before giving up. */
  maxConsecutiveFailures?: number;
  /**
   * The episode's model budget. Required whenever a policy calls a model; every
   * model-driven policy must be metered by this same budget.
   */
  budget?: ModelBudget;
}

export async function runEpisode(
  env: AgentEnvironment,
  policies: Record<PlayerId, Policy>,
  trace: TraceWriter,
  options: RunOptions,
): Promise<GameOutcome> {
  if (!(options.wallClockMs > 0)) throw Error("wallClockMs must be positive.");
  for (const id of playerIds) {
    const model = policies[id].model;
    if (!model) continue;
    if (!options.budget || model.budget !== options.budget)
      throw Error(`${id}'s model is not metered by this episode's budget.`);
    if (model.player !== id) throw Error(`${id}'s model is metered as ${model.player}.`);
  }
  const budget = options.budget;
  env.attachBudget(budget);
  const reset = await env.reset(options.seed);
  if (budget)
    budget.onRecord = (r) =>
      trace.write({ type: "model_call", tick: env.currentTick(), player: r.player, data: r });
  trace.write({
    type: "run",
    tick: reset.tick,
    data: {
      policies: { sieg: policies.sieg.name, coco: policies.coco.name },
      wallClockMs: options.wallClockMs,
      ...(budget ? { modelLimits: budget.limits } : {}),
    },
  });
  const timer = setTimeout(() => {
    env.stop("wall_clock_limit");
    budget?.abortAll();
  }, options.wallClockMs);
  const loop = async (id: PlayerId) => {
    let last: StepResult | undefined;
    let failures = 0;
    while ((await env.outcome()).status === "ongoing") {
      const observation = await env.observe(id);
      const legal = await env.legal_actions(id);
      trace.write({ type: "observation", tick: observation.tick, player: id, data: { observation, legal } });
      if (!legal.length) break;
      if (policies[id].model && budget) {
        const reason = budget.exhausted(id);
        if (reason) {
          env.stop(reason);
          break;
        }
      }
      let decision;
      try {
        decision = await policies[id].decide({ observation, legal, ...(last ? { last } : {}) });
      } catch (e) {
        if (e instanceof BudgetExhausted) {
          trace.write({ type: "policy_error", tick: observation.tick, player: id, data: { kind: "budget", reason: e.reason, message: e.message } });
          env.stop(e.reason);
          break;
        }
        const kind = e instanceof ModelCallError ? e.status : "policy";
        trace.write({ type: "policy_error", tick: observation.tick, player: id, data: { kind, message: (e as Error).message } });
        if ((await env.outcome()).status !== "ongoing") break;
        if (++failures >= (options.maxConsecutiveFailures ?? 3)) {
          env.stop("error");
          break;
        }
        continue;
      }
      if (decision.raw !== undefined)
        trace.write({ type: "model_reply", tick: observation.tick, player: id, data: { attempt: decision.usage?.attempt, raw: decision.raw } });
      if ((await env.outcome()).status !== "ongoing") break;
      const started = performance.now();
      last = await env.step(id, decision.action);
      // As in PR #7: an accepted step resets the count; invalid actions are
      // counted by the environment and do not end the episode by themselves.
      failures = last.accepted ? 0 : failures;
      trace.write({ type: "step", tick: observation.tick, player: id, data: { action: decision.action, result: last, waitMs: Math.round(performance.now() - started) } });
      if (last.done) break;
    }
  };
  try {
    await Promise.all(playerIds.map(loop));
  } finally {
    clearTimeout(timer);
    budget?.abortAll();
  }
  const outcome = await env.outcome();
  trace.write({ type: "outcome", tick: outcome.ticks, data: { outcome, evaluator: env.evaluatorReport() } });
  return outcome;
}
