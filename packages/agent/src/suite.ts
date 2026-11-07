// The evaluation suite (docs/midterm/EVALUATION_SUITE.md). Provisional:
// approved by the owner on 2026-10-27, pending the professor's confirmation.
//
// Scenario start states are reached by real play: a prefix of the verified
// scripted route (packages/agent/src/route/) run through the environment's
// own five operations at reset. No fixture, teleport or item injection.

import { AgentEnvironment, type EnvironmentOptions } from "./environment.js";
import type { EpisodePreset } from "./evaluator.js";
import { enterLocalArea } from "./route/localStarts.js";
import { enterGriffinEnclosure } from "./route/griffinStart.js";
import { playCheckpoint } from "./route/mazeCheckpoints.js";
import { MAZE_CHECKPOINTS } from "./route/mazeCheckpointData.js";
import { Director } from "./route/director.js";
import { hedgeMaze, mirrorPond, opening, travelFromShrine } from "./route/fullQuest.js";
import { NEUTRAL_TASK, TUTORIAL_BRIEFING } from "./playerKnowledge.js";

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

export type CurrentSituationId = "S1" | "S2" | "S3" | "S4" | "F" | "S2-local" | "S3-local" | "S2-B" | "S2-C" | "P1";
/** A/B/C declaration cases that are new scenarios (ABC_SITUATIONS). */
export type AbcSituationId = "griffin-unprepared-v1" | "griffin-unprepared-return-v1" | "griffin-prepared-return-v1";
export type HistoricalSituationId = "S2-v1" | "S3-v1" | "S2-local-v1" | "S3-local-v1";
export type SituationId = CurrentSituationId | HistoricalSituationId | AbcSituationId;

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
  /**
   * The task line of model players' system prompt, when it is not the original
   * one (llm.ts TASK). P1 revision 2 uses the episode-neutral NEUTRAL_TASK.
   */
  task?: string;
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

// Hedge Maze Situations B and C (2026-10-29; docs/midterm/HEDGE_MAZE_SITUATIONS.md):
// the S2-local entry, then a prefix of the committed live baseline trace,
// replayed through step() to a cut tick (route/mazeCheckpoints.ts).
const mazeCheckpoint = (id: "S2-B" | "S2-C"): EnvironmentOptions["prefix"] => ({
  name: `opening scene, normal entry to Hedge Maze, recorded baseline play to tick ${MAZE_CHECKPOINTS[id].cutTick} (${id} checkpoint)`,
  run: async (env) => {
    await localEntry("Hedge Maze")!.run(env);
    await playCheckpoint(env, MAZE_CHECKPOINTS[id]);
  },
});
/**
 * One text for both mid-maze starts, differing only in the id, so it tells a
 * player nothing about which obstacles remain or how to pass them. DRAFT by the
 * implementation agent, pending the owner's wording.
 */
export const midMazeBriefing = (id: "S2-B" | "S2-C") =>
  `Episode briefing (${id}), the same for both players: you start inside the Hedge Maze, partway through it, so some of its obstacles may already have been dealt with. Your own observations show where things stand. Your objective is to obtain the Enchanted Shears in the shared inventory. Normal movement, travel, interaction and messages remain available; you may leave this area and return. Use your own observations and coordinate with your partner.`;

/**
 * Griffin Trials B and C (declaration oath-ember-abc-2026-11-06): the opening,
 * then ordinary north travel from the shrine, stopping on arrival
 * (route/griffinStart.ts). B takes no detour, so neither tool is held.
 */
const griffinEntry: EnvironmentOptions["prefix"] = {
  name: "opening scene, normal north travel to Griffin Enclosure (before arrival dialogue)",
  run: async (env) => { await afterOpening!.run(env); await enterGriffinEnclosure(env); },
};
/**
 * One text for both Griffin Trials (B unprepared, C prepared), so it says
 * nothing about which items the party holds or how to use them: the declared
 * goal and the survival and boundary rules only. DRAFT by the implementation
 * agent, pending the owner's wording (docs/midterm/SITUATION_B_GRIFFIN.md).
 */
export const GRIFFIN_TRIAL_BRIEFING = [
  "Episode briefing (Griffin Trial), the same for both players: you start at the entrance of the Griffin Enclosure.",
  "Your objective is to defeat the Griffin, bringing its health to zero, and to obtain the Magnificent Griffin Wig in the shared inventory. Both are required: a wig obtained while the Griffin still has health does not complete this episode.",
  "Neither hero may be knocked out: if either hero's health runs out, the episode ends as a failure.",
  "Both heroes must stay in the Griffin Enclosure: leaving it ends the episode as a failure.",
  "Use your normal observations, actions and messages to your partner.",
].join(" ");

/**
 * B-return's start (griffin-unprepared-return-v1): the opening, a walk around
 * the statue and ordinary north travel, arrival dialogue read. Shared by B and
 * C unchanged, so C's start differs from B's only by its added items.
 */
async function unpreparedReturnEntry(env: AgentEnvironment) {
  const d=new Director({env}); await opening(d);
  // Evaluator preparation only: walk around the statue/partner through
  // ordinary step(), preserving this legal history in the checkpoint.
  for(const to of [{x:18.8,y:21.5},{x:24.5,y:21.5},{x:24.5,y:10.5}]) await d.go({sieg:{to,opts:{tolerance:0.5}}});
  await travelFromShrine(d,"north","Griffin Enclosure");
  for(const hero of ["sieg","coco"] as const) {
    const o=await env.observe(hero);
    if(o.area.name!=="Griffin Enclosure" || o.inventory.items.some(i=>i.count>0 && /^(vanity_mirror|enchanted_shears|griffin_wig)$/.test(i.id))) throw Error("Invalid unprepared Griffin checkpoint");
  }
}

