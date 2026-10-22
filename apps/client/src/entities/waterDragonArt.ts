import { SERVER_HZ } from "../../../../packages/shared/src/constants.js";
import {
  DRAGON_BURST_SECONDS,
  DRAGON_LENGTH,
  DRAGON_SPEED,
  routeAt,
  type DragonCast,
  type DragonRoute,
} from "../../../../packages/shared/src/waterDragon.js";

// The look of Alden's water dragon: a scaly serpent of living water with pale
// belly plates, a spiky crest and a horned head. It is painted at half the
// world's resolution, then every pixel is snapped to a small water palette
// (fades become an ordered dither), so it reads as pixel art like the rest of
// the game. Where it is comes only from the shared route; nothing here
// touches the world.

/** World units per dragon pixel. */
export const DRAGON_PIXEL = 2;

const OUTLINE = "#102c63",
  DEEP = "#1b55a8",
  BODY = "#2a7fd8",
  LIT = "#4fa8ee",
  SHINE = "#a9e4ff",
  WHITE = "#f2fdff",
  BELLY = "#b5ecf6",
  SEAM = "#6cbfe0",
  FIN = "#79d3f7",
  HORN = "#e2f7ff",
  MOUTH = "#0a1b40",
  EYE = "#fff2a8";
const PALETTE = [
  OUTLINE,
  DEEP,
  BODY,
  LIT,
  SHINE,
  WHITE,
  BELLY,
  SEAM,
  FIN,
  HORN,
  MOUTH,
  EYE,
].map((hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]);
/** 4×4 ordered-dither thresholds: partly faded pixels drop out in a pattern. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Distance between body samples, in world units. */
const STEP = 7;
const TAU = Math.PI * 2;
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

interface Segment {
  x: number;
  y: number;
  angle: number;
  r: number;
  /** Distance along the route. */
  s: number;
}

