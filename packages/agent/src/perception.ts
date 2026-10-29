// Trusted presentation layer. It reads the authoritative room and returns
// only what one hero's screen, HUD and panels show. Game-playing agents never
// receive the room, the World or this module's inputs, only its output.

import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import type {
  Player,
  Rect,
  Role,
  SceneId,
  World,
} from "../../shared/src/gameTypes.js";
import { collisionRects, maps } from "../../shared/src/maps.js";
import { items, type ItemId, type InventoryTarget } from "../../shared/src/items.js";
import {
  mirrorPondState,
  pondSpikeColumns,
  pondSpikeState,
  pondStations,
} from "../../shared/src/mirrorPond.js";
import {
  hedgeMazeState,
  mazeBurnBush,
} from "../../shared/src/hedgeMaze.js";
import {
  griffinNest,
  griffinPillars,
  griffinState,
  type GriffinState,
} from "../../shared/src/griffin.js";
import { SHRINE_OFFERING, shrineComplete, shrinePoints } from "../../shared/src/shrine.js";
import { MAZE_GATE_TARGET, MAZE_RUNNER_TARGET } from "../../../apps/server/src/hedgeMaze.js";
import { POND_CHEST_TARGET } from "../../../apps/server/src/mirrorPond.js";
import { storyView } from "../../../apps/client/src/ui/storyDialogue.js";
import { questLog } from "../../../apps/client/src/ui/questLog.js";
import type {
  Direction,
  Observation,
  PlayerId,
  VisibleThing,
} from "./types.js";

export const TILE = 32;
/** World units on screen: the client's 640×360 target footprint (viewport.ts). */
export const VIEW_W = 640;
export const VIEW_H = 360;
/** Inventory panel reach (InventoryPanel.target / InventoryService.nearest). */
export const TARGET_REACH = 64;

/**
 * "as-drawn" (default; owner decision 2026-10-27) keeps every sign and
 * in-world label exactly as the client draws it. The HUD goal lines are a
 * separate, always-hidden evaluation restriction (they spell out solutions)
 * and are never produced here, for the baseline and the model alike.
 * "names-only" is the earlier, stricter presentation, kept for comparison:
 * it cuts instruction text from labels down to names.
 */
export type LabelMode = "names-only" | "as-drawn";

export const roleOf = (p: PlayerId): Role => (p === "sieg" ? "OATH" : "EMBER");
export const heroName = (r: Role | PlayerId) =>
  r === "OATH" || r === "sieg" ? "Sieg" : "Coco";

export const areaNames: Partial<Record<SceneId, string>> = {
  GODDESS_SHRINE: "Goddess Shrine",
  MIRROR_POND: "Mirror Pond",
  HEDGE_MAZE: "Hedge Maze",
  GRIFFIN_ENCLOSURE: "Griffin Enclosure",
  PUZZLE_GLADE: "Puzzle Glade",
  BRIDGE_RUINS: "Bridge Ruins",
};
export const areaName = (s: SceneId) =>
  areaNames[s] ??
  s
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

const compass: Direction[] = ["e", "se", "s", "sw", "w", "nw", "n", "ne"];
/** Facing radians (y down, 0 = east) to the nearest compass point. */
export function directionOf(angle: number): Direction {
  const i = Math.round(angle / (Math.PI / 4));
  return compass[((i % 8) + 8) % 8];
}
export const vectorOf: Record<Direction, { x: number; y: number }> = {
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
  nw: { x: -1, y: -1 },
};
export const round1 = (n: number) => Math.round(n * 10) / 10;
/**
 * Truncated (not rounded) to two decimals, so the whole-number part always
 * matches the screen cell the hero is drawn in: 25.996 is 25.99, never 26.00
 * (pilot-6 audit finding 4). The whole part is Math.floor(n) by construction.
 * The stored value is truncated exactly, with no rounding guard: a guard
 * (until the review fixes of 2026-10-28) moved positions that real walking
 * reaches just below an x.x5 boundary up a hundredth, which changed what the
 * scripted players read (asTuned.test.ts). A double just below a hundredth,
 * such as 0.29 (stored as 0.28999…), therefore reads 0.28.
 */
export function truncate2(n: number) {
  const whole = Math.floor(n);
  const hundredths = Math.min(99, Math.floor((n - whole) * 100));
  return Number((whole + hundredths / 100).toFixed(2));
}

