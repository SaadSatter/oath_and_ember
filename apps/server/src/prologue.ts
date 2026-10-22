import {
  DT,
  SPEED,
  ticksFor,
} from "../../../packages/shared/src/constants.js";
import type {
  Player,
  SceneId,
  World,
} from "../../../packages/shared/src/gameTypes.js";
import { spawnEnemy } from "../../../packages/shared/src/enemies.js";
import { collisionRects, maps } from "../../../packages/shared/src/maps.js";
import { npcPose, npcs } from "../../../packages/shared/src/npcs.js";
import type { Role } from "../../../packages/shared/src/gameTypes.js";
import { composedScenes } from "../../../packages/shared/src/composedScenes.js";
import {
  AMBUSH_HP_FLOOR,
  AMBUSH_MAX,
  AMBUSH_OPENING,
  AMBUSH_RESCUE_HP,
  AMBUSH_RISE_SECONDS,
  AMBUSH_REACH,
  AMBUSH_SECONDS,
  CART_REACH,
  ambushEntries,
  aldenAtShop,
  ambushEnemies,
  castOf,
  cutscenes,
  lineReaders,
  prologueEnd,
  prologueStart,
  reachedRoadFork,
  storyLineHeld,
} from "../../../packages/shared/src/prologue.js";
import {
  DISCOVERY_REACH,
  FUNERAL,
  GLANCE_X,
  HOMECOMING_REACH,
  DECISION_REACH,
  JOURNAL_FLAGS,
  SHRINE_QUEST,
  SPOT_REACH,
  graveFront,
  cluesGathered,
  compartmentOpen,
  funeralReady,
  spotsFor,
  STRANGER_REACH,
  errandComplete,
  offstageFor,
  shopDoor,
  storyTalk,
} from "../../../packages/shared/src/chapter0.js";
import { BAG_FLAG } from "../../../packages/shared/src/storyProps.js";
import { roadsOpen } from "../../../packages/shared/src/chapter0Finale.js";
import { everyoneChose, tickFinale } from "./chapter0Finale.js";
import type { ItemId } from "../../../packages/shared/src/items.js";
import { damageEnemy } from "./enemySimulation.js";
import { castDragon } from "../../../packages/shared/src/waterDragon.js";
import {
  WALK_ARRIVE,
  WALK_BODY,
  WALK_LEAD,
} from "../../../packages/shared/src/storyWalk.js";

// Runs the Chapter 0 prologue script. Every stage change happens here, on the
// server tick or on a validated "read this line" request, so both heroes always
// see the same scene and no event can fire twice.

/** Alden's walking pace in world units per second. */
const ALDEN_SPEED = 80;
/**
 * Heroes in the scene's map walk to their mark before its first line, from
 * wherever they are; a hero on another map is moved there. A walk that takes
 * far longer than its distance needs finishes in place...
 */
const walkTicks = (distance: number) =>
  ticksFor((distance / SPEED) * 2 + 2);
/** No scene waits longer than this for its cast to walk in. */
const STAGING_TICKS = ticksFor(12);
/** ...as does one stuck behind something for this long. */
const WALK_STUCK_TICKS = ticksFor(0.75);
const BODY = WALK_BODY;
/** Server-only walk bookkeeping (progress checks), per player. */
const walkProgress = new WeakMap<
  World,
  Map<string, { x: number; y: number; still: number; until: number }>
>();

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

/**
 * Heroes in a playing scene stand still, and cannot fight or use doors; so
 * does a hero the story has put offstage (watching their partner).
 */
export function storyLocked(w: World, p: Player) {
  const story = w.story;
  if (!story || !p.role) return false;
  const run = story.cutscene;
  if (run && castOf(cutscenes[run.id]).includes(p.role)) return true;
  return !!offstageFor(story, p.role);
}

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

/**
 * Start a scene. `by` is the hero whose own movement set it off: unless the
 * scene is `exact`, they stop where they are, and the rest of the cast take
 * their places around them in the scene's arrangement.
 */
