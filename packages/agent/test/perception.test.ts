// Information boundary details decided by the owner on 2026-10-27.
import { describe, expect, it } from "vitest";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { AgentEnvironment } from "../src/environment.js";
import { healthBar } from "../src/perception.js";
import { griffinState } from "../../shared/src/griffin.js";

const roomOf = (env: AgentEnvironment) => (env as unknown as { room: GameRoom }).room;

describe("partner and enemy health match the drawn 36 px bar, in eighths", () => {
  it("rounds to the nearest eighth and never reports a number", () => {
    expect(healthBar(100, 100)).toBe("health bar full");
    expect(healthBar(99, 100)).toBe("health bar about 7/8");
    expect(healthBar(50, 100)).toBe("health bar about 4/8");
    expect(healthBar(12.5, 100)).toBe("health bar about 1/8");
    // A living character always shows a sliver of bar.
    expect(healthBar(1, 100)).toBe("health bar about 1/8");
    expect(healthBar(0, 100)).toBe("health bar about 0/8");
    for (const hp of [3, 37, 64, 81]) expect(healthBar(hp, 100)).not.toMatch(/\d{2}|\d+\/100/);
  });

  it("the partner's entry uses the bar, not HP numbers", async () => {
    const env = new AgentEnvironment();
    await env.reset(1);
    const partner = (await env.observe("sieg")).visible.find((v) => v.kind === "partner");
    expect(partner?.details).toMatch(/^health bar (full|about \d\/8)/);
    expect(JSON.stringify(partner)).not.toMatch(/HP \d/);
  });
});

describe("the griffin as the client draws it", () => {
  it("is listed with the floating label the game prints, and not after it has flown away", async () => {
    const env = new AgentEnvironment();
    await env.reset(2);
    const room = roomOf(env);
    // Labelled fixture: put the party in the enclosure to inspect the screen.
    room.transition("GRIFFIN_ENCLOSURE");
    const g = griffinState(room.state.puzzles)!;
    // Labelled fixture: place the griffin beside Sieg so it is on his screen.
    const sieg = Object.values(room.state.players).find((p) => p.role === "OATH")!;
    Object.assign(g, { x: sieg.x + 96, y: sieg.y - 64 });
    const seen = async () => [...(await env.observe("sieg")).visible, ...(await env.observe("coco")).visible].filter((v) => v.name === "griffin");
    const before = await seen();
    expect(before.length).toBeGreaterThan(0);
    expect(before[0].details).toMatch(/^GRIFFIN \d+\/320 · /);
    // Labelled fixture: the state GriffinView treats as departed.
    g.groomingStage = "DONE";
    expect(await seen()).toEqual([]);
  });
});
