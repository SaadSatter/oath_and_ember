import type { Role } from "../../../../packages/shared/src/gameTypes.js";
// Presentation-only: never feed these values to shared movement or the server.
// Every normalized frame places its anatomical ground anchor at pixel (24,60).
export const characterVisuals: Record<
  Role,
  {
    scale: number;
    origin: { x: number; y: number };
    offset: { x: number; y: number };
  }
> = {
  OATH: { scale: 1, origin: { x: 0.5, y: 60 / 64 }, offset: { x: 0, y: 13 } },
  EMBER: { scale: 1, origin: { x: 0.5, y: 60 / 64 }, offset: { x: 0, y: 13 } },
};
