// Centralized policy bookkeeping. Inputs are observations and ordinary action
// results only. No engine, scenario, route, evaluator or hidden-state access.
import type { GameAction, Observation, PlayerId } from "../types.js";
import type { TurnReport } from "./policy.js";

export const PROGRESS = Object.freeze({
  idleTicks: 1800,
  effectTicks: 360,
  kept: 32,
  version: 1,
});
type Evidence = {
  id: string;
  tick: number;
  hero: PlayerId;
  kind: string;
  text: string;
  completion: boolean;
};
type Attempt = {
  tick: number;
  action: GameAction;
  signature: string;
  accepted: boolean;
  execution: string;
  effects: string[];
  outcome: string;
  until: number;
};
type State = {
  observation?: Observation;
  since: number;
  epoch: number;
  known: Set<string>;
  walked: Set<string>;
  attempts: Attempt[];
  assignments: Map<string, number>;
  reportedEpoch?: number;
  nextReview?: number;
  permit?: { condition: string; until: number };
  usedConditions: Set<string>;
};
const state = (): State => ({
  since: 0,
  epoch: 0,
  known: new Set(),
  walked: new Set(),
  attempts: [],
  assignments: new Map(),
  usedConditions: new Set(),
});
const bag = (o: Observation) =>
  o.inventory.items
    .map((i) => [i.id, i.count])
    .sort()
    .toString();
const point = (v: number) => Math.round(v * 4) / 4;
export function actionSignature(a: GameAction, o: Observation) {
  // Duration changes and wording do not turn the same press at the same place
  // into a new experiment. A meaningful reposition or aim change does.
  return JSON.stringify([
    o.area.name,
    point(o.self.x),
    point(o.self.y),
    a.type,
    "ability" in a ? a.ability : null,
    "direction" in a ? (a.direction ?? o.self.facing) : null,
    "item" in a ? a.item : null,
    "option" in a ? a.option : null,
  ]);
}
export class CentralProgress {
  private states: Record<PlayerId, State> = { sieg: state(), coco: state() };
  private serial = 0;
  private evidence: Evidence[] = [];
  private completed: Evidence[] = [];

