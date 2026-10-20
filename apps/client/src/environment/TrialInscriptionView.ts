import Phaser from "phaser";
import type {
  SceneId,
  World,
} from "../../../../packages/shared/src/gameTypes.js";
import { trialInscription } from "../../../../packages/shared/src/chapter0Finale.js";

// The inscription stone at the entrance of Puzzle Map 2 (story rooms only):
// an original flat-shaded tablet with carved lines. Decoration only; it is
// not solid, so the bridge puzzle's geometry is untouched.

export class TrialInscriptionView {
  private stone?: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {}
  update(w: World, sceneId: SceneId) {
    const show = sceneId === "BRIDGE_RUINS" && !!w.story;
    if (!show) return this.clear();
    if (this.stone) return;
    const { x, y } = trialInscription;
    const g = this.scene.add.graphics().setDepth(y);
    // Shadow, plinth, tablet, carved lines.
    g.fillStyle(0x000000, 0.28).fillEllipse(x, y + 2, 46, 12);
    g.fillStyle(0x5d5a52).fillRect(x - 20, y - 8, 40, 10);
    g.fillStyle(0x8c877a).fillRect(x - 15, y - 40, 30, 34);
    g.fillStyle(0x9f9a8c).fillRect(x - 15, y - 40, 30, 4);
    g.fillStyle(0x4b4840);
    for (const [dy, w] of [
      [-32, 20],
      [-26, 16],
      [-20, 20],
      [-14, 12],
    ])
      g.fillRect(x - w / 2, y + dy, w, 2);
    g.lineStyle(2, 0x3c3a34).strokeRect(x - 15, y - 40, 30, 34);
    this.stone = g;
  }
  clear() {
    this.stone?.destroy();
    this.stone = undefined;
  }
}
