import type Phaser from "phaser";
import type { Enemy } from "../../../../packages/shared/src/gameTypes.js";
import { enemyDefinitions } from "../../../../packages/shared/src/enemies.js";
import { enemyVisuals } from "../assets/enemyVisuals.js";
import {
  externalAnimationFrames,
  externalDirection,
  externalStandingFrame,
} from "../assets/externalAnimationFrames.js";
export function preloadEnemies(scene: Phaser.Scene) {
  for (const c of enemyVisuals)
    scene.load.spritesheet(c.asset_id, c.url, {
      frameWidth: c.frame_dimensions[0],
      frameHeight: c.frame_dimensions[1],
    });
}
export function registerEnemies(scene: Phaser.Scene) {
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
export function enemyDirection(angle: number) {
  return Math.abs(Math.cos(angle)) >= Math.abs(Math.sin(angle))
    ? Math.cos(angle) >= 0
      ? "east"
      : "west"
    : Math.sin(angle) >= 0
      ? "south"
      : "north";
}
export class EnemyView {
  private sprite: Phaser.GameObjects.Sprite;
  private bar: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  constructor(
    private scene: Phaser.Scene,
    e: Enemy,
  ) {
    const c = this.contract(e);
    this.sprite = scene.add
      .sprite(e.x, e.y, c.asset_id)
      .setOrigin(
        c.anchor[0] / c.frame_dimensions[0],
        c.anchor[1] / c.frame_dimensions[1],
      );
    this.bar = scene.add.graphics();
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
      (c) => c.asset_id === enemyDefinitions[e.type].sprite,
    )!;
  }
  update(
    e: Enemy,
    pos: { x: number; y: number },
    tick: number,
    debug: boolean,
  ) {
    const c = this.contract(e),
      direction = enemyDirection(e.facing),
      resolved = externalDirection(c, direction);
    const scales = c.direction_scales as
      Partial<Record<string, number>> | undefined;
    this.sprite
      .setPosition(pos.x, pos.y)
      .setDepth(pos.y)
      .setFlipX(resolved.flipX)
      .setScale(scales?.[direction] ?? c.scale);
    const animated =
      e.state !== "DEAD" &&
      (Math.hypot(e.vx, e.vy) > 0.1 || c.motion === "hover");
    if (animated)
      this.sprite.play(
        `${c.asset_id}:${c.motion}_${resolved.sourceDirection}`,
        true,
      );
    else {
      this.sprite.anims.stop();
      this.sprite.setFrame(externalStandingFrame(c, direction));
    }
    // No attack/death art exists: hold contact pose, use a geometric windup ring and hide dead sprite.
    this.sprite.setVisible(e.state !== "DEAD");
    this.bar.clear().setDepth(pos.y + 1);
    if (e.state === "ATTACK")
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
      flipX: this.sprite.flipX,
      animation: this.sprite.anims.currentAnim?.key,
      playing: this.sprite.anims.isPlaying,
      visible: this.sprite.visible,
    };
  }
  destroy() {
    this.sprite.destroy();
    this.bar.destroy();
    this.text.destroy();
  }
}
