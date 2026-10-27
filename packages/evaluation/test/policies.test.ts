import { describe, it, expect } from "vitest";
import { IndependentPlayer } from "../../../agents/players/policy.js";
import type { TextGateway } from "../../../agents/players/modelGateway.js";
import { ExplorationBaseline } from "../src/baseline/heuristic.js";
import { hash, verifyTrace, type TraceEvent } from "../src/trace.js";
import { replay } from "../src/replay.js";
import { readFileSync } from "node:fs";
describe("independent player policies", () => {
  it("keeps role-local transcripts separate until a permitted message arrives", async () => {
    const calls: unknown[] = [];
    const gateway: TextGateway = {
      async complete(messages) {
        calls.push(messages);
        return {
          text: "{}",
          usage: {
            inputTokens: 10,
            outputTokens: 2,
            cost: "unknown",
            latencyMs: 1,
          },
        };
      },
    };
    const sieg = new IndependentPlayer("SIEG", "mechanics", gateway);
    const coco = new IndependentPlayer("COCO", "mechanics", gateway);
    await sieg.decide({
      observation_id: "1",
      observation: { notice: "PRIVATE_MARKER" },
      legal_actions: [],
    });
    await coco.decide({
      observation_id: "2",
      observation: {},
      legal_actions: [],
    });
    expect(JSON.stringify(calls[1])).not.toContain("PRIVATE_MARKER");
    expect(JSON.stringify(calls[1])).toContain("COCO");
  });
  it("does not import maps or solvers into player/baseline dependencies", () => {
    for (const path of [
      "agents/players/policy.ts",
      "agents/players/SiegAgent.ts",
      "agents/players/CocoAgent.ts",
      "packages/evaluation/src/baseline/heuristic.ts",
    ]) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(
        /from ['"].*(?:server|shared|scripts|fixtures|GameRoom|world)/,
      );
      expect(source).not.toMatch(/readFile|readdir|require\(/);
    }
  });
  it("stops when the provider cannot account for token usage", async () => {
    const gateway: TextGateway = {
      async complete() {
        return {
          text: "{}",
          usage: {
            inputTokens: "unknown",
            outputTokens: "unknown",
            cost: "unknown",
            latencyMs: 1,
          },
        };
      },
    };
    const player = new IndependentPlayer("SIEG", "", gateway);
    const view = { observation_id: "1", observation: {}, legal_actions: [] };
    await player.decide(view);
    await expect(player.decide(view)).rejects.toThrow("usage unknown");
  });
  it("baseline uses only supplied opaque UI tokens", () => {
    const baseline = new ExplorationBaseline();
    expect(
      baseline.decide({
        observation_id: "1",
        observation: {},
        legal_actions: [{ token: "opaque", label: "visible" }],
      }),
    ).toMatchObject({ plan: [{ type: "ui", token: "opaque" }] });
  });
});
describe("trace integrity and replay", () => {
  function event(
    sequence: number,
    kind: TraceEvent["kind"],
    payload: unknown,
    previous: string,
  ): TraceEvent {
    const body = { sequence, kind, payload, previous };
    return { ...body, hash: hash(body) };
  }
  it("requires reset and terminal and catches altered exact observations", () => {
    const first = event(0, "reset", {}, "0".repeat(64));
    const last = event(1, "terminal", { outcome: "time_limit" }, first.hash);
    expect(() => verifyTrace([first, last])).not.toThrow();
    expect(() => verifyTrace([first])).toThrow("Incomplete");
    expect(() =>
      verifyTrace([first, { ...last, payload: { outcome: "success" } }]),
    ).toThrow("integrity");
  });
  it("replays effective intents and checks authoritative/public hashes", async () => {
    const first = event(0, "reset", {}, "0".repeat(64));
    const step = event(
      1,
      "effective",
      {
        intents: { ticks: 1 },
        stateHash: hash({ tick: 1 }),
        observationHash: hash({ view: 1 }),
      },
      first.hash,
    );
    const end = event(2, "terminal", {}, step.hash);
    const events = [first, step, end];
    await expect(
      replay(events, async () => ({
        state: { tick: 1 },
        observations: { view: 1 },
      })),
    ).resolves.toBeUndefined();
    await expect(
      replay(events, async () => ({
        state: { tick: 2 },
        observations: { view: 1 },
      })),
    ).rejects.toThrow("Replay mismatch");
  });
});
