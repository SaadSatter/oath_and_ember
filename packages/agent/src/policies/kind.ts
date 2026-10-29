// Which suite player a pair of policies is (review H2-a). A final ticket names
// one approved player kind; the runner classifies the policies it is given and
// refuses a ticket for any other kind. Classification is by exact class, so a
// subclass or a look-alike object is never mistaken for an approved player.

import type { PlayerKind } from "../playerKinds.js";
import type { PlayerId } from "../types.js";
import type { Policy } from "./policy.js";
import { ExplorationBaseline } from "./baseline.js";
import { GuidedMazePlayer } from "./guidedMaze.js";
import { LLMPlayer } from "./llm.js";
import { QuestBaseline } from "./questBaseline.js";

function kindOf(p: Policy): PlayerKind | null {
  const proto = Object.getPrototypeOf(p);
  if (proto === QuestBaseline.prototype) return "baseline-quest";
  if (proto === ExplorationBaseline.prototype) return "baseline-explore";
  if (proto === GuidedMazePlayer.prototype) return "model-guided";
  if (proto === LLMPlayer.prototype) return (p as LLMPlayer).memory === "history" ? "model-history" : (p as LLMPlayer).memory === "none" ? "model-obs-only" : (p as LLMPlayer).memory === "persistent" ? "model-memory" : null;
  return null;
}

/** The suite player both heroes are, or null when they are not one approved kind (or share an instance). */
export function policyKind(policies: Record<PlayerId, Policy>): PlayerKind | null {
  if (policies.sieg === policies.coco) return null;
  const sieg = kindOf(policies.sieg), coco = kindOf(policies.coco);
  return sieg !== null && sieg === coco ? sieg : null;
}