export function startCutscene(
  w: World,
  id: string,
  host: StoryHost,
  by?: Player,
  /** A villager the hero started this scene by talking to. */
  villager?: string,
) {
  const story = w.story,
    scene = cutscenes[id];
  if (!story || !scene || story.cutscene) return;
  // A scene for the whole party brings the party there; one with a smaller
  // cast, or a conversation (which gathers the heroes itself), leaves the
  // party's scene where it is.
  if (!scene.cast && !scene.talkTo) travelTo(w, host, roomScene(scene.scene));
  story.cutscene = { id, line: -1, acks: [], since: w.serverTick };
  const talkingTo = scene.talkTo ?? scene.meet?.npc ?? villager;
  if (talkingTo) story.cutscene.villager = talkingTo;
  if (scene.alden)
    story.alden = { ...scene.alden, action: scene.aldenAction ?? "idle" };
  // The stranger is there from the start, unless a line has her appear.
  if (
    scene.stranger &&
    !scene.lines.some((line) => line.cue === "stranger-appear")
  )
    story.stranger = { ...scene.stranger };
  if (scene.aldenGone) delete story.alden;
  delete story.walks;
  const progress = new Map<
    string,
    { x: number; y: number; still: number; until: number }
  >();
  walkProgress.set(w, progress);
  const sceneOf = (at: { scene?: SceneId }) => at.scene ?? scene.scene;
  const byMark = by?.role ? scene.placement[by.role] : undefined;
  const around =
    !scene.exact && !!by && !!byMark && by.sceneId === sceneOf(byMark);
  const start = w.serverTick + WALK_LEAD;
  for (const p of Object.values(w.players)) {
    const at = p.role && scene.placement[p.role];
    if (!at) continue;
    const target = sceneOf(at);
    // Anyone on another map is brought there; everyone else walks.
    if (p.sceneId !== target) {
      host.relocate(p, target, at);
      p.facing = at.facing;
      continue;
    }
    const walk: NonNullable<typeof story.walks>[string] = {
      x: at.x,
      y: at.y,
      facing: at.facing,
      start,
    };
    if (around && p === by) walk.pending = "stay";
    else if (around && byMark && sceneOf(byMark) === target) {
      // The partner's mark is decided once the hero who set it off has
      // stopped, and they set out a moment later, so their screen knows it.
      walk.pending = { beside: by!.id, dx: at.x - byMark.x, dy: at.y - byMark.y };
      walk.start = start + WALK_LEAD;
    }
    (story.walks ??= {})[p.id] = walk;
    progress.set(p.id, {
      x: p.x,
      y: p.y,
      still: 0,
      until:
        walk.start + walkTicks(Math.hypot(p.x - at.x, p.y - at.y) + 200),
    });
  }
  if (scene.meet) meetVillager(w, scene.meet.npc, scene.meet.role);
  if (scene.talkTo && by) talkTogether(w, host, scene.talkTo, by, start);
  else if (villager && by) faceVillager(w, villager, by, start);
  if (id === "ambush") spawnAmbush(w);
  if (!story.walks) nextLine(w, host);
}

/**
 * A conversation either hero started with a villager: the villager stops and
 * turns to them, the hero who spoke stays where they are, and the partner
 * comes to stand beside them (walking, or brought from another map).
 */
function talkTogether(
  w: World,
  host: StoryHost,
  npcId: string,
  by: Player,
  start: number,
) {
  const npc = npcs.find((n) => n.id === npcId);
  if (!npc) return;
  const pose = npcPose(npc, w.serverTick, w);
  w.npcTalks ??= {};
  w.npcTalks[npc.id] = {
    since: w.serverTick,
    listeners: Object.keys(w.players),
  };
  const story = w.story!,
    progress = walkProgress.get(w)!;
  const toward = (p: { x: number; y: number }) =>
    Math.atan2(pose.y - p.y, pose.x - p.x);
  story.walks ??= {};
  story.walks[by.id] = {
    x: by.x,
    y: by.y,
    facing: toward(by),
    start,
    pending: "stay",
  };
  progress.set(by.id, { x: by.x, y: by.y, still: 0, until: start + walkTicks(200) });
  const partner = Object.values(w.players).find((p) => p.id !== by.id);
  if (!partner) return;
  // Beside the speaker, across from the villager: left, right, or behind.
  const d = Math.hypot(by.x - pose.x, by.y - pose.y) || 1,
    ux = (by.x - pose.x) / d,
    uy = (by.y - pose.y) / d;
  const scene = by.sceneId ?? w.sceneId;
  const spot =
    [
      { x: by.x - uy * 40, y: by.y + ux * 40 },
      { x: by.x + uy * 40, y: by.y - ux * 40 },
      { x: by.x + ux * 40, y: by.y + uy * 40 },
    ].find((s) => bodyFits(w, scene, s)) ?? { x: by.x, y: by.y + 40 };
  if (partner.sceneId === scene) {
    story.walks[partner.id] = {
      ...spot,
      facing: toward(spot),
      start: start + WALK_LEAD,
    };
    progress.set(partner.id, {
      x: partner.x,
      y: partner.y,
      still: 0,
      until:
        start +
        WALK_LEAD +
        walkTicks(Math.hypot(partner.x - spot.x, partner.y - spot.y) + 200),
    });
  } else {
    // On another map: brought to the conversation.
    host.relocate(partner, scene, spot);
    partner.facing = toward(spot);
  }
}

