// OFFLINE CERTIFICATION WITNESS for Situation B (Griffin Trial, Unprepared).
// docs/midterm/SITUATION_B_GRIFFIN.md.
//
// A scripted, SOLUTION-AWARE controller. It exists only to show that the
// Griffin can be beaten without the Vanity Mirror or Enchanted Shears, with
// neither hero knocked out, through the five-operation interface, inside the
// episode limits. It is not a player, not a baseline, and not shown to any
// model: its tactic and action sequence must never reach a prompt.
//
// What it uses: each hero's own observation (the Griffin's position and its
// drawn "GRIFFIN hp/640 · PHASE" label, its own HP and abilities, the backpack
// panel), and ordinary actions validated by the environment. It never reads
// GameRoom or World, never sets state, teleports or injects items.
//
// Tactic (worked out from the game's source; that knowledge is what makes it
// solution-aware): Coco stands on the north shore and follows the flying
// Griffin from side to side, throwing fireballs north when it is straight
// above her, and holds Ward while it charges or fires its beam. Sieg waits
// farther south holding Guard, so the Griffin (which aims at the nearer hero)
// targets Coco. When its HP reaches 0 Coco flies to the nest and presses E.

import type { Director } from "./director.js";
import type { Direction, GameAction, Observation, VisibleThing } from "../types.js";

/** The shore line Coco keeps to (tiles): just south of the water. */
const SHORE_Y = 12.6;
/** Sieg's waiting point, farther from the Griffin than Coco. */
const SIEG_POST = { x: 21.5, y: 20 };
/** Fire when the Griffin is within this many tiles of straight north. */
const AIM_TOLERANCE = 0.8;
const NEST = { x: 20, y: 4.4 };

export interface GriffinView {
  hp: number;
  phase: string;
  thing: VisibleThing;
}

/** The Griffin as the hero's screen labels it, or null when it is not on screen. */
export function griffinOnScreen(o: Observation): GriffinView | null {
  const thing = o.visible.find((v) => v.kind === "creature" && v.name === "griffin");
  if (!thing) return null;
  const m = /GRIFFIN (\d+)\/\d+ · (.+)$/.exec(thing.details ?? "");
  if (m) return { hp: Number(m[1]), phase: m[2], thing };
  if (/DEFEATED|defeated/.test(thing.details ?? "")) return { hp: 0, phase: "DEFEATED", thing };
  return { hp: -1, phase: thing.details ?? "", thing };
}

const dangerous = (phase: string) => phase === "BEAM CHARGE" || phase === "BEAM" || phase === "HEADBUTT CHARGE" || phase === "HEADBUTT";
const holds = (o: Observation, item: string) => o.inventory.items.some((i) => i.id === item);

