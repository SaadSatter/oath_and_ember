// Scripted exploration BASELINE. It reads only the player's own observation
// and legal actions (the same interface the model uses). It knows no map,
// route, item, puzzle or quest answer: it reads dialogue, explores unseen
// parts of the area and tries exits it can see.

import type {
  ActionSpec,
  Direction,
  GameAction,
  Observation,
  StepResult,
} from "../types.js";
import type { Decision, Policy } from "./policy.js";

const compass: Direction[] = ["e", "se", "s", "sw", "w", "nw", "n", "ne"];
const toward = (dx: number, dy: number): Direction =>
  compass[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
const step: Record<Direction, [number, number]> = {
  n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1],
};

export class ExplorationBaseline implements Policy {
  readonly name = "exploration-baseline";
  private tried = new Set<string>();
  private lastPos = "";
  private stuck = 0;
  private told = false;
  private turn = 0;

  async decide(input: { observation: Observation; legal: ActionSpec[]; last?: StepResult }): Promise<Decision> {
    return { action: this.choose(input.observation, input.legal) };
  }

  private choose(o: Observation, legal: ActionSpec[]): GameAction {
    const can = (t: GameAction["type"]) => legal.some((a) => a.type === t);
    this.turn++;
    if (o.dialogue) {
      if (can("choose_dialogue")) return { type: "choose_dialogue", option: 1 };
      if (can("advance_dialogue")) return { type: "advance_dialogue" };
      return { type: "wait", ticks: 20 };
    }
    if (!can("move")) return { type: "wait", ticks: 20 };

    const pos = `${o.area.name}:${Math.round(o.self.x * 2)},${Math.round(o.self.y * 2)}`;
    this.stuck = pos === this.lastPos ? this.stuck + 1 : 0;
    this.lastPos = pos;

    // Exits on screen that this hero has not tried yet (RETURN ones last).
    const exits = o.visible
      .filter((v) => v.kind === "exit" && !this.tried.has(`${o.area.name}:${v.name}`))
      .sort((a, b) => Number(/RETURN/i.test(a.name)) - Number(/RETURN/i.test(b.name)) || a.distance - b.distance);
    const exit = exits.find((e) => !/RETURN/i.test(e.name)) ?? (this.turn > 40 ? exits[0] : undefined);
    if (exit) {
      if (!this.told && can("message")) {
        this.told = true;
        return { type: "message", text: `I'm heading for the exit marked "${exit.name}".` };
      }
      if (exit.distance <= 1.2) {
        this.tried.add(`${o.area.name}:${exit.name}`);
        return { type: "interact" };
      }
      return this.walk(o, toward(exit.x - o.self.x, exit.y - o.self.y), Math.min(30, Math.ceil(exit.distance * 6)));
    }
    // Otherwise walk toward the nearest unexplored block ("?").
    let best: { d: number; dir: Direction } | undefined;
    o.discovered.exploredRows.forEach((row, by) =>
      [...row].forEach((ch, bx) => {
        if (ch !== "?") return;
        const dx = bx * 4 + 2 - o.self.x, dy = by * 4 + 2 - o.self.y, d = Math.hypot(dx, dy);
        if (!best || d < best.d) best = { d, dir: toward(dx, dy) };
      }),
    );
    return this.walk(o, best?.dir ?? compass[this.turn % 8], 30);
  }

  /** Walks, turning aside when the screen shows a wall ahead or we are stuck. */
  private walk(o: Observation, want: Direction, ticks: number): GameAction {
    const i = compass.indexOf(want);
    const order = [0, 1, -1, 2, -2, 3, -3, 4].map((k) => compass[(i + k + 8) % 8]);
    const free = (d: Direction) => {
      const c = Math.floor(o.self.x) - o.screen.originX + step[d][0];
      const r = Math.floor(o.self.y) - o.screen.originY + step[d][1];
      const ch = o.screen.rows[r]?.[c];
      return ch !== undefined && ch !== "#" && ch !== "~" && ch !== " ";
    };
    const options = order.filter(free);
    const dir = this.stuck > 0 ? (options[this.stuck % Math.max(1, options.length)] ?? want) : (options[0] ?? want);
    return { type: "move", direction: dir, ticks: Math.max(6, ticks) };
  }
}
