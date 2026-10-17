import { DT, SLOW_TIME_SCALE } from "../../../packages/shared/src/constants.js";
import type { Player, World } from "../../../packages/shared/src/gameTypes.js";
import {
  griffinBeamEnd,
  griffinBeamDuration,
  griffinPullTuning,
  griffinMouth,
  griffinBounds,
  griffinNest,
  griffinSightRadius,
  griffinWakeDuration,
  griffinGroomDurations,
  griffinPillars,
  griffinPuzzle,
  griffinState,
  griffinWalls,
  GRIFFIN_NEST,
  type GriffinState,
} from "../../../packages/shared/src/griffin.js";
import { maps } from "../../../packages/shared/src/maps.js";
import { constrainMotion } from "../../../packages/shared/src/movement.js";
import { segmentHits } from "./enemySimulation.js";
import type { InventoryService } from "./inventory.js";
export function ensureGriffin(w: World, inventory: InventoryService) {
  w.puzzles.griffin ??= griffinPuzzle();
  if (inventory.targets.has(GRIFFIN_NEST)) return;
  inventory.register(w, {
    id: GRIFFIN_NEST,
    name: "Griffin nest · drop mirror + shears",
    kind: "offering",
    sceneId: "GRIFFIN_ENCLOSURE",
    ...griffinNest,
    interact: (world, player, intent) => {
      const g = griffinState(world.puzzles)!,
        bag = world.inventory!;
      if (g.wigClaimed)
        return {
          message:
            "The magnificent wig is already in your shared quest history.",
          revision: bag.revision,
        };
      if (player.role !== "EMBER") throw Error("Coco must fly to the nest.");
      if (g.wigDropped && g.groomingStage === "DONE") {
        awardGriffinWig(world, g);
        bag.revision++;
        return {
          message: "Picked up the Griffin Wig. Return to the goddess.",
          revision: bag.revision,
        };
      }
      if (g.toolsTaken)
        return {
          message:
            "The Griffin is taking its tools and flying away. Collect the wig at the nest when it leaves.",
          revision: bag.revision,
        };
      if (intent.itemId && !(bag.counts[intent.itemId]! > 0))
        throw Error("That item is not in the shared backpack.");
      // A plain interaction delivers every owned nest tool in one server action.
      const dropBoth =
        !intent.itemId &&
        ((bag.counts.vanity_mirror ?? 0) > 0 ||
          (bag.counts.enchanted_shears ?? 0) > 0);
      let message: string;
      if (
        dropBoth ||
        intent.itemId === "vanity_mirror" ||
        intent.itemId === "enchanted_shears"
      ) {
        if (
          intent.itemId === "vanity_mirror" ||
          (dropBoth && (bag.counts.vanity_mirror ?? 0) > 0)
        )
          g.mirrorDelivered = true;
        if (
          intent.itemId === "enchanted_shears" ||
          (dropBoth && (bag.counts.enchanted_shears ?? 0) > 0)
        )
          g.shearsDelivered = true;
        if (g.hp <= 0 && g.shearsDelivered) {
          awardGriffinWig(world, g);
        } else if (g.mirrorDelivered && g.hp > 0 && g.phase !== "GROOMING") {
          phase(g, "GROOMING", 0);
          g.groomingStage = "RETURN";
          g.beam = undefined;
        }
        message = g.wigClaimed
          ? "Magnificent Griffin Wig added to the shared backpack. Return to the goddess."
          : g.shearsDelivered && g.mirrorDelivered
            ? "Both tools are at the nest. The Griffin will admire its hair, then give itself a trim."
            : g.mirrorDelivered
              ? "The Griffin admires its reflection. Drop the shears at the nest for its haircut."
              : "Shears left at the nest. Bring the vanity mirror to complete the setup.";
      } else if (!intent.itemId && g.hp <= 0) {
        awardGriffinWig(world, g);
        message =
          "Magnificent Griffin Wig added to the shared backpack. Return to the goddess.";
      } else {
        return {
          message:
            "Drop the vanity mirror and enchanted shears at the nest. The Griffin will check its hair and cut it. Or defeat the guardian and collect its shed plumage.",
          revision: bag.revision,
        };
      }
      bag.revision++;
      return { message, revision: bag.revision };
    },
  });
}
function awardGriffinWig(w: World, g: GriffinState) {
  if (g.wigClaimed) return;
  g.wigClaimed = true;
  const bag = w.inventory!;
  bag.counts.griffin_wig = (bag.counts.griffin_wig ?? 0) + 1;
  if (!bag.claimed.includes(GRIFFIN_NEST)) bag.claimed.push(GRIFFIN_NEST);
  w.puzzles.griffin.complete = true;
}

