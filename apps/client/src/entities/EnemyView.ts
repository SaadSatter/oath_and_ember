import {
  EnemyPresentation,
  enemyDirection,
} from "../animation/EnemyPresentation.js";
import { SERVER_HZ } from "../../../../packages/shared/src/constants.js";
import { MosslingAttackPresentation } from "../animation/mosslingAttack.js";
import {
  SPIKE_HEIGHT,
  SPIKE_MID,
  SPIKE_WIDTH,
  paintSpike,
} from "../animation/mosslingSpikeArt.js";
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
  mosslingSpike,
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
/**
 * Where the Mossling's arm meets its body, per facing, from its feet (world
 * units, at its sprite's scale). Facing north the arm is behind it.
 */
const MOSSLING_HANDS: Record<string, { x: number; y: number; behind?: boolean }> = {
  south: { x: 16, y: -22 },
  north: { x: -16, y: -24, behind: true },
  east: { x: 6, y: -22 },
  west: { x: -6, y: -22 },
};
export class EnemyView {
  private presentation = new EnemyPresentation();
  private mossling = new MosslingAttackPresentation();
  private mosslingPose: ReturnType<MosslingAttackPresentation["update"]> = null;
  private sprite: Phaser.GameObjects.Sprite;
  private bar: Phaser.GameObjects.Graphics;
  private swipe: Phaser.GameObjects.Graphics;
  /** The warning line on the ground under a Mossling's coming spike. */
  private telegraph: Phaser.GameObjects.Graphics;
  /** The Mossling's arm as a wooden spike (made on its first attack). */
  private spike?: {
    key: string;
    texture: Phaser.Textures.CanvasTexture;
    image: Phaser.GameObjects.Image;
    pixels: ImageData;
  };
  private static spikes = 0;
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
    this.telegraph = scene.add.graphics().setDepth(-35);
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
    this.telegraph.clear();
    const mossling = this.mosslingPose;
    if (this.spike) this.spike.image.setVisible(false);
    if (mossling) {
      const facing = enemyDirection(mossling.facing);
      this.sprite.anims.stop();
      this.sprite
        .setFrame(externalStandingFrame(c, facing))
        .setPosition(pos.x + mossling.offsetX, pos.y + mossling.offsetY)
        .setScale(c.scale * mossling.scaleX, c.scale * mossling.scaleY)
        .setRotation(mossling.lean);
      this.drawSpike(pos, mossling, facing, debug);
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
  /**
   * The arm, hardening into a wooden spike that shoots out along the locked
   * aim. Its point lies on the line the server strikes along.
   */
  private drawSpike(
    pos: { x: number; y: number },
    pose: NonNullable<EnemyView["mosslingPose"]>,
    facing: string,
    debug: boolean,
  ) {
    if (!this.spike) {
      const key = `mossling-spike:${EnemyView.spikes++}`;
      const texture = this.scene.textures.createCanvas(
        key,
        SPIKE_WIDTH,
        SPIKE_HEIGHT,
      )!;
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.spike = {
        key,
        texture,
        image: this.scene.add
          .image(0, 0, key)
          .setOrigin(0, SPIKE_MID / SPIKE_HEIGHT),
        pixels: texture.getContext().createImageData(SPIKE_WIDTH, SPIKE_HEIGHT),
      };
    }
    const hand = MOSSLING_HANDS[facing] ?? MOSSLING_HANDS.south,
      cos = Math.cos(pose.facing),
      sin = Math.sin(pose.facing),
      body = { x: pos.x + pose.offsetX, y: pos.y + pose.offsetY },
      from = { x: body.x + hand.x, y: body.y + hand.y },
      to = {
        x: body.x + cos * pose.length,
        y: body.y + sin * pose.length + hand.y * 0.6,
      },
      length = Math.hypot(to.x - from.x, to.y - from.y);
    paintSpike(this.spike.pixels, length, pose.wood);
    this.spike.texture.getContext().putImageData(this.spike.pixels, 0, 0);
    this.spike.texture.refresh();
    this.spike.image
      .setVisible(!debug)
      .setPosition(Math.round(from.x), Math.round(from.y))
      .setRotation(Math.atan2(to.y - from.y, to.x - from.x))
      // Pointing west it would be upside down: keep the lit, mossy side up.
      .setFlipY(to.x < from.x)
      // Thrust north, the arm is behind the body; otherwise in front.
      .setDepth(pos.y + (hand.behind ? -1 : 1));
    // A faint line on the ground shows where it will strike.
    if (pose.telegraph > 0)
      for (let d = 16; d <= mosslingSpike.reach; d += 8)
        this.telegraph
          .fillStyle(0x2c3a1a, 0.45 * pose.telegraph * (1 - d / 260))
          .fillRect(
            Math.round(pos.x + cos * d) - 1,
            Math.round(pos.y + sin * d) - 1,
            3,
            3,
          );
    // Splinters and leaves burst from the point as it lands.
    if (pose.burst > 0) {
      const spread = (1 - pose.burst) * 18;
      for (let i = 0; i < 7; i++) {
        const a = pose.facing + (i - 3) * 0.55;
        this.swipe
          .fillStyle(
            i % 3 === 0 ? 0x9cc25a : i % 2 ? 0xc39a63 : 0x6e4b2c,
            pose.burst,
          )
          .fillRect(
            Math.round(to.x + Math.cos(a) * (4 + spread)),
            Math.round(to.y + Math.sin(a) * (4 + spread) - spread * 0.3),
            i % 3 === 0 ? 3 : 2,
            2,
          );
      }
    }
  }
  destroy() {
    this.telegraph.destroy();
    if (this.spike) {
      this.spike.image.destroy();
      this.scene.textures.remove(this.spike.key);
    }
    this.sprite.destroy();
    this.charge.destroy();
    this.bar.destroy();
    this.swipe.destroy();
    this.text.destroy();
  }
}
