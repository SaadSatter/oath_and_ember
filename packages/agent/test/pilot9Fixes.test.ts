// Regression tests for the pilot-9 observation, Push feedback and prompt
// changes (owner approval 2026-10-29, after pilot-9: S2-local seed 0,
// gpt-6-luna medium). Offline. LABELLED TEST FIXTURES place heroes, and in
// two tests set the cow's position directly to check drawing; every other
// outcome comes from real inputs and the server's own ticks.
import { describe, expect, it } from "vitest";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { hedgeMazeState, mazeCowRect } from "../../shared/src/hedgeMaze.js";
import { mirrorPondState } from "../../shared/src/mirrorPond.js";
import { AgentEnvironment, PUSH_MOVED, PUSH_NOTHING } from "../src/environment.js";
import { MAZE_BAY_SIGN, MAZE_COW_CAPTION, TILE } from "../src/perception.js";
import { asTunedMaze } from "../src/policies/navigate.js";
import { systemPrompt } from "../src/policies/llm.js";
import { environmentFor } from "../src/suite.js";
import type { GameAction, Observation, PlayerId, StepResult } from "../src/types.js";

const roomOf = (env: AgentEnvironment) => (env as unknown as { room: GameRoom }).room;
const hero = (env: AgentEnvironment, id: PlayerId) =>
  Object.values(roomOf(env).state.players).find((p) => p.role === (id === "sieg" ? "OATH" : "EMBER"))!;
/** FIXTURE: put a hero at a tile position. */
const place = (env: AgentEnvironment, id: PlayerId, x: number, y: number) => Object.assign(hero(env, id), { x: x * TILE, y: y * TILE });
const cell = (o: Observation, x: number, y: number) => o.screen.rows[y - o.screen.originY]?.[x - o.screen.originX];
const inRect = (q: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h;
const centre = (x: number, y: number) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });

async function inMaze(at: Record<PlayerId, { x: number; y: number }>) {
  const env = new AgentEnvironment({ preset: "milestone" });
  await env.reset(0);
  roomOf(env).transition("HEDGE_MAZE");
  for (const id of ["sieg", "coco"] as PlayerId[]) place(env, id, at[id].x, at[id].y);
  return env;
}

/** Runs each hero's script; the other hero waits. Returns the scripted results. */
async function play(env: AgentEnvironment, script: Partial<Record<PlayerId, GameAction[]>>) {
  const ids: PlayerId[] = ["sieg", "coco"];
  const queue: Record<PlayerId, GameAction[]> = { sieg: [...(script.sieg ?? [])], coco: [...(script.coco ?? [])] };
  const out: Record<PlayerId, StepResult[]> = { sieg: [], coco: [] };
  const busy = new Map<PlayerId, Promise<void>>();
  for (let guard = 0; guard < 5000; guard++) {
    if ((await env.outcome()).status !== "ongoing") break;
    for (const id of ids) {
      if (busy.has(id)) continue;
      const other = id === "sieg" ? "coco" : "sieg";
      let action: GameAction | undefined;
      let scripted = false;
      if ((await env.legal_actions(id)).some((x) => x.type === "advance_dialogue")) action = { type: "advance_dialogue" };
      else if (queue[id].length) [action, scripted] = [queue[id].shift(), true];
      else if (queue[other].length || busy.has(other)) action = { type: "wait", ticks: 1 };
      if (!action) continue;
      busy.set(id, env.step(id, action).then((r) => {
        if (scripted) out[id].push(r);
        busy.delete(id);
      }));
    }
    if (!busy.size) break;
    await Promise.race(busy.values());
  }
  return out;
}

/** Cells near the cow: "C" exactly where the engine's cow rectangle covers the cell centre (the terrain rule). */
function expectCowCells(o: Observation, cowX: number) {
  const rect = { x: cowX * TILE - 64, y: 25 * TILE - 64, w: 128, h: 128 }; // mazeCowRect
  for (let y = 21; y <= 28; y++)
    for (let x = Math.floor(cowX) - 4; x <= Math.floor(cowX) + 4; x++) {
      const ch = cell(o, x, y);
      if (ch === undefined || ch === "@" || ch === "P") continue;
      expect(ch === "C", `cell (${x},${y}) is "${ch}" with the cow at x ${cowX}`).toBe(inRect(centre(x, y), rect));
    }
}

