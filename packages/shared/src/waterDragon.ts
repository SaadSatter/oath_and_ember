import { SERVER_HZ } from "./constants.js";

// Alden's water dragon (the prologue rescue). It surges out of the spell
// circle, laps the whole clearing, then weaves through the ring of monsters
// and swallows each one in turn. The route is a pure function of the cast, so
// the server (which kills each monster as the head reaches it) and every
// client (which draws the dragon) agree on where it is at every tick.

export interface Point {
  x: number;
  y: number;
}
export interface DragonCast {
  /** Tick the dragon breaks the ground. */
  start: number;
  /** Tick it has burst into rain and is gone. */
  end: number;
  /** The middle of the spell circle; the lap goes around it. */
  centre: Point;
  /** Its meals, in the order it eats them, with the tick each is swallowed. */
  prey: { id: string; x: number; y: number; at: number }[];
}

/** How fast the head travels, in world units per second. */
export const DRAGON_SPEED = 640;
/** Head to tail, in world units: long enough to coil around the clearing. */
export const DRAGON_LENGTH = 1500;
/** After the last bite it rises and bursts into rain over this long. */
export const DRAGON_BURST_SECONDS = 1;
/** The lap around the clearing (just inside the trees). */
const LAP = { rx: 350, ry: 225 };
/** Where it breaks the ground: inside the circle, south-west of its middle. */
const EMERGE_ANGLE = (3 * Math.PI) / 4;

export interface DragonRoute {
  /** Evenly spaced samples along the route. */
  points: Point[];
  /** Distance along the route of each sample. */
  lengths: number[];
  total: number;
  /** Distance along the route at which each monster is swallowed. */
  bites: number[];
}

/** A smooth curve through the control points (Catmull-Rom). */
function spline(controls: Point[], steps = 20) {
  const out: Point[] = [];
  for (let i = 0; i < controls.length - 1; i++) {
    const p0 = controls[Math.max(0, i - 1)],
      p1 = controls[i],
      p2 = controls[i + 1],
      p3 = controls[Math.min(controls.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps,
        t2 = t * t,
        t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b +
          (-a + c) * t +
          (2 * a - 5 * b + 4 * c - d) * t2 +
          (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(controls[controls.length - 1]);
  return out;
}

/** Normalise an angle into [from, from + 2π). */
const after = (angle: number, from: number) =>
  from + ((((angle - from) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));

/**
 * The route: out of the circle, one full lap of the clearing, then through
 * each monster (in the order given), and up and away to the north.
 */
export function dragonRoute(centre: Point, prey: Point[]): DragonRoute {
  const lap = (a: number, wobble = 1) => ({
    x: centre.x + Math.cos(a) * LAP.rx * (1 + 0.05 * Math.sin(3 * a) * wobble),
    y: centre.y + Math.sin(a) * LAP.ry * (1 + 0.05 * Math.sin(3 * a) * wobble),
  });
  const controls: Point[] = [
    {
      x: centre.x + Math.cos(EMERGE_ANGLE) * 110,
      y: centre.y + Math.sin(EMERGE_ANGLE) * 70,
    },
  ];
  // A full lap, clockwise on screen, starting where it broke the ground.
  const laps = 12;
  for (let i = 0; i <= laps; i++)
    controls.push(lap(EMERGE_ANGLE + ((i + 0.4) * 2 * Math.PI) / laps));
  // Then in among the monsters, swinging out a little between bites.
  const bites: number[] = [];
  const preyCentre = prey.length
    ? {
        x: prey.reduce((n, p) => n + p.x, 0) / prey.length,
        y: prey.reduce((n, p) => n + p.y, 0) / prey.length,
      }
    : centre;
  let previous = controls[controls.length - 1];
  for (const p of prey) {
    const mid = { x: (previous.x + p.x) / 2, y: (previous.y + p.y) / 2 },
      out = Math.atan2(mid.y - preyCentre.y, mid.x - preyCentre.x);
    controls.push({
      x: mid.x + Math.cos(out) * 26,
      y: mid.y + Math.sin(out) * 18,
    });
    bites.push(controls.length);
    controls.push({ x: p.x, y: p.y });
    previous = p;
  }
  // Up over Alden's head, where it bursts.
  controls.push({ x: centre.x + 40, y: centre.y - 200 });
  controls.push({ x: centre.x - 30, y: centre.y - 290 });
  const steps = 20,
    points = spline(controls, steps),
    lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(
      lengths[i - 1] +
        Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y),
    );
  return {
    points,
    lengths,
    total: lengths[lengths.length - 1],
    // Control point k is sample k * steps.
    bites: bites.map((k) => lengths[k * steps]),
  };
}

/** Where along the route the head is `distance` units in, and which way it faces. */
export function routeAt(route: DragonRoute, distance: number) {
  const { points, lengths } = route;
  const d = Math.max(0, Math.min(route.total, distance));
  let lo = 0,
    hi = lengths.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid] <= d) lo = mid;
    else hi = mid;
  }
  const a = points[lo],
    b = points[hi],
    span = lengths[hi] - lengths[lo] || 1,
    t = (d - lengths[lo]) / span;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: Math.atan2(b.y - a.y, b.x - a.x),
  };
}

/**
 * Cast the dragon at `tick`. Monsters are eaten going round the ring from the
 * point the lap ends, so its path never doubles back on itself.
 */
export function castDragon(
  tick: number,
  centre: Point,
  monsters: { id: string; x: number; y: number }[],
): DragonCast {
  const ringCentre = monsters.length
    ? {
        x: monsters.reduce((n, p) => n + p.x, 0) / monsters.length,
        y: monsters.reduce((n, p) => n + p.y, 0) / monsters.length,
      }
    : centre;
  const order = [...monsters].sort(
    (a, b) =>
      after(Math.atan2(a.y - ringCentre.y, a.x - ringCentre.x), EMERGE_ANGLE) -
        after(Math.atan2(b.y - ringCentre.y, b.x - ringCentre.x), EMERGE_ANGLE) ||
      a.id.localeCompare(b.id),
  );
  const route = dragonRoute(centre, order);
  const ticksAt = (distance: number) =>
    tick + Math.ceil((distance / DRAGON_SPEED) * SERVER_HZ);
  return {
    start: tick,
    end: ticksAt(route.total) + Math.ceil(DRAGON_BURST_SECONDS * SERVER_HZ),
    centre: { ...centre },
    prey: order.map((m, i) => ({
      id: m.id,
      x: m.x,
      y: m.y,
      at: ticksAt(route.bites[i]),
    })),
  };
}

/** The route of a cast (the same on the server and every client). */
export const castRoute = (cast: DragonCast) => dragonRoute(cast.centre, cast.prey);
