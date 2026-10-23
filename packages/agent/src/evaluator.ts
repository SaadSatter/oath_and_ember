// Evaluator domain. Reads authoritative state to judge progress. Its output
// goes to traces and reports only, never into a player's observation.

import { createHash } from "node:crypto";
import type { World } from "../../shared/src/gameTypes.js";
import { FINALE } from "../../shared/src/chapter0Finale.js";
import { shrineComplete } from "../../shared/src/shrine.js";
import type { EpisodeLimits } from "./types.js";

export type EpisodePreset = "full" | "milestone";

export interface EpisodeDefinition {
  preset: EpisodePreset;
  /** Evaluator description; not shown to game-playing agents. */
  goal: string;
  limits: EpisodeLimits;
  success: (w: World) => boolean;
}

const has = (w: World, flag: string) => !!w.story?.flags.includes(flag);

/** Owner-approved episode definitions and limits (2026-10-23). */
export const episodes: Record<EpisodePreset, EpisodeDefinition> = {
  full: {
    preset: "full",
    goal: "Bald Goddess quest: from the goddess checkpoint to chapter0.complete.",
    limits: {
      maxTicks: 480 * 60,
      maxDecisionsPerPlayer: 400,
      maxModelCallsPerPlayer: 400,
      maxTokensPerPlayer: 4_000_000,
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
};

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

const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
/**
 * Hash of the authoritative state. The engine names players, projectiles and
 * black holes with random UUIDs; they are replaced by their order of first
 * appearance so identical play gives identical hashes.
 */
export function stateHash(w: World, roles: Record<string, string>): string {
  const names = new Map<string, string>(Object.entries(roles));
  const text = JSON.stringify(w).replace(uuid, (id) => {
    if (!names.has(id)) names.set(id, `id${names.size}`);
    return names.get(id)!;
  });
  return createHash("sha256").update(text).digest("hex");
}
