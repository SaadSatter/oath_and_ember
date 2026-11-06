// Opt-in fast model player, "model-navigator" (docs/midterm/MODEL_NAVIGATOR.md).
//
// One instance per hero, each with its own model calls, notes, HeroMemory and
// walking controller; nothing is shared with the partner except in-game
// messages. It is the model-memory player plus a walking helper:
//
//   - The model may answer with a walking goal, "go_to": {x, y}, as well as
//     (or instead of) ordinary actions.
//   - A deterministic local controller then walks the hero there with
//     ordinary `move` actions, one per decision, planning a path (A*) over
//     this hero's own remembered map (HeroMemory, built only from its own
//     screens and move results) and its current screen. It never reads World,
//     GameRoom, map geometry, puzzle state, a route or the partner's anything;
//     this module imports only types, the hero's own memory and the prompt
//     helpers.
//   - The model is asked again only on an event (dialogue, damage, a new
//     thing on screen, an enemy coming close, a new action becoming
//     available, a new partner message, a backpack/journal change, a new
//     feedback line, arrival, an unreachable goal, or a bounded number of
//     walking moves). The goal survives a model call unless the model
//     changes or clears it.
//
// The controller only walks. It never attacks, presses E, uses an ability,
// talks or sends a message, and it never changes or vetoes a model action,
// with one disclosed exception: a message identical to one this hero sent in
// the last DUP_MESSAGE_TICKS is not sent, and the model is told so next turn.

import { createHash } from "node:crypto";
import type { ActionSpec, Direction, GameAction, MovementReport, Observation, VisibleThing } from "../types.js";
import type { MeteredGateway } from "../budget.js";
import { MAX_BATCH } from "../batch.js";
import { HeroMemory, isRoutineFeedback } from "../heroMemory.js";
import { tutorialBlock, tutorialId, taskId } from "../playerKnowledge.js";
import { briefingBlock, briefingId, COMPLETED_LOG, describeTurn, parseReply, REJECTED_LOG, replySchema, systemPrompt, TASK, type ParsedReply } from "./llm.js";
import type { Decision, Policy, TurnReport } from "./policy.js";
import { directionTo, WALK_TILES_PER_TICK } from "./navigate.js";
import { planFightTarget } from "./combat.js";

/** Controller bounds. Changing any of them changes the player (its name carries NAV_ID). */
export const NAV = Object.freeze({
  /** Walking moves in a row before the model is asked again, even if nothing happened. */
  maxControllerMoves: 12,
  /** Path replans after a stuck move before the goal is declared unreachable. */
  maxReplans: 6,
  /** Moves in a row without getting closer (path cost) before the goal is declared unreachable. */
  noProgressMoves: 6,
  /** Arrival distance (tiles) to a goal point on open ground. */
  arriveTiles: 0.45,
  /** Enemies within this many tiles count as close. */
  enemyNearTiles: 2.5,
  /** Path cost of a tile the hero's screen never showed (it may be open). */
  unknownCost: 3,
  /** Extra cost of a tile next to a blocked tile (keeps the body off edges). */
  edgeCost: 0.6,
  /** Extra cost of a tile where a creature, enemy or the partner stands now. */
  occupiedCost: 12,
  /** Extra cost of a tile a move of this hero was stopped short by, and for how long (ticks). */
  stuckCost: 10,
  stuckTtl: 1200,
  /** A perpendicular offset from the tile centre beyond which the controller first lines up. */
  alignTiles: 0.3,
  /** Longest straight run of path cells one move covers. */
  maxRunCells: 10,
  /** A message identical to one sent within this many ticks is not sent again. */
  dupMessageTicks: 600,
  /** Longest wait_until and fight intentions (game seconds). */
  maxWaitSeconds: 30,
  maxFightSeconds: 15,
  /** One wait chunk (ticks): how often a waiting hero looks again. */
  waitChunkTicks: 30,
  /** A watched thing counts as moved when it is this many tiles from where it was. */
  watchMoveTiles: 0.5,
  /** A fight ends when the hero has lost this share of its maximum HP since it began. */
  fightHpLoss: 0.25,
  /** "X moved" feedback lines for the same thing within this many ticks are one movement. */
  motionQuietTicks: 60,
  /** Longest catch intention (game seconds). */
  maxCatchSeconds: 30,
  /** E is pressed when the chased thing is this close (tiles) and the backpack panel shows a nearby target. */
  catchReachTiles: 2.5,
  /** Longest single move while chasing (ticks), so the chase re-aims often. */
  catchMoveTicks: 8,
  /** Lost from sight: the chase ends once the hero is this close (tiles) to where it was last seen. */
  catchLostTiles: 1,
});
export const NAV_ID = createHash("sha256").update(JSON.stringify(NAV)).digest("hex").slice(0, 8);

// The game constants SPRINT_MULTIPLIER and SLOW_TIME_SCALE, copied so this module imports no engine code.
const SPRINT_MULTIPLIER = 2;
const SLOW_SCALE = 0.2;

/** The navigator's explanation of its reply fields. No game content, route, coordinates or puzzle step. */
export const NAVIGATOR_SECTION = `

Walking helper (the "go_to" field):
- Besides "actions", your reply may set a walking goal: "go_to": {"x": <tile x>, "y": <tile y>} in this area's tile coordinates. A walking helper then walks you there with ordinary moves, choosing a path over your own remembered map (memory.remembered_map) and your current screen. Tiles your screen never showed are treated as possibly open, so the path may change as you see more. The helper knows nothing else: no map you have not seen, no puzzle, no route, nothing your partner saw.
- The goal stays until you arrive, the helper cannot get there, you send a new "go_to", or you send "stop_navigation": true. Any "actions" you send run first; the helper walks after them.
- While it walks you are not asked again unless something happens: dialogue on your screen, damage, an enemy coming close, something you had not seen before coming on screen, a new kind of action becoming available (for example E next to an object), a new message from your partner, a change to your backpack or journal, a new game feedback line, arrival, the helper being unable to get there, or ${NAV.maxControllerMoves} walking moves in a row. navigation.why_you_are_asked lists the reasons; navigation.walked says how far the helper took you since your last reply.
- When you are asked, your current goal is kept unless you change it. Answering a message does not cancel it: send "go_to" or "stop_navigation" only when you want a different goal or none.
- "actions" may be empty when you only set or keep a goal, for example {"notes":"...","go_to":{"x":<x>,"y":<y>},"actions":[]}. With no goal and no actions nothing happens, so send at least one of them.
- The helper only walks. It never attacks, guards, presses E, uses abilities, uses items, advances dialogue or sends messages: you choose all of those.
- Use go_to for walking more than a couple of tiles. Use your own move actions for short, precise steps (lining up with something, dodging, stepping through a narrow gap).

Waiting ("wait_until") and fighting ("fight"):
- "wait_until": {"seconds": <1-${NAV.maxWaitSeconds}>, "watch": "<name of something on your screen>"} waits with ordinary wait actions until something happens or the seconds run out, without asking you again in between. You are asked again when anything listed above happens (a partner message with new text, damage, dialogue, a backpack or journal change, something new, an enemy close, a new feedback line), when the thing you watch moves or leaves your screen, or when the time is up. "watch" is optional.
- "fight": {"target": "<enemy name on your screen>", "seconds": <1-${NAV.maxFightSeconds}>} attacks that enemy with ordinary moves and J presses (closing in or lining up as your hero needs) until it is gone from your screen, you have lost a quarter of your maximum HP since the fight began, something else happens, or the seconds run out. Hits you take below that share do not interrupt it.
- "fight" only attacks things listed as enemies. It never attacks a creature or an object; naming one ends the fight at once.

Catching ("catch"):
- "catch": {"target": "<name of something on your screen>", "seconds": <1-${NAV.maxCatchSeconds}>} chases that thing with ordinary moves, re-aiming at it each time it is on your screen and heading for where you last saw it when it is not. When it is close to you and your backpack panel shows a nearby target, it presses E (an ordinary interact; the game decides what happens). You are asked again when anything listed above happens, apart from news about the thing you are chasing itself; the catch carries on after your reply unless you send another intention or "stop_navigation": true. It ends when an E press changes your backpack, when you reach the place you last saw the thing without seeing it again, when no path leads there on your map, or when the seconds run out. It never attacks, uses abilities or items, or sends messages.
- go_to, wait_until, fight and catch are alternatives: sending one replaces the others. Your "actions" run first.

Aiming the Black Hole (navigation.aim_preview, listed while the ability is available):
- For each of the eight directions it shows where the spell would stop by the rules in the manual (it flies up to 6 tiles and stops at the first blocked tile, enemy or creature body on your map), and which things your screen shows within 3 tiles of that point, with the direction each would be pulled. It is worked out from your own map and screen, to within about half a tile; tiles you never saw count as open. Whether and where to use it is your choice.

Abilities and messages:
- Use an ability when you can say, from what your screen shows now, what it should act on. Abilities that recharge are wasted when nothing they act on is near you. If memory.repeated_without_new_result lists an ability there, do not use it again until something has changed.
- Message your partner when something happened that they need to know or when you need them to act, in one short message. A message identical to one you sent in the last ${NAV.dupMessageTicks / 60} seconds of game time is not sent again; navigation.notices tells you when that happens.`;

