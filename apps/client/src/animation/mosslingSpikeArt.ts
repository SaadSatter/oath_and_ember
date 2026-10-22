import { mosslingSpike } from "../../../../packages/shared/src/enemies.js";

// The Mossling's arm turned to a wooden spike, as pixel art at one world unit
// per pixel. It is painted lying along +x, from the hand (x = 0) to its point,
// and the view rotates it to the Mossling's aim. Bark with a diagonal grain,
// knuckle rings at the joints, moss near the hand, thorns hooked back along
// its length, and a pale, sharpened point.

/** Long enough for the spike at full reach, plus its thorns. */
export const SPIKE_WIDTH = mosslingSpike.reach + 40;
export const SPIKE_HEIGHT = 32;
/** The row the spike's centre line runs along. */
export const SPIKE_MID = SPIKE_HEIGHT / 2;

const rgb = (hex: number) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const OUTLINE = rgb(0x23170e),
  DARK = rgb(0x4a3220),
  BARK = rgb(0x6e4b2c),
  LIGHT = rgb(0x95693f),
  SHINE = rgb(0xc39a63),
  POINT = rgb(0xdcbd8c),
  MOSS = rgb(0x6f9440),
  MOSS_LIGHT = rgb(0x9cc25a);
const hash = (x: number, y: number) => {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Paint a spike `length` units long into `image` (SPIKE_WIDTH × SPIKE_HEIGHT).
 * `wood` runs 0 → 1 as the arm hardens: it thickens and grows its thorns.
 */
export function paintSpike(image: ImageData, length: number, wood: number) {
  const d = image.data,
    w = image.width,
    h = image.height;
  d.fill(0);
  const L = Math.max(4, Math.min(SPIKE_WIDTH - 2, Math.round(length)));
  const put = (x: number, y: number, c: number[]) => {
    const px = Math.round(x),
      py = Math.round(y + SPIKE_MID);
    if (px < 0 || py < 0 || px >= w || py >= h) return;
    const i = (py * w + px) * 4;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  };
  const base = 3.5 + 3.5 * wood,
    point = Math.min(14, L * 0.3);
  // Its half-thickness along the length: tapering to a point, with a slight
  // swelling at each knuckle.
  const half = (x: number) => {
    const u = x / L,
      knuckle = x > 6 && x < L - point && x % 24 < 3 ? 1 : 0;
    return Math.max(0, base * Math.pow(1 - u, 0.55) + knuckle);
  };
  for (let x = 0; x <= L; x++) {
    const r = Math.round(half(x)),
      tip = x > L - point;
    for (let y = -r; y <= r; y++) {
      let c: number[];
      if (Math.abs(y) === r) c = OUTLINE;
      else if (y === -r + 1) c = tip ? POINT : SHINE;
      else if (y >= r - 1) c = DARK;
      else if (x > 6 && x % 24 < 2) c = DARK; // a ring at each joint
      else if (tip) c = y < 0 ? POINT : LIGHT;
      else if ((y + Math.floor(x / 5)) % 4 === 0) c = DARK; // the grain
      else c = y < 0 ? LIGHT : BARK;
      // Moss clinging near the hand.
      if (x < 34 && y < 0 && Math.abs(y) < r && hash(x, y) > 0.62 - 0.3 * (1 - x / 34))
        c = hash(y, x) > 0.5 ? MOSS : MOSS_LIGHT;
      put(x, y, c);
    }
  }
  // Thorns, hooked back toward the hand, top and bottom by turns.
  const thorn = Math.round(1 + 4 * wood);
  for (let i = 0, x = 14; x < L - point - 2; i++, x += 17) {
    const side = i % 2 ? 1 : -1,
      edge = Math.round(half(x));
    for (let j = 1; j <= thorn; j++) {
      const tx = x - j,
        ty = side * (edge + j);
      put(tx, ty, j === thorn ? SHINE : LIGHT);
      put(tx - 1, ty, OUTLINE);
      put(tx, ty + side, OUTLINE);
    }
    // A leaf on some of the thorns nearest the hand.
    if (i < 3 && wood > 0.4) {
      put(x - thorn - 1, side * (edge + thorn + 1), MOSS_LIGHT);
      put(x - thorn - 2, side * (edge + thorn + 1), MOSS);
      put(x - thorn - 1, side * (edge + thorn + 2), MOSS);
    }
  }
  // The very point.
  put(L, 0, OUTLINE);
  put(L - 1, 0, POINT);
}
