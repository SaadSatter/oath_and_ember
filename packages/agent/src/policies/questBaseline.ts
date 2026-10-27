// Quest-aware scripted baseline (owner decision 2026-10-27; docs/midterm/BASELINE_PLAN.md).
//
// Two independent players, one per hero. Each one:
//   - sees only its own observation, legal actions and last result (the same
//     inputs the model player gets), through the ordinary Policy interface;
//   - coordinates with its partner only through the `message` action, using
//     the fixed phrases in PHRASE below;
//   - returns one action per decision (no batching);
//   - makes no model calls.
// Its quest knowledge (area order, puzzle procedures, waypoints, mirror push
// spots and angles) is hand-coded in questKnowledge.ts and disclosed there.
// It is a scripted comparison, not a generalizing player.
//
// Design: one generator per hero and area. A generator is a small state
// machine that yields one action at a time and reads the latest observation
// from the shared context after every yield. The driver answers dialogue,
// starts a new generator whenever the area changes, and turns a failure into
// waiting (the episode then ends at a limit, never in a hang).

import type { ActionSpec, Direction, GameAction, Observation, StepResult } from "../types.js";
import type { Decision, Policy } from "./policy.js";
import { directionTo, planStep, type NavOptions, type Point } from "./navigate.js";
import { planFight, type FightOptions } from "./combat.js";
import {
  FINALE_PATH,
  GRIFFIN,
  ITEM,
  MAZE_COW,
  MAZE_GUARD_SPOTS,
  MAZE_HEDGE_SPOT,
  MAZE_PATH,
  MIRROR,
  MIRROR_REST,
  MIRROR_TARGET,
  PAD,
  POND_FLIGHT_IN,
  POND_FLIGHT_OUT,
  POND_PLAN,
  SANCTUARY,
  SHOT,
  SHRINE_EXIT_SPOT,
  SPIKE_MOUTH,
  SPIKES_CROSSED_X,
  TO_MIRROR,
  WALK_SPEED,
} from "./questKnowledge.js";

/** The whole message protocol. Each phrase is sent as its exact text. */
export const PHRASE = {
  pastTheCow: "Cow moved. I'm past it, waiting by the gate side.",
  readyForSlow: "Ready to chase the wolf. Slow time when you can.",
  slowingTime: "Slowing time now!",
  haveKey: "I have the gate key. Meet me at the gate.",
  atGate: "I'm at the gate.",
  gateOpen: "Gate open. Go get the chest.",
  atSpikes: "At the spikes, Super Speed ready.",
  slowReady: "Slow Time is ready.",
  now: "Now!",
  crossed: "I'm across the spikes.",
  mirrorSet: (i: number) => `Mirror M${i + 1} is set. Fire from pad A${i + 1}.`,
  fired: (i: number) => `Fired from pad A${i + 1}.`,
  mirrorsDone: "All flames lit. The sanctuary is yours.",
  wigOnShore: "Got the wig. I'm back on the shore.",
  byOffering: "I'm by the offering.",
} as const;

type Hero = "Sieg" | "Coco";
interface Ctx {
  hero: Hero;
  o: Observation;
  legal: ActionSpec[];
  last?: StepResult;
  /** Partner messages already acted on, by "tick:text". */
  heard: Set<string>;
  note(text: string): void;
}
type Script<R = void> = Generator<GameAction, R, void>;

class ScriptFailed extends Error {}

// ── Reading the observation ────────────────────────────────────────────────
const has = (o: Observation, item: string) => o.inventory.items.some((i) => i.id === item);
const ready = (o: Observation, ability: string) => o.abilities.find((a) => a.name === ability)?.state === "ready";
const flying = (o: Observation) => o.self.status.some((s) => s.startsWith("flying"));
const slowed = (o: Observation) => o.self.status.includes("time is slowed");
const sprinting = (o: Observation) => o.self.status.some((s) => s.startsWith("super speed"));
/** The opening scene has not been played yet (journal as drawn at the goddess checkpoint). */
const beforeOpening = (o: Observation) => o.journal.current?.step === "Speak to the Guardian Goddess";

