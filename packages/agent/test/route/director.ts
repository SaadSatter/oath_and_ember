// Test-only route director. It drives both heroes through the five-operation
// interface (reset / observe / legal_actions / step / outcome) and nothing
// else: it never reads GameRoom or World. Its knowledge of the quest is in
// the constants of the route file, worked out offline from the development
// references (docs/midterm/ROUTE_LOG.md). It is not a player and is never
// shown to one.

import { AgentEnvironment } from "../../src/environment.js";
import { planStep, type NavOptions, type Point } from "../../src/policies/navigate.js";
import { planFight, type FightOptions } from "../../src/policies/combat.js";
import type { GameAction, Observation, PlayerId, StepResult } from "../../src/types.js";

export interface LogLine {
  tick: number;
  note: string;
}

export class Director {
  readonly env: AgentEnvironment;
  readonly log: LogLine[] = [];
  /** Every dialogue box the route observed (for checks on what heroes are shown). */
  readonly dialogues: { id: PlayerId; tick: number; dialogue: Observation["dialogue"] }[] = [];
  /** Which response each hero gives at a story choice (1-based). */
  choices: Record<PlayerId, number> = { sieg: 1, coco: 1 };
  private tick = 0;

  constructor(opts: ConstructorParameters<typeof AgentEnvironment>[0] = {}) {
    this.env = new AgentEnvironment({
      preset: "full",
      labels: "as-drawn",
      // The route proves feasibility; its own decision count is measured, not capped.
      limits: { maxDecisionsPerPlayer: 100_000 },
      ...opts,
    });
  }

  note(note: string) {
    this.log.push({ tick: this.tick, note });
  }

  async reset(seed: number) {
    const r = await this.env.reset(seed);
    this.tick = r.tick;
    this.note(`reset seed ${seed}, start hash ${r.startHash.slice(0, 16)}`);
    return r;
  }

  /** Size of what a model would be shown at each observation: observation + legal actions (JSON characters). */
  readonly promptChars: number[] = [];
  measurePrompts = false;

  async obs(id: PlayerId): Promise<Observation> {
    const o = await this.env.observe(id);
    if (o.dialogue) this.dialogues.push({ id, tick: o.tick, dialogue: o.dialogue });
    if (this.measurePrompts) this.promptChars.push(JSON.stringify({ observation: o, legal_actions: await this.env.legal_actions(id) }).length);
    return o;
  }

  async outcome() {
    return this.env.outcome();
  }

  /**
   * Submit one action per hero and wait until both have finished. A hero who
   * finishes first (an instant action, or an interruption) gets one-tick
   * waits, because game time only runs while both heroes have an action.
   */
  async both(a?: GameAction, b?: GameAction): Promise<{ sieg: StepResult; coco: StepResult }> {
    const fill: GameAction = { type: "wait", ticks: 1 };
    type Run = { p: Promise<StepResult>; settled: boolean; original: boolean; r?: StepResult };
    const running = new Map<PlayerId, Run>();
    const results: Partial<Record<PlayerId, StepResult>> = {};
    const start = (id: PlayerId, act: GameAction, original: boolean) => {
      const run: Run = { settled: false, original } as Run;
      run.p = this.env.step(id, act).then((r) => {
        run.settled = true;
        run.r = r;
        return r;
      });
      running.set(id, run);
    };
    start("sieg", a ?? fill, true);
    start("coco", b ?? fill, true);
    let over = false;
    for (;;) {
      const open = [...running.values()].filter((r) => !r.settled);
      if (open.length) await Promise.race(open.map((r) => r.p));
      // Drain everything that has settled (two can finish on the same tick).
      for (const [id, run] of [...running]) {
        if (!run.settled) continue;
        if (run.original) results[id] = run.r;
        if (run.r!.done) over = true;
        running.delete(id);
      }
      if (over) {
        await Promise.allSettled([...running.values()].map((r) => r.p));
        break;
      }
      if (!running.size) break;
      // Exactly one hero is deciding while the other runs: keep it busy.
      for (const id of ["sieg", "coco"] as PlayerId[]) if (!running.has(id)) start(id, fill, false);
    }
    this.tick = (await this.env.observe("sieg")).tick;
    const none: StepResult = { accepted: false, ticks: 0, feedback: [], done: true };
    return { sieg: results.sieg ?? none, coco: results.coco ?? none };
  }

