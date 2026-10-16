import type {
  Player,
  Projectile,
  Rect,
  World,
} from "../../../../packages/shared/src/gameTypes.js";
import {
  DT,
  ticksFor,
  FIREBALL_RANGE,
  FIREBALL_SPEED,
  SLOW_TIME_SCALE,
} from "../../../../packages/shared/src/constants.js";
import {
  mirrorPondState,
  pondStations,
  pondMirrorContact,
} from "../../../../packages/shared/src/mirrorPond.js";
import { combatDirection } from "../animation/combat.js";

// Presentation-only. The local hero is drawn on the predicted timeline, ahead of
// snapshots, so Coco's own fireballs are drawn there too: a cast appears from her
// staff the moment the predicted hero reaches the pressed tick, and the server's
// projectile takes over under the same key. The server still decides cooldown,
// spawn, collision and damage; a cast it never confirms simply disappears.

const ATTACK_COOLDOWN = 0.6;
export const MATCH_TICKS = ticksFor(0.067);
const MAX_LEAD_TICKS = ticksFor(0.5);

// Staff tip relative to the simulated position, measured from Coco's cast sheet
// (ground anchor 13px below the position). The offset fades over the first
// stretch of flight so the shot settles onto its authoritative path.
export const staffOffsets = {
  right: { x: 24, y: -14 },
  left: { x: -26, y: -15 },
  down: { x: -18, y: -8 },
  up: { x: 14, y: -30 },
} as const;
const STAFF_FADE = 48;

export function staffOrigin(
  position: { x: number; y: number },
  castOrigin: { x: number; y: number } | undefined,
  velocity: { x: number; y: number },
) {
  if (!castOrigin) return position;
  const travelled = Math.hypot(
    position.x - castOrigin.x,
    position.y - castOrigin.y,
  );
  const fade = Math.max(0, 1 - travelled / STAFF_FADE);
  const offset =
    staffOffsets[combatDirection(Math.atan2(velocity.y, velocity.x))];
  return { x: position.x + offset.x * fade, y: position.y + offset.y * fade };
}

function blocked(p: { x: number; y: number }, walls: Rect[], radius: number) {
  return walls.some(
    (r) =>
      p.x + radius > r.x &&
      p.x - radius < r.x + r.w &&
      p.y + radius > r.y &&
      p.y - radius < r.y + r.h,
  );
}
// Advance a shot along its velocity, stopping at the first solid it touches.
export function travel(
  from: { x: number; y: number },
  velocity: { x: number; y: number },
  seconds: number,
  walls: Rect[],
  radius = 4,
) {
  const distance = Math.hypot(velocity.x, velocity.y) * Math.max(0, seconds);
  const steps = Math.ceil(distance / 4);
  let at = { ...from };
  for (let n = 1; n <= steps; n++) {
    const f = (n / steps) * Math.max(0, seconds);
    const next = { x: from.x + velocity.x * f, y: from.y + velocity.y * f };
    if (blocked(next, walls, radius)) break;
    at = next;
  }
  return at;
}

// Presentation uses the same swept mirror plane as the server, without changing
// puzzle state. A later authoritative snapshot always replaces this prediction.
export function pondTravel(
  q: Projectile,
  seconds: number,
  world: Readonly<World>,
  walls: Rect[],
) {
  if ((q.sceneId ?? world.sceneId) !== "MIRROR_POND")
    return { at: travel(q, { x: q.vx, y: q.vy }, seconds, walls), velocity: q };
  if (q.pondReflection !== undefined)
    return { at: travel(q, { x: q.vx, y: q.vy }, seconds, []), velocity: q };
  const pond = mirrorPondState(world.puzzles);
  const to = travel(q, { x: q.vx, y: q.vy }, seconds, walls);
  if (!pond) return { at: to, velocity: q };
  let first = Infinity,
    index = -1;
  pondStations.forEach((_, i) => {
    const t = pondMirrorContact(q, to, i, pond.mirrors[i]);
    if (t < first) {
      first = t;
      index = i;
    }
  });
  if (index < 0) return { at: to, velocity: q };
  const station = pondStations[index],
    origin = q.castOrigin;
  const hit = { x: q.x + (to.x - q.x) * first, y: q.y + (to.y - q.y) * first };
  const speed = Math.hypot(q.vx, q.vy);
  if (
    !origin ||
    q.faction === "enemies" ||
    world.players[q.owner]?.role !== "EMBER" ||
    Math.abs(origin.x - station.shot.x) > 32 ||
    Math.abs(origin.y - station.shot.y) > 32 ||
    speed < 1 ||
    (q.vx * station.incoming.x + q.vy * station.incoming.y) / speed < 0.98
  )
    return { at: hit, velocity: q };
  const tx = Math.cos(pond.mirrors[index]),
    ty = Math.sin(pond.mirrors[index]);
  const dot = q.vx * tx + q.vy * ty;
  const velocity = { vx: 2 * dot * tx - q.vx, vy: 2 * dot * ty - q.vy };
  const remaining = Math.hypot(to.x - hit.x, to.y - hit.y) / speed;
  return {
    at: {
      x: hit.x + velocity.vx * remaining,
      y: hit.y + velocity.vy * remaining,
    },
    velocity,
  };
}

export interface PredictedCast {
  tick: number;
  // Filled from the prediction trail once that tick has been simulated.
  origin?: { x: number; y: number; facing: number };
  projectileId?: string;
}

