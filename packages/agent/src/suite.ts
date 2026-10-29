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
import { TUTORIAL_BRIEFING } from "./playerKnowledge.js";

/**
 * Suite revision. Revision 2 (owner request, 2026-10-28) swapped S2 and S3:
 * S2 is now Hedge Maze (Enchanted Shears) and S3 Mirror Pond (Vanity Mirror),
 * likewise S2-local and S3-local, and their model players receive the
 * tutorial-completion briefing. Revision 1 definitions are kept unchanged as
 * S2-v1, S3-v1, S2-local-v1 and S3-local-v1 (HISTORICAL_SITUATIONS). Records
 * written before revision 2 carry no suiteRevision field and use revision 1
 * ids: read them with historicalSituationId().
 */
export const SUITE_REVISION = 2;

export type CurrentSituationId = "S1" | "S2" | "S3" | "S4" | "F" | "S2-local" | "S3-local";
export type HistoricalSituationId = "S2-v1" | "S3-v1" | "S2-local-v1" | "S3-local-v1";
export type SituationId = CurrentSituationId | HistoricalSituationId;

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
  /**
   * Tutorial-completion knowledge given to both model players (its own
   * system-prompt block, after the manual and before the episode briefing).
   * Revision 2 S2/S3 and their local starts only.
   */
  tutorial?: string;
  /** Suite revision of this definition. */
  revision: 1 | 2;
  /** Historical definitions only: the current id that replaced this one. */
  supersededBy?: CurrentSituationId;
}

/**
 * Revision 1 S2 (Mirror Pond) briefing, kept verbatim for S2-v1 and reused,
 * with only its scenario label changed, as revision 2 S3 (Mirror Pond).
 *
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

/**
 * Revision 2 episode briefings. S3 (Mirror Pond) is the revision 1 S2 text
 * with only its scenario label changed. S2 (Hedge Maze) is the same text with
 * the area, the item and the "other area" example swapped; the owner approved
 * it on 2026-10-28, provided it names the Enchanted Shears objective without
 * revealing the solution (playerKnowledge.test.ts checks that).
 */