/**
 * A hero talks to a villager on their own (the errand stalls): the villager
 * stops and turns to them, and the hero stays put, turned toward the villager.
 */
function faceVillager(w: World, npcId: string, by: Player, start: number) {
  const npc = npcs.find((n) => n.id === npcId);
  if (!npc || (by.sceneId ?? w.sceneId) !== npc.scene) return;
  const pose = npcPose(npc, w.serverTick, w);
  w.npcTalks ??= {};
  w.npcTalks[npc.id] = { since: w.serverTick, listeners: [by.id] };
  (w.story!.walks ??= {})[by.id] = {
    x: by.x,
    y: by.y,
    facing: Math.atan2(pose.y - by.y, pose.x - by.x),
    start,
    pending: "stay",
  };
  walkProgress
    .get(w)
    ?.set(by.id, { x: by.x, y: by.y, still: 0, until: start + walkTicks(200) });
}

/** The villager in a conversation turns to whichever hero is speaking. */
function turnToSpeaker(w: World, npcId: string, speaker: string) {
  const role = speaker === "COCO" ? "EMBER" : speaker === "SIEG" ? "OATH" : null,
    talk = w.npcTalks?.[npcId],
    hero = role && Object.values(w.players).find((p) => p.role === role);
  if (!talk || !hero) return;
  talk.listeners = [hero.id, ...talk.listeners.filter((id) => id !== hero.id)];
}

/** Whether a hero's body fits at `at` in `scene`. */
function bodyFits(w: World, scene: SceneId, at: { x: number; y: number }) {
  return !collisionRects(scene, w.puzzles, w.pushableOffsets).some(
    (r) =>
      at.x + BODY > r.x &&
      at.x - BODY < r.x + r.w &&
      at.y + BODY > r.y &&
      at.y - BODY < r.y + r.h,
  );
}

/**
 * The hero walks up to a villager, who stops and turns to them (the same
 * pause as an ordinary conversation, released when the scene ends).
 */
function meetVillager(w: World, npcId: string, role: Role) {
  const npc = npcs.find((n) => n.id === npcId),
    p = Object.values(w.players).find((q) => q.role === role);
  if (!npc || !p || p.sceneId !== npc.scene) return;
  const pose = npcPose(npc, w.serverTick, w);
  w.npcTalks ??= {};
  w.npcTalks[npc.id] = { since: w.serverTick, listeners: [p.id] };
  const side = p.x <= pose.x ? -1 : 1,
    spot = { x: pose.x + side * 36, y: pose.y };
  if (!bodyFits(w, npc.scene, spot)) return;
  const start = w.serverTick + WALK_LEAD;
  w.story!.walks ??= {};
  w.story!.walks[p.id] = { ...spot, facing: side < 0 ? 0 : Math.PI, start };
  walkProgress.get(w)?.set(p.id, {
    x: p.x,
    y: p.y,
    still: 0,
    until: start + walkTicks(Math.hypot(p.x - spot.x, p.y - spot.y)),
  });
}

/** Let a villager the story stopped walk on from where they stood. */
function releaseVillager(w: World, npcId: string) {
  const talk = w.npcTalks?.[npcId];
  if (!talk) return;
  (w.npcOffsets ??= {})[npcId] =
    (w.npcOffsets[npcId] ?? 0) + Math.max(0, w.serverTick - talk.since);
  delete w.npcTalks![npcId];
}

export { storyWalkInput } from "../../../packages/shared/src/storyWalk.js";

