// Persistent per-hero memory for the opt-in model-memory player
// (docs/midterm/MODEL_MEMORY.md). One instance per hero per episode, owned by
// that hero's LLMPlayer. It is built only from what that player was already
// given: its own observations (decision-time and between batched actions) and
// the results of its own actions. It never reads World, GameRoom, map
// geometry, puzzle state or the partner's observations; this file imports
// types only, so it cannot.
//
// It records, never advises: no paths, waypoints, routes, targets or
// suggestions. Everything it renders is labelled as remembered and dated.

import type { Direction, GameAction, Observation, VisibleThing } from "./types.js";
import type { TurnReport } from "./policies/policy.js";

/** Bounds that keep memory and its rendering small and deterministic. */
export const MEMORY_LIMITS = Object.freeze({
  /** Areas with a remembered map; the least recently seen is dropped beyond this. */
  areas: 8,
  /** Largest area (in tiles) given a map; larger areas are summarized only. */
  areaTiles: 128 * 128,
  /** Remembered things (creatures, objects, labels...) across all areas. */
  things: 24,
  /** Verified events kept. Superseded ones are dropped first, then the oldest. */
  events: 24,
  /** Tiles kept per terrain-change event (for overlap and supersession). */
  eventTiles: 64,
  /** Messages this hero sent, most recent last. */
  sent: 6,
  /** Repeated-action records kept (only those repeated at least twice are shown). */
  repeats: 8,
  /** Recent moves that stopped short. */
  blocked: 4,
});

/** Repeats of one action within this many tiles of where it was first done count as the same place. */
const SAME_PLACE = 2;

/** Map characters. Terrain as the screen drew it, plus memory-only marks. */
export const MAP_LEGEND = Object.freeze({
  "?": "never on your screen",
  "#": "blocked, as last seen",
  ".": "open ground, as last seen; you have not walked here",
  "+": "open ground you have walked on",
  "~": "water or gap, as last seen",
  o: "an object, as last seen",
  ">": "an exit, as last seen",
  "^": "a raised hazard, as last seen",
  ":": "seen, but something stood on it (ground not shown)",
  "@": "you, now",
});

/** Screen characters stored as terrain. Anything else (hero, partner, creature, enemy, projectile) is mobile. */
const STORED = new Set(["#", ".", "~", "o", ">", "^"]);
const WALKABLE_SHOWN = new Set([".", ":", "?", "#"]);

/**
 * Feedback lines that only describe this hero's own action mechanics. They are
 * already reported per action in last_turn, so they are not events. Matched on
 * the interface's fixed wording (movementReport.ts, environment.ts), never on
 * game or puzzle content.
 */
const ROUTINE: readonly RegExp[] = [
  /^Your (move|push) \w+ was blocked at once:/,
  /^You moved \w+ only /,
  /^For \d+ of \d+ ticks /,
  /^(Your sword did not swing|No fireball was cast)/,
  /^You pressed E; nothing responded\.$/,
  /^You pushed, but nothing moved\.$/,
  /^You took \d+ damage\.$/,
  /^A dialogue line appeared\.$/,
  /^Message sent\.$/,
  /^That response is not available\.$/,
  /^Your choice was not taken\.$/,
];

export type EventKind = "game_feedback" | "terrain_changed" | "seen_moving";

/** A fact this hero's own observation verified. Never a hypothesis, never inferred from an action being accepted. */
export interface VerifiedEvent {
  id: number;
  kind: EventKind;
  /** Where the fact came from: the game's feedback text, or two of this hero's own screens. */
  source: "game feedback" | "your screen";
  area: string;
  text: string;
  firstTick: number;
  lastTick: number;
  /** How many times the same feedback line was shown. */
  count: number;
  /** A later observation of the same tiles or thing replaced this one. */
  supersededBy?: number;
  /** terrain_changed only: the tiles involved ("x,y"), at most eventTiles. */
  tiles?: string[];
  /** seen_moving only: which thing. */
  thing?: { kind: VisibleThing["kind"]; name: string };
  /** seen_moving only: where and when it was first seen. */
  origin?: { x: number; y: number; tick: number };
}

