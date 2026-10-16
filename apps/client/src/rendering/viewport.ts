// Presentation budget only: no import from simulation, collision or networking.
export const TARGET_AREA = 640 * 360;
export const MIN_ASPECT = 9 / 16;
export const MAX_ASPECT = 16 / 9;
// A whole-number zoom may reveal at most this much more world per axis than
// the target footprint; beyond it the next zoom step (showing less) is used.
export const MAX_REVEAL = 1.2;
export function viewportLayout(
  screenWidth: number,
  screenHeight: number,
  pixelRatio = 1,
) {
  const width = Math.max(1, screenWidth),
    height = Math.max(1, screenHeight),
    ratio = pixelRatio > 0 && Number.isFinite(pixelRatio) ? pixelRatio : 1;
  const aspect = Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, width / height));
  const targetWidth = Math.sqrt(TARGET_AREA * aspect);
  const targetHeight = Math.sqrt(TARGET_AREA / aspect);
  const fit = Math.min(width / targetWidth, height / targetHeight);
  // The canvas covers the fitted box at device resolution, so one CSS-scaled
  // canvas pixel is exactly one physical pixel. Art is enlarged by a whole
  // number camera zoom instead, so every art pixel is the same size on screen
  // and motion can land on any physical pixel rather than whole art pixels.
  const canvasWidth = Math.max(1, Math.round(targetWidth * fit * ratio));
  const canvasHeight = Math.max(1, Math.round(targetHeight * fit * ratio));
  const ideal = fit * ratio;
  let zoom = Math.max(1, Math.round(ideal));
  if (ideal / zoom > MAX_REVEAL) zoom++;
  return {
    // World units visible across the canvas.
    logicalWidth: canvasWidth / zoom,
    logicalHeight: canvasHeight / zoom,
    canvasWidth,
    canvasHeight,
    // Physical pixels per art pixel (camera zoom).
    zoom,
    // CSS pixels per canvas pixel.
    scale: 1 / ratio,
    displayWidth: canvasWidth / ratio,
    displayHeight: canvasHeight / ratio,
  };
}
// The former per-frame 0.3 convergence is expressed as a time constant so
// camera presentation remains equivalent at 60Hz and 120Hz.
export function smoothingFactor(deltaMs: number) {
  return 1 - Math.pow(0.7, Math.max(0, deltaMs) / (1000 / 60));
}
// Predicted motion reaches the screen the frame it exists. Only the offset left
// by a reconciliation jump decays, so walking never trails behind the input.
export function followPrediction(
  rendered: { x: number; y: number },
  previousGlide: { x: number; y: number },
  glide: { x: number; y: number },
  deltaMs: number,
) {
  const keep = 1 - smoothingFactor(deltaMs);
  return {
    x: glide.x + (rendered.x - previousGlide.x) * keep,
    y: glide.y + (rendered.y - previousGlide.y) * keep,
  };
}
// Framed areas (shrine plaza, griffin fight, bridge target, pond stations) ease in
// and out instead of snapping, so one map never reads as several screens.
export const FOCUS_BLEND_MS = 450;
export interface CameraFocus {
  x: number;
  y: number;
  zoom: number;
}
export function stepFocusWeight(weight: number, active: boolean, deltaMs: number) {
  const step = Math.max(0, deltaMs) / FOCUS_BLEND_MS;
  return Math.max(0, Math.min(1, weight + (active ? step : -step)));
}
export function blendCamera(
  hero: { x: number; y: number },
  focus: CameraFocus | null,
  weight: number,
): CameraFocus {
  if (!focus || weight <= 0) return { x: hero.x, y: hero.y, zoom: 1 };
  const t = weight * weight * (3 - 2 * weight);
  return {
    x: hero.x + (focus.x - hero.x) * t,
    y: hero.y + (focus.y - hero.y) * t,
    zoom: 1 + (focus.zoom - 1) * t,
  };
}
// Camera and hero share one physical-pixel grid (1/zoom world units), so tiles
// and sprites never round in opposite directions and shimmer against each
// other, while motion still advances in sub-art-pixel steps.
export function snapToPixel(p: { x: number; y: number }, zoom = 1) {
  const z = zoom > 0 ? zoom : 1;
  return { x: Math.round(p.x * z) / z, y: Math.round(p.y * z) / z };
}
// Soft camera follow: eases toward the target with a time constant, so the
// same lag is seen at 60Hz and 120Hz. Small per-frame steps in the hero's
// motion are absorbed instead of moving the whole screen. Large jumps
// (teleports, scene changes) are taken at once.
export const CAMERA_FOLLOW = 0.15,
  CAMERA_SNAP_DISTANCE = 240;
export function followCamera(
  camera: { x: number; y: number },
  target: { x: number; y: number },
  deltaMs: number,
) {
  if (
    Math.hypot(target.x - camera.x, target.y - camera.y) > CAMERA_SNAP_DISTANCE
  )
    return { x: target.x, y: target.y };
  const k = 1 - Math.pow(1 - CAMERA_FOLLOW, Math.max(0, deltaMs) / (1000 / 60));
  return {
    x: camera.x + (target.x - camera.x) * k,
    y: camera.y + (target.y - camera.y) * k,
  };
}
