import { DT, ticksFor } from "../../../packages/shared/src/constants.js";
import type {
  Player,
  SceneId,
  World,
} from "../../../packages/shared/src/gameTypes.js";
import { spawnEnemy } from "../../../packages/shared/src/enemies.js";
import { maps } from "../../../packages/shared/src/maps.js";
import { composedScenes } from "../../../packages/shared/src/composedScenes.js";
import {
  AMBUSH_HP_FLOOR,
  AMBUSH_RESCUE_HP,
  AMBUSH_SECONDS,
  CART_REACH,
  aldenAtShop,
  ambushEnemies,
  cutscenes,
  lineReaders,
  prologueEnd,
  prologueStart,
  reachedRoadFork,
} from "../../../packages/shared/src/prologue.js";
import { damageEnemy } from "./enemySimulation.js";

// Runs the Chapter 0 prologue script. Every stage change happens here, on the
// server tick or on a validated "read this line" request, so both heroes always
// see the same scene and no event can fire twice.

/** Once one hero has read a line, the partner gets this long before it moves on. */
export const STORY_PARTNER_WAIT_TICKS = ticksFor(8);
/** Alden's walking pace in world units per second. */
const ALDEN_SPEED = 80;

/** What the story needs from the room: moving heroes and whole-party travel. */
export interface StoryHost {
  relocate(p: Player, scene: SceneId, at: { x: number; y: number }): void;
  /** Move the party's shared scene (enemies, room map) somewhere new. */
  travel(scene: SceneId): void;
}

/** The room-level scene a location belongs to (the shop is the house's). */
const roomScene = (scene: SceneId): SceneId =>
  scene === "HOUSE_INTERIOR" || scene === "HOUSE_UPPER" ? "MAIN_HOUSE" : scene;

export function beginPrologue(w: World, host: StoryHost) {
  w.story = {
    stage: "ARRIVAL",
    flags: [],
    alden: { ...aldenAtShop, action: "idle" },
  };
  for (const p of Object.values(w.players)) {
    if (!p.role) continue;
    const start = prologueStart[p.role];
    host.relocate(p, start.scene, start);
    p.facing = start.facing;
  }
}

/** Heroes stand still, and cannot fight or use doors, while a scene plays. */
export const storyLocked = (w: World) => !!w.story?.cutscene;

/** During the ambush the heroes cannot fall: Alden is coming. */
export function ambushProtects(w: World, p: Player) {
  return (
    !!w.story &&
    ["AMBUSH", "FIGHT"].includes(w.story.stage) &&
    p.sceneId === "PROLOGUE_CLEARING"
  );
}
export const AMBUSH_FLOOR = AMBUSH_HP_FLOOR;

function travelTo(w: World, host: StoryHost, scene: SceneId) {
  if (w.sceneId !== scene) host.travel(scene);
  const floor = (composedScenes as Record<string, { name: string }>)[scene];
  if (floor) w.checkpoint = floor.name;
  else if (scene === "MAIN_HOUSE") w.checkpoint = "Main house";
}

export function startCutscene(w: World, id: string, host: StoryHost) {
  const story = w.story,
    scene = cutscenes[id];
  if (!story || !scene || story.cutscene) return;
  travelTo(w, host, roomScene(scene.scene));
  story.cutscene = { id, line: -1, acks: [], since: w.serverTick };
  if (scene.alden) story.alden = { ...scene.alden, action: "idle" };
  for (const p of Object.values(w.players)) {
    if (!p.role) continue;
    const at = scene.placement[p.role];
    host.relocate(p, at.scene ?? scene.scene, at);
    p.facing = at.facing;
  }
  if (id === "ambush") spawnAmbush(w);
  nextLine(w, host);
}

function spawnAmbush(w: World) {
  w.enemies = Object.fromEntries(
    ambushEnemies.map((e) => {
      const enemy = spawnEnemy(e.id, e.type, e.x, e.y);
      enemy.passive = true; // they hold still until the scene ends
      return [e.id, enemy];
    }),
  );
}

function freezeAmbush(w: World) {
  for (const e of Object.values(w.enemies)) {
    e.passive = true;
    e.attackStartedTick = null;
    e.state = e.state === "DEAD" ? "DEAD" : "IDLE";
  }
  for (const [id, q] of Object.entries(w.projectiles))
    if (q.faction === "enemies" || q.effect === "golem_beam")
      delete w.projectiles[id];
}

function nextLine(w: World, host: StoryHost) {
  const story = w.story!,
    run = story.cutscene!,
    scene = cutscenes[run.id];
  run.line++;
  run.acks = [];
  run.since = w.serverTick;
  delete run.firstAck;
  const line = scene.lines[run.line];
  if (!line) return endCutscene(w, host);
  const alden = story.alden;
  if (alden) {
    if (alden.action === "cast") alden.action = "idle";
    if (line.aldenFacing) alden.facing = line.aldenFacing;
    if (line.cue === "alden-enter" && scene.aldenTarget) {
      alden.target = { ...scene.aldenTarget };
      alden.action = "walk";
    }
    if (line.cue === "alden-cast") {
      delete alden.target;
      alden.facing = "south";
      alden.action = "cast";
    }
  }
  // The spell lands: every monster in the clearing falls on the same tick.
  if (line.cue === "flash")
    for (const e of Object.values(w.enemies))
      if (e.state !== "DEAD") damageEnemy(e, e.hp, w.serverTick);
  // A line meant only for a hero who is not in the room reads itself.
  const readers = lineReaders(
    line,
    Object.values(w.players).map((p) => p.role),
  );
  if (!readers.length) nextLine(w, host);
}