/** The reply schema: the model-memory schema plus the two walking fields. */
export function navigatorSchema(maxBatch: number = MAX_BATCH): Record<string, unknown> {
  const base = replySchema(maxBatch, "persistent") as { properties: Record<string, unknown> };
  return {
    ...base,
    properties: {
      ...base.properties,
      go_to: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"], additionalProperties: false },
      stop_navigation: { type: "boolean" },
      wait_until: { type: "object", properties: { seconds: { type: "number" }, watch: { type: "string" } }, required: ["seconds"], additionalProperties: false },
      fight: { type: "object", properties: { target: { type: "string" }, seconds: { type: "number" } }, required: ["target", "seconds"], additionalProperties: false },
      catch: { type: "object", properties: { target: { type: "string" }, seconds: { type: "number" } }, required: ["target", "seconds"], additionalProperties: false },
    },
  };
}

export type NavReply =
  | { ok: true; notes?: string; actions: GameAction[]; dropped: GameAction[]; recovered?: string; goTo?: { x: number; y: number }; stop: boolean; waitUntil?: { seconds: number; watch?: string }; fight?: { target: string; seconds: number }; catch?: { target: string; seconds: number } }
  | { ok: false; reason: string };

/**
 * Reads a navigator reply: the ordinary envelope (parseReply, unchanged) with
 * two optional extra fields. A null field counts as absent (OpenAI strict
 * schemas send unused optional fields as null). Never repairs an action.
 */
export function parseNavigatorReply(text: string, maxBatch: number = MAX_BATCH): NavReply {
  let obj: Record<string, unknown> | undefined;
  try {
    const v: unknown = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) obj = v as Record<string, unknown>;
  } catch {
    // Not one clean JSON object: read it as an ordinary reply (no goal).
  }
  if (!obj) {
    const p = parseReply(text, maxBatch);
    return p.ok ? { ...p, stop: false } : p;
  }
  const { go_to: goRaw, stop_navigation: stopRaw, wait_until: waitRaw, fight: fightRaw, catch: catchRaw, ...rest } = obj;
  let waitUntil: { seconds: number; watch?: string } | undefined;
  if (waitRaw !== undefined && waitRaw !== null) {
    const w = waitRaw as Record<string, unknown>;
    if (typeof w !== "object" || typeof w.seconds !== "number" || !(w.seconds > 0) || (w.watch !== undefined && w.watch !== null && typeof w.watch !== "string") || Object.keys(w).some((k) => k !== "seconds" && k !== "watch"))
      return { ok: false, reason: '"wait_until" must be {"seconds": number, "watch"?: text}.' };
    waitUntil = { seconds: Math.min(NAV.maxWaitSeconds, w.seconds), ...(typeof w.watch === "string" && w.watch.trim() ? { watch: w.watch.trim() } : {}) };
  }
  let fight: { target: string; seconds: number } | undefined;
  if (fightRaw !== undefined && fightRaw !== null) {
    const f = fightRaw as Record<string, unknown>;
    if (typeof f !== "object" || typeof f.target !== "string" || !f.target.trim() || typeof f.seconds !== "number" || !(f.seconds > 0) || Object.keys(f).some((k) => k !== "target" && k !== "seconds"))
      return { ok: false, reason: '"fight" must be {"target": enemy name, "seconds": number}.' };
    fight = { target: f.target.trim(), seconds: Math.min(NAV.maxFightSeconds, f.seconds) };
  }
  let chase: { target: string; seconds: number } | undefined;
  if (catchRaw !== undefined && catchRaw !== null) {
    const c = catchRaw as Record<string, unknown>;
    if (typeof c !== "object" || typeof c.target !== "string" || !c.target.trim() || typeof c.seconds !== "number" || !(c.seconds > 0) || Object.keys(c).some((k) => k !== "target" && k !== "seconds"))
      return { ok: false, reason: '"catch" must be {"target": name on your screen, "seconds": number}.' };
    chase = { target: c.target.trim(), seconds: Math.min(NAV.maxCatchSeconds, c.seconds) };
  }
  let goTo: { x: number; y: number } | undefined;
  if (goRaw !== undefined && goRaw !== null) {
    const g = goRaw as Record<string, unknown>;
    if (typeof g !== "object" || typeof g.x !== "number" || typeof g.y !== "number" || !Number.isFinite(g.x) || !Number.isFinite(g.y) || Object.keys(g).some((k) => k !== "x" && k !== "y"))
      return { ok: false, reason: '"go_to" must be {"x": number, "y": number}.' };
    goTo = { x: g.x, y: g.y };
  }
  if (stopRaw !== undefined && stopRaw !== null && typeof stopRaw !== "boolean") return { ok: false, reason: '"stop_navigation" must be true or false.' };
  const stop = stopRaw === true;
  if (goTo && stop) return { ok: false, reason: 'The reply had both "go_to" and "stop_navigation": true.' };
  if ([goTo, waitUntil, fight, chase].filter(Boolean).length > 1) return { ok: false, reason: 'Send only one of "go_to", "wait_until", "fight" and "catch".' };
  const extra = { ...(goTo ? { goTo } : {}), ...(waitUntil ? { waitUntil } : {}), ...(fight ? { fight } : {}), ...(chase ? { catch: chase } : {}) };
  const list = rest.actions ?? (rest.action !== undefined ? [rest.action] : undefined);
  if (Array.isArray(list) && list.length === 0 && !("action" in rest)) {
    const unknown = Object.keys(rest).find((k) => !["notes", "actions"].includes(k));
    if (unknown) return { ok: false, reason: `The reply had an unexpected field "${unknown}".` };
    if (rest.notes !== undefined && rest.notes !== null && typeof rest.notes !== "string") return { ok: false, reason: '"notes" must be text.' };
    if (!goTo && !stop && !waitUntil && !fight && !chase) return { ok: false, reason: 'The reply had no actions and no "go_to", "wait_until", "fight" or "catch".' };
    return { ok: true, ...(typeof rest.notes === "string" ? { notes: rest.notes } : {}), actions: [], dropped: [], ...extra, stop };
  }
  if (rest.notes === null) delete rest.notes;
  const p: ParsedReply = parseReply(JSON.stringify(rest), maxBatch);
  return p.ok ? { ...p, ...extra, stop } : p;
}

