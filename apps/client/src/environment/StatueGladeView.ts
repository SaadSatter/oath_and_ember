import Phaser from "phaser";
import { SERVER_HZ } from "../../../../packages/shared/src/constants.js";
import type { SceneId, World } from "../../../../packages/shared/src/gameTypes.js";
import {
  gladeBushes,
  gladeState,
  type GladeRock,
} from "../../../../packages/shared/src/statueGlade.js";
import type { EnvironmentView } from "./EnvironmentView.js";
// Puzzle Glade presentation: the dry thicket around the chair (burning away
// when Coco's fire catches it) and the weeping statue taking her seat. All
// timing comes from server ticks, so both heroes see the same moment.
const DIR = "/assets/environment/puzzle-glade";
// Sheet from PixelLab: frame 0 is the statue with her chair beside her,
// frames 1-8 her sitting down, frame 9 her seated (held). Each frame is the
// 160x128 canvas whose top-left sits at world (430, 376), over the statue.
export const STATUE_SIT = {
  frameWidth: 160,
  frameHeight: 128,
  frames: 10,
  frameMs: 170,
  x: 430,
  y: 376,
  ground: 496,
};
export const BUSH_BURN_MS = 1500;
// Glade export objects replaced by the seated statue artwork.
const STATUE_OBJECT = 2,
  CHAIR_OBJECT = 0;
export function preloadStatueGlade(scene: Phaser.Scene) {
  scene.load.image("glade:bush", `${DIR}/dry-bush.png`);
  scene.load.spritesheet("glade:statue-sit", `${DIR}/statue-sit.png`, {
    frameWidth: STATUE_SIT.frameWidth,
    frameHeight: STATUE_SIT.frameHeight,
  });
}
/** Which sitting frame shows `elapsedMs` after she began to sit. */
export function statueSitFrame(elapsedMs: number) {
  return Math.min(
    STATUE_SIT.frames - 1,
    Math.max(0, Math.floor(elapsedMs / STATUE_SIT.frameMs)),
  );
}
/** A bush catching fire: flames over it while it darkens and fades away. */
export function bushBurn(elapsedMs: number) {
  const t = Math.max(0, elapsedMs) / BUSH_BURN_MS;
  return {
    alpha: Math.max(0, 1 - t),
    flames: t < 1,
    flameFrame: Math.floor(Math.max(0, elapsedMs) / 130) % 16,
  };
}
export class StatueGladeView {
  private bushes: Phaser.GameObjects.Image[] = [];
  private flames: Phaser.GameObjects.Image[] = [];
  private statue?: Phaser.GameObjects.Sprite;
  private active = false;
  /** Fires once when the statue finishes sitting, for her thanks. */
  onSeated?: () => void;
  /** Fires when a rock has just been pushed up to her, for her verdict. */
  onRejected?: (item: GladeRock) => void;
  private announced = false;
  private lastRejection = -Infinity;
  constructor(
    private scene: Phaser.Scene,
    private environment: EnvironmentView,
  ) {}
  update(w: World, sceneId: SceneId, hidden: boolean) {
    if (sceneId !== "PUZZLE_GLADE") {
      if (this.active) this.clear();
      return;
    }
    if (!this.active) this.build();
    const state = gladeState(w.puzzles);
    const msSince = (tick: number | null | undefined) =>
      tick == null ? Infinity : ((w.serverTick - tick) * 1000) / SERVER_HZ;
    const burnt = state?.bushesBurned ? bushBurn(msSince(state.burnedTick)) : null;
    this.bushes.forEach((bush, i) => {
      bush
        .setVisible(!hidden && (!burnt || burnt.alpha > 0))
        .setAlpha(burnt ? burnt.alpha : 1)
        .setTint(burnt ? 0x5a3a28 : 0xffffff);
      this.flames[i]
        .setVisible(!hidden && !!burnt?.flames)
        .setFrame(burnt ? (burnt.flameFrame + i * 3) % 16 : 0);
    });
    // A rock just pushed up to her: she has opinions. Arriving later doesn't
    // replay an old one.
    const rejected = state?.rejected;
    if (rejected && rejected.tick > this.lastRejection) {
      this.lastRejection = rejected.tick;
      if (msSince(rejected.tick) < 3000) this.onRejected?.(rejected.item);
    }
    const seated = state?.seatedTick != null;
    this.environment.setObjectVisible(STATUE_OBJECT, !seated);
    this.environment.setObjectVisible(CHAIR_OBJECT, !seated);
    if (this.statue) {
      const elapsed = msSince(state?.seatedTick);
      this.statue.setVisible(seated && !hidden);
      if (seated) this.statue.setFrame(statueSitFrame(elapsed));
      // Thank the heroes once, when they watched her sit down.
      if (
        seated &&
        !this.announced &&
        elapsed >= STATUE_SIT.frames * STATUE_SIT.frameMs &&
        elapsed < STATUE_SIT.frames * STATUE_SIT.frameMs + 4000
      ) {
        this.announced = true;
        this.onSeated?.();
      }
      if (seated && elapsed >= STATUE_SIT.frames * STATUE_SIT.frameMs + 4000)
        this.announced = true;
    }
  }
  private build() {
    this.active = true;
    this.announced = false;
    for (const key of ["glade:bush", "glade:statue-sit"])
      this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const b of gladeBushes) {
      // The bush's base sits on its ground centre; depth sorts by that line.
      this.bushes.push(
        this.scene.add.image(b.x, b.y + 6, "glade:bush").setOrigin(0.5, 1).setDepth(b.y),
      );
      this.flames.push(
        this.scene.add
          .image(b.x, b.y + 4, "pond:flame", 0)
          .setOrigin(0.5, 1)
          .setDepth(b.y + 1)
          .setVisible(false),
      );
    }
    this.statue = this.scene.add
      .sprite(STATUE_SIT.x, STATUE_SIT.y, "glade:statue-sit", 0)
      .setOrigin(0)
      .setDepth(STATUE_SIT.ground - 13)
      .setVisible(false);
  }
  clear() {
    for (const o of [...this.bushes, ...this.flames]) o.destroy();
    this.bushes = [];
    this.flames = [];
    this.statue?.destroy();
    this.statue = undefined;
    this.active = false;
  }
}
