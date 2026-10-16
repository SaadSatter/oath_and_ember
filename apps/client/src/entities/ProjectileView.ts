import {
  golemKey,
  golemEffectFrame,
  golemBeamFade,
  golemBlastDuration,
  golemBeamTipFrame,
} from "../animation/golem.js";
import { SERVER_HZ } from "../../../../packages/shared/src/constants.js";
import { fireballLevel } from "../../../../packages/shared/src/abilities.js";
import { blackHoleKey, blackHoleFrame } from "../animation/blackHole.js";
import { blackHoleTuning } from "../../../../packages/shared/src/blackHole.js";
import { effectPresentationProfiles } from "../assets/effectPresentation.js";
import type Phaser from "phaser";
import type { World } from "../../../../packages/shared/src/gameTypes.js";
import { effectColor } from "../assets/palettes.js";
import { ensureMagicTexture } from "../assets/magicTextures.js";
import {
  flightFrame,
  fireballFrame,
  baseFireballFrame,
  baseFireballImpactFrame,
  baseFireballImpactDuration,
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
  private baseShots = new Set<string>();
  private golemShots = new Map<string, Phaser.GameObjects.Image>();
  private golemTips = new Map<string, Phaser.GameObjects.Image>();
  private golemRays = new Map<string, Phaser.GameObjects.TileSprite>();
  // Ended beams, held in place while they dissipate.
  private golemFades = new Map<
    string,
    {
      parts: (Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite)[];
      ray?: Phaser.GameObjects.TileSprite;
      elapsed: number;
      last: number;
    }
  >();
  private golemBlasts = new Map<
    string,
    { sprite: Phaser.GameObjects.Image; elapsed: number; last: number }
  >();
  private holes = new Map<string, Phaser.GameObjects.Image>();
  private seen = new Set<string>();
  private bursts = new Map<
    string,
    {
      sprite: Phaser.GameObjects.Image;
      start: number;
      palette: string;
      base?: boolean;
    }
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
    for (const hole of Object.values(world.blackHoles ?? {})) {
      let im = this.holes.get(hole.id);
      if (!im && this.scene.textures.exists(blackHoleKey)) {
        this.scene.textures.get(blackHoleKey).setFilter(1);
        im = this.scene.add.image(hole.x, hole.y, blackHoleKey).setDepth(32);
        this.holes.set(hole.id, im);
      }
      im?.setPosition(hole.x, hole.y)
        .setRotation(hole.phase === "travel" ? Math.atan2(hole.vy, hole.vx) : 0)
        .setFrame(
          blackHoleFrame(
            hole.phase === "vortex"
              ? (blackHoleTuning.duration - hole.life) * 1000
              : ((world.serverTick - hole.startedTick) * 1000) / SERVER_HZ,
            hole.phase,
          ),
        )
        .setVisible(!debug);
      if (hole.phase === "vortex") {
        g.lineStyle(1, 0x8b62d8, 0.25);
        g.strokeCircle(hole.x, hole.y, blackHoleTuning.pullRadius);
      }
      if (debug || !im) {
        g.fillStyle(0x8b62d8);
        g.fillCircle(hole.x, hole.y, 8);
      }
    }
    for (const [id, im] of this.holes)
      if (!world.blackHoles?.[id]) {
        im.destroy();
        this.holes.delete(id);
      }
    for (const p of Object.values(world.projectiles)) {
      if (p.effect === "golem_beam") {
        const origin = p.beamOrigin;
        if (!origin) continue;
        let im = this.golemShots.get(p.id);
        if (!im) {
          im = this.scene.add
            .image(origin.x, origin.y, golemKey("charge"))
            .setScale(0.3)
            .setDepth(1801);
          this.golemShots.set(p.id, im);
        }
        const elapsed = p.beamAge ?? 0,
          angle = Math.atan2(p.y - origin.y, p.x - origin.x),
          length = Math.hypot(p.x - origin.x, p.y - origin.y);
        im.setPosition(origin.x, origin.y)
          .setVisible(!debug)
          .setFrame(golemEffectFrame("charge", elapsed * 1000));
        let ray = this.golemRays.get(p.id);
        if (!ray) {
          ray = this.scene.add
            .tileSprite(0, 0, 1, 128, golemKey("beam-middle"), 0)
            .setOrigin(0, 0.5)
            .setScale(1, 0.4)
            .setDepth(1800);
          this.scene.textures.get(golemKey("beam-middle")).setFilter(0);
          this.golemRays.set(p.id, ray);
        }
        ray
          .setPosition(origin.x, origin.y)
          .setSize(Math.max(1, length), 128)
          .setFrame(Math.floor(elapsed / 0.08) % 10)
          .setRotation(angle)
          .setVisible(!debug);
        let tip = this.golemTips.get(p.id);
        if (!tip) {
          tip = this.scene.add
            .image(p.x, p.y, golemKey("beam-tip"))
            .setOrigin(112 / 128, 0.5)
            .setScale(0.6)
            .setDepth(1802);
          this.scene.textures.get(golemKey("beam-tip")).setFilter(0);
          this.golemTips.set(p.id, tip);
        }
        tip
          .setPosition(p.x, p.y)
          .setRotation(angle)
          .setFrame(golemBeamTipFrame(elapsed))
          .setVisible(!debug);
        continue;
      }
      if (p.fireballLevel === 1) this.baseShots.add(p.id);
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
            ensureMagicTexture(
              this.scene,
              p.fireballLevel === 1
                ? "baseFireball"
                : p.fireballLevel
                  ? "fireball"
                  : "flight",
              palette,
            ),
            p.fireballLevel === 1
              ? baseFireballFrame(now - flight.start)
              : p.fireballLevel
                ? fireballFrame(p.fireballLevel, now - flight.start)
                : flightFrame(now - flight.start),
          )
          .setVisible(!debug)
          .setScale(
            p.fireballLevel ? 1 : effectPresentationProfiles.projectile.scale,
          )
          .setPosition(
            q.x + effectPresentationProfiles.projectile.offsetX,
            q.y + effectPresentationProfiles.projectile.offsetY,
          )
          .setRotation(angle);
        // Core retains its frame and shares the explicit presentation profile.
        flight.core
          .setTexture(ensureMagicTexture(this.scene, "core", palette), 0)
          .setVisible(!debug && !p.fireballLevel)
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
    for (const [id, im] of this.golemShots)
      if (!world.projectiles[id]) {
        const ray = this.golemRays.get(id),
          tip = this.golemTips.get(id);
        this.golemFades.set(id, {
          parts: [im, ...(ray ? [ray] : []), ...(tip ? [tip] : [])],
          ray,
          elapsed: 0,
          last: now,
        });
        this.golemShots.delete(id);
        this.golemRays.delete(id);
        this.golemTips.delete(id);
      }
    for (const [id, fade] of this.golemFades) {
      fade.elapsed += (now - fade.last) * (world.slowTime ? 0.2 : 1);
      fade.last = now;
      const look = golemBeamFade(fade.elapsed);
      if (look.done) {
        for (const part of fade.parts) part.destroy();
        this.golemFades.delete(id);
        continue;
      }
      for (const part of fade.parts) part.setAlpha(look.alpha).setVisible(!debug);
      fade.ray?.setScale(1, 0.4 * look.thickness);
    }
    for (const hit of world.projectileImpacts || [])
      if (!this.seen.has(hit.id)) {
        this.seen.add(hit.id);
        if (hit.effect === "golem_blast") {
          const age = Math.max(0, ((world.serverTick - hit.tick) * 1000) / SERVER_HZ);
          if (age < golemBlastDuration)
            this.golemBlasts.set(hit.id, {
              sprite: this.scene.add
                .image(hit.x, hit.y, golemKey("blast"))
                .setOrigin(0.5, 100 / 128)
                .setDepth(33),
              elapsed: age,
              last: now,
            });
          continue;
        }
        const age = Math.max(0, ((world.serverTick - hit.tick) * 1000) / SERVER_HZ);
        const owner = world.players[hit.owner];
        const base =
          this.baseShots.has(hit.id) ||
          (owner?.role === "EMBER" &&
            fireballLevel(owner.unlockedSkills) === 1);
        if (
          age < (base ? baseFireballImpactDuration : impactDuration) &&
          this.scene.textures.exists(magicKey("impact"))
        ) {
          const palette =
            world.players[hit.owner]?.appearance?.effectPalette || "ember";
          this.bursts.set(hit.id, {
            sprite: this.scene.add
              .image(hit.x, hit.y, magicKey("impact"))
              .setOrigin(0.5, 0.5)
              .setDepth(32),
            base,
            start: now - age,
            palette,
          });
        }
      }
    for (const [id, b] of this.golemBlasts) {
      b.elapsed += (now - b.last) * (world.slowTime ? 0.2 : 1);
      b.last = now;
      if (b.elapsed >= golemBlastDuration) {
        b.sprite.destroy();
        this.golemBlasts.delete(id);
        continue;
      }
      b.sprite
        .setFrame(golemEffectFrame("blast", b.elapsed, false))
        .setVisible(!debug);
    }
    const retained = new Set((world.projectileImpacts || []).map((e) => e.id));
    for (const id of this.seen) if (!retained.has(id)) this.seen.delete(id);
    for (const id of this.baseShots)
      if (!world.projectiles[id] && !retained.has(id))
        this.baseShots.delete(id);
    for (const [id, b] of this.bursts) {
      const duration = b.base ? baseFireballImpactDuration : impactDuration;
      const elapsed = now - b.start;
      if (elapsed >= duration) {
        b.sprite.destroy();
        this.bursts.delete(id);
        continue;
      }
      b.sprite
        .setTexture(
          ensureMagicTexture(
            this.scene,
            b.base ? "baseFireball" : "impact",
            b.palette,
          ),
          b.base ? baseFireballImpactFrame(elapsed) : impactFrame(elapsed),
        )
        .setVisible(!debug)
        .setAlpha(elapsed > duration - 100 ? (duration - elapsed) / 100 : 1);
    }
  }
  // Read-only presentation diagnostics; never consumed by simulation or networking.
  inspect() {
    return {
      blackHoles: [...this.holes].map(([id, im]) => ({
        id,
        frame: Number(im.frame.name),
        x: im.x,
        y: im.y,
      })),
      golemShots: [...this.golemShots].map(([id, im]) => ({
        id,
        x: im.x,
        y: im.y,
        frame: Number(im.frame.name),
      })),
      golemTips: [...this.golemTips].map(([id, tip]) => ({
        id,
        x: tip.x,
        y: tip.y,
        frame: Number(tip.frame.name),
      })),
      golemRays: [...this.golemRays].map(([id, ray]) => ({
        id,
        x: ray.x,
        y: ray.y,
        length: ray.width,
        frame: Number(ray.frame.name),
      })),
      golemBlasts: [...this.golemBlasts].map(([id, b]) => ({
        id,
        x: b.sprite.x,
        y: b.sprite.y,
        frame: Number(b.sprite.frame.name),
      })),
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
    for (const im of this.holes.values()) im.destroy();
    this.holes.clear();
    this.baseShots.clear();
    for (const im of this.golemShots.values()) im.destroy();
    this.golemShots.clear();
    for (const ray of this.golemRays.values()) ray.destroy();
    this.golemRays.clear();
    for (const tip of this.golemTips.values()) tip.destroy();
    this.golemTips.clear();
    for (const fade of this.golemFades.values())
      for (const part of fade.parts) part.destroy();
    this.golemFades.clear();
    for (const b of this.golemBlasts.values()) b.sprite.destroy();
    this.golemBlasts.clear();
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
