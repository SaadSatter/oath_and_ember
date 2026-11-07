// Observation parity for Situation B (griffin-unprepared-v1) with Pilot-31,
// the B pre-tuned run (owner decision 2026-11-06). Commit 4c9cf9f added a
// straw-nest entry to every Griffin Enclosure observation; this scenario now
// leaves it out, and every other scenario keeps it.
//
// Test 1 replays Pilot-31's recorded actions in the trace's own order through
// the ordinary step() and compares every observation with the trace, byte for
// byte. Test 2 uses a clearly labelled unit fixture (a hero placed next to the
// nest by writing World) only to show which scenarios list the nest; it is not
// part of any episode.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { environmentFor } from "../src/suite.js";
import { perceive } from "../src/perception.js";
import type { AgentEnvironment } from "../src/environment.js";
import type { PlayerId } from "../src/types.js";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const TRACE = join(root, "midterms/saadsatter/evidence/traces/pilot-31-model-centralized-griffin-unprepared-v1-seed0/trace.jsonl");
type Rec = { type: string; player?: PlayerId; tick: number; data: Record<string, any> };
// Test-only access to the environment's room and per-hero slots (read, and written only in the labelled fixture).
type Inner = { room: GameRoom; slots: Record<PlayerId, { key: string; memory: any }> };
const inner = (env: AgentEnvironment) => env as unknown as Inner;

describe("griffin-unprepared-v1 observations match Pilot-31", { timeout: 180_000 }, () => {
  it("replaying Pilot-31's actions gives every recorded observation byte for byte, with no nest entry", async () => {
    const records = readFileSync(TRACE, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Rec);
    const got: Record<PlayerId, (string | null)[]> = { sieg: [], coco: [] };
    const env = environmentFor("griffin-unprepared-v1", {
      trace: (e) => { if (e.type === "result" && e.player) got[e.player].push((e.data as { hash?: string }).hash ?? null); },
    });
    const want: Record<PlayerId, (string | null)[]> = { sieg: [], coco: [] };
    const reset = await env.reset(0);
    expect(reset.startHash).toBe("1a270d7b5e456d1be0e3250d37baae26a77b5ca3099b18433a9c8e5a25fb0051");
    const pending: Partial<Record<PlayerId, Promise<unknown>>> = {};
    let observations = 0, results = 0, nestByDefault = 0;
    for (const r of records) {
      const p = r.player!;
      if (r.type === "action") pending[p] = env.step(p, r.data.action as never) as never;
      else if (r.type === "result") {
        await pending[p];
        want[p].push(r.data.hash ?? null);
        results++;
      } else if (r.type === "observation") {
        if (pending[p]) await pending[p];
        const o = await env.observe(p);
        expect(JSON.stringify(o)).toBe(JSON.stringify(r.data.observation));
        expect(o.visible.some((v) => v.name === "nest")).toBe(false);
        // The default contract (used by every other scenario) still lists the nest here.
        const { room, slots } = inner(env);
        const dflt = perceive(room, p, slots[p].key, slots[p].memory, { labels: "as-drawn" });
        if (dflt.visible.some((v) => v.name === "nest")) nestByDefault++;
        observations++;
      }
    }
    // The game itself replayed identically: every step result hash matches.
    expect(got).toEqual(want);
    expect(observations).toBe(293);
    expect(results).toBe(284);
    // Pilot-31 observations where the nest was on screen (the only difference before this change).
    expect(nestByDefault).toBe(56);
  });

  it("only griffin-unprepared-v1 leaves the nest out (labelled unit fixture: hero placed beside the nest)", async () => {
    const nestListed = async (id: "griffin-unprepared-v1" | "griffin-unprepared-return-v1") => {
      const env = environmentFor(id);
      await env.reset(0);
      const { room, slots } = inner(env);
      const me = room.state.players[slots.coco.key];
      // FIXTURE (test only): put Coco on the ground just south of the drawn nest.
      me.x = 640;
      me.y = 200;
      const o = await env.observe("coco");
      expect(o.area.name).toBe("Griffin Enclosure");
      return o.visible.some((v) => v.name === "nest");
    };
    expect(await nestListed("griffin-unprepared-v1")).toBe(false);
    expect(await nestListed("griffin-unprepared-return-v1")).toBe(true);
  });
});
