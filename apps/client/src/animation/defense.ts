import { effectPresentationProfiles } from "../assets/effectPresentation.js";
import type { Role } from "../../../../packages/shared/src/gameTypes.js";
import type { CombatDirection } from "./combat.js";
export type DefensePhase = "start" | "loop" | "end" | "impact";
export const defenseKey = (role: Role) => `hero:${role}:defense`;
export const defenseAsset = (role: Role) => ({
  url:
    role === "OATH"
      ? "/assets/characters/oath/defense-user-v1.png"
      : "/assets/characters/ember/defense.png",
  frameWidth: 128,
  frameHeight: 128,
});
export function defenseClip(
  role: Role,
  phase: DefensePhase,
  direction: CombatDirection,
  moving = false,
) {
  if (role === "OATH") {
    const row = { down: 0, up: 1, right: 2, left: 3 }[direction];
    const walking = phase === "loop" && moving;
    return {
      start: row * 9 + (walking ? 1 : 0),
      count: walking ? 8 : 1,
      fps: 12,
      heldFrame: walking ? undefined : row * 9,
      durationMs: phase === "impact" ? 250 : (8 * 1000) / 12,
    };
  }
  // Ward is a single isolated VFX texture; its phase envelope never swaps Coco's body.
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
