import {
  EnemyPresentation,
  enemyDirection,
} from "../animation/EnemyPresentation.js";
import { SERVER_HZ } from "../../../../packages/shared/src/constants.js";
import { MosslingAttackPresentation } from "../animation/mosslingAttack.js";
export { enemyDirection } from "../animation/EnemyPresentation.js";
import {
  preloadGolemAttack,
  golemKey,
  golemAttackFrame,
  golemMeleeFrame,
  golemPalm,
  golemEffectFrame,
} from "../animation/golem.js";
import Phaser from "phaser";
import type { Enemy } from "../../../../packages/shared/src/gameTypes.js";
import {
  enemyDefinitions,
  golemMelee,
} from "../../../../packages/shared/src/enemies.js";
import { enemyVisuals } from "../assets/enemyVisuals.js";
import {
  externalAnimationFrames,
  externalDirection,
  externalStandingFrame,
} from "../assets/externalAnimationFrames.js";
export function preloadEnemies(scene: Phaser.Scene) {
  preloadGolemAttack(scene);
  for (const c of enemyVisuals)
    scene.load.spritesheet(c.asset_id, c.url, {
      frameWidth: c.frame_dimensions[0],
      frameHeight: c.frame_dimensions[1],
    });
}
export function registerEnemies(scene: Phaser.Scene) {
  for (const c of enemyVisuals)
    scene.textures
      .get(c.asset_id)
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
  for (const c of enemyVisuals)
    for (const [row, dir] of c.directions.entries())
      scene.anims.create({
        key: `${c.asset_id}:${c.motion}_${dir}`,
        frames: scene.anims.generateFrameNumbers(c.asset_id, {
          frames: externalAnimationFrames(c, row),
        }),
        frameRate: c.fps,
        repeat: -1,
      });
}
export class EnemyView {
  private presentation = new EnemyPresentation();
  private mossling = new MosslingAttackPresentation();
  private mosslingPose: ReturnType<MosslingAttackPresentation["update"]> = null;
  private sprite: Phaser.GameObjects.Sprite;
  private bar: Phaser.GameObjects.Graphics;
  private swipe: Phaser.GameObjects.Graphics;
  private charge: Phaser.GameObjects.Image;
  private text: Phaser.GameObjects.Text;
  constructor(
    private scene: Phaser.Scene,
    e: Enemy,
    private visualOverride?: string,
  ) {
    const c = this.contract(e);
    this.sprite = scene.add
      .sprite(e.x, e.y, c.asset_id)
      .setOrigin(
        c.anchor[0] / c.frame_dimensions[0],
        c.anchor[1] / c.frame_dimensions[1],
      );
    this.charge = scene.add
      .image(e.x, e.y, golemKey("charge"))
      .setVisible(false)
      .setScale(0.32);
    for (const kind of ["attack", "charge", "blast", "melee"])
      scene.textures
        .get(golemKey(kind))
        .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.bar = scene.add.graphics();
    this.swipe = scene.add.graphics();
    this.text = scene.add
      .text(0, 0, "", {
        fontSize: "9px",
        color: "#ffe3b3",
        backgroundColor: "#14251f",
      })
      .setOrigin(0.5);
  }
  private contract(e: Enemy) {
    return enemyVisuals.find(
      (c) =>
        c.asset_id === (this.visualOverride ?? enemyDefinitions[e.type].sprite),
    )!;
  }
  update(
    e: Enemy,
    pos: { x: number; y: number },
    tick: number,
    debug: boolean,
    timeScale = 1,
  ) {
    this.sprite.anims.timeScale = timeScale;
    const motion = this.presentation.update(e, tick);
    this.mosslingPose = this.visualOverride
      ? null
      : this.mossling.update(e, tick, motion.attacking);
    const c = this.contract(e),
      direction = enemyDirection(motion.facing, c.directions.length),
      resolved = externalDirection(c, direction);
    const scales = c.direction_scales as
      Partial<Record<string, number>> | undefined;
    this.sprite
      .setPosition(pos.x, pos.y)
      .setDepth(pos.y)
      .setFlipX(resolved.flipX)
      .setRotation(0)
      .setScale(scales?.[direction] ?? c.scale);
    const animated =
      e.state !== "DEAD" && (motion.moving || c.motion === "hover");
    const charging =
      e.type === "ironbound_sentinel" &&
      motion.attacking &&
      e.attackStartedTick !== null;
    const punching = charging && e.attackKind === "melee";
    this.charge.setVisible(charging && !punching);
    if (charging) {
      const direction = enemyDirection(motion.facing) as keyof typeof golemPalm;
      const elapsed = Math.max(0, tick - e.attackStartedTick!) / SERVER_HZ,
        progress =
          elapsed /
          ((punching
            ? golemMelee.durationTicks
            : enemyDefinitions[e.type].windupTicks) /
            SERVER_HZ),
        palm = golemPalm[direction];
      this.charge.setVisible(!punching && progress < 1);
      this.sprite.anims.stop();
      this.sprite
        .setTexture(
          golemKey(punching ? "melee" : "attack"),
          punching
            ? golemMeleeFrame(direction, progress)
            : golemAttackFrame(direction, progress >= 1 ? 2 / 9 : progress),
        )
        .setOrigin(64 / 128, 108 / 128)
        .setScale(1)
        .setFlipX(false);
      this.charge
        .setPosition(pos.x + palm.x, pos.y + palm.y)
        .setDepth(pos.y + 1)
        .setFrame(golemEffectFrame("charge", elapsed * 1000))
        .setScale(0.15 + Math.min(1, progress) * 0.3);
    } else {
      if (this.sprite.texture.key !== c.asset_id)
        this.sprite.setTexture(c.asset_id);
      this.sprite.setOrigin(
        c.anchor[0] / c.frame_dimensions[0],
        c.anchor[1] / c.frame_dimensions[1],
      );
      if (animated)
        this.sprite.play(
          `${c.asset_id}:${c.motion}_${resolved.sourceDirection}`,
          true,
        );
      else {
        this.sprite.anims.stop();
        this.sprite.setFrame(externalStandingFrame(c, direction));
      }
    }
    this.swipe.clear().setDepth(pos.y + 1);
    const mossling = this.mosslingPose;
    if (mossling) {
      const facing = enemyDirection(mossling.facing);
      this.sprite.anims.stop();
      this.sprite
        .setFrame(externalStandingFrame(c, facing))
        .setPosition(pos.x + mossling.offsetX, pos.y + mossling.offsetY)
        .setScale(c.scale * mossling.scaleX, c.scale * mossling.scaleY)
        .setRotation(mossling.lean);
      const centerX = pos.x + Math.cos(mossling.facing) * 12;
      const centerY = pos.y - 14 + Math.sin(mossling.facing) * 12;
      if (mossling.slashAlpha > 0) {
        for (let claw = 0; claw < 3; claw++) {
          const points = Array.from({ length: 10 }, (_, index) => {
            const angle =
              mossling.facing - 1.1 + (index / 9) * 1.7 * mossling.swing;
            const radius = 23 + claw * 4;
            return new Phaser.Math.Vector2(
              Math.round((centerX + Math.cos(angle) * radius) / 2) * 2,
              Math.round((centerY + Math.sin(angle) * radius) / 2) * 2,
            );
          });
          this.swipe
            .lineStyle(4, 0x39442a, mossling.slashAlpha * 0.65)
            .strokePoints(points);
          this.swipe
            .lineStyle(2, claw === 1 ? 0xffedb4 : 0xc5dc83, mossling.slashAlpha)
            .strokePoints(points);
        }
      }
      for (let leaf = 0; leaf < 4; leaf++) {
        const spread =
          mossling.swing > 0 ? mossling.swing * 16 : mossling.crouch * 5;
        const angle = mossling.facing + (leaf - 1.5) * 0.7;
        const x = pos.x + Math.cos(angle) * (12 + spread);
        const y =
          pos.y - 10 + Math.sin(angle) * (12 + spread) - mossling.crouch * 5;
        this.swipe
          .fillStyle(
            leaf % 2 ? 0xc7b46b : 0x719747,
            Math.max(mossling.crouch, mossling.slashAlpha) * 0.8,
          )
          .fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, 4, 2);
      }
    }
    this.sprite.setVisible(e.state !== "DEAD");
    this.bar.clear().setDepth(pos.y + 1);
    if (
      motion.attacking &&
      !charging &&
      (e.type !== "mossling" || !!this.visualOverride)
    )
      this.bar
        .lineStyle(2, 0xff9b32, 0.85)
        .strokeCircle(
          pos.x,
          pos.y,
          enemyDefinitions[e.type].attackRange > 80
            ? 20
            : enemyDefinitions[e.type].attackRange,
        );
    if (e.state !== "DEAD") {
      this.bar.fillStyle(0x17221c).fillRect(pos.x - 18, pos.y - 65, 36, 4);
      this.bar
        .fillStyle(0xe86262)
        .fillRect(pos.x - 18, pos.y - 65, (36 * e.hp) / e.maxHp, 4);
    }
    this.text
      .setPosition(pos.x, pos.y + 16)
      .setDepth(pos.y + 2)
      .setVisible(debug)
      .setText(
        `${e.id} ${e.type}\nT${tick} ${e.state} HP${e.hp}\n→${e.targetId?.slice(0, 6) ?? "none"}`,
      );
  }
  inspect() {
    return {
      x: this.sprite.x,
      y: this.sprite.y,
      frame: Number(this.sprite.frame.name),
      texture: this.sprite.texture.key,
      charging: this.charge.visible,
      attackPose: this.mosslingPose,
      flipX: this.sprite.flipX,
      animation: this.sprite.anims.currentAnim?.key,
      playing: this.sprite.anims.isPlaying,
      visible: this.sprite.visible,
    };
  }
  destroy() {
    this.sprite.destroy();
    this.charge.destroy();
    this.bar.destroy();
    this.swipe.destroy();
    this.text.destroy();
  }
}