// ── Action helpers (each yields actions until done) ────────────────────────
function* wait(ticks: number): Script {
  for (let left = ticks; left > 0; left -= 60) yield { type: "wait", ticks: Math.min(60, left) };
}
function* waitUntil(c: Ctx, done: () => boolean, maxTicks: number, step: number, what: string): Script {
  for (let t = 0; t < maxTicks; t += step) {
    if (done()) return;
    yield { type: "wait", ticks: step };
  }
  if (!done()) throw new ScriptFailed(`gave up waiting for ${what}`);
}
function* untilReady(c: Ctx, ability: string, maxTicks = 1800): Script {
  yield* waitUntil(c, () => ready(c.o, ability), maxTicks, 10, `${ability} to be ready`);
}
function* go(c: Ctx, to: Point, opts: NavOptions = {}, maxSteps = 200): Script {
  for (let i = 0; i < maxSteps; i++) {
    const st = planStep(c.o, to, opts);
    if (st.kind === "arrived") return;
    if (st.kind === "stuck") throw new ScriptFailed(`stuck going to ${to.x},${to.y}: ${st.reason}`);
    yield { type: "move", direction: st.direction, ticks: st.ticks };
  }
  throw new ScriptFailed(`did not reach ${to.x},${to.y}`);
}
function* goVia(c: Ctx, points: Point[], opts: NavOptions = {}): Script {
  for (const p of points) yield* go(c, p, opts);
}
/** Walk through exact points, steering from the hero's own position. */
function* walkExact(c: Ctx, points: number[][], tolerance = 0.1): Script {
  for (const [x, y] of points)
    for (let k = 0; k < 40; k++) {
      const dx = x - c.o.self.x,
        dy = y - c.o.self.y,
        dist = Math.hypot(dx, dy);
      if (dist <= tolerance) break;
      yield { type: "move", direction: directionTo(dx, dy), ticks: Math.max(1, Math.min(60, Math.round(dist / WALK_SPEED))) };
    }
}
function* fight(c: Ctx, opts: FightOptions, maxRounds = 400): Script {
  for (let i = 0; i < maxRounds; i++) {
    const act = planFight(c.o, opts);
    if (!act) return;
    yield act;
    // Let the attack cooldown pass (0.45 s Sieg, 0.6 s Coco).
    if (act.type === "attack") yield { type: "wait", ticks: 20 };
  }
  throw new ScriptFailed("fight did not finish");
}
function* say(text: string): Script {
  yield { type: "message", text };
}
/** True (once) when the partner has sent this exact phrase and it has not been acted on yet. */
function heard(c: Ctx, phrase: string) {
  const m = c.o.messages.find((x) => x.text === phrase && !c.heard.has(`${x.tick}:${x.text}`));
  if (m) c.heard.add(`${m.tick}:${m.text}`);
  return !!m;
}
/** Wait for one of the phrases; returns the one heard. */
function* hear(c: Ctx, phrases: string[], step = 20, maxTicks = 60 * 60 * 8): Script<string> {
  for (let t = 0; t < maxTicks; t += step) {
    for (const p of phrases) if (heard(c, p)) return p;
    yield { type: "wait", ticks: step };
  }
  throw new ScriptFailed(`never heard: ${phrases.join(" | ")}`);
}
function* ability(c: Ctx, name: "slow_time" | "super_speed" | "flight" | "black_hole", direction?: Direction): Script {
  yield { type: "ability", ability: name, ...(direction ? { direction } : {}) };
}
/** Press E to travel; retry if the area did not change. */
function* leave(c: Ctx): Script {
  const from = c.o.area.name;
  for (let k = 0; k < 3; k++) {
    yield { type: "interact" };
    for (let j = 0; j < 12 && c.o.area.name === from; j++) yield { type: "wait", ticks: 10 };
  }
  throw new ScriptFailed(`could not leave ${from}`);
}
function* idle(): Script {
  for (;;) yield { type: "wait", ticks: 30 };
}

