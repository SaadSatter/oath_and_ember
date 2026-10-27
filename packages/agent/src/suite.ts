// The evaluation suite (docs/midterm/EVALUATION_SUITE.md). Provisional:
// approved by the owner on 2026-10-27, pending the professor's confirmation.
//
// Scenario start states are reached by real play: a prefix of the verified
// scripted route (packages/agent/src/route/) run through the environment's
// own five operations at reset. No fixture, teleport or item injection.

import { AgentEnvironment, type EnvironmentOptions } from "./environment.js";
import type { EpisodePreset } from "./evaluator.js";
import { Director } from "./route/director.js";
import { hedgeMaze, mirrorPond, opening, travelFromShrine } from "./route/fullQuest.js";

export type SituationId = "S1" | "S2" | "S3" | "S4" | "F";

export interface Situation {
  id: SituationId;
  preset: EpisodePreset;
  /** Held-out cases are never run while prompts or the baseline are tuned. */
  heldOut: boolean;
  title: string;
  /** How the start state is reached (empty: the goddess checkpoint itself). */
  start: string;
  prefix?: EnvironmentOptions["prefix"];
}

const afterOpening: EnvironmentOptions["prefix"] = {
  name: "opening scene",
  run: async (env) => opening(new Director({ env })),
};
const withMirrorAndShears: EnvironmentOptions["prefix"] = {
  name: "opening scene, Hedge Maze, Mirror Pond",
  run: async (env) => {
    const d = new Director({ env });
    await opening(d);
    await travelFromShrine(d, "east", "Hedge Maze");
    await hedgeMaze(d);
    await travelFromShrine(d, "west", "Mirror Pond");
    await mirrorPond(d);
  },
};

export const SITUATIONS: readonly Situation[] = Object.freeze([
  { id: "S1", preset: "S1", heldOut: false, title: "Opening and departure", start: "goddess checkpoint" },
  { id: "S2", preset: "S2", heldOut: false, title: "Mirror Pond", start: "shrine, after the opening scene", prefix: afterOpening },
  { id: "S3", preset: "S3", heldOut: false, title: "Hedge Maze", start: "shrine, after the opening scene", prefix: afterOpening },
  { id: "S4", preset: "S4", heldOut: true, title: "Griffin, offering and finale", start: "shrine, holding the Vanity Mirror and Enchanted Shears", prefix: withMirrorAndShears },
  { id: "F", preset: "full", heldOut: true, title: "Full episode", start: "goddess checkpoint" },
]);

/**
 * Seeds. The game has no randomness; a seed fixes the room code and the
 * evaluation ids (runtime.ts), and the scripted route behaves identically for
 * seeds 1-8. Different seeds are therefore reported as reproducibility trials,
 * not as different game situations.
 */
export const SEEDS = Object.freeze({ tuning: [0, 1], final: [100, 101] });

export function situation(id: SituationId): Situation {
  const s = SITUATIONS.find((x) => x.id === id);
  if (!s) throw Error(`Unknown situation ${id}`);
  return s;
}

/** An environment that starts at this situation on every reset. */
export function environmentFor(id: SituationId, options: Omit<EnvironmentOptions, "preset" | "prefix"> = {}) {
  const s = situation(id);
  return new AgentEnvironment({ ...options, preset: s.preset, ...(s.prefix ? { prefix: s.prefix } : {}) });
}
