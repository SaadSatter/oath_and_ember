import type { Rect } from "./gameTypes.js";
// Grid navigation around walls. Enemies chase straight at a target they can
// reach directly; when a wall is in the way they follow a grid path around it.
// Story walks use it too (storyWalk.ts), on the server and in prediction.
// Paths are recomputed from the current world every tick and keep no per-enemy
// memory, so identical worlds always produce identical enemy motion.
export const NAV_CELL = 16;
const MAX_EXPANSIONS = 6000;
interface Grid {
  cols: number;
  rows: number;
  blocked: Uint8Array;
}
// Occupancy grids depend only on the walls and the body size, so they are
// memoized by an exact layout signature. Puzzle changes produce a new layout.
const grids = new Map<string, Grid>();
function gridFor(
  walls: Rect[],
  width: number,
  height: number,
  halfWidth: number,
  halfHeight: number,
): Grid {
  let key = `${width},${height},${halfWidth},${halfHeight}`;
  for (const r of walls) key += `|${r.x},${r.y},${r.w},${r.h}`;
  const cached = grids.get(key);
  if (cached) return cached;
  const cols = Math.ceil(width / NAV_CELL),
    rows = Math.ceil(height / NAV_CELL),
    blocked = new Uint8Array(cols * rows);
  // A cell is blocked when a body centred on it would overlap a wall or leave
  // the map, which is exactly the rule movement enforces.
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const x = (col + 0.5) * NAV_CELL,
        y = (row + 0.5) * NAV_CELL;
      if (
        x < halfWidth ||
        y < halfHeight ||
        x > width - halfWidth ||
        y > height - halfHeight
      )
        blocked[row * cols + col] = 1;
    }
  for (const r of walls) {
    const c0 = Math.max(0, Math.floor((r.x - halfWidth) / NAV_CELL - 0.5)),
      c1 = Math.min(cols - 1, Math.ceil((r.x + r.w + halfWidth) / NAV_CELL)),
      r0 = Math.max(0, Math.floor((r.y - halfHeight) / NAV_CELL - 0.5)),
      r1 = Math.min(rows - 1, Math.ceil((r.y + r.h + halfHeight) / NAV_CELL));
    for (let row = r0; row <= r1; row++)
      for (let col = c0; col <= c1; col++) {
        const x = (col + 0.5) * NAV_CELL,
          y = (row + 0.5) * NAV_CELL;
        if (
          x + halfWidth > r.x &&
          x - halfWidth < r.x + r.w &&
          y + halfHeight > r.y &&
          y - halfHeight < r.y + r.h
        )
          blocked[row * cols + col] = 1;
      }
  }
  if (grids.size > 64) grids.delete(grids.keys().next().value!);
  const grid = { cols, rows, blocked };
  grids.set(key, grid);
  return grid;
}
// Whether a body can travel the straight segment between two points.
export function bodyPathClear(
  a: { x: number; y: number },
  b: { x: number; y: number },
  walls: Rect[],
  halfWidth: number,
  halfHeight: number,
) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
  for (let n = 1; n <= steps; n++) {
    const x = a.x + ((b.x - a.x) * n) / steps,
      y = a.y + ((b.y - a.y) * n) / steps;
    if (
      walls.some(
        (r) =>
          x + halfWidth > r.x &&
          x - halfWidth < r.x + r.w &&
          y + halfHeight > r.y &&
          y - halfHeight < r.y + r.h,
      )
    )
      return false;
  }
  return true;
}
// Small binary min-heap keyed by f-score, tie-broken by cell index so the
// expansion order (and therefore the route) is deterministic.
class Heap {
  private a: { f: number; i: number }[] = [];
  get size() {
    return this.a.length;
  }
  private less(x: number, y: number) {
    const a = this.a;
    return a[x].f < a[y].f || (a[x].f === a[y].f && a[x].i < a[y].i);
  }
  private swap(x: number, y: number) {
    const t = this.a[x];
    this.a[x] = this.a[y];
    this.a[y] = t;
  }
  push(f: number, i: number) {
    this.a.push({ f, i });
    for (let n = this.a.length - 1; n > 0; ) {
      const p = (n - 1) >> 1;
      if (!this.less(n, p)) break;
      this.swap(n, p);
      n = p;
    }
  }
  pop() {
    const top = this.a[0];
    const last = this.a.pop()!;
    if (this.a.length) {
      this.a[0] = last;
      for (let n = 0; ; ) {
        const l = n * 2 + 1,
          r = l + 1;
        let m = n;
        if (l < this.a.length && this.less(l, m)) m = l;
        if (r < this.a.length && this.less(r, m)) m = r;
        if (m === n) break;
        this.swap(n, m);
        n = m;
      }
    }
    return top;
  }
}
// The open cell closest to an actual position (ties by index). A body grazing
// a wall sits in a "blocked" cell; scanning neighbours in a fixed order could
// pick one behind it, and the path start would flip from tick to tick.
const nearestOpen = (grid: Grid, p: { x: number; y: number }) => {
  const col = Math.floor(p.x / NAV_CELL),
    row = Math.floor(p.y / NAV_CELL);
  let best = -1,
    bestDistance = Infinity;
  for (let r = row - 3; r <= row + 3; r++)
    for (let c = col - 3; c <= col + 3; c++) {
      if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) continue;
      const i = r * grid.cols + c;
      if (grid.blocked[i]) continue;
      const d = Math.hypot(
        (c + 0.5) * NAV_CELL - p.x,
        (r + 0.5) * NAV_CELL - p.y,
      );
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
  return best;
};
// The point an enemy should steer toward to reach `to` around walls, or null
// when no route exists (it then keeps its direct approach).
export function steerTarget(
  from: { x: number; y: number },
  to: { x: number; y: number },
  walls: Rect[],
  width: number,
  height: number,
  halfWidth: number,
  halfHeight: number,
): { x: number; y: number } | null {
  if (bodyPathClear(from, to, walls, halfWidth, halfHeight)) return to;
  const grid = gridFor(walls, width, height, halfWidth, halfHeight);
  const start = nearestOpen(grid, from),
    goal = nearestOpen(grid, to);
  if (start < 0 || goal < 0) return null;
  const cols = grid.cols,
    gx = goal % cols,
    gy = Math.floor(goal / cols);
  const cost = new Map<number, number>([[start, 0]]),
    came = new Map<number, number>(),
    open = new Heap();
  const h = (i: number) => {
    const dx = Math.abs((i % cols) - gx),
      dy = Math.abs(Math.floor(i / cols) - gy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  open.push(h(start), start);
  let found = start === goal,
    expansions = 0;
  while (open.size && !found && expansions++ < MAX_EXPANSIONS) {
    const { i } = open.pop();
    const x = i % cols,
      y = Math.floor(i / cols),
      g = cost.get(i)!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= grid.rows) continue;
      const n = ny * cols + nx;
      if (grid.blocked[n]) continue;
      // Diagonals never cut a blocked corner.
      if (dx && dy && (grid.blocked[y * cols + nx] || grid.blocked[ny * cols + x]))
        continue;
      const next = g + (dx && dy ? Math.SQRT2 : 1);
      if (next >= (cost.get(n) ?? Infinity)) continue;
      cost.set(n, next);
      came.set(n, i);
      if (n === goal) {
        found = true;
        break;
      }
      open.push(next + h(n), n);
    }
  }
  if (!found) return null;
  const route: { x: number; y: number }[] = [];
  for (let i = goal; i !== start; i = came.get(i)!)
    route.push({
      x: ((i % cols) + 0.5) * NAV_CELL,
      y: (Math.floor(i / cols) + 0.5) * NAV_CELL,
    });
  route.reverse();
  if (!route.length) return to;
  // Head for the furthest waypoint still in direct reach, so the enemy cuts
  // smoothly around corners instead of zig-zagging cell by cell.
  for (let n = route.length - 1; n > 0; n--)
    if (bodyPathClear(from, route[n], walls, halfWidth, halfHeight))
      return route[n];
  return route[0];
}
