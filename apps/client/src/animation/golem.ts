import type Phaser from "phaser";
import meta from "../../public/assets/enemies/ironbound_sentinel/attack.json" with { type: "json" };
export const golemKey = (kind: string) => `golem:${kind}`;
export function preloadGolemAttack(scene: Phaser.Scene) {
  scene.load.spritesheet(
    golemKey("beam-tip"),
    "/assets/enemies/ironbound_sentinel/beam-tip.png",
    { frameWidth: 128, frameHeight: 128 },
  );
  scene.load.spritesheet(
    golemKey("beam-middle"),
    "/assets/enemies/ironbound_sentinel/beam-middle.png",
    { frameWidth: 64, frameHeight: 128 },
  );
  for (const kind of ["attack", "charge", "blast", "melee"])
    scene.load.spritesheet(
      golemKey(kind),
      `/assets/enemies/ironbound_sentinel/${kind}.png`,
      { frameWidth: 128, frameHeight: 128 },
    );
}
// The charge sheet's last five cells are horizontal beam-launch frames. The
// palm glow is never rotated, so they read as a sideways beam whatever the
// golem's aim; the palm only cycles the round energy-orb cells.
export const GOLEM_CHARGE_ORB_FRAMES = 12;
export function golemEffectFrame(
  kind: "charge" | "blast",
  elapsed: number,
  loop = true,
) {
  const durations =
    kind === "charge"
      ? meta.effects.charge.durations.slice(0, GOLEM_CHARGE_ORB_FRAMES)
      : meta.effects[kind].durations,
    total = durations.reduce((a, b) => a + b, 0);
  let t = loop ? Math.max(0, elapsed) % total : Math.max(0, elapsed);
  for (let n = 0; n < durations.length; n++) {
    if (t < durations[n]) return n;
    t -= durations[n];
  }
  return durations.length - 1;
}
export const golemBlastDuration = meta.effects.blast.durations.reduce(
  (a, b) => a + b,
  0,
);
export function golemAttackFrame(direction: string, progress: number) {
  return (
    meta.directions.indexOf(direction) * 9 +
    Math.min(8, Math.floor(Math.max(0, progress) * 9))
  );
}
export { golemPalm } from "../../../../packages/shared/src/golem.js";

export function golemMeleeFrame(direction: string, progress: number) {
  return (
    meta.directions.indexOf(direction) * 6 +
    Math.min(5, Math.floor(Math.max(0, progress) * 6))
  );
}

/** Eleven occupied cells in row order; the twelfth cell is empty. */
export function golemBeamTipFrame(elapsedSeconds: number) {
  const frame = Math.floor(Math.max(0, elapsedSeconds) / 0.09);
  return frame < 11 ? frame : 8 + ((frame - 11) % 3);
}

// After the beam ends it lingers and dissipates instead of vanishing: it fades
// out while the ray thins toward nothing. Presentation only.
export const GOLEM_BEAM_FADE_MS = 600;
export function golemBeamFade(elapsedMs: number) {
  const t = Math.min(1, Math.max(0, elapsedMs) / GOLEM_BEAM_FADE_MS),
    ease = 1 - (1 - t) * (1 - t);
  return { alpha: 1 - ease, thickness: 1 - 0.85 * ease, done: t >= 1 };
}

// The tip art's own shaft is white with blue edge stripes, while the ray is
// one flat pale cyan, so the last stretch of the beam used to look like a
// different, thinner beam. The tip is drawn from a copy recoloured to the
// ray's colour across the shaft band (rings and burst keep their blue line
// art outside it). The original sheet is left untouched.
const BEAM_RGB = [232, 250, 255];
const TIP_CELL = 128;
/** The tip's anchor (where the beam ends) within each cell. */
export const GOLEM_TIP_ANCHOR_X = 112;
/** Rows of each tip cell holding the shaft (the ray's band at the tip's scale). */
const SHAFT_TOP = 52,
  SHAFT_BOTTOM = 77;
const tipPoints = new Map<number, number>();
export function matchedBeamTip(scene: Phaser.Scene) {
  const key = golemKey("beam-tip-matched");
  if (scene.textures.exists(key)) return key;
  const source = scene.textures
    .get(golemKey("beam-tip"))
    .getSourceImage() as HTMLImageElement;
  const canvas = scene.textures.createCanvas(key, source.width, source.height)!;
  const ctx = canvas.getContext();
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, source.width, source.height),
    px = image.data,
    columns = Math.floor(source.width / TIP_CELL);
  for (let y = 0; y < source.height; y++)
    for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4;
      if (!px[i + 3]) continue;
      const row = y % TIP_CELL,
        bright = (px[i] + px[i + 1] + px[i + 2]) / 3 >= 185;
      if (bright || (row >= SHAFT_TOP && row <= SHAFT_BOTTOM)) {
        px[i] = BEAM_RGB[0];
        px[i + 1] = BEAM_RGB[1];
        px[i + 2] = BEAM_RGB[2];
      }
      // How far forward each cell's arrowhead (or burst) reaches.
      if (row === TIP_CELL / 2) {
        const cell = Math.floor(y / TIP_CELL) * columns + Math.floor(x / TIP_CELL);
        tipPoints.set(cell, Math.max(tipPoints.get(cell) ?? 0, x % TIP_CELL));
      }
    }
  ctx.putImageData(image, 0, 0);
  const rows = Math.floor(source.height / TIP_CELL);
  for (let cell = 0; cell < columns * rows; cell++)
    canvas.add(
      cell,
      0,
      (cell % columns) * TIP_CELL,
      Math.floor(cell / columns) * TIP_CELL,
      TIP_CELL,
      TIP_CELL,
    );
  canvas.refresh();
  canvas.setFilter(0); // filtered like the ray, so the two blend
  return key;
}
/**
 * How much shorter the ray is drawn than the beam, in source pixels, so it
 * ends inside the arrowhead instead of poking out past its point.
 */
export function golemRayTrim(frame: number) {
  const point = tipPoints.get(frame) ?? GOLEM_TIP_ANCHOR_X;
  return Math.max(0, GOLEM_TIP_ANCHOR_X + 10 - point);
}
