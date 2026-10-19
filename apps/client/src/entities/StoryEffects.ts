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
  private healing: Phaser.GameObjects.Graphics;
  private shownKey = "";
  private shownAt = 0;
  constructor(private phaser: Phaser.Scene) {
    // Above the ground (-100) and floor decals, below every hero and prop.
    this.circle = phaser.add.graphics().setDepth(-40);
    this.healing = phaser.add.graphics();
  }
  update(w: World, sceneId: SceneId, now: number) {
    const run = w.story?.cutscene;
    const line = run ? cutscenes[run.id]?.lines[run.line] : undefined;
    const key = run ? `${run.id}:${run.line}` : "";
    if (key !== this.shownKey) {
      this.shownKey = key;
      this.shownAt = now;
      if (line?.cue === "flash" && cutscenes[run!.id].scene === sceneId)
        this.phaser.cameras.main.flash(900, 255, 250, 225);
    }
    this.drawHealing(w, sceneId, line?.heal, (now - this.shownAt) / 1000, now);
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
  /**
   * Coco's healing light on Alden. An attempt gathers, wavers and slips away;
   * a failing one only sputters. It never takes: the story allows no other end.
   */
  private drawHealing(
    w: World,
    sceneId: SceneId,
    heal: "attempt" | "fail" | undefined,
    t: number,
    now: number,
  ) {
    const g = this.healing,
      alden = w.story?.alden;
    g.clear();
    if (!heal || !alden || alden.scene !== sceneId) return;
    const strength =
      heal === "attempt"
        ? t < 1.2
          ? t / 1.2
          : Math.max(0, 1 - (t - 1.2) / 1.6)
        : Math.max(0, 0.55 - t / 2.4);
    // It flickers more as it fails.
    const flicker = 0.6 + 0.4 * Math.sin(now / (heal === "attempt" ? 70 : 45));
    const a = strength * flicker;
    if (a <= 0.01) return;
    const x = alden.x,
      y = alden.y + 2;
    g.setDepth(alden.y + 1);
    g.fillStyle(0x9dffb0, 0.22 * a);
    g.fillEllipse(x, y, 96, 48);
    g.fillStyle(0xe6ffd8, 0.35 * a);
    g.fillEllipse(x, y, 52, 24);
    g.lineStyle(2, 0xbfffc8, 0.7 * a);
    g.strokeEllipse(x, y, 96 - 30 * (1 - strength), 48 - 15 * (1 - strength));
    // A few motes drifting up and fading.
    for (let i = 0; i < 6; i++) {
      const phase = (now / 900 + i / 6) % 1;
      g.fillStyle(0xe6ffd8, (1 - phase) * a);
      g.fillRect(x - 36 + i * 14, y - 4 - phase * 34, 2, 2);
    }
  }
  destroy() {
    this.circle.destroy();
    this.healing.destroy();
  }
}