function endCutscene(w: World, host: StoryHost) {
  const story = w.story!,
    scene = cutscenes[story.cutscene!.id];
  delete story.cutscene;
  if (!story.flags.includes(scene.flag)) story.flags.push(scene.flag);
  story.stage = scene.next;
  if (scene.id === "ambush") {
    for (const e of Object.values(w.enemies)) e.passive = false;
    story.fightStart = w.serverTick;
  }
  if (scene.id === "rescue")
    for (const p of Object.values(w.players)) p.hp = p.maxHp;
  if (scene.id === "morning") {
    story.alden = { ...aldenAtShop, action: "idle" };
    for (const p of Object.values(w.players)) {
      if (!p.role) continue;
      const end = prologueEnd[p.role];
      host.relocate(p, end.scene, end);
      p.facing = end.facing;
    }
  }
  if (scene.chain) startCutscene(w, scene.chain, host);
}

/**
 * A hero has finished reading a line. Stale or repeated requests are ignored,
 * so double presses and late packets can never skip a line.
 */
export function readLine(
  w: World,
  host: StoryHost,
  playerId: string,
  id: string,
  line: number,
) {
  const run = w.story?.cutscene,
    p = w.players[playerId];
  if (!run || !p?.role || run.id !== id || run.line !== line) return false;
  const current = cutscenes[id].lines[line];
  if (current.audience && current.audience !== p.role) return false;
  if (!run.acks.includes(playerId)) run.acks.push(playerId);
  run.firstAck ??= w.serverTick;
  const players = Object.values(w.players);
  // While a partner is away the scene waits for them.
  if (players.some((q) => !q.connected)) return true;
  const waiting = players.filter(
    (q) =>
      (!current.audience || q.role === current.audience) &&
      !run.acks.includes(q.id),
  );
  if (!waiting.length) nextLine(w, host);
  return true;
}

function walkAlden(w: World) {
  const alden = w.story?.alden;
  if (!alden?.target) return;
  const dx = alden.target.x - alden.x,
    dy = alden.target.y - alden.y,
    d = Math.hypot(dx, dy),
    step = ALDEN_SPEED * DT;
  if (d <= step) {
    Object.assign(alden, alden.target);
    delete alden.target;
    if (alden.action === "walk") alden.action = "idle";
    return;
  }
  alden.x += (dx / d) * step;
  alden.y += (dy / d) * step;
  alden.facing =
    Math.abs(dx) > Math.abs(dy)
      ? dx < 0
        ? "west"
        : "east"
      : dy < 0
        ? "north"
        : "south";
}

/** Story triggers and timers, evaluated once per (unpaused) server tick. */
export function tickStory(w: World, host: StoryHost) {
  const story = w.story;
  if (!story) return;
  walkAlden(w);
  const run = story.cutscene;
  if (run) {
    if (
      run.firstAck !== undefined &&
      w.serverTick - run.firstAck >= STORY_PARTNER_WAIT_TICKS
    )
      nextLine(w, host);
    return;
  }
  const players = Object.values(w.players);
  const cart = maps.PROLOGUE_TRAIL.points.cart;
  if (
    story.stage === "ARRIVAL" &&
    players.some((p) => p.role === "OATH" && p.sceneId === "HOUSE_INTERIOR")
  )
    startCutscene(w, "visit", host);
  else if (
    story.stage === "LEAVING" &&
    players.some((p) => p.sceneId === "MAIN_HOUSE" && reachedRoadFork(p))
  )
    startCutscene(w, "fork", host);
  else if (
    story.stage === "TRAIL" &&
    !story.flags.includes("prologue.cart") &&
    players.some(
      (p) =>
        p.sceneId === "PROLOGUE_TRAIL" &&
        Math.hypot(p.x - cart.x, p.y - cart.y) <= CART_REACH,
    )
  )
    startCutscene(w, "cart", host);
  else if (story.stage === "AMBUSH") startCutscene(w, "ambush", host);
  else if (story.stage === "FIGHT") {
    const alive = Object.values(w.enemies).filter((e) => e.state !== "DEAD");
    if (
      players.some((p) => p.hp <= AMBUSH_RESCUE_HP) ||
      w.serverTick - (story.fightStart ?? w.serverTick) >=
        ticksFor(AMBUSH_SECONDS) ||
      !alive.length
    ) {
      freezeAmbush(w);
      startCutscene(w, "rescue", host);
    }
  }
}

/**
 * E at a road the story controls. Returns true when the story handled it
 * (the hero travelled, or the way is closed for now).
 */
export function storyTravel(
  w: World,
  host: StoryHost,
  scene: SceneId,
  point: string,
) {
  const story = w.story;
  if (!story || story.stage === "DONE") return false;
  if (scene === "MAIN_HOUSE" && point === "shrine") {
    if (story.stage !== "FOREST_BOUND") return true;
    travelTo(w, host, "PROLOGUE_TRAIL");
    story.stage = "TRAIL";
    const spawn = maps.PROLOGUE_TRAIL.spawn;
    Object.values(w.players).forEach((p, i) =>
      host.relocate(p, "PROLOGUE_TRAIL", { x: spawn.x, y: spawn.y + i * 36 }),
    );
    return true;
  }
  if (scene === "MAIN_HOUSE" && point === "exit") return true;
  if (scene === "PROLOGUE_TRAIL" && point === "exit") {
    if (!story.flags.includes("prologue.cart")) return true;
    travelTo(w, host, "PROLOGUE_CLEARING");
    story.stage = "AMBUSH";
    return true;
  }
  return false;
}

/** Road exits the prologue keeps closed (also while E is held down). */
export function prologueBlocksExit(w: World, scene: SceneId, point: string) {
  if (!w.story || w.story.stage === "DONE") return false;
  return scene === "MAIN_HOUSE" && (point === "exit" || point === "shrine");
}
