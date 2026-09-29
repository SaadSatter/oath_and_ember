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
    if (
      manager.width !== layout.logicalWidth ||
      manager.height !== layout.logicalHeight
    )
      manager.resize(layout.logicalWidth, layout.logicalHeight);
    if (manager.zoom !== layout.scale) manager.setZoom(layout.scale);
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