// ── Path planning over the hero's own map ─────────────────────────────────

export interface Cell {
  x: number;
  y: number;
}

/** A cost map: finite cost to enter a cell, Infinity when blocked. */
export interface NavGrid {
  w: number;
  h: number;
  cost(x: number, y: number): number;
  unknown(x: number, y: number): boolean;
}

const BLOCKING = new Set(["#", "^", "o", ">"]);
const key = (x: number, y: number) => `${x},${y}`;

/** Cells whose centre lies in a visible thing's extent. */
function extentCells(v: VisibleThing): Cell[] {
  const e = v.extent!;
  const out: Cell[] = [];
  for (let y = Math.floor(e.y); y < Math.ceil(e.y + e.h); y++) for (let x = Math.floor(e.x); x < Math.ceil(e.x + e.w); x++) out.push({ x, y });
  return out;
}

/**
 * The grid this hero navigates: its remembered terrain (already updated with
 * the current screen), the things its current screen shows, and the cells its
 * own moves were stopped short by. `goal` may stand on a blocking cell (an
 * object, an exit): it is then left blocked and approached from beside.
 */
export function buildGrid(memory: HeroMemory, o: Observation, stuck: ReadonlyMap<string, number>): NavGrid {
  const { name, widthTiles: w, heightTiles: h } = o.area;
  const flying = o.self.status.some((s) => s.startsWith("flying"));
  const terrain = (x: number, y: number) => memory.terrainAt(name, x, y) ?? "?";
  const hard = new Set<string>();
  const occupied = new Set<string>();
  for (const v of o.visible) {
    if (v.kind === "creature" && v.extent) for (const c of extentCells(v)) hard.add(key(c.x, c.y));
    else if (v.kind === "creature" || v.kind === "enemy" || v.kind === "partner") occupied.add(key(Math.floor(v.x), Math.floor(v.y)));
  }
  const blockedChar = (t: string) => BLOCKING.has(t) || (t === "~" && !flying);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  return {
    w,
    h,
    unknown: (x, y) => inside(x, y) && terrain(x, y) === "?",
    cost(x, y) {
      if (!inside(x, y)) return Infinity;
      const k = key(x, y);
      if (hard.has(k)) return Infinity;
      const t = terrain(x, y);
      if (blockedChar(t)) return Infinity;
      let c = t === "?" ? NAV.unknownCost : 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (inside(x + dx, y + dy) && terrain(x + dx, y + dy) === "#") {
          c += NAV.edgeCost;
          break;
        }
      if (occupied.has(k)) c += NAV.occupiedCost;
      if (stuck.has(k)) c += NAV.stuckCost;
      return c;
    },
  };
}

const STEPS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * A* from `start` to any cell in `goals` (8-way, no corner cutting). Returns
 * the cells after `start` up to and including the goal cell reached, with the
 * path's total cost, or null when no goal can be reached on this grid.
 */
export function aStar(grid: NavGrid, start: Cell, goals: Cell[]): { path: Cell[]; cost: number } | null {
  const goalSet = new Set(goals.map((g) => key(g.x, g.y)));
  if (!goalSet.size) return null;
  if (goalSet.has(key(start.x, start.y))) return { path: [], cost: 0 };
  const hFn = (x: number, y: number) => {
    let best = Infinity;
    for (const g of goals) {
      const dx = Math.abs(g.x - x), dy = Math.abs(g.y - y);
      best = Math.min(best, Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy));
    }
    return best;
  };
  const gScore = new Map<string, number>([[key(start.x, start.y), 0]]);
  const prev = new Map<string, string>();
  // Small binary heap of [f, tiebreak, x, y].
  const heap: [number, number, number, number][] = [];
  let order = 0;
  const push = (f: number, x: number, y: number) => {
    heap.push([f, order++, x, y]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] < heap[i][0] || (heap[p][0] === heap[i][0] && heap[p][1] < heap[i][1])) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        const less = (a: number, b: number) => heap[a][0] < heap[b][0] || (heap[a][0] === heap[b][0] && heap[a][1] < heap[b][1]);
        if (l < heap.length && less(l, m)) m = l;
        if (r < heap.length && less(r, m)) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  push(hFn(start.x, start.y), start.x, start.y);
  const closed = new Set<string>();
  const limit = grid.w * grid.h * 4;
  let expanded = 0;
  while (heap.length && expanded++ < limit) {
    const [, , x, y] = pop();
    const k = key(x, y);
    if (closed.has(k)) continue;
    closed.add(k);
    if (goalSet.has(k)) {
      const path: Cell[] = [];
      for (let c: string | undefined = k; c && c !== key(start.x, start.y); c = prev.get(c)) {
        const [cx, cy] = c.split(",").map(Number);
        path.unshift({ x: cx, y: cy });
      }
      return { path, cost: gScore.get(k)! };
    }
    const g0 = gScore.get(k)!;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx, ny = y + dy;
      const c = grid.cost(nx, ny);
      if (!Number.isFinite(c)) continue;
      if (dx && dy && (!Number.isFinite(grid.cost(x + dx, y)) || !Number.isFinite(grid.cost(x, y + dy)))) continue;
      const g = g0 + c * (dx && dy ? Math.SQRT2 : 1);
      const nk = key(nx, ny);
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g);
        prev.set(nk, k);
        push(g + hFn(nx, ny), nx, ny);
      }
    }
  }
  return null;
}

/** Where the goal is approached: its own cell when open, otherwise the open cells around it. */
export function goalCells(grid: NavGrid, goal: { x: number; y: number }): { cells: Cell[]; onCell: boolean } {
  const gx = Math.floor(goal.x), gy = Math.floor(goal.y);
  if (Number.isFinite(grid.cost(gx, gy))) return { cells: [{ x: gx, y: gy }], onCell: true };
  const around = STEPS.map(([dx, dy]) => ({ x: gx + dx, y: gy + dy })).filter((c) => Number.isFinite(grid.cost(c.x, c.y)));
  return { cells: around, onCell: false };
}

/** The point a goal means: an integer tile coordinate means that tile's centre. */
export function goalPoint(g: { x: number; y: number }) {
  return { x: Number.isInteger(g.x) ? g.x + 0.5 : g.x, y: Number.isInteger(g.y) ? g.y + 0.5 : g.y };
}

const VEC: Record<Direction, [number, number]> = { n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1] };

/**
 * The next move along `path` from the hero's exact position: first line up
 * with the row or column when far off-centre, then walk the longest straight
 * run of cells in one direction (at most NAV.maxRunCells), never past the
 * goal point. `speed` is tiles per tick.
 */