describe("Hedge Maze captions are labels, not objects", () => {
  it("lists both captions as labels with no grid mark; the hedge cell under the arrow stays '#'", async () => {
    const env = await inMaze({ sieg: { x: 21, y: 24.5 }, coco: { x: 5, y: 34 } });
    const o = await env.observe("sieg");
    const cap = o.visible.find((v) => v.name === MAZE_COW_CAPTION)!;
    const bay = o.visible.find((v) => v.name === MAZE_BAY_SIGN)!;
    expect(cap).toMatchObject({ kind: "label", x: 26, y: 27.7 });
    expect(bay).toMatchObject({ kind: "label", x: 22.2, y: 22.2 });
    expect(cap.extent).toBeUndefined();
    expect(cell(o, 22, 22)).toBe("#");
    expect(o.screen.rows.join("")).not.toContain("o"); // nothing else here draws "o"
    expect(o.visible.filter((v) => v.kind === "object").map((v) => v.name)).not.toContain(MAZE_BAY_SIGN);
  });

  it("keeps the genuine objects as objects: dry hedge, key gate and shears chest", async () => {
    const hedge = await inMaze({ sieg: { x: 16, y: 34 }, coco: { x: 5, y: 34 } });
    const h = (await hedge.observe("sieg")).visible.find((v) => v.name === "FIREBALL · dry hedge");
    expect(h).toMatchObject({ kind: "object" });
    const gate = await inMaze({ sieg: { x: 38.5, y: 14 }, coco: { x: 5, y: 34 } });
    const g = await gate.observe("sieg");
    expect(g.visible.find((v) => v.name === "E · key gate")).toMatchObject({ kind: "object", details: "closed" });
    const chest = await inMaze({ sieg: { x: 43.5, y: 8 }, coco: { x: 5, y: 34 } });
    const c = (await chest.observe("sieg")).visible.find((v) => /shears/i.test(v.name));
    expect(c).toMatchObject({ kind: "object", details: "closed" });
  });

  it("a caption is not a target: nothing is in the backpack panel's reach and use_item is not offered", async () => {
    // (The "nothing responded" line is not asserted: in the maze the roaming
    // key carrier changes puzzle state on its own, which suppresses it.)
    const env = await inMaze({ sieg: { x: 21.5, y: 23.5 }, coco: { x: 5, y: 34 } });
    expect((await env.observe("sieg")).inventory.nearbyTarget).toBeUndefined();
    expect((await env.legal_actions("sieg")).map((a) => a.type)).not.toContain("use_item");
  });
});