  /** Read every dialogue line to the end, giving the configured responses. */
  async dialogue(maxRounds = 400) {
    for (let i = 0; i < maxRounds; i++) {
      const [s, c] = await Promise.all([this.obs("sieg"), this.obs("coco")]);
      if (!s.dialogue && !c.dialogue) return;
      const act = (o: Observation, id: PlayerId, partnerAdvances: boolean): GameAction =>
        o.dialogue?.choices && !o.dialogue.waiting
          ? { type: "choose_dialogue", option: this.choices[id] }
          : o.dialogue?.canAdvance && !partnerAdvances
            ? { type: "advance_dialogue" }
            : { type: "wait", ticks: 5 };
      // A shared line needs one press; Sieg presses when both may.
      const siegAct = act(s, "sieg", false);
      await this.both(siegAct, act(c, "coco", siegAct.type === "advance_dialogue"));
    }
    throw Error("dialogue did not finish");
  }

  /** Wait until a story scene starts (lead-in lines are -1) or `ticks` pass. */
  async untilDialogue(maxTicks = 600) {
    for (let t = 0; t < maxTicks; t += 5) {
      const [s, c] = await Promise.all([this.obs("sieg"), this.obs("coco")]);
      if (s.dialogue || c.dialogue) return true;
      await this.both({ type: "wait", ticks: 5 }, { type: "wait", ticks: 5 });
    }
    return false;
  }

  /**
   * Walk one or both heroes to targets (tile coordinates), each with its own
   * options. A hero without a target waits. Dialogue that appears is read.
   */
  async go(targets: Partial<Record<PlayerId, { to: Point; opts?: NavOptions }>>, maxSteps = 200) {
    for (let i = 0; i < maxSteps; i++) {
      const obs = { sieg: await this.obs("sieg"), coco: await this.obs("coco") };
      if (obs.sieg.dialogue || obs.coco.dialogue) {
        await this.dialogue();
        continue;
      }
      const acts: Partial<Record<PlayerId, GameAction>> = {};
      let moving = false;
      for (const id of ["sieg", "coco"] as PlayerId[]) {
        const t = targets[id];
        if (!t) continue;
        const step = planStep(obs[id], t.to, t.opts);
        if (step.kind === "move") {
          acts[id] = { type: "move", direction: step.direction, ticks: step.ticks };
          moving = true;
        } else if (step.kind === "stuck") throw Error(`${id} stuck: ${step.reason}`);
      }
      if (!moving) return;
      // The hero without a move waits as long as the longest move, so one
      // action covers the whole step instead of one-tick fillers.
      const ticks = Math.max(...[acts.sieg, acts.coco].map((a) => (a && "ticks" in a ? (a.ticks ?? 1) : 1)));
      await this.both(acts.sieg ?? { type: "wait", ticks }, acts.coco ?? { type: "wait", ticks });
    }
    const where = async (id: PlayerId) => JSON.stringify((await this.obs(id)).self);
    throw Error(`go() did not arrive: sieg ${await where("sieg")} coco ${await where("coco")}`);
  }

  /** Wait any number of ticks (the interface allows at most 60 per action). */
  async wait(ticks: number) {
    for (let left = ticks; left > 0; left -= 60) {
      const t = Math.min(60, left);
      await this.both({ type: "wait", ticks: t }, { type: "wait", ticks: t });
    }
  }

  /**
   * Fight until no enemy is visible within the radius to either fighting hero.
   * Uses only each hero's own observation (policies/combat.ts).
   */
  async fight(heroes: Partial<Record<PlayerId, FightOptions>>, maxRounds = 400) {
    for (let i = 0; i < maxRounds; i++) {
      const obs = { sieg: await this.obs("sieg"), coco: await this.obs("coco") };
      if (obs.sieg.dialogue || obs.coco.dialogue) {
        await this.dialogue();
        continue;
      }
      const plan = (id: PlayerId) => (heroes[id] ? planFight(obs[id], heroes[id]) : null);
      const a = plan("sieg"),
        b = plan("coco");
      if (!a && !b) return i;
      await this.both(a ?? { type: "wait", ticks: 6 }, b ?? { type: "wait", ticks: 6 });
      // Let the attack cooldown (0.45 s Sieg, 0.6 s Coco) pass after a swing.
      if (a?.type === "attack" || b?.type === "attack") await this.both({ type: "wait", ticks: 20 }, { type: "wait", ticks: 20 });
    }
    throw Error("fight() did not finish");
  }

  async self(id: PlayerId) {
    return (await this.obs(id)).self;
  }

  /** Visible things matching a name or kind, from this hero's own screen. */
  async see(id: PlayerId, match: (v: Observation["visible"][number]) => boolean) {
    return (await this.obs(id)).visible.filter(match);
  }
}