export interface SentMessage {
  from: "Sieg" | "Coco";
  to: "Sieg" | "Coco";
  text: string;
  /** Game tick of your observation just before you sent it. */
  tick: number;
}

/** One action done again and again at about the same place, and how often nothing new came of it. */
export interface RepeatRecord {
  action: string;
  area: string;
  near: { x: number; y: number };
  /** Times done since the last new result (the first of them included). */
  times: number;
  firstTick: number;
  lastTick: number;
  /** The result serial when this run of repeats started. */
  serial: number;
}

/** A move that stopped short, with what this hero's own map shows just ahead of where it stopped. */
export interface BlockedMove {
  tick: number;
  direction: Direction;
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** The tile just ahead of the hero's centre, as the hero's map shows it. */
  ahead: "open" | "blocked" | "unknown";
  /** When ahead is open (straight moves only): the run of open tiles across the way ahead, on the hero's map. */
  opening?: { x_from: number; x_to: number; y: number } | { y_from: number; y_to: number; x: number };
}

interface RememberedThing {
  area: string;
  kind: VisibleThing["kind"];
  name: string;
  x: number;
  y: number;
  extent?: VisibleThing["extent"];
  details?: string;
  tick: number;
}

interface AreaMap {
  name: string;
  w: number;
  h: number;
  terrain: string[];
  seen: Int32Array;
  walked: Uint8Array;
  lastTick: number;
}

const UNIT: Record<Direction, [number, number]> = {
  n: [0, -1], ne: [Math.SQRT1_2, -Math.SQRT1_2], e: [1, 0], se: [Math.SQRT1_2, Math.SQRT1_2],
  s: [0, 1], sw: [-Math.SQRT1_2, Math.SQRT1_2], w: [-1, 0], nw: [-Math.SQRT1_2, -Math.SQRT1_2],
};
/** A move whose sideways drift is at most this many tiles is treated as a straight walk between its ends. */
const STRAIGHT = 0.35;
const TRACKED_MOVERS = new Set<VisibleThing["kind"]>(["creature", "object"]);
const TRANSIENT = new Set<VisibleThing["kind"]>(["projectile", "effect"]);

export class HeroMemory {
  private areas = new Map<string, AreaMap>();
  private things: RememberedThing[] = [];
  private events: VerifiedEvent[] = [];
  private sent: SentMessage[] = [];
  private nextId = 1;
  private lastFeedback: string[] = [];
  private lastTick = -1;
  private repeats: RepeatRecord[] = [];
  private blocked: BlockedMove[] = [];
  /**
   * Counts new results this hero saw: a feedback line it had not seen before
   * (routine action lines excluded), a terrain change, or a change of area,
   * backpack, journal or dialogue line. Moving creatures do not count.
   */
  private serial = 0;
  private lastSig?: string;
  private readonly partner: "Sieg" | "Coco";

  constructor(readonly hero: "Sieg" | "Coco") {
    this.partner = hero === "Sieg" ? "Coco" : "Sieg";
  }

  /** Forget everything (a new episode). */
  clear() {
    this.areas.clear();
    this.things = [];
    this.events = [];
    this.sent = [];
    this.nextId = 1;
    this.lastFeedback = [];
    this.lastTick = -1;
    this.repeats = [];
    this.blocked = [];
    this.serial = 0;
    this.lastSig = undefined;
  }

  // ── Updates ─────────────────────────────────────────────────────────────

  /** Take in one observation this hero received. Idempotent for a repeated observation. */
  observe(o: Observation) {
    if (o.player !== (this.hero === "Sieg" ? "sieg" : "coco")) throw Error(`${this.hero}'s memory was given ${o.hero}'s observation.`);
    // Game time only moves forward within an episode; going back means a new one.
    if (o.tick < this.lastTick) this.clear();
    this.lastTick = o.tick;
    const sig = JSON.stringify([o.area.name, o.inventory.items.map((i) => [i.id, i.count]), o.journal, o.dialogue?.text ?? null]);
    if (this.lastSig !== undefined && sig !== this.lastSig) this.serial++;
    this.lastSig = sig;
    this.newFeedback(o);
    const map = this.map(o);
    if (map) {
      this.screen(map, o);
      this.walk(map, o.self.x, o.self.y);
      map.lastTick = o.tick;
    }
    this.seeThings(o);
  }

