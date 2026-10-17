import Phaser from "phaser";
import type {
  World,
  SceneId,
} from "../../../../packages/shared/src/gameTypes.js";
import {
  shrinePaths,
  shrineTrees,
  shrineShrubs,
  shrinePoints,
  shrineComplete,
} from "../../../../packages/shared/src/shrine.js";
export function preloadShrine(s: Phaser.Scene) {
  for (const mood of ["crying", "happy"])
    s.load.image(
      `shrine:${mood}`,
      `/assets/environment/goddess-shrine/${mood}.png`,
    );
  s.load.image("shrine:wig", "/assets/ui/inventory/items/griffin-wig.png");
}
export class ShrineView {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private active = false;
  private statue?: Phaser.GameObjects.Image;
  private wig?: Phaser.GameObjects.Image;
  private title?: Phaser.GameObjects.Text;
  private onward?: Phaser.GameObjects.Text;
  constructor(private scene: Phaser.Scene) {}
  clear() {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
    this.active = false;
  }
  private image(key: string, x: number, y: number, depth = -10) {
    this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const o = this.scene.add.image(x, y, key).setDepth(depth);
    this.objects.push(o);
    return o;
  }
  private label(t: string, x: number, y: number, color = "#e9dfb8") {
    const o = this.scene.add
      .text(x, y, t, {
        fontFamily: "monospace",
        fontSize: "12px",
        color,
        backgroundColor: "#13291fe6",
        align: "center",
        padding: { x: 5, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(2000);
    this.objects.push(o);
    return o;
  }
  update(w: World, id: SceneId) {
    if (id !== "GODDESS_SHRINE") {
      if (this.active) this.clear();
      return;
    }
    if (!this.active) {
      this.active = true;
      const ground = this.scene.add
        .tileSprite(0, 0, 1280, 1024, "TRANSITION_TRAIL:terrain:1")
        .setOrigin(0)
        .setDepth(-110);
      this.objects.push(ground);
      for (const r of shrinePaths) {
        const o = this.scene.add
          .tileSprite(r.x, r.y, r.w, r.h, "pond:stone", 12)
          .setOrigin(0)
          .setDepth(-100);
        this.objects.push(o);
      }
      for (const [i, p] of shrineTrees.entries())
        this.image(
          i % 2 ? "ruins:base-tree" : "ruins:fall-tree",
          p.x,
          p.y - 55,
          p.y,
        );
      // Decorative shrubs frame the plaza; all entrance lanes remain six tiles wide.
      for (const p of shrineShrubs)
        this.image("maze:hedge:south", p.x, p.y, p.y);
      this.statue = this.image("shrine:crying", 640, 336, 437);
      this.wig = this.image("shrine:wig", 642, 310, 438)
        .setDisplaySize(44, 44)
        .setVisible(false);
      this.image(
        "ruins:weight-plate",
        shrinePoints.offering.x,
        shrinePoints.offering.y,
        -20,
      );
      this.title = this.label("THE BALD GODDESS", 640, 454);
      this.label(
        "E · Speak / offer a gift\nI · Shared inventory",
        640,
        593,
        "#dbbdf5",
      );
      this.label("WEST · MIRROR POND\nE · Travel", 168, 558, "#9ee3e9");
      this.label("EAST · HEDGE MAZE\nE · Travel", 1112, 558, "#9ee3e9");
      this.label("NORTH · GRIFFIN TRAIL", 640, 102, "#dac7a6");
      this.label("START / RETURN\nE · Puzzle Map 2", 640, 933);
      this.onward = this.label(
        "E · CONTINUE TO FOREST RUINS",
        848,
        730,
      ).setVisible(false);
      for (const [x, y] of [
        [432, 688],
        [848, 688],
      ])
        this.image("ruins:gold-switch", x, y, -20);
    }
    const complete = shrineComplete(w);
    this.statue?.setTexture(complete ? "shrine:happy" : "shrine:crying");
    this.wig?.setVisible(complete);
    this.onward?.setVisible(complete);
    this.title?.setText(
      complete ? "THE GODDESS OF DIVINE VOLUME" : "THE BALD GODDESS",
    );
  }
}