export function nextMove(me: { x: number; y: number }, path: Cell[], target: { x: number; y: number }, onGoalCell: boolean, speed: number): { direction: Direction; ticks: number } {
  const clampTicks = (d: number) => Math.max(1, Math.min(60, Math.round(d / speed)));
  const sx = Math.floor(me.x), sy = Math.floor(me.y);
  if (!path.length) {
    const dx = target.x - me.x, dy = target.y - me.y;
    return { direction: directionTo(dx, dy), ticks: clampTicks(Math.hypot(dx, dy)) };
  }
  const first = path[0];
  const dir = directionTo(first.x - sx, first.y - sy);
  const [vx, vy] = VEC[dir];
  // Line up across the direction of travel when far off the cell centre.
  if (vx === 0 && Math.abs(me.x - (sx + 0.5)) > NAV.alignTiles) {
    const off = sx + 0.5 - me.x;
    return { direction: off > 0 ? "e" : "w", ticks: clampTicks(Math.abs(off)) };
  }
  if (vy === 0 && Math.abs(me.y - (sy + 0.5)) > NAV.alignTiles) {
    const off = sy + 0.5 - me.y;
    return { direction: off > 0 ? "s" : "n", ticks: clampTicks(Math.abs(off)) };
  }
  let end = 0;
  while (end + 1 < path.length && end + 1 < NAV.maxRunCells && path[end + 1].x - path[end].x === vx && path[end + 1].y - path[end].y === vy) end++;
  const last = path[end];
  const isGoal = end === path.length - 1 && onGoalCell;
  const aim = isGoal ? target : { x: last.x + 0.5, y: last.y + 0.5 };
  if (vx && vy) {
    // Diagonal: walk until the nearer axis reaches the aim (each axis moves speed/√2 per tick).
    const d = Math.min(Math.abs(aim.x - me.x), Math.abs(aim.y - me.y)) * Math.SQRT2;
    return { direction: dir, ticks: clampTicks(Math.max(d, 0.1)) };
  }
  const along = vx ? Math.abs(aim.x - me.x) : Math.abs(aim.y - me.y);
  return { direction: dir, ticks: clampTicks(Math.max(along, 0.1)) };
}

// ── Events ────────────────────────────────────────────────────────────────

interface Snapshot {
  area: string;
  hp: number;
  bag: string;
  journal: string;
  feedback: string[];
  legalTypes: Set<string>;
  closeEnemies: Set<string>;
  dialogue: string | null;
}

/** A dialogue line as this hero's screen shows it: who, what, whether it is theirs to move on, and any choices. */
const dialogueKey = (o: Observation) => (o.dialogue ? JSON.stringify([o.dialogue.speaker, o.dialogue.text, o.dialogue.canAdvance, o.dialogue.choices ?? null]) : null);

const ON_DEMAND = new Set(["interact", "use_item", "advance_dialogue", "choose_dialogue"]);

function snapshot(o: Observation, legal: ActionSpec[]): Snapshot {
  return {
    area: o.area.name,
    hp: o.self.hp,
    bag: JSON.stringify(o.inventory.items.map((i) => [i.id, i.count])),
    journal: JSON.stringify(o.journal),
    feedback: [...o.feedback],
    legalTypes: new Set(legal.map((l) => l.type)),
    closeEnemies: new Set(o.visible.filter((v) => v.kind === "enemy" && v.distance <= NAV.enemyNearTiles).map((v) => v.name)),
    dialogue: dialogueKey(o),
  };
}

/** Lines in `cur` after the longest suffix of `prev` that starts `cur` (as HeroMemory does). */
function newLines(prev: string[], cur: string[]) {
  for (let k = Math.min(prev.length, cur.length); k > 0; k--) if (prev.slice(prev.length - k).every((l, i) => l === cur[i])) return cur.slice(k);
  return cur;
}

/**
 * Why the model should be asked now, compared with the hero's previous
 * decision. Pure: reads two of this hero's own observations, its legal
 * actions, the names it has seen and the messages it has had.
 */
export function detectEvents(prev: Snapshot | undefined, o: Observation, legal: ActionSpec[], seen: Set<string>, partnerTexts: Set<string>): string[] {
  const ev: string[] = [];
  // A dialogue line is news once, when it appears or changes (who may move it on, its choices).
  if (o.dialogue && dialogueKey(o) !== (prev?.dialogue ?? null)) ev.push(`dialogue on your screen (${o.dialogue.speaker})`);
  for (const v of o.visible) {
    if (!["enemy", "creature", "object", "exit", "label"].includes(v.kind)) continue;
    const k = `${o.area.name}|${v.kind}|${v.name}`;
    if (!seen.has(k)) ev.push(`new on your screen: ${v.name} (${v.kind}) at (${v.x}, ${v.y})`);
  }
  // Messages: only a text this hero had not received before is news.
  for (const m of o.messages) if (!partnerTexts.has(normalize(m.text))) ev.push(`new message from ${m.from}`);
  if (!prev) return ev;
  if (o.area.name !== prev.area) ev.push(`you are in a new area (${o.area.name})`);
  if (o.self.hp < prev.hp) ev.push(`you took damage (HP ${prev.hp} → ${o.self.hp})`);
  if (JSON.stringify(o.inventory.items.map((i) => [i.id, i.count])) !== prev.bag) ev.push("your backpack changed");
  if (JSON.stringify(o.journal) !== prev.journal) ev.push("your quest journal changed");
  const lines = newLines(prev.feedback, o.feedback).filter((l) => !isRoutineFeedback(l) && !NAV_ROUTINE.some((re) => re.test(l)));
  for (const l of lines.slice(0, 4)) ev.push(`new feedback: ${l}`);
  for (const t of legal.map((l) => l.type)) if (ON_DEMAND.has(t) && !prev.legalTypes.has(t)) ev.push(`a new action is available: ${t}`);
  for (const v of o.visible)
    if (v.kind === "enemy" && v.distance <= NAV.enemyNearTiles && !prev.closeEnemies.has(v.name)) ev.push(`${v.name} (enemy) is close: ${v.distance} tiles ${v.direction}`);
  return [...new Set(ev)];
}

/** Feedback the navigator treats as routine besides HeroMemory's list: a dialogue press that arrived after the line moved on. */
const NAV_ROUTINE: readonly RegExp[] = [/^That line had already moved on before your press arrived/];
/** The game's movement line for something on screen: "The <thing> moved <dir>, from (x, y) to (x, y)." */
export const MOTION_LINE = /^new feedback: The (.+?) moved \w+, from \(([^)]*)\) to \(([^)]*)\)\.$/;

const normalize = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");

// ── Aim preview for the Black Hole (manual: up to 6 tiles; pulls within 3) ──

export const BLACK_HOLE = Object.freeze({ rangeTiles: 6, pullTiles: 3, step: 0.05, margin: 0.19, enemyHalf: 0.625 });
const UNIT8: Record<Direction, [number, number]> = { n: [0, -1], ne: [Math.SQRT1_2, -Math.SQRT1_2], e: [1, 0], se: [Math.SQRT1_2, Math.SQRT1_2], s: [0, 1], sw: [-Math.SQRT1_2, Math.SQRT1_2], w: [-1, 0], nw: [-Math.SQRT1_2, -Math.SQRT1_2] };

export interface AimLine {
  direction: Direction;
  stops_at: { x: number; y: number };
  stopped_by: string;
  within_pull: { name: string; kind: VisibleThing["kind"]; x: number; y: number; distance: number; pulled_toward: Direction | "here"; line_blocked_on_your_map?: true }[];
}

/**
 * Where the Black Hole would stop in each direction and what lies within its
 * pull, from this hero's own map (terrain) and screen (things). Uses only the
 * manual's rules: it flies up to 6 tiles, stops on impact, and pulls within 3
 * tiles. A "#" tile is treated as fully blocked and a never-seen tile as open.
 */
