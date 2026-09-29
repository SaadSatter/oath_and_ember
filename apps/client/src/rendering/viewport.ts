// Presentation budget only: no import from simulation, collision or networking.
export const TARGET_AREA = 640 * 360;
export const MIN_ASPECT = 9 / 16;
export const MAX_ASPECT = 16 / 9;
export function viewportLayout(screenWidth: number, screenHeight: number) {
  const width = Math.max(1, screenWidth),
    height = Math.max(1, screenHeight);
  const aspect = Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, width / height));
  const logicalWidth = Math.round(Math.sqrt(TARGET_AREA * aspect));
  const logicalHeight = Math.round(Math.sqrt(TARGET_AREA / aspect));
  const fit = Math.min(width / logicalWidth, height / logicalHeight);
  // Integer CSS enlargement preserves pixel grids. Tiny windows use uniform
  // nearest-neighbor reduction rather than cropping or stretching either axis.
  const scale = fit >= 1 ? Math.floor(fit) : fit;
  return {
    logicalWidth,
    logicalHeight,
    scale,
    displayWidth: logicalWidth * scale,
    displayHeight: logicalHeight * scale,
  };
}
// The former per-frame 0.3 convergence is expressed as a time constant so
// camera presentation remains equivalent at 60Hz and 120Hz.
export function smoothingFactor(deltaMs: number) {
  return 1 - Math.pow(0.7, Math.max(0, deltaMs) / (1000 / 60));
}
