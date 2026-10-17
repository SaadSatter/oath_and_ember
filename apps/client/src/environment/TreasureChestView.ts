import Phaser from "phaser";
import { ChestRewardAnimation } from "../animation/chestReward.js";

export function preloadTreasure(s: Phaser.Scene) {
  s.load.spritesheet(
    "treasure:open",
    "/assets/environment/treasure/chest-open.png",
    { frameWidth: 64, frameHeight: 64 },
  );
  s.load.spritesheet(
    "treasure:shine",
    "/assets/environment/treasure/collect-shine.png",
    { frameWidth: 36, frameHeight: 39 },
  );
  s.load.image(
    "treasure:mirror",
    "/assets/ui/inventory/items/vanity-mirror.png",
  );
}

// Each map owns and clears its chest, including transient reward visuals.
export class TreasureChestView {
  private animation = new ChestRewardAnimation();
  private chest: Phaser.GameObjects.Image;
  private reward: Phaser.GameObjects.Image;
  private shine: Phaser.GameObjects.Image;
  private caption: Phaser.GameObjects.Text;
  constructor(
    private scene: Phaser.Scene,
    private x: number,
    private y: number,
    itemTexture: string,
    name: string,
  ) {
    for (const key of ["treasure:open", "treasure:shine", itemTexture])
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.chest = scene.add.image(x, y, "treasure:open", 0).setDepth(y);
    this.shine = scene.add
      .image(x, y, "treasure:shine", 0)
      .setOrigin(16 / 36, 25 / 39)
      .setScale(2)
      .setDepth(2098)
      .setVisible(false);
    this.reward = scene.add
      .image(x, y, itemTexture)
      .setDisplaySize(48, 48)
      .setDepth(2099)
      .setVisible(false);
    this.caption = scene.add
      .text(x, y, name, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#fff1b8",
        backgroundColor: "#1c2022e6",
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(2100)
      .setVisible(false);
  }
  update(claimed: boolean, visible = true) {
    const frame = this.animation.update(claimed, this.scene.time.now);
    this.chest.setFrame(frame.chestFrame).setVisible(visible);
    const show = visible && frame.rewardVisible;
    const y = Math.round(this.y + frame.rewardY);
    this.reward
      .setPosition(this.x, y)
      .setVisible(show)
      .setAlpha(frame.rewardAlpha);
    this.shine
      .setPosition(this.x, y)
      .setFrame(frame.shineFrame)
      .setVisible(show)
      .setAlpha(frame.rewardAlpha);
    this.caption
      .setPosition(this.x, y - 42)
      .setVisible(show)
      .setAlpha(frame.rewardAlpha);
  }
  destroy() {
    this.chest.destroy();
    this.reward.destroy();
    this.shine.destroy();
    this.caption.destroy();
  }
}
