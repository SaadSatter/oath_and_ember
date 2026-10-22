import Phaser from "phaser";
import { SERVER_HZ } from "../../../../packages/shared/src/constants.js";
import {
  castRoute,
  type DragonCast,
  type DragonRoute,
} from "../../../../packages/shared/src/waterDragon.js";
import { DRAGON_PIXEL, DragonPainter } from "./waterDragonArt.js";

// Alden's water dragon on screen. Where it is comes from the shared route (the
// server kills each monster as the head reaches it); how it looks is
// waterDragonArt.ts. Its pixels are DRAGON_PIXEL world units, drawn
// nearest-neighbour like the rest of the art.

const AIR = "story:dragon-air",
  GROUND = "story:dragon-ground";

export class WaterDragonView {
  private painter: DragonPainter;
  private air: Phaser.Textures.CanvasTexture;
  private ground: Phaser.Textures.CanvasTexture;
  private airImage: Phaser.GameObjects.Image;
  private groundImage: Phaser.GameObjects.Image;
  private route?: DragonRoute;
  private routeOf = -1;
  private shown = false;
  /** Casts whose rising and bursting the camera has already marked. */
  private rose = -1;
  private burst = -1;
  constructor(
    private scene: Phaser.Scene,
    width: number,
    height: number,
  ) {
    this.painter = new DragonPainter(width, height);
    for (const key of [AIR, GROUND])
      if (scene.textures.exists(key)) scene.textures.remove(key);
    this.air = scene.textures.addCanvas(AIR, this.painter.air)!;
    this.ground = scene.textures.addCanvas(GROUND, this.painter.ground)!;
    this.air.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.ground.setFilter(Phaser.Textures.FilterMode.NEAREST);
    // It flies over everything; its shadow and the pool it rises from lie on
    // the ground, under heroes and props.
    this.airImage = scene.add
      .image(0, 0, AIR)
      .setOrigin(0, 0)
      .setScale(DRAGON_PIXEL)
      .setDepth(5000)
      .setVisible(false);
    this.groundImage = scene.add
      .image(0, 0, GROUND)
      .setOrigin(0, 0)
      .setScale(DRAGON_PIXEL)
      .setDepth(-39)
      .setVisible(false);
  }

  update(cast: DragonCast | undefined, visible: boolean, tick: number) {
    const t = cast ? (tick - cast.start) / SERVER_HZ : -1;
    if (!cast || !visible || t < 0 || tick > cast.end + SERVER_HZ) {
      if (this.shown) {
        this.airImage.setVisible(false);
        this.groundImage.setVisible(false);
        this.shown = false;
      }
      return;
    }
    if (this.routeOf !== cast.start) {
      this.route = castRoute(cast);
      this.routeOf = cast.start;
    }
    const { burst } = this.painter.paint(cast, this.route!, t);
    const camera = this.scene.cameras.main;
    if (this.rose !== cast.start) {
      this.rose = cast.start;
      camera.shake(500, 0.004);
    }
    if (burst > 0 && this.burst !== cast.start) {
      this.burst = cast.start;
      camera.flash(300, 210, 245, 255);
    }
    this.air.refresh();
    this.ground.refresh();
    this.airImage.setVisible(true);
    this.groundImage.setVisible(true);
    this.shown = true;
  }

  destroy() {
    this.airImage.destroy();
    this.groundImage.destroy();
    this.scene.textures.remove(AIR);
    this.scene.textures.remove(GROUND);
  }
}
