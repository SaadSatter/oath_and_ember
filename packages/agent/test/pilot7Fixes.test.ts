// Regression tests for the pilot-7 observation and prompt changes (owner
// approval 2026-10-28, after pilot-7: S2-local seed 0, gpt-6-luna medium).
// Offline, tuning scenario S2-local at tuning seed 0 only (since suite
// revision 2 that Mirror Pond start is the preserved S2-local-v1; the
// current S3-local is the same start). LABELLED TEST
// FIXTURES place heroes; every outcome comes from real inputs and the
// server's own ticks.
import { describe, expect, it } from "vitest";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { mirrorPondState, pondSpikeState } from "../../shared/src/mirrorPond.js";
import { AgentEnvironment, NOTHING_RESPONDED } from "../src/environment.js";
import { TILE } from "../src/perception.js";
import { systemPrompt } from "../src/policies/llm.js";
import { environmentFor } from "../src/suite.js";
import type { Observation, PlayerId, VisibleThing } from "../src/types.js";

const roomOf = (env: AgentEnvironment) => (env as unknown as { room: GameRoom }).room;
const hero = (env: AgentEnvironment, id: PlayerId) =>
  Object.values(roomOf(env).state.players).find((p) => p.role === (id === "sieg" ? "OATH" : "EMBER"))!;
/** FIXTURE: put a hero at a tile position. */
const place = (env: AgentEnvironment, id: PlayerId, x: number, y: number) => Object.assign(hero(env, id), { x: x * TILE, y: y * TILE });
const cell = (o: Observation, x: number, y: number) => o.screen.rows[y - o.screen.originY]?.[x - o.screen.originX];
const spikes = (o: Observation) => o.visible.filter((v) => v.name === "spike trap").sort((a, b) => a.x - b.x);

async function pond() {
  const env = environmentFor("S2-local-v1");
  await env.reset(0);
  return env;
}

describe("spike columns are drawn and listed at their full height", () => {
  it("lists every column with its four-tile extent and draws every visible cell in its current phase", async () => {
    const env = await pond();
    place(env, "sieg", 44.5, 26); // FIXTURE: at the corridor mouth
    const o = await env.observe("sieg");
    const clock = mirrorPondState(roomOf(env).state.puzzles)!.clock;
    const s = spikes(o);
    expect(s).toHaveLength(4);
    s.forEach((v, i) => {
      // Name, centre and phase are unchanged (the scripted players read them).
      expect(v, `column ${i}`).toMatchObject({ kind: "object", x: 40.5 + i, y: 26, details: pondSpikeState(clock, i).phase, extent: { x: 40 + i, y: 24, w: 1, h: 4 } });
      // Only what is drawn: no timer, progress or future phase.
      expect(Object.keys(v).sort()).toEqual(["details", "direction", "distance", "extent", "kind", "name", "ref", "x", "y"]);
      for (let y = 24; y < 28; y++) expect(cell(o, 40 + i, y), `cell ${40 + i},${y}`).toBe(v.details === "raised" ? "^" : "o");
    });
  });

  it("follows the phases as time passes, and lists a column whose centre is off screen", async () => {
    const env = await pond();
    // At the start Sieg's screen begins at row 27: only the bottom plates show.
    const start = await env.observe("sieg");
    expect(start.screen.originY).toBe(27);
    expect(spikes(start).map((v) => v.extent)).toEqual([40, 41, 42, 43].map((x) => ({ x, y: 24, w: 1, h: 4 })));
    expect([40, 41, 42, 43].map((x) => cell(start, x, 27))).not.toContain(".");
    const seen = new Set<string>();
    for (let k = 0; k < 24; k++) {
      await Promise.all([env.step("sieg", { type: "wait", ticks: 5 }), env.step("coco", { type: "wait", ticks: 5 })]);
      const o = await env.observe("sieg");
      const clock = mirrorPondState(roomOf(env).state.puzzles)!.clock;
      spikes(o).forEach((v, i) => {
        expect(v.details).toBe(pondSpikeState(clock, i).phase);
        seen.add(v.details!);
        expect(cell(o, 40 + i, 27)).toBe(v.details === "raised" ? "^" : "o");
      });
    }
    expect(seen.has("raised") && seen.has("down")).toBe(true);
  });

  it("draws people over the plates, not plates over people", async () => {
    const env = await pond();
    place(env, "sieg", 44.5, 26); // FIXTURES: Sieg beside the corridor,
    place(env, "coco", 42.5, 26.5); // Coco drawn on a plate (a drawing check only)
    const o = await env.observe("sieg");
    expect(cell(o, 42, 26)).toBe("P");
    expect(cell(o, 44, 26)).toBe("@");
  });
});

