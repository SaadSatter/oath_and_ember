import Phaser from "phaser";
import { SERVER_HZ } from "../../../../packages/shared/src/constants.js";
import type {
  World,
  SceneId,
} from "../../../../packages/shared/src/gameTypes.js";
import type { PlayerView } from "./PlayerView.js";
import clock from "../animation/slowTimeClock.json" with { type: "json" };
export const preloadTemporal = (scene: Phaser.Scene) =>
  scene.load.spritesheet(
    "slow-time-clock",
    "/assets/effects/coco/slow-time-clock.png",
    { frameWidth: 64, frameHeight: 64 },
  );
export class TemporalView {
  private camera: Phaser.Cameras.Scene2D.Camera;
  private gray: Phaser.Filters.ColorMatrix;
  private clock: Phaser.GameObjects.Image;
  private trails: Phaser.GameObjects.Image[];
  private samples = 0;
  private lastSample = -Infinity;
  constructor(private scene: Phaser.Scene) {
    this.gray = scene.cameras.main.filters.internal.addColorMatrix();
    this.gray.colorMatrix.grayscale(1);
    this.gray.active = false;
    this.camera = scene.cameras.add(
      0,
      0,
      scene.scale.width,
      scene.scale.height,
    );
    this.clock = scene.add
      .image(0, 0, "slow-time-clock")
      .setScale(0.65)
      .setVisible(false)
      .setDepth(10000);
    this.trails = Array.from({ length: 4 }, () => {
      const image = scene.add
        .image(0, 0, "slow-time-clock")
        .setVisible(false)
        .setTint(0x3399ff);
      image.setTintMode(Phaser.TintModes.FILL);
      return image;
    });
    scene.cameras.main.ignore([this.clock, ...this.trails]);
  }
  update(
    world: World,
    sceneId: SceneId,
    views: Map<string, PlayerView>,
    now: number,
  ) {
    const slow = world.slowTime;
    this.gray.active = !!slow;
    const main = this.scene.cameras.main;
    this.camera
      .setViewport(main.x, main.y, main.width, main.height)
      .setScroll(main.scrollX, main.scrollY)
      .setZoom(main.zoom);
    const overlay = new Set<Phaser.GameObjects.GameObject>([
      this.clock,
      ...this.trails,
    ]);
    this.camera.ignore(
      this.scene.children.list.filter((object) => !overlay.has(object)),
    );
    const coco = slow && world.players[slow.owner];
    const pose = coco && views.get(coco.id)?.temporalPose();
    this.clock.setVisible(
      !!pose && (coco!.sceneId ?? world.sceneId) === sceneId,
    );
    if (pose && slow) {
      let age =
          (((world.serverTick - slow.startedTick) * 1000) / SERVER_HZ) %
          clock.durations.reduce((sum, ms) => sum + ms, 0),
        frame = 0;
      while (
        frame < clock.durations.length - 1 &&
        age >= clock.durations[frame]
      )
        age -= clock.durations[frame++];
      this.clock.setFrame(frame).setPosition(pose.x, pose.y - 80);
    }
    const sieg = Object.values(world.players).find(
      (p) => p.role === "OATH" && (p.sceneId ?? world.sceneId) === sceneId,
    );
    const running =
      !!slow &&
      !!sieg &&
      (sieg.sprintRemaining ?? 0) > 0 &&
      Math.hypot(sieg.vx, sieg.vy) > 1;
    if (!running) {
      this.trails.forEach((image) => image.setVisible(false));
      this.samples = 0;
      return;
    }
    const body = views.get(sieg!.id)?.temporalPose();
    if (body && now - this.lastSample >= 65) {
      this.lastSample = now;
      const image = this.trails[this.samples++ % 4];
      image
        .setTexture(body.texture, body.frame)
        .setPosition(body.x, body.y)
        .setOrigin(body.originX, body.originY)
        .setScale(body.scaleX, body.scaleY)
        .setFlipX(body.flipX)
        .setTint(0x3399ff)
        .setVisible(true)
        .setDepth(body.y - 1);
      image.setTintMode(Phaser.TintModes.FILL);
      image.setData("born", now);
    }
    for (const image of this.trails) {
      const age = now - (image.getData("born") ?? -Infinity);
      image.setAlpha(Math.max(0, 0.5 * (1 - age / 300)));
      if (age >= 300) image.setVisible(false);
    }
  }
  destroy() {
    this.gray.active = false;
    this.clock.destroy();
    this.trails.forEach((image) => image.destroy());
    this.scene.cameras.remove(this.camera);
  }
}
