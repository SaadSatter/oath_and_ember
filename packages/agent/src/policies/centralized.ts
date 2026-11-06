// Opt-in centralized model player, "model-centralized"
// (docs/midterm/MODEL_CENTRALIZED.md). Owner request 2026-11-05.
//
// One LLM planner decides for both heroes; each hero keeps its own legal
// controller. This is deliberately NOT the two-independent-agents setup of
// the other model players: the planner sees both heroes' observations and
// there is no in-game messaging. It is its own player kind, tuning-only, and
// its results are reported separately.
//
//   - CentralPlanner: one per episode. One model request per planning
//     decision, answering with orders for one or both heroes. It keeps a
//     persistent plan memory (plan text, completed subgoals, known obstacles),
//     a log of recent events, and a record of things either hero saw.
//   - CentralizedController: one per hero, a subclass of the model-navigator
//     player that reuses its controller unchanged: A* walking over this hero's
//     own remembered map (go_to), wait_until, fight (enemies only), catch
//     (chase a named thing and press an ordinary E), the Black Hole aim
//     preview, event detection and edge-triggered movement lines. Every
//     action it submits is an ordinary action the game validates.
//
// Information boundary: the planner's input is built only from the two
// heroes' own observations (what their screens showed), their own HeroMemory
// (built from those observations and their own action results), their legal
// actions and the controllers' own state. Nothing from World, GameRoom, map
// files, puzzle state, routes, baselines or walkthroughs; this module imports
// only types, the navigator, the hero memory and the prompt helpers.

import { createHash } from "node:crypto";
import type { ActionSpec, GameAction, Observation, PlayerId, VisibleThing } from "../types.js";
import type { MeteredGateway } from "../budget.js";
import { MAX_BATCH } from "../batch.js";
import type { HeroMemory } from "../heroMemory.js";
import { tutorialBlock, tutorialId, taskId } from "../playerKnowledge.js";
import { briefingBlock, briefingId, describeTurn, replySchema, TASK } from "./llm.js";
import type { Decision, Policy } from "./policy.js";
import { aimPreview, describeIntent, detectEvents, NAV, NAV_ID, NavigatorPlayer, parseNavigatorReply, snapshot, type NavStatus } from "./navigator.js";

/** Planner bounds. Changing any of them changes the player (its name carries CENTRAL_ID). */
export const CENTRAL = Object.freeze({
  /** A hero with no intention holds (ordinary waits) this long before the planner is asked about it again. */
  holdSeconds: 30,
  /** Walking moves in a row before a go_to checks in with the planner (the navigator uses 12). */
  walkCheckInMoves: 20,
  /** A walking hero the game does not let move (a scene, a waiting dialogue line) pauses this long (ticks) before the planner is asked. */
  pauseTicks: 120,
  /** Damage since the last plan that counts as significant: this share of maximum HP... */
  damageShare: 0.2,
  /** ...or HP falling to this share of maximum or below. */
  lowHpShare: 0.4,
  /** Longest plan text the planner keeps (characters). */
  planChars: 600,
  /** Longest single subgoal or obstacle line (characters) and how many of each are kept. */
  itemChars: 160,
  subgoalsKept: 12,
  obstaclesKept: 10,
  /** Things either hero saw that neither screen shows now, newest first. */
  sightingsKept: 40,
  /** Earlier planning reasons shown as recent_events. */
  eventLogKept: 16,
  /** Per hero: executed and refused actions, feedback lines, dialogue lines and verified events shown. */
  completedShown: 4,
  rejectedShown: 3,
  feedbackShown: 6,
  dialogueShown: 4,
  verifiedShown: 8,
});
export const CENTRAL_ID = createHash("sha256").update(JSON.stringify({ CENTRAL, NAV_ID })).digest("hex").slice(0, 8);

const HEROES = { sieg: "Sieg", coco: "Coco" } as const;
const PIDS: readonly PlayerId[] = ["sieg", "coco"];
const SIGHT_KINDS = new Set(["enemy", "creature", "object", "exit", "label"]);

/**
 * The planner's system prompt. General rules of the interface and the
 * intentions only: no game content, place, coordinate, route or puzzle step
 * (tested). The task, tutorial and episode briefing follow as their own blocks.
 */
