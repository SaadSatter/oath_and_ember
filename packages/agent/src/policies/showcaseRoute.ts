// SCRIPTED BASELINE for the showcase scenario showcase-maze-griffin-complete-v1
// (docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md). It is a free validation
// player, labelled as a baseline, never presented as a model, and excluded
// from the A/B/C evaluation. It exists to prove, with no model calls, that the
// continuous route (maze, travel, Griffin combat, wig, offering, finale) is
// possible through the five-operation interface, and to exercise the
// recorder, trace and replay checks end to end.
//
// It composes the two frozen baselines without changing them:
//   1. Hedge Maze, until this hero's backpack panel lists the Enchanted Shears:
//      baseline-maze-heuristic-v2 (MazeHeuristic), unchanged.
//   2. Travel: an observation-only walk to a visible exit by its drawn label
//      (the maze's "E · RETURN", then the shrine's "NORTH · GRIFFIN TRAIL"),
//      over this hero's own remembered screens, exploring when the exit has
//      not been seen yet. No coordinates or routes are supplied.
//   3. From the Griffin Enclosure on: baseline-griffin-heuristic-v1
//      (GriffinHeuristic), unchanged. It fights first, uses the nest only
//      after a visible defeat, returns and offers the wig.
// Each hero has its own instance and memory. It reads only its observation.

import type { ActionSpec, Direction, GameAction, Observation, StepResult } from "../types.js";
import type { Decision, Policy, TurnReport } from "./policy.js";
import { MazeHeuristic } from "./mazeHeuristic.js";
import { GriffinHeuristic } from "./griffinHeuristic.js";
import { planStep } from "./navigate.js";

const cell = (x: number, y: number) => `${Math.floor(x)},${Math.floor(y)}`;
const dirs: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const step: Record<Direction, [number, number]> = { n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1] };

type Phase = "opening" | "maze" | "travel" | "griffin";

/** The exit label each travel leg looks for, by area name. */
const TRAVEL_EXIT: Record<string, RegExp> = { "Hedge Maze": /RETURN/i, "Goddess Shrine": /GRIFFIN/i };

export class ShowcaseRouteBaseline implements Policy {
  readonly name = "baseline-showcase-route-v2(shrine+maze-heuristic-v2+travel+griffin-heuristic-v1)";
  private phase: Phase = "opening";
  private readonly maze: MazeHeuristic;
  private readonly griffin = new GriffinHeuristic();
  // Travel memory (this hero's own screens only).
  private area = "";
  private terrain = new Map<string, string>();
  private visits = new Map<string, number>();
  private blocked = new Map<string, number>();
  private exits = new Map<string, { x: number; y: number }>();
  private lastMove?: Direction;
  private presses = 0;
  private openingSeen = false;
  private openingLine = "";
  private openingLineTick = 0;

  constructor(private readonly hero: "Sieg" | "Coco") {
    this.maze = new MazeHeuristic(hero);
  }

  async decide(input: { observation: Observation; legal: ActionSpec[]; last?: StepResult; batch?: TurnReport }): Promise<Decision> {
    const o = input.observation;
    // Every opening decision uses only this hero's displayed dialogue/area.
    if (this.phase === "opening") {
      if (o.dialogue) {
        this.openingSeen = true;
        const line = JSON.stringify(o.dialogue);
        if (line !== this.openingLine) { this.openingLine = line; this.openingLineTick = o.tick; }
        // A labelled scripted presentation choice: show opening lines for one
        // game second using ordinary waits. No engine/cutscene timing is changed.
        if (o.tick - this.openingLineTick < 60)
          return { action: { type: "wait", ticks: 12 }, note: { showcasePhase: "opening", heuristic: "Read the visible opening line for one game second" } };
      } else if (o.area.name === "Hedge Maze") this.phase = "maze";
      else if (!this.openingSeen)
        return { action: { type: "wait", ticks: 12 }, note: { showcasePhase: "opening", heuristic: "Wait for the normal shrine greeting" } };
      if (this.phase === "opening") return this.travel(o, input.legal, input.last, /HEDGE|MAZE/i);
    }
    const shears = o.inventory.items.some((i) => i.id === "enchanted_shears" && i.count > 0);
    if (this.phase === "maze" && shears) this.phase = "travel";
    if (this.phase === "travel" && o.area.name === "Griffin Enclosure") this.phase = "griffin";
    const tag = (d: Decision): Decision => ({ ...d, note: { showcasePhase: this.phase, ...(d.note ?? {}) } });
    if (this.phase === "maze") return tag(await this.maze.decide(input));
    if (this.phase === "griffin") return tag(await this.griffin.decide(input));
    return tag(this.travel(o, input.legal, input.last));
  }

