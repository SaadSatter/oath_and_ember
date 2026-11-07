// Evaluator domain. Reads authoritative state to judge progress. Its output
// goes to traces and reports only, never into a player's observation.

import { createHash } from "node:crypto";
import type { World } from "../../shared/src/gameTypes.js";
import { FINALE } from "../../shared/src/chapter0Finale.js";
import { shrineComplete } from "../../shared/src/shrine.js";
import type { EpisodeLimits } from "./types.js";
import type { StoryCheckpointId } from "../../shared/src/storyCheckpoints.js";
import { stageReached } from "../../shared/src/prologue.js";
import { GRIFFIN_MAX_HP, griffinState } from "../../shared/src/griffin.js";
import type { TerminationReason } from "./types.js";

/**
 * "S2", "S3", "S2-local" and "S3-local" are the revision 1 definitions, kept
 * unchanged (now used by S2-v1, S3-v1, S2-local-v1, S3-local-v1). The "-v2"
 * presets serve the current S2/S3 after the suite's swap (suite.ts).
 */
export type EpisodePreset =
  | "S2-local" | "S3-local" | "full" | "milestone" | "S1" | "S2" | "S3" | "S4"
  | "S2-v2" | "S3-v2" | "S2-local-v2" | "S3-local-v2" | "S2-B" | "S2-C" | "P1" | "P1-v2" | "P1-v3"
  | "griffin-unprepared-v1" | "griffin-unprepared-return-v1" | "griffin-prepared-return-v1";

export interface EpisodeDefinition {
  preset: EpisodePreset;
  /** Evaluator description; not shown to game-playing agents. */
  goal: string;
  limits: EpisodeLimits;
  success: (w: World) => boolean;
  /**
   * The title-screen story checkpoint the room starts at (default "goddess").
   * P1 starts at "prologue", the game's own opening (2026-11-03).
   */
  checkpoint?: StoryCheckpointId;
  /**
   * Evaluator failure rules checked every tick before success (Griffin trials
   * only). `knockedOut` is true when a hero's health ran out during that tick
   * (the game itself respawns the hero at full health; environment.ts sees it
   * through the original damage call). Returns a terminal reason, or nothing.
   */
  failure?: (w: World, tick: { knockedOut: boolean }) => TerminationReason | undefined;
}

const has = (w: World, flag: string) => !!w.story?.flags.includes(flag);

// Evaluation-suite scenarios (docs/midterm/EVALUATION_SUITE.md). Their start
// states are reached by real play (packages/agent/src/suite.ts); F is "full".
// Game-time limits are roughly 3-4x the scripted route's time for that part.
const QUEST_AREAS = new Set(["MIRROR_POND", "HEDGE_MAZE", "GRIFFIN_ENCLOSURE"]);
const holding = (w: World, item: string) => ((w.inventory?.counts as Record<string, number> | undefined)?.[item] ?? 0) > 0;

