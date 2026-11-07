// General inventory-affordance overlay. No scenario/engine imports, fixed
// locations, hidden flags or special item-delivery sequence. B stays frozen.
import type {
  ActionSpec,
  GameAction,
  Observation,
  StepResult,
  VisibleThing,
} from "../types.js";
import type { Policy, Decision } from "./policy.js";
import { GriffinHeuristic } from "./griffinHeuristic.js";
import { planStep, directionTo } from "./navigate.js";

const stop = new Set([
  "this",
  "that",
  "with",
  "from",
  "shared",
  "quest",
  "tool",
  "keep",
  "your",
  "have",
  "into",
  "they",
  "will",
  "their",
  "them",
  "ornate",
  "enchanted",
  "magnificent",
  "proud",
]);
const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !stop.has(w));
export class InventoryHeuristic implements Policy {
  readonly name = "baseline-inventory-heuristic-v1";
  private fallback = new GriffinHeuristic();
  private area = "";
  private terrain = new Map<string, string>();
  private known = new Map<string, VisibleThing>();
  private attempted = new Set<string>();
  private pending?: {
    name: string;
    point: { x: number; y: number };
    until: number;
    nextProbe: number;
    before: string;
  };
  private lastItemAttempt?: { signature: string; before: string };
  private effect = "No inventory effect confirmed.";
  private signature(o: Observation) {
    return JSON.stringify(
      o.inventory.items
        .filter((i) => i.count > 0)
        .map((i) => [i.id, i.count])
        .sort(),
    );
  }
  async decide(input: {
    observation: Observation;
    legal: ActionSpec[];
    last?: StepResult;
  }): Promise<Decision> {
    const { observation: o, legal, last } = input;
    const can = (t: GameAction["type"]) => legal.some((a) => a.type === t);
    const act = (action: GameAction, reason: string): Decision => ({
      action,
      note: {
        heuristic: reason,
        inventoryEffect: this.effect,
        attempts: this.attempted.size,
        dependency: this.pending
          ? { target: this.pending.name, untilTick: this.pending.until }
          : null,
      },
    });
    if (this.area !== o.area.name) {
      this.area = o.area.name;
      this.terrain.clear();
      this.known.clear();
      this.pending = undefined;
    }
    o.screen.rows.forEach((r, y) =>
      [...r].forEach((c, x) => {
        if (c !== " ")
          this.terrain.set(
            `${x + o.screen.originX},${y + o.screen.originY}`,
            "@PEC*o>".includes(c) ? "." : c,
          );
      }),
    );
    for (const v of o.visible.filter(
      (v) => v.kind === "object" || v.kind === "label",
    ))
      this.known.set(`${v.kind}:${v.name}`, v);
    const bag = this.signature(o);
    if (this.lastItemAttempt) {
      this.effect =
        bag !== this.lastItemAttempt.before
          ? "Observed inventory change after item action; reward completion not assumed."
          : last?.accepted
            ? "Item input executed; no inventory effect confirmed yet."
            : "Item action was rejected; no effect confirmed.";
      if (last && !last.accepted) this.pending = undefined;
      this.lastItemAttempt = undefined;
    }
    // Normal dialogue, acquired-objective return and offering reuse the existing
    // observation-only player. No scenario goal is inferred from an action alone.
    if (
      o.dialogue ||
      o.inventory.items.some((i) => i.count > 0 && /wig/i.test(i.name)) ||
      !can("move")
    )
      return this.fallback.decide(input);
    const tools = o.inventory.items.filter(
      (i) => i.count > 0 && /tool|opens|offer|keep.+for/i.test(i.description),
    );
    const near = o.inventory.nearbyTarget;
    const text = [
      near?.name ?? "",
      ...o.visible
        .filter((v) => v.kind === "label")
        .map((v) => v.name + " " + (v.details ?? "")),
    ]
      .join(" ")
      .toLowerCase();
    // Match owned item names/descriptions against normal displayed target text.
    // Item IDs are only action parameters, never an answer-key lookup.
    const match = near
      ? tools
          .map((item) => ({
            item,
            score: words(item.name + " " + item.description).filter((w) =>
              text.includes(w),
            ).length,
          }))
          .filter((x) => x.score > 0)
          .sort(
            (a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id),
          )[0]
      : undefined;
    if (o.hero === "Coco" && near && match && can("use_item")) {
      const signature = `${o.area.name}:${near.name}:${match.item.id}:${bag}:${Math.round(o.self.x * 2)},${Math.round(o.self.y * 2)}`;
      if (!this.attempted.has(signature)) {
        this.attempted.add(signature);
        this.lastItemAttempt = { signature, before: bag };
        const point =
          [...this.known.values()].find((v) =>
            words(v.name).some((w) => near.name.toLowerCase().includes(w)),
          ) ?? o.self;
        this.pending = {
          name: near.name,
          point: { x: point.x, y: point.y },
          until: o.tick + 1800,
          nextProbe: o.tick + 120,
          before: bag,
        };
        return act(
          { type: "use_item", item: match.item.id },
          "Try an owned tool whose description/name matches the visible target",
        );
      }
      // Do not let a failed first item conceal a different available tool.
      for (const candidate of tools.filter((i) => i.id !== match.item.id)) {
        if (
          !words(candidate.name + " " + candidate.description).some((w) =>
            text.includes(w),
          )
        )
          continue;
        const sig = `${o.area.name}:${near.name}:${candidate.id}:${bag}:${Math.round(o.self.x * 2)},${Math.round(o.self.y * 2)}`;
        if (!this.attempted.has(sig)) {
          this.attempted.add(sig);
          this.lastItemAttempt = { signature: sig, before: bag };
          return act(
            { type: "use_item", item: candidate.id },
            "Test another matching owned tool; no delivery order is prescribed",
          );
        }
      }
    }
    if (this.pending && o.tick >= this.pending.until) {
      this.effect =
        "Item dependency deadline expired without observed reward; resume general play.";
      this.pending = undefined;
    }
    if (o.hero === "Coco" && this.pending) {
      const same = near?.name === this.pending.name;
      if (same && o.tick >= this.pending.nextProbe && can("interact")) {
        this.pending.nextProbe = o.tick + 120;
        return act(
          { type: "interact" },
          "Check observed interaction for a reward; bounded dependency deadline does not renew",
        );
      }
      if (same)
        return act(
          { type: "wait", ticks: Math.min(30, this.pending.until - o.tick) },
          "Await observable item reaction or reward until fixed deadline",
        );
      const action = this.go(o, this.pending.point);
      if (action)
        return act(
          action,
          "Return to the observed interaction point while its bounded effect resolves",
        );
    }
    const candidates = [...this.known.values()]
      .filter((v) => v.kind === "object" && !/pillar|statue/i.test(v.name))
      .map((target) => ({
        target,
        score: tools.reduce(
          (n, item) =>
            n +
            words(target.name).filter((w) =>
              words(item.description + " " + item.name).includes(w),
            ).length,
          0,
        ),
      }))
      .filter((x) => x.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || a.target.name.localeCompare(b.target.name),
      );
    const objective = candidates[0]?.target;
    if (o.hero === "Coco" && objective && tools.length) {
      if (
        this.ready(o, /^Flight$/) &&
        [...this.terrain.values()].includes("~") &&
        can("ability")
      )
        return act(
          { type: "ability", ability: "flight" },
          "Use normal flight to reach an observed item-compatible object across water",
        );
      const action = this.go(o, objective);
      if (action)
        return act(
          action,
          "Approach observed object matching owned tool descriptions; no destination supplied",
        );
    }
    // Explore with a tool-use preference, rather than committing the item user
    // to combat before it has inspected the affordance. Partner combat remains
    // the unchanged general policy. Filtering is a policy-side attention choice.
    const preferTools = o.hero === "Coco" && tools.length > 0;
    return this.fallback.decide(
      preferTools
        ? {
            ...input,
            observation: {
              ...o,
              visible: o.visible.filter(
                (v) => v.kind !== "enemy" && v.kind !== "creature",
              ),
            },
          }
        : input,
    );
  }
  private ready(o: Observation, re: RegExp) {
    return o.abilities.some((a) => re.test(a.name) && a.state === "ready");
  }
  private go(
    o: Observation,
    p: { x: number; y: number },
  ): GameAction | undefined {
    const flying = o.abilities.some(
      (a) => a.name === "Flight" && /flying/.test(a.state),
    );
    const d = Math.hypot(p.x - o.self.x, p.y - o.self.y);
    if (d < 2 && d > 0.5)
      return {
        type: "move",
        direction: directionTo(p.x - o.self.x, p.y - o.self.y),
        ticks: Math.max(1, Math.min(6, Math.floor((d - 0.5) / 0.1))),
      };
    const mapped = {
      ...o,
      screen: {
        originX: 0,
        originY: 0,
        rows: Array.from({ length: o.area.heightTiles }, (_, y) =>
          Array.from(
            { length: o.area.widthTiles },
            (_, x) => this.terrain.get(`${x},${y}`) ?? "#",
          ).join(""),
        ),
      },
    };
    const step = planStep(mapped, p, { flying, maxTicks: 10, tolerance: 0.5 });
    return step.kind === "move"
      ? { type: "move", direction: step.direction, ticks: step.ticks }
      : undefined;
  }
}
