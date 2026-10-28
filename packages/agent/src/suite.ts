// The evaluation suite (docs/midterm/EVALUATION_SUITE.md). Provisional:
// approved by the owner on 2026-10-27, pending the professor's confirmation.
//
// Scenario start states are reached by real play: a prefix of the verified
// scripted route (packages/agent/src/route/) run through the environment's
// own five operations at reset. No fixture, teleport or item injection.

import { AgentEnvironment, type EnvironmentOptions } from "./environment.js";
import type { EpisodePreset } from "./evaluator.js";
import { enterLocalArea } from "./route/localStarts.js";
import { Director } from "./route/director.js";
import { hedgeMaze, mirrorPond, opening, travelFromShrine } from "./route/fullQuest.js";

export type SituationId = "S1" | "S2" | "S3" | "S4" | "F" | "S2-local" | "S3-local";

export interface Situation {
  id: SituationId;
  preset: EpisodePreset;
  /** Held-out cases are never run while prompts or the baseline are tuned. */
  heldOut: boolean;
  title: string;
  /** How the start state is reached (empty: the goddess checkpoint itself). */
  start: string;
  prefix?: EnvironmentOptions["prefix"];
  /**
   * Episode briefing given to both model players for this scenario only, as a
   * separate block after the general prompt (LLMPlayer). Owner-approved; see
   * the change log in docs/midterm/EVALUATION_SUITE.md. Scripted baselines
   * receive no prompt.
   */
  briefing?: string;
}

/**
 * S2 briefing (owner approval 2026-10-28, after pilot-5, where the party took
 * the shrine's way back to Bridge Ruins; revised the same day by the owner to
 * state S2's success condition, the Vanity Mirror). Second revision
 * 2026-10-28, after pilot-6, where both players treated the Hedge Maze's own
 * RETURN exit as forbidden: the owner approved its content (only the shrine's
 * "START / RETURN · E · Puzzle Map 2" sign leads to Bridge Ruins; other areas'
 * RETURN exits lead back to the shrine and are allowed; visiting Hedge Maze is
 * not a failure; the Vanity Mirror stays the objective). The wording below is
 * the implementation agent's draft of that content, pending the owner's final
 * wording. It names signs, areas and the objective item only: no direction,
 * position, mechanism or step. Audits:
 * docs/midterm/agent-evidence/skill-runs/2026-10-28-suite-s2-briefing.md and
 * docs/midterm/agent-evidence/skill-runs/2026-10-28-adapter-pilot6-fixes.md.
 */
export const S2_BRIEFING = [
  "**Episode briefing for this evaluation (S2), the same for both players:**",
  "",
  "- This evaluation episode is Mirror Pond.",
  "- Your objective is to obtain the **Vanity Mirror** and add it to the shared quest inventory. Only the Vanity Mirror completes this episode.",
  '- Bridge Ruins is a puzzle you have already completed. Only the shrine\'s "START / RETURN · E · Puzzle Map 2" sign leads back to it. It is outside the scope of this episode: do not use that sign.',
  "- Every other area's RETURN exit leads back to the shrine. You may use those exits.",
  "- Visiting another area, such as Hedge Maze, is not a failure. You may explore it and complete its objectives before you go on to Mirror Pond, but it does not complete this episode.",
  "- The goddess's offering is the overall quest goal, not your objective in this episode.",
  "- Solve this episode with your normal observations, actions, and messages to your partner.",
].join("\n");

const afterOpening: EnvironmentOptions["prefix"] = {
  name: "opening scene",
  run: async (env) => opening(new Director({ env })),
};
// Local variants compose the existing opening prefix without modifying it.
const localEntry = (area: "Mirror Pond" | "Hedge Maze"): EnvironmentOptions["prefix"] => ({
  name: `opening scene, normal entry to ${area} (before arrival dialogue)`,
  run: async (env) => { await afterOpening!.run(env); await enterLocalArea(env, area); },
});
const localBriefing = (id: "S2-local" | "S3-local", area: string, item: string) =>
  `Episode briefing (${id}), the same for both players: you start at the ${area} entrance. Your objective is to obtain the ${item} in the shared inventory. Normal movement, travel, interaction and messages remain available; you may leave this area and return. Use your own observations and coordinate with your partner.`;

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
  { id: "S2", preset: "S2", heldOut: false, title: "Mirror Pond", start: "shrine, after the opening scene", prefix: afterOpening, briefing: S2_BRIEFING },
  { id: "S3", preset: "S3", heldOut: false, title: "Hedge Maze", start: "shrine, after the opening scene", prefix: afterOpening },
  { id: "S4", preset: "S4", heldOut: true, title: "Griffin, offering and finale", start: "shrine, holding the Vanity Mirror and Enchanted Shears", prefix: withMirrorAndShears },
  { id: "F", preset: "full", heldOut: true, title: "Full episode", start: "goddess checkpoint" },
  { id: "S2-local", preset: "S2-local", heldOut: false, title: "Mirror Pond — local start", start: "Mirror Pond entrance, after the opening and ordinary travel", prefix: localEntry("Mirror Pond"), briefing: localBriefing("S2-local", "Mirror Pond", "Vanity Mirror") },
  { id: "S3-local", preset: "S3-local", heldOut: false, title: "Hedge Maze — local start", start: "Hedge Maze entrance, after the opening and ordinary travel", prefix: localEntry("Hedge Maze"), briefing: localBriefing("S3-local", "Hedge Maze", "Enchanted Shears") },
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
