import Phaser from "phaser";
import type {
  SceneId,
  StoryState,
} from "../../../../packages/shared/src/gameTypes.js";

// The cloaked stranger on the shop road, drawn where the server's story puts
// her. Sheet from scripts/import-village-npcs.mjs (Story_NPCs/stranger,
// hooded): 96px cells, rows south/east/north/west, standing only. When the
// story removes her she fades out where she stood: no walk, no trace.
const CELL = 96,
  ROWS = ["south", "east", "north", "west"] as const;
const ORIGIN_Y = (CELL / 2 + 28) / CELL,
  FEET_OFFSET = 13,
  FADE_MS = 700;
const KEY = "npc:stranger";

export function preloadStranger(scene: Phaser.Scene) {
  scene.load.spritesheet(KEY, "/assets/npcs/stranger.png", {
    frameWidth: CELL,
    frameHeight: CELL,
  });
}

export class StrangerView {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private fadingSince: number | null = null;
  private scene: SceneId | null = null;
  constructor(private phaser: Phaser.Scene) {}
  update(
    story: StoryState | undefined,
    sceneId: SceneId,
    hidden: boolean,
    now: number,
  ) {
    const her = story?.stranger;
    if (her && her.scene === sceneId && !hidden) {
      if (!this.sprite) {
        this.phaser.textures
          .get(KEY)
          .setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.sprite = this.phaser.add
          .sprite(0, 0, KEY, 0)
          .setOrigin(0.5, ORIGIN_Y)
          .setName("npc:stranger");
      }
      this.fadingSince = null;
      this.scene = sceneId;
      this.sprite
        .setPosition(her.x, her.y + FEET_OFFSET)
        .setFrame(ROWS.indexOf(her.facing))
        .setDepth(her.y)
        .setAlpha(1)
        .setVisible(true);
      return;
    }
    if (!this.sprite?.visible) return;
    // Gone from the story: fade out in place (only if still in her scene).
    if (this.scene !== sceneId || hidden) {
      this.sprite.setVisible(false);
      return;
    }
    this.fadingSince ??= now;
    const left = 1 - (now - this.fadingSince) / FADE_MS;
    if (left <= 0) this.sprite.setVisible(false);
    else this.sprite.setAlpha(left);
  }
  destroy() {
    this.sprite?.destroy();
    this.sprite = null;
  }
}
