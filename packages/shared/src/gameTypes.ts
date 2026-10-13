import type { CharacterAppearance } from "./appearance.js";
export type Role = "OATH" | "EMBER";
export type SceneId =
  | "HOUSE_INTERIOR"
  | "MAIN_HOUSE"
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
  interactHeld: boolean;
}
export interface CombatAction {
  seq: number;
  kind: "sword" | "heavy" | "cast";
  facing: number;
  startedTick: number;
}
export interface Player {
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
  id: string;
  physical: boolean;
  arcane: boolean;
  complete: boolean;
  progress: number;
}
export interface World {
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
