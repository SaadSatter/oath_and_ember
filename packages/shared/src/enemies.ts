import type { Enemy } from "./gameTypes.js";
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
export const enemyDefinitions: Record<EnemyType, EnemyDefinition> = {
  mossling: {
    maxHp: 60,
    speed: 65,
    detectionRange: 250,
    attackRange: 45,
    cooldownTicks: 30,
    windupTicks: 12,
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
    cooldownTicks: 54,
    windupTicks: 18,
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
    detectionRange: 260,
    attackRange: 60,
    cooldownTicks: 75,
    windupTicks: 27,
    damage: 28,
    body: { halfWidth: 22, halfHeight: 18 },
    movement: "pursue",
    attack: "melee",
    preferredRange: 0,
    projectileSpeed: 0,
    projectileLife: 0,
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