describe("the cow is drawn across its 4×4 body", () => {
  it("lists the cow with its extent and draws every occupied cell 'C', not '#'", async () => {
    const env = await inMaze({ sieg: { x: 26, y: 29.5 }, coco: { x: 5, y: 34 } });
    const o = await env.observe("sieg");
    const cow = o.visible.find((v) => v.name === "cow")!;
    expect(cow).toMatchObject({ kind: "creature", x: 26, y: 25, extent: { x: 24, y: 23, w: 4, h: 4 } });
    for (let y = 23; y <= 26; y++) for (let x = 24; x <= 27; x++) expect(cell(o, x, y), `${x},${y}`).toBe("C");
    expectCowCells(o, 26);
  });

  it("marks exactly the cells the engine's rectangle covers, at whole and half tile positions (FIXTURE: cow placed)", async () => {
    for (const x of [25.2, 24.5, 24.1, 23.84]) {
      const env = await inMaze({ sieg: { x: 26.5, y: 29.5 }, coco: { x: 5, y: 34 } });
      hedgeMazeState(roomOf(env).state.puzzles)!.cow.x = x * TILE; // FIXTURE
      const o = await env.observe("sieg");
      const cow = o.visible.find((v) => v.name === "cow")!;
      expect(cow.extent, String(x)).toMatchObject({ y: 23, w: 4, h: 4 });
      expect(cow.extent!.x, String(x)).toBeCloseTo(x - 2, 2);
      expectCowCells(o, x);
    }
  });

  it("follows a real Black Hole pull: the extent, the 'C' cells and the feedback all move (pilot-9 tick 3539)", async () => {
    const env = await inMaze({ sieg: { x: 5, y: 34 }, coco: { x: 21.53, y: 23.47 } });
    const before = (await env.observe("coco")).visible.find((v) => v.name === "cow")!;
    const r = await play(env, {
      coco: [{ type: "ability", ability: "black_hole", direction: "e" }, { type: "wait", ticks: 60 }, { type: "wait", ticks: 60 }, { type: "wait", ticks: 60 }, { type: "wait", ticks: 60 }, { type: "wait", ticks: 60 }],
    });
    const o = await env.observe("coco");
    const cow = o.visible.find((v) => v.name === "cow")!;
    expect(before.extent).toEqual({ x: 24, y: 23, w: 4, h: 4 });
    // How far it slides depends on where the heroes stand (pilot-9: 23.84 once Coco walked on).
    expect(cow.x).toBeLessThan(25);
    expect(cow.extent!.x).toBeCloseTo(cow.x - 2, 1);
    expectCowCells(o, cow.x);
    expect(r.coco.flatMap((x) => x.feedback).join(" ")).toMatch(/The cow moved w, from \(26, 25\)/);
    // No hidden state: the caption is unchanged text and nothing says parked or cleared.
    expect(o.visible.find((v) => v.name === MAZE_COW_CAPTION)).toMatchObject({ kind: "label", x: 26, y: 27.7 });
    expect(JSON.stringify(o)).not.toMatch(/parked|cleared/i);
  });
});

describe("the scripted players' view is unchanged (asTunedMaze)", () => {
  it("rebuilds the earlier screen exactly: cow cells back to '#', its centre 'C', the arrow's cell 'o'", async () => {
    for (const x of [26, 25.2, 24.5, 23.84]) {
      const env = await inMaze({ sieg: { x: 21, y: 24.5 }, coco: { x: 5, y: 34 } });
      const maze = hedgeMazeState(roomOf(env).state.puzzles)!;
      maze.cow.x = x * TILE; // FIXTURE
      if (x < 24) place(env, "sieg", 20.5, 24.5); // stay clear of the cow's body
      const o = await env.observe("sieg");
      const legacy = asTunedMaze(o);
      const rect = mazeCowRect(maze);
      for (let r = 0; r < o.screen.rows.length; r++)
        for (let c = 0; c < o.screen.rows[r].length; c++) {
          const cx = o.screen.originX + c,
            cy = o.screen.originY + r;
          const was = legacy.screen.rows[r][c],
            now = o.screen.rows[r][c];
          const expected =
            cx === Math.floor(x) && cy === 25 ? "C" : cx === 22 && cy === 22 ? "o" : inRect(centre(cx, cy), rect) && now === "C" ? "#" : now;
          expect(was, `${x}: (${cx},${cy})`).toBe(expected);
        }
      // Everything other than the screen is untouched.
      expect({ ...legacy, screen: null }).toEqual({ ...o, screen: null });
    }
  });

  it("leaves other areas alone", async () => {
    const env = environmentFor("S3-local");
    await env.reset(0);
    const o = await env.observe("sieg");
    expect(asTunedMaze(o)).toBe(o);
  });
});

