// Trusted episode runner. Starts one independent decision loop per hero
// against a single shared environment. Each loop sees only its own
// observation and legal actions; policies never receive the environment.

import { AgentEnvironment } from "./environment.js";
import type { Policy } from "./policies/policy.js";
import type { TraceWriter } from "./trace.js";
import { BudgetExhausted, ModelCallError, type ModelBudget } from "./budget.js";
import { batchStop, capBatch, MAX_BATCH } from "./batch.js";
import { bindTicket, FinalAccessError, type EpisodeTicket } from "./finalAccess.js";
import { policyKind } from "./policies/kind.js";
import { stepStatus, type TurnReport } from "./policies/policy.js";
import {
  playerIds,
  type GameOutcome,
  type PlayerId,
  type StepResult,
} from "./types.js";

export interface RunOptions {
  seed: number;
  /** Trusted cancellation only; never passed to a player. */
  signal?: AbortSignal;
  /** Real-world time limit for the whole episode, separate from the game-time tick limit. */
  wallClockMs: number;
  /** Consecutive policy failures (API errors, timeouts, bad JSON) before giving up. */
  maxConsecutiveFailures?: number;
  /**
   * The episode's model budget. Required whenever a policy calls a model; every
   * model-driven policy must be metered by this same budget.
   */
  budget?: ModelBudget;
  /**
   * Required for held-out scenarios (S4, F) and final seeds: the single-use
   * ticket from FinalGrant.claim() for this episode (finalAccess.ts, H2). It
   * must name the player kind of `policies`; the environment's reset uses it up.
   */
  finalTicket?: EpisodeTicket;
}

export async function runEpisode(
  env: AgentEnvironment,
  policies: Record<PlayerId, Policy>,
  trace: TraceWriter,
  options: RunOptions,
): Promise<GameOutcome> {
  if (!Number.isFinite(options.wallClockMs) || !(options.wallClockMs > 0)) throw Error("wallClockMs must be positive.");
  // Held-out gate (H2). Route development access never runs players. A final
  // ticket is bound to these policies' kind here; AgentEnvironment.reset()
  // then admits (and uses up) it, or refuses before anything is played.
  if (env.routeDevelopment()) throw new FinalAccessError("A route development environment cannot run players or produce evaluation results.");
  if (options.finalTicket !== undefined) {
    bindTicket(options.finalTicket, policyKind(policies));
    env.authorize(options.finalTicket);
  }
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
  if (budget) {
    budget.onStart = (s) => trace.write({ type: "model_call_start", tick: env.currentTick(), player: s.player, data: s });
    budget.onRecord = (r) =>
      trace.write({ type: "model_call", tick: env.currentTick(), player: r.player, data: r });
  }
  trace.write({
    type: "run",
    tick: reset.tick,
    data: {
      policies: { sieg: policies.sieg.name, coco: policies.coco.name },
      wallClockMs: options.wallClockMs,
      ...(budget ? { modelLimits: budget.limits } : {}),
    },
  });
  const abort = () => { env.stop("manual_stop"); budget?.abortAll(); };
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(() => {
    env.stop("wall_clock_limit");
    budget?.abortAll();
  }, options.wallClockMs);
  const loop = async (id: PlayerId) => {
    let last: StepResult | undefined;
    let turn: TurnReport | undefined;
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
        decision = await policies[id].decide({ observation, legal, ...(last ? { last } : {}), ...(turn ? { batch: turn } : {}) });
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
      const proposed = decision.action ? [decision.action, ...(decision.then ?? [])] : [];
      if (decision.raw !== undefined)
        trace.write({
          type: "model_reply",
          tick: observation.tick,
          player: id,
          data: {
            attempt: decision.usage?.attempt,
            raw: decision.raw,
            envelope: proposed.length ? "ok" : "rejected",
            proposed: proposed.length + (decision.dropped?.length ?? 0),
            ...(decision.replyProblem ? { problem: decision.replyProblem } : {}),
            ...(decision.recovered ? { recovered: decision.recovered } : {}),
            ...(decision.usage?.meta ? { meta: decision.usage.meta } : {}),
          },
        });
      if ((await env.outcome()).status !== "ongoing") break;
      if (!proposed.length) {
        // An unusable reply is not turned into an action: nothing reaches the
        // game, and the player is told next turn. Model players are bounded by
        // their call budget; a scripted policy that returns nothing is a bug.
        const problem = decision.replyProblem ?? "The policy returned no action.";
        trace.write({ type: "reply_rejected", tick: observation.tick, player: id, data: { attempt: decision.usage?.attempt ?? null, problem } });
        turn = { steps: [], skipped: [], replyProblem: problem };
        last = undefined;
        if (!policies[id].model && ++failures >= (options.maxConsecutiveFailures ?? 3)) {
          env.stop("error");
          break;
        }
        continue;
      }
      // Run the decision's actions in order; a single action is a batch of one.
      const queue = capBatch(proposed);
      const overLimit = [...proposed.slice(queue.length), ...(decision.dropped ?? [])];
      const report: TurnReport = { steps: [], skipped: [] };
      turn = report;
      let before = observation;
      for (let k = 0; k < queue.length; k++) {
        const action = queue[k];
        const started = performance.now();
        last = await env.step(id, action);
        // As in PR #7: an accepted step resets the count; invalid actions are
        // counted by the environment and do not end the episode by themselves.
        failures = last.accepted ? 0 : failures;
        const status = stepStatus(last);
        trace.write({ type: "step", tick: before.tick, player: id, data: { action, result: last, status, waitMs: Math.round(performance.now() - started), ...(queue.length > 1 ? { batch: { index: k, size: queue.length } } : {}) } });
        report.steps.push({ action, result: last, status });
        if (last.done) break;
        if (k === queue.length - 1) break;
        const after = await env.observe(id);
        const stop = batchStop(before, last, after);
        if (stop) {
          report.stopped = stop;
          trace.write({ type: "batch_stop", tick: after.tick, player: id, data: { reason: stop, ran: k + 1, of: queue.length } });
          break;
        }
        trace.write({ type: "observation", tick: after.tick, player: id, data: { observation: after, legal: await env.legal_actions(id), inBatch: true } });
        before = after;
      }
      // Proposed but never submitted: recorded as skipped, never as done.
      const notRun = queue.slice(report.steps.length);
      const why = report.stopped ?? (last?.done ? "episode over" : "batch ended");
      report.skipped = [
        ...notRun.map((action) => ({ action, reason: why })),
        ...overLimit.map((action) => ({ action, reason: `over the ${MAX_BATCH}-action limit per turn` })),
      ];
      if (report.skipped.length) trace.write({ type: "skipped_actions", tick: env.currentTick(), player: id, data: { skipped: report.skipped } });
      if (last?.done) break;
    }
  };
  const loops = playerIds.map(loop);
  try {
    await Promise.all(loops);
  } catch (e) {
    env.stop("error");
    budget?.abortAll();
    await Promise.allSettled(loops);
    throw e;
  } finally {
    options.signal?.removeEventListener("abort", abort);
    clearTimeout(timer);
    budget?.abortAll();
  }
  const outcome = await env.outcome();
  trace.write({ type: "outcome", tick: outcome.ticks, data: { outcome, evaluator: env.evaluatorReport() } });
  return outcome;
}
