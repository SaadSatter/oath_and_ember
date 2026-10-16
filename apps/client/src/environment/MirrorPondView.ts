import Phaser from "phaser";
import type {
  World,
  SceneId,
  Rect,
} from "../../../../packages/shared/src/gameTypes.js";
import {
  mirrorPondState,
  pondStations,
  pondBounds,
  pondWater,
  pondCourt,
  pondEntry,
  pondCulvert,
  pondPads,
  pondCenter,
  pondBridge,
  pondChest,
  pondGuardrails,
  pondSpikes,
} from "../../../../packages/shared/src/mirrorPond.js";
export function preloadMirrorPond(s: Phaser.Scene) {
  for (const key of ["mirror", "brazier"])
    s.load.image(`pond:${key}`, `/assets/environment/mirror-pond/${key}.png`);
  s.load.spritesheet(
    "pond:flame",
    "/assets/environment/mirror-pond/torch-flame.png",
    { frameWidth: 64, frameHeight: 64 },
  );
  s.load.json(
    "pond:flame-meta",
    "/assets/environment/mirror-pond/torch-flame.json",
  );
  s.load.spritesheet(
    "pond:stone",
    "/assets/environment/bridge-ruins/stone-tiles.png",
    { frameWidth: 32, frameHeight: 32 },
  );
  s.load.spritesheet(
    "pond:water",
    "/assets/environment/bridge-ruins/water-tiles.png",
    { frameWidth: 32, frameHeight: 32 },
  );
}
export class MirrorPondView {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private active = false;
  private flames: Phaser.GameObjects.Image[] = [];
  private angles: Phaser.GameObjects.Text[] = [];
  private mirrors: Phaser.GameObjects.Image[] = [];
  private spikes: Phaser.GameObjects.Image[] = [];
  private raised: Phaser.GameObjects.GameObject[] = [];
  private gfx: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(-4);
  }
  clear() {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
    this.mirrors = [];
    this.flames = [];
    this.angles = [];
    this.spikes = [];
    this.raised = [];
    this.gfx.clear();
    this.active = false;
  }
  private image(key: string, x: number, y: number, depth = -5) {
    this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const o = this.scene.add.image(x, y, key).setDepth(depth);
    this.objects.push(o);
    return o;
  }
  private floor(
    r: Rect,
    key = "pond:stone",
    frame = key === "pond:stone" ? 12 : 0,
  ) {
    const o = this.scene.add
      .tileSprite(r.x, r.y, r.w, r.h, key, frame)
      .setOrigin(0)
      .setDepth(-90);
    this.objects.push(o);
    return o;
  }
  private label(text: string, x: number, y: number) {
    const o = this.scene.add
      .text(x, y, text, {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#f4e4b4",
        backgroundColor: "#14252ddd",
        align: "center",
        padding: { x: 4, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(2100);
    this.objects.push(o);
    return o;
  }
  update(w: World, id: SceneId) {
    if (id !== "MIRROR_POND") {
      if (this.active) this.clear();
      return;
    }
    const state = mirrorPondState(w.puzzles);
    if (!state) return;
    if (!this.active) {
      this.active = true;
      this.floor(
        { x: 0, y: 0, w: 1536, h: 1280 },
        "TRANSITION_TRAIL:terrain:1",
      ).setDepth(-110);
      [pondBounds, pondCourt, pondEntry].forEach((r) => this.floor(r));
      this.floor(pondWater, "pond:water", 6).setDepth(-85);
      pondCulvert.forEach((r) => this.floor(r, "pond:water", 6).setDepth(-84));
      pondPads.forEach((r) => this.floor(r).setDepth(-80));
      this.raised = [
        this.floor(pondCenter).setDepth(-79),
        this.floor(pondBridge).setDepth(-79),
        this.image("maze:chest", pondChest.x, pondChest.y),
      ];
      // The blocked outer grass meets the stone walkway directly.
      for (const r of pondGuardrails) this.floor(r).setDepth(-30);
      for (let i = 0; i < 4; i++) {
        const p = pondStations[i];
        this.mirrors.push(this.image("pond:mirror", p.x, p.y));
        this.image("pond:brazier", p.torch.x, p.torch.y);
        this.angles.push(
          this.label(`M${i + 1} · Hold 1 to rotate`, p.x, p.y + 78),
        );
        this.scene.textures
          .get("pond:flame")
          .setFilter(Phaser.Textures.FilterMode.NEAREST);
        const flame = this.scene.add
          .image(p.torch.x, p.torch.y - 13, "pond:flame", 0)
          .setDepth(5);
        this.flames.push(flame);
        this.objects.push(flame);
        this.label(
          `A${i + 1} ${["→", "↑", "←", "↓"][i]}`,
          p.shot.x,
          p.shot.y + 26,
        );
        this.label(`${i + 1}`, p.torch.x, p.torch.y + 39);
      }
      this.spikes = [0, 1].map(() => this.image("ruins:spike-slider", 0, 0));
      this.label("SIEG · Super Speed (2)\nEast spike entrance", 1440, 760);
      this.label("COCO · Flight (2)\nWater culvert → pond", 1408, 1010);
      this.label("Return · E", 1488, 1120);
      this.label(
        "MIRROR POND\nFour flames raise the sunken sanctuary",
        768,
        1240,
      );
      // Familiar trees frame the exterior, leaving all spell alcoves visible.
      for (const [x, y] of [
        [32, 64],
        [1472, 448],
        [64, 1184],
        [1216, 1184],
        [1440, 128],
      ])
        this.image("ruins:fall-tree", x, y, -20);
    }
    for (const o of this.raised)
      (o as Phaser.GameObjects.Image).setVisible(state.raised);
    this.mirrors.forEach((o, i) => {
      o.setRotation(state.mirrors[i]);
      this.angles[i].setText(
        `M${i + 1} · ${Number((((state.mirrors[i] * 180) / Math.PI) % 360).toFixed(1))}°\nHold 1 to rotate`,
      );
    });
    const durations = this.scene.cache.json.get("pond:flame-meta")
      .durations as number[];
    let phase = (state.clock * 1000) % durations.reduce((a, b) => a + b, 0),
      frame = 0;
    while (frame < durations.length - 1 && phase >= durations[frame])
      phase -= durations[frame++];
    this.flames.forEach((flame, i) =>
      flame.setFrame(frame).setVisible(state.torches[i]),
    );
    pondSpikes(state.clock).forEach((r, i) =>
      this.spikes[i].setPosition(r.x + r.w / 2, r.y + r.h / 2),
    );
    const g = this.gfx;
    g.clear();
    // The thin ward marks Coco's sealed walking route; her culvert passes beneath it.
    g.lineStyle(3, 0x87d3df, 0.65);
    g.strokeRect(pondWater.x, pondWater.y, pondWater.w, pondWater.h);
    for (let i = 0; i < 4; i++) {
      const p = pondStations[i];
      g.lineStyle(1, 0xe3d295, 0.7);
      g.strokeCircle(p.shot.x, p.shot.y, 15);
      if (state.torches[i]) {
        const pulse = 3 * Math.sin(this.scene.time.now / 180 + i);
        g.fillStyle(0xff8c37, 0.35);
        g.fillCircle(p.torch.x, p.torch.y, 26 + pulse);
      }
    }
  }
}