export function centralSystemPrompt(manual: string, maxBatch: number = MAX_BATCH, task: string = TASK) {
  return `You are the single planner for both heroes of the cooperative game Oath and Ember: Sieg and Coco. You decide for both of them. Each hero has its own controller that carries out the intention you give it with ordinary game actions, which the game checks like any player's input. You see what each hero's own screen shows; nothing else. In this mode the heroes do not send each other messages: you already see both screens, and message actions are never sent.

Task: ${task}
The task and the episode briefing below are the episode's objective. Keep your plan aimed at it from start to finish.

What you receive when you are asked (one JSON object):
- why_you_are_asked: for each hero, the events that made its controller ask, written from that hero's point of view ("you" is that hero). A hero with no events is carrying on with its intention.
- plan_memory: the plan, subgoals_done and known_obstacles exactly as you last wrote them, and recent_events: earlier reasons you were asked, oldest first. Nothing else is remembered between your replies, so keep what matters there.
- shared: the shared backpack and quest journal; maps: for each area a hero is in, one map combining every tile either hero's screen has shown ("?" neither screen ever showed it; "#" blocked; "." open ground seen but not walked on; "+" open ground a hero walked on; "~" water or gap; "o" an object; ">" an exit; "^" a raised hazard; ":" seen, but something stood on it; "S" Sieg now, "C" Coco now, "B" both). Its first two rows give each column's x (tens digit, then units digit); every other row starts with its y. Tiles may have changed since a hero saw them. seen_earlier lists things a hero saw that neither screen shows now, with who saw them, where and when; they may have moved or gone.
- heroes.sieg and heroes.coco: each hero's own state as of its latest decision (observed_at_tick): area, position, health, abilities, status, screen, visible things, dialogue, recent feedback, what happened to its last actions, its current intention, and the actions legal for it right now. One hero may be partway through an action while the other asks.

Reply with ONE JSON object and nothing else:
{"plan": "<your plan, max ${CENTRAL.planChars} characters>", "subgoals_done": ["<short line>", ...], "known_obstacles": ["<short line>", ...], "orders": [{"hero": "sieg" or "coco", "actions": [...0 to ${maxBatch} actions...], and at most one intention: "go_to", "wait_until", "fight", "catch" or "hold": true}]}
- "plan" replaces your plan. "subgoals_done" and "known_obstacles" replace those lists when you send them and stay as they were when you leave them out (at most ${CENTRAL.subgoalsKept} and ${CENTRAL.obstaclesKept} lines are kept).
- An order for a hero replaces that hero's intention and runs its "actions" first, in order, then the intention. A hero you give no order keeps its current intention. Give each hero at most one order. "orders" may be empty when both should carry on.
- Each action must be one of that hero's legal_actions, e.g. {"type":"move","direction":"n","ticks":30} or {"type":"interact"} or {"type":"ability","ability":"..."}. A batch of actions stops as soon as anything happens (an invalid action, damage, a new place, dialogue, any feedback, a backpack or journal change); the rest are skipped and did not happen.
- A hero with no intention and no actions holds: it waits with ordinary waits until something happens, at most ${CENTRAL.holdSeconds} seconds of game time, and then you are asked about it again. "hold": true asks for that explicitly.

Intentions (each hero's controller carries them out without asking you again until something happens):
- "go_to": {"x": <tile x>, "y": <tile y>} walks the hero there with ordinary moves, choosing a path over that hero's own remembered map and current screen; tiles its screen never showed count as possibly open, so the path may change as it sees more. It ends on arrival, when no path leads there, or after ${CENTRAL.walkCheckInMoves} walking moves (you are then asked and may simply send it again). Use it for walking more than a couple of tiles; use move actions for short, precise steps.
- "wait_until": {"seconds": <1-${NAV.maxWaitSeconds}>, "watch": "<name of something on that hero's screen>"} waits until something happens, the watched thing moves or leaves the screen, or the time is up. "watch" is optional.
- "fight": {"target": "<enemy name on that hero's screen>", "seconds": <1-${NAV.maxFightSeconds}>} attacks that enemy with ordinary moves and J presses until it is gone from the screen, the hero has lost a quarter of its maximum HP since the fight began, something else happens, or the time is up. It attacks only things listed as enemies; naming a creature or an object ends it at once without touching it.
- "catch": {"target": "<name of something>", "seconds": <1-${NAV.maxCatchSeconds}>} chases that thing with ordinary moves, re-aiming whenever it is on the hero's screen and heading for where it was last seen when it is not (if only the other hero's screen shows it, or showed it earlier in this area, the chase starts from there). When it is close to the hero and the hero's backpack panel shows a nearby target, it presses E (an ordinary interact; the game decides what happens). It ends when an E press changes the backpack, on reaching where it was last seen without seeing it, with no path there, or when the time is up. It never attacks, uses abilities or items.
- While an intention runs you are asked again only when something happens to either hero: an intention ending or becoming impossible, something not seen before coming on that hero's screen, an enemy coming close, a new kind of action becoming available (for example E next to an object), dialogue, a change to the backpack or journal, a new game feedback line (things starting or stopping moving among them), an action being refused, significant damage (a fifth of maximum HP since your last reply, or health falling to ${Math.round(CENTRAL.lowHpShare * 100)}% or below), or a bounded intention running out. A hero waiting or the other hero moving is not by itself a reason.
- navigation.aim_preview (listed for a hero while its Black Hole is available): for each of the eight directions, where the spell would stop by the rules in the manual (up to 6 tiles; the first blocked tile, enemy or creature body on that hero's map) and which things its screen shows within 3 tiles of that point, with the direction each would be pulled. Worked out from that hero's own map and screen, to within about half a tile. Whether and where to use it is your choice.

How the game reads your actions:
- Each hero acts only through the actions in its own legal_actions, rebuilt every decision from its situation: where it stands, what is next to it, whether a dialogue line is waiting for it, and which abilities are ready. An action that is not listed is not available to that hero now.
- The player manual below is written for people using a keyboard. Each control it describes corresponds to an action (walking is move, E is interact or advance_dialogue, J is attack, K is defend, number keys are ability, the backpack panel is use_item, numbered responses are choose_dialogue), and only when that action is in the hero's legal_actions.
- Time only passes while actions run (60 ticks = 1 second). While you think, the game waits.
- Coordinates are in tiles; y grows downward (north is up). A hero's "screen" rows show its view, one character per tile: "@" that hero, "P" the other hero, "#" blocked, "~" water or gap, "." open ground, "E" enemy, "C" creature, "o" object, ">" exit, "*" projectile, "^" a raised hazard. Labels (kind "label") are text in the world, listed in visible to be read. A visible entry with an extent covers that block of tiles (top-left x and y, w and h).
- A hero's x and y are cut off to two decimals; its body is a square about 0.8 tiles wide centred there, and it fits only where all of it is clear. A move's result says how far the hero's walking took it ("full", "partial", "none", or "not_applied" when the game did not take the input). A move that stops short is not proof there is no way through.
- last_turn reports each action of the hero's last decision with its status: "executed", "rejected" (the game refused it), "stale" (a dialogue press for a line that had already moved on) or "skipped" (never tried). Do not treat a skipped or rejected action as done.
- J needs a moment between uses; while J shows "recovering", pressing it does nothing. An ability marked "recharging (Ns)" cannot be used for N more seconds. Abilities that recharge are wasted when nothing they act on is near.
- When both heroes are in a scene they read the same dialogue box, and one press from either moves a shared line on for both: give advance_dialogue to one hero only. A line meant only for one hero can be moved on only by that hero.
- If an action failed or nothing happened, change the approach rather than repeating it. Report in subgoals_done only what the observations show happened; mark guesses as guesses in your plan.
- Reply with compact JSON and no padding or blank lines.

The public player manual follows.

${manual}`;
}

