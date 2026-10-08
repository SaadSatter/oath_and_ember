import Phaser from "phaser";
import type { SceneId } from "../../../../packages/shared/src/gameTypes.js";
import houseTrees from "../../public/assets/environment/main-house/trees.json" with { type: "json" };
const treeNames = [
  "Tree1",
  "Tree2",
  "Tree3",
  "Moss_tree1",
  "Moss_tree2",
  "Moss_tree3",
];
const treeGroundOrigins = [
  99 / 128,
  62 / 64,
  51 / 64,
  97 / 128,
  60 / 64,
  50 / 64,
];
const sheets = [
  "ground_grass_details",
  "exterior",
  "house_details",
  "Smoke_animation",
  "Doors_windows_animation",
  "bird_jump_animation",
  "bird_fly_animation",
  "Trees_animation",
  "cat_animation",
];
export function preloadEnvironment(scene: Phaser.Scene) {
  scene.load.tilemapTiledJSON(
    "main-house",
    "/assets/environment/main-house/exterior-map.json",
  );
  for (const name of sheets)
    scene.load.image(
      `house:${name}`,
      `/assets/environment/main-house/${name}.png`,
    );
  for (const name of treeNames)
    scene.load.image(`tree:${name}`, `/assets/environment/trees/${name}.png`);
}
export class EnvironmentView {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private map: Phaser.Tilemaps.Tilemap | null = null;
  constructor(private scene: Phaser.Scene) {
    // These source sheets use square pixels. Never interpolate their texels,
    // including tilemap sheets, when the renderer or viewport changes size.
    for (const key of [
      ...sheets.map((name) => `house:${name}`),
      ...treeNames.map((name) => `tree:${name}`),
    ]) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  show(id: SceneId) {
    this.clear();
    if (id === "MAIN_HOUSE") {
      this.map = this.scene.make.tilemap({ key: "main-house" });
      const sets = this.map.tilesets.map((t) =>
        this.map!.addTilesetImage(t.name, `house:${t.name.split(":")[0]}`)!,
      );
      this.map.layers.forEach((l, i) => {
        const layer = this.map!.createLayer(i, sets, 0, 0)!;
        layer.setScale(2).setDepth(l.name === "House_roof" ? 380 : -100 + i);
        this.objects.push(layer);
      });
      houseTrees.forEach((p, i) => this.tree(p.x, p.y, i, 2));
    }
    if (id === "FOREST_RUINS") {
      for (let n = 0; n < 50; n++) {
        const x = 70 + ((n * 137) % 1650),
          y = 80 + ((n * 241) % 730);
        if (Math.abs(y - 450) > 130) this.tree(x, y, n, 2);
      }
    }
  }
  private tree(x: number, y: number, index: number, scale: number) {
    const key = `tree:${treeNames[index % treeNames.length]}`,
      im = this.scene.add.image(x, y, key);
    // Source canvases are 64px or128px; align each verified trunk base to its world ground point.
    im.setOrigin(0.5, treeGroundOrigins[index % treeNames.length])
      .setScale(scale)
      .setDepth(y);
    this.objects.push(im);
  }
  clear() {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.map?.destroy();
    this.map = null;
  }
}