/** Owner-approved episode definitions and limits (2026-10-23). */
const coreEpisodes: Record<Exclude<EpisodePreset, "S2-local" | "S3-local" | "S2-v2" | "S3-v2" | "S2-local-v2" | "S3-local-v2" | "S2-B" | "S2-C" | "P1" | "P1-v2" | "P1-v3" | "griffin-unprepared-v1" | "griffin-unprepared-return-v1" | "griffin-prepared-return-v1">, EpisodeDefinition> = {
  full: {
    preset: "full",
    goal: "Bald Goddess quest: from the goddess checkpoint to chapter0.complete.",
    limits: {
      maxTicks: 480 * 60, // 480 s of game time
      // Owner decision 2026-10-27: 1,000 model calls per hero (provisional).
      // With batches of up to 4 actions, a hero may take up to 4 steps per call.
      maxDecisionsPerPlayer: 4_000,
      maxModelCallsPerPlayer: 1_000,
      maxTokensPerPlayer: 8_000_000,
    },
    success: (w) => has(w, FINALE.complete),
  },
  milestone: {
    preset: "milestone",
    goal: "Milestone 1: finish the goddess's opening scene and leave the shrine within 90 s.",
    limits: {
      maxTicks: 90 * 60,
      maxDecisionsPerPlayer: 400,
      maxModelCallsPerPlayer: 40,
      maxTokensPerPlayer: 1_000_000,
    },
    success: (w) =>
      has(w, FINALE.goddessMeet) &&
      w.sceneId !== "GODDESS_SHRINE" &&
      Object.values(w.players).every((p) => (p.sceneId ?? w.sceneId) !== "GODDESS_SHRINE"),
  },
  S1: {
    preset: "S1",
    goal: "S1: finish the goddess's opening scene and enter any of the three quest areas.",
    limits: { maxTicks: 90 * 60, maxDecisionsPerPlayer: 240, maxModelCallsPerPlayer: 60, maxTokensPerPlayer: 1_000_000 },
    success: (w: World) => has(w, FINALE.goddessMeet) && QUEST_AREAS.has(w.sceneId),
  },
  S2: {
    preset: "S2",
    goal: "S2: from the shrine after the opening scene, obtain the Vanity Mirror (Mirror Pond).",
    limits: { maxTicks: 300 * 60, maxDecisionsPerPlayer: 1_600, maxModelCallsPerPlayer: 400, maxTokensPerPlayer: 4_000_000 },
    success: (w: World) => holding(w, "vanity_mirror"),
  },
  S3: {
    preset: "S3",
    goal: "S3: from the shrine after the opening scene, obtain the Enchanted Shears (Hedge Maze).",
    limits: { maxTicks: 300 * 60, maxDecisionsPerPlayer: 1_600, maxModelCallsPerPlayer: 400, maxTokensPerPlayer: 4_000_000 },
    success: (w: World) => holding(w, "enchanted_shears"),
  },
  S4: {
    preset: "S4",
    goal: "S4: from the shrine holding the mirror and shears, reach chapter0.complete (griffin, offering, finale).",
    limits: { maxTicks: 180 * 60, maxDecisionsPerPlayer: 1_200, maxModelCallsPerPlayer: 300, maxTokensPerPlayer: 3_000_000 },
    success: (w: World) => has(w, FINALE.complete),
  },

};

/**
 * P1 "Into the Forest" (owner approval 2026-11-03; docs/midterm/PROLOGUE_SITUATION.md).
 * From the Prologue's opening to the party's arrival in the Mossling Woods. The
 * game itself moves the story to WOODS when a hero presses E at the forest
 * trail's exit after the cart has been found (apps/server/src/prologue.ts
 * storyTravel); the evaluator only reads that authoritative stage.
 * Game time and model calls are the owner's values; decisions and tokens are
 * S2-A's existing limits, retained unchanged as instructed.
 */
export const P1_EPISODE: EpisodeDefinition = {
  preset: "P1",
  goal: "P1 Into the Forest: from the Prologue's opening, reach the Mossling Woods (story stage WOODS).",
  limits: { maxTicks: 180 * 60, maxDecisionsPerPlayer: 1_600, maxModelCallsPerPlayer: 250, maxTokensPerPlayer: 4_000_000 },
  success: (w: World) => stageReached(w.story, "WOODS"),
  checkpoint: "prologue",
};

/**
 * Griffin Trial success (declaration oath-ember-abc-2026-11-06, Situations B/C):
 * the authoritative Griffin HP is 0 AND the shared backpack holds the
 * Magnificent Griffin Wig. Entering the enclosure, damaging the Griffin, the
 * DEFEATED phase alone, or the broad puzzles.griffin.complete flag (set on the
 * peaceful route too) are each insufficient.
 */
export const griffinDefeatedAndWig = (w: World) => griffinState(w.puzzles)?.hp === 0 && holding(w, "griffin_wig");