// ── Goddess Shrine ─────────────────────────────────────────────────────────
function* shrine(c: Ctx): Script {
  // Wait for the opening scene to play (the driver reads the dialogue).
  yield* waitUntil(c, () => !beforeOpening(c.o), 1800, 10, "the opening scene");
  if (has(c.o, ITEM.wig)) {
    // Finale: both walk to the offering; Coco offers the wig once Sieg is there.
    if (c.hero === "Sieg") {
      yield* goVia(c, FINALE_PATH.sieg);
      yield* say(PHRASE.byOffering);
    } else {
      yield* goVia(c, FINALE_PATH.coco);
      yield* hear(c, [PHRASE.byOffering]);
      if (!c.o.inventory.nearbyTarget) throw new ScriptFailed("the offering is not in reach");
      yield { type: "use_item", item: ITEM.wig };
      c.note("offered the wig");
    }
    return;
  }
  if (c.hero === "Coco") return; // Sieg leads the party out of the shrine.
  const exit = !has(c.o, ITEM.shears) ? "east" : !has(c.o, ITEM.mirror) ? "west" : "north";
  c.note(`shrine: leaving by the ${exit} exit`);
  yield* go(c, SHRINE_EXIT_SPOT[exit], { tolerance: 0.6 });
  yield* leave(c);
}

// ── Hedge Maze ─────────────────────────────────────────────────────────────
function* mazeSieg(c: Ctx): Script {
  for (const wp of MAZE_GUARD_SPOTS) {
    yield* go(c, { x: wp.x + 1, y: wp.y });
    yield* fight(c, { radius: 10 });
  }
  yield* go(c, MAZE_COW.siegWait);
  yield* fight(c, { radius: 10 });
  yield* hear(c, [PHRASE.pastTheCow]);
  yield* goVia(c, MAZE_PATH.siegToWolf);
  // Wolf chase: Coco slows time, Sieg sprints and presses E when the panel offers the wolf.
  for (let attempt = 0; attempt < 4 && !has(c.o, ITEM.gateKey); attempt++) {
    yield* untilReady(c, "Super Speed");
    yield* say(PHRASE.readyForSlow);
    yield* hear(c, [PHRASE.slowingTime], 10);
    yield* waitUntil(c, () => slowed(c.o), 30, 1, "time to slow");
    yield* ability(c, "super_speed");
    const corridor = MAZE_PATH.wolfCorridor;
    let target: Point = corridor[1],
      sweep = 0;
    for (let i = 0; i < 240; i++) {
      const o = c.o;
      if (has(o, ITEM.gateKey) || !sprinting(o)) break;
      if (o.inventory.nearbyTarget && /wolf/i.test(o.inventory.nearbyTarget.name)) {
        yield { type: "interact" };
        continue;
      }
      const wolf = o.visible.find((v) => v.name.startsWith("FOREST WOLF"));
      if (wolf) target = { x: wolf.x, y: wolf.y };
      else if (Math.hypot(target.x - o.self.x, target.y - o.self.y) < 0.6) target = corridor[(sweep += 2) % 3];
      const st = planStep(o, target, { tolerance: 0.4, maxTicks: 4 });
      yield st.kind === "move" ? { type: "move", direction: st.direction, ticks: st.ticks } : { type: "wait", ticks: 2 };
    }
    c.note(`wolf chase ${attempt + 1}: ${has(c.o, ITEM.gateKey) ? "caught" : "missed"}`);
  }
  if (!has(c.o, ITEM.gateKey)) throw new ScriptFailed("no gate key after 4 chases");
  yield* say(PHRASE.haveKey);
  const at = c.o.self;
  yield* goVia(c, at.y < 8.5 ? MAZE_PATH.siegToGateFromTop : MAZE_PATH.siegToGateFromLane(at.x));
  yield* hear(c, [PHRASE.atGate]);
  yield { type: "interact" };
  yield* say(PHRASE.gateOpen);
}
function* mazeCoco(c: Ctx): Script {
  for (const wp of MAZE_GUARD_SPOTS) {
    yield* go(c, wp);
    yield* fight(c, { radius: 10 });
  }
  yield* go(c, MAZE_HEDGE_SPOT);
  if (c.o.visible.some((v) => v.name.startsWith("FIREBALL · dry hedge"))) {
    yield { type: "attack", direction: "e" };
    yield* wait(60);
  }
  yield* fight(c, { radius: 10 });
  // Black Hole pulls the cow into its bay.
  yield* go(c, MAZE_COW.cocoApproach);
  yield* go(c, MAZE_COW.cocoCast);
  yield* untilReady(c, "Black Hole");
  yield* ability(c, "black_hole", MAZE_COW.castDirection);
  yield* wait(300);
  yield* goVia(c, MAZE_PATH.cocoToGateSide);
  yield* say(PHRASE.pastTheCow);
  // Slow Time whenever Sieg is ready to chase, until he has the key.
  for (;;) {
    const m = yield* hear(c, [PHRASE.readyForSlow, PHRASE.haveKey]);
    if (m === PHRASE.haveKey) break;
    yield* untilReady(c, "Slow Time");
    yield* say(PHRASE.slowingTime);
    yield* ability(c, "slow_time");
  }
  yield* goVia(c, MAZE_PATH.cocoToGate);
  yield* say(PHRASE.atGate);
  yield* hear(c, [PHRASE.gateOpen]);
  yield* goVia(c, MAZE_PATH.cocoToChest);
  yield { type: "interact" };
  yield* wait(60);
  if (!has(c.o, ITEM.shears)) throw new ScriptFailed("no shears from the chest");
  c.note("took the Enchanted Shears");
  yield* goVia(c, MAZE_PATH.cocoToExit);
  yield* leave(c);
}

