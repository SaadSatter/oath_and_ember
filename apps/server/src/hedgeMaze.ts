import {
  DT,
  HALF,
  SLOW_TIME_SCALE,
} from "../../../packages/shared/src/constants.js";
import {
  hedgeMazeState,
  mazeBurnBush,
  mazeCowRect,
  mazeDynamicWalls,
  mazeEnemySpawns,
  mazeGate,
  mazePuzzle,
  newHedgeMaze,
} from "../../../packages/shared/src/hedgeMaze.js";
import type {
  World,
  Player,
  Rect,
} from "../../../packages/shared/src/gameTypes.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import { constrainMotion } from "../../../packages/shared/src/movement.js";
import { spawnEnemy } from "../../../packages/shared/src/enemies.js";
import { segmentHits } from "./enemySimulation.js";
import type { InventoryService } from "./inventory.js";
export const MAZE_RUNNER_TARGET = "hedge-runner-key",
  MAZE_GATE_TARGET = "hedge-chest-gate",
  MAZE_CHEST_TARGET = "hedge-shears-chest";
export function ensureHedgeMaze(w: World, inventory: InventoryService) {
  if (!w.puzzles.hedgeMaze) {
    w.puzzles.hedgeMaze = { ...mazePuzzle("hedgeMaze"), maze: newHedgeMaze() };
    w.puzzles.hedgeGate = mazePuzzle("hedgeGate");
  }
  if (!inventory.targets.has(MAZE_RUNNER_TARGET)) {
    inventory.register(w, {
      id: MAZE_RUNNER_TARGET,
      name: "Forest wolf · E to take key",
      kind: "chest",
      sceneId: "HEDGE_MAZE",
      x: 0,
      y: 0,
      reward: "hedge_gate_key",
      available: (state, player) =>
        !!state.slowTime &&
        player.role === "OATH" &&
        (player.sprintRemaining ?? 0) > 0 &&
        Math.hypot(
          player.x - state.puzzles.hedgeMaze.maze!.runner.x,
          player.y - state.puzzles.hedgeMaze.maze!.runner.y,
        ) <= 42,
    });
    inventory.register(w, {
      id: MAZE_GATE_TARGET,
      name: "Hedge Gate",
      kind: "gate",
      sceneId: "HEDGE_MAZE",
      x: 39.2 * 32,
      y: 14 * 32,
      itemId: "hedge_gate_key",
    });
    inventory.register(w, {
      id: MAZE_CHEST_TARGET,
      name: "Shears Chest",
      kind: "chest",
      sceneId: "HEDGE_MAZE",
      x: 44 * 32,
      y: 5 * 32,
      reward: "enchanted_shears",
      available: (state) => !!state.puzzles.hedgeGate?.complete,
    });
  }
  updateHedgeMazeTargets(w, inventory);
}
export function spawnMazeEnemies() {
  return Object.fromEntries(
    mazeEnemySpawns.map((e) => [
      e.id,
      {
        ...spawnEnemy(e.id, e.type, e.x, e.y),
      },
    ]),
  );
}
export function updateHedgeMazeTargets(w: World, inventory: InventoryService) {
  const state = hedgeMazeState(w.puzzles);
  if (!state) return;
  state.runner.caught = !!w.inventory?.claimed.includes(MAZE_RUNNER_TARGET);
  if (w.inventory?.unlocked.includes(MAZE_GATE_TARGET))
    w.puzzles.hedgeGate.complete = true;
  const target = inventory.targets.get(MAZE_RUNNER_TARGET);
  if (target) {
    target.x = state.runner.x;
    target.y = state.runner.y;
    if (w.inventoryTargets?.[target.id])
      Object.assign(w.inventoryTargets[target.id], {
        x: target.x,
        y: target.y,
      });
  }
  if (state.runner.caught) delete w.inventoryTargets?.[MAZE_RUNNER_TARGET];
}
function firstContact(
  a: { x: number; y: number },
  b: { x: number; y: number },
  r: Rect,
) {
  if (!segmentHits(a.x, a.y, b.x, b.y, r, 4)) return Infinity;
  let lo = 0,
    hi = 1;
  for (let k = 0; k < 16; k++) {
    const mid = (lo + hi) / 2;
    if (
      segmentHits(
        a.x,
        a.y,
        a.x + (b.x - a.x) * mid,
        a.y + (b.y - a.y) * mid,
        r,
        4,
      )
    )
      hi = mid;
    else lo = mid;
  }
  return hi;
}
export function burnMazeBush(
  w: World,
  owner: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const state = hedgeMazeState(w.puzzles);
  if (
    w.sceneId !== "HEDGE_MAZE" ||
    !state ||
    state.burned ||
    w.players[owner]?.role !== "EMBER"
  )
    return false;
  const contact = firstContact(from, to, mazeBurnBush);
  if (!Number.isFinite(contact)) return false;
  const other = [
    ...maps.HEDGE_MAZE.walls,
    mazeCowRect(state),
    ...(!w.puzzles.hedgeGate.complete ? [mazeGate] : []),
  ];
  if (other.some((r) => firstContact(from, to, r) < contact - 1e-6))
    return false;
  state.burned = true;
  w.worldRevision++;
  return true;
}
export function pullMazeCow(
  w: World,
  hole: { x: number; y: number; sceneId: string },
  speed: number,
) {
  const state = hedgeMazeState(w.puzzles);
  if (hole.sceneId !== "HEDGE_MAZE" || !state || state.cow.parked) return;
  const cow = state.cow,
    distance = Math.hypot(hole.x - cow.x, hole.y - cow.y);
  if (distance > 96 || distance < 1) return;
  const walls = [
    ...maps.HEDGE_MAZE.walls,
    ...(!state.burned ? [mazeBurnBush] : []),
    ...(!w.puzzles.hedgeGate.complete ? [mazeGate] : []),
  ];
  if (walls.some((r) => segmentHits(hole.x, hole.y, cow.x, cow.y, r))) return;
  // The grazing bay has a horizontal physical lane. Never teleport or pull through its walls.
  const dx =
    Math.max(
      23.8 * 32,
      Math.min(
        26 * 32,
        cow.x +
          ((hole.x - cow.x) / distance) *
            speed *
            DT *
            (w.slowTime ? SLOW_TIME_SCALE : 1),
      ),
    ) - cow.x;
  const expanded = walls.map((r) => ({
    x: r.x - (64 - HALF),
    y: r.y - (64 - HALF),
    w: r.w + 2 * (64 - HALF),
    h: r.h + 2 * (64 - HALF),
  }));
  const next = constrainMotion(cow, { x: dx, y: 0 }, maps.HEDGE_MAZE, expanded);
  if (
    Object.values(w.players).some(
      (p) =>
        (p.sceneId ?? w.sceneId) === "HEDGE_MAZE" &&
        p.hp > 0 &&
        Math.abs(p.x - next.x) < 64 + HALF &&
        Math.abs(p.y - next.y) < 64 + HALF,
    )
  )
    return;
  cow.x = next.x;
  cow.y = next.y;
  cow.parked = cow.x <= 23.85 * 32;
}
const cellKey = (x: number, y: number) => y * 48 + x;
function mazeNavigation(w: World) {
  const walls = collisionRects("HEDGE_MAZE", w.puzzles);
  const cells = new Map<number, { x: number; y: number }>();
  for (let y = 4; y < 22; y++)
    for (let x = 2; x < 40; x++) {
      const p = { x: (x + 0.5) * 32, y: (y + 0.5) * 32 };
      if (
        !walls.some(
          (r) =>
            p.x + HALF > r.x &&
            p.x - HALF < r.x + r.w &&
            p.y + HALF > r.y &&
            p.y - HALF < r.y + r.h,
        )
      )
        cells.set(cellKey(x, y), p);
    }
  return cells;
}
function neighbors(key: number, cells: Map<number, unknown>) {
  return [key - 1, key + 1, key - 48, key + 48].filter(
    (n) => cells.has(n) && Math.abs((n % 48) - (key % 48)) <= 1,
  );
}
function distances(start: number, cells: Map<number, unknown>) {
  const d = new Map([[start, 0]]),
    q = [start];
  for (let i = 0; i < q.length; i++)
    for (const n of neighbors(q[i], cells))
      if (!d.has(n)) {
        d.set(n, d.get(q[i])! + 1);
        q.push(n);
      }
  return d;
}
// Faster than Sieg both walking (190) and sprinting (380). Slow Time still
// scales the wolf, while boosted Sieg retains normal speed (190).
export const mazeWolf = {
  detectionRadius: 1000,
  speed: 430,
  alertSpeed: 560,
} as const;
export function tickMazeRunner(w: World) {
  const state = hedgeMazeState(w.puzzles);
  if (w.sceneId !== "HEDGE_MAZE" || !state || state.runner.caught) return;
  const runner = state.runner,
    players = Object.values(w.players).filter(
      (p) =>
        p.connected &&
        p.hp > 0 &&
        (p.sceneId ?? w.sceneId) === "HEDGE_MAZE" &&
        Math.hypot(p.x - runner.x, p.y - runner.y) <= mazeWolf.detectionRadius,
    );
  if (!players.length) return;
  const speed = players.some(
    (p) => p.role === "OATH" && (p.sprintRemaining ?? 0) > 0,
  )
    ? mazeWolf.alertSpeed
    : mazeWolf.speed;
  const advance = (waypoint: { x: number; y: number }) => {
    const dx = waypoint.x - runner.x,
      dy = waypoint.y - runner.y,
      len = Math.hypot(dx, dy);
    if (!len) {
      delete runner.waypoint;
      return;
    }
    const step = Math.min(len, speed * DT * (w.slowTime ? SLOW_TIME_SCALE : 1));
    const position = constrainMotion(
      runner,
      { x: (dx / len) * step, y: (dy / len) * step },
      maps.HEDGE_MAZE,
      collisionRects("HEDGE_MAZE", w.puzzles),
    );
    runner.facing = Math.atan2(dy, dx);
    runner.x = position.x;
    runner.y = position.y;
    if (Math.hypot(runner.x - waypoint.x, runner.y - waypoint.y) < 0.001)
      delete runner.waypoint;
  };
  if (runner.waypoint) {
    advance(runner.waypoint);
    return;
  }
  const cells = mazeNavigation(w),
    start = cellKey(Math.floor(runner.x / 32), Math.floor(runner.y / 32));
  if (!cells.has(start)) return;
  const threats = players.map((player) => {
    const closest = [...cells].sort(
      (a, b) =>
        Math.hypot(a[1].x - player.x, a[1].y - player.y) -
          Math.hypot(b[1].x - player.x, b[1].y - player.y) || a[0] - b[0],
    )[0][0];
    return distances(closest, cells);
  });
  const reachable = distances(start, cells);
  const score = (key: number) =>
    Math.min(...threats.map((d) => d.get(key) ?? 0));
  // Choose a new safe destination from both live hero positions, never a fixed patrol.
  const goal = [...reachable.keys()].sort(
    (a, b) =>
      score(b) - score(a) || reachable.get(a)! - reachable.get(b)! || a - b,
  )[0];
  const back = distances(goal, cells);
  const next = neighbors(start, cells)
    .filter((n) => (back.get(n) ?? Infinity) < (back.get(start) ?? 0))
    .sort((a, b) => score(b) - score(a) || a - b)[0];
  const center = cells.get(start)!;
  const waypoint =
    Math.hypot(runner.x - center.x, runner.y - center.y) > 1
      ? center
      : cells.get(next);
  if (!waypoint) return;
  runner.waypoint = waypoint;
  advance(waypoint);
}