export const S3_BRIEFING = S2_BRIEFING.replace("evaluation (S2)", "evaluation (S3)");
export const S2_MAZE_BRIEFING = [
  "**Episode briefing for this evaluation (S2), the same for both players:**",
  "",
  "- This evaluation episode is Hedge Maze.",
  "- Your objective is to obtain the **Enchanted Shears** and add them to the shared quest inventory. Only the Enchanted Shears complete this episode.",
  '- Bridge Ruins is a puzzle you have already completed. Only the shrine\'s "START / RETURN · E · Puzzle Map 2" sign leads back to it. It is outside the scope of this episode: do not use that sign.',
  "- Every other area's RETURN exit leads back to the shrine. You may use those exits.",
  "- Visiting another area, such as Mirror Pond, is not a failure. You may explore it and complete its objectives before you go on to Hedge Maze, but it does not complete this episode.",
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

/** The current suite (revision 2). S1, S4 and F are unchanged from revision 1. */
export const SITUATIONS: readonly Situation[] = Object.freeze([
  { id: "S1", preset: "S1", heldOut: false, title: "Opening and departure", start: "goddess checkpoint", revision: 1 },
  { id: "S2", preset: "S2-v2", heldOut: false, title: "Hedge Maze", start: "shrine, after the opening scene", prefix: afterOpening, briefing: S2_MAZE_BRIEFING, tutorial: TUTORIAL_BRIEFING, revision: 2 },
  { id: "S3", preset: "S3-v2", heldOut: false, title: "Mirror Pond", start: "shrine, after the opening scene", prefix: afterOpening, briefing: S3_BRIEFING, tutorial: TUTORIAL_BRIEFING, revision: 2 },
  { id: "S4", preset: "S4", heldOut: true, title: "Griffin, offering and finale", start: "shrine, holding the Vanity Mirror and Enchanted Shears", prefix: withMirrorAndShears, revision: 1 },
  { id: "F", preset: "full", heldOut: true, title: "Full episode", start: "goddess checkpoint", revision: 1 },
  { id: "S2-local", preset: "S2-local-v2", heldOut: false, title: "Hedge Maze — local start", start: "Hedge Maze entrance, after the opening and ordinary travel", prefix: localEntry("Hedge Maze"), briefing: localBriefing("S2-local", "Hedge Maze", "Enchanted Shears"), tutorial: TUTORIAL_BRIEFING, revision: 2 },
  { id: "S3-local", preset: "S3-local-v2", heldOut: false, title: "Mirror Pond — local start", start: "Mirror Pond entrance, after the opening and ordinary travel", prefix: localEntry("Mirror Pond"), briefing: localBriefing("S3-local", "Mirror Pond", "Vanity Mirror"), tutorial: TUTORIAL_BRIEFING, revision: 2 },
]);

/**
 * Revision 1 S2/S3 definitions, exactly as they were until the swap: the same
 * presets (so episode ids and goal text match the old traces), prefixes,
 * briefings and no tutorial briefing. Tuning-only, like their originals. They
 * exist so historical results stay identifiable and reproducible; they are
 * not part of the current suite.
 */
export const HISTORICAL_SITUATIONS: readonly Situation[] = Object.freeze([
  { id: "S2-v1", preset: "S2", heldOut: false, title: "Mirror Pond (revision 1 S2)", start: "shrine, after the opening scene", prefix: afterOpening, briefing: S2_BRIEFING, revision: 1, supersededBy: "S3" },
  { id: "S3-v1", preset: "S3", heldOut: false, title: "Hedge Maze (revision 1 S3)", start: "shrine, after the opening scene", prefix: afterOpening, revision: 1, supersededBy: "S2" },
  { id: "S2-local-v1", preset: "S2-local", heldOut: false, title: "Mirror Pond — local start (revision 1 S2-local)", start: "Mirror Pond entrance, after the opening and ordinary travel", prefix: localEntry("Mirror Pond"), briefing: localBriefing("S2-local", "Mirror Pond", "Vanity Mirror"), revision: 1, supersededBy: "S3-local" },
  { id: "S3-local-v1", preset: "S3-local", heldOut: false, title: "Hedge Maze — local start (revision 1 S3-local)", start: "Hedge Maze entrance, after the opening and ordinary travel", prefix: localEntry("Hedge Maze"), briefing: localBriefing("S3-local", "Hedge Maze", "Enchanted Shears"), revision: 1, supersededBy: "S2-local" },
]);

/**
 * The definition a record's situation id refers to. A record without a
 * suiteRevision field (everything before revision 2) uses revision 1 ids, so
 * its "S2" is S2-v1 (Mirror Pond), never the current S2.
 */
export function historicalSituationId(id: string, suiteRevision?: number): SituationId {
  if (suiteRevision !== undefined && suiteRevision >= 2) return situation(id as SituationId).id;
  const v1: Record<string, SituationId> = { S2: "S2-v1", S3: "S3-v1", "S2-local": "S2-local-v1", "S3-local": "S3-local-v1" };
  return situation((v1[id] ?? id) as SituationId).id;
}

/**
 * Seeds. The game has no randomness; a seed fixes the room code and the
 * evaluation ids (runtime.ts), and the scripted route behaves identically for
 * seeds 1-8. Different seeds are therefore reported as reproducibility trials,
 * not as different game situations.
 */
export const SEEDS = Object.freeze({ tuning: [0, 1], final: [100, 101] });

export function situation(id: SituationId): Situation {
  const s = SITUATIONS.find((x) => x.id === id) ?? HISTORICAL_SITUATIONS.find((x) => x.id === id);
  if (!s) throw Error(`Unknown situation ${id}`);
  return s;
}

/** An environment that starts at this situation on every reset. */
export function environmentFor(id: SituationId, options: Omit<EnvironmentOptions, "preset" | "prefix"> = {}) {
  const s = situation(id);
  return new AgentEnvironment({ ...options, preset: s.preset, ...(s.prefix ? { prefix: s.prefix } : {}) });
}