// ── Mirror Pond ────────────────────────────────────────────────────────────
const mod180 = (a: number) => ((a % 180) + 180) % 180;
function mirrorDeg(c: Ctx, i: number) {
  const m = c.o.visible.find((v) => v.name === `mirror M${i + 1}`);
  if (!m?.details) throw new ScriptFailed(`mirror M${i + 1} is not on screen`);
  return Number(m.details.split("°")[0]);
}
function mirrorOff(c: Ctx, i: number, target: number) {
  const e = Math.abs(mod180(mirrorDeg(c, i)) - mod180(target));
  return Math.min(e, 180 - e);
}
function* pushHere(c: Ctx, i: number, ticks: number): Script {
  yield { type: "move", direction: directionTo(MIRROR[i].x - c.o.self.x, MIRROR[i].y - c.o.self.y), ticks: 1 };
  for (let left = ticks; left > 0; left -= 60) yield { type: "ability", ability: "push", ticks: Math.min(60, left) };
}
function* turnMirror(c: Ctx, i: number, phase: "solve" | "rest", target: number): Script {
  let dir = 0;
  for (const step of POND_PLAN[i].filter((s) => s.phase === phase)) {
    yield* walkExact(c, step.walk!);
    const before = mirrorDeg(c, i);
    yield* pushHere(c, i, step.push!);
    const change = ((((mirrorDeg(c, i) - before) % 360) + 540) % 360) - 180;
    if (Math.abs(change) > 0.5) dir = Math.sign(change);
  }
  // Closed-loop correction from the drawn angle; if a push changes nothing,
  // step 0.4 tile further off the mirror's axis and push again.
  for (let k = 0; k < 6 && dir && mirrorOff(c, i, target) > 0.05; k++) {
    const a = mod180(mirrorDeg(c, i)),
      t = mod180(target);
    const before = mirrorDeg(c, i);
    yield* pushHere(c, i, Math.max(1, Math.round((dir > 0 ? mod180(t - a) : mod180(a - t)) / 1.5)));
    if (mirrorDeg(c, i) !== before) continue;
    const rad = (mirrorDeg(c, i) * Math.PI) / 180,
      me = c.o.self;
    const nx = -Math.sin(rad),
      ny = Math.cos(rad);
    const sgn = (me.x - MIRROR[i].x) * nx + (me.y - MIRROR[i].y) * ny >= 0 ? 1 : -1;
    yield* walkExact(c, [[me.x + sgn * 0.4 * nx, me.y + sgn * 0.4 * ny]], 0.1);
  }
  c.note(`M${i + 1} ${phase}: ${mirrorDeg(c, i)}° (off ${mirrorOff(c, i, target)}°)`);
}
function* pondSieg(c: Ctx): Script {
  // Spikes: at the mouth, call for Slow Time when the east column retracts, then sprint west.
  let crossed = false;
  for (let attempt = 0; attempt < 6 && !crossed; attempt++) {
    yield* untilReady(c, "Super Speed");
    yield* go(c, SPIKE_MOUTH);
    yield* say(PHRASE.atSpikes);
    yield* hear(c, [PHRASE.slowReady], 10);
    for (let k = 0; k < 120; k++) {
      const spikes = c.o.visible.filter((v) => v.name === "spike trap").sort((a, b) => a.x - b.x);
      if (spikes.length === 4 && spikes[3].details === "retracting") break;
      yield { type: "wait", ticks: 2 };
    }
    yield* say(PHRASE.now);
    for (let k = 0; k < 30 && !slowed(c.o); k++) yield { type: "wait", ticks: 1 };
    yield* ability(c, "super_speed");
    for (let k = 0; k < 12 && c.o.self.x >= 37; k++) yield { type: "move", direction: "w", ticks: 8 };
    crossed = c.o.self.x < SPIKES_CROSSED_X;
    c.note(`spike crossing ${attempt + 1}: ${crossed ? "crossed" : "failed"}`);
  }
  if (!crossed) throw new ScriptFailed("could not cross the spikes");
  yield* say(PHRASE.crossed);
  for (let i = 0; i < 4; i++) {
    yield* goVia(c, TO_MIRROR[i]);
    yield* turnMirror(c, i, "solve", MIRROR_TARGET[i]);
    yield* say(PHRASE.mirrorSet(i));
    yield* hear(c, [PHRASE.fired(i)]);
    yield* turnMirror(c, i, "rest", MIRROR_REST[i]);
    yield* walkExact(c, POND_PLAN[i].find((s) => s.phase === "leave")!.walk!);
  }
  yield* goVia(c, SANCTUARY.siegAside);
  yield* say(PHRASE.mirrorsDone);
}
function* fly(c: Ctx): Script {
  if (flying(c.o)) return;
  yield* untilReady(c, "Flight");
  yield* ability(c, "flight");
}
function* pondCoco(c: Ctx): Script {
  yield* fly(c);
  yield* goVia(c, POND_FLIGHT_IN, { flying: true });
  for (;;) {
    const m = yield* hear(c, [PHRASE.atSpikes, PHRASE.crossed]);
    if (m === PHRASE.crossed) break;
    yield* untilReady(c, "Slow Time");
    yield* say(PHRASE.slowReady);
    yield* hear(c, [PHRASE.now], 2, 1200);
    yield* ability(c, "slow_time");
  }
  for (let i = 0; i < 4; i++) {
    yield* hear(c, [PHRASE.mirrorSet(i)]);
    if (i >= 2) {
      yield* untilReady(c, "Flight");
      yield* ability(c, "flight");
    }
    yield* go(c, PAD[i], { tolerance: 0.12, flying: true });
    // Slow Time slows fireballs too: let it end before firing.
    yield* waitUntil(c, () => !slowed(c.o), 900, 10, "time to run normally");
    yield { type: "attack", direction: SHOT[i] };
    yield* wait(150);
    yield* say(PHRASE.fired(i));
  }
  yield* hear(c, [PHRASE.mirrorsDone]);
  yield* fly(c);
  yield* go(c, SANCTUARY.cocoChest, { flying: true, tolerance: 0.3 });
  const near = c.o.inventory.nearbyTarget;
  if (!near || !/Vanity Mirror/i.test(near.name)) throw new ScriptFailed("the sanctuary chest is not in reach");
  yield { type: "interact" };
  yield* wait(60);
  if (!has(c.o, ITEM.mirror)) throw new ScriptFailed("no Vanity Mirror from the chest");
  c.note("took the Vanity Mirror");
  yield* fly(c);
  yield* goVia(c, POND_FLIGHT_OUT, { flying: true });
  yield* leave(c);
}