export function aimPreview(memory: HeroMemory, o: Observation): AimLine[] {
  const area = o.area.name;
  const blockedAt = (x: number, y: number) => memory.terrainAt(area, Math.floor(x), Math.floor(y)) === "#";
  const bodies = o.visible.filter((v) => v.kind === "creature" && v.extent);
  const enemies = o.visible.filter((v) => v.kind === "enemy");
  const inBody = (x: number, y: number) =>
    bodies.find((b) => x > b.extent!.x - BLACK_HOLE.margin && x < b.extent!.x + b.extent!.w + BLACK_HOLE.margin && y > b.extent!.y - BLACK_HOLE.margin && y < b.extent!.y + b.extent!.h + BLACK_HOLE.margin);
  const atEnemy = (x: number, y: number) => enemies.find((e) => Math.abs(e.x - x) < BLACK_HOLE.enemyHalf + BLACK_HOLE.margin && Math.abs(e.y - y) < BLACK_HOLE.enemyHalf + BLACK_HOLE.margin);
  const lineBlocked = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.1);
    for (let k = 1; k < n; k++) if (blockedAt(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n)) return true;
    return false;
  };
  const round = (v: number) => Math.round(v * 10) / 10;
  return (Object.keys(UNIT8) as Direction[]).map((direction) => {
    const [ux, uy] = UNIT8[direction];
    let x = o.self.x, y = o.self.y, stoppedBy = "its full range";
    for (let t = BLACK_HOLE.step; t <= BLACK_HOLE.rangeTiles + 1e-9; t += BLACK_HOLE.step) {
      const nx = o.self.x + ux * t, ny = o.self.y + uy * t;
      const ahead = { x: nx + ux * BLACK_HOLE.margin, y: ny + uy * BLACK_HOLE.margin };
      if (blockedAt(ahead.x, ahead.y)) { stoppedBy = "a blocked tile"; break; }
      const body = inBody(nx, ny);
      if (body) { stoppedBy = `the body of ${body.name}`; break; }
      const enemy = atEnemy(nx, ny);
      if (enemy) { stoppedBy = `${enemy.name} (enemy)`; break; }
      x = nx;
      y = ny;
    }
    const within = o.visible
      .filter((v) => (v.kind === "enemy" || v.kind === "creature" || v.kind === "object") && Math.hypot(v.x - x, v.y - y) <= BLACK_HOLE.pullTiles)
      .map((v) => {
        const d = Math.hypot(x - v.x, y - v.y);
        return {
          name: v.name, kind: v.kind, x: v.x, y: v.y, distance: round(d),
          pulled_toward: d < 0.05 ? ("here" as const) : directionTo(x - v.x, y - v.y),
          ...(lineBlocked(x, y, v.x, v.y) ? { line_blocked_on_your_map: true as const } : {}),
        };
      });
    return { direction, stops_at: { x: round(x), y: round(y) }, stopped_by: stoppedBy, within_pull: within };
  });
}

// ── The player ────────────────────────────────────────────────────────────

interface Goal {
  area: string;
  x: number;
  y: number;
  setTick: number;
}

type NavStatus = "none" | "walking" | "arrived" | "unreachable";

/** A waiting or fighting intention the model chose (go_to is the walking one). */
type Intent =
  | { kind: "wait"; untilTick: number; watch?: { name: string; x?: number; y?: number }; startTick: number }
  | { kind: "fight"; target: string; untilTick: number; startHp: number; maxHp: number; startTick: number }
  /** Chase a named thing; `last` is where this hero's screen last showed it. */
  | { kind: "catch"; target: string; untilTick: number; startTick: number; last?: { x: number; y: number; tick: number }; presses: number };

/** One decision's controller record, for the evaluator trace (policy_note). */
export interface NavNote {
  source: "model" | "controller";
  events: string[];
  goal: Goal | null;
  status: NavStatus;
  detail?: string;
  pathCells?: number;
  unknownCells?: number;
  controllerMoves?: number;
  notices?: string[];
  intent?: ReturnType<typeof describeIntent>;
}

export class NavigatorPlayer implements Policy {
  readonly name: string;
  readonly memory = "persistent" as const;
  private notes = "";
  private completed: { action: GameAction; ticks: number; interrupted?: string; movement?: MovementReport }[] = [];
  private rejected: { action: GameAction; status: "rejected" | "stale"; error: string }[] = [];
  private readonly system: string;
  readonly promptHash: string;
  private readonly schema: Record<string, unknown>;
  private readonly maxBatch: number;
  readonly heroMemory: HeroMemory;
  private lastObservation?: Observation;
  // Controller state (this hero only).
  private goal: Goal | null = null;
  private status: NavStatus = "none";
  private detail?: string;
  private replans = 0;
  private noProgress = 0;
  private lastCost = Infinity;
  private stuckInRow = 0;
  private controllerMoves = 0;
  private nudge = 1;
  private lastControllerMove?: { direction: Direction };
  private readonly stuck = new Map<string, number>();
  private speed?: { tilesPerTick: number; status: string };
  private walkedFrom?: { x: number; y: number; tick: number };
  private walkedTicks = 0;
  private snap?: Snapshot;
  private readonly seen = new Set<string>();
  private readonly partnerTexts = new Set<string>();
  private pending: string[] = [];
  private intent: Intent | null = null;
  /** Things the game reported moving, by name: last movement tick and where it ended. */
  private readonly motion = new Map<string, { tick: number; to: string }>();
  private notices: string[] = [];
  /** Counts, for the comparison with the other model players. */
  readonly counts = { modelDecisions: 0, controllerDecisions: 0 };

  constructor(
    readonly hero: "Sieg" | "Coco",
    manual: string,
    readonly model: MeteredGateway,
    maxBatch: number = MAX_BATCH,
    readonly briefing?: string,
    readonly tutorial?: string,
    readonly task: string = TASK,
  ) {
    if (!Number.isInteger(maxBatch) || maxBatch < 1 || maxBatch > MAX_BATCH) throw Error(`maxBatch must be an integer from 1 to ${MAX_BATCH}.`);
    if (briefing !== undefined && !briefing.trim()) throw Error("An episode briefing must not be empty.");
    if (tutorial !== undefined && !tutorial.trim()) throw Error("A tutorial briefing must not be empty.");
    if (!task.trim()) throw Error("A task must not be empty.");
    this.maxBatch = maxBatch;
    this.heroMemory = new HeroMemory(hero);
    this.name = `navigator-${NAV_ID}(${model.label})${maxBatch > 1 ? `·batch${maxBatch}` : ""}·memory${tutorial ? `·tutorial-${tutorialId(tutorial)}` : ""}${briefing ? `·briefing-${briefingId(briefing)}` : ""}${task !== TASK ? `·task-${taskId(task)}` : ""}`;
    this.system = systemPrompt(hero, manual, maxBatch, "persistent", task) + NAVIGATOR_SECTION + (tutorial ? tutorialBlock(tutorial) : "") + (briefing ? briefingBlock(briefing) : "");
    this.promptHash = createHash("sha256").update(this.system).digest("hex");
    this.schema = navigatorSchema(maxBatch);
  }

  /** The system prompt (for prompt-boundary tests). */
  systemText() {
    return this.system;
  }
  /** Read-only controller state, for tests and diagnostics. */
  navState() {
    return { goal: this.goal ? { ...this.goal } : null, status: this.status, detail: this.detail, controllerMoves: this.controllerMoves, intent: this.intent ? { ...this.intent } : null };
  }

  private remember(turn: TurnReport) {
    for (const s of turn.steps) {
      if (s.status === "executed") {
        this.completed.push({ action: s.action, ticks: s.result.ticks, ...(s.result.interrupted ? { interrupted: s.result.interrupted } : {}), ...(s.result.movement ? { movement: s.result.movement } : {}) });
        if (this.completed.length > COMPLETED_LOG) this.completed.shift();
      } else {
        this.rejected.push({ action: s.action, status: s.status, error: (s.result.error ?? s.result.feedback[0] ?? "").slice(0, 200) });
        if (this.rejected.length > REJECTED_LOG) this.rejected.shift();
      }
    }
  }