/**
 * Situation C's episode briefing (owner chose "tutorial + new C briefing",
 * 2026-11-06). DRAFT by the implementation agent, PENDING the owner's wording:
 * the goal and the survival rule only. It does not mention the starting items
 * (the players see them in their backpack), and names no route, nest use,
 * attack pattern or position, nor whether the Griffin must be defeated.
 */
export const GRIFFIN_PREPARED_RETURN_BRIEFING = [
  "Episode briefing (Griffin Trial, prepared), the same for both players: you start at the entrance of the Griffin Enclosure.",
  "Your objective is to obtain the Griffin's wig, bring it back to the Bald Goddess at the shrine, offer it to her and see Chapter 0 through to its end.",
  "Neither hero may be knocked out: if either hero's health runs out, the episode ends as a failure.",
  "Use your normal observations, actions and messages to your partner.",
].join(" ");

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
  { id: "S2-B", preset: "S2-B", heldOut: false, title: "Hedge Maze — cow puzzle", start: "inside the Hedge Maze after the guards and dry hedge, reached by replaying recorded baseline play", prefix: mazeCheckpoint("S2-B"), briefing: midMazeBriefing("S2-B"), tutorial: TUTORIAL_BRIEFING, revision: 2 },
  { id: "S2-C", preset: "S2-C", heldOut: false, title: "Hedge Maze — wolf and key", start: "inside the Hedge Maze after the cow is moved, reached by replaying recorded baseline play", prefix: mazeCheckpoint("S2-C"), briefing: midMazeBriefing("S2-C"), tutorial: TUTORIAL_BRIEFING, revision: 2 },
  // P1 "Into the Forest" (owner approval 2026-11-03; prologueSituation.ts): the
  // Prologue's own opening, no prefix, no briefing, no tutorial text. Frozen and
  // excluded from prompt tuning; not formally held out (see its definition).
  // Revision 2 (review fixes): the episode-neutral task line. Revision 3: the
  // fence opening's listing renamed (owner's wording); preset P1-v3.
  { id: "P1", preset: "P1-v3", heldOut: false, title: "Into the Forest (Prologue)", start: "prologue checkpoint: the game's own opening", task: NEUTRAL_TASK, revision: 2 },
]);

/**
 * Cases of the A/B/C declaration (oath-ember-abc-2026-11-06;
 * docs/midterm/DECLARED_EVALUATION_SUITE.md) that are new scenarios. Kept
 * apart from SITUATIONS so the frozen suite revision 2 list is unchanged. A
 * is the existing S2-local; C is griffin-prepared-return-v1 (declared r9 as
 * griffin-prepared-v1; renamed by the owner, 2026-11-06).
 */
export const ABC_SITUATIONS: readonly Situation[] = Object.freeze([
  // Situation B, Griffin Trial (Unprepared) (docs/midterm/SITUATION_B_GRIFFIN.md):
  // a development case under the declaration; C is the declared holdout.
  { id: "griffin-unprepared-v1", preset: "griffin-unprepared-v1", heldOut: false, title: "Griffin Trial — Unprepared (B)", start: "Griffin Enclosure entrance, after the opening and ordinary north travel; no Vanity Mirror or Enchanted Shears", prefix: griffinEntry, briefing: GRIFFIN_TRIAL_BRIEFING, tutorial: TUTORIAL_BRIEFING, revision: 2 },
  { id: "griffin-unprepared-return-v1", preset: "griffin-unprepared-return-v1", heldOut: false, title: "Griffin Trial Unprepared, return offering", start: "ordinary opening and north travel to Griffin enclosure, no Mirror or Shears", revision: 1,
    prefix: { name: "opening and ordinary north travel to Griffin enclosure (unprepared)", run: (env) => unpreparedReturnEntry(env) },
    task: "Defeat the Griffin, obtain its Divine Wig, return it to the goddess and complete Chapter 0. Both heroes must avoid knockout.",
  },
  // Situation C, Griffin Trial Prepared, goddess return (owner decisions
  // 2026-11-06; docs/midterm/SITUATION_C_PREPARED.md). Exactly B-return's
  // ordinary prefix, then the owner-approved start fixture adds the Vanity
  // Mirror and Enchanted Shears to the shared backpack: the only intended
  // difference from B's start. No other state is written. Not run by any
  // model until the owner approves the C declaration (SITUATION_C_PAID_APPROVED).
  { id: "griffin-prepared-return-v1", preset: "griffin-prepared-return-v1", heldOut: false, title: "Griffin Trial Prepared, return offering (C)", start: "B-return's start (ordinary opening and north travel to the Griffin Enclosure), plus Vanity Mirror and Enchanted Shears added to the shared backpack", revision: 1,
    prefix: { name: "B-return start, then Mirror and Shears added to the backpack (owner-approved start fixture)", run: async (env, setup) => {
      await unpreparedReturnEntry(env);
      if (!setup) throw Error("Situation C's start needs the environment's start fixture.");
      setup.addItems({ vanity_mirror: 1, enchanted_shears: 1 });
    }},
    briefing: GRIFFIN_PREPARED_RETURN_BRIEFING,
    tutorial: TUTORIAL_BRIEFING,
  },
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
  const s = SITUATIONS.find((x) => x.id === id) ?? HISTORICAL_SITUATIONS.find((x) => x.id === id) ?? ABC_SITUATIONS.find((x) => x.id === id);
  if (!s) throw Error(`Unknown situation ${id}`);
  return s;
}

/** An environment that starts at this situation on every reset. */
export function environmentFor(id: SituationId, options: Omit<EnvironmentOptions, "preset" | "prefix"> = {}) {
  const s = situation(id);
  return new AgentEnvironment({ ...options, preset: s.preset, ...(s.prefix ? { prefix: s.prefix } : {}) });
}