// ── Griffin Enclosure ──────────────────────────────────────────────────────
function* griffinSieg(c: Ctx): Script {
  yield* hear(c, [PHRASE.wigOnShore]);
  yield* go(c, GRIFFIN.siegExit, { tolerance: 0.6 });
  yield* leave(c);
}
function* griffinCoco(c: Ctx): Script {
  yield* untilReady(c, "Flight");
  yield* ability(c, "flight");
  for (let k = 0; k < 80; k++) {
    if (c.o.inventory.nearbyTarget && /nest/i.test(c.o.inventory.nearbyTarget.name)) break;
    const st = planStep(c.o, GRIFFIN.nest, { flying: true, tolerance: 0.5, maxTicks: 10 });
    if (st.kind !== "move") break;
    yield { type: "move", direction: st.direction, ticks: st.ticks };
  }
  if (!c.o.inventory.nearbyTarget || !/nest/i.test(c.o.inventory.nearbyTarget.name)) throw new ScriptFailed("did not reach the nest");
  // One E gives the griffin the tools; after its grooming, E picks up the wig.
  yield { type: "interact" };
  for (let k = 0; k < 60 && !has(c.o, ITEM.wig); k++) {
    yield* wait(30);
    yield { type: "interact" };
  }
  if (!has(c.o, ITEM.wig)) throw new ScriptFailed("no wig");
  c.note("picked up the Griffin Wig");
  yield* go(c, GRIFFIN.cocoShore, { flying: true, tolerance: 0.6 });
  yield* say(PHRASE.wigOnShore);
}

