import { PlayerPresentation } from "../animation/PlayerPresentation.js";
import { combatKey, combatClip } from "../animation/combat.js";
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
    if (this.previousHP !== undefined && player.hp < this.previousHP)
      this.hurtUntil = now + 250;
    this.previousHP = player.hp;
    const hurt = now < this.hurtUntil;
    const role = player.role;
    if (role !== this.role) {
      this.sprite?.destroy();
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
    const state = selectAnimation(
      {
        ...motion,
        actionState:
          presentation.kind === "defeated" || presentation.kind === "hurt"
            ? "hurt"
            : player.actionState === "attack"
              ? "idle"
              : player.actionState,
      },
      mode,
      { ...hints, hurt },
    );
    const resolved = role
      ? resolveHeroAnimation(role, mode, state, motion.facing)
      : null;
    const key =
      role && combat
        ? combatKey(role, combat.direction)
        : role && resolved
          ? animationKey(role, mode, resolved)
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
        combat ? "combat" : "base",
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
        .setOrigin(0.5, combat ? 96 / 128 : visual.origin.y)
        .setScale(visual.scale)
        .setFlipX(mode === "PLATFORMER" && Math.cos(motion.facing) < 0)
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
        const c = combatClip(role, combat.direction);
        this.sprite.setFrame(
          c.start +
            Math.min(
              c.end - c.start,
              Math.floor((combat.elapsedMs * c.fps) / 1000),
            ),
        );
      }
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
    const g = this.graphics;
    g.clear();
    g.setDepth(mode === "TOP_DOWN" ? position.y + 1 : 11);
    if (!useSprite) {
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
    if (player.actionState === "guard") {
      g.lineStyle(
        2,
        role === "EMBER"
          ? effectColor(player.appearance?.effectPalette)
          : 0x90d9ef,
      );
      g.strokeCircle(position.x, position.y, 23);
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
    this.sprite?.destroy();
    this.effects?.destroy();
    this.graphics.destroy();
  }
}