  /** Learn from the controller's own last move: speed, being stuck, and progress. */
  private afterControllerMove(turn: TurnReport | undefined, o: Observation) {
    const step = turn?.steps[0];
    const last = this.lastControllerMove;
    this.lastControllerMove = undefined;
    if (!last || !step || step.action.type !== "move") return;
    const mv = step.result.movement;
    if (!mv) return;
    this.walkedTicks += step.result.ticks;
    if (mv.outcome === "full" && mv.ticks.applied > 0) this.speed = { tilesPerTick: mv.requestedTiles / mv.ticks.applied, status: statusKey(o) };
    if (mv.outcome === "not_applied") {
      this.pending.push("the game did not take your last walking move (for example during a scene or while you were held)");
      return;
    }
    if (mv.movedTiles < 0.15 && (mv.blocked || mv.outcome === "none")) {
      const [vx, vy] = VEC[last.direction];
      const ax = Math.floor(mv.to.x + vx * 0.6), ay = Math.floor(mv.to.y + vy * 0.6);
      this.stuck.set(key(ax, ay), o.tick);
      this.replans++;
      this.stuckInRow++;
    } else this.stuckInRow = 0;
  }

  private speedFor(o: Observation) {
    if (this.speed && this.speed.status === statusKey(o)) return this.speed.tilesPerTick;
    const sprint = o.self.status.some((s) => s.startsWith("super speed"));
    const slowed = o.self.status.includes("time is slowed") && !(this.hero === "Sieg" && sprint);
    return WALK_TILES_PER_TICK * (sprint ? SPRINT_MULTIPLIER : 1) * (slowed ? SLOW_SCALE : 1);
  }

  private setGoal(g: { x: number; y: number } | null, o: Observation) {
    this.goal = g ? { area: o.area.name, x: g.x, y: g.y, setTick: o.tick } : null;
    this.status = g ? "walking" : "none";
    this.detail = undefined;
    this.replans = 0;
    this.noProgress = 0;
    this.lastCost = Infinity;
    this.stuckInRow = 0;
  }

  /** Whether the hero stands at its goal (same rule as plan()). */
  private atGoal(o: Observation) {
    const goal = this.goal;
    if (!goal || goal.area !== o.area.name) return false;
    const grid = buildGrid(this.heroMemory, o, this.stuck);
    const target = goalPoint(goal);
    const { cells, onCell } = goalCells(grid, goal);
    const here = { x: Math.floor(o.self.x), y: Math.floor(o.self.y) };
    return onCell ? Math.hypot(target.x - o.self.x, target.y - o.self.y) <= NAV.arriveTiles : cells.some((c) => c.x === here.x && c.y === here.y);
  }

  /**
   * One controller step toward the goal, or why the goal ended. Reads only
   * this hero's own memory and observation.
   */
  private plan(o: Observation): { move?: { direction: Direction; ticks: number }; pathCells?: number; unknownCells?: number } {
    const goal = this.goal!;
    if (goal.area !== o.area.name) {
      this.status = "unreachable";
      this.detail = `your goal was in ${goal.area}; you are now in ${o.area.name}`;
      return {};
    }
    for (const [k, t] of this.stuck) if (o.tick - t > NAV.stuckTtl) this.stuck.delete(k);
    const grid = buildGrid(this.heroMemory, o, this.stuck);
    const target = goalPoint(goal);
    const { cells, onCell } = goalCells(grid, goal);
    const me = { x: o.self.x, y: o.self.y };
    const here = { x: Math.floor(me.x), y: Math.floor(me.y) };
    const atGoal = onCell ? Math.hypot(target.x - me.x, target.y - me.y) <= NAV.arriveTiles : cells.some((c) => c.x === here.x && c.y === here.y);
    if (atGoal) {
      this.status = "arrived";
      this.detail = `you reached (${goal.x}, ${goal.y})`;
      return {};
    }
    if (!cells.length) {
      this.status = "unreachable";
      this.detail = `(${goal.x}, ${goal.y}) is blocked on your map and has no open tile beside it`;
      return {};
    }
    if (this.replans > NAV.maxReplans) {
      this.status = "unreachable";
      this.detail = `your moves toward (${goal.x}, ${goal.y}) kept stopping short (${this.replans} times)`;
      return {};
    }
    const found = aStar(grid, here, cells);
    if (!found) {
      this.status = "unreachable";
      this.detail = `no path to (${goal.x}, ${goal.y}) on your map: tiles you have seen block every way`;
      return {};
    }
    // Progress is judged against the previous plan, so a path that grew
    // because new walls came into view is not counted against the hero.
    const progressed = found.cost < this.lastCost - 0.3;
    this.lastCost = found.cost;
    if (progressed) this.noProgress = 0;
    else if (++this.noProgress > NAV.noProgressMoves) {
      this.status = "unreachable";
      this.detail = `you did not get closer to (${goal.x}, ${goal.y}) in ${NAV.noProgressMoves} moves`;
      return {};
    }
    const unknownCells = found.path.filter((c) => grid.unknown(c.x, c.y)).length;
    let move = nextMove(me, found.path, target, onCell, this.speedFor(o));
    // Two stuck moves in a row: step sideways once before the next try.
    if (this.stuckInRow >= 2) {
      const side: Record<Direction, [Direction, Direction]> = { n: ["e", "w"], s: ["w", "e"], e: ["s", "n"], w: ["n", "s"], ne: ["e", "n"], nw: ["w", "n"], se: ["e", "s"], sw: ["w", "s"] };
      const pick = side[move.direction][this.nudge > 0 ? 0 : 1];
      this.nudge = -this.nudge;
      move = { direction: pick, ticks: 4 };
      this.stuckInRow = 0;
    }
    this.status = "walking";
    this.detail = undefined;
    return { move, pathCells: found.path.length, unknownCells };
  }

  async decide(input: Parameters<Policy["decide"]>[0]): Promise<Decision> {
    const o = input.observation;
    if (input.batch) this.remember(input.batch);
    if (input.batch) this.heroMemory.recordTurn(input.batch, this.lastObservation);
    this.heroMemory.observe(o);
    this.afterControllerMove(input.batch, o);
    this.lastObservation = o;
    // Events since this hero's previous decision, then remember what it has now seen.
    const events = detectEvents(this.snap, o, input.legal, this.seen, this.partnerTexts);
    for (const v of o.visible) if (["enemy", "creature", "object", "exit", "label"].includes(v.kind)) this.seen.add(`${o.area.name}|${v.kind}|${v.name}`);
    for (const m of o.messages) this.partnerTexts.add(normalize(m.text));
    this.snap = snapshot(o, input.legal);
    if (input.batch?.replyProblem) events.push("your last reply could not be used");
    if (input.batch?.steps.some((s) => s.status !== "executed")) events.push("an action of yours was refused");
    this.pending.push(...this.filterEvents(events, o));
    // A catch whose E press changed the backpack has done its job.
    if (this.intent?.kind === "catch" && this.intent.presses > 0 && events.includes("your backpack changed")) {
      this.pending.push(`your catch ended: after your E press your backpack changed`);
      this.intent = null;
    }

    // A waiting or fighting intention: carry it on while nothing else happened.
    if (this.intent && !this.pending.length) {
      const step = this.intentStep(o, input.legal);
      if (step.action) {
        this.counts.controllerDecisions++;
        const note: NavNote = { source: "controller", events: [], goal: null, status: this.status, intent: describeIntent(this.intent) };
        return { action: step.action, note: note as unknown as Record<string, unknown> };
      }
      this.pending.push(step.ended!);
      this.intent = null;
    }

    // Walk without the model while nothing happened and the goal still holds.
    if (this.goal && this.status === "walking" && !this.pending.length) {
      if (this.controllerMoves >= NAV.maxControllerMoves) this.pending.push(`${NAV.maxControllerMoves} walking moves since your last reply`);
      else {
        const step = this.plan(o);
        if (step.move) {
          this.controllerMoves++;
          this.counts.controllerDecisions++;
          this.lastControllerMove = { direction: step.move.direction };
          const action: GameAction = { type: "move", direction: step.move.direction, ticks: step.move.ticks };
          const note: NavNote = { source: "controller", events: [], goal: { ...this.goal }, status: this.status, pathCells: step.pathCells, unknownCells: step.unknownCells, controllerMoves: this.controllerMoves };
          return { action, note: note as unknown as Record<string, unknown> };
        }
        this.pending.push((this.status as NavStatus) === "arrived" ? "you reached your walking goal" : `the walking helper cannot reach your goal: ${this.detail}`);
      }
    }
    // Asking anyway: if the hero already stands at its goal, say so in this same call.
    if (this.goal && this.status === "walking" && this.atGoal(o)) {
      this.status = "arrived";
      this.detail = `you reached (${this.goal.x}, ${this.goal.y})`;
      this.pending.push("you reached your walking goal");
    }
    if (!this.goal && !this.intent) this.pending.push("you have no walking goal");
    return this.askModel(input);
  }

