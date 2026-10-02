import type Phaser from "phaser";
import { viewportLayout } from "./viewport.js";
export function attachResponsiveRenderer(scene: Phaser.Scene) {
  const parent = document.querySelector<HTMLDivElement>("#game")!;
  let frame = 0;
  const apply = () => {
    frame = 0;
    const bounds = parent.getBoundingClientRect();
    const layout = viewportLayout(bounds.width, bounds.height);
    const manager = scene.scale;
    const resized =
      manager.width !== layout.logicalWidth ||
      manager.height !== layout.logicalHeight;
    if (resized) manager.resize(layout.logicalWidth, layout.logicalHeight);
    // Phaser NONE resize at zoom=1 leaves prior CSS dimensions in place.
    // Reapply display zoom on a logical resize even if the factor stays equal,
    // otherwise portrait-to-landscape rotation can stretch the previous canvas.
    if (resized || manager.zoom !== layout.scale) manager.setZoom(layout.scale);
    // Camera dimensions are logical pixels. CSS scaling alone enlarges the image;
    // neither a high-DPI display nor an ultrawide reveals additional world area.
    scene.cameras.main
      .setViewport(0, 0, layout.logicalWidth, layout.logicalHeight)
      .setZoom(1);
    scene.cameras.main.roundPixels = true;
    parent.dataset.logicalSize = `${layout.logicalWidth}x${layout.logicalHeight}`;
    parent.dataset.displayScale = String(layout.scale);
    manager.updateBounds();
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(apply);
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(parent);
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.visualViewport?.addEventListener("resize", schedule);
  apply();
  return () => {
    if (frame) cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
    window.visualViewport?.removeEventListener("resize", schedule);
  };
}