/** Finish any walk that has arrived (or given up); returns true when all are done. */
function walksDone(w: World, host: StoryHost) {
  const story = w.story!,
    progress = walkProgress.get(w);
  // Decide the marks that wait on where a hero has stopped.
  for (const [id, walk] of Object.entries(story.walks ?? {})) {
    const p = w.players[id];
    if (walk.pending === "stay" && p && w.serverTick >= walk.start) {
      Object.assign(walk, { x: p.x, y: p.y });
      delete walk.pending;
    }
  }
  for (const [id, walk] of Object.entries(story.walks ?? {})) {
    const pending = walk.pending,
      p = w.players[id];
    if (!pending || pending === "stay" || !p) continue;
    const anchor = story.walks?.[pending.beside],
      ref = w.players[pending.beside];
    if (anchor?.pending) continue;
    if (ref) {
      const spot = { x: ref.x + pending.dx, y: ref.y + pending.dy };
      if (bodyFits(w, p.sceneId ?? w.sceneId, spot))
        Object.assign(walk, spot);
    }
    delete walk.pending;
    // They set out a moment after their mark is known, so their own screen
    // has it before the first step.
    walk.start = Math.max(walk.start, w.serverTick + WALK_LEAD);
    const seen = progress?.get(id);
    if (seen)
      seen.until =
        walk.start +
        walkTicks(Math.hypot(p.x - walk.x, p.y - walk.y) + 200);
  }
  for (const [id, walk] of Object.entries(story.walks ?? {})) {
    if (walk.pending) continue;
    const p = w.players[id],
      seen = progress?.get(id);
    if (!p) {
      delete story.walks![id];
      continue;
    }
    const left = Math.hypot(walk.x - p.x, walk.y - p.y);
    if (seen && w.serverTick > walk.start) {
      seen.still =
        Math.hypot(p.x - seen.x, p.y - seen.y) < 0.3 ? seen.still + 1 : 0;
      seen.x = p.x;
      seen.y = p.y;
    }
    const arrived = w.serverTick >= walk.start && left <= WALK_ARRIVE;
    const givenUp =
      !!seen && (seen.still > WALK_STUCK_TICKS || w.serverTick > seen.until);
    if (!arrived && !givenUp) continue;
    if (arrived) Object.assign(p, { x: walk.x, y: walk.y, vx: 0, vy: 0 });
    else host.relocate(p, p.sceneId ?? w.sceneId, walk);
    p.facing = walk.facing;
    p.movementIntent = { x: 0, y: 0 };
    delete story.walks![id];
    progress?.delete(id);
  }
  if (story.walks && !Object.keys(story.walks).length) delete story.walks;
  return !story.walks;
}

/**
 * The clearing is quiet until the heroes reach its middle. The first golem
 * and wisp come out of the bushes during the scene (the "ambush-emerge" cue);
 * the rest follow during the fight.
 */
function spawnAmbush(w: World) {
  w.enemies = {};
  w.story!.ambush = { raised: 0, nextTick: 0 };
}

/** A monster never takes a spot closer to a hero than this. */
const RISE_CLEARANCE = 140;
/**
 * Bring in one more monster: whichever kind is fewer (four golems and four
 * wisps at most), bound for the nearest free spot a safe distance from the
 * heroes. It pushes out of the bushes on that spot's side of the clearing and
 * walks there, held (passive) until it arrives.
 */
function raiseOne(w: World, rim = false, side?: "west" | "east") {
  const ambush = w.story!.ambush!;
  const alive = Object.values(w.enemies).filter((e) => e.state !== "DEAD");
  if (alive.length >= AMBUSH_MAX) return null;
  const count = (type: string) => alive.filter((e) => e.type === type).length;
  const type =
    count("ironbound_sentinel") <= count("cinder_wisp")
      ? "ironbound_sentinel"
      : "cinder_wisp";
  const heroes = Object.values(w.players).filter(
    (p) => p.sceneId === "PROLOGUE_CLEARING",
  );
  const half = maps.PROLOGUE_CLEARING.width / 2;
  const slot = ambushEnemies
    .filter((e) => e.type === type)
    .filter((e) => !side || (side === "west") === e.x < half)
    .map((e) => ({
      e,
      clearance: Math.min(
        ...alive.map((a) => {
          const at = a.march ?? a;
          return Math.hypot(at.x - e.x, at.y - e.y);
        }),
        Infinity,
      ),
      away: Math.min(
        ...heroes.map((h) => Math.hypot(h.x - e.x, h.y - e.y)),
        Infinity,
      ),
    }))
    // Never on top of another monster, nor on top of a hero; of the rest,
    // the nearest, so it rises where the heroes can see it.
    .sort(
      (a, b) =>
        Number(b.clearance > 40) - Number(a.clearance > 40) ||
        Number(b.away >= RISE_CLEARANCE) - Number(a.away >= RISE_CLEARANCE) ||
        (a.away >= RISE_CLEARANCE && !rim
          ? a.away - b.away
          : b.away - a.away),
    )[0].e;
  const id = `ambush-${ambush.raised++}`;
  const entries = slot.x < half ? ambushEntries.west : ambushEntries.east;
  const entry = [...entries].sort(
    (a, b) => Math.abs(a.y - slot.y) - Math.abs(b.y - slot.y),
  )[0];
  const enemy = spawnEnemy(id, slot.type, entry.x, entry.y);
  enemy.passive = true;
  enemy.march = { x: slot.x, y: slot.y };
  enemy.facing = Math.atan2(slot.y - entry.y, slot.x - entry.x);
  w.enemies[id] = enemy;
  return enemy;
}