  /**
   * Take in the previous turn: messages this hero sent, and where its own
   * moves actually carried it. `decision` is the observation that turn
   * answered. Observations taken between batched actions are taken in too,
   * in order. A step's acceptance is never treated as an effect in the world.
   */
  recordTurn(turn: TurnReport, decision: Observation | undefined) {
    let before = decision;
    for (const step of turn.steps) {
      if (step.status === "executed") {
        if (step.action.type === "message")
          this.pushSent({ from: this.hero, to: this.partner, text: step.action.text, tick: before?.tick ?? this.lastTick });
        const mv = step.result.movement;
        const dir = directionOf(step.action);
        if (mv && before) {
          const map = this.areas.get(before.area.name);
          if (map) {
            this.walkMove(map, mv, dir);
            if (mv.blocked && dir && step.action.type === "move") this.noteBlocked(map, mv, dir, before.tick);
          }
        }
        const label = repeatLabel(step.action);
        if (label && before) this.noteRepeat(label, before);
      }
      if (step.after) {
        this.observe(step.after);
        before = step.after;
      }
    }
  }

  // ── Rendering ───────────────────────────────────────────────────────────

  /** What the model is shown alongside `now` (the current observation, already observed). */
  view(now: Observation) {
    const map = this.areas.get(now.area.name);
    const others = [...this.areas.values()]
      .filter((m) => m.name !== now.area.name)
      .sort((a, b) => b.lastTick - a.lastTick || cmp(a.name, b.name))
      .map((m) => ({ area: m.name, tiles_seen: count(m, (i) => m.terrain[i] !== "?"), tiles_walked: count(m, (i) => m.walked[i] === 1), last_seen_tick: m.lastTick }));
    const lastSeen = this.things
      .filter((t) => t.tick < now.tick)
      .sort((a, b) => b.tick - a.tick || cmp(thingKey(a), thingKey(b)))
      .map((t) => ({
        kind: t.kind,
        name: t.name,
        area: t.area,
        x: t.x,
        y: t.y,
        ...(t.extent ? { extent: t.extent } : {}),
        ...(t.details ? { details: t.details } : {}),
        seen_at_tick: t.tick,
        seconds_ago: Math.round((now.tick - t.tick) / 60),
      }));
    return {
      remembered_map: map ? this.render(map, now) : null,
      other_areas: others,
      last_seen_things: lastSeen,
      verified_events: this.events.map((e) => ({
        id: e.id,
        source: e.source,
        area: e.area,
        text: e.text,
        tick: e.lastTick,
        ...(e.count > 1 ? { first_tick: e.firstTick, times: e.count } : e.firstTick !== e.lastTick ? { first_tick: e.firstTick } : {}),
        ...(e.supersededBy !== undefined ? { superseded_by: e.supersededBy } : {}),
      })),
      recent_sent_messages: this.sent.map((m) => ({ ...m })),
      repeated_without_new_result: this.repeats
        .filter((r) => r.times >= 2)
        .sort((a, b) => a.lastTick - b.lastTick || cmp(a.action, b.action))
        .map((r) => ({ action: r.action, area: r.area, near: r.near, times: r.times, first_tick: r.firstTick, last_tick: r.lastTick })),
      recent_blocked_moves: this.blocked.map((b) => ({ ...b })),
    };
  }