  private add(o: Observation, kind: string, text: string, completion: boolean) {
    const e = {
      id: `observed-${++this.serial}`,
      tick: o.tick,
      hero: o.player,
      kind,
      text,
      completion,
    };
    this.evidence.push(e);
    this.evidence = this.evidence.slice(-PROGRESS.kept);
    return e;
  }
  observe(o: Observation, turn?: TurnReport) {
    const s = this.states[o.player];
    const previous = s.observation;
    if (!previous) s.since = o.tick;
    // Consume between-action observations in order as well; each result has
    // its own actual before/after pair, rather than attributing a batch to its
    // last action. A skipped step is never an attempt.
    for (const step of turn?.steps ?? []) {
      const before = s.observation ?? o;
      const a = step.action;
      if (!["wait", "move", "defend"].includes(a.type)) {
        const accepted = step.status === "executed" && step.result.accepted;
        const performed = step.result.attack === "performed";
        s.attempts.push({
          tick: before.tick,
          action: a,
          signature: actionSignature(a, before),
          accepted,
          execution: !accepted
            ? "refused or stale"
            : step.result.attack === "none"
              ? "No swing/cast occurred; the input was accepted."
              : performed
                ? "swing/cast confirmed by action result"
                : "input accepted; execution/effect not yet confirmed",
          effects: [],
          outcome: !accepted
            ? "Action did not execute."
            : step.result.attack === "none"
              ? "Input accepted, but no swing/cast occurred."
              : "Input accepted; intended effect not yet observed.",
          until:
            a.type === "ability" || a.type === "attack"
              ? before.tick + PROGRESS.effectTicks
              : o.tick,
        });
        s.attempts = s.attempts.slice(-PROGRESS.kept);
      }
      if (step.after) this.update(step.after);
    }
    this.update(o);
  }
  private update(o: Observation) {
    const s = this.states[o.player],
      prev = s.observation;
    const effects: Evidence[] = [];
    const add = (kind: string, text: string, completion = true) =>
      effects.push(this.add(o, kind, text, completion));
    if (prev) {
      if (
        prev.dialogue &&
        JSON.stringify(prev.dialogue) !== JSON.stringify(o.dialogue)
      )
        add("dialogue", "Observed a dialogue line advance or finish.", false);
      if (o.area.name !== prev.area.name)
        add("area", `Entered ${o.area.name}.`);
      if (bag(o) !== bag(prev)) {
        for (const i of o.inventory.items)
          if (
            i.count >
            (prev.inventory.items.find((p) => p.id === i.id)?.count ?? 0)
          )
            add(
              "inventory",
              `Shared inventory now contains ${i.count} ${i.name}.`,
            );
      }
      const beforeDone = new Set([
        ...(prev.journal.current?.done ?? []),
        ...prev.journal.completed,
      ]);
      for (const line of [
        ...(o.journal.current?.done ?? []),
        ...o.journal.completed,
      ])
        if (!beforeDone.has(line))
          add("journal", `Journal records completed: ${line}.`);
      if (prev.area.name === o.area.name) {
        for (const v of o.visible) {
          const old = prev.visible.find(
            (p) => p.kind === v.kind && p.name === v.name,
          );
          if (
            v.kind === "creature" &&
            old &&
            s.attempts.some(
              (a) =>
                a.accepted && a.action.type === "ability" && a.until >= o.tick,
            ) &&
            Math.hypot(v.x - old.x, v.y - old.y) >= 0.15
          )
            add(
              "displacement",
              `Observed ${v.name} move from (${old!.x}, ${old!.y}) to (${v.x}, ${v.y}); this alone does not confirm a puzzle is solved.`,
            );
          // Enemy movement and offscreen disappearance are not accomplishments.
          if (
            v.kind === "enemy" &&
            old?.details !== v.details &&
            old?.details &&
            v.details &&
            /health bar/.test(v.details)
          ) {
            const health = (text: string) =>
              text.match(/health bar (full|empty|about (\d+)\/8)/);
            const value = (text: string) => {
              const m = health(text);
              return !m
                ? undefined
                : m[1] === "full"
                  ? 8
                  : m[1] === "empty"
                    ? 0
                    : Number(m[2]);
            };
            const a = value(old.details),
              b = value(v.details);
            if (a !== undefined && b !== undefined && b < a)
              add("damage", `Observed ${v.name}: ${v.details}.`);
          }
        }
        for (let y = 0; y < o.screen.rows.length; y++)
          for (let x = 0; x < o.screen.rows[y].length; x++) {
            const wx = o.screen.originX + x,
              wy = o.screen.originY + y,
              ch = o.screen.rows[y][x];
            const old =
              prev.screen.rows[wy - prev.screen.originY]?.[
                wx - prev.screen.originX
              ];
            // Only a directly reobserved obstacle-to-floor change is an effect.
            if (old === "#" && ch === ".")
              add(
                "terrain",
                `Observed blocked floor become open at (${wx}, ${wy}) in ${o.area.name}.`,
              );
          }
      }
    }
    let discovered = false;
    for (let y = 0; y < o.screen.rows.length; y++)
      for (let x = 0; x < o.screen.rows[y].length; x++) {
        const key = `${o.area.name}:${o.screen.originX + x},${o.screen.originY + y}`;
        if (!s.known.has(key)) {
          s.known.add(key);
          discovered = true;
        }
      }
    const cell = `${o.area.name}:${Math.floor(o.self.x)},${Math.floor(o.self.y)}`;
    const firstVisit = !s.walked.has(cell);
    s.walked.add(cell);
    // Mere movement of another actor, damage to us, cooldown countdown and
    // repeated travel on known floor never restart the inactivity clock.
    const explored =
      prev &&
      (discovered ||
        (firstVisit &&
          Math.hypot(o.self.x - prev.self.x, o.self.y - prev.self.y) >= 0.1));
    if (explored)
      add(
        "exploration",
        `Observed new floor or first visit at (${o.self.x}, ${o.self.y}) in ${o.area.name}.`,
        false,
      );
    if (effects.length) {
      s.since = o.tick;
      s.epoch++;
      s.permit = undefined;
      s.usedConditions.clear();
    }
    for (const a of s.attempts) {
      if (!a.accepted || a.tick > o.tick || a.until < o.tick) continue;
      const relevant = effects.filter(
        (e) =>
          e.completion &&
          ((["interact", "use_item"].includes(a.action.type) &&
            ["inventory", "journal", "area"].includes(e.kind)) ||
            (["attack", "ability"].includes(a.action.type) &&
              ["terrain", "displacement", "damage"].includes(e.kind))),
      );
      a.effects.push(...relevant.map((e) => e.id));
      a.effects = [...new Set(a.effects)];
      if (a.action.type === "ability" && prev) {
        const key = a.action.ability?.replace(/_/g, " ").toLowerCase();
        const old = prev.abilities.find((v) => v.name.toLowerCase() === key),
          now = o.abilities.find((v) => v.name.toLowerCase() === key);
        if (old?.state === "ready" && now && now.state !== "ready")
          a.execution = "ability activation confirmed by visible cooldown";
      }
      if (a.effects.length)
        a.outcome =
          "Observable effects confirmed after this attempt; causation and subgoal completion are not assumed.";
    }
    for (const a of s.attempts)
      if (a.accepted && !a.effects.length && o.tick >= a.until)
        a.outcome =
          "Input accepted, but no relevant observable effect was confirmed; change position, aim or assignment before retrying.";
    s.observation = structuredClone(o);
  }
  facts() {
    return this.evidence.map((e) => ({ ...e }));
  }
  complete(ids: string[]) {
    const refused: string[] = [];
    for (const id of ids) {
      const e =
        this.evidence.find((e) => e.id === id && e.completion) ??
        this.completed.find((e) => e.id === id);
      if (!e) refused.push(id);
      else if (!this.completed.some((c) => c.id === id)) this.completed.push(e);
    }
    this.completed = this.completed.slice(-12);
    return { completed: this.completed.map((e) => ({ ...e })), refused };
  }
  due(p: PlayerId, tick: number) {
    const s = this.states[p];
    return (
      !!s.observation &&
      tick - s.since >= PROGRESS.idleTicks &&
      (!s.permit || tick >= s.permit.until)
    );
  }
  interrupt(p: PlayerId, tick: number) {
    const s = this.states[p];
    const expiredDependency = !!s.permit && tick >= s.permit.until;
    if (
      !this.due(p, tick) ||
      (!expiredDependency &&
        s.reportedEpoch === s.epoch &&
        tick < (s.nextReview ?? 0))
    )
      return false;
    s.permit = undefined;
    s.reportedEpoch = s.epoch;
    s.nextReview = tick + PROGRESS.idleTicks;
    return true;
  }
  // An overdue hero gets one bounded wait per specific observed condition.
  // Renewing it or changing the seconds/text cannot extend its deadline.
  permit(
    p: PlayerId,
    tick: number,
    condition: string,
    seconds: number,
    commit = true,
  ) {
    const s = this.states[p];
    if (s.permit?.condition === condition) return tick < s.permit.until;
    if (s.usedConditions.has(condition)) return false;
    if (commit) {
      s.usedConditions.add(condition);
      s.permit = { condition, until: tick + Math.min(seconds, 30) * 60 };
    }
    return true;
  }
  repeated(p: PlayerId, action: GameAction, o: Observation) {
    if (!["ability", "attack", "interact", "use_item"].includes(action.type))
      return false;
    const same = this.states[p].attempts.filter(
      (a) => a.signature === actionSignature(action, o) && a.accepted,
    );
    return (
      same.filter((a) => !a.effects.length && o.tick >= a.until).length >= 2
    );
  }
  assignmentCount(p: PlayerId, signature: string) {
    const s = this.states[p];
    return s.assignments.get(`${s.epoch}:${signature}`) ?? 0;
  }
  assignment(p: PlayerId, signature: string) {
    const s = this.states[p];
    const key = `${s.epoch}:${signature}`;
    const n = (s.assignments.get(key) ?? 0) + 1;
    s.assignments.set(key, n);
    if (s.assignments.size > 64)
      s.assignments.delete(s.assignments.keys().next().value!);
    return n;
  }
  view(p: PlayerId, tick: number) {
    const s = this.states[p];
    return {
      idle_seconds: Math.max(0, (tick - s.since) / 60),
      last_progress_tick: s.since,
      reconsider_assignments: this.due(p, tick),
      bounded_dependency: s.permit ?? null,
      attempted_actions: s.attempts.map((a) => ({
        tick: a.tick,
        action: a.action,
        accepted: a.accepted,
        execution: a.execution,
        confirmed_effect_ids: a.effects,
        outcome: a.outcome,
      })),
      repeated_assignments: [...s.assignments]
        .filter(([k, n]) => k.startsWith(`${s.epoch}:`) && n > 1)
        .map(([k, count]) => ({
          assignment: k.slice(k.indexOf(":") + 1),
          count,
        })),
      instruction:
        "Accepted input, confirmed execution, observed effects and completed subgoals are separate. Unchanged results require a different approach; renewed waits do not count as progress.",
    };
  }
}