/** Listed things whose position changes in play; their coordinates are truncated like `self`. */
export const MOVING_KINDS: ReadonlySet<VisibleThing["kind"]> = new Set(["partner", "enemy", "creature", "projectile", "effect"]);

/** Dialogue lines kept per hero (oldest dropped first). */
export const DIALOGUE_LOG = 12;

/** Per-hero memory the screen itself provides: where they have been. */
export class PlayerMemory {
  areas: string[] = [];
  explored = new Map<SceneId, Set<string>>();
  feedback: string[] = [];
  messages: { from: "Sieg" | "Coco"; text: string; tick: number }[] = [];
  messagesSent = 0;
  /** Dialogue lines this hero's screen displayed (see Observation.dialogueLog). */
  dialogue: { speaker: string; text: string; tick: number }[] = [];
  private lineKey: string | null = null;
  /**
   * Records the line this hero's dialogue box shows now, if it is new. Called
   * by the environment after every change to the world, so lines that come and
   * go while the hero is mid-action or waiting are kept. A blank box ("…" with
   * no speaker) is not a line and is not recorded.
   */
  hear(view: { key: string; speaker: string; text: string } | null, tick: number) {
    const key = view?.key ?? null;
    if (key === this.lineKey) return;
    this.lineKey = key;
    if (!view || (!view.speaker && (view.text === "…" || !view.text.trim()))) return;
    this.dialogue.push({ speaker: view.speaker, text: view.text, tick });
    if (this.dialogue.length > DIALOGUE_LOG) this.dialogue.shift();
  }
  note(line: string) {
    this.feedback.push(line);
    if (this.feedback.length > 8) this.feedback.shift();
  }
  /** Marks the 4×4-tile blocks currently on screen as explored. */
  see(scene: SceneId, view: Rect) {
    const name = areaName(scene);
    if (!this.areas.includes(name)) this.areas.push(name);
    const set = this.explored.get(scene) ?? new Set<string>();
    this.explored.set(scene, set);
    const block = TILE * 4;
    for (let y = Math.floor(view.y / block); y * block < view.y + view.h; y++)
      for (let x = Math.floor(view.x / block); x * block < view.x + view.w; x++)
        set.add(`${x},${y}`);
  }
}

export function sceneOf(w: World, p: Player): SceneId {
  return p.sceneId ?? w.sceneId;
}

/** The camera rectangle: centred on the hero, held inside the map. */
export function viewRect(w: World, p: Player): Rect {
  const map = maps[sceneOf(w, p)];
  const clamp = (c: number, size: number, limit: number) =>
    size >= limit ? (limit - size) / 2 : Math.min(Math.max(c - size / 2, 0), limit - size);
  return {
    x: clamp(p.x, VIEW_W, map.width),
    y: clamp(p.y, VIEW_H, map.height),
    w: VIEW_W,
    h: VIEW_H,
  };
}
const inRect = (q: { x: number; y: number }, r: Rect, pad = 0) =>
  q.x >= r.x - pad && q.x <= r.x + r.w + pad && q.y >= r.y - pad && q.y <= r.y + r.h + pad;
/** Margin (world units) by which a thing's centre may sit outside the camera and still be listed. */
export const VIEW_PAD = 8;
/**
 * Whether a point is on this hero's screen right now: the same rule perceive()
 * uses for `visible`. World-change feedback (worldEvents.ts) uses it too, so
 * events can never report what the observation would not show.
 */
export function onScreen(w: World, p: Player, q: { x: number; y: number }): boolean {
  return inRect(q, viewRect(w, p), VIEW_PAD);
}

/** The inventory panel's "Nearby:" target, exactly as the client picks it. */
export function nearbyTarget(w: World, p: Player): InventoryTarget | undefined {
  if (w.phase !== "PLAYING" || p.hp <= 0) return;
  return Object.values(w.inventoryTargets ?? {})
    .filter(
      (t) =>
        t.sceneId === sceneOf(w, p) &&
        Math.hypot(t.x - p.x, t.y - p.y) <= TARGET_REACH,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y) ||
        a.id.localeCompare(b.id),
    )[0];
}

const label = (mode: LabelMode, full: string, names: string) =>
  mode === "as-drawn" ? full : names;
