import type Phaser from "phaser";
import type { World } from "../../../../packages/shared/src/gameTypes.js";
import { effectColor } from "../assets/palettes.js";
/** Presentation only: positions come from snapshot interpolation, impacts from server events. */
export class ProjectileView {
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private seen = new Set<string>();
  private bursts = new Map<
    string,
    { x: number; y: number; color: number; start: number }
  >();
  private graphics: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(31);
  }
  update(
    world: Readonly<World>,
    position: (id: string) => { x: number; y: number } | null | undefined,
    debug: boolean,
  ) {
    const now = this.scene.time.now,
      g = this.graphics;
    g.clear();
    for (const p of Object.values(world.projectiles)) {
      const q = position(p.id) || p,
        color = effectColor(world.players[p.owner]?.appearance?.effectPalette);
      const angle = Math.atan2(p.vy, p.vx),
        dx = Math.cos(angle),
        dy = Math.sin(angle);
      let sprite = this.sprites.get(p.id);
      if (!sprite && this.scene.textures.exists("coco:blast")) {
        sprite = this.scene.add
          .image(q.x, q.y, "coco:blast")
          .setOrigin(76 / 96, 32 / 64)
          .setDepth(30);
        this.sprites.set(p.id, sprite);
      }
      sprite
        ?.setVisible(!debug)
        .setPosition(q.x, q.y)
        .setRotation(angle)
        .setTint(color);
      if (debug) {
        g.fillStyle(color);
        g.fillCircle(q.x, q.y, 6);
        continue;
      }
      // Compact colored halo and sharp white core match the reference blast.
      g.fillStyle(color, 0.1);
      g.fillCircle(q.x, q.y, 14);
      g.fillStyle(color, 0.28);
      g.fillCircle(q.x, q.y, 9);
      g.fillStyle(0xfff4df);
      g.fillCircle(q.x, q.y, 3);
      for (let n = 0; n < 7; n++) {
        const distance = 12 + n * 5,
          drift = Math.sin(now / 90 + n * 2) * 4;
        const x = q.x - dx * distance - dy * drift,
          y = q.y - dy * distance + dx * drift;
        g.fillStyle(color, (1 - n / 8) * 0.7);
        g.fillRect(Math.round(x), Math.round(y), n % 2 ? 2 : 3, 2);
      }
    }
    for (const [id, sprite] of this.sprites)
      if (!world.projectiles[id]) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    for (const hit of world.projectileImpacts || [])
      if (!this.seen.has(hit.id)) {
        this.seen.add(hit.id);
        const age = Math.max(0, ((world.serverTick - hit.tick) * 1000) / 30);
        if (age < 350)
          this.bursts.set(hit.id, {
            x: hit.x,
            y: hit.y,
            color: effectColor(
              world.players[hit.owner]?.appearance?.effectPalette,
            ),
            start: now - age,
          });
      }
    // Deduplication remains bounded by the server's short event retention window.
    const retained = new Set((world.projectileImpacts || []).map((e) => e.id));
    for (const id of this.seen) if (!retained.has(id)) this.seen.delete(id);
    for (const [id, b] of this.bursts) {
      const t = (now - b.start) / 350;
      if (t >= 1) {
        this.bursts.delete(id);
        continue;
      }
      g.lineStyle(2, b.color, 1 - t);
      g.strokeCircle(b.x, b.y, 4 + t * 25);
      for (let n = 0; n < 9; n++) {
        const a = (n * Math.PI * 2) / 9,
          r = 7 + t * 28;
        g.fillStyle(b.color, 1 - t);
        g.fillRect(
          Math.round(b.x + Math.cos(a) * r),
          Math.round(b.y + Math.sin(a) * r),
          3,
          3,
        );
      }
      g.fillStyle(0xfff4df, (1 - t) * 0.8);
      g.fillCircle(b.x, b.y, 5 * (1 - t));
    }
  }
  clear() {
    this.graphics.clear();
    for (const s of this.sprites.values()) s.destroy();
    this.sprites.clear();

    this.bursts.clear();
    this.seen.clear();
  }
  destroy() {
    this.clear();
    this.graphics.destroy();
  }
}
