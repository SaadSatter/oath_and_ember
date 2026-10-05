import type { WardObservation } from "../../apps/client/src/entities/PlayerView.js";
export interface WardSample {
  roomCode: string; serverTick: number; playerId: string; local: boolean;
  actionState: string; combat: unknown; hp: number; ward: WardObservation;
  renderId: number; browserMs: number;
}
export interface AuthoritySample {
  roomCode: string; serverTick: number;
  players: {id: string; actionState: string; combat: unknown; hp: number}[];
}
// Compare the snapshot actually presented against server history at the SAME tick,
// never against a concurrent HTTP response or another client's video clock.
export function investigateWard(samples: WardSample[], history: AuthoritySample[]) {
  const lookup = new Map(history.map(h => [`${h.roomCode}:${h.serverTick}`, h]));
  const firstHeld = new Map<string, number>();
  const heldSince = new Map<string, number>();
  for (const h of history) for (const p of h.players) {
    const key = `${h.roomCode}:${p.id}`;
    if (p.actionState !== "guard") heldSince.delete(key);
    else {
      if (!heldSince.has(key)) heldSince.set(key, h.serverTick);
      firstHeld.set(`${key}:${h.serverTick}`, heldSince.get(key)!);
    }
  }
  let unmatched = 0, unresolvedHeld = 0, mismatches = 0;
  const steadyHeld: WardSample[] = [];
  for (const s of samples) {
    const p = lookup.get(`${s.roomCode}:${s.serverTick}`)?.players.find(p => p.id === s.playerId);
    if (!p) {unmatched++; if (s.actionState === "guard") unresolvedHeld++; continue;}
    if (p.actionState !== s.actionState || p.hp !== s.hp || JSON.stringify(p.combat) !== JSON.stringify(s.combat)) {mismatches++; continue;}
    const began = firstHeld.get(`${s.roomCode}:${s.playerId}:${s.serverTick}`);
    if (p.actionState === "guard" && p.hp > 0 && began !== undefined && s.serverTick - began >= 30) steadyHeld.push(s);
  }
  const hidden = steadyHeld.filter(s => !s.ward.visible || s.ward.alpha <= 0 || s.ward.phase !== "loop");
  const ticks = [...new Set(steadyHeld.map(s => s.serverTick))];
  const classification = hidden.length ? "REPRODUCED" :
    !samples.length || unresolvedHeld || mismatches || ticks.length < 20 ? "INCONCLUSIVE" : "NOT_REPRODUCED";
  return {classification, samples: samples.length, unmatched, unresolvedHeld, mismatches, steadyHeldSamples: steadyHeld.length,
    steadyHeldTicks: ticks, hiddenSamples: hidden, maximumRenderGapMs: samples.length > 1 ? Math.max(...samples.slice(1).map((s,i) => s.browserMs - samples[i].browserMs)) : null,
    scope: "Sustained held state (>=30 server ticks after guard entry) in the local enemy-free Ward fixture. Exact snapshot-tick matching, not FPS/continuous animation approval."};
}
