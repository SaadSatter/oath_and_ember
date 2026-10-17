import { SERVER_HZ } from "./constants.js";
import type { SceneId, World } from "./gameTypes.js";
/** The parts of the world that pause villagers for conversation. */
export type NpcState = Partial<
  Pick<World, "npcTalks" | "npcOffsets" | "players">
>;
// Ambient villagers. Each one's position is a pure function of the server
// tick, so every client draws the same villager in the same place without any
// extra network traffic. They are scenery and conversation only: they never
// block movement, fight, or change world state.
export type NpcFacing = "south" | "east" | "north" | "west";
export interface NpcDefinition {
  id: string;
  name: string;
  /** Sheet under /assets/npcs (see its README). */
  sprite: "old_man" | "mother" | "wizard" | "townsfolk" | "healer";
  scene: SceneId;
  /** Closed loop of waypoints in world units; one point means standing still. */
  route: { x: number; y: number }[];
  speed: number;
  /** Seconds spent standing at each waypoint before walking on. */
  pause: number;
  /** Seconds into the loop at tick 0, so villagers are not in lockstep. */
  phase: number;
  /** Facing while standing still (stationary villagers only). */
  facing?: NpcFacing;
  lines: string[];
}
export const NPC_TALK_RANGE = 48;
export const npcs: NpcDefinition[] = [
  {
    id: "mother",
    name: "Mother",
    sprite: "mother",
    scene: "EMBERBROOK_VILLAGE",
    // Just east of her cottage door, so E at the door always enters.
    route: [
      { x: 290, y: 318 },
      { x: 360, y: 336 },
      { x: 290, y: 352 },
    ],
    speed: 34,
    pause: 3,
    phase: 0,
    lines: [
      "Sieg! Coco! There you are. Off on your big adventure already?",
      "The trail north of the well leads out of Emberbrook. The goddess's shrine lies far beyond it.",
      "Look after each other. And eat something on the way!",
    ],
  },
  {
    id: "elder",
    name: "Elder Bertram",
    sprite: "old_man",
    scene: "EMBERBROOK_VILLAGE",
    route: [
      { x: 400, y: 336 },
      { x: 560, y: 336 },
      { x: 560, y: 446 },
      { x: 400, y: 446 },
    ],
    speed: 22,
    pause: 2.5,
    phase: 7,
    lines: [
      "Hm? Ah, the young ones from the house on the hill.",
      "In my day, the Bald Goddess had the finest hair in all the land. Flowing. Majestic.",
      "Then one morning it was simply gone. Someone ought to find out where it went.",
    ],
  },
  {
    id: "wizard",
    name: "Wizard Alder",
    sprite: "wizard",
    scene: "EMBERBROOK_VILLAGE",
    // Paces the north road, clear of the apothecary door and the village exit.
    route: [
      { x: 480, y: 184 },
      { x: 480, y: 252 },
    ],
    speed: 30,
    pause: 4,
    phase: 3,
    lines: [
      "A knight sworn to steel and a mage who burns with starlight. Now that is a pairing.",
      "Remember: some locks open only when both of you push on them at once.",
    ],
  },
  {
    id: "mira",
    name: "Mira",
    sprite: "townsfolk",
    scene: "EMBERBROOK_VILLAGE",
    route: [
      { x: 280, y: 574 },
      { x: 480, y: 574 },
      { x: 480, y: 452 },
      { x: 480, y: 574 },
    ],
    speed: 40,
    pause: 1.5,
    phase: 11,
    lines: [
      "Lovely morning for a walk around the well, isn't it?",
      "They say a griffin nests somewhere past the shrine. Who would ever steal from a griffin?",
    ],
  },
  {
    id: "healer",
    name: "Healer Brynn",
    sprite: "healer",
    scene: "EMBERBROOK_VILLAGE",
    route: [{ x: 770, y: 470 }],
    speed: 0,
    pause: 0,
    phase: 0,
    facing: "west",
    lines: [
      "Bumps and bruises? You know where to find me, dears.",
      "My shop is open, and advice is free: never fight a golem at its own range.",
    ],
  },
];
// Residents use separate clear lanes and deterministic walks, including pauses
// for the existing server-owned conversations.
npcs.push(
  {
    id: "willow-gardener",
    name: "Nessa the Gardener",
    sprite: "mother",
    scene: "WILLOWBANK_VILLAGE",
    route: [
      { x: 544, y: 560 },
      { x: 544, y: 688 },
    ],
    speed: 24,
    pause: 3,
    phase: 0,
    lines: [
      "Welcome to Willowbank. We leave the riverbanks wild so the reeds can grow.",
      "The north sign takes you to Stonebridge. The south road returns to Emberbrook.",
    ],
  },
  {
    id: "willow-elder",
    name: "Bran the Miller",
    sprite: "old_man",
    scene: "WILLOWBANK_VILLAGE",
    route: [
      { x: 480, y: 424 },
      { x: 560, y: 424 },
    ],
    speed: 22,
    pause: 4,
    phase: 3,
    lines: [
      "The mill has stood here longer than I have. And that is saying something.",
      "You can visit the Riverside Home. The stairs lead to its bedrooms.",
    ],
  },
  {
    id: "willow-healer",
    name: "Elin",
    sprite: "healer",
    scene: "WILLOWBANK_VILLAGE",
    route: [{ x: 736, y: 352 }],
    speed: 0,
    pause: 0,
    phase: 0,
    facing: "west",
    lines: ["Soft banks, clear water, quiet neighbors. That is Willowbank."],
  },
  {
    id: "willow-fisher",
    name: "Finn",
    sprite: "townsfolk",
    scene: "WILLOWBANK_VILLAGE",
    route: [
      { x: 512, y: 912 },
      { x: 704, y: 912 },
    ],
    speed: 28,
    pause: 2,
    phase: 1,
    lines: ["The fish are clever today. Tomorrow I shall try being cleverer."],
  },
  {
    id: "stone-elder",
    name: "Rook",
    sprite: "old_man",
    scene: "STONEBRIDGE_TOWN",
    route: [
      { x: 848, y: 352 },
      { x: 896, y: 352 },
    ],
    speed: 22,
    pause: 3,
    phase: 1,
    lines: [
      "Welcome to Stonebridge. The inn is west of the well.",
      "There are guest rooms upstairs, if you need somewhere quiet.",
    ],
  },
  {
    id: "stone-baker",
    name: "Tessa the Baker",
    sprite: "mother",
    scene: "STONEBRIDGE_TOWN",
    route: [
      { x: 352, y: 624 },
      { x: 448, y: 624 },
    ],
    speed: 26,
    pause: 3,
    phase: 4,
    lines: ["A town needs good bread and wide paths. We are working on both."],
  },
  {
    id: "stone-scholar",
    name: "Ivo",
    sprite: "wizard",
    scene: "STONEBRIDGE_TOWN",
    route: [
      { x: 864, y: 1056 },
      { x: 928, y: 1056 },
    ],
    speed: 24,
    pause: 4,
    phase: 6,
    lines: [
      "That pond is an excellent place to think. Less excellent for swimming in robes.",
    ],
  },
  {
    id: "stone-healer",
    name: "Mara",
    sprite: "healer",
    scene: "STONEBRIDGE_TOWN",
    route: [{ x: 704, y: 624 }],
    speed: 0,
    pause: 0,
    phase: 0,
    facing: "south",
    lines: [
      "The south sign leads back to Willowbank. Keep the well on your right.",
    ],
  },
  {
    id: "innkeeper",
    name: "Innkeeper Rowan",
    sprite: "townsfolk",
    scene: "STONEBRIDGE_INN",
    route: [{ x: 520, y: 400 }],
    speed: 0,
    pause: 0,
    phase: 0,
    facing: "west",
    lines: [
      "Come in! There are four guest beds upstairs.",
      "Use the stairs along the east wall. Leave your muddy boots by the door.",
    ],
  },
);
export interface NpcPose {
  x: number;
  y: number;
  facing: NpcFacing;
  moving: boolean;
  /** Seconds spent walking the current leg, for the walk cycle. */
  stride: number;
}
const facingOf = (dx: number, dy: number): NpcFacing =>
  Math.abs(dx) >= Math.abs(dy)
    ? dx < 0
      ? "west"
      : "east"
    : dy < 0
      ? "north"
      : "south";
