import Phaser from "phaser";
import type { ComposedProp } from "../../../../packages/shared/src/composedScenes.js";
import type { StoryState } from "../../../../packages/shared/src/gameTypes.js";
import { stageReached } from "../../../../packages/shared/src/prologue.js";

export class RuinedShopView {
  private damage: Phaser.GameObjects.Graphics;
  private furniture: { prop: ComposedProp; image: Phaser.GameObjects.Image }[] =
    [];
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.damage = scene.add
      .graphics()
      .setDepth(-90)
      .setVisible(false)
      .setName("shop:aftermath");
    const paint = (
      color: number,
      alpha: number,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      this.damage.fillStyle(color, alpha).fillRect(x, y, width, height);
    };
    const scorch = (
      left: number,
      top: number,
      width: number,
      height: number,
      seed: number,
    ) => {
      for (let row = 0; row < height; row += 2)
        for (let column = 0; column < width; column += 2) {
          const horizontal = (column + 1 - width / 2) / (width / 2);
          const vertical = (row + 1 - height / 2) / (height / 2);
          const angle = Math.atan2(vertical, horizontal);
          const radius = Math.hypot(horizontal, vertical);
          const edge =
            0.83 +
            Math.sin(angle * 3 + seed) * 0.08 +
            Math.sin(angle * 7 - seed) * 0.05;
          if (radius > edge) continue;
          const grain = ((column * 17 + row * 31 + seed) % 23) / 23;
          const fade = Math.min(1, (edge - radius) / 0.3);
          if (fade < 0.35 && grain > fade * 2) continue;
          paint(
            grain > 0.72 ? 0x51463c : 0x302b29,
            (0.12 + (1 - radius) * 0.23 + grain * 0.06) * fade,
            left + column,
            top + row,
            2,
            2,
          );
        }
    };
    for (const [left, top, width, height] of [
      [196, 184, 78, 66],
      [366, 174, 114, 82],
      [538, 180, 94, 76],
      [668, 216, 62, 40],
    ]) {
      for (let row = 0; row < height; row += 4) {
        const inset = ((row * 7 + left) % 22) & ~1;
        paint(0x302b2b, 0.36, left + inset, top + row, width - inset, 4);
        paint(
          0x57413b,
          0.32,
          left + inset + 8,
          top + row,
          width - inset - 18,
          4,
        );
      }
      for (let drip = 0; drip < 5; drip++)
        paint(
          0x49322f,
          0.55,
          left + 14 + drip * 12,
          top + height - 6,
          4,
          10 + drip * 4,
        );
    }
    for (const [left, top] of [
      [302, 168],
      [510, 182],
      [708, 188],
    ]) {
      for (let step = 0; step < 16; step++) {
        const offset = Math.floor(step / 3) * 4 - (step > 9 ? 8 : 0);
        paint(0x292629, 0.85, left + offset, top + step * 4, 2, 6);
        if (step > 6 && step < 12)
          paint(
            0x292629,
            0.7,
            left + offset - (step - 6) * 4,
            top + step * 4,
            4,
            2,
          );
      }
    }
    for (const [left, top, width, height] of [
      [384, 262, 96, 30],
      [548, 262, 88, 28],
      [144, 456, 122, 60],
      [560, 386, 112, 44],
    ]) {
      scorch(left - 8, top - 4, width + 16, height + 14, left + top);
      for (let piece = 0; piece < 14; piece++) {
        const x = left + ((piece * 29) % width);
        const y = top + ((piece * 17) % height);
        paint(0x392c28, 1, x, y, 14 + (piece % 8), 6);
        paint(0x8b6340, 1, x, y, 12 + (piece % 8), 2);
        if (piece % 3 === 0) {
          paint(0x537b77, 0.85, x + 2, y + 8, 6, 4);
          paint(0xadc0ad, 0.8, x + 4, y + 8, 2, 2);
        }
      }
    }
    for (const [left, top] of [
      [434, 294],
      [586, 298],
      [648, 440],
      [282, 482],
    ]) {
      scorch(left - 12, top - 8, 48, 28, left);
      paint(0x96877a, 0.55, left + 24, top + 12, 2, 2);
      paint(0x96877a, 0.4, left + 28, top + 8, 2, 2);
    }
  }

  add(prop: ComposedProp, image: Phaser.GameObjects.Image) {
    if (
      ["guild-books", "potion-shelf-1", "dining", "counter"].includes(prop.art)
    )
      this.furniture.push({ prop, image });
  }

  update(story: StoryState | undefined) {
    const visible = stageReached(story, "SILENT_SHOP");
    if (visible === this.visible) return;
    this.visible = visible;
    this.damage.setVisible(visible);
    for (const { prop, image } of this.furniture) {
      if (!visible) {
        image
          .setOrigin(0)
          .setPosition(prop.x, prop.y)
          .setAngle(0)
          .setScale(2)
          .clearTint()
          .setDepth(prop.groundY - 13);
      } else if (prop.art === "guild-books" || prop.art === "potion-shelf-1") {
        image
          .setOrigin(0.5)
          .setPosition(prop.x + prop.w / 2, prop.groundY - 14)
          .setDisplaySize(28, prop.w - 8)
          .setAngle(90)
          .setTint(0x9b8876)
          .setDepth(prop.groundY - 13);
      } else {
        image
          .setOrigin(0.5)
          .setPosition(prop.x + prop.w / 2, prop.groundY - 22)
          .setDisplaySize(prop.w * 0.88, 40)
          .setAngle(prop.art === "dining" ? -12 : 10)
          .setTint(0x9f8c77)
          .setDepth(prop.groundY - 13);
      }
    }
  }

  destroy() {
    this.damage.destroy();
    this.furniture = [];
  }
}
