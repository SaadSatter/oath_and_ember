import { effectPresentationProfiles } from "../assets/effectPresentation.js";
import type { Role } from "../../../../packages/shared/src/gameTypes.js";
import type { CombatDirection } from "./combat.js";
export type DefensePhase = "start" | "loop" | "end" | "impact";
export const defenseKey = (role: Role) => `hero:${role}:defense`;
export const defenseAsset = (role: Role) => ({
  url: `/assets/characters/${role.toLowerCase()}/defense.png`,
  frameWidth: 128,
  frameHeight: 128,
});
export function defenseClip(
  role: Role,
  phase: DefensePhase,
  direction: CombatDirection,
) {
  const count =
    role === "EMBER" && phase === "loop" ? 7 : phase === "impact" ? 7 : 8;
  // Ward is a single isolated VFX texture; its phase envelope never swaps Coco's body.
  if (role === "EMBER")
    return {
      start: 0,
      count: 1,
      fps: 12,
      heldFrame: 0,
      durationMs:
        (phase === "impact"
          ? 250
          : phase === "loop"
            ? (7 * 1000) / 12
            : phase === "start" && direction === "down"
              ? 500
              : phase === "start" && direction === "up"
                ? (7 * 1000) / 12
                : (8 * 1000) / 12) /
        (phase === "end"
          ? effectPresentationProfiles.ward.endRate
          : effectPresentationProfiles.ward.startRate),
    };
  // Only start poses exist vertically. Hold their final pose; recovery uses right art.
  const vertical = direction === "up" || direction === "down";
  const row =
    phase === "impact"
      ? role === "OATH"
        ? 5
        : 1
      : phase === "start"
        ? vertical
          ? direction === "down"
            ? 3
            : 4
          : 0
        : phase === "loop" && vertical
          ? direction === "down"
            ? 3
            : 4
          : phase === "loop"
            ? 1
            : 2;
  const verticalCount = 8;
  return {
    start: row * 8,
    count:
      phase === "loop"
        ? 1
        : vertical && phase === "start"
          ? verticalCount
          : count,
    fps: 12,
    heldFrame:
      phase === "loop"
        ? vertical
          ? row * 8 + verticalCount - 1
          : 8
        : undefined,
    durationMs:
      phase === "impact"
        ? 250
        : ((vertical && phase === "start" ? verticalCount : count) * 1000) / 12,
  };
}

// Presentation envelope affects only the hollow VFX image, never the body.
export function wardEnvelope(
  phase: DefensePhase,
  elapsedMs: number,
  durationMs: number,
  sceneNowMs = elapsedMs,
) {
  const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
  const strength =
    phase === "start" ? progress : phase === "end" ? 1 - progress : 1;
  const profile = effectPresentationProfiles.ward;
  if (profile.pulseScale || profile.pulseDepth) {
    // One continuous scene clock avoids pulse restarts at phase/snapshot changes.
    const pulse = (1 - Math.cos(sceneNowMs / profile.pulseMs)) / 2;
    return {
      alpha: strength * (0.96 - (profile.pulseDepth ?? 0) * pulse),
      scale:
        (0.9 + 0.1 * strength) *
        (1 - (profile.pulseScale ?? 0) * strength * pulse),
    };
  }
  return {
    alpha:
      strength *
      (phase === "loop"
        ? 0.9 +
          Math.sin(elapsedMs / effectPresentationProfiles.ward.pulseMs) * 0.06
        : 0.96),
    scale: 0.9 + 0.1 * strength,
  };
}

// Continuous scene clock keeps rotation stable across phase changes and snapshots.
export const wardRotation = (nowMs: number) =>
  effectPresentationProfiles.ward.rotationMs
    ? (nowMs * Math.PI * 2) / effectPresentationProfiles.ward.rotationMs
    : 0;