export class CastPrediction {
  casts: PredictedCast[] = [];
  private lastTick = -Infinity;
  clear() {
    this.casts = [];
    this.lastTick = -Infinity;
  }
  // Called for a fresh primary press scheduled at `tick`. Mirrors the server's
  // cast rules closely enough for presentation; it never grants a cast.
  press(tick: number, hero: Readonly<Player>, world: Readonly<World>) {
    if (hero.role !== "EMBER" || hero.hp <= 0) return false;
    const scale = world.slowTime ? SLOW_TIME_SCALE : 1;
    const remaining =
      (hero.cooldowns.attack ?? 0) - (tick - world.serverTick) * DT * scale;
    const spacing = ATTACK_COOLDOWN / (DT * scale);
    if (remaining > 1e-6 || tick - this.lastTick < spacing - 0.5) return false;
    this.lastTick = tick;
    this.casts.push({ tick });
    if (this.casts.length > 6) this.casts.shift();
    return true;
  }
  // Capture each cast's origin the first time its tick exists in prediction, so
  // later reconciliation cannot move a shot that is already on screen.
  resolve(
    stateAt: (tick: number) => { x: number; y: number; facing: number } | null,
  ) {
    for (const cast of this.casts)
      if (!cast.origin) {
        const state = stateAt(cast.tick);
        if (state)
          cast.origin = { x: state.x, y: state.y, facing: state.facing };
      }
  }
  // Pair predicted casts with the server's projectiles and retire the rest.
  sync(world: Readonly<World>, playerId: string) {
    const own = Object.values(world.projectiles).filter(
      (q) => q.owner === playerId && q.castTick !== undefined && !q.effect,
    );
    for (const cast of this.casts)
      if (!cast.projectileId) {
        const match = own.find(
          (q) =>
            Math.abs(q.castTick! - cast.tick) <= MATCH_TICKS &&
            !this.casts.some((c) => c.projectileId === q.id),
        );
        if (match) cast.projectileId = match.id;
      }
    this.casts = this.casts.filter((cast) =>
      cast.projectileId
        ? !!world.projectiles[cast.projectileId]
        : world.serverTick < cast.tick + MATCH_TICKS + 1,
    );
  }
  keyFor(projectileId: string) {
    const cast = this.casts.find((c) => c.projectileId === projectileId);
    return cast ? `cast:${cast.tick}` : projectileId;
  }
  // The newest predicted cast already on screen, as a combat marker for the pose.
  pose(renderTick: number, snapshotTick: number, serverSeq = -Infinity) {
    const cast = [...this.casts]
      .reverse()
      .find((c) => c.tick <= renderTick && c.origin);
    if (!cast?.origin || serverSeq > cast.tick + MATCH_TICKS) return null;
    return {
      seq: cast.tick,
      startedTick: snapshotTick - (renderTick - cast.tick),
      facing: cast.origin.facing,
      kind: "cast" as const,
    };
  }
  // Own fireballs drawn on the predicted timeline: confirmed shots are carried
  // forward from the snapshot, unconfirmed ones fly from the predicted origin.
  view(
    world: Readonly<World>,
    projectiles: Record<string, Projectile>,
    playerId: string,
    renderTick: number,
    fireballLevel: number,
    walls: Rect[],
    // Hit boxes of what the shot can strike, where the player sees them. The
    // shot is drawn ahead of the server, so without these it would sail
    // through a target and explode behind itself once the server's hit lands.
    targets: Rect[] = [],
  ) {
    const scale = world.slowTime ? SLOW_TIME_SCALE : 1;
    const blockers = targets.length ? [...walls, ...targets] : walls;
    const out: Record<string, Projectile> = {};
    const positions = new Map<string, { x: number; y: number }>();
    for (const q of Object.values(projectiles)) {
      if (q.owner !== playerId || q.effect) {
        out[q.id] = q;
        continue;
      }
      const key = this.keyFor(q.id);
      const lead = Math.max(
        0,
        Math.min(MAX_LEAD_TICKS, renderTick - world.serverTick),
      );
      out[key] = { ...q, id: key };
      const predicted = pondTravel(q, lead * DT * scale, world, blockers);
      Object.assign(out[key], predicted.velocity, { id: key });
      positions.set(key, predicted.at);
    }
    for (const cast of this.casts) {
      if (cast.projectileId || !cast.origin || renderTick < cast.tick) continue;
      const key = `cast:${cast.tick}`;
      const seconds = Math.min(
        (renderTick - cast.tick) * DT * scale,
        FIREBALL_RANGE / FIREBALL_SPEED,
      );
      const velocity = {
        x: Math.cos(cast.origin.facing) * FIREBALL_SPEED,
        y: Math.sin(cast.origin.facing) * FIREBALL_SPEED,
      };
      const origin = { x: cast.origin.x, y: cast.origin.y };
      out[key] = {
        id: key,
        owner: playerId,
        x: origin.x,
        y: origin.y,
        vx: velocity.x,
        vy: velocity.y,
        life: FIREBALL_RANGE / FIREBALL_SPEED,
        castTick: cast.tick,
        castOrigin: origin,
        fireballLevel,
      } as Projectile;
      const predicted = pondTravel(out[key], seconds, world, blockers);
      Object.assign(out[key], {
        vx: predicted.velocity.vx,
        vy: predicted.velocity.vy,
      });
      positions.set(key, predicted.at);
    }
    return { projectiles: out, positions };
  }
}