const SCRIPTS: Record<string, Record<Hero, (c: Ctx) => Script>> = {
  "Goddess Shrine": { Sieg: shrine, Coco: shrine },
  "Hedge Maze": { Sieg: mazeSieg, Coco: mazeCoco },
  "Mirror Pond": { Sieg: pondSieg, Coco: pondCoco },
  "Griffin Enclosure": { Sieg: griffinSieg, Coco: griffinCoco },
};

export class QuestBaseline implements Policy {
  readonly name: string;
  /** Stage notes and failures, with the tick (for the run summary; never shown to the partner). */
  readonly log: { tick: number; note: string }[] = [];
  private ctx: Ctx | undefined;
  private run: { area: string; script: Script } | undefined;
  private line: { key: string; waited: number } | undefined;

  constructor(readonly hero: Hero) {
    this.name = `baseline-quest(${hero})`;
  }

  async decide(input: { observation: Observation; legal: ActionSpec[]; last?: StepResult }): Promise<Decision> {
    const o = input.observation;
    if (o.hero !== this.hero) throw Error(`baseline for ${this.hero} was given ${o.hero}'s observation`);
    this.ctx ??= { hero: this.hero, o, legal: input.legal, heard: new Set(), note: (note) => this.log.push({ tick: this.ctx!.o.tick, note }) };
    const c = this.ctx;
    c.o = o;
    c.legal = input.legal;
    c.last = input.last;
    if (o.dialogue) return { action: this.dialogue(o, input.legal) };
    this.line = undefined;
    if (!this.run || this.run.area !== o.area.name) {
      const make = SCRIPTS[o.area.name]?.[this.hero];
      this.run = { area: o.area.name, script: make ? make(c) : idle() };
      c.note(`entered ${o.area.name}`);
    }
    let next: IteratorResult<GameAction, void>;
    try {
      next = this.run.script.next();
    } catch (e) {
      c.note(`failed: ${(e as Error).message}`);
      this.run.script = idle();
      next = this.run.script.next();
    }
    if (next.done) {
      this.run.script = idle();
      next = this.run.script.next();
    }
    return { action: next.value as GameAction };
  }

  /** Choose option 1 at a choice; press E on your own lines; otherwise wait. */
  private dialogue(o: Observation, legal: ActionSpec[]): GameAction {
    const d = o.dialogue!;
    const can = (t: GameAction["type"]) => legal.some((a) => a.type === t);
    if (d.choices && !d.waiting && can("choose_dialogue")) return { type: "choose_dialogue", option: 1 };
    if (d.canAdvance && can("advance_dialogue")) {
      // Sieg presses at once. Coco waits a moment first, so on a line both may
      // move on, only one press lands.
      if (this.hero === "Sieg") return { type: "advance_dialogue" };
      const key = `${d.speaker}:${d.text}`;
      if (this.line?.key === key && this.line.waited >= 6) {
        this.line = undefined;
        return { type: "advance_dialogue" };
      }
      this.line = { key, waited: (this.line?.key === key ? this.line.waited : 0) + 3 };
      return { type: "wait", ticks: 3 };
    }
    return { type: "wait", ticks: 5 };
  }
}
