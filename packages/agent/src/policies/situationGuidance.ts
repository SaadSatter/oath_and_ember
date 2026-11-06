// Post-tuned prompt configurations (declaration oath-ember-abc-2026-11-06,
// "Pre-tuned / Post-tuned"). A guidance block is extra planner text for the
// post-tuned condition of named situations only. The pre-tuned condition sends
// no block, so its system prompt stays byte-identical to the generic policy.
//
// Each entry is versioned by id and pinned by the hash of its text. A
// "proposed" entry is the implementation agent's draft for the owner's review:
// it can be exercised with the mock gateway, and every paid run refuses it
// until the owner approves the text and the status is changed to "approved"
// (a reviewed code change). Guidance never names coordinates, routes or a
// step-by-step sequence, and never goes to scripted baselines.

import { createHash } from "node:crypto";
import type { SituationId } from "../suite.js";

export interface SituationGuidance {
  id: string;
  /** The only situations this guidance may be used on. */
  situations: readonly SituationId[];
  status: "proposed" | "approved";
  /**
   * SHA-256 of the exact text the owner approved (review finding 4). A paid run
   * needs status "approved" AND this hash equal to the text's hash, so editing
   * an approved text re-locks it.
   */
  approvedSha256?: string;
  /** Who wrote it and from what (disclosed in results). */
  provenance: string;
  text: string;
}

/**
 * PROPOSED, NOT APPROVED (2026-11-06). Griffin combat guidance for Situation B's
 * post-tuned condition, drafted from the game's source and the offline witness
 * (docs/midterm/SITUATION_B_GRIFFIN.md). For C it would be a transfer only if
 * the owner adds C here before any C model outcome.
 */
const GRIFFIN_B_POST_V1 = [
  "Griffin combat guidance:",
  "- The Griffin's floating label shows its health and what it is doing. While it flies, Sieg's sword cannot reach it; Coco's fireballs can.",
  "- BEAM CHARGE is a warning. A thin red line (listed as \"griffin beam warning line\") shows where the beam will stop. Before BEAM starts, hold defend or leave the line: a defended hit does a quarter of its damage. Walls, pillars and bodies stop the beam.",
  "- The Griffin aims at the nearer hero. Keep the hero who is not attacking farther away, holding defend, and keep the attacker defending through every charge and beam.",
  "- A fireball flies straight in the direction thrown. From the shore below the Griffin's flight path, follow it side to side and throw north just before it passes overhead.",
  "- Health does not come back during this episode. A hero who is low on health should stay back and defend rather than attack.",
  "- When its label shows it defeated, Coco can fly to its nest with Flight and press E there to collect the wig.",
].join("\n");

/**
 * PROPOSED, NOT APPROVED (2026-11-06). General play heuristics taken from the
 * Situation A heuristic baseline (baseline-maze-heuristic-v2, mazeHeuristic.ts),
 * restated as advice for the planner. It names no place, enemy, attack, item,
 * coordinate or sequence. Written after Pilot-31 (B pre-tuned) had been run and
 * its trace read; see docs/midterm/B_POST_TUNING_TRANSFER.md for the source of
 * each line and that disclosure.
 */
const B_POST_A_TRANSFER_V1 = [
  "General play heuristics (they apply anywhere; they are not facts about this place):",
  "Spatial reasoning",
  "- Plan movement over the combined map. Treat walls, water and the bodies of enemies and creatures (their listed extents) as blocking. A hero's body needs open ground all around it.",
  "- Something seen earlier but not on a screen now may have moved. Use seen_earlier as a hint, not as its current position.",
  "Systematic positioning",
  "- When an action depends on where the hero stands and which way it faces (a ranged attack, a pull, an interaction), list a few candidate tiles around the target. Each should be open ground, not touching any body, with the target clearly in reach rather than at the edge of range. Prefer the candidate with a clear straight line to the target, with the other hero out of that line, and short to reach.",
  "- Keep in known_obstacles which position-and-aim combinations were tried and what was observed. Do not repeat an identical combination unless something relevant changed.",
  "- Do not stand on top of a target or another body. If a hero overlaps one, first step out to open ground, then choose a position.",
  "- After acting, move the hero off any path or area the screen shows an effect is about to cross, before it lands, then return to a chosen position. Do not wait for damage to show that a place was unsafe.",
  "Search",
  "- When the next thing the objective needs is on neither screen, explore systematically: go to the nearest unexplored edge of the map (\"?\" next to seen open ground) that has not been visited, prefer new tiles over tiles already walked, and back off and go around when a way is blocked instead of repeating the same move.",
  "- Keep a short note in the plan of areas already searched, so the search does not loop.",
  "Feedback-based recovery",
  "- Treat each action as a test with an expected visible result: a target's shown health falls, a body moves, the hero arrives, the backpack, journal or dialogue changes. Allow a short, bounded time for the result, then compare the screens with what was expected.",
  "- If two tries of the same kind show no result, change one thing: position, aim, timing, or which hero does it. If several changes still show nothing, try a different approach or work on another part of the objective.",
  "- A recharging ability is not a reason to stand still. Give the hero useful work meanwhile (getting clear, repositioning, scouting) and come back when its shown state is ready.",
  "- When the world changes (a way opens, a body moves), forget earlier blocked results near it and test again.",
].join("\n");

export const SITUATION_GUIDANCE: Readonly<Record<string, SituationGuidance>> = Object.freeze({
  "b-post-a-transfer-v1": Object.freeze({
    id: "b-post-a-transfer-v1",
    situations: Object.freeze(["griffin-unprepared-v1"] as SituationId[]),
    status: "proposed",
    provenance: "Drafted by the Claude Code implementation agent from the Situation A heuristic baseline (baseline-maze-heuristic-v2) after Pilot-31 was run and read; pending owner review.",
    text: B_POST_A_TRANSFER_V1,
  }),
  "griffin-b-post-v1": Object.freeze({
    id: "griffin-b-post-v1",
    situations: Object.freeze(["griffin-unprepared-v1"] as SituationId[]),
    status: "proposed",
    provenance: "Draft by the Claude Code implementation agent from game source and the offline witness; pending owner review.",
    text: GRIFFIN_B_POST_V1,
  }),
});

export function guidance(id: string): SituationGuidance {
  const g = SITUATION_GUIDANCE[id];
  if (!g) throw Error(`Unknown guidance ${id} (known: ${Object.keys(SITUATION_GUIDANCE).join(", ")}).`);
  return g;
}

export { guidanceBlock, guidanceId } from "./llm.js";

/** Approved for paid runs: status approved and the text unchanged since approval. */
export function guidanceApproved(g: SituationGuidance): boolean {
  return g.status === "approved" && g.approvedSha256 === guidanceHash(g.text);
}

export const guidanceHash = (text: string) => createHash("sha256").update(text).digest("hex");