/** Marching never holds a scene longer than this. */
const MARCH_TICKS = ticksFor(6);
/**
 * Just before Alden comes: the ambush fills to eight, and every monster walks
 * in to close a ring around the heroes, leaving the north open for him.
 */
function marchIn(w: World) {
  while (raiseOne(w, true)) {
    /* fill to eight from the clearing's rim */
  }
  const marks = [cutscenes.rescue.placement.OATH!, cutscenes.rescue.placement.EMBER!];
  const centre = {
    x: (marks[0].x + marks[1].x) / 2,
    y: (marks[0].y + marks[1].y) / 2,
  };
  const ring = Object.values(w.enemies)
    .filter((e) => e.state !== "DEAD")
    .map((e) => ({ e, angle: Math.atan2(e.y - centre.y, e.x - centre.x) }))
    .sort((a, b) => a.angle - b.angle);
  // Spread them over the ring, except a gap of 70 degrees at the top.
  const gap = (70 * Math.PI) / 180,
    first = -Math.PI / 2 + gap / 2,
    span = 2 * Math.PI - gap;
  // Rotate so the gap stays at the top whatever order they come in.
  ring.sort(
    (a, b) =>
      ((a.angle - first + 4 * Math.PI) % (2 * Math.PI)) -
      ((b.angle - first + 4 * Math.PI) % (2 * Math.PI)),
  );
  ring.forEach(({ e }, i) => {
    const a = first + (span * (i + 0.5)) / ring.length;
    const spot = {
      x: centre.x + Math.cos(a) * 190,
      y: centre.y + Math.sin(a) * 130,
    };
    e.passive = true;
    if (bodyFits(w, "PROLOGUE_CLEARING", spot)) e.march = spot;
  });
}
/** Every marching monster has arrived (or they are taking too long). */
function marchDone(w: World, since: number) {
  const marching = Object.values(w.enemies).filter((e) => e.march);
  if (!marching.length) return true;
  if (w.serverTick - since < MARCH_TICKS) return false;
  for (const e of marching) {
    Object.assign(e, e.march);
    delete e.march;
  }
  return true;
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
  const line = scene.lines[run.line];
  if (!line) return endCutscene(w, host);
  if (run.villager) turnToSpeaker(w, run.villager, line.speaker);
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
  if (line.cue === "alden-still" && alden) alden.action = "still";
  if (line.cue === "drop-bag" && !story.flags.includes(BAG_FLAG))
    story.flags.push(BAG_FLAG);
  if (line.cue === "stranger-vanish") delete story.stranger;
  if (line.cue === "stranger-appear" && scene.stranger)
    story.stranger = { ...scene.stranger };
  if (line.setFlag && !story.flags.includes(line.setFlag))
    story.flags.push(line.setFlag);
  if (line.give && w.inventory) {
    for (const [id, n] of Object.entries(line.give) as [ItemId, number][])
      w.inventory.counts[id] = (w.inventory.counts[id] ?? 0) + n;
    w.inventory.revision++;
  }
  if (line.take && w.inventory) {
    for (const [id, n] of Object.entries(line.take) as [ItemId, number][])
      w.inventory.counts[id] = Math.max(0, (w.inventory.counts[id] ?? 0) - n);
    w.inventory.revision++;
  }
  // As the narration has it: the golem from the west, the wisp from the east.
  if (line.cue === "ambush-emerge")
    for (let i = 0; i < AMBUSH_OPENING; i++)
      raiseOne(w, false, i % 2 ? "east" : "west");
  // Alden's water dragon rises; each monster dies as its jaws reach it.
  if (line.cue === "dragon")
    story.dragon = castDragon(
      w.serverTick,
      maps.PROLOGUE_CLEARING.points.centre,
      Object.values(w.enemies)
        .filter((e) => e.state !== "DEAD")
        .map((e) => ({ id: e.id, x: e.x, y: e.y })),
    );
  // A line meant only for a hero who is not in the room reads itself.
  const readers = lineReaders(
    line,
    Object.values(w.players).map((p) => p.role),
    castOf(scene),
  );
  if (!readers.length) nextLine(w, host);
}