/** The reply schema: the public action object once (inside orders), plus the plan fields. No game content. */
export function centralSchema(maxBatch: number = MAX_BATCH): Record<string, unknown> {
  const base = replySchema(maxBatch, "persistent") as { properties: { actions: { items: unknown } } };
  const action = base.properties.actions.items;
  return {
    type: "object",
    properties: {
      plan: { type: "string" },
      subgoals_done: { type: "array", items: { type: "string" } },
      known_obstacles: { type: "array", items: { type: "string" } },
      orders: {
        type: "array",
        items: {
          type: "object",
          properties: {
            hero: { type: "string", enum: ["sieg", "coco"] },
            actions: { type: "array", items: action },
            go_to: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"], additionalProperties: false },
            wait_until: { type: "object", properties: { seconds: { type: "number" }, watch: { type: "string" } }, required: ["seconds"], additionalProperties: false },
            fight: { type: "object", properties: { target: { type: "string" }, seconds: { type: "number" } }, required: ["target", "seconds"], additionalProperties: false },
            catch: { type: "object", properties: { target: { type: "string" }, seconds: { type: "number" } }, required: ["target", "seconds"], additionalProperties: false },
            hold: { type: "boolean" },
          },
          required: ["hero"],
          additionalProperties: false,
        },
      },
    },
    required: ["plan", "orders"],
    additionalProperties: false,
  };
}

/** One hero's order, read and checked. */
export interface Order {
  hero: PlayerId;
  actions: GameAction[];
  dropped: GameAction[];
  goTo?: { x: number; y: number };
  waitUntil?: { seconds: number; watch?: string };
  fight?: { target: string; seconds: number };
  catch?: { target: string; seconds: number };
  hold: boolean;
}
export type CentralReply =
  | { ok: true; plan: string; subgoalsDone?: string[]; knownObstacles?: string[]; orders: Order[]; notices: string[] }
  | { ok: false; reason: string };

/** Optional action fields a strict schema may send as null (as openai.ts normalizes them). */
const NULLABLE_ACTION_FIELDS = ["direction", "ticks", "ability", "item", "option", "text"];
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Reads a planner reply. Conservative, like parseReply: one JSON object, no
 * unknown fields, each order checked with the navigator's own reply reader.
 * A null field counts as absent. Message actions are removed (and reported);
 * no other action is changed, repaired or invented.
 */
export function parseCentralReply(text: string, maxBatch: number = MAX_BATCH): CentralReply {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { ok: false, reason: "The reply was not one JSON object." };
  }
  if (!isObj(v)) return { ok: false, reason: "The reply was not one JSON object." };
  const unknown = Object.keys(v).find((k) => !["plan", "subgoals_done", "known_obstacles", "orders"].includes(k));
  if (unknown) return { ok: false, reason: `The reply had an unexpected field "${unknown}".` };
  if (typeof v.plan !== "string") return { ok: false, reason: '"plan" must be text.' };
  const lines = (k: "subgoals_done" | "known_obstacles"): string[] | undefined | false => {
    const x = v[k];
    if (x === undefined || x === null) return undefined;
    if (!Array.isArray(x) || x.some((s) => typeof s !== "string")) return false;
    return x.map((s: string) => s.trim().slice(0, CENTRAL.itemChars)).filter(Boolean);
  };
  const subgoalsDone = lines("subgoals_done"), knownObstacles = lines("known_obstacles");
  if (subgoalsDone === false) return { ok: false, reason: '"subgoals_done" must be a list of text.' };
  if (knownObstacles === false) return { ok: false, reason: '"known_obstacles" must be a list of text.' };
  if (!Array.isArray(v.orders)) return { ok: false, reason: '"orders" must be a list.' };
  const orders: Order[] = [];
  const notices: string[] = [];
  for (const [i, raw] of v.orders.entries()) {
    if (!isObj(raw)) return { ok: false, reason: `Order ${i + 1} is not an object.` };
    const o: Record<string, unknown> = Object.fromEntries(Object.entries(raw).filter(([, x]) => x !== null));
    const hero = o.hero;
    if (hero !== "sieg" && hero !== "coco") return { ok: false, reason: `Order ${i + 1} must name "hero": "sieg" or "coco".` };
    if (orders.some((x) => x.hero === hero)) return { ok: false, reason: `The reply gave ${HEROES[hero]} more than one order.` };
    const extra = Object.keys(o).find((k) => !["hero", "actions", "go_to", "wait_until", "fight", "catch", "hold"].includes(k));
    if (extra) return { ok: false, reason: `Order ${i + 1} had an unexpected field "${extra}".` };
    if (o.hold !== undefined && typeof o.hold !== "boolean") return { ok: false, reason: `Order ${i + 1}: "hold" must be true or false.` };
    let actions: unknown[] = [];
    if (o.actions !== undefined) {
      if (!Array.isArray(o.actions)) return { ok: false, reason: `Order ${i + 1}: "actions" must be a list.` };
      actions = o.actions.map((a) => (isObj(a) ? Object.fromEntries(Object.entries(a).filter(([k, x]) => !(x === null && NULLABLE_ACTION_FIELDS.includes(k)))) : a));
    }
    const kept = actions.filter((a) => !(isObj(a) && a.type === "message"));
    if (kept.length < actions.length) notices.push(`${HEROES[hero]}: message actions are not used in this mode and were not sent.`);
    const hold = o.hold === true;
    const intentions = ["go_to", "wait_until", "fight", "catch"].filter((k) => o[k] !== undefined);
    if (hold && intentions.length) return { ok: false, reason: `Order ${i + 1} had "hold" and another intention.` };
    if (!kept.length && !intentions.length && !hold) {
      // Nothing for this hero (perhaps only a message): it keeps its intention.
      continue;
    }
    const nav = parseNavigatorReply(JSON.stringify({ actions: kept, ...Object.fromEntries(intentions.map((k) => [k, o[k]])), ...(hold ? { stop_navigation: true } : {}) }), maxBatch);
    if (!nav.ok) return { ok: false, reason: `Order ${i + 1} (${HEROES[hero]}): ${nav.reason}` };
    orders.push({
      hero,
      actions: nav.actions,
      dropped: nav.dropped,
      ...(nav.goTo ? { goTo: nav.goTo } : {}),
      ...(nav.waitUntil ? { waitUntil: nav.waitUntil } : {}),
      ...(nav.fight ? { fight: nav.fight } : {}),
      ...(nav.catch ? { catch: nav.catch } : {}),
      hold,
    });
  }
  return {
    ok: true,
    plan: v.plan.slice(0, CENTRAL.planChars),
    ...(subgoalsDone ? { subgoalsDone: subgoalsDone.slice(-CENTRAL.subgoalsKept) } : {}),
    ...(knownObstacles ? { knownObstacles: knownObstacles.slice(-CENTRAL.obstaclesKept) } : {}),
    orders,
    notices,
  };
}