/** Names-only form of an inventory target name: the part before " · ". */
export const targetName = (mode: LabelMode, name: string) =>
  mode === "as-drawn" ? name : name.split(" · ")[0];

/**
 * Partner and enemy health as the client draws it: a 36 px bar with a
 * continuous fill and no numbers (PlayerView.ts, EnemyView.ts). Reported in
 * eighths (4.5 px steps), which a player can tell apart on the bar; exact HP
 * is never reported. A living character always shows at least 1/8.
 */
export function healthBar(hp: number, maxHp: number) {
  const f = Math.max(0, Math.min(1, hp / maxHp));
  if (f >= 1) return "health bar full";
  const eighths = Math.min(7, Math.max(f > 0 ? 1 : 0, Math.round(f * 8)));
  return `health bar about ${eighths}/8`;
}

interface Prop {
  kind: VisibleThing["kind"];
  name: string;
  x: number;
  y: number;
  details?: string;
  /** Screen-grid character; none for a floating label that hides no cell. */
  mark?: string;
  /**
   * Floor art drawn across several tiles (world px). Every cell it covers gets
   * `mark`, drawn under people and other things, and the listing gives its
   * extent. Pilot-7: a spike column drawn as one cell looked like a row with
   * clear lanes beside it.
   */
  floor?: Rect;
}

function griffinLabel(g: GriffinState, mode: LabelMode) {
  // Same text as GriffinView's floating label.
  if (g.wigClaimed) return label(mode, "WIG ACQUIRED · Return to shrine", "wig acquired");
  if (g.wigDropped) return label(mode, "WIG DROPPED · E at nest to collect", "wig dropped at the nest");
  if (g.groomingStage === "DEPART") return "FLYING AWAY";
  if (g.phase === "GROOMING")
    return g.groomingStage === "RETURN"
      ? "RETURNING TO THE NEST"
      : g.groomingStage === "STAND"
        ? "PICKING UP THE MIRROR"
        : g.groomingStage === "CUT"
          ? "A LITTLE TRIM…"
          : "CHECKING THAT MAGNIFICENT HAIR";
  if (g.hp <= 0) return label(mode, "DEFEATED · E at nest for wig", "defeated");
  return `GRIFFIN ${g.hp}/320 · ${g.phase.replaceAll("_", " ")}`;
}