function endCutscene(w: World, host: StoryHost) {
  const story = w.story!,
    scene = cutscenes[story.cutscene!.id],
    villager = story.cutscene!.villager;
  delete story.cutscene;
  // Items change hands once, however the scene came to be played.
  if (!story.flags.includes(scene.flag) && scene.gives && w.inventory) {
    for (const [id, n] of Object.entries(scene.gives) as [ItemId, number][])
      w.inventory.counts[id] = (w.inventory.counts[id] ?? 0) + n;
    w.inventory.revision++;
  }
  if (!story.flags.includes(scene.flag)) story.flags.push(scene.flag);
  story.stage = scene.next;
  if (scene.id === "ambush") {
    // Monsters still on their way in are released as they arrive.
    for (const e of Object.values(w.enemies)) if (!e.march) e.passive = false;
    story.fightStart = w.serverTick;
    story.ambush!.nextTick = w.serverTick + ticksFor(AMBUSH_RISE_SECONDS);
  }
  if (scene.meet) releaseVillager(w, scene.meet.npc);
  if (scene.talkTo) releaseVillager(w, scene.talkTo);
  if (villager) releaseVillager(w, villager);
  if (scene.id === "rescue") {
    for (const p of Object.values(w.players)) p.hp = p.maxHp;
    // Nothing the dragon was owed survives the scene.
    for (const e of Object.values(w.enemies))
      if (e.state !== "DEAD") damageEnemy(e, e.hp, w.serverTick);
    delete story.dragon;
  }
  if (scene.strangerLeaves) delete story.stranger;
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
  const cast = castOf(cutscenes[id]);
  if (!cast.includes(p.role)) return false;
  const current = cutscenes[id].lines[line];
  if (current.audience && current.audience !== p.role) return false;
  // A choosing line moves on once everyone has chosen (story:choose).
  if (current.choose) return false;
  // While a partner is away the scene waits for them.
  if (Object.values(w.players).some((q) => !q.connected)) return true;
  // Alden reaches his place before he casts, and his dragon finishes its
  // meal, before the story moves on.
  if (storyLineHeld(w.story!, current, w.serverTick)) return false;
  // One read is enough: whichever hero presses on first moves the line on
  // for both. (Private lines can only be moved on by their own hero.)
  run.acks.push(playerId);
  nextLine(w, host);
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
  // The dragon's jaws close on each monster at its appointed tick.
  for (const bite of story.dragon?.prey ?? []) {
    const e = w.enemies[bite.id];
    if (e && e.state !== "DEAD" && w.serverTick >= bite.at)
      damageEnemy(e, e.hp, w.serverTick);
  }
  // A hero offstage stays where the story put them (also after reconnecting).
  for (const p of Object.values(w.players)) {
    const away = offstageFor(story, p.role);
    if (
      away &&
      (p.sceneId !== away.scene ||
        Math.hypot(p.x - away.x, p.y - away.y) > 48)
    )
      host.relocate(p, away.scene, away);
  }
  const run = story.cutscene;
  if (run) {
    // A choosing line moves on once every hero in it has chosen.
    if (everyoneChose(w)) return nextLine(w, host);
    // Heroes walk into place first (and any monsters marching in); the first
    // line shows once everyone is there.
    if (run.line !== -1) return;
    if (walksDone(w, host) && marchDone(w, run.since)) nextLine(w, host);
    // Whatever happens on the way, a scene never waits on its walk-in for
    // long: anyone still walking (or marching) is set on their mark.
    else if (w.serverTick - run.since > STAGING_TICKS) {
      for (const [id, walk] of Object.entries(story.walks ?? {})) {
        const p = w.players[id];
        if (p) {
          host.relocate(p, p.sceneId ?? w.sceneId, walk);
          p.facing = walk.facing;
        }
      }
      delete story.walks;
      for (const e of Object.values(w.enemies))
        if (e.march) {
          Object.assign(e, e.march);
          delete e.march;
        }
      nextLine(w, host);
    }
    return;
  }
  const players = Object.values(w.players);
  const cart = maps.PROLOGUE_TRAIL.points.cart;
  if (
    story.stage === "ARRIVAL" &&
    players.some((p) => p.role === "OATH" && p.sceneId === "HOUSE_INTERIOR")
  )
    startCutscene(
      w,
      "visit",
      host,
      players.find((p) => p.role === "OATH"),
    );
  else if (
    story.stage === "LEAVING" &&
    players.some((p) => p.sceneId === "MAIN_HOUSE" && reachedRoadFork(p))
  )
    startCutscene(
      w,
      "fork",
      host,
      players.find((p) => p.sceneId === "MAIN_HOUSE" && reachedRoadFork(p)),
    );
  else if (
    story.stage === "TRAIL" &&
    !story.flags.includes("prologue.cart") &&
    players.some(
      (p) =>
        p.sceneId === "PROLOGUE_TRAIL" &&
        Math.hypot(p.x - cart.x, p.y - cart.y) <= CART_REACH,
    )
  )
    startCutscene(
      w,
      "cart",
      host,
      players.find(
        (p) =>
          p.sceneId === "PROLOGUE_TRAIL" &&
          Math.hypot(p.x - cart.x, p.y - cart.y) <= CART_REACH,
      ),
    );
  else if (story.stage === "AMBUSH") {
    // The clearing stays quiet until a hero walks into its middle.
    const centre = maps.PROLOGUE_CLEARING.points.centre;
    const there = players.find(
      (p) =>
        p.sceneId === "PROLOGUE_CLEARING" &&
        Math.hypot(p.x - centre.x, p.y - centre.y) <= AMBUSH_REACH,
    );
    if (there) startCutscene(w, "ambush", host, there);
  } else if (story.stage === "FIGHT") {
    // Monsters join the fight once they are out of the bushes.
    for (const e of Object.values(w.enemies))
      if (e.passive && !e.march && e.state !== "DEAD") e.passive = false;
    // One at a time: a new monster rises every few seconds, and each one
    // beaten is replaced, until eight stand together.
    const ambush = story.ambush;
    if (ambush && w.serverTick >= ambush.nextTick) {
      const alive = Object.values(w.enemies).filter(
        (e) => e.state !== "DEAD",
      ).length;
      if (alive < AMBUSH_MAX) {
        raiseOne(w);
        ambush.nextTick = w.serverTick + ticksFor(AMBUSH_RISE_SECONDS);
      }
    }
    // Beaten monsters are replaced, so the fight ends only one way: Alden.
    if (
      players.some((p) => p.hp <= AMBUSH_RESCUE_HP) ||
      w.serverTick - (story.fightStart ?? w.serverTick) >=
        ticksFor(AMBUSH_SECONDS)
    ) {
      freezeAmbush(w);
      marchIn(w);
      startCutscene(w, "rescue", host);
    }
  }
  // Chapter 0, Part 1.
  const coco = players.find((p) => p.role === "EMBER"),
    sieg = players.find((p) => p.role === "OATH");
  if (!coco || !sieg) return;
  const near = (p: Player, q: { x: number; y: number }, d: number) =>
    Math.hypot(p.x - q.x, p.y - q.y) <= d;
  if (
    story.stage === "ERRAND" &&
    errandComplete(story) &&
    !story.flags.includes(cutscenes["errand-done"].flag)
  )
    startCutscene(w, "errand-done", host);
  else if (
    story.stage === "HOMEWARD" &&
    coco.sceneId === "MAIN_HOUSE" &&
    Math.hypot(coco.x - shopDoor.x, coco.y - shopDoor.y) <= HOMECOMING_REACH
  )
    startCutscene(w, "homecoming", host, coco);
  else if (
    story.stage === "SILENT_SHOP" &&
    coco.sceneId === "HOUSE_INTERIOR" &&
    !story.flags.includes(cutscenes.silent.flag)
  )
    startCutscene(w, "silent", host);
  else if (
    story.stage === "SILENT_SHOP" &&
    coco.sceneId === "HOUSE_INTERIOR" &&
    story.alden?.scene === "HOUSE_INTERIOR" &&
    near(coco, story.alden, DISCOVERY_REACH)
  )
    startCutscene(w, "discovery", host, coco);
  else if (
    story.stage === "STRANGER" &&
    sieg.sceneId === "EMBERBROOK_VILLAGE" &&
    story.stranger &&
    near(sieg, story.stranger, STRANGER_REACH)
  )
    startCutscene(w, "stranger", host, sieg);
  else if (
    story.stage === "RUSHING" &&
    sieg.sceneId === "MAIN_HOUSE" &&
    !story.flags.includes(cutscenes.glance.flag) &&
    sieg.x < GLANCE_X
  )
    startCutscene(w, "glance", host, sieg);
  else if (
    story.stage === "RUSHING" &&
    sieg.sceneId === "MAIN_HOUSE" &&
    story.flags.includes(cutscenes.glance.flag) &&
    near(sieg, shopDoor, HOMECOMING_REACH)
  )
    startCutscene(w, "no-fire", host, sieg);
  else if (story.stage === "FINDING" && sieg.sceneId === "HOUSE_INTERIOR")
    startCutscene(w, "reunion", host, sieg);
  else if (
    story.stage === "FUNERAL_PREP" &&
    funeralReady(story) &&
    !story.flags.includes(FUNERAL.done)
  )
    startCutscene(w, "funeral", host);
  else if (
    story.stage === "INVESTIGATION" &&
    cluesGathered(story) &&
    !story.flags.includes(cutscenes["clues-done"].flag)
  )
    startCutscene(w, "clues-done", host);
  else if (
    story.stage === "JOURNAL" &&
    compartmentOpen(story) &&
    !story.flags.includes(JOURNAL_FLAGS.found)
  )
    startCutscene(w, "journal", host);
  else if (story.stage === "DECISION" && !story.flags.includes(SHRINE_QUEST)) {
    const first = [coco, sieg].find(
      (p) =>
        p.sceneId === "MAIN_HOUSE" && near(p, graveFront, DECISION_REACH),
    );
    if (first) startCutscene(w, "decision", host, first);
  }
  // Chapter 0's finale: the shrine road, the trials, the goddess.
  if (!story.cutscene)
    tickFinale(w, (id, by) => startCutscene(w, id, host, by), coco, sieg);
}

