// Presentation-only profiles. The art engineer adapter edits this data, never simulation.
export interface EffectPresentation {
  scale: number;
  offsetX: number;
  offsetY: number;
  startRate: number;
  endRate: number;
  pulseMs: number;
  rotationMs: number;
  pulseScale?: number;
  pulseDepth?: number;
  centerOnCoco?: boolean;
}
// BEGIN PROFILES
// prettier-ignore
export const effectPresentationProfiles: Record<string, EffectPresentation> = {
  "ward": {
    "scale": 0.8,
    "offsetX": 0,
    "offsetY": 0,
    "startRate": 1.5,
    "endRate": 1.5,
    "pulseMs": 286.4788975654116,
    "rotationMs": 0,
    "pulseScale": 0.04,
    "pulseDepth": 0.12,
    "centerOnCoco": true
  },
  "projectile": {
    "scale": 1,
    "offsetX": 0,
    "offsetY": 0,
    "startRate": 1,
    "endRate": 1,
    "pulseMs": 420,
    "rotationMs": 0
  }
};
// END PROFILES