function walkToward(o: Observation, to: { x: number; y: number }, maxTicks = 12): GameAction | null {
  const dx = to.x - o.self.x,
    dy = to.y - o.self.y;
  if (Math.hypot(dx, dy) < 0.3) return null;
  const angle = Math.atan2(dy, dx);
  const dirs: Direction[] = ["e", "se", "s", "sw", "w", "nw", "n", "ne"];
  const direction = dirs[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
  const tilesPerTick = 190 / 32 / 60;
  return { type: "move", direction, ticks: Math.max(1, Math.min(maxTicks, Math.round(Math.hypot(dx, dy) / tilesPerTick))) };
}

export interface WitnessLog {
  tick: number;
  note: string;
}

/** How long a timed action runs, so the partner's action can be given the same length (no filler waits). */
function ticksOf(a: GameAction): number {
  if (a.type === "move" || a.type === "wait" || a.type === "defend") return a.ticks;
  if (a.type === "attack" || a.type === "interact" || a.type === "ability") return 2;
  return 1;
}

/** Fireball speed (tiles per second): 380 px/s, as stated nowhere to players but derivable from play. */
const FIREBALL_TILES_PER_S = 380 / 32;

/**
 * Plays Situation B from its start to the end of the episode. Returns notes
 * for the certification record; the episode outcome comes from outcome().
 */
export async function griffinWitness(d: Director, maxRounds = 4000): Promise<WitnessLog[]> {
  const log: WitnessLog[] = [];
  const note = async (n: string) => log.push({ tick: (await d.obs("sieg")).tick, note: n });
  let lastHp = -2;
  let prev: { x: number; tick: number } | null = null;
  // Sieg's action is matched in length to Coco's, so neither hero idles on one-tick fillers.
  const pair = async (sieg: (ticks: number) => GameAction, coco: GameAction) => d.both(sieg(ticksOf(coco)), coco);
  const guard = (ticks: number): GameAction => ({ type: "defend", ticks });
  for (let i = 0; i < maxRounds; i++) {
    if ((await d.outcome()).status !== "ongoing") break;
    const [s, c] = [await d.obs("sieg"), await d.obs("coco")];
    if (s.dialogue || c.dialogue) {
      await d.dialogue();
      continue;
    }
    const g = griffinOnScreen(c) ?? griffinOnScreen(s);
    if (g && g.hp !== lastHp && g.hp >= 0) {
      if (lastHp === -2) await note(`griffin seen: ${g.thing.details}`);
      else if (g.hp % 80 === 0 || g.hp === 0) await note(`griffin ${g.hp} HP`);
      lastHp = g.hp;
    }
    // After the defeat: Coco flies to the nest and presses E for the wig.
    if (g && g.hp === 0) {
      if (holds(c, "griffin_wig")) break;
      if (c.inventory.nearbyTarget && /nest/i.test(c.inventory.nearbyTarget.name)) {
        await note("Coco presses E at the nest");
        await pair(guard, { type: "interact" });
        continue;
      }
      const flying = c.self.status.some((x) => x.startsWith("flying"));
      const ready = c.abilities.find((a) => a.name === "Flight")?.state === "ready";
      if (!flying && ready) {
        await note("Coco casts Flight");
        await pair(guard, { type: "ability", ability: "flight" });
        continue;
      }
      await pair(guard, walkToward(c, NEST, 20) ?? { type: "wait", ticks: 6 });
      continue;
    }
    // Sieg: walk to his post, then hold Guard (his walk gets its own round).
    const siegStep = walkToward(s, SIEG_POST, 30);
    if (siegStep && (!g || !dangerous(g.phase))) {
      await d.both(siegStep, { type: "defend", ticks: siegStep.type === "move" ? siegStep.ticks : 6 });
      continue;
    }
    // Coco: get to the shore first.
    if (c.self.y > SHORE_Y + 0.4 || c.self.y < SHORE_Y - 0.4) {
      const step = walkToward(c, { x: g ? Math.max(9.5, Math.min(30.5, g.thing.x)) : 20, y: SHORE_Y }, 20);
      await pair(guard, step ?? guard(6));
      continue;
    }
    // Not on either screen, or charging or firing: hold Ward.
    if (!g || dangerous(g.phase)) {
      prev = null;
      await pair(guard, guard(8));
      continue;
    }
    // Lead the shot: where the Griffin will be when a fireball thrown now reaches its line.
    const vx = prev && c.tick > prev.tick ? ((g.thing.x - prev.x) / (c.tick - prev.tick)) * 60 : 0;
    prev = { x: g.thing.x, tick: c.tick };
    const flight = Math.max(0, c.self.y - g.thing.y) / FIREBALL_TILES_PER_S;
    const aimX = g.thing.x + vx * flight;
    const dx = aimX - c.self.x;
    const jReady = c.abilities.find((a) => a.key === "J")?.state === "ready";
    if (Math.abs(dx) <= AIM_TOLERANCE && g.thing.y < c.self.y) {
      await pair(guard, jReady ? { type: "attack", direction: "n" } : { type: "wait", ticks: 4 });
      continue;
    }
    // Follow the Griffin along the shore (never into the water).
    const tx = Math.max(9.5, Math.min(30.5, aimX));
    await pair(guard, walkToward(c, { x: tx, y: SHORE_Y }, 8) ?? { type: "wait", ticks: 4 });
  }
  const o = await d.outcome();
  await note(`outcome ${o.status} ${o.reason ?? ""}`);
  return log;
}

// ── Certification run (offline, trusted side) ───────────────────────────────

import { environmentFor } from "../suite.js";
import { Director as RouteDirector } from "./director.js";
import { TraceWriter, verifyTrace } from "../trace.js";
import type { GameOutcome, PlayerId } from "../types.js";
import { canonicalJson } from "../situationA.js";
import { createHash } from "node:crypto";

export interface WitnessRun {
  seed: number;
  startHash: string;
  startTick: number;
  /** Every action each hero submitted while the scenario prefix ran (the legal start's history). */
  prefixActions: Record<PlayerId, GameAction[]>;
  prefixActionsSha256: string;
  /** Every action each hero submitted during the episode, in order. */
  actions: Record<PlayerId, GameAction[]>;
  actionsSha256: string;
  outcome: GameOutcome;
  endHash: string;
  milestones: { tick: number; milestone: string }[];
  knockouts: number;
  log: WitnessLog[];
  trace: TraceWriter;
  wallSeconds: number;
}

export const actionsDigest = (a: Record<PlayerId, GameAction[]>) => createHash("sha256").update(canonicalJson(a)).digest("hex");

/**
 * Resets Situation B and plays the witness to a terminal outcome, recording
 * the prefix history, the episode's actions and a hash-chained trace.
 * `tracePath` writes the trace to disk as well (it must not exist).
 */
export async function runGriffinWitness(seed = 0, tracePath?: string): Promise<WitnessRun> {
  const trace = new TraceWriter(tracePath);
  const env = environmentFor("griffin-unprepared-v1", { trace: (e) => trace.write(e) });
  const prefixActions: Record<PlayerId, GameAction[]> = { sieg: [], coco: [] };
  let recording = true;
  const real = env.step.bind(env);
  env.step = (p, a) => {
    if (recording) prefixActions[p].push(a);
    return real(p, a);
  };
  const started = Date.now();
  const reset = await env.reset(seed);
  recording = false;
  const log = await griffinWitness(new RouteDirector({ env }));
  const outcome = await env.outcome();
  verifyTrace(trace.lines);
  const actions: Record<PlayerId, GameAction[]> = { sieg: [], coco: [] };
  for (const l of trace.lines) if (l.type === "action") actions[l.player as PlayerId].push((l.data as { action: GameAction }).action);
  return {
    seed,
    startHash: reset.startHash,
    startTick: reset.tick,
    prefixActions,
    prefixActionsSha256: actionsDigest(prefixActions),
    actions,
    actionsSha256: actionsDigest(actions),
    outcome,
    endHash: env.evaluatorReport().stateHash,
    milestones: trace.lines.filter((l) => l.type === "milestone").map((l) => ({ tick: l.tick, milestone: (l.data as { milestone: string }).milestone })),
    // A knockout that ends the episode is reported by the terminal reason, not by a result line (audit finding 4).
    knockouts: Math.max(trace.lines.filter((l) => l.type === "result" && JSON.stringify(l.data).includes("Your health ran out")).length, outcome.reason === "knocked_out" ? 1 : 0),
    log,
    trace,
    wallSeconds: (Date.now() - started) / 1000,
  };
}
