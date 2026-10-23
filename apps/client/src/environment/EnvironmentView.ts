import {
  storyProps,
  storyPropsIn,
  type StoryProp,
} from "../../../../packages/shared/src/storyProps.js";
import { shoreFrame } from "./settlementShore.js";
import { settlementBuildingFrames } from "./settlementBuildings.js";
import { settlementTreeArt } from "./settlementTrees.js";
import {
  settlements,
  isSettlementScene,
  settlementPortals,
  settlementWaterTiles,
} from "../../../../packages/shared/src/settlements.js";
import { pushableDefinitions } from "../../../../packages/shared/src/pushables.js";
import type {
  StoryState,
  World,
} from "../../../../packages/shared/src/gameTypes.js";
import Phaser from "phaser";
import { classifyMapTile, mapElementDepth } from "./mapClassification.js";
import type { SceneId } from "../../../../packages/shared/src/gameTypes.js";
import { ENVIRONMENT_SCALE } from "../../../../packages/shared/src/maps.js";
import houseTrees from "../../public/assets/environment/main-house/trees.json" with { type: "json" };
import postTownMaps from "./postTownMaps.json" with { type: "json" };
import { isPostTownScene } from "../../../../packages/shared/src/maps.js";
import {
  isVillageInterior,
  villageInteriorIds,
} from "../../../../packages/shared/src/villageInteriors.js";
import lpcFurniture from "./lpcVillageFurniture.json" with { type: "json" };
import { aldenGrave } from "../../../../packages/shared/src/prologue.js";
import { oldTree } from "../../../../packages/shared/src/environmentSolids.js";
import {
  composedFrames,
  composedScenes,
  isComposedScene,
} from "../../../../packages/shared/src/composedScenes.js";
import { RuinedShopView } from "./RuinedShopView.js";
import {
  WOODS,
  woodsOmittedObjects,
  woodsWaterTiles,
} from "../../../../packages/shared/src/prologueWoods.js";
const interiorMapKey = (id: string) => `village-interior:${id}`;
// Around Alden's grave the yard is cleared (a rock, a mushroom, a fern and
// some flowers), so the grave and the old tree stand on their own. Tiles of
// the exterior map, by layer index: [column, row] in 16px tiles. The matching
// solids are gone from environmentSolids.ts.
const graveClearing: Record<number, [number, number][]> = {
  5: [[5, 12]],
  9: [
    [1, 8],
    [2, 8],
    [3, 8],
    [1, 9],
    [2, 9],
    [3, 9],
    [4, 9],
    [2, 10],
    [3, 10],
    [4, 10],
    [1, 12],
    [2, 12],
  ],
  10: [
    [2, 8],
    [3, 8],
    [2, 9],
    [3, 9],
  ],
  11: [
    [4, 10],
    [5, 10],
    [4, 11],
    [5, 11],
    [4, 12],
    [5, 12],
  ],
  12: [
    [2, 12],
    [3, 12],
    [2, 13],
    [3, 13],
  ],
  19: [
    [0, 9],
    [2, 9],
    [3, 9],
    [3, 10],
    [3, 11],
  ],
};
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
const storyKey = (image: string) => `story:${image}`;
export function preloadEnvironment(scene: Phaser.Scene) {
  scene.load.image("story:grave", "/assets/environment/story/grave.png");
  for (const image of new Set(storyProps.map((p) => p.image)))
    scene.load.image(storyKey(image), `/assets/environment/story/${image}`);
  for (const [atlas, names] of [
    ["magic-shop", ["ground", "upper", "props"]],
    ["prologue-forest", ["trail", "clearing", "props"]],
  ] as const)
    for (const name of names)
      scene.load.image(
        `${atlas}:${name}`,
        `/assets/environment/${atlas}/${name}.png`,
      );
  scene.load.image(
    "lpc:kenney",
    "/assets/environment/kenney-indoors/indoors.png",
  );
  for (const name of ["interior", "house_inside"])
    scene.load.image(
      `lpc:${name}`,
      `/assets/environment/lpc-interiors/${name}.png`,
    );
  for (const [id, map] of Object.entries(postTownMaps)) {
    const base = `/assets/environment/post-town/${map.folder}`;
    map.textures.forEach((t, i) => {
      const key = `${id}:terrain:${i}`;
      if (t.sheet)
        scene.load.spritesheet(key, `${base}/${t.filename}`, {
          frameWidth: 64,
          frameHeight: 64,
        });
      else scene.load.image(key, `${base}/${t.filename}`);
    });
    map.objects.forEach((o, i) =>
      scene.load.image(`${id}:object:${i}`, `${base}/${o.filename}`),
    );
  }
  scene.load.tilemapTiledJSON(
    "main-house",
    "/assets/environment/main-house/exterior-map.json",
  );
  scene.load.tilemapTiledJSON(
    "house-interior",
    "/assets/environment/main-house/interior-map.json",
  );
  for (const id of villageInteriorIds)
    scene.load.tilemapTiledJSON(
      interiorMapKey(id),
      `/assets/environment/village-interiors/${id.toLowerCase()}.json`,
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
  /** Post-town map object images by their export index, for scene views. */
  private postTownObjects = new Map<number, Phaser.GameObjects.Image>();
  private map: Phaser.Tilemaps.Tilemap | null = null;
  private grave: Phaser.GameObjects.Image | null = null;
  private ruinedShop: RuinedShopView | null = null;
  setGraveVisible(visible: boolean) {
    this.grave?.setVisible(visible);
  }
  /** Story set dressing in the current scene (storyProps.ts). */
  private storyImages: { prop: StoryProp; image: Phaser.GameObjects.Image }[] =
    [];
  /** Show each story prop only while the story says it is there. */
  updateStory(story: StoryState | undefined) {
    this.ruinedShop?.update(story);
    for (const { prop, image } of this.storyImages)
      image.setVisible(prop.shown?.(story) ?? true);
  }
  private pushableImages: {
    id: string;
    image: Phaser.GameObjects.Image;
    label?: Phaser.GameObjects.Text;
    x: number;
    y: number;
    groundY: number;
  }[] = [];
  constructor(private scene: Phaser.Scene) {
    // These source sheets use square pixels. Never interpolate their texels,
    // including tilemap sheets, when the renderer or viewport changes size.
    for (const key of [
      "story:grave",
      ...storyProps.map((p) => storyKey(p.image)),
      "magic-shop:ground",
      "magic-shop:upper",
      "magic-shop:props",
      "prologue-forest:trail",
      "prologue-forest:clearing",
      "prologue-forest:props",
      ...sheets.map((name) => `house:${name}`),
      ...treeNames.map((name) => `tree:${name}`),
      ...Object.entries(postTownMaps).flatMap(([id, map]) => [
        ...map.textures.map((_, i) => `${id}:terrain:${i}`),
        ...map.objects.map((_, i) => `${id}:object:${i}`),
      ]),
    ])
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  /** Show or hide one authored object of the current post-town map. */
  setObjectVisible(index: number, visible: boolean) {
    this.postTownObjects.get(index)?.setVisible(visible);
    for (const p of this.pushableImages)
      if (p.image === this.postTownObjects.get(index))
        p.label?.setVisible(visible);
  }
  updatePushables(offsets: World["pushableOffsets"]) {
    for (const object of this.pushableImages) {
      const offset = offsets?.[object.id] ?? { x: 0, y: 0 };
      object.image
        .setPosition(object.x + offset.x, object.y + offset.y)
        .setDepth(object.groundY + offset.y - 13);
      object.label
        ?.setPosition(object.x + offset.x + 40, object.groundY + offset.y + 6)
        .setDepth(object.groundY + offset.y + 1);
    }
  }
  show(id: SceneId) {
    this.clear();
    for (const prop of storyPropsIn(id)) {
      const image = this.scene.add
        .image(prop.x, prop.y, storyKey(prop.image))
        .setOrigin(0)
        .setScale(prop.scale)
        .setDepth(prop.groundY - 13)
        .setName(`story:${prop.id}`)
        .setVisible(!prop.shown);
      this.objects.push(image);
      this.storyImages.push({ prop, image });
    }
    if (isPostTownScene(id)) {
      const map = postTownMaps[id];
      for (const tile of map.tiles) {
        const image = this.scene.add
          .image(
            tile.x,
            tile.y,
            `${id}:terrain:${tile.texture}`,
            map.textures[tile.texture].sheet ? tile.frame : undefined,
          )
          .setOrigin(0)
          .setDepth(-100);
        this.objects.push(image);
      }
      map.objects.forEach((o, i) => {
        const image = this.scene.add
          .image(o.x, o.y, `${id}:object:${i}`)
          .setOrigin(0)
          .setDepth(o.groundY - 13);
        this.objects.push(image);
        this.postTownObjects.set(i, image);
        const definition = pushableDefinitions.find(
          (d) => d.scene === id && d.objectIndex === i,
        );
        if (definition) {
          const label =
            id === "PUZZLE_GLADE"
              ? undefined
              : this.scene.add
                  .text(o.x + 40, o.groundY + 6, "↔ Push", {
                    fontSize: "11px",
                    color: "#ffdfac",
                    backgroundColor: "#10202bdd",
                  })
                  .setOrigin(0.5, 0)
                  .setDepth(o.groundY + 1);
          if (label) this.objects.push(label);
          this.pushableImages.push({
            id: definition.id,
            image,
            label,
            x: o.x,
            y: o.y,
            groundY: o.groundY,
          });
        }
      });
    }
    if (id === WOODS) {
      // The Mossling Woods: the Transition Trail's own tiles and objects
      // (less the two trees where the pond lies), then the pond in the
      // approved grass/water Wang tiles.
      const map = postTownMaps.TRANSITION_TRAIL,
        key = "TRANSITION_TRAIL";
      for (const tile of map.tiles)
        this.objects.push(
          this.scene.add
            .image(
              tile.x,
              tile.y,
              `${key}:terrain:${tile.texture}`,
              map.textures[tile.texture].sheet ? tile.frame : undefined,
            )
            .setOrigin(0)
            .setDepth(-100),
        );
      for (const tile of woodsWaterTiles())
        this.objects.push(
          this.scene.add
            .image(tile.x, tile.y, "pond:water", shoreFrame(tile.mask))
            .setOrigin(0)
            .setDepth(-95),
        );
      map.objects.forEach((o, i) => {
        if (woodsOmittedObjects.includes(i)) return;
        this.objects.push(
          this.scene.add
            .image(o.x, o.y, `${key}:object:${i}`)
            .setOrigin(0)
            .setDepth(o.groundY - 13),
        );
      });
    }
    if (isComposedScene(id)) {
      // Built scenes (the shop, the prologue forest): one backdrop under the
      // heroes, and every prop depth-sorted by its base like other objects.
      const floor = composedScenes[id];
      if (id === "HOUSE_INTERIOR")
        this.ruinedShop = new RuinedShopView(this.scene);
      this.objects.push(
        this.scene.add
          .image(0, 0, `${floor.atlas}:${floor.backdrop}`)
          .setOrigin(0)
          .setScale(ENVIRONMENT_SCALE)
          .setDepth(-100),
      );
      const key = `${floor.atlas}:props`,
        props = this.scene.textures.get(key),
        frames = composedFrames[floor.atlas];
      for (const prop of floor.props) {
        if (!props.has(prop.art)) props.add(prop.art, 0, ...frames[prop.art]);
        const image = this.scene.add
          .image(prop.x, prop.y, key, prop.art)
          .setOrigin(0)
          .setScale(ENVIRONMENT_SCALE)
          .setDepth(prop.groundY - 13)
          .setName(`prop:${prop.id}`);
        this.objects.push(image);
        this.ruinedShop?.add(prop, image);
      }
    } else if (id === "MAIN_HOUSE" || isVillageInterior(id)) {
      this.map = this.scene.make.tilemap({
        key: id === "MAIN_HOUSE" ? "main-house" : interiorMapKey(id),
      });
      const sets = this.map.tilesets.map((t) =>
        this.map!.addTilesetImage(t.name, `house:${t.name.split(":")[0]}`)!,
      );
      this.map.layers.forEach((l, i) => {
        if (isVillageInterior(id)) {
          const furniture = lpcFurniture[id].find((o) => o.layer === l.name);
          if (furniture) {
            const texture = this.scene.textures.get(`lpc:${furniture.sheet}`);
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            const frame = furniture.frame.join(":");
            if (!texture.has(frame))
              texture.add(
                frame,
                0,
                ...(furniture.frame as [number, number, number, number]),
              );
            const image = this.scene.add
              .image(furniture.x, furniture.y, texture.key, frame)
              .setOrigin(0.5, 1)
              .setScale(
                Math.min(
                  furniture.width / furniture.frame[2],
                  furniture.height / furniture.frame[3],
                ),
              )
              .setDepth(furniture.depth);
            this.objects.push(image);
            return;
          }
          if (l.name === "Floor") {
            const texture = this.scene.textures.get("lpc:interior");
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
            if (!texture.has("wood-floor"))
              texture.add("wood-floor", 0, 0, 96, 32, 32);
            const tiles = l.data.flat().filter((t) => t.index >= 0);
            const left = Math.min(...tiles.map((t) => t.x)) * 32;
            const top = Math.min(...tiles.map((t) => t.y)) * 32;
            const right = (Math.max(...tiles.map((t) => t.x)) + 1) * 32;
            const bottom = (Math.max(...tiles.map((t) => t.y)) + 1) * 32;
            const floor = this.scene.add
              .tileSprite(
                left,
                top,
                right - left,
                bottom - top,
                texture.key,
                "wood-floor",
              )
              .setOrigin(0)
              .setDepth(-100);
            this.objects.push(floor);
            return;
          }
        }
        const layer = this.map!.createLayer(
          i,
          sets,
          0,
          0,
          false,
        )! as Phaser.Tilemaps.TilemapLayer;
        layer.setScale(ENVIRONMENT_SCALE).setDepth(-100 + i);
        if (id === "MAIN_HOUSE")
          for (const [x, y] of graveClearing[i] ?? []) layer.removeTileAt(x, y);
        this.objects.push(layer);
        this.sortElements(layer, id, l.name, i);
      });
      if (id === "MAIN_HOUSE") {
        houseTrees.forEach((p, i) => {
          if (!oldTree.replaces.includes(i)) this.tree(p.x, p.y, i, 2);
        });
        // Alden's grave under the west tree (hidden until the story has one).
        this.grave = this.scene.add
          .image(aldenGrave.x, aldenGrave.y, "story:grave")
          .setOrigin(0)
          .setScale(ENVIRONMENT_SCALE)
          .setDepth(aldenGrave.groundY - 13)
          .setName("story:grave")
          .setVisible(false);
        this.objects.push(this.grave);
      }
    }
    if (isSettlementScene(id)) {
      const town = settlements[id];
      const floor = this.scene.add
        .tileSprite(0, 0, town.width, town.height, "TRANSITION_TRAIL:terrain:1")
        .setOrigin(0)
        .setDepth(-110);
      this.objects.push(floor);
      for (const r of town.paths)
        this.objects.push(
          this.scene.add
            .tileSprite(r.x, r.y, r.w, r.h, "pond:stone", 12)
            .setOrigin(0)
            .setDepth(-100),
        );
      for (const tile of settlementWaterTiles(id))
        this.objects.push(
          this.scene.add
            .image(tile.x, tile.y, "pond:water", shoreFrame(tile.mask))
            .setOrigin(0)
            .setDepth(-95),
        );
      for (const b of town.buildings) {
        const key = `EMBERBROOK_VILLAGE:object:${b.art}`;
        const texture = this.scene.textures.get(key);
        if (!texture.has("building")) {
          const [x, y, w, h] = settlementBuildingFrames[b.art];
          texture.add("building", 0, x, y, w, h);
        }
        const image = this.scene.add
          .image(b.x, b.y, key, "building")
          .setOrigin(0)
          .setDisplaySize(b.w, b.h)
          .setDepth(b.y + b.h - 13);
        this.objects.push(image);
        // Enterable homes already have an E label; avoid two labels occupying the same spot.
        if (!("interior" in b)) {
          const text = this.scene.add
            .text(b.x + b.w / 2, b.y + b.h + 52, b.label, {
              fontFamily: "monospace",
              fontSize: "12px",
              color: "#f0dfaf",
              backgroundColor: "#17262ae8",
              padding: { x: 5, y: 3 },
            })
            .setOrigin(0.5)
            .setDepth(1800);
          this.objects.push(text);
        }
      }
      for (const [i, t] of town.trees.entries()) {
        const art = settlementTreeArt(i);
        this.objects.push(
          this.scene.add
            .image(t.x, t.y, art.texture)
            .setOrigin(art.originX, art.originY)
            .setDisplaySize(art.size, art.size)
            .setDepth(t.y),
        );
      }
      // The original village well anchors both plazas with a grounded sprite.
      this.objects.push(
        this.scene.add
          .image(town.width / 2, 484, "EMBERBROOK_VILLAGE:object:0")
          .setOrigin(0.5, 1)
          .setDisplaySize(96, 88)
          .setDepth(471),
      );
      const texture = this.scene.textures.get("lpc:kenney");
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      if (!texture.has("bench")) texture.add("bench", 0, 51, 0, 33, 16);
      for (const dx of [-110, 110])
        this.objects.push(
          this.scene.add
            .image(town.width / 2 + dx, 464, texture.key, "bench")
            .setScale(2)
            .setDepth(450),
        );
    }
    for (const portal of settlementPortals.filter((p) => p.from === id)) {
      const { x, y } = portal.at;
      const art = this.scene.add.graphics().setDepth(y - 13);
      if (portal.stairs) {
        art.fillStyle(0x352721).fillRect(x - 26, y - 30, 52, 60);
        for (let step = 0; step < 6; step++) {
          art
            .fillStyle(0x9e7851 + step * 0x080808)
            .fillRect(x - 22, y - 26 + step * 9, 44, 7);
          art
            .lineStyle(1, 0xe5c594)
            .lineBetween(x - 22, y - 26 + step * 9, x + 22, y - 26 + step * 9);
        }
      } else if (
        isVillageInterior(portal.to) ||
        isVillageInterior(portal.from)
      ) {
        // Doormats stay below the house silhouette instead of a board covering it.
        art.fillStyle(0xb99866).fillRect(x - 22, y + 4, 44, 12);
      } else {
        art.fillStyle(0x765334).fillRect(x - 3, y - 18, 6, 36);
        art.fillStyle(0xc9a16b).fillRoundedRect(x - 24, y - 24, 48, 25, 3);
      }
      this.objects.push(art);
      const label = this.scene.add
        .text(x, y + 40, portal.label, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#fff0c4",
          backgroundColor: "#17262ae8",
          padding: { x: 4, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(1900);
      this.objects.push(label);
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
    this.ruinedShop?.destroy();
    this.ruinedShop = null;
    this.pushableImages = [];
    this.storyImages = [];
    this.postTownObjects.clear();
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.grave = null;
    this.map?.destroy();
    this.map = null;
  }
}
