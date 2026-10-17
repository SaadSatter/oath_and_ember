import Phaser from "phaser";
import {
  npcs,
  npcsIn,
  npcPose,
  npcInReach,
  type NpcPose,
  type NpcState,
} from "../../../../packages/shared/src/npcs.js";
import type { SceneId } from "../../../../packages/shared/src/gameTypes.js";
// Sheets from scripts/import-village-npcs.mjs: 96px cells, rows
// south/east/north/west, column 0 standing, columns 1..8 the walk.
const CELL = 96,
  WALK_FRAMES = 8,
  WALK_FPS = 9,
  ROWS = ["south", "east", "north", "west"] as const;
// Same feet line as the heroes (60/64 of a 64px frame, centred in the cell),
// drawn 13 units below the logical position like PlayerView.
const ORIGIN_Y = (CELL / 2 + 28) / CELL,
  FEET_OFFSET = 13;
const key = (sprite: string) => `npc:${sprite}`;
export function preloadNpcs(scene: Phaser.Scene) {
  for (const sprite of new Set(npcs.map((n) => n.sprite)))
    scene.load.spritesheet(key(sprite), `/assets/npcs/${sprite}.png`, {
      frameWidth: CELL,
      frameHeight: CELL,
    });
}
export function npcFrame(pose: NpcPose, columns: number) {
  const row = ROWS.indexOf(pose.facing);
  const walk =
    pose.moving && columns > 1
      ? 1 + (Math.floor(pose.stride * WALK_FPS) % WALK_FRAMES)
      : 0;
  return row * columns + walk;
}
export class NpcView {
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private prompt: Phaser.GameObjects.Text;
  private scene: SceneId | null = null;
  constructor(private phaser: Phaser.Scene) {
    this.prompt = phaser.add
      .text(0, 0, "E Talk", {
        // 8px is Press Start 2P's native grid; the camera's whole-number
        // zoom then enlarges it without blurring.
        fontFamily: '"Press Start 2P", monospace',
        fontSize: "8px",
        color: "#ffffff",
        backgroundColor: "#050505e6",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setVisible(false);
    // Phaser draws text once; redraw when the pixel font has arrived.
    void document.fonts
      ?.load('8px "Press Start 2P"')
      .then(() => this.prompt.active && this.prompt.updateText())
      .catch(() => undefined);
  }
  update(
    sceneId: SceneId,
    tick: number,
    hero: { x: number; y: number } | null,
    hidden: boolean,
    state?: NpcState,
    /** Hide the talk prompt (e.g. while a conversation is on screen). */
    promptHidden = false,
  ) {
    if (sceneId !== this.scene) {
      this.clear();
      this.scene = sceneId;
      for (const npc of npcsIn(sceneId)) {
        const texture = this.phaser.textures.get(key(npc.sprite));
        texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.sprites.set(
          npc.id,
          this.phaser.add
            .sprite(0, 0, key(npc.sprite), 0)
            .setOrigin(0.5, ORIGIN_Y)
            .setName(`npc:${npc.id}`),
        );
      }
    }
    for (const npc of npcsIn(sceneId)) {
      const sprite = this.sprites.get(npc.id);
      if (!sprite) continue;
      const pose = npcPose(npc, tick, state),
        columns = sprite.texture.source[0].width / CELL;
      sprite
        .setPosition(pose.x, pose.y + FEET_OFFSET)
        .setFrame(npcFrame(pose, columns))
        .setDepth(pose.y)
        .setVisible(!hidden);
    }
    const near =
      hero && !hidden && !promptHidden
        ? npcInReach(sceneId, hero, tick, state)
        : null;
    if (near) {
      const pose = npcPose(near, tick, state);
      this.prompt
        .setPosition(pose.x, pose.y - 50)
        .setDepth(pose.y + 2000)
        .setVisible(true);
    } else this.prompt.setVisible(false);
  }
  clear() {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
    this.prompt.setVisible(false);
    this.scene = null;
  }
  destroy() {
    this.clear();
    this.prompt.destroy();
  }
}
