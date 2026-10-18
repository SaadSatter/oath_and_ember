import Phaser from "phaser";
import type {
  SceneId,
  World,
} from "../../../../packages/shared/src/gameTypes.js";
import { cutscenes } from "../../../../packages/shared/src/prologue.js";
import { maps } from "../../../../packages/shared/src/maps.js";

// Presentation for the prologue's story cues: the spell circle that glows
// under the clearing while Alden casts, and the white flash as it lands.
// Drawn from the server's current line only; it never changes the world.
export class StoryEffects {
  private circle: Phaser.GameObjects.Graphics;
  private shownKey = "";
  constructor(private phaser: Phaser.Scene) {
    // Above the ground (-100) and floor decals, below every hero and prop.
    this.circle = phaser.add.graphics().setDepth(-40);
  }
  update(w: World, sceneId: SceneId, now: number) {
    const run = w.story?.cutscene;
    const line = run ? cutscenes[run.id]?.lines[run.line] : undefined;
    const key = run ? `${run.id}:${run.line}` : "";
    if (key !== this.shownKey) {
      this.shownKey = key;
      if (line?.cue === "flash" && cutscenes[run!.id].scene === sceneId)
        this.phaser.cameras.main.flash(900, 255, 250, 225);
    }
    this.circle.clear();
    if (!line?.glow || sceneId !== "PROLOGUE_CLEARING") return;
    const c = maps.PROLOGUE_CLEARING.points.centre,
      pulse = 0.55 + 0.25 * Math.sin(now / 160),
      g = this.circle;
    // Concentric rings and a five-pointed star, in warm arcane gold.
    g.fillStyle(0xffd36b, 0.16 * pulse);
    g.fillEllipse(c.x, c.y, 600, 390);
    for (const [r, width, alpha] of [
      [300, 10, 0.95],
      [276, 4, 0.8],
      [150, 5, 0.7],
    ] as const) {
      g.lineStyle(width, 0xffd36b, alpha * pulse);
      g.strokeEllipse(c.x, c.y, r * 2, r * 1.3);
    }
    g.lineStyle(6, 0xfff1b8, 0.85 * pulse);
    const points = [0, 1, 2, 3, 4].map((i) => {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5 + now / 4000;
      return { x: c.x + Math.cos(a) * 272, y: c.y + Math.sin(a) * 272 * 0.65 };
    });
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (const p of [...points.slice(1), points[0]]) g.lineTo(p.x, p.y);
    g.strokePath();
  }
  destroy() {
    this.circle.destroy();
  }
}