  private travel(o: Observation, legal: ActionSpec[], last?: StepResult, exitLabel?: RegExp): Decision {
    const can = (t: GameAction["type"]) => legal.some((a) => a.type === t);
    const act = (action: GameAction, why: string): Decision => {
      this.lastMove = action.type === "move" ? action.direction : undefined;
      return { action, note: { heuristic: why } };
    };
    if (this.area !== o.area.name) {
      this.area = o.area.name;
      this.terrain.clear(); this.visits.clear(); this.blocked.clear(); this.exits.clear();
      this.presses = 0;
    }
    if (last?.movement?.blocked && this.lastMove) {
      const [dx, dy] = step[this.lastMove];
      this.blocked.set(cell(o.self.x + dx, o.self.y + dy), o.tick + 300);
    }
    for (const [k, until] of this.blocked) if (until <= o.tick) this.blocked.delete(k);
    o.screen.rows.forEach((r, y) => [...r].forEach((c, x) => {
      if (c !== " ") this.terrain.set(cell(x + o.screen.originX, y + o.screen.originY), "@PECo>*".includes(c) ? "." : c);
    }));
    for (const v of o.visible) if (v.kind === "exit") this.exits.set(v.name, { x: v.x, y: v.y });
    const k = cell(o.self.x, o.self.y);
    this.visits.set(k, (this.visits.get(k) ?? 0) + 1);

    if (o.dialogue)
      return act(can("choose_dialogue") ? { type: "choose_dialogue", option: o.dialogue.choices?.[0]?.option ?? 1 } : can("advance_dialogue") ? { type: "advance_dialogue" } : { type: "wait", ticks: 12 }, "Read the dialogue on screen");
    if (!can("move")) return act({ type: "wait", ticks: 12 }, "Wait for the current action");
    const want = exitLabel ?? TRAVEL_EXIT[o.area.name];
    if (!want) return act(this.explore(o), `Explore ${o.area.name}`);
    const exit = [...this.exits.entries()].find(([name]) => want.test(name))?.[1];
    if (!exit) return act(this.explore(o), `Search for the exit labelled ${want.source}`);
    const d = Math.hypot(exit.x - o.self.x, exit.y - o.self.y);
    if (d < 1.3 && can("interact") && this.presses < 3) {
      this.presses++;
      return act({ type: "interact" }, `Press E at the exit labelled ${want.source}`);
    }
    if (d < 1.3) this.presses = 0;
    const a = this.approach(o, exit);
    return act(a ?? this.explore(o), a ? `Walk to the exit labelled ${want.source} over remembered screens` : "No known path to the exit yet: explore");
  }

  private grid(o: Observation): Observation {
    return {
      ...o,
      screen: {
        originX: 0, originY: 0,
        rows: Array.from({ length: o.area.heightTiles }, (_, y) =>
          Array.from({ length: o.area.widthTiles }, (_, x) => (this.blocked.has(cell(x, y)) ? "#" : this.terrain.get(cell(x, y)) ?? "#")).join("")),
      },
    };
  }

  private approach(o: Observation, p: { x: number; y: number }): GameAction | undefined {
    const s = planStep(this.grid(o), p, { maxTicks: 12, tolerance: 0.6 });
    return s.kind === "move" ? { type: "move", direction: s.direction, ticks: s.ticks } : undefined;
  }

  /** Breadth-first frontier search over remembered open cells (the same idea as the Griffin heuristic's). */
  private explore(o: Observation): GameAction {
    const open = (x: number, y: number) => {
      const c = this.terrain.get(cell(x, y));
      return !!c && !this.blocked.has(cell(x, y)) && c !== "#" && c !== "^" && c !== "~";
    };
    const start = { x: Math.floor(o.self.x), y: Math.floor(o.self.y), d: 0 };
    const q = [start], seen = new Set([cell(start.x, start.y)]);
    let best = start, score = -Infinity;
    for (let i = 0; i < q.length; i++) {
      const p = q[i];
      const frontier = dirs.filter(([dx, dy]) => !this.terrain.has(cell(p.x + dx, p.y + dy))).length;
      const s = frontier * 25 - (this.visits.get(cell(p.x, p.y)) ?? 0) * 8 - p.d * 0.3;
      if (p.d > 0 && s > score) { best = p; score = s; }
      for (const [dx, dy] of dirs) {
        const x = p.x + dx, y = p.y + dy, key = cell(x, y);
        if (x < 0 || y < 0 || x >= o.area.widthTiles || y >= o.area.heightTiles || seen.has(key) || !open(x, y)) continue;
        seen.add(key);
        q.push({ x, y, d: p.d + 1 });
      }
    }
    return this.approach(o, { x: best.x + 0.5, y: best.y + 0.5 }) ?? { type: "wait", ticks: 20 };
  }
}