/** Scene props and labels the client's environment views draw. */
function sceneProps(w: World, scene: SceneId, mode: LabelMode): Prop[] {
  const props: Prop[] = [];
  const cutscene = !!w.story?.cutscene;
  if (scene === "GODDESS_SHRINE") {
    const done = shrineComplete(w);
    props.push({
      kind: "object",
      name: done ? "THE GODDESS OF DIVINE VOLUME (statue)" : "THE BALD GODDESS (statue)",
      x: 640,
      y: 454,
      details: done ? "smiling, wearing a wig" : "crying",
      mark: "o",
    });
    // Signs are hidden while a story scene plays (ShrineView).
    const sign = (text: string, edge: string) => (cutscene ? `${edge} path` : text);
    props.push(
      { kind: "exit", name: sign("WEST · MIRROR POND · E · Travel", "west"), ...shrinePoints.west, mark: ">" },
      { kind: "exit", name: sign("EAST · HEDGE MAZE · E · Travel", "east"), ...shrinePoints.east, mark: ">" },
      { kind: "exit", name: sign("NORTH · GRIFFIN TRAIL", "north"), ...shrinePoints.north, mark: ">" },
      { kind: "exit", name: sign("START / RETURN · E · Puzzle Map 2", "south"), ...maps.GODDESS_SHRINE.points.back, mark: ">" },
    );
    if (!cutscene)
      props.push({
        kind: "object",
        name: label(mode, "E · Speak / offer a gift · I · Shared inventory", "offering plate"),
        ...shrinePoints.offering,
        mark: "o",
      });
  }
  if (scene === "MIRROR_POND") {
    const pond = mirrorPondState(w.puzzles);
    pondStations.forEach((s, i) => {
      const deg = pond ? Number((((pond.mirrors[i] * 180) / Math.PI) % 360).toFixed(1)) : 0;
      props.push({
        kind: "object",
        name: `mirror M${i + 1}`,
        x: s.x,
        y: s.y,
        details: label(mode, `${deg}° · Push one end · other end reverses`, `rotated ${deg}°`),
        mark: "o",
      });
      props.push({
        kind: "object",
        name: `brazier ${i + 1}`,
        ...s.torch,
        details: pond?.torches[i] ? "lit" : "unlit",
        mark: "o",
      });
      // Painted on the pad (MirrorPondView's text label): read, not used.
      props.push({
        kind: "label",
        name: label(mode, `floor marking A${i + 1} ${["→", "↑", "←", "↓"][i]}`, `floor marking A${i + 1}`),
        ...s.shot,
      });
    });
    // MirrorPondView draws each column as one plate per tile down the whole
    // corridor (four tiles), all in the same phase. Only the current phase is
    // reported, as drawn: never its timing or what comes next.
    pondSpikeColumns.forEach((r, i) => {
      const phase = pond ? pondSpikeState(pond.clock, i).phase : "down";
      props.push({
        kind: "object",
        name: "spike trap",
        x: r.x + r.w / 2,
        y: r.y + r.h / 2,
        details: phase,
        mark: phase === "raised" ? "^" : "o",
        floor: r,
      });
    });
    if (pond?.raised)
      props.push({ kind: "object", name: "sanctuary (risen from the water)", x: 24 * TILE, y: 19 * TILE, mark: "o" });
    // Text MirrorPondView draws on the ground: labels, not objects to use
    // (pilot-7: both heroes pressed E on them about 30 times).
    props.push(
      { kind: "label", name: label(mode, "SIEG · Super Speed (2) · East spike entrance", "east entrance"), x: 1440, y: 760 },
      { kind: "label", name: label(mode, "COCO · Flight (2) · Water culvert → pond", "water culvert"), x: 1408, y: 1010 },
      { kind: "label", name: label(mode, "MIRROR POND · Four flames raise the sunken sanctuary", "MIRROR POND sign"), x: 768, y: 1240 },
      { kind: "exit", name: "Return · E", ...maps.MIRROR_POND.points.back, mark: ">" },
    );
  }
  if (scene === "HEDGE_MAZE") {
    const maze = hedgeMazeState(w.puzzles);
    if (maze && !maze.burned)
      props.push({
        kind: "object",
        name: label(mode, "FIREBALL · dry hedge", "dry amber hedge"),
        x: mazeBurnBush.x + mazeBurnBush.w / 2,
        y: mazeBurnBush.y + mazeBurnBush.h / 2,
        mark: "o",
      });
    if (maze) {
      // HedgeMazeView draws the cow sprite where the cow is, and its label as
      // separate text fixed at (26, 27.7) that never moves or hides. The cow
      // itself carries no text (pilot-6 audit finding 3). The label floats over
      // open floor in the lane, so it gets no grid mark that would hide it.
      props.push({ kind: "creature", name: "cow", x: maze.cow.x, y: maze.cow.y, mark: "C" });
      props.push({
        kind: "object",
        name: label(mode, "Harmless cow · blocks the lane", "lane sign"),
        x: 26 * TILE,
        y: 27.7 * TILE,
      });
      if (!maze.runner.caught)
        props.push({
          kind: "creature",
          name: "FOREST WOLF · KEY",
          x: maze.runner.x,
          y: maze.runner.y,
          details: "carrying a key",
          mark: "C",
        });
    }
    props.push(
      { kind: "object", name: label(mode, "BLACK HOLE → grazing bay", "grazing bay"), x: 22.2 * TILE, y: 22.2 * TILE, mark: "o" },
      {
        kind: "object",
        name: label(mode, "E · key gate", "key gate"),
        x: 41 * TILE,
        y: 14 * TILE,
        details: w.puzzles.hedgeGate?.complete ? "open" : "closed",
        mark: "o",
      },
      {
        kind: "object",
        name: label(mode, "Slow Time + Super Speed · Chase the fleeing key carrier · E to tag", "maze sign"),
        x: 25 * TILE,
        y: 2.3 * TILE,
        mark: "o",
      },
      { kind: "exit", name: "E · RETURN", ...maps.HEDGE_MAZE.points.back, mark: ">" },
    );
  }
  if (scene === "GRIFFIN_ENCLOSURE") {
    const g = griffinState(w.puzzles);
    if (g) {
      // GriffinView hides the griffin, its shadow and its label once it has
      // flown away (groomingStage DONE).
      if (g.groomingStage !== "DONE")
        props.push({
          kind: "creature",
          name: "griffin",
          x: g.x,
          y: g.y,
          details: griffinLabel(g, mode),
          mark: "C",
        });
      griffinPillars.forEach((r, i) =>
        props.push({
          kind: "object",
          name: "stone pillar",
          x: r.x + r.w / 2,
          y: r.y + r.h / 2,
          details: g.pillars[i] ? "broken" : "standing",
          mark: g.pillars[i] ? "o" : "#",
        }),
      );
      if (g.wigDropped && !g.wigClaimed)
        // The status label stays visible at the nest while the wig lies there.
        props.push({ kind: "object", name: "wig", ...griffinNest, details: griffinLabel(g, mode), mark: "o" });
    }
    props.push({ kind: "exit", name: "E · RETURN", ...maps.GRIFFIN_ENCLOSURE.points.back, mark: ">" });
  }
  return props;
}

