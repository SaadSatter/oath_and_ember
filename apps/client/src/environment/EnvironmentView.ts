import Phaser from "phaser";
import { classifyMapTile, mapElementDepth } from "./mapClassification.js";
import type { SceneId } from "../../../../packages/shared/src/gameTypes.js";
import { ENVIRONMENT_SCALE } from "../../../../packages/shared/src/maps.js";
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
  "walls_floor",
  "Interior",
];
export function preloadEnvironment(scene: Phaser.Scene) {
  scene.load.tilemapTiledJSON(
    "main-house",
    "/assets/environment/main-house/exterior-map.json",
  );
  scene.load.tilemapTiledJSON(
    "house-interior",
    "/assets/environment/main-house/interior-map.json",
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
    ])
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  show(id: SceneId) {
    this.clear();
    if (id === "MAIN_HOUSE" || id === "HOUSE_INTERIOR") {
      this.map = this.scene.make.tilemap({
        key: id === "MAIN_HOUSE" ? "main-house" : "house-interior",
      });
      const sets = this.map.tilesets.map((t) =>
        this.map!.addTilesetImage(t.name, `house:${t.name.split(":")[0]}`)!,
      );
      this.map.layers.forEach((l, i) => {
        const layer = this.map!.createLayer(
          i,
          sets,
          0,
          0,
          false,
        )! as Phaser.Tilemaps.TilemapLayer;
        layer.setScale(ENVIRONMENT_SCALE).setDepth(-100 + i);
        this.objects.push(layer);
        this.sortElements(layer, id, l.name, i);
      });
      if (id === "MAIN_HOUSE")
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
  private sortElements(
    layer: Phaser.Tilemaps.TilemapLayer,
    id: SceneId,
    name: string,
    layerIndex: number,
  ) {
    layer.forEachTile((tile) => {
      if (tile.index < 0 || !tile.tileset) return;
      const element = classifyMapTile(id, name, tile.x, tile.y);
      if (element.category === "path") return;
      const depth = mapElementDepth(element, layerIndex);

      const set = tile.tileset!,
        n = tile.index - set.firstgid;
      const texture = this.scene.textures.get(
        `house:${set.name.split(":")[0]}`,
      );
      const frame = `tile:${n}`;
      if (!texture.has(frame))
        texture.add(
          frame,
          0,
          (n % set.columns) * 16,
          Math.floor(n / set.columns) * 16,
          16,
          16,
        );
      const image = this.scene.add
        .image(tile.x * 32, tile.y * 32, texture.key, frame)
        .setOrigin(0)
        .setScale(ENVIRONMENT_SCALE)
        .setDepth(depth);
      image.setFlip(tile.flipX, tile.flipY).setRotation(tile.rotation);
      tile.visible = false;
      this.objects.push(image);
    });
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