/**
 * E at a story spot (gathering stones and flowers, laying them, saying you are
 * ready): done once, by its own hero, when what it waits on is done. Returns
 * whether the story took the press.
 */
export function storyInteract(w: World, p: Player) {
  const story = w.story;
  if (!story) return false;
  const spot = spotsFor(story, p.role).find(
    (s) =>
      s.scene === p.sceneId && Math.hypot(s.x - p.x, s.y - p.y) <= SPOT_REACH,
  );
  if (!spot) return false;
  story.flags.push(spot.flag);
  if (w.inventory && (spot.gives || spot.take)) {
    for (const [id, n] of Object.entries(spot.gives ?? {}) as [ItemId, number][])
      w.inventory.counts[id] = (w.inventory.counts[id] ?? 0) + n;
    for (const [id, n] of Object.entries(spot.take ?? {}) as [ItemId, number][])
      w.inventory.counts[id] = Math.max(0, (w.inventory.counts[id] ?? 0) - n);
    w.inventory.revision++;
  }
  return true;
}

/**
 * A hero talks to a villager the story has a scene for: play it. Returns
 * whether the story took the conversation.
 */
export function storyConversation(
  w: World,
  host: StoryHost,
  p: Player,
  npcId: string,
) {
  const id = storyTalk(w.story, p.role, npcId, cutscenes);
  if (!id) return false;
  startCutscene(w, id, host, p, npcId);
  return true;
}

