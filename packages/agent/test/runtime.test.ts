// Seeded deterministic hero ids (owner decision 2026-10-27).
import { describe, expect, it } from "vitest";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { AgentEnvironment } from "../src/environment.js";
import { seededId } from "../src/runtime.js";
import type { GameAction, PlayerId } from "../src/types.js";

const roomOf = (env: AgentEnvironment) => (env as unknown as { room: GameRoom }).room;
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const heroIds = (env: AgentEnvironment) => {
  const ps = Object.values(roomOf(env).state.players);
  return { sieg: ps.find((p) => p.role === "OATH")!.id, coco: ps.find((p) => p.role === "EMBER")!.id };
};
async function play(seed: number, script: [GameAction, GameAction][]) {
  const lines: { type: string; data: unknown }[] = [];
  const env = new AgentEnvironment({ preset: "milestone", trace: (e) => lines.push(e as { type: string; data: unknown }) });
  const reset = await env.reset(seed);
  for (const [a, b] of script) await Promise.all([env.step("sieg", a), env.step("coco", b)]);
  return { env, reset, lines, ids: heroIds(env), raw: JSON.stringify(roomOf(env).state) };
}
// Equal-length pairs (attacks and abilities take 2 ticks) keep both heroes at
// the same decision point, as in environment.test.ts's playScript.
const scriptA: [GameAction, GameAction][] = [
  [{ type: "move", direction: "n", ticks: 30 }, { type: "move", direction: "e", ticks: 30 }],
  [{ type: "attack", direction: "w" }, { type: "attack", direction: "n" }],
  [{ type: "wait", ticks: 20 }, { type: "move", direction: "s", ticks: 20 }],
];
const scriptB: [GameAction, GameAction][] = [
  [{ type: "move", direction: "s", ticks: 45 }, { type: "wait", ticks: 45 }],
  [{ type: "ability", ability: "super_speed" }, { type: "ability", ability: "black_hole", direction: "e" }],
];

describe("seeded evaluation ids", () => {
  it("are version-4-shaped, fixed per (seed, index) and differ between seeds", () => {
    expect(seededId(1, 0)).toMatch(UUID4);
    expect(seededId(1, 0)).toBe(seededId(1, 0));
    expect(seededId(1, 0)).not.toBe(seededId(1, 1));
    expect(seededId(1, 0)).not.toBe(seededId(2, 0));
  });

  it("give the heroes the seed's first two ids, whatever the agents later do", async () => {
    const a = await play(5, scriptA),
      b = await play(5, scriptB),
      none = await play(5, []);
    for (const r of [a, b, none]) expect(r.ids).toEqual({ sieg: seededId(5, 0), coco: seededId(5, 1) });
    expect(a.reset.startHash).toBe(b.reset.startHash);
  });

  it("reproduce the same raw world for the same seed and actions, ids included", async () => {
    const x = await play(9, scriptA),
      y = await play(9, scriptA);
    expect(x.raw).toBe(y.raw);
    const z = await play(10, scriptA);
    expect(z.raw).not.toBe(x.raw);
  });

  it("vary which hero wins an id tie-break across seeds", () => {
    const order = new Set<boolean>();
    for (let seed = 1; seed <= 20; seed++) order.add(seededId(seed, 0).localeCompare(seededId(seed, 1)) < 0);
    expect(order).toEqual(new Set([true, false]));
  });

  it("record the seed and the starting-state hash in the trace's reset line", async () => {
    const r = await play(3, []);
    const reset = r.lines.find((l) => l.type === "reset")!.data as { seed: number; startHash: string };
    expect(reset.seed).toBe(3);
    expect(reset.startHash).toMatch(/^[0-9a-f]{64}$/);
    expect(reset.startHash).toBe(r.reset.startHash);
  });

  it("leave production rooms random: a GameRoom without a runtime still draws random UUIDs", async () => {
    const { GameRoom } = await import("../../../apps/server/src/GameRoom.js");
    const ids = new Set([new GameRoom("PRODX1").add("a").playerId, new GameRoom("PRODX2").add("a").playerId]);
    expect(ids.size).toBe(2);
    for (const id of ids) expect([seededId(0, 0), seededId(1, 0)]).not.toContain(id);
  });
});