/** Snap a canvas to the palette, with hard (dithered) edges. */
function pixelate(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const image = ctx.getImageData(0, 0, w, h),
    d = image.data,
    nearest = new Map<number, number[]>();
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const a = d[i + 3];
    if (!a) continue;
    const x = p % w,
      y = (p / w) | 0;
    if (a < 250 && a / 255 <= (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16) {
      d[i + 3] = 0;
      continue;
    }
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    let c = nearest.get(key);
    if (!c) {
      let best = Infinity;
      for (const q of PALETTE) {
        const dist =
          (q[0] - d[i]) ** 2 + (q[1] - d[i + 1]) ** 2 + (q[2] - d[i + 2]) ** 2;
        if (dist < best) {
          best = dist;
          c = q;
        }
      }
      nearest.set(key, c!);
    }
    d[i] = c![0];
    d[i + 1] = c![1];
    d[i + 2] = c![2];
    d[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

export class DragonPainter {
  /** Over everything: the dragon, its bites and its rain. */
  readonly air: HTMLCanvasElement;
  /** On the ground: its shadow and the pool it rises from. */
  readonly ground: HTMLCanvasElement;
  private solid: HTMLCanvasElement;
  private shadow: HTMLCanvasElement;
  private w: number;
  private h: number;
  constructor(worldWidth: number, worldHeight: number) {
    this.w = Math.ceil(worldWidth / DRAGON_PIXEL);
    this.h = Math.ceil(worldHeight / DRAGON_PIXEL);
    this.air = canvas(this.w, this.h);
    this.ground = canvas(this.w, this.h);
    this.solid = canvas(this.w, this.h);
    this.shadow = canvas(this.w, this.h);
  }

  /** Paint the dragon `t` seconds after it was cast. */
  paint(cast: DragonCast, route: DragonRoute, t: number) {
    const burst = clamp01(
      (t - route.total / DRAGON_SPEED) / DRAGON_BURST_SECONDS,
    );
    const body = this.body(route, t, burst);
    const ctx = (c: HTMLCanvasElement) => {
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.clearRect(0, 0, this.w, this.h);
      return g;
    };
    const air = ctx(this.air),
      ground = ctx(this.ground);
    const world = (g: CanvasRenderingContext2D) =>
      g.setTransform(1 / DRAGON_PIXEL, 0, 0, 1 / DRAGON_PIXEL, 0, 0);
    // The ground: the pool, snapped to the palette, then the shadow over it.
    world(ground);
    this.drawPool(ground, route, t);
    pixelate(ground, this.w, this.h);
    const shade = ctx(this.shadow);
    world(shade);
    this.drawShadow(shade, body);
    ground.setTransform(1, 0, 0, 1, 0, 0);
    ground.globalAlpha = 0.24 * (1 - burst);
    ground.drawImage(this.shadow, 0, 0);
    ground.globalAlpha = 1;
    // The dragon, drawn solid then laid down at once (so it fades evenly).
    if (burst < 1 && body.length) {
      const solid = ctx(this.solid);
      world(solid);
      this.drawBody(solid, body, t);
      this.drawHead(solid, body[0], this.jaw(cast, t, burst), t);
      air.globalAlpha = Math.pow(1 - burst, 1.5);
      air.drawImage(this.solid, 0, 0);
      air.globalAlpha = 1;
    }
    world(air);
    this.drawBites(air, cast, t);
    if (burst > 0) this.drawRain(air, body, burst);
    air.setTransform(1, 0, 0, 1, 0, 0);
    pixelate(air, this.w, this.h);
    return { burst };
  }

  /** Head to tail. The part still below ground is not there yet. */
  private body(route: DragonRoute, t: number, burst: number): Segment[] {
    const head = Math.min(route.total, t * DRAGON_SPEED),
      n = Math.floor(DRAGON_LENGTH / STEP),
      out: Segment[] = [];
    for (let k = 0; k <= n; k++) {
      const s = head - k * STEP;
      if (s < 0) break;
      const at = routeAt(route, s),
        u = k / n;
      // It swims: a wave runs down the body (the head stays on its course).
      const sway = 9 * Math.min(1, k / 12) * Math.sin(k * 0.16 - t * 9),
        across = at.angle + Math.PI / 2;
      let r =
        u < 0.05
          ? 22 + 9 * (u / 0.05)
          : 31 * (1 - Math.pow((u - 0.05) / 0.95, 1.3)) + 3;
      // Breaking the surface, it is thinner where it meets the ground.
      r *= 0.6 + 0.4 * Math.min(1, s / 160);
      r *= 1 + 0.35 * burst;
      out.push({
        x: at.x + Math.cos(across) * sway,
        y: at.y + Math.sin(across) * sway,
        angle: at.angle,
        r,
        s,
      });
    }
    return out;
  }

  /** The pool it broke out of churns while its tail is still coming through. */
  private drawPool(g: CanvasRenderingContext2D, route: DragonRoute, t: number) {
    const start = route.points[0],
      tailOut = DRAGON_LENGTH / DRAGON_SPEED,
      pool = clamp01(Math.min(t / 0.3, (tailOut + 0.8 - t) / 0.8));
    if (pool <= 0) return;
    g.globalAlpha = pool;
    const ring = (rx: number, ry: number, color: string) => {
      g.fillStyle = color;
      g.beginPath();
      g.ellipse(start.x, start.y, rx, ry, 0, 0, TAU);
      g.fill();
    };
    ring(62, 36, OUTLINE);
    ring(56, 32, DEEP);
    ring(44, 24, BODY);
    g.strokeStyle = SHINE;
    g.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const spin = t * (3 + i) + i * 2;
      g.beginPath();
      g.ellipse(start.x, start.y, 16 + i * 13, 9 + i * 7.5, 0, spin, spin + 2.2);
      g.stroke();
    }
    // Foam thrown up around the rim.
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + t * 0.8,
        bob = Math.abs(Math.sin(t * 9 + i * 1.7)) * 8;
      g.fillStyle = i % 3 ? WHITE : FIN;
      g.fillRect(
        start.x + Math.cos(a) * 60 - 2,
        start.y + Math.sin(a) * 34 - bob - 2,
        4,
        4,
      );
    }
    g.globalAlpha = 1;
  }

  private drawShadow(g: CanvasRenderingContext2D, body: Segment[]) {
    g.fillStyle = "#04121e";
    for (let k = body.length - 1; k >= 0; k -= 2) {
      const b = body[k],
        lift = Math.min(1, b.s / 160);
      g.beginPath();
      g.ellipse(b.x + 10 * lift, b.y + 40 * lift, b.r * 0.9, b.r * 0.55, 0, 0, TAU);
      g.fill();
    }
  }

  private drawBody(g: CanvasRenderingContext2D, body: Segment[], t: number) {
    const tail = body.length - 1;
    const disc = (x: number, y: number, r: number, color: string) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(x, y, Math.max(0.5, r), 0, TAU);
      g.fill();
    };
    const spike = (points: number[][], fill: string) => {
      g.fillStyle = fill;
      g.strokeStyle = OUTLINE;
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(points[0][0], points[0][1]);
      for (const [x, y] of points.slice(1)) g.lineTo(x, y);
      g.closePath();
      g.fill();
      g.stroke();
    };
    // The crest along its back: spikes swept toward the tail, standing up
    // behind the body (light from the north, as on the rest of the map).
    for (let k = tail - (tail % 3); k >= 3; k -= 3) {
      const b = body[k],
        u = k / tail;
      if (u > 0.88) continue;
      const dx = Math.cos(b.angle),
        dy = Math.sin(b.angle),
        lean = Math.sin(t * 8 + k * 0.35) * 3,
        h = b.r * (0.8 + 0.25 * hash(k)),
        baseY = b.y - b.r * 0.55;
      spike(
        [
          [b.x + dx * b.r * 0.3, baseY + dy * b.r * 0.3],
          [b.x - dx * (b.r * 0.75 + lean), baseY - dy * (b.r * 0.75 + lean) - h],
          [b.x - dx * b.r * 0.35, baseY - dy * b.r * 0.35],
        ],
        k % 2 ? FIN : SHINE,
      );
    }
    // A fan of water at the tail.
    if (tail > 10) {
      const b = body[tail],
        back = b.angle + Math.PI;
      for (const spread of [-0.65, 0, 0.65]) {
        const a = back + spread + Math.sin(t * 8 + spread) * 0.15;
        spike(
          [
            [b.x, b.y],
            [b.x + Math.cos(a - 0.2) * 44, b.y + Math.sin(a - 0.2) * 44],
            [b.x + Math.cos(a) * 34, b.y + Math.sin(a) * 34],
            [b.x + Math.cos(a + 0.2) * 44, b.y + Math.sin(a + 0.2) * 44],
          ],
          spread ? FIN : SHINE,
        );
      }
    }
    // The body, layer by layer from the tail: outline, then deep water, then
    // lighter water toward its back.
    for (let k = tail; k >= 0; k--) disc(body[k].x, body[k].y, body[k].r + 3, OUTLINE);
    for (let k = tail; k >= 0; k--) disc(body[k].x, body[k].y, body[k].r, DEEP);
    for (let k = tail; k >= 0; k--) {
      const b = body[k];
      disc(b.x, b.y - b.r * 0.14, b.r * 0.8, BODY);
    }
    for (let k = tail; k >= 0; k--) {
      const b = body[k];
      disc(b.x, b.y - b.r * 0.4, b.r * 0.42, LIT);
    }
    // Pale belly plates underneath, with a seam between each plate.
    for (let k = tail; k >= 0; k--) {
      const b = body[k];
      disc(b.x, b.y + b.r * 0.5, b.r * 0.42, k % 3 ? BELLY : SEAM);
    }
    // Scales: little forward-facing arcs over its back, in staggered rows.
    g.lineWidth = 2.5;
    for (let k = tail - (tail % 2); k >= 2; k -= 2) {
      const b = body[k],
        across = b.angle + Math.PI / 2,
        size = b.r * 0.26;
      for (const lane of k % 4 ? [-0.45, 0.15] : [-0.15, 0.45]) {
        const x = b.x + Math.cos(across) * lane * b.r * 0.6,
          y = b.y + Math.sin(across) * lane * b.r * 0.6 - b.r * 0.2;
        g.strokeStyle = lane < 0 ? DEEP : BODY;
        g.beginPath();
        g.arc(x, y, size, b.angle - 1.1, b.angle + 1.1);
        g.stroke();
      }
    }
    // The shine of moving water racing down its back.
    const flow = Math.floor(t * 30);
    for (let k = 0; k <= tail; k++) {
      if ((k + flow) % 7) continue;
      const b = body[k],
        x = b.x - Math.cos(b.angle) * 4,
        y = b.y - b.r * 0.45;
      g.strokeStyle = (k + flow) % 14 ? SHINE : WHITE;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - Math.cos(b.angle) * 18, y - Math.sin(b.angle) * 18);
      g.stroke();
    }
    // Spray thrown off its sides.
    for (let k = 0; k <= tail; k += 4) {
      const b = body[k],
        across = b.angle + Math.PI / 2;
      for (let i = 0; i < 2; i++) {
        const seed = hash(k * 3 + i),
          phase = (t * 1.6 + seed) % 1,
          side = i ? 1 : -1,
          d = b.r + 6 + phase * 22,
          size = seed > 0.6 ? 6 : 4;
        g.globalAlpha = 1 - phase;
        g.fillStyle = seed > 0.5 ? WHITE : FIN;
        g.fillRect(
          b.x + Math.cos(across) * side * d - Math.cos(b.angle) * phase * 18,
          b.y +
            Math.sin(across) * side * d -
            Math.sin(b.angle) * phase * 18 +
            phase * phase * 16,
          size,
          size,
        );
      }
    }
    g.globalAlpha = 1;
  }

  /** How far its jaws are open: wide just before each bite, snapping shut. */
  private jaw(cast: DragonCast, t: number, burst: number) {
    let open = 0.2 + 0.12 * Math.sin(t * 5);
    for (const p of cast.prey) {
      const until = (p.at - cast.start) / SERVER_HZ - t;
      if (until >= 0 && until <= 0.45) open = Math.max(open, (0.45 - until) / 0.4);
      else if (until < 0 && until > -0.18) open = Math.max(open, 1 + until / 0.18);
    }
    if (burst > 0) open = 1;
    return clamp01(open);
  }

  /** A horned dragon's head in profile, snout forward, jaw hinged open. */
  private drawHead(
    g: CanvasRenderingContext2D,
    head: Segment,
    jaw: number,
    t: number,
  ) {
    g.save();
    g.translate(head.x, head.y);
    g.rotate(head.angle);
    // Heading west it would be upside down; mirror it so its crown stays up.
    if (Math.cos(head.angle) < 0) g.scale(1, -1);
    g.scale(1.75, 1.75);
    g.lineJoin = "round";
    const shape = (points: number[][], fill: string, outline = true) => {
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(points[0][0], points[0][1]);
      for (const [x, y] of points.slice(1)) g.lineTo(x, y);
      g.closePath();
      g.fill();
      if (outline) {
        g.strokeStyle = OUTLINE;
        g.lineWidth = 1.6;
        g.stroke();
      }
    };
    const wave = (i: number) => Math.sin(t * 9 + i * 1.3) * 2.5;
    // Long whiskers flowing back from the nose, behind the jaw.
    g.strokeStyle = WHITE;
    g.lineWidth = 2.2;
    for (const [dy, phase] of [
      [6, 0],
      [10, 1.5],
    ]) {
      g.beginPath();
      for (let i = 0; i <= 11; i++) {
        const x = 54 - i * 8,
          y = dy + i * 2.4 + Math.sin(t * 7 + i * 0.7 + phase) * 3;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
    // A mane of broad water frills streaming back from the head.
    const frills = [
      [-8, -10, -42, -18, 7],
      [-12, -2, -48, -2, 7],
      [-8, 6, -40, 14, 6],
    ];
    frills.forEach(([x, y, tx, ty, wide], i) => {
      const tip = [tx, ty + wave(i)];
      shape(
        [
          [x, y - wide],
          [(x + tx) / 2, (y + ty) / 2 - wide * 0.9],
          tip,
          [(x + tx) / 2 + 4, (y + ty) / 2 + wide * 0.5],
          [x + 2, y + wide],
        ],
        i % 2 ? FIN : SHINE,
      );
      g.strokeStyle = i % 2 ? BODY : FIN;
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x - 2, y);
      g.lineTo(tip[0] + 8, tip[1] - (ty - y) * 0.1);
      g.stroke();
    });
    // A crown of swept-back plates, like horns of ice.
    const crown = [
      [10, -17, -30, -40, 5],
      [0, -15, -40, -30, 5],
      [-8, -11, -44, -20, 4],
    ];
    crown.forEach(([x, y, tx, ty, wide], i) =>
      shape(
        [
          [x + wide, y + 2],
          [x - 2, y - wide * 1.2],
          [(x + tx) / 2, (y + ty) / 2 - wide * 0.7],
          [tx, ty],
          [(x + tx) / 2 + 2, (y + ty) / 2 + wide * 0.5],
          [x - wide, y + 3],
        ],
        i === 0 ? HORN : i === 1 ? SHINE : LIT,
      ),
    );
    // A frill under the jaw.
    shape(
      [
        [-4, 8],
        [-22, 20 + wave(5)],
        [-8, 18],
        [10, 13],
      ],
      FIN,
    );
    // The lower jaw, hinged behind the eye.
    const hinge = { x: 8, y: 5 },
      turn = jaw * 0.55;
    const swing = (points: number[][]) =>
      points.map(([x, y]) => {
        const dx = x - hinge.x,
          dy = y - hinge.y;
        return [
          hinge.x + dx * Math.cos(turn) - dy * Math.sin(turn),
          hinge.y + dx * Math.sin(turn) + dy * Math.cos(turn),
        ];
      });
    const lower = swing([
      [6, 4],
      [30, 5],
      [48, 5],
      [57, 6],
      [56, 9],
      [44, 11],
      [26, 13],
      [10, 13],
      [0, 10],
    ]);
    // The inside of the mouth, and teeth along both jaws.
    shape([[6, 4], [62, 2], lower[3], lower[2], lower[1]], MOUTH, false);
    g.fillStyle = WHITE;
    for (let i = 0; i < 5; i++) {
      const x = 22 + i * 8.5;
      g.beginPath();
      g.moveTo(x - 2.4, 2.5);
      g.lineTo(x + 2.4, 2.5);
      g.lineTo(x, 2.5 + 3 + 3 * jaw);
      g.fill();
    }
    for (let i = 0; i < 4; i++) {
      const f = 0.3 + i * 0.17,
        a = lower[1],
        b = lower[3],
        x = a[0] + (b[0] - a[0]) * f,
        y = a[1] + (b[1] - a[1]) * f;
      g.beginPath();
      g.moveTo(x - 2.2, y + 0.5);
      g.lineTo(x + 2.2, y + 0.5);
      g.lineTo(x, y - 2.5 - 2.5 * jaw);
      g.fill();
    }
    shape(lower, DEEP);
    // Belly plates under the jaw.
    g.strokeStyle = BELLY;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(lower[7][0], lower[7][1] - 1.5);
    g.lineTo(lower[5][0], lower[5][1] - 1.5);
    g.stroke();
    // The head: a domed brow, a long snout and a blunt, flared nose.
    shape(
      [
        [-14, -8],
        [-6, -16],
        [6, -21],
        [18, -19],
        [28, -13],
        [42, -11],
        [54, -11],
        [61, -9],
        [65, -4],
        [64, 1],
        [48, 3],
        [28, 4],
        [10, 6],
        [-6, 9],
        [-14, 6],
      ],
      BODY,
    );
    // Shading: a darker cheek, light along the brow and snout.
    shape(
      [
        [-10, 2],
        [12, 1],
        [30, 2],
        [10, 6],
        [-6, 9],
      ],
      DEEP,
      false,
    );
    g.strokeStyle = LIT;
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(4, -18);
    g.lineTo(26, -12);
    g.lineTo(60, -8);
    g.stroke();
    g.strokeStyle = SHINE;
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(32, -10.5);
    g.lineTo(54, -9);
    g.stroke();
    // Scales on the cheek.
    g.strokeStyle = DEEP;
    g.lineWidth = 1.6;
    for (const [x, y] of [
      [-2, -6],
      [6, -2],
      [-6, 2],
    ]) {
      g.beginPath();
      g.arc(x, y, 3.5, -1.1, 1.1);
      g.stroke();
    }
    // A big, bright eye under a heavy brow.
    g.fillStyle = OUTLINE;
    g.fillRect(12, -16, 16, 9);
    g.fillStyle = EYE;
    g.fillRect(14, -15, 12, 7);
    g.fillStyle = OUTLINE;
    g.fillRect(20, -15, 4, 7);
    g.fillStyle = WHITE;
    g.fillRect(14, -15, 3, 3);
    shape(
      [
        [8, -16],
        [20, -22],
        [32, -15],
        [24, -16],
        [12, -14],
      ],
      LIT,
    );
    // Nostril, and a fang that shows even with the jaw shut.
    g.fillStyle = OUTLINE;
    g.fillRect(56, -6, 4, 3);
    g.fillStyle = WHITE;
    g.beginPath();
    g.moveTo(50, 2);
    g.lineTo(55, 2);
    g.lineTo(52.5, 8);
    g.fill();
    g.restore();
  }

  /** A burst of water where each monster was swallowed. */
  private drawBites(g: CanvasRenderingContext2D, cast: DragonCast, t: number) {
    for (const p of cast.prey) {
      const age = t - (p.at - cast.start) / SERVER_HZ;
      if (age < 0 || age > 0.8) continue;
      const f = age / 0.8;
      g.globalAlpha = 1 - f;
      g.lineWidth = 4;
      g.strokeStyle = WHITE;
      g.beginPath();
      g.ellipse(p.x, p.y, 12 + f * 80, 7 + f * 46, 0, 0, TAU);
      g.stroke();
      g.strokeStyle = FIN;
      g.beginPath();
      g.ellipse(p.x, p.y, 6 + f * 52, 4 + f * 30, 0, 0, TAU);
      g.stroke();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + hash(i + p.at) * 0.4,
          d = f * (50 + hash(i * 7 + p.at) * 40);
        g.fillStyle = i % 3 ? FIN : WHITE;
        g.fillRect(
          p.x + Math.cos(a) * d,
          p.y + Math.sin(a) * d * 0.6 - 40 * f + 70 * f * f,
          4,
          4,
        );
      }
    }
    g.globalAlpha = 1;
  }

  /** It bursts: the body breaks into drops that fly out and fall as rain. */
  private drawRain(g: CanvasRenderingContext2D, body: Segment[], burst: number) {
    const fall = burst * burst * 110,
      fade = 1 - Math.pow(burst, 3);
    // Rings of spray bursting off the body as it breaks.
    g.lineWidth = 3;
    g.strokeStyle = WHITE;
    g.globalAlpha = Math.max(0, 1 - burst * 2.2);
    for (let k = 0; k < body.length; k += 14) {
      const b = body[k];
      g.beginPath();
      g.ellipse(b.x, b.y, b.r * (1 + burst * 2.5), b.r * (0.6 + burst * 1.5), 0, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = fade;
    for (let k = 0; k < body.length; k += 2) {
      const b = body[k];
      for (let i = 0; i < 3; i++) {
        const seed = hash(k * 5 + i),
          a = hash(k * 11 + i * 3) * TAU,
          d = Math.sqrt(burst) * (b.r + 10 + seed * 70),
          x = b.x + Math.cos(a) * d,
          y = b.y + Math.sin(a) * d * 0.6 + fall * (0.6 + seed);
        g.fillStyle = OUTLINE;
        g.fillRect(x - 2, y - 2, 8, seed > 0.5 ? 12 : 8);
        g.fillStyle = seed > 0.55 ? WHITE : FIN;
        g.fillRect(x, y, 4, seed > 0.5 ? 8 : 4);
        // Some drops catch the light.
        if (seed > 0.85) {
          const twinkle = 4 + Math.round(6 * Math.abs(Math.sin(burst * 20 + k)));
          g.fillStyle = WHITE;
          g.fillRect(x + 1 - twinkle, y + 1, twinkle * 2 + 2, 2);
          g.fillRect(x + 1, y + 1 - twinkle, 2, twinkle * 2 + 2);
        }
      }
    }
    g.globalAlpha = 1;
  }
}