// ── Shared knowledge built from the two heroes' own observations ──────────

interface Sighting {
  kind: VisibleThing["kind"];
  name: string;
  area: string;
  x: number;
  y: number;
  details?: string;
  seenBy: "Sieg" | "Coco";
  tick: number;
}

/**
 * One map per area: every tile either hero's own memory holds, the more
 * recently seen version where they differ, with both heroes' current places.
 * Built only from the two HeroMemory records (their own screens).
 */
export function unionMap(area: string, w: number, h: number, memories: readonly HeroMemory[], heroes: { mark: string; x: number; y: number }[]) {
  const at = (x: number, y: number) => {
    let best: string | undefined, bestTick = -Infinity, walked = false;
    for (const m of memories) {
      const t = m.terrainAt(area, x, y);
      if (m.walkedAt(area, x, y)) walked = true;
      if (t === undefined || t === "?") continue;
      const tick = m.lastSeenTickAt(area, x, y) ?? 0;
      if (tick > bestTick) {
        best = t;
        bestTick = tick;
      }
    }
    return { t: best ?? "?", walked };
  };
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  const cells: { t: string; walked: boolean }[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      cells.push(c);
      if (c.t === "?" && !c.walked) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  if (x1 < 0) return { area, rows: [] as string[] };
  const pad = String(y1).length, lead = " ".repeat(pad + 1);
  const xs = Array.from({ length: x1 - x0 + 1 }, (_, k) => x0 + k);
  const rows = [lead + xs.map((x) => (x >= 10 ? String(Math.floor(x / 10) % 10) : " ")).join(""), lead + xs.map((x) => String(x % 10)).join("")];
  const marks = new Map<string, string>();
  for (const hh of heroes) {
    const k = `${Math.floor(hh.x)},${Math.floor(hh.y)}`;
    marks.set(k, marks.has(k) ? "B" : hh.mark);
  }
  for (let y = y0; y <= y1; y++) {
    let line = `${String(y).padStart(pad)} `;
    for (const x of xs) {
      const c = cells[y * w + x];
      line += marks.get(`${x},${y}`) ?? (c.walked && [".", ":", "?", "#"].includes(c.t) ? "+" : c.t);
    }
    rows.push(line);
  }
  return { area, x_from: x0, x_to: x1, y_from: y0, y_to: y1, rows };
}

const URGENT = /^(dialogue on your screen|you took damage|you lost \d+ HP|an action of this hero was refused|the last planner reply could not be used|your backpack changed|your quest journal changed|you are in a new area)/;

// ── The planner ───────────────────────────────────────────────────────────

/** One planning round: which heroes asked, and the result they share. */
interface Round {
  members: Map<PlayerId, Parameters<Policy["decide"]>[0]>;
  promise: Promise<RoundResult>;
}
type RoundResult =
  | { ok: true; planId: number; payer: PlayerId; usage: Decision["usage"]; raw: string; problem?: string; orders: Order[]; notices: string[]; reasons: Record<PlayerId, string[]> }
  | { ok: false; planId: number; payer: PlayerId; error: unknown };

export interface PlannerCallRecord {
  planId: number;
  tick: number;
  payer: PlayerId;
  members: PlayerId[];
  reasons: Record<PlayerId, string[]>;
  orders: PlayerId[];
  problem?: string;
  userChars: number;
}

export class CentralPlanner {
  readonly system: string;
  readonly promptHash: string;
  private readonly schema: Record<string, unknown>;
  readonly controllers: Record<PlayerId, CentralizedController>;
  /** The persistent plan memory, exactly as the model last wrote it. */
  private memory = { plan: "", subgoalsDone: [] as string[], knownObstacles: [] as string[] };
  private readonly sightings = new Map<string, Sighting>();
  private events: { tick: number; hero: "Sieg" | "Coco"; text: string }[] = [];
  private notices: string[] = [];
  private gathering?: Round;
  private inFlight?: Promise<RoundResult>;
  private planCount = 0;
  /** Every planning call, for traces, tests and the call-count comparison. */
  readonly calls: PlannerCallRecord[] = [];

  constructor(
    manual: string,
    readonly gateways: Record<PlayerId, MeteredGateway>,
    readonly maxBatch: number = MAX_BATCH,
    readonly briefing?: string,
    readonly tutorial?: string,
    readonly task: string = TASK,
  ) {
    if (!Number.isInteger(maxBatch) || maxBatch < 1 || maxBatch > MAX_BATCH) throw Error(`maxBatch must be an integer from 1 to ${MAX_BATCH}.`);
    if (gateways.sieg === gateways.coco || gateways.sieg.player !== "sieg" || gateways.coco.player !== "coco") throw Error("The planner needs one metered gateway per hero.");
    if (gateways.sieg.budget !== gateways.coco.budget) throw Error("Both heroes' gateways must share the episode budget.");
    this.system = centralSystemPrompt(manual, maxBatch, task) + (tutorial ? tutorialBlock(tutorial) : "") + (briefing ? briefingBlock(briefing) : "");
    this.promptHash = createHash("sha256").update(this.system).digest("hex");
    this.schema = centralSchema(maxBatch);
    const label = gateways.sieg.label;
    const name = `centralized-${CENTRAL_ID}(${label})${maxBatch > 1 ? `·batch${maxBatch}` : ""}${tutorial ? `·tutorial-${tutorialId(tutorial)}` : ""}${briefing ? `·briefing-${briefingId(briefing)}` : ""}${task !== TASK ? `·task-${taskId(task)}` : ""}`;
    this.controllers = {
      sieg: new CentralizedController("Sieg", this, name, manual),
      coco: new CentralizedController("Coco", this, name, manual),
    };
  }

  /** Read-only plan memory, for tests and diagnostics. */
  planMemory() {
    return { plan: this.memory.plan, subgoalsDone: [...this.memory.subgoalsDone], knownObstacles: [...this.memory.knownObstacles] };
  }
  sightingList() {
    return [...this.sightings.values()].map((s) => ({ ...s }));
  }

  /** Record what a hero's screen shows (called on every decision of that hero). */
  observe(hero: "Sieg" | "Coco", o: Observation) {
    for (const v of o.visible) {
      if (!SIGHT_KINDS.has(v.kind)) continue;
      const mobile = v.kind === "enemy" || v.kind === "creature";
      const k = mobile ? `${o.area.name}|${v.kind}|${v.name}` : `${o.area.name}|${v.kind}|${v.name}|${Math.floor(v.x)},${Math.floor(v.y)}`;
      this.sightings.delete(k);
      this.sightings.set(k, { kind: v.kind, name: v.name, area: o.area.name, x: v.x, y: v.y, ...(v.details ? { details: v.details } : {}), seenBy: hero, tick: o.tick });
    }
    while (this.sightings.size > 200) this.sightings.delete(this.sightings.keys().next().value!);
  }

  /** Reasons a hero noticed but that did not need a plan of their own; shown in the next plan. */
  log(hero: "Sieg" | "Coco", reasons: string[], tick: number) {
    for (const text of reasons) this.events.push({ tick, hero, text });
    if (this.events.length > CENTRAL.eventLogKept) this.events.splice(0, this.events.length - CENTRAL.eventLogKept);
  }

  /** Where `name` is now (the other hero's screen) or was last seen, in `area`. */
  lastKnown(name: string, area: string, exclude: PlayerId): { x: number; y: number; tick: number } | undefined {
    const n = name.toLowerCase();
    const other = this.controllers[exclude === "sieg" ? "coco" : "sieg"].latest();
    const now = other?.o.area.name === area ? other.o.visible.find((v) => v.name.toLowerCase() === n && v.kind !== "partner") : undefined;
    if (now) return { x: now.x, y: now.y, tick: other!.o.tick };
    const s = [...this.sightings.values()].filter((t) => t.area === area && t.name.toLowerCase() === n).sort((a, b) => b.tick - a.tick)[0];
    return s ? { x: s.x, y: s.y, tick: s.tick } : undefined;
  }

  /**
   * A controller needs a plan. Heroes that ask at the same moment share one
   * round (one model call); a hero that asks while a call is in flight takes
   * that call's order for it if there is one, and otherwise asks again.
   */
  async request(c: CentralizedController, input: Parameters<Policy["decide"]>[0]): Promise<Decision> {
    // A round still gathering is joined; a call already in flight is waited for.
    while (!this.gathering && this.inFlight) {
      await this.inFlight;
      if (c.takeFresh()) {
        this.log(c.hero, c.takePending(), input.observation.tick);
        const d = c.startAssignment(input, { source: "assigned", planId: this.planCount });
        if (d) return d;
      }
    }
    const round = this.gathering ?? this.openRound();
    round.members.set(c.pid, input);
    const r = await round.promise;
    const note = { planId: r.planId, payer: r.payer, members: [...round.members.keys()] };
    if (!r.ok) {
      if (r.payer === c.pid) throw r.error;
      return { replyProblem: `The shared planning call (charged to ${HEROES[r.payer]}) failed; nothing was done.`, note: { source: "planner-shared", ...note, failed: true } };
    }
    const own = r.payer === c.pid ? { usage: r.usage, raw: r.raw } : {};
    const meta = { source: r.payer === c.pid ? "planner" : "planner-shared", ...note, events: r.reasons[c.pid] ?? [], orders: r.orders.map((o) => o.hero), ...(r.notices.length ? { notices: r.notices } : {}) };
    if (r.problem) return { replyProblem: r.problem, ...own, note: { ...meta, problem: r.problem } };
    c.takeFresh();
    const d = c.startAssignment(input, meta);
    if (d) return { ...d, ...own };
    return { replyProblem: `Nothing could be started for ${c.hero}: ${c.peekPending().join("; ")}. Nothing was done.`, ...own, note: meta };
  }

  /** A new round. It waits one turn of the event loop so a hero deciding at the same moment joins it. */
  private openRound(): Round {
    const members = new Map<PlayerId, Parameters<Policy["decide"]>[0]>();
    const round: Round = { members, promise: Promise.resolve() as never };
    round.promise = (async () => {
      await new Promise<void>((r) => setImmediate(r));
      this.gathering = undefined;
      return this.run(members);
    })();
    const flight: Promise<RoundResult> = round.promise.then(
      (r) => r,
      (error) => ({ ok: false as const, planId: this.planCount, payer: [...members.keys()][0], error }),
    );
    this.gathering = round;
    this.inFlight = flight;
    void flight.then(() => {
      if (this.inFlight === flight) this.inFlight = undefined;
    });
    return round;
  }

  /** One planning call for the heroes in `members`. */
  private async run(members: Map<PlayerId, Parameters<Policy["decide"]>[0]>): Promise<RoundResult> {
    const ids = PIDS.filter((p) => members.has(p));
    const budget = this.gateways.sieg.budget;
    // The call is charged to a hero that asked: the one with fewer calls so far.
    const payer = ids.slice().sort((a, b) => budget.calls[a] - budget.calls[b])[0];
    const planId = ++this.planCount;
    const reasons = Object.fromEntries(ids.map((p) => [p, this.controllers[p].takePending()])) as Record<PlayerId, string[]>;
    const user = this.userMessage(reasons);
    const tick = members.get(payer)!.observation.tick;
    const record: PlannerCallRecord = { planId, tick, payer, members: ids, reasons, orders: [], userChars: user.length };
    this.calls.push(record);
    for (const p of PIDS) this.controllers[p].planned();
    let reply;
    try {
      reply = await this.gateways[payer].complete(this.system, user, { schema: this.schema });
    } catch (error) {
      record.problem = "call failed";
      // Nothing was decided: each hero keeps its reasons and asks again on its next decision.
      for (const p of ids) this.controllers[p].restorePending(reasons[p]);
      return { ok: false, planId, payer, error };
    }
    const raw = reply.rawText ?? reply.text;
    const base = { ok: true as const, planId, payer, usage: reply.record, raw, reasons };
    // Reasons are kept in the event log either way, so a failed reply loses nothing.
    for (const p of ids) this.log(HEROES[p], reasons[p], tick);
    if (reply.meta?.stopReason === "max_tokens") {
      record.problem = "The reply was cut off at the output limit (stop reason max_tokens).";
      return { ...base, problem: record.problem, orders: [], notices: [] };
    }
    const parsed = parseCentralReply(reply.text, this.maxBatch);
    if (!parsed.ok) {
      record.problem = parsed.reason;
      return { ...base, problem: parsed.reason, orders: [], notices: [] };
    }
    this.memory.plan = parsed.plan;
    if (parsed.subgoalsDone) this.memory.subgoalsDone = parsed.subgoalsDone;
    if (parsed.knownObstacles) this.memory.knownObstacles = parsed.knownObstacles;
    this.notices = [...parsed.notices];
    for (const order of parsed.orders) {
      const c = this.controllers[order.hero];
      const o = members.get(order.hero)?.observation ?? c.latest()?.o;
      if (o) c.applyOrder(order, o);
    }
    // A hero left with nothing to do holds until something happens.
    for (const p of PIDS) {
      const o = members.get(p)?.observation ?? this.controllers[p].latest()?.o;
      if (o) this.controllers[p].ensureIntention(o);
    }
    record.orders = parsed.orders.map((o) => o.hero);
    return { ...base, orders: parsed.orders, notices: parsed.notices };
  }

  /** The planner's one user message: shared knowledge once, then each hero's own state. */
  userMessage(reasons: Partial<Record<PlayerId, string[]>>) {
    const latest = PIDS.map((p) => this.controllers[p].latest()).filter((x): x is NonNullable<typeof x> => !!x);
    const freshest = latest.slice().sort((a, b) => b.o.tick - a.o.tick)[0]?.o;
    const memories = PIDS.map((p) => this.controllers[p].heroMemory);
    const areas = new Map<string, { w: number; h: number }>();
    for (const l of latest) areas.set(l.o.area.name, { w: l.o.area.widthTiles, h: l.o.area.heightTiles });
    const maps = [...areas].map(([area, { w, h }]) =>
      unionMap(area, w, h, memories, latest.filter((l) => l.o.area.name === area).map((l) => ({ mark: l.o.hero === "Sieg" ? "S" : "C", x: l.o.self.x, y: l.o.self.y }))),
    );
    const onScreen = new Set(latest.flatMap((l) => l.o.visible.map((v) => `${l.o.area.name}|${v.kind}|${v.name}`)));
    const seenEarlier = [...this.sightings.values()]
      .filter((s) => !onScreen.has(`${s.area}|${s.kind}|${s.name}`))
      .sort((a, b) => b.tick - a.tick)
      .slice(0, CENTRAL.sightingsKept)
      .map((s) => ({ kind: s.kind, name: s.name, area: s.area, x: s.x, y: s.y, ...(s.details ? { details: s.details } : {}), seen_by: s.seenBy, seen_at_tick: s.tick }));
    const msg = {
      why_you_are_asked: Object.fromEntries(PIDS.map((p) => [p, reasons[p] ?? []])),
      plan_memory: {
        plan: this.memory.plan,
        subgoals_done: this.memory.subgoalsDone,
        known_obstacles: this.memory.knownObstacles,
        recent_events: this.events.map((e) => ({ tick: e.tick, hero: e.hero, event: e.text })),
      },
      ...(this.notices.length ? { notices: this.notices } : {}),
      shared: {
        backpack: freshest?.inventory.items ?? [],
        journal: freshest?.journal ?? null,
        maps,
        seen_earlier: seenEarlier,
      },
      heroes: Object.fromEntries(PIDS.map((p) => [p, this.controllers[p].plannerView()])),
    };
    this.notices = [];
    return JSON.stringify(msg);
  }
}

// ── One hero's controller ─────────────────────────────────────────────────

/**
 * A hero's legal controller under the central planner. It reuses the
 * model-navigator's controller (walking, wait, fight, catch, events) and
 * asks the shared planner instead of its own model. Never sends messages.
 */
export class CentralizedController extends NavigatorPlayer {
  override readonly name: string = "";
  override readonly promptHash: string = "";
  readonly pid: PlayerId;
  /** Actions from the latest order, run before its intention. */
  private queued: GameAction[] = [];
  /** An order arrived from a plan this hero did not ask for and has not started yet. */
  private fresh = false;
  /** The current wait is the planner's default hold, not a chosen wait_until. */
  private holding = false;
  private hpAtPlan = Infinity;
  private pausedSince?: number;
  private input?: Parameters<Policy["decide"]>[0];

  constructor(hero: "Sieg" | "Coco", readonly planner: CentralPlanner, name: string, manual: string) {
    const pid: PlayerId = hero === "Sieg" ? "sieg" : "coco";
    super(hero, manual, planner.gateways[pid], planner.maxBatch, planner.briefing, planner.tutorial, planner.task);
    this.pid = pid;
    this.name = name;
    this.promptHash = planner.promptHash;
  }

  override systemText() {
    return this.planner.system;
  }
  override navState() {
    return { ...super.navState(), holding: this.holding, queued: [...this.queued], fresh: this.fresh };
  }
  /** This hero's latest decision input, for the planner. */
  latest() {
    return this.input ? { o: this.input.observation, legal: this.input.legal } : undefined;
  }
  takePending() {
    const p = [...new Set(this.pending)];
    this.pending = [];
    return p;
  }
  peekPending() {
    return [...this.pending];
  }
  restorePending(reasons: string[]) {
    this.pending.push(...reasons);
  }
  takeFresh() {
    const f = this.fresh;
    this.fresh = false;
    return f;
  }

  /** A plan was made with this hero's state in it: restart the bounded counters. */
  planned() {
    const o = this.input?.observation;
    if (!o) return;
    this.hpAtPlan = o.self.hp;
    this.pausedSince = undefined;
    this.controllerMoves = 0;
    this.walkedTicks = 0;
    this.walkedFrom = { x: o.self.x, y: o.self.y, tick: o.tick };
    // An ended goal was reported in this plan; clear it.
    if (this.goal && (this.status === "arrived" || this.status === "unreachable")) this.setGoal(null, o);
  }

  /** Replace this hero's intention with the planner's order. */
  applyOrder(order: Order, o: Observation) {
    this.queued = [...order.actions];
    this.holding = false;
    if (order.goTo) {
      this.setGoal(order.goTo, o);
      this.intent = null;
    } else if (order.waitUntil) {
      this.setGoal(null, o);
      this.intent = { kind: "wait", untilTick: o.tick + Math.round(order.waitUntil.seconds * 60), startTick: o.tick, ...(order.waitUntil.watch ? { watch: { name: order.waitUntil.watch } } : {}) };
    } else if (order.fight) {
      this.setGoal(null, o);
      this.intent = { kind: "fight", target: order.fight.target, untilTick: o.tick + Math.round(order.fight.seconds * 60), startHp: o.self.hp, maxHp: o.self.maxHp, startTick: o.tick };
    } else if (order.catch) {
      this.setGoal(null, o);
      // Seed the chase from the other hero's screen or an earlier sighting when this hero cannot see it.
      const own = o.visible.some((v) => v.name.toLowerCase() === order.catch!.target.toLowerCase() && v.kind !== "partner");
      const last = own ? undefined : this.planner.lastKnown(order.catch.target, o.area.name, this.pid);
      this.intent = { kind: "catch", target: order.catch.target, untilTick: o.tick + Math.round(order.catch.seconds * 60), startTick: o.tick, presses: 0, ...(last ? { last } : {}) };
    } else if (order.hold) {
      this.setGoal(null, o);
      this.intent = null;
    }
    this.fresh = true;
  }

  /** A hero with no actions, goal or intention holds. */
  ensureIntention(o: Observation) {
    if (this.queued.length || this.intent || (this.goal && this.status === "walking")) return;
    if (this.goal) this.setGoal(null, o);
    this.intent = { kind: "wait", untilTick: o.tick + CENTRAL.holdSeconds * 60, startTick: o.tick };
    this.holding = true;
  }

  /** The first action of this hero's current order: its actions, then its intention. Null when nothing can start (the reason is pending). */
  startAssignment(input: Parameters<Policy["decide"]>[0], meta: Record<string, unknown>): Decision | null {
    const o = input.observation;
    const note = () => ({ ...meta, ...this.noteState() });
    if (this.queued.length) {
      const [action, ...then] = this.queued;
      this.queued = [];
      this.counts.modelDecisions++;
      return { action, ...(then.length ? { then } : {}), note: note() };
    }
    if (this.intent) {
      const step = this.intentStep(o, input.legal);
      if (step.action) {
        this.counts.controllerDecisions++;
        return { action: step.action, note: note() };
      }
      this.pending.push(this.endedText(step.ended!));
      this.intent = null;
      this.holding = false;
      return null;
    }
    if (this.goal) {
      const paused = this.pauseIfCannotMove(o, input.legal);
      if (paused?.action) return { action: paused.action, note: { ...note(), detail: "move is not available now; the goal is kept" } };
      if (paused?.ask) {
        this.pending.push(paused.ask);
        return null;
      }
      const step = this.plan(o);
      if (step.move) {
        this.controllerMoves++;
        this.counts.controllerDecisions++;
        this.lastControllerMove = { direction: step.move.direction };
        return { action: { type: "move", direction: step.move.direction, ticks: step.move.ticks }, note: { ...note(), pathCells: step.pathCells, unknownCells: step.unknownCells } };
      }
      this.pending.push((this.status as NavStatus) === "arrived" ? "you reached your walking goal" : `the walking helper cannot reach your goal: ${this.detail}`);
      this.setGoal(null, o);
      return null;
    }
    this.pending.push("this hero has no intention");
    return null;
  }

  /**
   * The game does not offer move right now (for example during a scene): the
   * controller submits no move it knows is not legal. It waits a moment with
   * an ordinary wait and keeps the goal. The pause is bounded: after
   * CENTRAL.pauseTicks the planner is asked (for example, a dialogue line is
   * waiting for a press nobody was ordered to make).
   */
  private pauseIfCannotMove(o: Observation, legal: ActionSpec[]): { action?: GameAction; ask?: string } | null {
    if (legal.some((l) => l.type === "move")) {
      this.pausedSince = undefined;
      return null;
    }
    if (!legal.some((l) => l.type === "wait")) return null;
    this.pausedSince ??= o.tick;
    if (o.tick - this.pausedSince >= CENTRAL.pauseTicks) {
      this.pausedSince = o.tick;
      return { ask: `this hero cannot walk: move has not been available for  s (for example while a dialogue line or scene waits); the goal is kept` };
    }
    this.counts.controllerDecisions++;
    return { action: { type: "wait", ticks: 15 } };
  }

  private endedText(ended: string) {
    return this.holding && /^your wait_until time ran out/.test(ended) ? `this hero's hold ran out (${CENTRAL.holdSeconds} s with nothing new)` : ended;
  }

  private noteState() {
    return {
      goal: this.goal ? { ...this.goal } : null,
      status: this.status,
      ...(this.intent ? { intent: this.holding ? { kind: "hold", until_tick: this.intent.untilTick } : describeIntent(this.intent) } : {}),
    };
  }

  /** Keep only significant damage; partner-message events cannot occur in this mode. */
  private significant(events: string[], o: Observation, prevHp: number | undefined): string[] {
    return events.filter((e) => {
      if (/^new message from /.test(e)) return false;
      if (/^you took damage/.test(e)) {
        const lost = this.hpAtPlan - o.self.hp;
        const low = o.self.hp <= CENTRAL.lowHpShare * o.self.maxHp && (prevHp ?? Infinity) > CENTRAL.lowHpShare * o.self.maxHp;
        return lost >= CENTRAL.damageShare * o.self.maxHp || low;
      }
      return true;
    });
  }

  /** The hero's own state as the planner sees it. */
  plannerView() {
    const input = this.input;
    if (!input) return null;
    const o = input.observation;
    const mem = this.heroMemory.view(o);
    const intention = this.goal
      ? { kind: "go_to", x: this.goal.x, y: this.goal.y, area: this.goal.area, status: this.status, ...(this.detail ? { detail: this.detail } : {}) }
      : this.intent
        ? this.holding
          ? { kind: "hold", until_tick: this.intent.untilTick }
          : describeIntent(this.intent)
        : null;
    const blackHole = input.legal.some((l) => l.type === "ability" && l.params?.ability?.kind === "enum" && l.params.ability.values.includes("black_hole"));
    return {
      observed_at_tick: o.tick,
      area: o.area.name,
      self: o.self,
      abilities: o.abilities,
      intention,
      ...(this.queued.length ? { queued_actions: this.queued } : {}),
      walked: this.walkedFrom ? { moves: this.controllerMoves, ticks: this.walkedTicks, from: { x: this.walkedFrom.x, y: this.walkedFrom.y }, since_tick: this.walkedFrom.tick } : null,
      last_turn: describeTurn(input),
      completed_actions: this.completed.slice(-CENTRAL.completedShown),
      recent_rejected_actions: this.rejected.slice(-CENTRAL.rejectedShown),
      screen: o.screen,
      visible: o.visible,
      dialogue: o.dialogue,
      dialogue_log: o.dialogueLog.slice(-CENTRAL.dialogueShown),
      feedback: o.feedback.slice(-CENTRAL.feedbackShown),
      backpack_panel_target: o.inventory.nearbyTarget ?? null,
      recent_blocked_moves: mem.recent_blocked_moves,
      repeated_without_new_result: mem.repeated_without_new_result,
      verified_events: mem.verified_events.filter((e) => e.superseded_by === undefined).slice(-CENTRAL.verifiedShown),
      legal_actions: input.legal.filter((l) => l.type !== "message"),
      ...(blackHole ? { navigation: { aim_preview: aimPreview(this.heroMemory, o) } } : {}),
    };
  }

  override async decide(input: Parameters<Policy["decide"]>[0]): Promise<Decision> {
    const o = input.observation;
    // The navigator's own bookkeeping, unchanged: memory, results, the last walking move.
    if (input.batch) this.remember(input.batch);
    if (input.batch) this.heroMemory.recordTurn(input.batch, this.lastObservation);
    this.heroMemory.observe(o);
    this.afterControllerMove(input.batch, o);
    this.lastObservation = o;
    this.input = input;
    this.planner.observe(this.hero, o);
    const prevHp = this.snap?.hp;
    const events = detectEvents(this.snap, o, input.legal, this.seen, this.partnerTexts);
    for (const v of o.visible) if (SIGHT_KINDS.has(v.kind)) this.seen.add(`${o.area.name}|${v.kind}|${v.name}`);
    this.snap = snapshot(o, input.legal);
    if (o.self.hp > this.hpAtPlan) this.hpAtPlan = o.self.hp;
    if (input.batch?.replyProblem) events.push("the last planner reply could not be used");
    if (input.batch?.steps.some((s) => s.status !== "executed")) events.push("an action of this hero was refused");
    let reasons = this.significant(this.filterEvents(events, o), o, prevHp);
    if (this.intent?.kind === "catch" && this.intent.presses > 0 && events.includes("your backpack changed")) {
      reasons.push("your catch ended: after your E press your backpack changed");
      this.intent = null;
    }

    // An order made while this hero was busy: start it, unless something urgent happened since.
    if (this.takeFresh()) {
      const urgent = reasons.filter((r) => URGENT.test(r));
      this.planner.log(this.hero, reasons.filter((r) => !URGENT.test(r)), o.tick);
      reasons = urgent;
      if (!urgent.length) {
        const d = this.startAssignment(input, { source: "assigned" });
        if (d) return d;
      }
    }
    this.pending.push(...reasons);

    // Carry on with the current intention while nothing happened.
    if (this.intent && !this.pending.length) {
      const step = this.intentStep(o, input.legal);
      if (step.action) {
        this.counts.controllerDecisions++;
        return { action: step.action, note: { source: "controller", events: [], ...this.noteState() } };
      }
      this.pending.push(this.endedText(step.ended!));
      this.intent = null;
      this.holding = false;
    }
    if (this.goal && this.status === "walking" && !this.pending.length) {
      if (this.controllerMoves >= CENTRAL.walkCheckInMoves) this.pending.push(`${CENTRAL.walkCheckInMoves} walking moves since the last plan`);
      else {
        const paused = this.pauseIfCannotMove(o, input.legal);
        if (paused?.action) return { action: paused.action, note: { source: "controller", events: [], ...this.noteState(), detail: "move is not available now; the goal is kept" } };
        if (paused?.ask) this.pending.push(paused.ask);
        else {
          const step = this.plan(o);
          if (step.move) {
            this.controllerMoves++;
            this.counts.controllerDecisions++;
            this.lastControllerMove = { direction: step.move.direction };
            return {
              action: { type: "move", direction: step.move.direction, ticks: step.move.ticks },
              note: { source: "controller", events: [], ...this.noteState(), pathCells: step.pathCells, unknownCells: step.unknownCells, controllerMoves: this.controllerMoves },
            };
          }
          this.pending.push((this.status as NavStatus) === "arrived" ? "you reached your walking goal" : `the walking helper cannot reach your goal: ${this.detail}`);
        }
      }
    }
    if (this.goal && this.status === "walking" && this.atGoal(o)) {
      this.status = "arrived";
      this.detail = `you reached (${this.goal.x}, ${this.goal.y})`;
      this.pending.push("you reached your walking goal");
    }
    if (!this.goal && !this.intent && !this.pending.length) this.pending.push("this hero has no intention");
    if (this.pending.length) this.queued = [];
    return this.planner.request(this, input);
  }
}

/** Both heroes' policies for one episode, sharing one planner. */
export function centralizedPolicies(manual: string, gateways: Record<PlayerId, MeteredGateway>, maxBatch?: number, briefing?: string, tutorial?: string, task?: string): Record<PlayerId, Policy> {
  const planner = new CentralPlanner(manual, gateways, maxBatch, briefing, tutorial, task);
  return { sieg: planner.controllers.sieg, coco: planner.controllers.coco };
}

/** For tests. */
export const _central = { URGENT };