describe("Push reports walking like a move, and whether anything moved", () => {
  // The maze entrance row is open from x 0 to 18 and y 32 to 36.
  it("unobstructed: full movement, no blocked line, nothing moved", async () => {
    const env = await inMaze({ sieg: { x: 5, y: 34 }, coco: { x: 9, y: 35 } });
    const [r] = (await play(env, { sieg: [{ type: "ability", ability: "push", direction: "e", ticks: 30 }] })).sieg;
    expect(r.movement).toMatchObject({ outcome: "full", blocked: false, from: { x: 5, y: 34 } });
    expect(r.feedback).toContain(PUSH_NOTHING);
    expect(r.feedback.join(" ")).not.toMatch(/blocked|stopped you/);
  });

  it("partially completed: stopped by the hedge partway", async () => {
    const env = await inMaze({ sieg: { x: 5, y: 33 }, coco: { x: 9, y: 35 } });
    const [r] = (await play(env, { sieg: [{ type: "ability", ability: "push", direction: "n", ticks: 30 }] })).sieg;
    expect(r.movement).toMatchObject({ outcome: "partial", blocked: true });
    expect(r.movement!.movedTiles).toBeGreaterThan(0.3);
    expect(r.movement!.movedTiles).toBeLessThan(r.movement!.requestedTiles);
    expect(r.feedback.join(" ")).toMatch(/You moved n only .* Something stopped you\./);
    expect(r.feedback).toContain(PUSH_NOTHING);
  });

  it("blocked at once: against the cow, as Sieg did in pilot-9; the cow does not move", async () => {
    const env = await inMaze({ sieg: { x: 26.1, y: 27.4 }, coco: { x: 5, y: 34 } });
    roomOf(env).state.enemies = {}; // FIXTURE: no maze guards, so no hit interrupts the push
    const [r] = (await play(env, { sieg: [{ type: "ability", ability: "push", direction: "n", ticks: 30 }] })).sieg;
    expect(r.movement).toMatchObject({ outcome: "none", blocked: true });
    expect(r.feedback.join(" ")).toMatch(/^Your push n was blocked at once/m);
    expect(r.feedback).toContain(PUSH_NOTHING);
    expect(hedgeMazeState(roomOf(env).state.puzzles)!.cow.x).toBe(26 * TILE);
  });

  it("without a direction: no movement report, still says whether anything moved", async () => {
    const env = await inMaze({ sieg: { x: 5, y: 34 }, coco: { x: 9, y: 35 } });
    const [r] = (await play(env, { sieg: [{ type: "ability", ability: "push", ticks: 20 }] })).sieg;
    expect(r.movement).toBeUndefined();
    expect(r.feedback).toEqual([PUSH_NOTHING]);
  });

  it("moving an object is reported separately from walking: a pond mirror turns (FIXTURE: Sieg at the quest's push spot)", async () => {
    const env = environmentFor("S3-local");
    await env.reset(0);
    await play(env, { sieg: [{ type: "wait", ticks: 90 }], coco: [{ type: "wait", ticks: 90 }] }); // arrival dialogue
    place(env, "sieg", 37, 9);
    hero(env, "sieg").facing = Math.PI / 2; // FIXTURE: facing south, toward the mirror at (38, 12)
    const before = [...mirrorPondState(roomOf(env).state.puzzles)!.mirrors];
    const [r] = (await play(env, { sieg: [{ type: "ability", ability: "push", ticks: 45 }] })).sieg;
    expect(mirrorPondState(roomOf(env).state.puzzles)!.mirrors).not.toEqual(before);
    expect(r.feedback).toContain(PUSH_MOVED);
    expect(r.feedback).not.toContain(PUSH_NOTHING);
  });

  it("is deterministic", async () => {
    const run = async () => {
      const env = await inMaze({ sieg: { x: 5, y: 33 }, coco: { x: 9, y: 35 } });
      return (await play(env, { sieg: [{ type: "ability", ability: "push", direction: "n", ticks: 30 }] })).sieg[0];
    };
    expect(await run()).toEqual(await run());
  });
});

describe("communication rules in the general prompt", () => {
  it("adds the pilot-9 rules for both heroes and memories, with no scenario content and no message limit", () => {
    for (const hero of ["Sieg", "Coco"] as const)
      for (const memory of ["history", "none"] as const) {
        const s = systemPrompt(hero, "", 4, memory);
        expect(s).toContain("trust what you see now, and tell your partner what changed");
        expect(s).toContain("a creature or object that moved, a passage that opened, or something that appeared or disappeared");
        expect(s).toContain("Do not repeat information your partner has already acknowledged");
        expect(s).toContain("Send a message only when you have new information or need to coordinate an action");
        expect(s).toContain('Say clearly when something is a guess');
        expect(s).toContain("walking while pushing is not the same as moving an object");
        expect(s).not.toMatch(/Mirror Pond|Hedge Maze|cow|grazing|Black Hole|Enchanted|Vanity|\(\s*\d+\s*,\s*\d+\s*\)/);
        expect(s).not.toMatch(/at most \d+ messages|message limit/i);
      }
  });
});
