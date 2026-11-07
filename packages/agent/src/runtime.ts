// Evaluation runtime for GameRoom (owner decision 2026-10-27): a game-time
// clock and seeded deterministic ids. Production rooms keep the wall clock and
// random UUIDs; only evaluation rooms receive this runtime.

import { createHash } from "node:crypto";
import type { RoomRuntime } from "../../../apps/server/src/GameRoom.js";
import { SERVER_HZ } from "../../shared/src/constants.js";

/**
 * The n-th id for a seed: a version-4-shaped UUID derived from
 * sha256("oath-eval-id:<seed>:<n>"). It depends only on the seed and the draw
 * index, never on what the agents do. The two heroes are drawn first at reset
 * (n = 0 for Sieg, n = 1 for Coco), so their ids, and every id-based tie-break
 * between them, are fixed by the seed alone.
 */
export function seededId(seed: number, n: number): string {
  const h = createHash("sha256").update(`oath-eval-id:${seed}:${n}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Clock in game time (ms since tick 0) and the seeded id stream. */
export function evaluationRuntime(seed: number, serverTick: () => number): RoomRuntime & { drawn: () => number } {
  let n = 0;
  return {
    now: () => (serverTick() * 1000) / SERVER_HZ,
    id: () => seededId(seed, n++),
    drawn: () => n,
  };
}
