// The evaluation suite's scenarios start where EVALUATION_SUITE.md says,
// reached by real play, reproducibly.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { environmentFor, SEEDS, SITUATIONS } from "../src/suite.js";
import { AgentEnvironment } from "../src/environment.js";
import type { TraceEvent } from "../src/environment.js";
import { routeDevelopmentAccess } from "../src/finalAccess.js";

/** Held-out start states are built here as route development, never by a player (finalAccess.ts). */
const ROUTE_DEV = routeDevelopmentAccess("suite.test.ts: scenario start states");

const quest = (items: { id: string }[]) => items.map((i) => i.id).filter((i) => /mirror|shears|wig/.test(i)).sort();

describe("suite scenarios", () => {
  it("declares S1-S3 and approved local variants as tuning cases, with S4, F held out", () => {
    expect(SITUATIONS.map((s) => [s.id, s.heldOut])).toEqual([["S1", false], ["S2", false], ["S3", false], ["S4", true], ["F", true], ["S2-local", false], ["S3-local", false]]);
    expect(SEEDS).toEqual({ tuning: [0, 1], final: [100, 101] });
  });

  it("start where declared, with zero counters, identically on every reset", async () => {
    const starts: Record<string, string> = {};
    for (const s of SITUATIONS) {
      // Reset only at a final seed, under labelled route development access.
      const env = environmentFor(s.id, { routeDevelopment: ROUTE_DEV });
      const a = await env.reset(100);
      const b = await env.reset(100);
      expect(b.startHash, s.id).toBe(a.startHash);
      starts[s.id] = a.startHash;
      const o = await env.observe("sieg");
      const out = await env.outcome();
      expect(out).toMatchObject({ status: "ongoing", ticks: 0, decisions: { sieg: 0, coco: 0 }, invalidActions: { sieg: 0, coco: 0 } });
      expect(o.area.name, s.id).toBe(s.id === "S2-local" ? "Mirror Pond" : s.id === "S3-local" ? "Hedge Maze" : "Goddess Shrine");
      expect(quest(o.inventory.items), s.id).toEqual(s.id === "S4" ? ["enchanted_shears", "vanity_mirror"] : []);
      if (s.id === "S2" || s.id === "S3" || s.id === "S4" || s.id.endsWith("-local")) expect(o.journal.current?.step).toBe("Recover the Divine Wig");
    }
    expect(starts.S2).toBe(starts.S3);
    expect(starts.S1).toBe(starts.F);
    expect(new Set(Object.values(starts)).size).toBe(5);
  }, 120_000);

  it("measures game time from the scenario's start, and keeps the prefix out of the trace", async () => {
    const lines: TraceEvent[] = [];
    const s4 = SITUATIONS.find((s) => s.id === "S4")!;
    // Steps are taken, so a tuning seed: route development access allows only reset at a final seed.
    const env = new AgentEnvironment({ preset: "S4", prefix: s4.prefix, limits: { maxTicks: 60 }, trace: (e) => lines.push(e), routeDevelopment: ROUTE_DEV });
    const reset = await env.reset(1);
    expect(reset.tick).toBeGreaterThan(9000);
    const [a, b] = await Promise.all([env.step("sieg", { type: "wait", ticks: 60 }), env.step("coco", { type: "wait", ticks: 60 })]);
    expect(a.done && b.done).toBe(true);
    expect(await env.outcome()).toMatchObject({ reason: "tick_limit", ticks: 60 });
    expect(lines[0].type).toBe("reset");
    expect((lines[0].data as { prefix: { name: string } }).prefix.name).toBe("opening scene, Hedge Maze, Mirror Pond");
    expect(lines.filter((l) => l.type === "action")).toHaveLength(2);
  }, 120_000);

  it("reaches start states only through the interface", () => {
    const src = readFileSync(new URL("../src/suite.ts", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
    for (const forbidden of ["GameRoom", "apps/server", ".room", "puzzles", "receiveInput", "useItem(", "transition("])
      expect(src, forbidden).not.toContain(forbidden);
  });
});
