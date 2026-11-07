// Prompt-tuned continuous gameplay demonstration, scenario
// showcase-maze-griffin-complete-v1 (docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md).
//
// EXCLUDED FROM THE OFFICIAL A/B/C EVALUATION. It is a showcase recording for
// the submission: one continuous episode from the normal Goddess Shrine checkpoint through
// the Griffin fight to chapter0.complete. It reuses the frozen A/B/C pieces
// without changing them: the normal goddess checkpoint, the unchanged model-centralized
// planner, the approved b-post-combined-v4 text (inside the showcase guidance)
// and the unchanged A and B heuristics (inside the free validation baseline).
//
// Paid runs stay refused until the owner approves this definition, its limits
// and the showcase guidance (SHOWCASE_PAID_APPROVED and the guidance status).

import { createHash } from "node:crypto";
import { episodes, SHOWCASE_ORDERED_MILESTONES } from "./evaluator.js";
import { situation, type SituationId } from "./suite.js";
import { canonicalJson } from "./situationA.js";
import { tutorialId } from "./playerKnowledge.js";
import { briefingId } from "./policies/llm.js";

export const SHOWCASE_ID = "showcase-maze-griffin-complete-v1" as const;
export const SHOWCASE_GUIDANCE_ID = "showcase-maze-griffin-v1" as const;
export const SHOWCASE_LABEL = "Prompt-tuned continuous gameplay demonstration — excluded from official A/B/C evaluation results.";

/**
 * Revision 3 starts at the normal Goddess Shrine checkpoint. Prior paid
 * approval applied only to the former maze-start hashes. The owner explicitly
 * requires new final approval before unlocking this revision.
 */
export const SHOWCASE_PAID_APPROVED = false;
/** The paid configuration the owner approved on 2026-11-07 (target scope only; revised execution is not authorized). One attempt, no automatic retry. */
export const SHOWCASE_PAID_SCOPE = Object.freeze({
  player: "model-centralized", gateway: "openai", model: "gpt-6-luna", effort: "medium", maxBatch: 4, seed: 0,
  maxEpisodeCapUsd: 2.0, wallClockSeconds: 7200, guidance: SHOWCASE_GUIDANCE_ID,
});
/** Owner-approved per-episode spend cap and wall-clock ceiling (harness.ts reads these). */
export const SHOWCASE_EPISODE_CAP_USD = SHOWCASE_PAID_SCOPE.maxEpisodeCapUsd;
export const SHOWCASE_WALL_CLOCK_CEILING_S = SHOWCASE_PAID_SCOPE.wallClockSeconds;

const def = situation(SHOWCASE_ID);
const episode = episodes[def.preset];

export const SHOWCASE = Object.freeze({
  label: "SHOWCASE",
  disclosure: SHOWCASE_LABEL,
  logicalId: SHOWCASE_ID,
  version: 3,
  status: "revision 3 shrine start requested by owner; paid execution locked pending new exact-hash authorization",
  situation: SHOWCASE_ID as SituationId,
  preset: def.preset,
  officialEvaluation: false,
  start: Object.freeze({
    description: def.start,
    prefix: null,
    area: "GODDESS_SHRINE",
    sameAuthoritativeStartAs: "normal goddess title-screen checkpoint (S1 reset)",
    fixture: "none",
  }),
  route: Object.freeze([
    "Goddess Shrine: read the opening Goddess greeting and quest through normal dialogue, then enter the Hedge Maze through its normal exit",
    "Hedge Maze: obtain the Enchanted Shears from the Shears Chest",
    "Travel: Hedge Maze RETURN exit, then the shrine's NORTH · GRIFFIN TRAIL exit",
    "Griffin Enclosure: defeat the Griffin in combat (HP 0)",
    "Coco claims the wig at the nest after the defeat",
    "Return to the shrine, offer the wig, read the finale to chapter0.complete",
  ]),
  success: "Strictly ordered first-occurrence evaluator episode history: opening quest read, maze entered, returned from maze, Griffin entered, returned with wig; authoritative state: Shears Chest claimed AND enchanted_shears held AND griffin.hp == 0 AND griffin.wigClaimed AND NOT griffin.toolsTaken AND offering accepted AND chapter0.complete (evaluator showcaseComplete).",
  failure: "None from knockouts (owner decision 2026-11-07): the game's own rule returns a knocked-out hero to the area's starting point with full health, quest progress, inventory and the Griffin unchanged, and the episode continues; each knockout is recorded (trace line showcase_knockout, summary showcaseReport). The episode ends on any limit (ticks, decisions, calls, tokens, spend, wall clock), three consecutive policy failures, the planner's stall watchdog (error) or a manual stop. A peaceful (groomed) wig makes success impossible: a groomed Griffin can never reach 0 HP.",
  milestones: Object.freeze(SHOWCASE_ORDERED_MILESTONES),
  goal: episode.goal,
  limits: Object.freeze({ ...episode.limits, wallClockSeconds: SHOWCASE_WALL_CLOCK_CEILING_S, episodeSpendCapUsd: SHOWCASE_EPISODE_CAP_USD, status: "owner-approved 2026-11-07" }),
  prompts: Object.freeze({
    tutorialId: def.tutorial ? tutorialId(def.tutorial) : null,
    briefingId: def.briefing ? briefingId(def.briefing) : null,
    task: def.task ?? null,
    guidanceId: SHOWCASE_GUIDANCE_ID,
  }),
});

export const SHOWCASE_HASH = createHash("sha256").update(canonicalJson(SHOWCASE)).digest("hex");

export function showcaseEvaluationLabel(id: SituationId): { label: string; definitionHash: string; officialEvaluation: false; disclosure: string } | null {
  return id === SHOWCASE_ID ? { label: SHOWCASE.label, definitionHash: SHOWCASE_HASH, officialEvaluation: false, disclosure: SHOWCASE_LABEL } : null;
}
