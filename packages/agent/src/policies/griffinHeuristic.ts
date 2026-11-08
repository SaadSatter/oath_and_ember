// Rule-aware combat and return player. Observation-only; no encounter solution,
// map coordinates, engine state, grounding rule or scripted route is supplied.
import type {
  ActionSpec,
  GameAction,
  Observation,
  StepResult,
  Direction,
  VisibleThing,
} from "../types.js";
import type { Policy, Decision } from "./policy.js";
import { directionTo, planStep } from "./navigate.js";
import { planFight } from "./combat.js";

const cell = (x: number, y: number) => `${Math.floor(x)},${Math.floor(y)}`;
const dirs: [Direction, number, number][] = [
  ["n", 0, -1],
  ["e", 1, 0],
  ["s", 0, 1],
  ["w", -1, 0],
];
export class GriffinHeuristic implements Policy {
  readonly name = "baseline-griffin-heuristic-v1";
  private area = "";
  private terrain = new Map<string, string>();
  private visits = new Map<string, number>();
  private things = new Map<string, VisibleThing>();
  private blocked = new Map<string, number>();
  private previousMove?: { x: number; y: number; direction: Direction };
  private lastCell = "";
  private speed = 0.1;
  private idleAttackUntil = 0;
  private defeated = false;
  private lastHp?: number;
  private lastPull?: {
    hp: number | undefined;
    x: number;
    y: number;
    tick: number;
  };
  private pullEffect = "No pull tried.";
  async decide({
    observation: o,
    legal,
    last,
  }: {
    observation: Observation;
    legal: ActionSpec[];
    last?: StepResult;
  }): Promise<Decision> {
    const can = (t: GameAction["type"]) => legal.some((a) => a.type === t);
    const ready = (name: RegExp) =>
      o.abilities.some((a) => name.test(a.name) && a.state === "ready");
    const flying = o.abilities.some(
      (a) => a.name === "Flight" && /flying/.test(a.state),
    );
    const act = (action: GameAction, reason: string): Decision => {
      if (action.type === "move")
        this.previousMove = {
          x: o.self.x,
          y: o.self.y,
          direction: action.direction,
        };
      return {
        action,
        note: {
          heuristic: reason,
          pullEffect: this.pullEffect,
          defeatObserved: this.defeated,
        },
      };
    };
    if (last?.movement?.blocked && this.previousMove) {
      const vector: Record<Direction, [number, number]> = {
        n: [0, -1],
        ne: [1, -1],
        e: [1, 0],
        se: [1, 1],
        s: [0, 1],
        sw: [-1, 1],
        w: [-1, 0],
        nw: [-1, -1],
      };
      const [dx, dy] = vector[this.previousMove.direction];
      this.blocked.set(cell(o.self.x + dx, o.self.y + dy), o.tick + 600);
    }
    this.previousMove = undefined;
    for (const [k, until] of this.blocked)
      if (until <= o.tick) this.blocked.delete(k);
    if (this.area !== o.area.name) {
      this.area = o.area.name;
      this.terrain.clear();
      this.visits.clear();
      this.things.clear();
      this.blocked.clear();
      this.lastCell = "";
    }
    o.screen.rows.forEach((r, y) =>
      [...r].forEach((c, x) => {
        if (c !== " ")
          this.terrain.set(
            cell(x + o.screen.originX, y + o.screen.originY),
            "@PEC*o>".includes(c) ? "." : c,
          );
      }),
    );
    for (const v of o.visible) this.things.set(`${v.kind}:${v.name}`, v);
    const k = cell(o.self.x, o.self.y);
    if (k !== this.lastCell) {
      this.visits.set(k, (this.visits.get(k) ?? 0) + 1);
      this.lastCell = k;
    }
    if (
      last?.movement &&
      last.movement.ticks.applied > 0 &&
      !last.movement.blocked
    )
      this.speed = last.movement.requestedTiles / last.movement.ticks.applied;
    if (o.dialogue)
      return act(
        can("choose_dialogue")
          ? {
              type: "choose_dialogue",
              option: o.dialogue.choices?.[0]?.option ?? 1,
            }
          : can("advance_dialogue")
            ? { type: "advance_dialogue" }
            : { type: "wait", ticks: 12 },
        "Read normal dialogue and choose first available response",
      );
    if (!can("move"))
      return act({ type: "wait", ticks: 12 }, "Wait for current action lock");
    const wig = o.inventory.items.find(
      (i) => /wig/i.test(i.name) && i.count > 0,
    );
    const creature = o.visible.find(
      (v) =>
        (v.kind === "enemy" ||
          (v.kind === "creature" &&
            /\d+\/\d+|DEFEATED/i.test(v.details ?? ""))) &&
        !/cow|wolf/i.test(v.name),
    );
    if (creature && /DEFEATED/i.test(creature.details ?? ""))
      this.defeated = true;
    const hp = creature?.details?.match(/(\d+)\/(\d+)/);
    if (hp) this.lastHp = Number(hp[1]);
    if (this.lastPull && o.tick - this.lastPull.tick >= 180 && creature) {
      this.pullEffect =
        Math.hypot(creature.x - this.lastPull.x, creature.y - this.lastPull.y) >
        0.15
          ? "Observed target displacement after pull attempt; cause not independently proven."
          : this.lastPull.hp !== undefined &&
              this.lastHp !== undefined &&
              this.lastHp < this.lastPull.hp
            ? "Observed target health reduction; pull causal effect unverified."
            : "No observed displacement or health reduction; reposition before another attempt.";
      this.lastPull = undefined;
    }
    const near = o.inventory.nearbyTarget;
    if (wig && /offer|goddess/i.test(near?.name ?? "") && can("use_item"))
      return act(
        { type: "use_item", item: wig.id },
        "Offer owned wig at observed offering target",
      );
    if (
      this.defeated &&
      !wig &&
      near &&
      /nest|wig/i.test(near.name) &&
      o.hero === "Coco" &&
      can("interact")
    )
      return act(
        { type: "interact" },
        "Collect reward at observed nearby target after visible defeat",
      );
    if (wig) {
      if (/shrine/i.test(o.area.name)) {
        const offering = [...this.things.values()].find(
          (v) => v.kind === "object" && /offer|gift/i.test(v.name),
        );
        if (offering) {
          const a = this.approach(o, offering, flying);
          if (a)
            return act(
              a,
              "Navigate to observed offering point; no return route supplied",
            );
        }
        return act(
          this.explore(o, flying),
          "Explore shrine to find normal offering interaction",
        );
      }
      const exit = [...this.things.values()].find(
        (v) => v.kind === "exit" && /return/i.test(v.name),
      );
      if (exit) {
        if (
          Math.hypot(exit.x - o.self.x, exit.y - o.self.y) < 1.3 &&
          can("interact")
        )
          return act(
            { type: "interact" },
            "Use observed return exit while carrying wig",
          );
        const a = this.approach(o, exit, flying);
        if (a)
          return act(a, "Backtrack on remembered map to observed return exit");
      }
      return act(
        this.explore(o, flying),
        "Search for return exit with wig in shared inventory",
      );
    }
    if (creature && !this.defeated) {
      const d = Math.hypot(creature.x - o.self.x, creature.y - o.self.y);
      // Black Hole is a generic pull/damage action against an organic hostile.
      // No test for airborne/PULLED state or special grounding fact occurs here.
      if (
        o.hero === "Coco" &&
        ready(/Black Hole/) &&
        can("ability") &&
        d <= 8
      ) {
        this.lastPull = {
          hp: this.lastHp,
          x: creature.x,
          y: creature.y,
          tick: o.tick,
        };
        return act(
          {
            type: "ability",
            ability: "black_hole",
            direction: directionTo(
              creature.x - o.self.x,
              creature.y - o.self.y,
            ),
          },
          "Try ordinary organic-target pull/damage ability",
        );
      }
      if (/BEAM_CHARGE|HEADBUTT_CHARGE/.test(creature.details ?? ""))
        return act(
          {
            type: "move",
            direction: directionTo(
              -(creature.y - o.self.y),
              creature.x - o.self.x,
            ),
            ticks: 8,
          },
          "Sidestep visibly charging hostile",
        );
      if (o.hero === "Coco" && d < 3)
        return act(
          {
            type: "move",
            direction: directionTo(
              o.self.x - creature.x,
              o.self.y - creature.y,
            ),
            ticks: 8,
          },
          "Maintain ranged spacing",
        );
      if (o.tick < this.idleAttackUntil)
        return act(
          { type: "wait", ticks: Math.min(12, this.idleAttackUntil - o.tick) },
          "Bounded attack recovery",
        );
      const view = {
        ...o,
        visible: o.visible.map((v) =>
          v === creature ? { ...v, kind: "enemy" as const } : v,
        ),
      };
      const fight = planFight(view, { radius: 20, flying });
      if (fight && can(fight.type)) {
        if (fight.type === "attack") {
          if (!ready(/Sword|Fireball/))
            return act(
              { type: "wait", ticks: 6 },
              "Wait for visible attack readiness",
            );
          this.idleAttackUntil = o.tick + 12;
        }
        return act(
          fight,
          "Fight visible hostile using ordinary role combat rules",
        );
      }
    }
    // Flight crosses observed water/gaps for exploration and item retrieval;
    // no nest location is supplied. Safe-ground landing stays engine-owned.
    if (
      o.hero === "Coco" &&
      ready(/^Flight$/) &&
      [...this.terrain.values()].includes("~") &&
      can("ability")
    )
      return act(
        { type: "ability", ability: "flight" },
        "Use normal flight to explore observed water/gaps",
      );
    if (this.defeated && o.hero === "Sieg")
      return act(
        { type: "defend", ticks: 30 },
        "Guard while partner explores inaccessible reward terrain",
      );
    const drop = [...this.things.values()].find(
      (v) =>
        v.kind === "object" &&
        (/wig|reward/i.test(v.name) || (this.defeated && /nest/i.test(v.name))),
    );
    if (drop) {
      const a = this.approach(o, drop, flying);
      if (a) return act(a, "Approach visible reward");
    }
    return act(
      this.explore(o, flying),
      this.defeated
        ? "Explore for the nest/reward indicated by visible defeat label"
        : "Explore observed frontier to locate hostile",
    );
  }
  private grid(o: Observation) {
    return {
      ...o,
      screen: {
        originX: 0,
        originY: 0,
        rows: Array.from({ length: o.area.heightTiles }, (_, y) =>
          Array.from({ length: o.area.widthTiles }, (_, x) =>
            this.blocked.has(cell(x, y))
              ? "#"
              : (this.terrain.get(cell(x, y)) ?? "#"),
          ).join(""),
        ),
      },
    };
  }
  private approach(
    o: Observation,
    p: { x: number; y: number },
    flying: boolean,
  ): GameAction | undefined {
    const step = planStep(this.grid(o), p, {
      flying,
      maxTicks: 12,
      tolerance: 0.5,
      speed: this.speed,
    });
    return step.kind === "move"
      ? { type: "move", direction: step.direction, ticks: step.ticks }
      : undefined;
  }
  private explore(o: Observation, flying: boolean): GameAction {
    const q = [{ x: Math.floor(o.self.x), y: Math.floor(o.self.y), d: 0 }],
      seen = new Set([cell(o.self.x, o.self.y)]);
    let best = q[0],
      score = -Infinity;
    const open = (x: number, y: number) => {
      const c = this.terrain.get(cell(x, y));
      return (
        !!c &&
        !this.blocked.has(cell(x, y)) &&
        c !== "#" &&
        c !== "^" &&
        (c !== "~" || flying)
      );
    };
    for (let i = 0; i < q.length; i++) {
      const p = q[i],
        frontier = dirs.filter(
          ([, dx, dy]) => !this.terrain.has(cell(p.x + dx, p.y + dy)),
        ).length;
      const s =
        frontier * 25 - (this.visits.get(cell(p.x, p.y)) ?? 0) * 8 - p.d * 0.3;
      if (p.d > 0 && s > score) {
        best = p;
        score = s;
      }
      for (const [, dx, dy] of o.hero === "Coco"
        ? [...dirs.slice(1), dirs[0]]
        : dirs) {
        const x = p.x + dx,
          y = p.y + dy,
          k = cell(x, y);
        if (
          x < 0 ||
          y < 0 ||
          x >= o.area.widthTiles ||
          y >= o.area.heightTiles ||
          seen.has(k) ||
          !open(x, y)
        )
          continue;
        seen.add(k);
        q.push({ x, y, d: p.d + 1 });
      }
    }
    return (
      this.approach(o, { x: best.x + 0.5, y: best.y + 0.5 }, flying) ?? {
        type: "wait",
        ticks: 20,
      }
    );
  }
}
