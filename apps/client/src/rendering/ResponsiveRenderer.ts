import type Phaser from "phaser";
import { viewportLayout } from "./viewport.js";
const zooms = new WeakMap<Phaser.Scene, number>();
// Physical pixels per art pixel for this scene's main camera. Gameplay views
// multiply their framing zoom by it, and snap positions to 1/zoom.
export function pixelZoom(scene: Phaser.Scene) {
  return zooms.get(scene) ?? 1;
}
export function attachResponsiveRenderer(scene: Phaser.Scene) {
  const parent = document.querySelector<HTMLDivElement>("#game")!;
  const hud = document.querySelector<HTMLDivElement>("#screen-ui");
  let frame = 0;
  const apply = () => {
    frame = 0;
    // Wrapped objectives and controls need more room on narrow screens.
    parent.style.top = `${Math.max(8, hud && !hud.hidden ? hud.getBoundingClientRect().bottom + 4 : 0)}px`;
    parent.style.height = "auto";
    const bounds = parent.getBoundingClientRect();
    const layout = viewportLayout(
      bounds.width,
      bounds.height,
      window.devicePixelRatio || 1,
    );
    const manager = scene.scale;
    const resized =
      manager.width !== layout.canvasWidth ||
      manager.height !== layout.canvasHeight;
    if (resized) manager.resize(layout.canvasWidth, layout.canvasHeight);
    // Phaser NONE resize at zoom=1 leaves prior CSS dimensions in place.
    // Reapply display zoom on a resize even if the factor stays equal,
    // otherwise portrait-to-landscape rotation can stretch the previous canvas.
    if (resized || manager.zoom !== layout.scale) manager.setZoom(layout.scale);
    // The canvas is device resolution; the camera's whole-number zoom decides
    // how much world is visible, so a high-DPI display shows the same footprint
    // in sharper physical pixels rather than more world.
    zooms.set(scene, layout.zoom);
    scene.cameras.main
      .setViewport(0, 0, layout.canvasWidth, layout.canvasHeight)
      .setZoom(layout.zoom);
    scene.cameras.main.roundPixels = true;
    parent.dataset.logicalSize = `${Math.round(layout.logicalWidth)}x${Math.round(layout.logicalHeight)}`;
    parent.dataset.displayScale = String(layout.zoom / (window.devicePixelRatio || 1));
    parent.dataset.pixelZoom = String(layout.zoom);
    manager.updateBounds();
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(apply);
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(parent);
  if (hud) observer.observe(hud);
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.visualViewport?.addEventListener("resize", schedule);
  // A window dragged between a standard and a Retina display changes the
  // device pixel ratio without resizing anything.
  const dpr = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  dpr?.addEventListener?.("change", schedule);
  apply();
  return () => {
    if (frame) cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
    window.visualViewport?.removeEventListener("resize", schedule);
    dpr?.removeEventListener?.("change", schedule);
  };
}