/**
 * Griffin Trial failures (declared survival and boundary rules). A knockout
 * fails at once: the game restores the hero to full health at the spawn, so a
 * positive final HP would not show it. Any hero outside the enclosure fails.
 */
export function griffinTrialFailure(w: World, tick: { knockedOut: boolean }): TerminationReason | undefined {
  if (tick.knockedOut) return "knocked_out";
  if (Object.values(w.players).some((p) => p.role && (p.sceneId ?? w.sceneId) !== "GRIFFIN_ENCLOSURE")) return "left_area";
  return undefined;
}

/**
 * B — Griffin Trial, Unprepared (docs/midterm/SITUATION_B_GRIFFIN.md). Limits
 * are the declared A/B/C run bounds (DECLARED_EVALUATION_SUITE.md "Limits and
 * reporting"), the same as S2-A's game-time, decision, call and token limits.
 */
export const GRIFFIN_UNPREPARED_EPISODE: EpisodeDefinition = {
  preset: "griffin-unprepared-v1",
  goal: "Griffin Trial, Unprepared (B): from the Griffin Enclosure entrance without the Vanity Mirror or Enchanted Shears, reduce the Griffin to 0 HP and obtain the Magnificent Griffin Wig; neither hero knocked out, both stay in the enclosure.",
  limits: { maxTicks: 300 * 60, maxDecisionsPerPlayer: 1_600, maxModelCallsPerPlayer: 400, maxTokensPerPlayer: 4_000_000 },
  success: griffinDefeatedAndWig,
  failure: griffinTrialFailure,
};

/**
 * C — Griffin Trial, Prepared, goddess return. The wig is consumed by the
 * offering, so success reads the claim flag and the story flag, as B-return
 * does. A peaceful (groomed) wig counts here by the owner's decision; Griffin
 * defeat alone, wig possession alone or an offering without chapter0.complete
 * do not.
 */
export const griffinWigReturned = (w: World) => !!griffinState(w.puzzles)?.wigClaimed && has(w, FINALE.complete);
export const GRIFFIN_PREPARED_RETURN_EPISODE: EpisodeDefinition = {
  preset: "griffin-prepared-return-v1",
  goal: "Situation C: from the Griffin Enclosure entrance holding the Vanity Mirror and Enchanted Shears, obtain the Griffin's wig, offer it to the goddess and reach chapter0.complete without a hero knockout.",
  limits: { maxTicks: 18000, maxDecisionsPerPlayer: 1600, maxModelCallsPerPlayer: 400, maxTokensPerPlayer: 4000000 },
  failure: (_w, tick) => (tick.knockedOut ? "knocked_out" : undefined),
  success: griffinWigReturned,
};

/**
 * Situation C descriptive metrics (owner request 2026-11-06), read from
 * authoritative state at the end of an episode plus the evaluator milestones
 * seen during it. Descriptive only: none of these is a success requirement,
 * and none is shown to a player. Note that any plain E at the nest drops every
 * held tool, so mirrorDelivered/shearsDelivered are also true after a combat
 * defeat; itemsDeliveredWhileGriffinAlive and peacefulGroomingOccurred (the
 * Griffin groomed while alive) are the prepared-item and peaceful-route markers.
 */
