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

export const SITUATION_GUIDANCE: Readonly<Record<string, SituationGuidance>> = Object.freeze({
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
