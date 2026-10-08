import type { CharacterAppearance } from "./appearance.js";
export type Role = "OATH" | "EMBER";
export type SceneId =
  "MAIN_HOUSE" | "FOREST_RUINS" | "AIRSHIP" | "AIRSHIP_BOSS";
export interface InputFrame {
  seq: number;
  moveX: number;
  moveY: number;
  jumpHeld: boolean;
  primaryHeld: boolean;
  secondaryHeld: boolean;
  interactHeld: boolean;
}
export interface CombatAction {
  seq: number;
  kind: "sword" | "heavy" | "cast";
  facing: number;
  startedTick: number;
}
export interface Player {
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