// A villager's own clock: server ticks minus time spent talking. While a
// conversation is open it stands still at the tick the conversation began.
export function npcClock(id: string, tick: number, state?: NpcState) {
  const talk = state?.npcTalks?.[id],
    offset = state?.npcOffsets?.[id] ?? 0;
  return (talk ? Math.min(tick, talk.since) : tick) - offset;
}
// Where a villager is at a (possibly fractional) server tick. With `state`,
// a villager in conversation stands still and turns to face who it talks to.
export function npcPose(
  npc: NpcDefinition,
  tick: number,
  state?: NpcState,
): NpcPose {
  const pose = walkPose(npc, npcClock(npc.id, tick, state));
  const talk = state?.npcTalks?.[npc.id];
  if (!talk) return pose;
  const listener = talk.listeners
    .map((id) => state?.players?.[id])
    .find((p) => p && (p.sceneId ?? npc.scene) === npc.scene);
  return {
    ...pose,
    moving: false,
    stride: 0,
    facing: listener
      ? facingOf(listener.x - pose.x, listener.y - pose.y)
      : pose.facing,
  };
}
function walkPose(npc: NpcDefinition, tick: number): NpcPose {
  const route = npc.route;
  if (route.length < 2 || npc.speed <= 0)
    return {
      ...route[0],
      facing: npc.facing ?? "south",
      moving: false,
      stride: 0,
    };
  const legs = route.map((from, i) => {
    const to = route[(i + 1) % route.length];
    return {
      from,
      to,
      walk: Math.hypot(to.x - from.x, to.y - from.y) / npc.speed,
    };
  });
  const cycle = legs.reduce((sum, leg) => sum + npc.pause + leg.walk, 0);
  let t = (((tick / SERVER_HZ + npc.phase) % cycle) + cycle) % cycle;
  for (const leg of legs) {
    const facing = facingOf(leg.to.x - leg.from.x, leg.to.y - leg.from.y);
    if (t < npc.pause) return { ...leg.from, facing, moving: false, stride: 0 };
    t -= npc.pause;
    if (t < leg.walk) {
      const f = t / leg.walk;
      return {
        x: leg.from.x + (leg.to.x - leg.from.x) * f,
        y: leg.from.y + (leg.to.y - leg.from.y) * f,
        facing,
        moving: true,
        stride: t,
      };
    }
    t -= leg.walk;
  }
  return { ...route[0], facing: "south", moving: false, stride: 0 };
}
export const npcsIn = (scene: SceneId) => npcs.filter((n) => n.scene === scene);
// The villager a hero at `at` can talk to, if any (nearest wins).
export function npcInReach(
  scene: SceneId,
  at: { x: number; y: number },
  tick: number,
  state?: NpcState,
) {
  let best: { npc: NpcDefinition; distance: number } | null = null;
  for (const npc of npcsIn(scene)) {
    const pose = npcPose(npc, tick, state),
      distance = Math.hypot(pose.x - at.x, pose.y - at.y);
    if (distance <= NPC_TALK_RANGE && (!best || distance < best.distance))
      best = { npc, distance };
  }
  return best?.npc ?? null;
}
