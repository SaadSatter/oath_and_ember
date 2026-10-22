import Phaser from "phaser";
import type {
  SceneId,
  World,
} from "../../../../packages/shared/src/gameTypes.js";
import { cutscenes } from "../../../../packages/shared/src/prologue.js";
import { watcherPose } from "../../../../packages/shared/src/chapter0Finale.js";
import { maps } from "../../../../packages/shared/src/maps.js";
import { WaterDragonView } from "./WaterDragonView.js";

// Presentation for the prologue's story cues: the spell circle that glows
// under the clearing while Alden casts, and the water dragon it calls up.
// Drawn from the server's current line only; it never changes the world.
export class StoryEffects {
  private circle: Phaser.GameObjects.Graphics;
  private healing: Phaser.GameObjects.Graphics;
  private dragon: WaterDragonView;
  /** Mist gathering where the Mistress of the Mist takes shape. */
  private mistBack: Phaser.GameObjects.Graphics;
  private mistFront: Phaser.GameObjects.Graphics;
  private mist: { since: number; until?: number } | null = null;
  private shownKey = "";
  private shownAt = 0;
  constructor(private phaser: Phaser.Scene) {
    // Above the ground (-100) and floor decals, below every hero and prop.
    this.circle = phaser.add.graphics().setDepth(-40);
    this.healing = phaser.add.graphics();
    this.mistBack = phaser.add.graphics();
    this.mistFront = phaser.add.graphics();
    const clearing = maps.PROLOGUE_CLEARING;
    this.dragon = new WaterDragonView(phaser, clearing.width, clearing.height);
  }
  /** `tick` is the server tick on screen (the clock monsters are drawn at). */
  update(w: World, sceneId: SceneId, now: number, tick: number) {
    const run = w.story?.cutscene;
    const line = run ? cutscenes[run.id]?.lines[run.line] : undefined;
    const key = run ? `${run.id}:${run.line}` : "";
    if (key !== this.shownKey) {
      this.shownKey = key;
      this.shownAt = now;
    }
    this.dragon.update(
      w.story?.dragon,
      sceneId === "PROLOGUE_CLEARING",
      tick,
    );
    this.drawHealing(w, sceneId, line?.heal, (now - this.shownAt) / 1000, now);
    this.drawMist(w, sceneId, now);
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
  /**
   * The final cinematic: from the line the mist gathers, pale fog drifts in
   * toward the shrine's entrance and thickens where she takes shape; when the
   * scene is over it thins away.
   */
  private drawMist(w: World, sceneId: SceneId, now: number) {
    const run = w.story?.cutscene,
      scene = run && cutscenes[run.id],
      gather = scene?.lines.findIndex((l) => l.cue === "mist-gather") ?? -1,
      pose = scene?.stranger;
    const active =
      !!run && gather >= 0 && run.line >= gather && pose?.scene === sceneId;
    if (active && !this.mist) this.mist = { since: now };
    if (active && this.mist) this.mist.until = undefined;
    if (!active && this.mist && this.mist.until === undefined)
      this.mist.until = now;
    this.mistBack.clear();
    this.mistFront.clear();
    if (!this.mist) return;
    const at = pose ?? watcherPose;
    if (at.scene !== sceneId) return;
    const t = (now - this.mist.since) / 1000,
      fading =
        this.mist.until === undefined ? 1 : 1 - (now - this.mist.until) / 1800;
    if (fading <= 0) {
      this.mist = null;
      return;
    }
    // It drifts in from wide around, gathering close over a few seconds.
    const gathered = Math.min(1, t / 3),
      strength = Math.min(1, t / 1.2) * fading;
    this.mistBack.setDepth(at.y - 2);
    this.mistFront.setDepth(at.y + 4);
    for (let i = 0; i < 30; i++) {
      const seed = Math.sin(i * 91.7) * 0.5 + 0.5,
        orbit = t * (0.25 + seed * 0.35) + i * 2.4,
        reach = (110 - 75 * gathered) * (0.45 + 0.55 * seed),
        x = at.x + Math.cos(orbit) * reach * 1.3,
        y = at.y - 6 + Math.sin(orbit) * reach * 0.45,
        front = Math.sin(orbit) > 0,
        g = front ? this.mistFront : this.mistBack;
      g.fillStyle(i % 3 ? 0xe4ecf0 : 0xc9d6de, (0.1 + 0.12 * seed) * strength);
      g.fillEllipse(
        Math.round(x / 2) * 2,
        Math.round(y / 2) * 2,
        40 + seed * 46,
        14 + seed * 10,
      );
    }
    // Wisps curling up where she stands.
    for (let i = 0; i < 8; i++) {
      const rise = (t * 0.35 + i / 8) % 1,
        x = at.x + Math.sin(t * 1.4 + i * 1.9) * (14 + i * 2);
      this.mistFront.fillStyle(0xf2f6f8, 0.18 * (1 - rise) * strength * gathered);
      this.mistFront.fillEllipse(
        Math.round(x / 2) * 2,
        Math.round((at.y - 4 - rise * 56) / 2) * 2,
        12 + rise * 16,
        8 + rise * 6,
      );
    }
  }
  destroy() {
    this.mistBack.destroy();
    this.mistFront.destroy();
    this.circle.destroy();
    this.healing.destroy();
    this.dragon.destroy();
  }
}
