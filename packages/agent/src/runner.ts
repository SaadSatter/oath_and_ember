// Trusted episode runner. Starts one independent decision loop per hero
// against a single shared environment. Each loop sees only its own
// observation and legal actions; policies never receive the environment.

import { AgentEnvironment } from "./environment.js";
import type { Policy } from "./policies/policy.js";
import type { TraceWriter } from "./trace.js";
import {
  playerIds,
  type GameOutcome,
  type PlayerId,
  type StepResult,
} from "./types.js";

export interface RunOptions {
  seed: number;
  wallClockMs: number;
  /** Consecutive policy failures (API errors, bad JSON) before giving up. */
  maxConsecutiveFailures?: number;
}

export async function runEpisode(
  env: AgentEnvironment,
  policies: Record<PlayerId, Policy>,
  trace: TraceWriter,
  options: RunOptions,
): Promise<GameOutcome> {
  const reset = await env.reset(options.seed);
  trace.write({ type: "run", tick: reset.tick, data: { policies: { sieg: policies.sieg.name, coco: policies.coco.name }, wallClockMs: options.wallClockMs } });
  const timer = setTimeout(() => env.stop("wall_clock_limit"), options.wallClockMs);
  const loop = async (id: PlayerId) => {
    let last: StepResult | undefined;
    let failures = 0;
    while ((await env.outcome()).status === "ongoing") {
      const observation = await env.observe(id);
      const legal = await env.legal_actions(id);
      trace.write({ type: "observation", tick: observation.tick, player: id, data: { observation, legal } });
      if (!legal.length) break;
      let decision;
      try {
        if (!env.modelBudgetLeft(id)) {
          env.stop("model_call_limit");
          break;
        }
        decision = await policies[id].decide({ observation, legal, ...(last ? { last } : {}) });
      } catch (e) {
        const message = (e as Error).message;
        trace.write({ type: "policy_error", tick: observation.tick, player: id, data: { message } });
        if (message.startsWith("spend_limit")) {
          env.stop("spend_limit");
          break;
        }
        if (++failures >= (options.maxConsecutiveFailures ?? 3)) {
          env.stop("error");
          break;
        }
        continue;
      }
      if (decision.usage) {
        trace.write({ type: "model_call", tick: observation.tick, player: id, data: { usage: decision.usage, raw: decision.raw } });
        env.recordModelCall(id, decision.usage);
        if ((await env.outcome()).status !== "ongoing") break;
      }
      const started = performance.now();
      last = await env.step(id, decision.action);
      failures = last.accepted ? 0 : failures;
      trace.write({ type: "step", tick: observation.tick, player: id, data: { action: decision.action, result: last, waitMs: Math.round(performance.now() - started) } });
      if (last.done) break;
    }
  };
  try {
    await Promise.all(playerIds.map(loop));
  } finally {
    clearTimeout(timer);
  }
  const outcome = await env.outcome();
  trace.write({ type: "outcome", tick: outcome.ticks, data: { outcome, evaluator: env.evaluatorReport() } });
  return outcome;
}