  /** Read-only accessors for tests and diagnostics. */
  terrainAt(area: string, x: number, y: number) {
    const m = this.areas.get(area);
    return m && inside(m, x, y) ? m.terrain[y * m.w + x] : undefined;
  }
  walkedAt(area: string, x: number, y: number) {
    const m = this.areas.get(area);
    return !!m && inside(m, x, y) && m.walked[y * m.w + x] === 1;
  }
  lastSeenTickAt(area: string, x: number, y: number) {
    const m = this.areas.get(area);
    return m && inside(m, x, y) ? m.seen[y * m.w + x] : undefined;
  }
  verifiedEvents(): readonly VerifiedEvent[] {
    return this.events;
  }
  sentMessages(): readonly SentMessage[] {
    return this.sent;
  }
  repeatRecords(): readonly RepeatRecord[] {
    return this.repeats;
  }
  blockedMoves(): readonly BlockedMove[] {
    return this.blocked;
  }
  size() {
    return { areas: this.areas.size, things: this.things.length, events: this.events.length, sent: this.sent.length, repeats: this.repeats.length, blocked: this.blocked.length };
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private map(o: Observation): AreaMap | undefined {
    const { name, widthTiles: w, heightTiles: h } = o.area;
    if (!(w > 0 && h > 0) || w * h > MEMORY_LIMITS.areaTiles) return undefined;
    let m = this.areas.get(name);
    if (!m || m.w !== w || m.h !== h) {
      m = { name, w, h, terrain: new Array<string>(w * h).fill("?"), seen: new Int32Array(w * h).fill(-1), walked: new Uint8Array(w * h), lastTick: o.tick };
      this.areas.set(name, m);
      if (this.areas.size > MEMORY_LIMITS.areas) {
        const oldest = [...this.areas.values()].filter((a) => a !== m).sort((a, b) => a.lastTick - b.lastTick || cmp(a.name, b.name))[0];
        this.areas.delete(oldest.name);
      }
    }
    return m;
  }

  /** Copy this screen into the map; collect tiles whose remembered terrain changed. */
  private screen(m: AreaMap, o: Observation) {
    const changes = new Map<string, { tiles: string[]; since: number }>();
    o.screen.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const x = o.screen.originX + c,
          y = o.screen.originY + r,
          ch = row[c];
        if (ch === " " || !inside(m, x, y)) continue;
        const i = y * m.w + x;
        const prev = m.terrain[i];
        // A mobile thing hides the ground: keep what was there before, if known.
        const next = STORED.has(ch) ? ch : prev === "?" ? ":" : prev;
        if (STORED.has(prev) && STORED.has(next) && prev !== next) {
          // Both are single screen characters; the key is the pair itself (">" is a terrain character).
          const key = prev + next;
          const g = changes.get(key) ?? { tiles: [], since: -1 };
          g.tiles.push(`${x},${y}`);
          g.since = Math.max(g.since, m.seen[i]);
          changes.set(key, g);
        }
        m.terrain[i] = next;
        m.seen[i] = o.tick;
      }
    });
    for (const [key, g] of [...changes.entries()].sort((a, b) => cmp(a[0], b[0]))) {
      const [from, to] = [key[0], key[1]];
      const xs = g.tiles.map((t) => Number(t.split(",")[0])),
        ys = g.tiles.map((t) => Number(t.split(",")[1]));
      const span = (v: number[]) => (Math.min(...v) === Math.max(...v) ? `${Math.min(...v)}` : `${Math.min(...v)}–${Math.max(...v)}`);
      const n = g.tiles.length;
      const text = `${n} tile${n > 1 ? "s" : ""} at x ${span(xs)}, y ${span(ys)} changed from "${from}" (${shortLegend(from)}) to "${to}" (${shortLegend(to)}) between your views at tick ${g.since} and tick ${o.tick}.`;
      const tiles = g.tiles.slice(0, MEMORY_LIMITS.eventTiles);
      this.serial++;
      const id = this.addEvent({ kind: "terrain_changed", source: "your screen", area: m.name, text, firstTick: o.tick, lastTick: o.tick, count: 1, tiles });
      const set = new Set(tiles);
      for (const e of this.events)
        if (e.id !== id && e.kind === "terrain_changed" && e.area === m.name && e.supersededBy === undefined && e.tiles?.some((t) => set.has(t))) e.supersededBy = id;
      this.trimEvents();
    }
  }

  private walk(m: AreaMap, x: number, y: number) {
    const tx = Math.floor(x),
      ty = Math.floor(y);
    if (inside(m, tx, ty)) m.walked[ty * m.w + tx] = 1;
  }

  /**
   * Mark where one move actually took this hero. Its two ends are the game's
   * reported positions. The tiles between are marked only when this hero's
   * own walking did all the moving (no ticks moved by the game) and the path
   * was a straight line in the requested direction. A move that went nowhere
   * marks only where the hero stood.
   */
  private walkMove(m: AreaMap, mv: NonNullable<TurnReport["steps"][number]["result"]["movement"]>, dir: Direction | undefined) {
    this.walk(m, mv.from.x, mv.from.y);
    this.walk(m, mv.to.x, mv.to.y);
    if (!dir || mv.ticks.movedByGame > 0 || (mv.outcome !== "full" && mv.outcome !== "partial")) return;
    const vx = mv.to.x - mv.from.x,
      vy = mv.to.y - mv.from.y;
    const [ux, uy] = UNIT[dir];
    if (Math.abs(vx * uy - vy * ux) > STRAIGHT || vx * ux + vy * uy <= 0) return;
    const steps = Math.ceil(Math.hypot(vx, vy) / 0.25);
    for (let k = 1; k < steps; k++) this.walk(m, mv.from.x + (vx * k) / steps, mv.from.y + (vy * k) / steps);
  }

  /** Lines added to the feedback list since the previous observation. */
  private newFeedback(o: Observation) {
    const prev = this.lastFeedback,
      cur = o.feedback;
    let overlap = 0;
    for (let k = Math.min(prev.length, cur.length); k > 0; k--)
      if (prev.slice(prev.length - k).every((line, i) => line === cur[i])) {
        overlap = k;
        break;
      }
    this.lastFeedback = [...cur];
    for (const line of cur.slice(overlap)) {
      if (ROUTINE.some((re) => re.test(line))) continue;
      const same = this.events.find((e) => e.kind === "game_feedback" && e.text === line);
      if (same) {
        same.count++;
        same.lastTick = o.tick;
      } else {
        this.addEvent({ kind: "game_feedback", source: "game feedback", area: o.area.name, text: line, firstTick: o.tick, lastTick: o.tick, count: 1 });
        this.serial++;
      }
    }
    this.trimEvents();
  }

  private seeThings(o: Observation) {
    const area = o.area.name;
    const x0 = o.screen.originX,
      y0 = o.screen.originY,
      x1 = x0 + (o.screen.rows[0]?.length ?? 0),
      y1 = y0 + o.screen.rows.length;
    const now = o.visible.filter((v) => !TRANSIENT.has(v.kind));
    const groups = new Map<string, VisibleThing[]>();
    for (const v of now) groups.set(`${v.kind}|${v.name}`, [...(groups.get(`${v.kind}|${v.name}`) ?? []), v]);
    const replaced = new Set<RememberedThing>();
    // One thing of a kind and name seen now, and one remembered in this area: the same thing.
    for (const [key, list] of [...groups.entries()].sort((a, b) => cmp(a[0], b[0]))) {
      if (list.length !== 1) continue;
      const old = this.things.filter((t) => t.area === area && `${t.kind}|${t.name}` === key);
      if (old.length !== 1) continue;
      replaced.add(old[0]);
      const v = list[0];
      if (TRACKED_MOVERS.has(v.kind) && Math.hypot(v.x - old[0].x, v.y - old[0].y) >= 1 && old[0].tick < o.tick) this.seenMoving(area, old[0], v, o.tick);
    }
    const onScreenNow = (t: RememberedThing) => t.area === area && t.x >= x0 && t.x < x1 && t.y >= y0 && t.y < y1;
    // Something remembered where the screen now shows the place is either listed again or no longer there.
    this.things = this.things.filter((t) => !replaced.has(t) && !onScreenNow(t));
    for (const v of now)
      this.things.push({ area, kind: v.kind, name: v.name, x: v.x, y: v.y, ...(v.extent ? { extent: { ...v.extent } } : {}), ...(v.details ? { details: v.details } : {}), tick: o.tick });
    if (this.things.length > MEMORY_LIMITS.things) {
      const keep = [...this.things].sort((a, b) => b.tick - a.tick || cmp(thingKey(a), thingKey(b))).slice(0, MEMORY_LIMITS.things);
      const set = new Set(keep);
      this.things = this.things.filter((t) => set.has(t));
    }
  }

  private seenMoving(area: string, old: RememberedThing, v: VisibleThing, tick: number) {
    const ev = this.events.find((e) => e.kind === "seen_moving" && e.area === area && e.supersededBy === undefined && e.thing?.kind === v.kind && e.thing.name === v.name);
    const origin = ev?.origin ?? { x: old.x, y: old.y, tick: old.tick };
    const text = `${v.name} (${v.kind}): first seen at (${origin.x}, ${origin.y}) at tick ${origin.tick}; seen at (${v.x}, ${v.y}) at tick ${tick}.`;
    if (ev) {
      ev.text = text;
      ev.lastTick = tick;
      ev.count++;
      // Keep the list ordered by when each fact was last confirmed.
      this.events = [...this.events.filter((e) => e !== ev), ev];
    } else this.addEvent({ kind: "seen_moving", source: "your screen", area, text, firstTick: origin.tick, lastTick: tick, count: 1, thing: { kind: v.kind, name: v.name }, origin });
    this.trimEvents();
  }

  /** Count one more doing of `label` here, or start over if something new happened since the last time. */
  private noteRepeat(label: string, at: Observation) {
    const area = at.area.name,
      x = at.self.x,
      y = at.self.y;
    const r = this.repeats.find((e) => e.action === label && e.area === area && Math.abs(e.near.x - x) <= SAME_PLACE && Math.abs(e.near.y - y) <= SAME_PLACE);
    if (r && r.serial === this.serial) {
      r.times++;
      r.lastTick = at.tick;
    } else if (r) Object.assign(r, { near: { x, y }, times: 1, firstTick: at.tick, lastTick: at.tick, serial: this.serial });
    else this.repeats.push({ action: label, area, near: { x, y }, times: 1, firstTick: at.tick, lastTick: at.tick, serial: this.serial });
    if (this.repeats.length > MEMORY_LIMITS.repeats) {
      this.repeats.sort((a, b) => a.lastTick - b.lastTick || cmp(a.action, b.action));
      this.repeats.shift();
    }
  }

  private noteBlocked(m: AreaMap, mv: NonNullable<TurnReport["steps"][number]["result"]["movement"]>, dir: Direction, tick: number) {
    const [ux, uy] = UNIT[dir];
    const ax = Math.floor(mv.to.x + ux * 0.6),
      ay = Math.floor(mv.to.y + uy * 0.6);
    const open = (x: number, y: number) => inside(m, x, y) && (m.terrain[y * m.w + x] === "." || m.walked[y * m.w + x] === 1);
    const t = inside(m, ax, ay) ? m.terrain[ay * m.w + ax] : "?";
    const ahead: BlockedMove["ahead"] = open(ax, ay) ? "open" : t === "?" || t === ":" ? "unknown" : "blocked";
    let opening: BlockedMove["opening"];
    if (ahead === "open" && (dir === "n" || dir === "s")) {
      let a = ax, b = ax;
      while (a - 1 >= ax - 4 && open(a - 1, ay)) a--;
      while (b + 1 <= ax + 4 && open(b + 1, ay)) b++;
      opening = { x_from: a, x_to: b, y: ay };
    } else if (ahead === "open" && (dir === "e" || dir === "w")) {
      let a = ay, b = ay;
      while (a - 1 >= ay - 4 && open(ax, a - 1)) a--;
      while (b + 1 <= ay + 4 && open(ax, b + 1)) b++;
      opening = { y_from: a, y_to: b, x: ax };
    }
    this.blocked.push({ tick, direction: dir, from: { ...mv.from }, to: { ...mv.to }, ahead, ...(opening ? { opening } : {}) });
    if (this.blocked.length > MEMORY_LIMITS.blocked) this.blocked.shift();
  }

  private addEvent(e: Omit<VerifiedEvent, "id">) {
    const id = this.nextId++;
    this.events.push({ id, ...e });
    return id;
  }

  private trimEvents() {
    while (this.events.length > MEMORY_LIMITS.events) {
      const superseded = this.events.findIndex((e) => e.supersededBy !== undefined);
      this.events.splice(superseded >= 0 ? superseded : 0, 1);
    }
  }

  private pushSent(m: SentMessage) {
    this.sent.push(m);
    if (this.sent.length > MEMORY_LIMITS.sent) this.sent.shift();
  }

  private render(m: AreaMap, now: Observation) {
    let x0 = m.w,
      y0 = m.h,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) {
        const i = y * m.w + x;
        if (m.terrain[i] === "?" && !m.walked[i]) continue;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    const me = { x: Math.floor(now.self.x), y: Math.floor(now.self.y) };
    if (x1 < 0) return { area: m.name, rows: [], tiles_seen: 0, tiles_walked: 0 };
    const pad = String(y1).length;
    const lead = " ".repeat(pad + 1);
    const xs = Array.from({ length: x1 - x0 + 1 }, (_, k) => x0 + k);
    const rows = [
      lead + xs.map((x) => (x >= 10 ? String(Math.floor(x / 10) % 10) : " ")).join(""),
      lead + xs.map((x) => String(x % 10)).join(""),
    ];
    for (let y = y0; y <= y1; y++) {
      let line = `${String(y).padStart(pad)} `;
      for (const x of xs) {
        const i = y * m.w + x;
        const t = m.terrain[i];
        line += x === me.x && y === me.y ? "@" : m.walked[i] && WALKABLE_SHOWN.has(t) ? "+" : t;
      }
      rows.push(line);
    }
    const sx = now.screen.originX,
      sy = now.screen.originY;
    return {
      area: m.name,
      x_from: x0,
      x_to: x1,
      y_from: y0,
      y_to: y1,
      on_screen_now: { x_from: Math.max(sx, 0), x_to: Math.min(sx + (now.screen.rows[0]?.length ?? 0), m.w) - 1, y_from: Math.max(sy, 0), y_to: Math.min(sy + now.screen.rows.length, m.h) - 1 },
      rows,
      tiles_seen: count(m, (i) => m.terrain[i] !== "?"),
      tiles_walked: count(m, (i) => m.walked[i] === 1),
    };
  }
}

/** The actions whose repeats are tracked: E, backpack items and abilities. Moves, attacks, waits and messages are not. */
function repeatLabel(a: GameAction): string | undefined {
  if (a.type === "interact") return "interact (E)";
  if (a.type === "use_item") return a.item ? `use_item ${a.item}` : "use_item";
  if (a.type === "ability") return a.direction ? `ability ${a.ability} ${a.direction}` : `ability ${a.ability}`;
  return undefined;
}

function directionOf(a: GameAction): Direction | undefined {
  return a.type === "move" ? a.direction : a.type === "ability" ? a.direction : undefined;
}
const inside = (m: AreaMap, x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h;
const count = (m: AreaMap, f: (i: number) => boolean) => {
  let n = 0;
  for (let i = 0; i < m.w * m.h; i++) if (f(i)) n++;
  return n;
};
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const thingKey = (t: RememberedThing) => `${t.area}|${t.kind}|${t.name}|${t.x},${t.y}`;
function shortLegend(ch: string) {
  return ({ "#": "blocked", ".": "open", "~": "water or gap", o: "object", ">": "exit", "^": "raised hazard" } as Record<string, string>)[ch] ?? ch;
}