function tickGrooming(w: World, g: GriffinState, dt: number) {
  if (g.groomingStage === "DONE") return;
  if (g.groomingStage === "DEPART") {
    // Fly beyond the northern edge; the dropped reward stays at the nest.
    g.y -= 180 * dt;
    g.facing = -Math.PI / 2;
    if (g.timer <= 1.5) g.wigDropped = true;
    if (g.timer <= 0) g.groomingStage = "DONE";
    return;
  }
  if (g.groomingStage === "RETURN") {
    const dx = griffinNest.x - g.x,
      dy = griffinNest.y - g.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 1) {
      const step = Math.min(distance, 160 * dt);
      g.facing = Math.atan2(dy, dx);
      Object.assign(
        g,
        constrainMotion(
          g,
          { x: (dx / distance) * step, y: (dy / distance) * step },
          maps.GRIFFIN_ENCLOSURE,
          griffinBounds,
        ),
      );
      return;
    }
    g.groomingStage = "STAND";
    g.timer = griffinGroomDurations.STAND;
    g.facing = Math.PI / 2;
    return;
  }
  if (g.timer > 0) return;
  const next =
    g.groomingStage === "STAND"
      ? "SOUTH"
      : g.groomingStage === "SOUTH"
        ? "NORTH"
        : g.groomingStage === "NORTH"
          ? g.shearsDelivered
            ? "CUT"
            : "NORTH"
          : "DEPART";
  g.groomingStage = next;
  g.facing = next === "SOUTH" ? Math.PI / 2 : -Math.PI / 2;
  if (next === "CUT" && !g.toolsTaken) {
    const bag = w.inventory!;
    for (const item of ["vanity_mirror", "enchanted_shears"] as const)
      bag.counts[item] = Math.max(0, (bag.counts[item] ?? 0) - 1);
    g.toolsTaken = true;
    bag.revision++;
  }
  g.timer = griffinGroomDurations[next];
}