  /**
   * Edge-trigger recurring conditions: a run of the game's "X moved" lines is
   * one event when it starts and one when it stops. During a fight, hits below
   * the fight's HP threshold and news about its own target do not interrupt.
   */
  private filterEvents(events: string[], o: Observation): string[] {
    const out: string[] = [];
    for (const e of events) {
      const m = MOTION_LINE.exec(e);
      if (m) {
        const prev = this.motion.get(m[1]);
        this.motion.set(m[1], { tick: o.tick, to: m[3] });
        if (prev && o.tick - prev.tick <= NAV.motionQuietTicks) continue;
        out.push(`${m[1]} started moving (from (${m[2]}) to (${m[3]}))`);
        continue;
      }
      out.push(e);
    }
    for (const [name, mv] of this.motion)
      if (o.tick - mv.tick > NAV.motionQuietTicks) {
        out.push(`${name} stopped moving, last reported at (${mv.to})`);
        this.motion.delete(name);
      }
    const chase = this.intent?.kind === "catch" ? this.intent : undefined;
    if (chase) {
      const t = chase.target.toLowerCase();
      return out.filter(
        (e) =>
          !e.toLowerCase().startsWith(`new on your screen: ${t} (`) &&
          !e.toLowerCase().startsWith(`${t} started moving`) &&
          !e.toLowerCase().startsWith(`${t} stopped moving`) &&
          e !== "a new action is available: use_item",
      );
    }
    const fight = this.intent?.kind === "fight" ? this.intent : undefined;
    if (!fight) return out;
    const lost = fight.startHp - o.self.hp;
    const kept = out.filter((e) => {
      if (/^you took damage/.test(e)) return lost >= NAV.fightHpLoss * fight.maxHp;
      if (e.startsWith(`${fight.target} (enemy) is close`) || e.startsWith(`new on your screen: ${fight.target} (enemy)`)) return false;
      return true;
    });
    if (lost >= NAV.fightHpLoss * fight.maxHp && !kept.some((e) => /^you took damage/.test(e))) kept.push(`you lost ${lost} HP since the fight began`);
    return kept;
  }

  /** One ordinary action for the current wait or fight intention, or why it ended. */
  private intentStep(o: Observation, legal: ActionSpec[]): { action?: GameAction; ended?: string } {
    const it = this.intent!;
    const can = (t: string) => legal.some((l) => l.type === t);
    if (o.tick >= it.untilTick) return { ended: `your ${it.kind === "wait" ? "wait_until" : it.kind} time ran out` };
    if (it.kind === "catch") return this.catchStep(it, o, can);
    if (it.kind === "wait") {
      if (it.watch) {
        const seen = o.visible.filter((v) => v.name === it.watch!.name);
        const w = it.watch;
        if (w.x === undefined) {
          if (!seen.length) return { ended: `"${w.name}", which you asked to watch, is not on your screen` };
          w.x = seen[0].x;
          w.y = seen[0].y;
        } else {
          const near = seen.sort((a, b) => Math.hypot(a.x - w.x!, a.y - w.y!) - Math.hypot(b.x - w.x!, b.y - w.y!))[0];
          if (!near) return { ended: `${w.name}, which you were watching, is no longer on your screen` };
          if (Math.hypot(near.x - w.x, near.y - w.y!) >= NAV.watchMoveTiles) return { ended: `${w.name}, which you were watching, moved from (${w.x}, ${w.y}) to (${near.x}, ${near.y})` };
        }
      }
      if (!can("wait")) return { ended: "you cannot wait now" };
      return { action: { type: "wait", ticks: Math.max(1, Math.min(NAV.waitChunkTicks, it.untilTick - o.tick)) } };
    }
    const act = planFightTarget(o, it.target);
    if (!act) {
      // fight attacks enemies only: a creature or object of that name is never engaged.
      const other = o.visible.find((v) => v.name === it.target && v.kind !== "enemy");
      if (other) return { ended: `${it.target} is a ${other.kind}, not an enemy; fight attacks only enemies and did not touch it` };
      return { ended: `${it.target} is not on your screen any more (defeated or out of sight)` };
    }
    if (act.type === "attack" && o.abilities.find((a) => a.key === "J")?.state !== "ready") return can("wait") ? { action: { type: "wait", ticks: 6 } } : { ended: "you cannot wait for your attack to recover now" };
    if (!can(act.type)) return { ended: `you cannot ${act.type} now` };
    return { action: act };
  }

  /**
   * One ordinary action for a catch: press E when the chased thing is close
   * and the backpack panel shows a nearby target; otherwise a short move
   * toward where this hero's screen shows it, or last showed it.
   */
  private catchStep(it: Extract<Intent, { kind: "catch" }>, o: Observation, can: (t: string) => boolean): { action?: GameAction; ended?: string } {
    const seen = o.visible
      .filter((v) => v.name === it.target && v.kind !== "partner")
      .sort((a, b) => a.distance - b.distance)[0];
    if (seen) it.last = { x: seen.x, y: seen.y, tick: o.tick };
    if (!it.last) return { ended: `"${it.target}", which you asked to catch, is not on your screen` };
    if (seen && seen.distance <= NAV.catchReachTiles && o.inventory.nearbyTarget && can("interact")) {
      it.presses++;
      return { action: { type: "interact" } };
    }
    if (!seen && Math.hypot(it.last.x - o.self.x, it.last.y - o.self.y) <= NAV.catchLostTiles)
      return { ended: `you reached where you last saw ${it.target} (${it.last.x}, ${it.last.y}) and it is not on your screen` };
    if (!can("move")) return { ended: "you cannot move now" };
    const grid = buildGrid(this.heroMemory, o, this.stuck);
    const target = { x: it.last.x, y: it.last.y };
    const { cells, onCell } = goalCells(grid, target);
    const here = { x: Math.floor(o.self.x), y: Math.floor(o.self.y) };
    const found = cells.length ? aStar(grid, here, cells) : null;
    if (!found) return { ended: `no path on your map to where ${it.target} was ${seen ? "" : "last "}seen (${it.last.x}, ${it.last.y})` };
    const move = nextMove(o.self, found.path, target, onCell, this.speedFor(o));
    this.lastControllerMove = { direction: move.direction };
    return { action: { type: "move", direction: move.direction, ticks: Math.min(move.ticks, NAV.catchMoveTicks) } };
  }

