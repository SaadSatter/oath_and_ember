import { effectPresentationProfiles } from "../assets/effectPresentation.js";
import type Phaser from "phaser";
import type { World } from "../../../../packages/shared/src/gameTypes.js";
import { effectColor } from "../assets/palettes.js";
import { ensureMagicTexture } from "../assets/magicTextures.js";
import {
  flightFrame,
  impactFrame,
  impactDuration,
  magicKey,
} from "../animation/projectile.js";
/** Positions/impacts are authoritative; ribbon frame timing is purely cosmetic. */
export class ProjectileView {
  private flights = new Map<
    string,
    {
      ribbons: Phaser.GameObjects.Image;
      core: Phaser.GameObjects.Image;
      start: number;
    }
  >();
  private seen = new Set<string>();
  private bursts = new Map<
    string,
    { sprite: Phaser.GameObjects.Image; start: number; palette: string }
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
        palette = world.players[p.owner]?.appearance?.effectPalette || "ember",
        color = effectColor(palette);
      // Velocity supplies a stable travel orientation, never a time-based PNG spin.
      const angle = Math.atan2(p.vy, p.vx),
        dx = Math.cos(angle),
        dy = Math.sin(angle);
      let flight = this.flights.get(p.id);
      if (
        !flight &&
        this.scene.textures.exists(magicKey("flight")) &&
        this.scene.textures.exists(magicKey("core"))
      ) {
        flight = {
          ribbons: this.scene.add
            .image(q.x, q.y, magicKey("flight"))
            .setOrigin(0.5, 0.5)
            .setDepth(30),
          core: this.scene.add
            .image(q.x, q.y, magicKey("core"))
            .setOrigin(0.5, 0.5)
            .setDepth(31),
          start: now,
        };
        this.flights.set(p.id, flight);
      }
      if (flight) {
        flight.ribbons
          .setTexture(
            ensureMagicTexture(this.scene, "flight", palette),
            flightFrame(now - flight.start),
          )
          .setVisible(!debug)
          .setScale(effectPresentationProfiles.projectile.scale)
          .setPosition(
            q.x + effectPresentationProfiles.projectile.offsetX,
            q.y + effectPresentationProfiles.projectile.offsetY,
          )
          .setRotation(angle);
        // Core retains its frame and shares the explicit presentation profile.
        flight.core
          .setTexture(ensureMagicTexture(this.scene, "core", palette), 0)
          .setVisible(!debug)
          .setScale(effectPresentationProfiles.projectile.scale)
          .setPosition(
            q.x + effectPresentationProfiles.projectile.offsetX,
            q.y + effectPresentationProfiles.projectile.offsetY,
          );
      }
      if (debug || !flight) {
        g.fillStyle(color);
        g.fillCircle(q.x, q.y, 6);
        continue;
      }
      for (let n = 0; n < 5; n++) {
        const distance = 14 + n * 5,
          drift = Math.sin(now / 100 + n * 2) * 2;
        g.fillStyle(color, (1 - n / 6) * 0.5);
        g.fillRect(
          Math.round(q.x - dx * distance - dy * drift),
          Math.round(q.y - dy * distance + dx * drift),
          2,
          2,
        );
      }
    }
    for (const [id, f] of this.flights)
      if (!world.projectiles[id]) {
        f.ribbons.destroy();
        f.core.destroy();
        this.flights.delete(id);
      }
    for (const hit of world.projectileImpacts || [])
      if (!this.seen.has(hit.id)) {
        this.seen.add(hit.id);
        const age = Math.max(0, ((world.serverTick - hit.tick) * 1000) / 30);
        if (
          age < impactDuration &&
          this.scene.textures.exists(magicKey("impact"))
        ) {
          const palette =
            world.players[hit.owner]?.appearance?.effectPalette || "ember";
          this.bursts.set(hit.id, {
            sprite: this.scene.add
              .image(hit.x, hit.y, magicKey("impact"))
              .setOrigin(0.5, 0.5)
              .setDepth(32),
            start: now - age,
            palette,
          });
        }
      }
    const retained = new Set((world.projectileImpacts || []).map((e) => e.id));
    for (const id of this.seen) if (!retained.has(id)) this.seen.delete(id);
    for (const [id, b] of this.bursts) {
      const elapsed = now - b.start;
      if (elapsed >= impactDuration) {
        b.sprite.destroy();
        this.bursts.delete(id);
        continue;
      }
      b.sprite
        .setTexture(
          ensureMagicTexture(this.scene, "impact", b.palette),
          impactFrame(elapsed),
        )
        .setVisible(!debug)
        .setAlpha(
          elapsed > impactDuration - 100 ? (impactDuration - elapsed) / 100 : 1,
        );
    }
  }
  // Read-only presentation diagnostics; never consumed by simulation or networking.
  inspect() {
    return {
      flights: [...this.flights].map(([id, f]) => ({
        id,
        frame: Number(f.ribbons.frame.name),
        coreFrame: Number(f.core.frame.name),
        x: f.ribbons.x,
        y: f.ribbons.y,
        angle: f.ribbons.rotation,
      })),
      impacts: [...this.bursts].map(([id, b]) => ({
        id,
        frame: Number(b.sprite.frame.name),
        x: b.sprite.x,
        y: b.sprite.y,
      })),
    };
  }
  clear() {
    this.graphics.clear();
    for (const f of this.flights.values()) {
      f.ribbons.destroy();
      f.core.destroy();
    }
    this.flights.clear();
    for (const b of this.bursts.values()) b.sprite.destroy();
    this.bursts.clear();
    this.seen.clear();
  }
  destroy() {
    this.clear();
    this.graphics.destroy();
  }
}
