// Action batching (owner decision 2026-10-27): a player may answer one
// decision with up to MAX_BATCH actions. The runner submits them one at a time
// through the ordinary step(), observing the hero between them, and stops the
// batch at the first sign that the player should look again. Nothing here
// changes the five operations, the observations, validation or game rules.

import type { GameAction, Observation, StepResult } from "./types.js";

export const MAX_BATCH = 4;

/**
 * Why a batch must stop after `result`, given the hero's observation before
 * that step and after it; undefined to continue with the next queued action.
 *
 * Stops on: an invalid action; the episode ending; an interruption the
 * environment reports (area change, a new dialogue line, damage); any
 * feedback (something happened); dialogue on screen; a change of area, HP,
 * backpack or journal; or a new message from the partner.
 */
export function batchStop(before: Observation, result: StepResult, after: Observation): string | undefined {
  if (!result.accepted) return "invalid action";
  if (result.done) return "episode over";
  if (result.interrupted) return `interrupted: ${result.interrupted}`;
  if (result.feedback.length) return "feedback";
  if (after.dialogue) return "dialogue on screen";
  if (after.area.name !== before.area.name) return "area changed";
  if (after.self.hp !== before.self.hp) return "health changed";
  const bag = (o: Observation) => JSON.stringify(o.inventory.items.map((i) => [i.id, i.count]));
  if (bag(after) !== bag(before)) return "backpack changed";
  if (JSON.stringify(after.journal) !== JSON.stringify(before.journal)) return "journal changed";
  if (after.messages.length !== before.messages.length || JSON.stringify(after.messages.at(-1)) !== JSON.stringify(before.messages.at(-1)))
    return "message received";
  return undefined;
}

/** Keep at most MAX_BATCH actions from a policy's answer. */
export function capBatch(actions: GameAction[]): GameAction[] {
  return actions.slice(0, MAX_BATCH);
}