  private async askModel(input: Parameters<Policy["decide"]>[0]): Promise<Decision> {
    const o = input.observation;
    const why = [...new Set(this.pending)];
    this.pending = [];
    const navigation = {
      goal: this.goal ? { x: this.goal.x, y: this.goal.y, area: this.goal.area, set_at_tick: this.goal.setTick } : null,
      status: this.status,
      ...(this.detail ? { detail: this.detail } : {}),
      why_you_are_asked: why,
      walked: this.walkedFrom
        ? { moves: this.controllerMoves, ticks: this.walkedTicks, from: { x: this.walkedFrom.x, y: this.walkedFrom.y }, to: { x: o.self.x, y: o.self.y }, since_tick: this.walkedFrom.tick }
        : null,
      ...(this.notices.length ? { notices: this.notices } : {}),
      intent: this.intent ? describeIntent(this.intent) : null,
      ...(input.legal.some((l) => l.type === "ability" && l.params?.ability?.kind === "enum" && l.params.ability.values.includes("black_hole"))
        ? { aim_preview: aimPreview(this.heroMemory, o) }
        : {}),
    };
    const goalEnded = this.status === "arrived" || this.status === "unreachable";
    this.notices = [];
    const user = JSON.stringify({
      your_notes: this.notes,
      completed_actions: this.completed,
      recent_rejected_actions: this.rejected,
      last_turn: describeTurn(input),
      memory: this.heroMemory.view(o),
      navigation,
      observation: o,
      legal_actions: input.legal,
    });
    this.controllerMoves = 0;
    this.walkedTicks = 0;
    this.walkedFrom = { x: o.self.x, y: o.self.y, tick: o.tick };
    // An ended goal is reported in this call and then cleared.
    if (goalEnded) this.setGoal(null, o);
    this.counts.modelDecisions++;
    // Throws ModelCallError or BudgetExhausted; the runner handles both.
    const reply = await this.model.complete(this.system, user, { schema: this.schema });
    const usage = reply.record;
    const raw = reply.rawText ?? reply.text;
    const note: NavNote = { source: "model", events: why, goal: null, status: this.status };
    if (reply.meta?.stopReason === "max_tokens") return { replyProblem: "The reply was cut off at the output limit (stop reason max_tokens).", usage, raw, note: { ...note } as unknown as Record<string, unknown> };
    const parsed = parseNavigatorReply(reply.text, this.maxBatch);
    if (!parsed.ok) return { replyProblem: parsed.reason, usage, raw, note: note as unknown as Record<string, unknown> };
    if (parsed.notes !== undefined) this.notes = parsed.notes.slice(0, 400);
    if (parsed.goTo) {
      this.setGoal(parsed.goTo, o);
      this.intent = null;
    } else if (parsed.waitUntil) {
      this.setGoal(null, o);
      this.intent = { kind: "wait", untilTick: o.tick + Math.round(parsed.waitUntil.seconds * 60), startTick: o.tick, ...(parsed.waitUntil.watch ? { watch: { name: parsed.waitUntil.watch } } : {}) };
    } else if (parsed.fight) {
      this.setGoal(null, o);
      this.intent = { kind: "fight", target: parsed.fight.target, untilTick: o.tick + Math.round(parsed.fight.seconds * 60), startHp: o.self.hp, maxHp: o.self.maxHp, startTick: o.tick };
    } else if (parsed.catch) {
      this.setGoal(null, o);
      this.intent = { kind: "catch", target: parsed.catch.target, untilTick: o.tick + Math.round(parsed.catch.seconds * 60), startTick: o.tick, presses: 0 };
    } else if (parsed.stop) {
      this.setGoal(null, o);
      this.intent = null;
    }
    // The one disclosed filter: a message repeated within DUP_MESSAGE_TICKS is not sent.
    const sent = this.heroMemory.sentMessages();
    const actions = parsed.actions.filter((a) => {
      if (a.type !== "message") return true;
      const dup = sent.find((m) => normalize(m.text) === normalize(a.text) && o.tick - m.tick <= NAV.dupMessageTicks);
      if (dup) this.notices.push(`Not sent: your message "${a.text.slice(0, 80)}" is identical to the one you sent at tick ${dup.tick}.`);
      return !dup;
    });
    note.goal = this.goal ? { ...this.goal } : null;
    note.status = this.status;
    if (this.intent) note.intent = describeIntent(this.intent);
    if (this.notices.length) note.notices = [...this.notices];
    if (actions.length) {
      const [action, ...then] = actions;
      return { action, ...(then.length ? { then } : {}), ...(parsed.dropped.length ? { dropped: parsed.dropped } : {}), ...(parsed.recovered ? { recovered: parsed.recovered } : {}), usage, raw, note: note as unknown as Record<string, unknown> };
    }
    // Only a wait or fight: take its first step now, without another call.
    if (this.intent) {
      const step = this.intentStep(o, input.legal);
      if (step.action) {
        this.counts.controllerDecisions++;
        return { action: step.action, usage, raw, note: note as unknown as Record<string, unknown> };
      }
      this.intent = null;
      return { replyProblem: `Your ${parsed.fight ? "fight" : parsed.catch ? "catch" : "wait_until"} ended at once: ${step.ended}. Nothing was done; choose an action or another intention.`, usage, raw, note: note as unknown as Record<string, unknown> };
    }
    // Only a goal: take the first walking step now, without another call.
    if (this.goal) {
      const step = this.plan(o);
      note.status = this.status;
      if (step.move) {
        this.controllerMoves++;
        this.counts.controllerDecisions++;
        this.lastControllerMove = { direction: step.move.direction };
        Object.assign(note, { pathCells: step.pathCells, unknownCells: step.unknownCells });
        return { action: { type: "move", direction: step.move.direction, ticks: step.move.ticks }, usage, raw, note: note as unknown as Record<string, unknown> };
      }
      const why2 = (this.status as NavStatus) === "arrived" ? `You are already at (${this.goal.x}, ${this.goal.y}).` : `The walking helper cannot reach (${this.goal.x}, ${this.goal.y}): ${this.detail}.`;
      this.setGoal(null, o);
      return { replyProblem: `${why2} Nothing was done; choose an action or another goal.`, usage, raw, note: note as unknown as Record<string, unknown> };
    }
    return {
      replyProblem: this.notices.length ? "Your only action was a repeated message, which was not sent. Nothing was done." : "The reply had no actions and no walking goal. Nothing was done.",
      usage,
      raw,
      note: note as unknown as Record<string, unknown>,
    };
  }
}

function describeIntent(it: Intent) {
  if (it.kind === "wait") return { kind: "wait_until", until_tick: it.untilTick, ...(it.watch ? { watch: it.watch.name } : {}) };
  if (it.kind === "catch") return { kind: "catch", target: it.target, until_tick: it.untilTick, ...(it.last ? { last_seen: it.last } : {}), e_presses: it.presses };
  return { kind: "fight", target: it.target, until_tick: it.untilTick, hp_at_start: it.startHp };
}

const statusKey = (o: Observation) => o.self.status.filter((s) => s.startsWith("super speed") || s === "time is slowed" || s.startsWith("flying")).map((s) => s.replace(/ \(.*\)$/, "")).join("|");

/** Exported for tests. */
export const _internals = { snapshot };
