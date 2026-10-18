import type { CharacterAppearance } from "./appearance.js";
export type Role = "OATH" | "EMBER";
export type SceneId =
  | "GRIFFIN_ENCLOSURE"
  | "GODDESS_SHRINE"
  | "MIRROR_POND"
  | "HEDGE_MAZE"
  | "BRIDGE_RUINS"
  | "HOUSE_INTERIOR"
  | "HOUSE_UPPER"
  | "PROLOGUE_TRAIL"
  | "PROLOGUE_CLEARING"
  | "MAIN_HOUSE"
  | "EMBERBROOK_VILLAGE"
  | import("./villageInteriors.js").VillageInterior
  | "WILLOWBANK_VILLAGE"
  | "STONEBRIDGE_TOWN"
  | "TRANSITION_TRAIL"
  | "GRASSLANDS"
  | "PUZZLE_GLADE"
  | "MONSTER_CLEARING"
  | "FOREST_RUINS"
  | "AIRSHIP"
  | "AIRSHIP_BOSS";
export interface InputFrame {
  /** Desired simulation tick for intent; server validates and bounds scheduling. */
  targetTick?: number;
  /** Server-issued location generation rejects inputs from a previous arrival. */
  movementEpoch?: number;
  seq: number;
  moveX: number;
  moveY: number;
  jumpHeld: boolean;
  primaryHeld: boolean;
  secondaryHeld: boolean;
  /** Super Speed activation intent; never a client-selected speed. */
  sprintHeld?: boolean;
  slowTimeHeld?: boolean;
  flightHeld?: boolean;
  blackHoleHeld?: boolean;
  pushHeld?: boolean;
  interactHeld: boolean;
}
export interface CombatAction {
  seq: number;
  kind: "sword" | "heavy" | "cast";
  facing: number;
  startedTick: number;
}
export interface Player {
  flightRemaining?: number;
  flightWasHeld?: boolean;
  flightGround?: { x: number; y: number };
  sprintRemaining?: number;
  sprintWasHeld?: boolean;
  /** Authoritative last movement intent, including timeout-neutral buttons. */
  movementInput?: InputFrame;
  movementEpoch?: number;
  /** Clamped movement intent drives locomotion even when collision stops velocity. */
  movementIntent?: { x: number; y: number };
  /** Authoritative local location; absent legacy fixtures use the room scene. */
  sceneId?: SceneId;
  id: string;
  role: Role | null;
  appearance?: CharacterAppearance;
  combat?: CombatAction;
  defensiveHit?: { seq: number; tick: number };
  heavyCharge?: {
    startedTick: number;
    facing: number;
    ticks: number;
    progress: number;
  };
  connected: boolean;
  ready: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  hp: number;
  maxHp: number;
  facing: number;
  actionState: string;
  cooldowns: Record<string, number>;
  skillPoints: number;
  unlockedSkills: string[];
  lastProcessedInputSeq: number;
}
export interface Enemy {
  attackKind?: "melee" | "beam";
  attackHit?: boolean;
  passive?: boolean;
  type: import("./enemies.js").EnemyType;
  maxHp: number;
  state: "IDLE" | "CHASE" | "ATTACK" | "DEAD";
  facing: number;
  targetId: string | null;
  vx: number;
  vy: number;
  attackSeq: number;
  attackStartedTick: number | null;
  attackFacing: number;
  nextAttackTick: number;
  deadTick: number | null;
  id: string;
  x: number;
  y: number;
  hp: number;
  cooldown: number;
}
export interface Projectile {
  effect?: "golem_beam";
  beamOrigin?: { x: number; y: number };
  beamAge?: number;
  beamDamaged?: string[];
  beamContact?: string;
  beamImpacts?: number;
  /** Set only by a validated server reflection. */
  pondReflection?: number;
  castTick?: number;
  castOrigin?: { x: number; y: number };
  /** Strength captured by the server at cast time (Coco only). */
  fireballLevel?: number;
  sceneId?: SceneId;
  faction?: "players" | "enemies";
  damage?: number;
  radius?: number;
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  owner: string;
}
export interface Puzzle {
  glade?: import("./statueGlade.js").GladeState;
  griffin?: import("./griffin.js").GriffinState;
  pond?: import("./mirrorPond.js").MirrorPondState;
  maze?: import("./hedgeMaze.js").HedgeMazeState;
  id: string;
  physical: boolean;
  arcane: boolean;
  complete: boolean;
  progress: number;
}
export interface BlackHole {
  id: string;
  owner: string;
  sceneId: SceneId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  remainingRange: number;
  phase: "travel" | "vortex";
  startedTick: number;
  life: number;
  damaged: string[];
}
/** Server-owned Chapter 0 prologue progress (see prologue.ts). */
export interface StoryState {
  stage: import("./prologue.js").StoryStage;
  /** The scene being played, if any; heroes cannot move while it runs. */
  cutscene?: {
    id: string;
    line: number;
    /** Players who have read the current line. */
    acks: string[];
    /** Tick the current line appeared. */
    since: number;
    /** Tick the first reader finished it; the line moves on soon after. */
    firstAck?: number;
  };
  /** Permanent story flags, in the order they were earned. */
  flags: string[];
  /** Tick the ambush fight began. */
  fightStart?: number;
  alden?: import("./prologue.js").AldenPose & {
    action: import("./prologue.js").AldenAction;
    /** Where he is walking to. */
    target?: { x: number; y: number };
  };
}
export interface World {
  story?: StoryState;
  /** Villagers stopped mid-conversation: since which tick, and with whom. */
  npcTalks?: Record<string, { since: number; listeners: string[] }>;
  /** Ticks each villager has spent talking, so its walk resumes in place. */
  npcOffsets?: Record<string, number>;
  inventory?: import("./items.js").InventoryState;
  inventoryTargets?: Record<string, import("./items.js").InventoryTarget>;
  blackHoles?: Record<string, BlackHole>;
  bridgePuzzle?: import("./bridgePuzzle.js").BridgePuzzleState;
  slowTime?: { owner: string; startedTick: number; endsTick: number };
  /** Server-owned displacement of reviewed pushable map objects. */
  pushableOffsets?: Record<string, { x: number; y: number }>;
  roomCode: string;
  phase: "LOBBY" | "PLAYING" | "COMPLETE";
  sceneId: SceneId;
  serverTick: number;
  worldRevision: number;
  players: Record<string, Player>;
  enemies: Record<string, Enemy>;
  projectiles: Record<string, Projectile>;
  projectileImpacts?: {
    effect?: "golem_blast";
    radius?: number;
    id: string;
    x: number;
    y: number;
    owner: string;
    tick: number;
    sceneId?: SceneId;
  }[];
  puzzles: Record<string, Puzzle>;
  interactables: Record<string, { x: number; y: number }>;
  boss: null | {
    hp: number;
    phase: "SHIELDED" | "VULNERABLE" | "DEFEATED";
    shieldReturned: boolean;
  };
  checkpoint: string;
}
export interface Rect {
  terrain?: "water" | "canyon";
  x: number;
  y: number;
  w: number;
  h: number;
}
export const neutral = (seq = 0): InputFrame => ({
  seq,
  moveX: 0,
  moveY: 0,
  jumpHeld: false,
  primaryHeld: false,
  secondaryHeld: false,
  interactHeld: false,
});
