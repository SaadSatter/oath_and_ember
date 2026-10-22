import type { Enemy } from "./gameTypes.js";
import { ticksFor } from "./constants.js";
export type EnemyType = "mossling" | "cinder_wisp" | "ironbound_sentinel";
export interface EnemyDefinition {
  maxHp: number;
  speed: number;
  detectionRange: number;
  attackRange: number;
  cooldownTicks: number;
  windupTicks: number;
  damage: number;
  body: { halfWidth: number; halfHeight: number };
  movement: "pursue" | "ranged";
  attack: "melee" | "projectile";
  preferredRange: number;
  projectileSpeed: number;
  projectileLife: number;
  sprite: string;
}
export const golemMelee = {
  range: 60,
  hitTicks: ticksFor(0.4),
  durationTicks: ticksFor(0.8),
  cooldownTicks: ticksFor(1),
  facingDot: 0.5,
} as const;
/**
 * The Mossling's attack: its arm becomes a wooden spike that shoots straight
 * out along the direction it locked in when it began to wind up. Every hero
 * on that line, within reach, is struck as the spike lands (the end of the
 * windup); a hero who steps off the line during the windup is missed.
 */
export const mosslingSpike = {
  /** From the Mossling's feet to the spike's point, in world units. */
  reach: 112,
  /** How far off the spike's line a hero can stand and still be struck. */
  radius: 20,
  /** Client timing: it shoots out over the last part of the windup... */
  extendTicks: ticksFor(0.1),
  /** ...stays out a moment, then pulls back into an arm. */
  holdTicks: ticksFor(0.12),
  retractTicks: ticksFor(0.25),
} as const;
/** Whether the spike, thrust along `attackFacing`, reaches this hero. */
export function mosslingSpikeHits(
  e: { x: number; y: number; attackFacing: number },
  p: { x: number; y: number },
) {
  const dx = p.x - e.x,
    dy = p.y - e.y,
    c = Math.cos(e.attackFacing),
    s = Math.sin(e.attackFacing),
    along = dx * c + dy * s,
    across = Math.abs(dy * c - dx * s);
  return along >= -8 && along <= mosslingSpike.reach && across <= mosslingSpike.radius;
}
export const enemyDefinitions: Record<EnemyType, EnemyDefinition> = {
  mossling: {
    maxHp: 60,
    speed: 65,
    detectionRange: 250,
    // It strikes from a distance: its spike reaches mosslingSpike.reach.
    attackRange: 95,
    cooldownTicks: ticksFor(1),
    windupTicks: ticksFor(0.4),
    damage: 10,
    body: { halfWidth: 14, halfHeight: 12 },
    movement: "pursue",
    attack: "melee",
    preferredRange: 0,
    projectileSpeed: 0,
    projectileLife: 0,
    sprite: "mossling_sprites_v2",
  },
  cinder_wisp: {
    maxHp: 45,
    speed: 55,
    detectionRange: 360,
    attackRange: 250,
    cooldownTicks: ticksFor(1.8),
    windupTicks: ticksFor(0.6),
    damage: 12,
    body: { halfWidth: 10, halfHeight: 10 },
    movement: "ranged",
    attack: "projectile",
    preferredRange: 180,
    projectileSpeed: 180,
    projectileLife: 2.5,
    sprite: "cinder_wisp_sprites_v1",
  },
  ironbound_sentinel: {
    maxHp: 180,
    speed: 32,
    detectionRange: 420,
    attackRange: 320,
    cooldownTicks: ticksFor(2.5),
    windupTicks: ticksFor(1.2),
    damage: 28,
    body: { halfWidth: 22, halfHeight: 18 },
    movement: "pursue",
    attack: "projectile",
    preferredRange: 0,
    projectileSpeed: 400,
    projectileLife: 1.6,
    sprite: "ironbound_sentinel_sprites_v2",
  },
};
export function spawnEnemy(
  id: string,
  type: EnemyType,
  x: number,
  y: number,
): Enemy {
  const d = enemyDefinitions[type];
  return {
    id,
    type,
    x,
    y,
    hp: d.maxHp,
    maxHp: d.maxHp,
    cooldown: 0,
    state: "IDLE",
    facing: Math.PI / 2,
    targetId: null,
    vx: 0,
    vy: 0,
    attackSeq: 0,
    attackStartedTick: null,
    attackFacing: 0,
    nextAttackTick: 0,
    deadTick: null,
  };
}
export const forestEncounter = [
  { id: "moss", type: "mossling", x: 710, y: 380 },
  { id: "moss-2", type: "mossling", x: 750, y: 540 },
  { id: "wisp", type: "cinder_wisp", x: 900, y: 390 },
  { id: "sentinel", type: "ironbound_sentinel", x: 900, y: 520 },
] as const;
