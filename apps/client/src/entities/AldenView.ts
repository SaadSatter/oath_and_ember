import Phaser from "phaser";
import type {
  SceneId,
  StoryState,
} from "../../../../packages/shared/src/gameTypes.js";
import { NPC_TALK_RANGE } from "../../../../packages/shared/src/npcs.js";

// Alden, drawn wherever the server's story state puts him. Sheet from
// scripts/import-alden.mjs: 112px cells; rows south/east/north/west with
// column 0 standing and 1..8 the walk; row 4 the 9-frame south spellcast.
const CELL = 112,
  COLUMNS = 9,
  WALK_FPS = 9,
  CAST_FPS = 10,
  ROWS = ["south", "east", "north", "west"] as const;
// Feet sit on y89 of the cell; drawn 13 units below the logical position, as
// villagers and heroes are.
const ORIGIN_Y = 89 / CELL,
  FEET_OFFSET = 13;
const KEY = "npc:alden";

export function preloadAlden(scene: Phaser.Scene) {
  scene.load.spritesheet(KEY, "/assets/npcs/alden.png", {
    frameWidth: CELL,
    frameHeight: CELL,
  });
}

/** Sheet frame for Alden's pose `seconds` into his current action. */
export function aldenFrame(
  alden: NonNullable<StoryState["alden"]>,
  seconds: number,
) {
  if (alden.action === "cast")
    return 4 * COLUMNS + Math.min(8, Math.floor(seconds * CAST_FPS));
  const row = ROWS.indexOf(alden.facing) * COLUMNS;
  return alden.action === "walk"
    ? row + 1 + (Math.floor(seconds * WALK_FPS) % 8)
    : row;
}

/** Whether a hero standing at `at` can talk to Alden. */
export function nearAlden(
  story: StoryState | undefined,
  sceneId: SceneId,
  at: { x: number; y: number },
) {
  const alden = story?.alden;
  return (
    !!alden &&
    !story.cutscene &&
    alden.scene === sceneId &&
    Math.hypot(alden.x - at.x, alden.y - at.y) <= NPC_TALK_RANGE
  );
}

export class AldenView {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private prompt: Phaser.GameObjects.Text;
  private action = "";
  private actionStarted = 0;
  constructor(private phaser: Phaser.Scene) {
    this.prompt = phaser.add
      .text(0, 0, "E Talk", {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: "8px",
        color: "#ffffff",
        backgroundColor: "#050505e6",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setVisible(false);
  }
  update(
    story: StoryState | undefined,
    sceneId: SceneId,
    hero: { x: number; y: number } | null,
    hidden: boolean,
    promptHidden: boolean,
    now: number,
  ) {
    const alden = story?.alden;
    if (!alden || alden.scene !== sceneId || hidden) {
      this.sprite?.setVisible(false);
      this.prompt.setVisible(false);
      return;
    }
    if (!this.sprite) {
      this.phaser.textures
        .get(KEY)
        .setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.sprite = this.phaser.add
        .sprite(0, 0, KEY, 0)
        .setOrigin(0.5, ORIGIN_Y)
        .setName("npc:alden");
    }
    if (alden.action !== this.action) {
      this.action = alden.action;
      this.actionStarted = now;
    }
    this.sprite
      .setPosition(alden.x, alden.y + FEET_OFFSET)
      .setFrame(aldenFrame(alden, (now - this.actionStarted) / 1000))
      .setDepth(alden.y)
      .setVisible(true);
    const talk = !promptHidden && !!hero && nearAlden(story, sceneId, hero);
    this.prompt
      .setPosition(alden.x, alden.y - 52)
      .setDepth(alden.y + 2000)
      .setVisible(talk);
  }
  destroy() {
    this.sprite?.destroy();
    this.sprite = null;
    this.prompt.destroy();
  }
}
