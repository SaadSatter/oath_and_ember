// Prompt-tuned continuous gameplay demonstration, scenario
// showcase-maze-griffin-complete-v1 (docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md).
//
// EXCLUDED FROM THE OFFICIAL A/B/C EVALUATION. It is a showcase recording for
// the submission: one continuous episode from the Hedge Maze entrance through
// the Griffin fight to chapter0.complete. It reuses the frozen A/B/C pieces
// without changing them: S2-A's start prefix, the unchanged model-centralized
// planner, the approved b-post-combined-v4 text (inside the showcase guidance)
// and the unchanged A and B heuristics (inside the free validation baseline).
//
// Paid runs stay refused until the owner approves this definition, its limits
// and the showcase guidance (SHOWCASE_PAID_APPROVED and the guidance status).

import { createHash } from "node:crypto";
import { episodes } from "./evaluator.js";
import { situation, type SituationId } from "./suite.js";
import { canonicalJson } from "./situationA.js";
import { tutorialId } from "./playerKnowledge.js";
import { briefingId } from "./policies/llm.js";

export const SHOWCASE_ID = "showcase-maze-griffin-complete-v1" as const;
export const SHOWCASE_GUIDANCE_ID = "showcase-maze-griffin-v1" as const;
export const SHOWCASE_LABEL = "Prompt-tuned continuous gameplay demonstration — excluded from official A/B/C evaluation results.";

/** Paid model runs: refused until the owner approves (a reviewed code change). */
export const SHOWCASE_PAID_APPROVED = false;
/** The proposed paid configuration (owner approval pending). */
export const SHOWCASE_PAID_SCOPE = Object.freeze({
  player: "model-centralized", gateway: "openai", model: "gpt-6-luna", effort: "medium", maxBatch: 4, seed: 0,
  maxEpisodeCapUsd: 2.0, wallClockSeconds: 7200, guidance: SHOWCASE_GUIDANCE_ID,
});
/** PROPOSED per-episode spend cap and wall-clock ceiling (harness.ts reads these). */
export const SHOWCASE_EPISODE_CAP_USD = SHOWCASE_PAID_SCOPE.maxEpisodeCapUsd;
export const SHOWCASE_WALL_CLOCK_CEILING_S = SHOWCASE_PAID_SCOPE.wallClockSeconds;

const def = situation(SHOWCASE_ID);
const episode = episodes[def.preset];

export const SHOWCASE = Object.freeze({
  label: "SHOWCASE",
  disclosure: SHOWCASE_LABEL,
  logicalId: SHOWCASE_ID,
  version: 1,
  status: "proposed (2026-11-07): free validation only; owner approval pending for limits, guidance and the paid run",
  situation: SHOWCASE_ID as SituationId,
  preset: def.preset,
  officialEvaluation: false,
  start: Object.freeze({
    description: def.start,
    prefix: def.prefix!.name,
    area: "HEDGE_MAZE",
    sameAuthoritativeStartAs: "S2-local (Situation A, S2-A version 2)",
    fixture: "none",
  }),
  route: Object.freeze([
    "Hedge Maze: obtain the Enchanted Shears from the Shears Chest",
    "Travel: Hedge Maze RETURN exit, then the shrine's NORTH · GRIFFIN TRAIL exit",
    "Griffin Enclosure: defeat the Griffin in combat (HP 0)",
    "Coco claims the wig at the nest after the defeat",
    "Return to the shrine, offer the wig, read the finale to chapter0.complete",
  ]),
  success: "Authoritative state: Shears Chest claimed AND enchanted_shears held AND griffin.hp == 0 AND griffin.wigClaimed AND NOT griffin.toolsTaken AND offering accepted AND chapter0.complete (evaluator showcaseComplete).",
  failure: "knocked_out: a hero's health ran out during any tick (checked before success). A peaceful (groomed) wig makes success impossible: a groomed Griffin can never reach 0 HP.",
  milestones: Object.freeze(["showcase:1-maze-complete", "showcase:2-griffin-defeated", "showcase:3-wig-acquired-after-defeat", "showcase:4-offering-accepted", "showcase:5-chapter0-complete"]),
  goal: episode.goal,
  limits: Object.freeze({ ...episode.limits, wallClockSeconds: SHOWCASE_WALL_CLOCK_CEILING_S, episodeSpendCapUsd: SHOWCASE_EPISODE_CAP_USD, status: "proposed" }),
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