export function situationCReport(w: World, seen: ReadonlySet<string>, griffinHpAtWigClaim: number | null, griffinHpAtFirstItemDelivery: number | null, reason: TerminationReason | undefined) {
  const g = griffinState(w.puzzles);
  const wigClaimed = !!g?.wigClaimed;
  return {
    descriptiveOnly: true as const,
    objectiveSuccess: reason === "success",
    terminalReason: reason ?? null,
    griffinHpAtEnd: g?.hp ?? null,
    griffinPhaseAtEnd: g?.phase ?? null,
    griffinDefeated: (g?.hp ?? 1) <= 0 || seen.has("griffin-defeated"),
    mirrorDelivered: !!g?.mirrorDelivered,
    shearsDelivered: !!g?.shearsDelivered,
    itemInteractionUsed: !!g?.mirrorDelivered || !!g?.shearsDelivered,
    /** Griffin HP when a tool was first delivered at the nest; 0 means after a defeat (a plain E drops held tools). */
    griffinHpAtFirstItemDelivery,
    itemsDeliveredWhileGriffinAlive: griffinHpAtFirstItemDelivery !== null && griffinHpAtFirstItemDelivery > 0,
    peacefulGroomingOccurred: seen.has("griffin:grooming"),
    toolsTakenByGriffin: !!g?.toolsTaken,
    wigAcquired: wigClaimed,
    griffinHpAtWigClaim,
    wigRoute: !wigClaimed ? "none" : griffinHpAtWigClaim !== null && griffinHpAtWigClaim <= 0 ? "defeat" : "peaceful",
    offeringAccepted: shrineComplete(w),
    chapter0Complete: has(w, FINALE.complete),
  };
}

/** Additive variants reuse exactly the parent's predicate and limits. */
export const episodes: Record<EpisodePreset, EpisodeDefinition> = {
  ...coreEpisodes,
  "S2-local": { ...coreEpisodes.S2, preset: "S2-local", goal: "S2-local: from the Mirror Pond entrance, obtain the Vanity Mirror." },
  "S3-local": { ...coreEpisodes.S3, preset: "S3-local", goal: "S3-local: from the Hedge Maze entrance, obtain the Enchanted Shears." },
  // Suite revision 2 (2026-10-28): S2 and S3 swapped. Each reuses exactly the
  // predicate and limits of the revision 1 definition for the same area.
  "S2-v2": { ...coreEpisodes.S3, preset: "S2-v2", goal: "S2 (suite revision 2): from the shrine after the opening scene, obtain the Enchanted Shears (Hedge Maze)." },
  "S3-v2": { ...coreEpisodes.S2, preset: "S3-v2", goal: "S3 (suite revision 2): from the shrine after the opening scene, obtain the Vanity Mirror (Mirror Pond)." },
  "S2-local-v2": { ...coreEpisodes.S3, preset: "S2-local-v2", goal: "S2-local (suite revision 2): from the Hedge Maze entrance, obtain the Enchanted Shears." },
  "S3-local-v2": { ...coreEpisodes.S2, preset: "S3-local-v2", goal: "S3-local (suite revision 2): from the Mirror Pond entrance, obtain the Vanity Mirror." },
  // Hedge Maze Situations B and C (2026-10-29): the same predicate and limits as S2-A.
  "S2-B": { ...coreEpisodes.S3, preset: "S2-B", goal: "S2-B: from inside the Hedge Maze with the hedge burned and the cow still in the lane, obtain the Enchanted Shears." },
  "S2-C": { ...coreEpisodes.S3, preset: "S2-C", goal: "S2-C: from inside the Hedge Maze with the cow moved and the wolf still holding the key, obtain the Enchanted Shears." },
  "griffin-unprepared-return-v1": {
    preset: "griffin-unprepared-return-v1",
    goal: "Situation B: defeat the Griffin without tools, acquire its wig, return it to the goddess and reach chapter0.complete without a hero knockout.",
    limits: { maxTicks: 18000, maxDecisionsPerPlayer: 1600, maxModelCallsPerPlayer: 400, maxTokensPerPlayer: 4000000 },
    failure: (_w, tick) => tick.knockedOut ? "knocked_out" : undefined,
    success: (w) => (w.puzzles.griffin?.griffin?.hp ?? 1) <= 0 && !!w.puzzles.griffin?.griffin?.wigClaimed && has(w, FINALE.complete),
  },
  // Situation C, Griffin Trial Prepared, goddess return (owner decisions 2026-11-06,
  // docs/midterm/SITUATION_C_PREPARED.md): B-return's limits and knockout rule.
  // Success is the wig claimed by any normal route (Griffin HP does not matter),
  // offered to the goddess, and chapter0.complete. Leaving the enclosure is allowed.
  "griffin-prepared-return-v1": GRIFFIN_PREPARED_RETURN_EPISODE,
  P1: P1_EPISODE,
  // P1 revision 2 (2026-11-03, review fixes F1/F2/F4): the same start, success
  // predicate and limits; its own preset so episode ids differ from revision 1.
  "P1-v2": { ...P1_EPISODE, preset: "P1-v2", goal: "P1 Into the Forest (revision 2): from the Prologue's opening, reach the Mossling Woods (story stage WOODS)." },
  // P1 revision 3 (2026-11-03): the fence opening's listing renamed by the owner; otherwise as revision 2.
  "P1-v3": { ...P1_EPISODE, preset: "P1-v3", goal: "P1 Into the Forest (revision 3): from the Prologue's opening, reach the Mossling Woods (story stage WOODS)." },
  "griffin-unprepared-v1": GRIFFIN_UNPREPARED_EPISODE,
};

