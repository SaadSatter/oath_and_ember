import Phaser from "phaser";
import type {
  SceneId,
  World,
} from "../../../../packages/shared/src/gameTypes.js";
import {
  hedgeMazeState,
  mazeCellOpen,
  mazePaths,
} from "../../../../packages/shared/src/hedgeMaze.js";
import { EnemyView } from "../entities/EnemyView.js";
import { spawnEnemy } from "../../../../packages/shared/src/enemies.js";
import { TreasureChestView } from "./TreasureChestView.js";
const hedgeDirections = [
  "north",
  "south",
  "east",
  "west",
  "north-east",
  "north-west",
  "south-east",
  "south-west",
] as const;
export function preloadHedgeMaze(scene: Phaser.Scene) {
  for (const direction of hedgeDirections)
    scene.load.image(
      `maze:hedge:${direction}`,
      `/assets/environment/hedge-maze/hedge-rotations/${direction}.png`,
    );
  for (const key of ["cow", "bush", "chest", "hedge-wall"])
    scene.load.image(
      `maze:${key}`,
      `/assets/environment/hedge-maze/${key}.png`,
    );
  scene.load.image("maze:key", "/assets/ui/inventory/items/hedge-gate-key.png");
  scene.load.image(
    "maze:shears",
    "/assets/ui/inventory/items/enchanted-shears.png",
  );
}
export class HedgeMazeView {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private active = false;
  private cow?: Phaser.GameObjects.Image;
  private gate?: Phaser.GameObjects.Image;
  private dry: Phaser.GameObjects.Image[] = [];
  private runner?: EnemyView;
  private runnerPrevious?: {
    x: number;
    y: number;
    tick: number;
    moving: boolean;
  };
  private key?: Phaser.GameObjects.Image;
  private graphics: Phaser.GameObjects.Graphics;
  private runnerLabel?: Phaser.GameObjects.Text;
  private chest?: TreasureChestView;
  constructor(private scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(-20);
    for (const key of ["cow", "bush", "chest", "hedge-wall", "key", "shears"])
      scene.textures
        .get(`maze:${key}`)
        .setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  private hedge(direction: string, x: number, y: number) {
    const key = `maze:hedge:${direction}`;
    this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    // 85px exported canvases use one integer anchor across all eight views.
    return this.image(key, x, y).setOrigin(42 / 85, 42 / 85);
  }
  private hedgeDirection(x: number, y: number) {
    const north = mazeCellOpen(x, y - 1) || mazeCellOpen(x + 1, y - 1);
    const south = mazeCellOpen(x, y + 2) || mazeCellOpen(x + 1, y + 2);
    const west = mazeCellOpen(x - 1, y) || mazeCellOpen(x - 1, y + 1);
    const east = mazeCellOpen(x + 2, y) || mazeCellOpen(x + 2, y + 1);
    if ((north || south) && (east || west))
      return `${north ? "north" : "south"}-${east ? "east" : "west"}`;
    if (west || east) return west ? "west" : "east";
    return north ? "north" : "south";
  }
  clear() {
    this.chest?.destroy();
    this.chest = undefined;
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
    this.dry = [];
    this.runner?.destroy();
    this.runner = undefined;
    this.runnerPrevious = undefined;
    this.graphics.clear();
    this.active = false;
  }
  private label(text: string, x: number, y: number, color = "#eddfb2") {
    const label = this.scene.add
      .text(x, y, text, {
        fontSize: "12px",
        color,
        backgroundColor: "#11251ddd",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(2200);
    this.objects.push(label);
    return label;
  }
  private image(key: string, x: number, y: number) {
    const image = this.scene.add.image(x, y, key);
    this.objects.push(image);
    return image;
  }
  update(w: World, id: SceneId) {
    if (id !== "HEDGE_MAZE") {
      if (this.active) this.clear();
      return;
    }
    const state = hedgeMazeState(w.puzzles);
    if (!state) return;
    if (!this.active) {
      this.active = true;
      const ground = this.scene.add
        .tileSprite(0, 0, 1536, 1280, "TRANSITION_TRAIL:terrain:1")
        .setOrigin(0)
        .setDepth(-110);
      this.objects.push(ground);
      for (const [x, y, width, height] of mazePaths) {
        const path = this.scene.add
          .tileSprite(
            x * 32,
            y * 32,
            width * 32,
            height * 32,
            "TRANSITION_TRAIL:terrain:0",
          )
          .setOrigin(0)
          .setDepth(-100);
        this.objects.push(path);
      }
      // Pack full shrubs by their opaque foliage bounds, not their padded 85px canvases.
      // Horizontal bushes touch at 62px, vertical bushes at 30–31px; rows touch at 45px.
      const bounds: Record<string, [number, number, number, number]> = {
        north: [11, 19, 73, 64],
        south: [11, 20, 73, 65],
        east: [27, 18, 58, 66],
        west: [28, 18, 58, 66],
        "north-east": [18, 18, 67, 67],
        "north-west": [18, 18, 67, 67],
        "south-east": [15, 18, 70, 70],
        "south-west": [15, 18, 70, 70],
      };
      for (let rowTop = 0; rowTop < 1280; rowTop += 45) {
        const cy = Math.floor((rowTop + 23) / 32);
        for (let cx = 0; cx < 48;) {
          if (mazeCellOpen(cx, cy)) {
            cx++;
            continue;
          }
          const start = cx;
          while (cx < 48 && !mazeCellOpen(cx, cy)) cx++;
          const end = cx * 32;
          for (let left = start * 32; left < end;) {
            let direction = this.hedgeDirection(
              Math.floor((left + 15) / 64) * 2,
              Math.floor(cy / 2) * 2,
            );
            if (end - start * 32 < bounds[direction][2] - bounds[direction][0])
              direction = "east";
            const [bx, by, right] = bounds[direction],
              width = right - bx;
            if (left + width > end) break;
            this.hedge(direction, left + 42 - bx, rowTop + 42 - by).setDepth(
              -90,
            );
            left += width;
          }
        }
      }
      // The burnable barrier uses whole vertical shrubs placed edge-to-edge too.
      for (let rowTop = 32 * 32; rowTop < 36 * 32 - 24; rowTop += 48)
        for (const left of [18 * 32 + 1, 18 * 32 + 32])
          this.dry.push(
            this.hedge("east", left + 15, rowTop + 24)
              .setTint(0xd18a45)
              .setDepth(-25),
          );
      this.label("FIREBALL · dry hedge", 19 * 32, 31.5 * 32, "#ffbd75");
      this.cow = this.image("maze:cow", state.cow.x, state.cow.y).setDepth(800);
      this.label("BLACK HOLE → grazing bay", 22.2 * 32, 22.2 * 32, "#dbb0ff");
      this.label("Harmless cow · blocks the lane", 26 * 32, 27.7 * 32);
      this.gate = this.image("ruins:overhead-gate", 41 * 32, 14 * 32)
        .setRotation(Math.PI / 2)
        .setDepth(448);
      this.label("E · key gate", 39 * 32, 16.8 * 32);
      this.chest = new TreasureChestView(
        this.scene,
        44 * 32,
        5 * 32,
        "maze:shears",
        "Enchanted Shears",
      );
      this.label("E · Shears chest", 44 * 32, 7.2 * 32);
      this.label(
        "Slow Time + Super Speed\nChase the fleeing key carrier · E to tag",
        25 * 32,
        2.3 * 32,
        "#ffdb77",
      );
      this.key = this.image("maze:key", state.runner.x, state.runner.y - 48)
        .setDisplaySize(26, 26)
        .setDepth(2000);
      this.runnerLabel = this.label(
        "FOREST WOLF · KEY",
        state.runner.x,
        state.runner.y - 68,
        "#ffdb77",
      );
      this.runner = new EnemyView(
        this.scene,
        spawnEnemy("key-carrier", "mossling", state.runner.x, state.runner.y),
        "forest_wolf_runner",
      );
    }
    this.dry.forEach((image) => image.setVisible(!state.burned));
    this.cow?.setPosition(state.cow.x, state.cow.y).setDepth(state.cow.y);
    this.gate?.setVisible(!w.puzzles.hedgeGate.complete);
    this.chest?.update(!!w.inventory?.claimed.includes("hedge-shears-chest"));
    this.graphics.clear();
    this.graphics.fillStyle(0x565f47);
    this.graphics.fillCircle(8 * 32, 20 * 32, 26);
    this.graphics.lineStyle(4, 0xadb09a);
    this.graphics.strokeCircle(8 * 32, 20 * 32, 26);
    this.key
      ?.setVisible(!state.runner.caught)
      .setPosition(state.runner.x, state.runner.y - 48);
    this.runnerLabel
      ?.setVisible(!state.runner.caught)
      .setPosition(state.runner.x, state.runner.y - 68);
    const e = spawnEnemy(
      "key-carrier",
      "mossling",
      state.runner.x,
      state.runner.y,
    );
    e.facing = state.runner.facing;
    if (this.runnerPrevious?.tick !== w.serverTick)
      this.runnerPrevious = {
        x: e.x,
        y: e.y,
        tick: w.serverTick,
        moving:
          !!this.runnerPrevious &&
          Math.hypot(e.x - this.runnerPrevious.x, e.y - this.runnerPrevious.y) >
            0.01,
      };
    const moving = !state.runner.caught && !!this.runnerPrevious?.moving;
    e.vx = moving ? Math.cos(e.facing) * 50 : 0;
    e.vy = moving ? Math.sin(e.facing) * 50 : 0;
    e.state = state.runner.caught ? "DEAD" : "CHASE";
    this.runner?.update(e, e, w.serverTick, false, w.slowTime ? 0.2 : 1);
    if (new URLSearchParams(location.search).has("runnerQA"))
      document.querySelector<HTMLElement>("#game")!.dataset.runnerVisual =
        JSON.stringify({ ...this.runner?.inspect(), moving });
  }
}
