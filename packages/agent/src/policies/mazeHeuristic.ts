// Deterministic puzzle-rule baseline. No route coordinates, engine or scenario imports.
// Each hero remembers only its own screens; ordinary step() validates every action.
import type {
  ActionSpec,
  Direction,
  GameAction,
  Observation,
  StepResult,
} from "../types.js";
import type { Decision, Policy } from "./policy.js";
import { HeroMemory } from "../heroMemory.js";
import { pullPreview } from "./pullPreview.js";
import { directionTo, planStep } from "./navigate.js";
import { planFight } from "./combat.js";

type Point = { x: number; y: number };
const key = (p: Point) => `${Math.floor(p.x)},${Math.floor(p.y)}`;
const moves: [Direction, number, number][] = [
  ["e", 1, 0],
  ["n", 0, -1],
  ["w", -1, 0],
  ["s", 0, 1],
];
export class MazeHeuristic implements Policy {
  readonly name = "baseline-maze-heuristic-v2";
  private memory: HeroMemory;
  private cells = new Map<string, string>();
  private visits = new Map<string, number>();
  private attempts = new Set<string>();
  private area = "";
  private blocked = new Set<string>();
  private objects = new Map<string, Observation["visible"][number]>();
  private previous?: { from: string; direction: Direction };
  private pending?: {
    signature: string;
    cow: Point;
    until: number;
    retreat: Point;
  };
  private opened = new Set<string>();
  private gateApproaches = new Map<
    string,
    { gate: Point; entry: Point; axis: "x" | "y" }
  >();
  private passage?: {
    gate: Point;
    axis: "x" | "y";
    sign: number;
    goal: Point;
    until: number;
  };
  private measuredSpeed?: number;
  private cowSearchDecisions = 0;
  private lastEffect = "No pull attempted.";
  constructor(hero: "Sieg" | "Coco") {
    this.memory = new HeroMemory(hero);
  }