const enemyNames: Record<string, string> = {
  mossling: "mossling",
  cinder_wisp: "cinder wisp",
  ironbound_sentinel: "ironbound sentinel",
};

export interface PerceptionOptions {
  labels: LabelMode;
}

/** The observation for one hero. Pure: reads the room, writes nothing. */
export function perceive(
  room: GameRoom,
  player: PlayerId,
  playerKey: string,
  memory: PlayerMemory,
  options: PerceptionOptions,
): Observation {
  const w = room.state;
  const me = w.players[playerKey];
  const role = me.role!;
  const scene = sceneOf(w, me);
  const map = maps[scene];
  const view = viewRect(w, me);
  const visible: VisibleThing[] = [];
  const marks: { x: number; y: number; mark: string }[] = [];
  /** Floor art cells, drawn before every other mark (people stand on it). */
  const floorMarks: { x: number; y: number; mark: string }[] = [];
  const counters: Record<string, number> = {};
  const add = (p: Prop) => {
    const f = p.floor;
    // Floor art is on screen while any part of it is.
    const shown = f
      ? f.x < view.x + view.w + VIEW_PAD && f.x + f.w > view.x - VIEW_PAD && f.y < view.y + view.h + VIEW_PAD && f.y + f.h > view.y - VIEW_PAD
      : inRect(p, view, VIEW_PAD);
    if (!shown) return;
    const n = (counters[p.kind] = (counters[p.kind] ?? 0) + 1);
    const dx = p.x - me.x,
      dy = p.y - me.y,
      d = Math.hypot(dx, dy);
    // Things that move are listed like `self`: truncated to two decimals, so
    // the whole part is the cell their mark is drawn in (independent review
    // finding 3). Fixed signs, objects and exits keep one decimal.
    const coordinate = MOVING_KINDS.has(p.kind) ? truncate2 : round1;
    visible.push({
      ref: `${p.kind}-${n}`,
      kind: p.kind,
      name: p.name,
      x: coordinate(p.x / TILE),
      y: coordinate(p.y / TILE),
      distance: round1(d / TILE),
      direction: d < TILE / 2 ? "here" : directionOf(Math.atan2(dy, dx)),
      ...(p.details ? { details: p.details } : {}),
      ...(f ? { extent: { x: round1(f.x / TILE), y: round1(f.y / TILE), w: round1(f.w / TILE), h: round1(f.h / TILE) } } : {}),
    });
    if (p.mark && f)
      for (let y = f.y + TILE / 2; y < f.y + f.h; y += TILE)
        for (let x = f.x + TILE / 2; x < f.x + f.w; x += TILE) floorMarks.push({ x, y, mark: p.mark });
    else if (p.mark) marks.push({ x: p.x, y: p.y, mark: p.mark });
  };

  // Partner: drawn with a health bar whenever on the same map and on screen.
  for (const q of Object.values(w.players))
    if (q.id !== me.id && q.role && sceneOf(w, q) === scene) {
      const status = [healthBar(q.hp, q.maxHp)];
      if ((q.flightRemaining ?? 0) > 0) status.push("flying");
      if ((q.sprintRemaining ?? 0) > 0) status.push("super speed");
      if (q.actionState && q.actionState !== "idle") status.push(q.actionState);
      add({ kind: "partner", name: heroName(q.role), x: q.x, y: q.y, details: status.join(", "), mark: "P" });
    }
  // Monsters live on the party's map.
  if (scene === w.sceneId)
    for (const e of Object.values(w.enemies)) {
      if (e.state === "DEAD") continue;
      add({
        kind: "enemy",
        name: enemyNames[e.type] ?? e.type,
        x: e.x,
        y: e.y,
        // "attacking": the attack animation is a visible telegraph. Whether a
        // monster is passive is not drawn, so it is not reported.
        details: `${healthBar(e.hp, e.maxHp)}${e.state === "ATTACK" ? ", attacking" : ""}`,
        mark: "E",
      });
    }
  for (const q of Object.values(w.projectiles))
    if ((q.sceneId ?? w.sceneId) === scene)
      add({
        kind: "projectile",
        name:
          q.effect === "golem_beam"
            ? "beam"
            : q.faction === "enemies"
              ? "enemy projectile"
              : q.fireballLevel
                ? "fireball"
                : "projectile",
        x: q.x,
        y: q.y,
        details: `moving ${directionOf(Math.atan2(q.vy, q.vx))}`,
        mark: "*",
      });
  for (const h of Object.values(w.blackHoles ?? {}))
    if (h.sceneId === scene)
      add({ kind: "effect", name: "black hole", x: h.x, y: h.y, details: h.phase, mark: "*" });
  // Inventory targets the world draws (chests, gates, offering points).
  for (const t of Object.values(w.inventoryTargets ?? {})) {
    if (t.sceneId !== scene || (t.x === 0 && t.y === 0)) continue;
    // Drawn as scene props (the statue, the gate, the wolf) instead.
    if (t.id === SHRINE_OFFERING || t.id === MAZE_GATE_TARGET || t.id === MAZE_RUNNER_TARGET) continue;
    // The chest sits on the sanctuary, which is under water until it rises.
    if (t.id === POND_CHEST_TARGET && !mirrorPondState(w.puzzles)?.raised) continue;
    const opened = w.inventory?.claimed.includes(t.id);
    add({
      kind: "object",
      name: targetName(options.labels, t.name),
      x: t.x,
      y: t.y,
      ...(t.kind === "chest" ? { details: opened ? "open" : "closed" } : {}),
      mark: "o",
    });
  }
  for (const p of sceneProps(w, scene, options.labels)) add(p);

  // The screen as a tile grid.
  const walls = collisionRects(scene, w.puzzles, w.pushableOffsets, w.bridgePuzzle, w.players, w.serverTick, role);
  const ox = Math.floor(view.x / TILE),
    oy = Math.floor(view.y / TILE);
  const cols = Math.ceil(VIEW_W / TILE),
    rows = Math.ceil(VIEW_H / TILE);
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const line: string[] = [];
    for (let c = 0; c < cols; c++) {
      const cx = (ox + c + 0.5) * TILE,
        cy = (oy + r + 0.5) * TILE;
      if (cx > map.width || cy > map.height || cx < 0 || cy < 0) {
        line.push(" ");
        continue;
      }
      const hit = walls.find((rect) => inRect({ x: cx, y: cy }, rect));
      line.push(!hit ? "." : hit.terrain ? "~" : "#");
    }
    grid.push(line);
  }
  const put = (x: number, y: number, ch: string) => {
    const c = Math.floor(x / TILE) - ox,
      r = Math.floor(y / TILE) - oy;
    if (r >= 0 && r < rows && c >= 0 && c < cols) grid[r][c] = ch;
  };
  for (const m of [...floorMarks, ...marks]) put(m.x, m.y, m.mark);
  put(me.x, me.y, "@");

  // Explored outline of this area (4×4-tile blocks).
  const explored = memory.explored.get(scene) ?? new Set<string>();
  const block = TILE * 4;
  const exploredRows: string[] = [];
  for (let y = 0; y * block < map.height; y++) {
    let line = "";
    for (let x = 0; x * block < map.width; x++) {
      const here = Math.floor(me.x / block) === x && Math.floor(me.y / block) === y;
      line += here ? "@" : explored.has(`${x},${y}`) ? "." : "?";
    }
    exploredRows.push(line);
  }

  // Dialogue: the client's own storyView picks the line, speaker and choices.
  const story = storyView(w, role);
  const dialogue = story
    ? {
        speaker: story.speaker,
        text: story.text,
        canAdvance: story.reader && !story.held && !story.choices,
        ...(story.watching
          ? { waiting: `Watching ${heroName(role === "OATH" ? "EMBER" : "OATH")}…` }
          : story.chosen
            ? { waiting: "Waiting for your partner to choose…" }
            : story.held
              ? { waiting: "The scene is still playing…" }
              : // A choosing line is this hero's own decision, not the partner's line.
                !story.reader && !story.choices
                ? { waiting: "Your partner's line." }
                : {}),
        ...(story.choices
          ? { choices: story.choices.map((c, i) => ({ option: i + 1, text: c.text })) }
          : {}),
      }
    : null;

  const log = questLog(w);
  const bag = w.inventory;
  const owned = (Object.keys(items) as ItemId[]).filter((id) => (bag?.counts[id] ?? 0) > 0);
  const near = nearbyTarget(w, me);

  const status: string[] = [];
  if ((me.flightRemaining ?? 0) > 0) status.push(`flying (${Math.ceil(me.flightRemaining!)}s left)`);
  if ((me.sprintRemaining ?? 0) > 0) status.push(`super speed (${Math.ceil(me.sprintRemaining!)}s left)`);
  if (w.slowTime) status.push("time is slowed");
  if (me.actionState && me.actionState !== "idle") status.push(me.actionState);
  if (story && !story.watching) status.push("in a story scene (movement paused)");

  return {
    player,
    hero: heroName(role) as "Sieg" | "Coco",
    tick: w.serverTick,
    seconds: round1(w.serverTick / 60),
    area: {
      name: areaName(scene),
      widthTiles: Math.ceil(map.width / TILE),
      heightTiles: Math.ceil(map.height / TILE),
    },
    self: {
      x: truncate2(me.x / TILE),
      y: truncate2(me.y / TILE),
      facing: directionOf(me.facing),
      hp: Math.round(me.hp),
      maxHp: me.maxHp,
      status,
    },
    abilities: abilityBar(w, me),
    screen: { originX: ox, originY: oy, rows: grid.map((r) => r.join("")) },
    visible,
    dialogue,
    journal: {
      ...(log.current
        ? { current: { quest: log.current.name, step: log.current.step, done: log.current.done } }
        : {}),
      completed: log.completed.map((q) => q.name),
    },
    inventory: {
      items: owned.map((id) => ({
        id,
        name: items[id].name,
        count: bag!.counts[id]!,
        description: items[id].description,
      })),
      ...(near ? { nearbyTarget: { id: "nearby", name: targetName(options.labels, near.name) } } : {}),
    },
    discovered: { areas: [...memory.areas], exploredRows },
    dialogueLog: memory.dialogue.map((d) => ({ ...d })),
    feedback: [...memory.feedback],
    messages: memory.messages.slice(-6),
  };
}