/**
 * Griffin Trial progress markers (evaluator-only, recorded in B/C traces). HP
 * thresholds are reported in quarters so a trace shows how far a failed fight got.
 */
export function griffinMilestones(w: World): string[] {
  const g = griffinState(w.puzzles);
  if (!g) return [];
  const out: string[] = [];
  if (g.phase !== "NEST") out.push("griffin:awake");
  for (const q of [0.75, 0.5, 0.25]) if (g.hp <= GRIFFIN_MAX_HP * q) out.push(`griffin:hp<=${GRIFFIN_MAX_HP * q}`);
  if (g.hp === 0) out.push("griffin:hp-zero");
  if (g.pillars.some(Boolean)) out.push(`griffin:pillars-broken-${g.pillars.filter(Boolean).length}`);
  if (g.mirrorDelivered) out.push("griffin:mirror-delivered");
  if (g.phase === "GROOMING") out.push("griffin:grooming");
  if (g.wigClaimed) out.push("griffin:wig-claimed");
  return out;
}

/** Private progress markers recorded in traces (never shown to players). */
export function milestones(w: World): string[] {
  const out: string[] = [];
  const flag = (f: string, name: string) => has(w, f) && out.push(name);
  flag(FINALE.goddessMeet, "goddess-meet-finished");
  flag(FINALE.mirror, "mirror-banter");
  flag(FINALE.maze, "maze-banter");
  flag(FINALE.griffin, "griffin-banter");
  flag(FINALE.wig, "wig-banter");
  for (const [id, n] of Object.entries(w.inventory?.counts ?? {}))
    if ((n ?? 0) > 0) out.push(`holding:${id}`);
  for (const id of w.inventory?.claimed ?? []) out.push(`claimed:${id}`);
  if (shrineComplete(w)) out.push("offering-accepted");
  flag(FINALE.complete, "chapter0-complete");
  return out;
}

/**
 * Hash of the raw authoritative state, ids included. Evaluation rooms use
 * seeded ids (runtime.ts), so identical play gives identical raw state. (Until
 * 2026-10-27 ids were random and were renamed before hashing; that hid
 * id-based tie-breaks, so hashes from before then are not comparable.)
 */
/**
 * P1 progress markers (evaluator-only, recorded in P1 traces). Each is a story
 * flag the game sets as a scene ends, or the stage the game moves to.
 */
export function prologueMilestones(w: World): string[] {
  const out: string[] = [];
  const flag = (f: string, name: string) => has(w, f) && out.push(name);
  flag("prologue.visit", "prologue:shop-visit");
  flag("prologue.detour", "prologue:road-fork");
  if (stageReached(w.story, "TRAIL")) out.push("prologue:forest-trail");
  flag("prologue.cart", "prologue:cart-found");
  if (stageReached(w.story, "WOODS")) out.push("prologue:mossling-woods");
  return out;
}

export function stateHash(w: World): string {
  return createHash("sha256").update(JSON.stringify(w)).digest("hex");
}
