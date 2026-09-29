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
  type VisualHints,
} from "../animation/selectAnimation.js";
export type CharacterRendering = "geometric" | "sprite";
export class PlayerView {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private graphics: Phaser.GameObjects.Graphics;
  private previousHP: number | undefined;
  private hurtUntil = 0;
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
      this.sprite = null;
      this.role = role;
    }
    const state = selectAnimation(
      { ...motion, actionState: player.actionState },
      mode,
      { ...hints, hurt },
    );
    const key = role ? animationKey(role, mode, state) : "";
    const useSprite =
      rendering === "sprite" &&
      !!role &&
      this.scene.textures.exists(textureKey(role)) &&
      this.scene.anims.exists(key);
    if (useSprite && role) {
      const asset = heroAssets[role];
      if (!this.sprite)
        this.sprite = this.scene.add
          .sprite(position.x, position.y, textureKey(role))
          .setOrigin(asset.origin.x, asset.origin.y)
          .setScale(asset.scale);
      this.sprite
        .setVisible(true)
        .setPosition(position.x, position.y)
        .setFlipX(mode === "PLATFORMER" && Math.cos(motion.facing) < 0)
        .setDepth(mode === "TOP_DOWN" ? position.y : 10);
      // Ignore the same animation instead of restarting it each render frame.
      // A completed one-shot stays on its final frame until semantic state changes.
      if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key);
      if (hurt) this.sprite.setTint(0xff9999);
      else this.sprite.clearTint();
    } else this.sprite?.setVisible(false);
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
      g.lineStyle(2, 0x90d9ef);
      g.strokeCircle(position.x, position.y, 23);
    }
    if (hints.interacting) {
      g.lineStyle(2, 0xbd93f9, 0.6);
      g.strokeCircle(position.x, position.y, 20 + Math.sin(now / 150) * 3);
    }
    g.fillStyle(0xe05260);
    g.fillRect(
      position.x - 18,
      position.y - 28,
      36 * Math.max(0, Math.min(1, player.hp / player.maxHp)),
      4,
    );
  }
  destroy() {
    this.sprite?.destroy();
    this.graphics.destroy();
  }
}