/** The bottom ability bar plus J/K, with the states its icons show. */
export function abilityBar(w: World, p: Player) {
  const cd = (k: string) => p.cooldowns[k] ?? 0;
  const state = (active: number, cooldown: number, activeWord = "active") =>
    active > 0
      ? `${activeWord} (${Math.ceil(active)}s)`
      : cooldown > 0
        ? `recharging (${Math.ceil(cooldown)}s)`
        : "ready";
  if (p.role === "OATH")
    return [
      { key: "J", name: "Sword", state: cd("attack") > 0 ? "recovering" : "ready" },
      { key: "K", name: "Guard", state: "hold" },
      { key: "1", name: "Push", state: "hold" },
      ...(p.unlockedSkills.includes("dash")
        ? [{ key: "2", name: "Super Speed", state: state(p.sprintRemaining ?? 0, cd("sprint")) }]
        : []),
    ];
  return [
    { key: "J", name: "Fireball", state: cd("attack") > 0 ? "recovering" : "ready" },
    { key: "K", name: "Ward", state: "hold" },
    ...(p.unlockedSkills.includes("slow_time")
      ? [{
          key: "1",
          name: "Slow Time",
          state: state(w.slowTime?.owner === p.id ? (w.slowTime.endsTick - w.serverTick) / 60 : 0, cd("slow_time")),
        }]
      : []),
    ...(p.unlockedSkills.includes("flight")
      ? [{ key: "2", name: "Flight", state: state(p.flightRemaining ?? 0, cd("flight"), "flying") }]
      : []),
    ...(p.unlockedSkills.includes("black_hole")
      ? [{ key: "3", name: "Black Hole", state: state(0, cd("black_hole")) }]
      : []),
  ];
}