/** Story stages in which Coco walks the road to Emberbrook on her own. */
const errandStages = ["ERRAND", "HOMEWARD", "SILENT_SHOP"];
/** Stages in which each hero walks the shop road alone (party stays put). */
const soloRoadStages = [
  ...errandStages,
  "STRANGER",
  "RUSHING",
  "FINDING",
  "INVESTIGATION",
  "JOURNAL",
  "DECISION",
];

/** A door the story keeps shut for now (the hero simply stays put). */
export function storyBlocksDoor(w: World, p: Player, to: SceneId) {
  const story = w.story;
  if (!story || roadsOpen(story)) return false;
  // Sieg is upstairs at home while Coco runs the errand.
  if (to === "VILLAGE_COTTAGE" && errandStages.includes(story.stage))
    return true;
  // The homecoming plays at the door before Coco can open it; and Sieg
  // cannot walk in until Coco's last moments with Papa are over and he has
  // reached the door himself.
  if (
    to === "HOUSE_INTERIOR" &&
    ["HOMEWARD", "STRANGER", "RUSHING"].includes(story.stage)
  )
    return true;
  // Once inside, Coco does not leave until she has found him.
  if (
    p.sceneId === "HOUSE_INTERIOR" &&
    to === "MAIN_HOUSE" &&
    story.stage === "SILENT_SHOP"
  )
    return true;
  return false;
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
  p: Player,
) {
  const story = w.story;
  if (!story || roadsOpen(story)) return false;
  // During the errand the road to Emberbrook is Coco's alone: she walks it
  // without moving the party.
  if (soloRoadStages.includes(story.stage)) {
    if (scene === "MAIN_HOUSE" && point === "exit") {
      if (!offstageFor(story, p.role))
        host.relocate(p, "EMBERBROOK_VILLAGE", maps.EMBERBROOK_VILLAGE.spawn);
      return true;
    }
    if (scene === "EMBERBROOK_VILLAGE" && point === "back") {
      const exit = maps.MAIN_HOUSE.points.exit;
      host.relocate(p, "MAIN_HOUSE", { x: exit.x - 96, y: exit.y });
      return true;
    }
  }
  // The road north out of Emberbrook (the shrine) opens when Chapter 0 ends.
  if (scene === "EMBERBROOK_VILLAGE" && point === "exit") return true;
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
  const story = w.story;
  if (!story || story.stage === "DONE") return false;
  // The playtest shortcut to the shrine would skip the angel and the trials.
  if (scene === "MAIN_HOUSE" && point === "shrine") return true;
  if (roadsOpen(story)) return false;
  return (
    (scene === "MAIN_HOUSE" && point === "exit") ||
    (scene === "EMBERBROOK_VILLAGE" && point === "exit")
  );
}
