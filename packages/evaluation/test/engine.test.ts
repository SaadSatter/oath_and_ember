import { describe, it, expect } from "vitest";
import { Episode } from "../src/episode.js";
import { EvaluationEngine } from "../src/engineHost.js";
import type { PresentationBoundary } from "../src/contract.js";
import { emptyInventory } from "../../shared/src/items.js";
import { createApp } from "../../../apps/server/src/app.js";
const boundary: PresentationBoundary = {
  observe: () => ({ visible: "shrine" }),
  legalActions: () => [],
  activate: () => {
    throw Error("Not visible");
  },
};
async function run(seed: number) {
  const engine = new EvaluationEngine(boundary, { maxTicks: 3 });
  await engine.reset(seed);
  const a = await engine.observe("SIEG"),
    b = await engine.observe("COCO");
  await Promise.all([
    engine.step("SIEG", {
      observation_id: a.observation_id,
      action_id: "a",
      plan: [{ type: "wait", ticks: 3 }],
    }),
    engine.step("COCO", {
      observation_id: b.observation_id,
      action_id: "b",
      plan: [{ type: "wait", ticks: 3 }],
    }),
  ]);
  return engine.outcome();
}
describe("trusted evaluation host", () => {
  it("repeated observe is idempotent and reset invalidates old observation IDs", async () => {
    const e = new EvaluationEngine(boundary);
    await e.reset();
    const first = await e.observe("SIEG");
    expect(await e.observe("SIEG")).toEqual(first);
    await e.reset();
    expect((await e.observe("SIEG")).observation_id).not.toBe(
      first.observation_id,
    );
  });
  it("budget stop releases pending player without later ticks", async () => {
    const e = new EvaluationEngine(boundary);
    await e.reset();
    const a = await e.observe("SIEG");
    const p = e.step("SIEG", {
      observation_id: a.observation_id,
      action_id: "a",
      plan: [{ type: "wait", ticks: 2 }],
    });
    const rejected = expect(p).rejects.toThrow("token_budget");
    e.stop("token_budget");
    await rejected;
    expect(e.outcome().ticks).toBe(0);
    await expect(
      e.step("COCO", {
        observation_id: "x",
        action_id: "b",
        plan: [{ type: "wait", ticks: 2 }],
      }),
    ).rejects.toThrow("terminated");
  });
  it("invalid partner releases a queued valid player", async () => {
    const e = new EvaluationEngine(boundary);
    await e.reset();
    const a = await e.observe("SIEG");
    const p = e.step("SIEG", {
      observation_id: a.observation_id,
      action_id: "a",
      plan: [{ type: "wait", ticks: 2 }],
    });
    const rejected = expect(p).rejects.toThrow("Stale");
    await expect(
      e.step("COCO", {
        observation_id: "bad",
        action_id: "b",
        plan: [{ type: "wait", ticks: 2 }],
      }),
    ).rejects.toThrow("Stale");
    await rejected;
    expect(e.outcome().ticks).toBe(0);
  });
  it("success at the final tick takes precedence over timeout", () => {
    const episode = new Episode(1);
    episode.tick(true);
    expect(episode.outcome().reason).toBe("success");
    expect(episode.outcome().ticks).toBe(1);
  });
  it("cancellation between ticks never advances later work", async () => {
    let e: EvaluationEngine;
    e = new EvaluationEngine({
      ...boundary,
      afterTick: () => {
        e.cancel();
      },
    });
    await e.reset();
    const a = await e.observe("SIEG"),
      b = await e.observe("COCO");
    const results = await Promise.allSettled([
      e.step("SIEG", {
        observation_id: a.observation_id,
        action_id: "a",
        plan: [{ type: "wait", ticks: 5 }],
      }),
      e.step("COCO", {
        observation_id: b.observation_id,
        action_id: "b",
        plan: [{ type: "wait", ticks: 5 }],
      }),
    ]);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(e.outcome().ticks).toBe(1);
  });
  it("pairs decisions and counts exact deterministic ticks", async () => {
    expect(await run(10)).toEqual(await run(10));
    expect((await run(10)).reason).toBe("time_limit");
  });
  it("never advances with only one player decision and cancels pending work", async () => {
    const e = new EvaluationEngine(boundary);
    await e.reset();
    const a = await e.observe("SIEG");
    const p = e.step("SIEG", {
      observation_id: a.observation_id,
      action_id: "a",
      plan: [{ type: "wait", ticks: 2 }],
    });
    const rejected = expect(p).rejects.toThrow("manual_cancel");
    expect(e.outcome().ticks).toBe(0);
    e.cancel();
    await rejected;
    expect(e.outcome().reason).toBe("manual_cancel");
  });
  it("rejects stale, excessive and unknown inputs before advancing", async () => {
    const e = new EvaluationEngine(boundary);
    await e.reset();
    const a = await e.observe("SIEG");
    await expect(
      e.step("SIEG", {
        observation_id: "stale",
        action_id: "a",
        plan: [{ type: "wait", ticks: 1 }],
      }),
    ).rejects.toThrow("Stale");
    await expect(
      e.step("SIEG", {
        observation_id: a.observation_id,
        action_id: "b",
        plan: [{ type: "wait", ticks: 241 }],
      }),
    ).rejects.toThrow("240");
    expect(e.outcome().ticks).toBe(0);
    expect(e.outcome().submissions.SIEG).toBe(2);
  });
  it("initializes through ordinary lobby with empty inventory and shrine spawn", async () => {
    const e = new EvaluationEngine(boundary);
    await e.reset(5, (room) => {
      expect(room.state.sceneId).toBe("GODDESS_SHRINE");
      expect(room.state.phase).toBe("PLAYING");
      expect(room.state.inventory).toEqual(emptyInventory());
      for (const p of Object.values(room.state.players)) {
        expect(p.connected).toBe(true);
      }
    });
  });
  it("does not activate UI after cancellation during legal-action lookup", async () => {
    let release!: () => void, entered!: () => void;
    const waiting = new Promise<void>(r => { release = r; });
    const started = new Promise<void>(r => { entered = r; });
    let activations = 0;
    const e = new EvaluationEngine({ ...boundary, legalActions: async () => {
      entered(); await waiting; return [{ token: "ui", label: "Continue" }];
    }, activate: () => { activations++; } });
    await e.reset();
    const a = await e.observe("SIEG"), b = await e.observe("COCO");
    const steps = Promise.allSettled([
      e.step("SIEG", { observation_id: a.observation_id, action_id: "a", plan: [{ type: "ui", token: "ui" }] }),
      e.step("COCO", { observation_id: b.observation_id, action_id: "b", plan: [{ type: "wait", ticks: 1 }] }),
    ]);
    await started; e.cancel(); release(); await steps;
    await new Promise(r => setTimeout(r, 0));
    expect(activations).toBe(0);
    expect(e.outcome().ticks).toBe(0);
  });
  it("preserves held controls across decision pauses and keeps remainders local", async () => {
    const e = new EvaluationEngine(boundary);
    let room: any, ids: any;
    await e.reset(1, (r, i) => { room = r; ids = i; });
    for (let n = 0; n < 2; n++) {
      const a = await e.observe("SIEG"), b = await e.observe("COCO");
      const [next] = await Promise.all([
        e.step("SIEG", { observation_id: a.observation_id, action_id: `s${n}`, plan: [{ type: "controls", held: ["primary"], ticks: 1 }] }),
        e.step("COCO", { observation_id: b.observation_id, action_id: `c${n}`, plan: [{ type: "wait", ticks: 240 }] }),
      ]);
      expect(room.sessions.get(ids.SIEG).input.primaryHeld).toBe(true);
      expect((room.sessions.get(ids.SIEG).primaryEdges ?? []).some((edge: { held: boolean }) => !edge.held)).toBe(false);
      expect(next.execution?.remaining).toBe(0);
    }
  });
  it("production default retains realtime ticking", async () => {
    const app = createApp({ startingScene: "GODDESS_SHRINE" });
    try {
      const room = app.manager.create();
      const a = room.add("a").playerId,
        b = room.add("b").playerId;
      room.select(a, "OATH");
      room.select(b, "EMBER");
      room.ready(a, true);
      room.ready(b, true);
      await new Promise((r) => setTimeout(r, 80));
      expect(room.state.serverTick).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });
  it("manual driver disables only opted-in realtime ticking", async () => {
    const app = createApp({
      manualDriver: true,
      startingScene: "GODDESS_SHRINE",
    });
    const room = app.manager.create();
    room.add("a");
    room.add("b");
    const ids = Object.keys(room.state.players);
    room.select(ids[0], "OATH");
    room.select(ids[1], "EMBER");
    room.ready(ids[0], true);
    room.ready(ids[1], true);
    await new Promise((r) => setTimeout(r, 40));
    expect(room.state.serverTick).toBe(0);
    await app.close();
  });
});