  async decide({
    observation: o,
    legal,
    last,
  }: {
    observation: Observation;
    legal: ActionSpec[];
    last?: StepResult;
  }): Promise<Decision> {
    const can = (type: GameAction["type"]) =>
      legal.some((a) => a.type === type);
    const act = (action: GameAction, reason: string): Decision => ({
      action,
      note: {
        heuristic: reason,
        pullEffect: this.lastEffect,
        attemptedConfigurations: this.attempts.size,
      },
    });
    this.memory.observe(o);
    if (
      last?.movement &&
      last.movement.ticks.applied > 0 &&
      !last.movement.blocked
    )
      this.measuredSpeed =
        last.movement.requestedTiles / last.movement.ticks.applied;

    if (last?.movement?.outcome === "none" && this.previous)
      this.blocked.add(`${this.previous.from}:${this.previous.direction}`);
    this.previous = undefined;
    if (this.area !== o.area.name) {
      this.cells.clear();
      this.visits.clear();
      this.objects.clear();
      this.blocked.clear();
      this.opened.clear();
      this.gateApproaches.clear();
      this.passage = undefined;
      this.area = o.area.name;
    }
    o.screen.rows.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (!"@PEC*".includes(c))
          this.cells.set(`${x + o.screen.originX},${y + o.screen.originY}`, c);
      }),
    );
    this.cells.set(key(o.self), ".");
    for (const v of o.visible.filter((v) => v.kind === "object"))
      this.objects.set(v.name, v);
    const mapRows = Array.from({ length: o.area.heightTiles }, (_, y) =>
      Array.from({ length: o.area.widthTiles }, (_, x) =>
        this.open(x, y, o) ? "." : "#",
      ).join(""),
    );
    const mapped = { ...o, screen: { originX: 0, originY: 0, rows: mapRows } };
    for (const v of o.visible.filter(
      (v) => v.kind === "object" && /gate/i.test(v.name),
    )) {
      if (!this.gateApproaches.has(v.name) && !/open/i.test(v.details ?? "")) {
        const x = Math.floor(v.x),
          y = Math.floor(v.y);
        const wall = (dx: number, dy: number) =>
          this.cells.get(`${x + dx},${y + dy}`) === "#" ? 1 : 0;
        const vertical = wall(0, -1) + wall(0, 1),
          horizontal = wall(-1, 0) + wall(1, 0);
        const axis =
          vertical > horizontal
            ? "x"
            : horizontal > vertical
              ? "y"
              : Math.abs(v.x - o.self.x) >= Math.abs(v.y - o.self.y)
                ? "x"
                : "y";
        this.gateApproaches.set(v.name, {
          gate: { x: v.x, y: v.y },
          entry: { x: o.self.x, y: o.self.y },
          axis,
        });
      }
      if (/open/i.test(v.details ?? "") && !this.opened.has(v.name)) {
        this.opened.add(v.name);
        const approach = this.gateApproaches.get(v.name);
        if (approach) {
          const sign =
            Math.sign(
              approach.gate[approach.axis] - approach.entry[approach.axis],
            ) || 1;
          const goal = { x: approach.gate.x + 0.5, y: approach.gate.y + 0.5 };
          goal[approach.axis] += sign * 3;
          this.passage = {
            gate: approach.gate,
            axis: approach.axis,
            sign,
            goal,
            until: o.tick + 900,
          };
          // Old collision failures at the closed passage must not survive opening.
          this.blocked.clear();
        }
      }
    }

    this.visits.set(key(o.self), (this.visits.get(key(o.self)) ?? 0) + 1);
    if (o.dialogue)
      return act(
        can("choose_dialogue")
          ? {
              type: "choose_dialogue",
              option: o.dialogue.choices?.[0]?.option ?? 1,
            }
          : can("advance_dialogue")
            ? { type: "advance_dialogue" }
            : { type: "wait", ticks: 20 },
        "Read normal dialogue",
      );
    if (!can("move"))
      return act({ type: "wait", ticks: 12 }, "Wait for current action lock");
    const cow = o.visible.find(
      (v) => v.kind === "creature" && /cow/i.test(v.name),
    );
    if (this.pending) {
      if (o.tick < this.pending.until) {
        const step = planStep(o, this.pending.retreat, {
          maxTicks: 12,
          tolerance: 0.3,
        });
        return act(
          step.kind === "move"
            ? { type: "move", direction: step.direction, ticks: step.ticks }
            : {
                type: "wait",
                ticks: Math.min(30, this.pending.until - o.tick),
              },
          "Move clear while the projectile/pull resolves; bounded deadline",
        );
      }
      this.lastEffect = cow
        ? Math.hypot(cow.x - this.pending.cow.x, cow.y - this.pending.cow.y) >
          0.12
          ? "Observed cow displacement; passage clearance still unverified."
          : "Cast attempted but no observed cow displacement; try a different configuration."
        : "Target no longer visible; effect unverified.";
      this.pending = undefined;
    }
    const target = o.inventory.nearbyTarget;
    if (target && !(/gate/i.test(target.name) && this.opened.size > 0)) {
      const signature = `interact:${target.id}:${Math.round(o.self.x * 2)},${Math.round(o.self.y * 2)}:${o.inventory.items.map((i) => `${i.id}:${i.count}`).join(",")}`;
      if (!this.attempts.has(signature) && can("interact")) {
        this.attempts.add(signature);
        return act(
          { type: "interact" },
          "Try visible nearby target once per inventory state",
        );
      }
      for (const item of o.inventory.items.filter(
        (i) =>
          i.count > 0 &&
          (/gate/i.test(target.name)
            ? /opens.*gate/i.test(i.description)
            : /key|tool/i.test(i.description)),
      )) {
        const sig = `${signature}:${item.id}`;
        if (!this.attempts.has(sig) && can("use_item")) {
          this.attempts.add(sig);
          return act(
            { type: "use_item", item: item.id },
            "Test owned item on visible target; no assumed success",
          );
        }
      }
    }
    const wolf = o.visible.find(
      (v) => v.kind === "creature" && /wolf/i.test(v.name),
    );
    const ownsKey = o.inventory.items.some(
      (i) => /key/i.test(i.name) && i.count > 0,
    );
    if (wolf && !ownsKey && this.opened.size === 0) {
      const ability = o.hero === "Sieg" ? "super_speed" : "slow_time";
      const abilityName = o.hero === "Sieg" ? /super speed/i : /slow time/i;
      if (
        can("ability") &&
        o.abilities.some((a) => abilityName.test(a.name) && a.state === "ready")
      )
        return act(
          { type: "ability", ability },
          "Use normal chase ability on visibly key-carrying wolf",
        );
      const step = planStep(o, wolf, {
        maxTicks: 4,
        tolerance: 0.2,
        speed:
          o.hero === "Sieg" &&
          o.self.status.some((s) => /speed|sprint/i.test(s))
            ? 0.25
            : undefined,
      });
      if (step.kind === "move")
        return act(
          { type: "move", direction: step.direction, ticks: step.ticks },
          "Chase visible key carrier, updating from observation",
        );
    }
    if (this.passage && o.tick < this.passage.until) {
      const p = this.passage;
      const beyond = (o.self[p.axis] - p.gate[p.axis]) * p.sign;
      if (beyond < 2.5) {
        const step = planStep(mapped, p.goal, {
          maxTicks: 8,
          tolerance: 0.4,
          speed: this.measuredSpeed,
        });
        if (step.kind === "move")
          return act(
            { type: "move", direction: step.direction, ticks: step.ticks },
            "Cross newly opened passage toward its previously inaccessible side",
          );
      }
    }
    const interactable = [...this.objects.values()]
      .filter(
        (v) =>
          v.kind === "object" &&
          (!/gate/i.test(v.name) || (ownsKey && !this.opened.has(v.name))) &&
          /gate|chest|E ·/i.test(v.name) &&
          !/open|empty|claimed/i.test(v.details ?? ""),
      )
      .sort(
        (a, b) => a.distance - b.distance || a.name.localeCompare(b.name),
      )[0];
    if (interactable) {
      const distance = Math.hypot(
        interactable.x - o.self.x,
        interactable.y - o.self.y,
      );
      const probe = `world-interact:${interactable.name}:${Math.round(o.self.x * 2)},${Math.round(o.self.y * 2)}`;
      if (distance <= 2.2 && can("interact") && !this.attempts.has(probe)) {
        this.attempts.add(probe);
        return act(
          { type: "interact" },
          "Try visible nearby world object; backpack target is not required for ordinary E interaction",
        );
      }
      if (
        distance < 3 &&
        distance > 0.55 &&
        last?.movement?.outcome !== "none"
      ) {
        return act(
          {
            type: "move",
            direction: directionTo(
              interactable.x - o.self.x,
              interactable.y - o.self.y,
            ),
            ticks: Math.max(
              1,
              Math.min(
                6,
                Math.floor((distance - 0.5) / (this.measuredSpeed || 0.1)),
              ),
            ),
          },
          "Close carefully on visible interaction target using observed movement speed",
        );
      }
      const step = planStep(mapped, interactable, {
        maxTicks: 15,
        tolerance: 0.8,
      });
      const sig = `approach:${key(o.self)}:${interactable.name}`;
      if (last?.movement?.outcome === "none") this.attempts.add(sig);
      if (!this.attempts.has(sig) && step.kind === "move")
        return act(
          { type: "move", direction: step.direction, ticks: step.ticks },
          "Approach observed interaction target, not a route waypoint",
        );
    }
    const fight = planFight(o, { radius: 6 });
    if (fight && can(fight.type)) return act(fight, "Respond to visible enemy");
    const hedge = o.visible.find((v) =>
      /dry hedge|brittle|flammable/i.test(v.name + " " + v.details),
    );
    if (hedge && o.hero === "Coco" && can("attack")) {
      const sig = `fire:${key(o.self)}:${key(hedge)}`;
      if (!this.attempts.has(sig)) {
        this.attempts.add(sig);
        return act(
          {
            type: "attack",
            direction: directionTo(hedge.x - o.self.x, hedge.y - o.self.y),
          },
          "Try fire on visibly combustible obstacle",
        );
      }
    }
    if (cow && o.hero === "Coco" && ++this.cowSearchDecisions % 100 < 65) {
      // The on-screen grazing label is a hypothesis for where to move the cow,
      // not a hidden parked flag or a fixed solution coordinate.
      const bay = o.visible.find(
        (v) => v.kind === "label" && /grazing bay/i.test(v.name),
      );
      const goal = bay ?? { x: cow.x - 1, y: cow.y };
      const candidates: {
        p: Point;
        direction: Direction;
        score: number;
        signature: string;
      }[] = [];
      for (let y = Math.floor(cow.y) - 7; y <= Math.ceil(cow.y) + 7; y++)
        for (let x = Math.floor(cow.x) - 7; x <= Math.ceil(cow.x) + 7; x++) {
          if (!this.open(x, y, o)) continue;
          const p = { x: x + 0.5, y: y + 0.5 };
          if (
            cow.extent &&
            Math.abs(p.x - cow.x) < cow.extent.w / 2 + 0.5 &&
            Math.abs(p.y - cow.y) < cow.extent.h / 2 + 0.5
          )
            continue;
          const simulated = { ...o, self: { ...o.self, ...p } };
          for (const preview of pullPreview(this.memory, simulated)) {
            const hit = preview.within_pull.find((v) => v.name === cow.name);
            if (!hit) continue;
            const gain =
              Math.hypot(cow.x - goal.x, cow.y - goal.y) -
              Math.hypot(
                preview.stops_at.x - goal.x,
                preview.stops_at.y - goal.y,
              );
            if (gain <= 0.1) continue;
            const signature = `pull:${key(cow)}:${key(p)}:${preview.direction}`;
            if (this.attempts.has(signature)) continue;
            candidates.push({
              p,
              direction: preview.direction,
              signature,
              score:
                gain * 4 -
                Math.hypot(p.x - o.self.x, p.y - o.self.y) * 0.2 -
                hit.obstructing_heroes.length * 2,
            });
          }
        }
      candidates.sort(
        (a, b) => b.score - a.score || a.signature.localeCompare(b.signature),
      );
      const best = candidates[0];
      if (best) {
        if (Math.hypot(best.p.x - o.self.x, best.p.y - o.self.y) > 0.35) {
          if (last?.movement?.outcome === "none")
            this.attempts.add(best.signature);
          else {
            const step = planStep(mapped, best.p, {
              maxTicks: 15,
              tolerance: 0.25,
            });
            if (step.kind === "move")
              return act(
                { type: "move", direction: step.direction, ticks: step.ticks },
                "Search a new observed firing position around cow",
              );
          }
        } else {
          const ready = o.abilities.some(
            (a) =>
              /black.hole/i.test(a.name + " " + a.key) &&
              /ready/i.test(a.state),
          );
          if (ready && can("ability")) {
            this.attempts.add(best.signature);
            const dx = cow.x - o.self.x,
              dy = cow.y - o.self.y;
            const retreat = {
              x: o.self.x - Math.sign(dy || 1) * 3,
              y: o.self.y + Math.sign(dx || 1) * 3,
            };
            this.pending = {
              signature: best.signature,
              cow: { x: cow.x, y: cow.y },
              until: o.tick + 180,
              retreat,
            };
            return act(
              {
                type: "ability",
                ability: "black_hole",
                direction: best.direction,
              },
              "Test pull hypothesis, then vacate swept cow body",
            );
          }
          // Cooldown does not force indefinite waiting: explore/backtrack below.
        }
      }
    }
    return act(
      this.explore(o, last),
      "Explore remembered map/frontiers; backtrack from blocked moves",
    );
  }
  private open(x: number, y: number, o: Observation) {
    const c = this.cells.get(`${x},${y}`);
    if (!c || "#~ ^".includes(c)) return false;
    return !o.visible.some(
      (v) =>
        v.kind === "creature" &&
        v.extent &&
        x + 0.5 >= v.extent.x - 0.4 &&
        x + 0.5 <= v.extent.x + v.extent.w + 0.4 &&
        y + 0.5 >= v.extent.y - 0.4 &&
        y + 0.5 <= v.extent.y + v.extent.h + 0.4,
    );
  }
  private explore(o: Observation, last?: StepResult): GameAction {
    const queue = [
      {
        x: Math.floor(o.self.x),
        y: Math.floor(o.self.y),
        first: undefined as Direction | undefined,
        d: 0,
      },
    ];
    const seen = new Set([key(o.self)]);
    let best: (typeof queue)[number] | undefined,
      score = -Infinity;
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      if (p.first) {
        const frontier = moves.filter(
          ([, dx, dy]) => !this.cells.has(`${p.x + dx},${p.y + dy}`),
        ).length;
        const s =
          frontier * 20 -
          (this.visits.get(key(p)) ?? 0) * 4 -
          p.d * 0.3 +
          (this.passage &&
          (p[this.passage.axis] - this.passage.gate[this.passage.axis]) *
            this.passage.sign >
            0 &&
          !this.visits.has(key(p))
            ? 35
            : 0);
        if (s > score) {
          score = s;
          best = p;
        }
      }
      for (const [dir, dx, dy] of moves) {
        const x = p.x + dx,
          y = p.y + dy,
          k = `${x},${y}`;
        if (
          seen.has(k) ||
          !this.open(x, y, o) ||
          this.blocked.has(`${key(p)}:${dir}`)
        )
          continue;
        seen.add(k);
        queue.push({ x, y, first: p.first ?? dir, d: p.d + 1 });
      }
    }
    if (best?.first) {
      if (last?.movement?.outcome === "none") {
        const d = moves.find(([d]) => d === best.first)!;
        this.visits.set(
          `${Math.floor(o.self.x) + d[1]},${Math.floor(o.self.y) + d[2]}`,
          1000,
        );
      }
      this.previous = { from: key(o.self), direction: best.first };
      return { type: "move", direction: best.first, ticks: 8 };
    }
    return { type: "wait", ticks: 30 };
  }
}