export function damageGriffin(w: World, amount: number) {
  const g = griffinState(w.puzzles);
  if (
    w.sceneId !== "GRIFFIN_ENCLOSURE" ||
    !g ||
    g.hp <= 0 ||
    g.wigClaimed ||
    g.phase === "GROOMING"
  )
    return;
  if (amount > 0 && g.phase === "NEST") phase(g, "WAKING", griffinWakeDuration);
  g.hp = Math.max(0, g.hp - amount);
  if (!g.hp) {
    g.phase = "DEFEATED";
    g.timer = 0;
  }
}
export function pullGriffin(
  w: World,
  hole: { x: number; y: number; sceneId: string; damaged: string[] },
  speed: number,
) {
  const g = griffinState(w.puzzles);
  if (
    hole.sceneId !== "GRIFFIN_ENCLOSURE" ||
    !g ||
    g.hp <= 0 ||
    g.wigClaimed ||
    g.phase === "DISTRACTED" ||
    g.phase === "GROOMING"
  )
    return;
  const dx = hole.x - g.x,
    dy = hole.y - g.y,
    distance = Math.hypot(dx, dy);
  const walls = [...griffinBounds, ...griffinWalls(w.puzzles)];
  if (
    distance > griffinPullTuning.radius ||
    walls.some((r) => segmentHits(hole.x, hole.y, g.x, g.y, r))
  )
    return;
  if (!hole.damaged.includes("griffin")) {
    damageGriffin(w, 24);
    hole.damaged.push("griffin");
  }
  if (!g.hp) return;
  // A vortex that stops against the airborne body should still bring it ashore.
  // Move toward a shore-side landing point by swept motion, never teleporting.
  const landingY = Math.max(hole.y, griffinPullTuning.landingY);
  const pullX = hole.x - g.x,
    pullY = landingY - g.y,
    pullDistance = Math.hypot(pullX, pullY);
  if (pullDistance < 1) return;
  const step = Math.min(
    pullDistance,
    speed *
      griffinPullTuning.strength *
      DT *
      (w.slowTime ? SLOW_TIME_SCALE : 1),
  );
  Object.assign(
    g,
    constrainMotion(
      g,
      { x: (pullX / pullDistance) * step, y: (pullY / pullDistance) * step },
      maps.GRIFFIN_ENCLOSURE,
      walls,
    ),
  );
  if (g.y < 400) {
    g.phase = "PULLED";
    g.timer = 0.2;
  }
  // Pulling to the shore interrupts its flight and attacks, leaving it on land.
  if (g.y >= 400) {
    g.grounded = griffinPullTuning.grounded;
    g.phase = "LAND";
    g.timer = 0;
  }
}
function phase(g: GriffinState, name: GriffinState["phase"], duration: number) {
  g.phase = name;
  g.timer = duration;
  g.attackHits = [];
  if (name === "BEAM") g.beamStarted = g.clock;
}
export function tickGriffin(w: World, damage: (p: Player, n: number) => void) {
  const g = griffinState(w.puzzles);
  if (w.sceneId !== "GRIFFIN_ENCLOSURE" || !g || g.hp <= 0 || g.wigClaimed)
    return;
  const heroes = Object.values(w.players).filter(
    (p) =>
      p.connected &&
      p.hp > 0 &&
      (p.sceneId ?? w.sceneId) === "GRIFFIN_ENCLOSURE",
  );
  if (!heroes.length) return;
  if (g.phase === "NEST") {
    const blockers = [...griffinBounds, ...griffinWalls(w.puzzles)];
    const visible = heroes.some(
      (p) =>
        Math.hypot(p.x - g.x, p.y - g.y) <= griffinSightRadius &&
        !blockers.some((wall) => segmentHits(g.x, g.y, p.x, p.y, wall)),
    );
    if (!visible) return;
    phase(g, "WAKING", griffinWakeDuration);
  }
  const dt = DT * (w.slowTime ? SLOW_TIME_SCALE : 1);
  g.clock += dt;
  g.timer = Math.max(0, g.timer - dt);
  g.cooldown = Math.max(0, g.cooldown - dt);
  if (g.phase === "GROOMING") {
    tickGrooming(w, g, dt);
    return;
  }
  if (g.phase === "WAKING") {
    if (g.timer > 0) return;
    phase(g, "FLY", 0);
  }
  const sieg = heroes.find((p) => p.role === "OATH"),
    coco = heroes.find((p) => p.role === "EMBER");
  if (sieg) {
    g.stationary =
      Math.hypot(sieg.x - g.lastSiegX, sieg.y - g.lastSiegY) < 0.1
        ? g.stationary + dt
        : 0;
    g.lastSiegX = sieg.x;
    g.lastSiegY = sieg.y;
  }
  if (g.phase === "DISTRACTED" || g.phase === "STUNNED") {
    if (g.timer > 0) return;
    phase(g, "LAND", 0);
    g.grounded = 5;
  }
  if (g.phase === "PULLED" && g.timer > 0) return;
  const walls = [...griffinBounds, ...griffinWalls(w.puzzles)];
  const walk = (x: number, y: number, speed: number, air: boolean) => {
    const dx = x - g.x,
      dy = y - g.y,
      length = Math.hypot(dx, dy);
    if (length < 1) return;
    g.facing = Math.atan2(dy, dx);
    const step = Math.min(length, speed * dt);
    const result = constrainMotion(
      g,
      { x: (dx / length) * step, y: (dy / length) * step },
      maps.GRIFFIN_ENCLOSURE,
      air ? griffinBounds : walls,
    );
    g.x = result.x;
    g.y = air ? result.y : Math.max(410, result.y);
  };
  const target =
    coco && coco.y < 240
      ? coco
      : heroes.reduce((a, b) =>
          Math.hypot(a.x - g.x, a.y - g.y) < Math.hypot(b.x - g.x, b.y - g.y)
            ? a
            : b,
        );
  if (g.phase === "HEADBUTT_CHARGE" || g.phase === "BEAM_CHARGE") {
    if (g.timer > 0) return;
    phase(
      g,
      g.phase === "HEADBUTT_CHARGE" ? "HEADBUTT" : "BEAM",
      g.phase === "HEADBUTT_CHARGE" ? 0.7 : griffinBeamDuration,
    );
  }
  if (g.phase === "BEAM") {
    g.beamStarted ??= g.clock;
    const end = griffinBeamEnd(g, walls, heroes);
    const previous = g.beam;
    g.beam = {
      ...end,
      impactClock:
        previous?.contactId === end.contactId ? previous.impactClock : g.clock,
    };
    const victim = heroes.find((p) => `player:${p.id}` === end.contactId);
    if (victim && !g.attackHits.includes(victim.id)) {
      damage(victim, 26);
      g.attackHits.push(victim.id);
    }
    if (!g.timer) {
      phase(g, g.grounded > 0 ? "LAND" : "FLY", 0);
      g.cooldown = 2.5;
    }
    return;
  }
  if (g.phase === "HEADBUTT") {
    const nx = g.x + Math.cos(g.facing) * 720 * dt,
      ny = g.y + Math.sin(g.facing) * 720 * dt;
    const hitPillar = griffinPillars.findIndex(
      (r, i) => !g.pillars[i] && segmentHits(g.x, g.y, nx, ny, r, 28),
    );
    if (hitPillar >= 0) {
      g.pillars[hitPillar] = true;
      phase(g, "STUNNED", 6);
      g.grounded = 10;
      w.worldRevision++;
      return;
    }
    const before = { x: g.x, y: g.y };
    Object.assign(
      g,
      constrainMotion(
        g,
        { x: nx - g.x, y: ny - g.y },
        maps.GRIFFIN_ENCLOSURE,
        walls,
      ),
    );
    g.y = Math.max(410, g.y);
    for (const p of heroes)
      if (
        !g.attackHits.includes(p.id) &&
        segmentHits(
          before.x,
          before.y,
          g.x,
          g.y,
          { x: p.x - 17, y: p.y - 17, w: 34, h: 34 },
          22,
        )
      ) {
        damage(p, 32);
        g.attackHits.push(p.id);
      }
    if (!g.timer || Math.hypot(g.x - before.x, g.y - before.y) < 1) {
      phase(g, "LAND", 0);
      g.cooldown = 2;
      g.stationary = 0;
    }
    return;
  }
  // Nest intrusion overrides a normal flight patrol; stunned/distraction windows remain safe.
  if (coco && coco.y < 240 && (coco.flightRemaining ?? 0) > 0) {
    g.grounded = 0;
    phase(g, "FLY", 0);
    walk(coco.x, coco.y, 240, true);
    if (Math.hypot(g.x - coco.x, g.y - coco.y) < 70 && !g.cooldown) {
      damage(coco, 20);
      g.cooldown = 1.5;
    }
    return;
  }
  g.grounded = Math.max(0, g.grounded - dt);
  if (g.grounded > 0) {
    phase(g, "LAND", 0);
    if (sieg && g.stationary >= 1.4 && !g.cooldown) {
      g.aimX = sieg.x;
      g.aimY = sieg.y;
      g.facing = Math.atan2(sieg.y - g.y, sieg.x - g.x);
      phase(g, "HEADBUTT_CHARGE", 0.7);
      return;
    }
    if (Math.hypot(target.x - g.x, target.y - g.y) > 120)
      walk(target.x, Math.max(430, target.y), 90, false);
  } else {
    if (g.phase === "LAND") phase(g, "TAKEOFF", 0.9);
    if (g.phase === "TAKEOFF" && g.timer > 0) return;
    phase(g, "FLY", 0);
    walk(640 + Math.sin(g.clock * 0.45) * 360, 312, 110, true);
  }
  if (!g.cooldown && Math.hypot(target.x - g.x, target.y - g.y) < 1000) {
    g.aimX = target.x;
    g.aimY = target.y;
    g.facing = Math.atan2(target.y - g.y, target.x - g.x);
    // Aim from the actual mouth, so the drawn beam and server collision agree.
    const mouth = griffinMouth(g);
    g.facing = Math.atan2(target.y - mouth.y, target.x - mouth.x);
    delete g.beam;
    delete g.beamStarted;
    phase(g, "BEAM_CHARGE", 1.2);
  }
}
