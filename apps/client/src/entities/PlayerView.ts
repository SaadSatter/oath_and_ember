import { defenseClip, defenseKey, wardEnvelope } from "../animation/defense.js";
import { PlayerPresentation } from "../animation/PlayerPresentation.js";
import { heavyKey, combatKey, actionClip } from "../animation/combat.js";
import { ensureAppearanceTexture } from "../assets/appearanceTextures.js";
import { effectColor } from "../assets/palettes.js";
import type Phaser from "phaser";
import type { Player } from "../../../../packages/shared/src/gameTypes.js";
import {
  animationKey,
  heroAssets,
  textureKey,
  type MovementMode,
} from "../animation/definitions.js";
import {
  selectAnimation,
  resolveHeroAnimation,
  type VisualHints,
} from "../animation/selectAnimation.js";
import { characterVisuals } from "../assets/characterVisuals.js";
export type CharacterRendering = "geometric" | "sprite";
export class PlayerView {
  private presentation = new PlayerPresentation();
  private combatSequence = -1;
  private defenseSprite: Phaser.GameObjects.Image | null = null;
  private previousHit = 0;
  private effects: Phaser.GameObjects.Image | null = null;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private graphics: Phaser.GameObjects.Graphics;
  private previousHP: number | undefined;
  private hurtUntil = 0;
  private appearanceTexture = "";
  private role: Player["role"] = null;
  constructor(private scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
  }
  update(
    player: Readonly<Player>,
    motion: Readonly<Player>,
    position: { x: number; y: number },
    mode: MovementMode,
    rendering: CharacterRendering,
    hints: VisualHints = {},
  ) {
    const now = this.scene.time.now;
    const defensiveHit =
      !!player.defensiveHit && player.defensiveHit.seq > this.previousHit;
    this.previousHit = player.defensiveHit?.seq ?? 0;
    if (
      this.previousHP !== undefined &&
      player.hp < this.previousHP &&
      !defensiveHit
    )
      this.hurtUntil = now + 250;
    this.previousHP = player.hp;
    const hurt = now < this.hurtUntil;
    const role = player.role;
    if (role !== this.role) {
      this.sprite?.destroy();
      this.defenseSprite?.destroy();
      this.defenseSprite = null;
      this.effects?.destroy();
      this.effects = null;
      this.presentation = new PlayerPresentation();
      this.sprite = null;
      this.role = role;
    }
    const presentation = this.presentation.update(
      player,
      mode,
      now,
      hints.serverTick ?? player.combat?.startedTick ?? 0,
      hurt,
    );
    const combat = presentation.kind === "combat" ? presentation : null;
    const defense = presentation.kind === "defense" ? presentation : null;
    const charge = presentation.kind === "charge" ? presentation : null;
    const direction = combat?.direction || charge?.direction;
    const horizontalHeavy =
      role === "OATH" &&
      (direction === "right" || direction === "left") &&
      (!!charge || combat?.action.kind === "heavy");

    const state = selectAnimation(
      {
        ...motion,
        actionState:
          presentation.kind === "defeated" || presentation.kind === "hurt"
            ? "hurt"
            : player.actionState === "attack" ||
                player.actionState === "heavyCharge"
              ? "idle"
              : role === "EMBER" && defense
                ? "idle"
                : player.actionState,
      },
      mode,
      { ...hints, hurt },
    );
    const bodyMode = role === "EMBER" && defense ? "TOP_DOWN" : mode;
    const resolved = role
      ? resolveHeroAnimation(
          role,
          bodyMode,
          charge ? "idle" : state,
          charge
            ? { right: 0, left: Math.PI, down: Math.PI / 2, up: -Math.PI / 2 }[
                charge.direction
              ]
            : motion.facing,
        )
      : null;
    const key = horizontalHeavy
      ? charge
        ? `${heavyKey}:charge`
        : heavyKey
      : role && combat
        ? combatKey(role, combat.direction)
        : role && resolved
          ? animationKey(role, bodyMode, resolved)
          : "";
    const useSprite =
      rendering === "sprite" &&
      !!role &&
      this.scene.textures.exists(textureKey(role)) &&
      this.scene.anims.exists(key);
    if (useSprite && role) {
      const visual = characterVisuals[role];
      this.appearanceTexture = ensureAppearanceTexture(
        this.scene,
        role,
        player.appearance,
        horizontalHeavy ? "heavy" : combat ? "combat" : "base",
      );
      if (!this.sprite) {
        this.sprite = this.scene.add
          .sprite(position.x, position.y, textureKey(role))
          .setOrigin(visual.origin.x, visual.origin.y);
        // Animations retain their canonical keys and clocks. Replace only the
        // displayed texture after Phaser advances a frame, including held clips.
        this.sprite.on("animationupdate", () => this.applyAppearance());
      }
      this.sprite
        .setVisible(true)
        .setPosition(position.x + visual.offset.x, position.y + visual.offset.y)
        .setOrigin(0.5, combat || horizontalHeavy ? 96 / 128 : visual.origin.y)
        .setScale(visual.scale)
        .setFlipX(
          horizontalHeavy
            ? direction === "left"
            : mode === "PLATFORMER" && Math.cos(motion.facing) < 0,
        )
        .setDepth(mode === "TOP_DOWN" ? position.y : 10);
      // Ignore the same animation instead of restarting it each render frame.
      // A completed one-shot stays on its final frame until semantic state changes.
      if (
        this.sprite.anims.currentAnim?.key !== key ||
        (combat && this.combatSequence !== combat.action.seq)
      ) {
        this.sprite.play(key);
        if (combat) this.combatSequence = combat.action.seq;
      }
      if (combat) {
        const c = actionClip(role, combat.direction, combat.action.kind);
        this.sprite.setFrame(
          c.start +
            Math.min(
              c.end - c.start,
              Math.floor((combat.elapsedMs * c.fps) / 1000),
            ),
        );
      }
      if (horizontalHeavy && charge)
        this.sprite.setFrame(charge.ticks < 4 ? 0 : 1);
      this.applyAppearance();
      if (hurt) this.sprite.setTint(0xff9999);
      else this.sprite.clearTint();
    } else this.sprite?.setVisible(false);
    if (useSprite && role === "EMBER" && combat) {
      const effectsKey = ensureAppearanceTexture(
        this.scene,
        role,
        player.appearance,
        "effects",
      );
      if (!this.effects)
        this.effects = this.scene.add.image(position.x, position.y, effectsKey);
      this.effects
        .setTexture(effectsKey, this.sprite!.frame.name)
        .setVisible(true)
        .setOrigin(0.5, 96 / 128)
        .setPosition(
          position.x + characterVisuals[role].offset.x,
          position.y + characterVisuals[role].offset.y,
        )
        .setScale(characterVisuals[role].scale)
        .setDepth(position.y + 0.5);
    } else this.effects?.setVisible(false);
    const defenseArtwork =
      rendering === "sprite" &&
      !!role &&
      !!defense &&
      this.scene.textures.exists(defenseKey(role));
    if (defenseArtwork && role && defense) {
      const c = defenseClip(role, defense.phase, defense.direction);
      const frame =
        c.heldFrame ??
        c.start +
          (defense.phase === "loop"
            ? Math.floor((defense.elapsedMs * c.fps) / 1000) % c.count
            : Math.min(
                c.count - 1,
                Math.floor((defense.elapsedMs * c.fps) / 1000),
              ));
      const texture = ensureAppearanceTexture(
        this.scene,
        role,
        player.appearance,
        "defense",
      );
      if (!this.defenseSprite)
        this.defenseSprite = this.scene.add.image(
          position.x,
          position.y,
          texture,
        );
      const ward =
        role === "EMBER"
          ? wardEnvelope(defense.phase, defense.elapsedMs, c.durationMs)
          : null;
      this.defenseSprite
        .setAlpha(ward?.alpha ?? 1)
        .setTexture(texture, frame)
        .setVisible(true)
        .setOrigin(0.5, ward ? 70 / 128 : 96 / 128)
        .setPosition(
          position.x + characterVisuals[role].offset.x,
          position.y +
            characterVisuals[role].offset.y -
            (ward ? 26 * characterVisuals[role].scale : 0),
        )
        .setScale(characterVisuals[role].scale * (ward?.scale ?? 1))
        .setFlipX(!ward && defense.direction === "left")
        .setDepth((mode === "TOP_DOWN" ? position.y : 10) + (ward ? 0.5 : 0));
      if (role === "OATH") this.sprite?.setVisible(false);
    } else this.defenseSprite?.setVisible(false);
    const g = this.graphics;
    g.clear();
    g.setDepth(mode === "TOP_DOWN" ? position.y + 1 : 11);
    if (!useSprite && !(defenseArtwork && role === "OATH")) {
      g.fillStyle(hurt ? 0xff9999 : role === "OATH" ? 0xe4b56b : 0xc5a1f5);
      if (role === "OATH")
        g.fillRoundedRect(position.x - 13, position.y - 17, 26, 34, 4);
      else g.fillCircle(position.x, position.y, 14);
      g.lineStyle(3, 0xffffff);
      g.lineBetween(
        position.x,
        position.y,
        position.x + Math.cos(motion.facing) * 25,
        position.y + Math.sin(motion.facing) * 25,
      );
    }
    if (charge) {
      const progress = charge.progress;
      g.lineStyle(2, 0xff5544, 0.35 + 0.6 * progress);
      g.strokeCircle(position.x, position.y, 18 + progress * 9);
      g.fillStyle(0x301c22);
      g.fillRect(position.x - 18, position.y + 20, 36, 3);
      g.fillStyle(progress >= 1 ? 0xffdd9c : 0xf05c4d);
      g.fillRect(position.x - 18, position.y + 20, 36 * progress, 3);
      for (let n = 0; n < 5; n++) {
        const a = now / 180 + (n * Math.PI * 2) / 5;
        g.fillStyle(0xffa16a, 0.4 + progress * 0.5);
        g.fillRect(
          position.x + Math.cos(a) * (22 - progress * 10),
          position.y + Math.sin(a) * (22 - progress * 10),
          2,
          2,
        );
      }
    }
    if (combat?.action.kind === "heavy" && !horizontalHeavy) {
      // Unsupplied vertical heavy poses retain directional basic art plus a larger visual arc.
      const t = combat.elapsedMs / 500,
        a = combat.action.facing;
      if (t < 0.8) {
        g.lineStyle(3, 0xff634f, 1 - t);
        g.beginPath();
        g.arc(position.x, position.y, 34, a - 1 + t, a + 1 + t);
        g.strokePath();
      }
    }
    if (
      player.actionState === "guard" &&
      (!defense ||
        rendering === "geometric" ||
        !role ||
        !this.scene.textures.exists(defenseKey(role)))
    ) {
      g.lineStyle(
        2,
        role === "EMBER"
          ? effectColor(player.appearance?.effectPalette)
          : 0x90d9ef,
      );
      g.strokeCircle(position.x, position.y, 23);
    }
    if (
      defenseArtwork &&
      defense?.phase === "loop" &&
      role === "OATH" &&
      (defense.direction === "left" || defense.direction === "right")
    ) {
      const side = defense.direction === "left" ? -1 : 1;
      const pulse = 0.1 + 0.06 * Math.sin(now / 380);
      g.lineStyle(1, 0xffe4ae, pulse);
      g.strokeCircle(position.x + side * 12, position.y - 4, 6);
    }
    if (
      defense?.phase === "loop" &&
      role === "EMBER" &&
      rendering === "sprite"
    ) {
      const a = now / 450;
      g.fillStyle(effectColor(player.appearance?.effectPalette), 0.7);
      g.fillCircle(
        position.x + Math.cos(a) * 23,
        position.y - 11 + Math.sin(a) * 26,
        1.2,
      );
    }
    if (defense?.impact && role === "EMBER") {
      const t = (now % 250) / 250;
      g.lineStyle(3, effectColor(player.appearance?.effectPalette), 1 - t);
      g.strokeCircle(position.x, position.y - 11, 23 + t * 12);
    }
    if (hints.interacting) {
      g.lineStyle(
        2,
        role === "EMBER"
          ? effectColor(player.appearance?.effectPalette)
          : 0xbd93f9,
        0.6,
      );
      g.strokeCircle(position.x, position.y, 20 + Math.sin(now / 150) * 3);
    }
    g.fillStyle(0xe05260);
    g.fillRect(
      position.x - 18,
      useSprite && role
        ? position.y +
            characterVisuals[role].offset.y -
            heroAssets[role].frameHeight *
              characterVisuals[role].origin.y *
              characterVisuals[role].scale -
            6
        : position.y - 28,
      36 * Math.max(0, Math.min(1, player.hp / player.maxHp)),
      4,
    );
  }
  private applyAppearance() {
    if (
      this.sprite &&
      this.appearanceTexture &&
      this.sprite.texture.key !== this.appearanceTexture
    )
      this.sprite.setTexture(this.appearanceTexture, this.sprite.frame.name);
  }
  destroy() {
    this.defenseSprite?.destroy();
    this.sprite?.destroy();
    this.effects?.destroy();
    this.graphics.destroy();
  }
}