describe("painted text is listed as a label, not an object", () => {
  it("keeps the text and position, with no screen character", async () => {
    const env = await pond();
    place(env, "sieg", 45, 27); // FIXTURE: both pond-edge labels in view
    const o = await env.observe("sieg");
    const labels = o.visible.filter((v) => v.kind === "label");
    expect(labels.map(({ name, x, y }) => ({ name, x, y }))).toEqual(
      expect.arrayContaining([
        { name: "SIEG · Super Speed (2) · East spike entrance", x: 45, y: 23.8 },
        { name: "COCO · Flight (2) · Water culvert → pond", x: 44, y: 31.6 },
      ]),
    );
    expect(o.visible.some((v) => v.kind === "object" && /East spike entrance|Water culvert/.test(v.name))).toBe(false);
    // The cells under them show what lies there: wall above the corridor, open court below.
    expect(cell(o, 45, 23)).toBe("#");
    expect(cell(o, 44, 31)).toBe(".");
  });

  it("lists the floor markings on the pads as labels", async () => {
    const env = await pond();
    place(env, "coco", 22, 25); // FIXTURE: on the south pad
    const o = await env.observe("coco");
    const marking = o.visible.find((v: VisibleThing) => v.name.startsWith("floor marking A4"));
    expect(marking).toMatchObject({ kind: "label", name: "floor marking A4 ↓", x: 22, y: 25 });
    expect(cell(o, 22, 25)).toBe("@");
  });
});

describe("an E press that changes nothing says so", () => {
  it("reports a press with nothing in reach, accepted, and stops nothing else", async () => {
    const env = await pond();
    const [r] = await Promise.all([env.step("sieg", { type: "interact" }), env.step("coco", { type: "wait", ticks: 2 })]);
    expect(r).toMatchObject({ accepted: true, ticks: 2 });
    expect(r.feedback).toEqual([NOTHING_RESPONDED]);
    expect((await env.observe("sieg")).feedback).toContain(NOTHING_RESPONDED);
    expect((await env.observe("coco")).feedback).not.toContain(NOTHING_RESPONDED);
  });

  it("does not report a press on a label: the label is not a target, and the press is answered the same way", async () => {
    const env = await pond();
    place(env, "coco", 44, 31.6); // FIXTURE: standing on the culvert text
    const [, r] = await Promise.all([env.step("sieg", { type: "wait", ticks: 2 }), env.step("coco", { type: "interact" })]);
    expect(r.feedback).toEqual([NOTHING_RESPONDED]);
  });

  it("is silent when the press travels (the RETURN marker), and reports the press the server ignores just after arrival", async () => {
    const env = await pond();
    place(env, "sieg", 46.5, 34); // FIXTURE: on the Return marker
    // Travel is not accepted in the first second after arriving: E does nothing yet.
    const [early] = await Promise.all([env.step("sieg", { type: "interact" }), env.step("coco", { type: "wait", ticks: 2 })]);
    expect(early.feedback).toEqual([NOTHING_RESPONDED]);
    expect((await env.observe("sieg")).area.name).toBe("Mirror Pond");
    await Promise.all([env.step("sieg", { type: "wait", ticks: 60 }), env.step("coco", { type: "wait", ticks: 60 })]);
    const [r] = await Promise.all([env.step("sieg", { type: "interact" }), env.step("coco", { type: "wait", ticks: 2 })]);
    expect(r.interrupted).toMatch(/You arrived at/);
    expect(r.feedback).not.toContain(NOTHING_RESPONDED);
  });

  it("is silent when the world changes while the press runs, even with no visible result", async () => {
    const env = await pond();
    // FIXTURES: Sieg on the bank beside mirror M1, where a push turns it.
    place(env, "sieg", 37, 9);
    const before = mirrorPondState(roomOf(env).state.puzzles)!.mirrors[0];
    await Promise.all([env.step("sieg", { type: "move", direction: "se", ticks: 1 }), env.step("coco", { type: "wait", ticks: 1 })]);
    const [, r] = await Promise.all([env.step("sieg", { type: "ability", ability: "push", ticks: 2 }), env.step("coco", { type: "interact" })]);
    expect(mirrorPondState(roomOf(env).state.puzzles)!.mirrors[0]).not.toBe(before);
    expect(r).toMatchObject({ accepted: true });
    expect(r.feedback).not.toContain(NOTHING_RESPONDED);
  });

  it("is deterministic", async () => {
    const run = async () => {
      const env = await pond();
      const [r] = await Promise.all([env.step("sieg", { type: "interact" }), env.step("coco", { type: "interact" })]);
      return [r.feedback, env.evaluatorReport().stateHash];
    };
    expect(await run()).toEqual(await run());
  });
});

describe("communication rules in the system prompt", () => {
  const prompts = (["Sieg", "Coco"] as const).flatMap((h) => [systemPrompt(h, "MANUAL"), systemPrompt(h, "MANUAL", 1, "none")]);
  it("are the same for both heroes and every player variant", () => {
    for (const p of prompts) {
      expect(p).toContain("Report only progress your own observation supports");
      expect(p).toContain('Say clearly when something is a guess ("I think…", "maybe") rather than something you saw happen.');
      expect(p).toContain("When your partner asks you a direct question, answer it before repeating your own request.");
      expect(p).toContain("If an action failed or a result says nothing happened, change your approach");
      expect(p).toContain('Labels (kind "label") are text painted or floating in the world');
      expect(p).toContain('"^" a raised hazard');
    }
  });
  it("name no area, puzzle, item or coordinate", () => {
    const general = systemPrompt("Coco", "");
    expect(general).not.toMatch(/\b(pond|mirror|spikes?|culvert|brazier|torch|maze|griffin|wig|shears|flight|super speed|slow time)\b/i);
    expect(general).not.toMatch(/\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*\)/);
  });
});
