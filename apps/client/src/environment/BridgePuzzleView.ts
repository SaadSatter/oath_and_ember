import Phaser from "phaser";
import type {
  World,
  SceneId,
} from "../../../../packages/shared/src/gameTypes.js";
import {
  bridgePoints as P,
  bridgeRects,
  bridgeTrap,
  bridgeOpen,
  bridgeMovingTarget,
  bridgeEntryTargetVisible,
  heavyOnPlate,
} from "../../../../packages/shared/src/bridgePuzzle.js";
const textures = [
  "ground",
  "bridge",
  "magic-target",
  "weight",
  "spike-slider",
  "weight-plate",
  "gold-switch",
  "overhead-gate",
  "temple",
];
export function preloadBridgePuzzle(scene: Phaser.Scene) {
  scene.load.image(
    "ruins:fall-tree",
    "/assets/environment/post-town/transition_trail/object-29197f1c-aaf7-47e0-8f88-a786fcd15581.png",
  );
  scene.load.image(
    "ruins:base-tree",
    "/assets/environment/post-town/transition_trail/object-379c80d1-5c82-4ab8-b14d-98c2e88bb8b4.png",
  );
  for (const key of textures)
    scene.load.image(
      `ruins:${key}`,
      `/assets/environment/bridge-ruins/${key}.png`,
    );
}
export class BridgePuzzleView {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private gfx: Phaser.GameObjects.Graphics;
  private traps: Phaser.GameObjects.Image[] = [];
  private bridges: Phaser.GameObjects.Image[] = [];
  private gates: Phaser.GameObjects.Image[] = [];
  private active = false;
  private entryTarget?: Phaser.GameObjects.Image;
  private finalTarget?: Phaser.GameObjects.Image;
  /**
   * Green copies laid over a struck target, letting its rings show through,
   * so it lights up (a multiplied tint would darken the purple instead).
   */
  private entryGlow?: Phaser.GameObjects.Image;
  private finalGlow?: Phaser.GameObjects.Image;
  private rock?: Phaser.GameObjects.Image;
  private plates: Phaser.GameObjects.Image[] = [];
  constructor(private scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(-10);
    for (const key of [...textures, "fall-tree", "base-tree"])
      scene.textures
        .get(`ruins:${key}`)
        .setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  clear() {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
    this.traps = [];
    this.bridges = [];
    this.gates = [];
    this.plates = [];
    this.gfx.clear();
    this.active = false;
  }
  private image(
    key: string,
    x: number,
    y: number,
    w?: number,
    h?: number,
    depth = -5,
  ) {
    const im = this.scene.add.image(x, y, `ruins:${key}`).setDepth(depth);
    if (w && h) im.setDisplaySize(w, h);
    this.objects.push(im);
    return im;
  }
  private glow(target: Phaser.GameObjects.Image) {
    const glow = this.image(
      "magic-target",
      target.x,
      target.y,
      target.displayWidth,
      target.displayHeight,
      3,
    )
      .setTint(0x5ef0a0)
      .setTintMode(Phaser.TintModes.FILL)
      .setVisible(false);
    return glow;
  }
  /**
   * `lead` is how far ahead (seconds) the local player's own shots are drawn,
   * so the moving target is drawn on that same timeline and a fireball meets
   * it where the server does.
   */
  update(w: World, sceneId: SceneId, lead = 0) {
    if (sceneId !== "BRIDGE_RUINS" || !w.bridgePuzzle) {
      if (this.active) this.clear();
      return;
    }
    if (!this.active) {
      this.image("ground", 480, 768, 960, 1536, -100);
      for (let row = 0; row < 11; row++)
        for (const [side, x] of [64, 888].entries())
          this.image(
            (row + side) % 2 ? "fall-tree" : "base-tree",
            x,
            280 + row * 112,
            128,
            128,
            -6,
          ).setOrigin(0.5, 0.87);
      this.image("temple", 480, 72, 176, 136);
      this.plates = [
        this.image("weight-plate", 288, 1264, 80, 80),
        this.image("weight-plate", 288, 736, 104, 80),
      ];
      this.rock = this.image(
        "weight",
        P.boulderStart.x,
        P.boulderStart.y,
        48,
        48,
        2,
      );
      // Targets hover in front of the gate so their full silhouettes stay visible.
      this.entryTarget = this.image("magic-target", 672, 1160, 40, 48, 2);
      this.entryGlow = this.glow(this.entryTarget);
      this.finalTarget = this.image("magic-target", 480, 416, 48, 48, 2);
      this.finalGlow = this.glow(this.finalTarget);
      for (const point of [P.goldSwitch, P.switchWest, P.switchEast])
        this.image("gold-switch", point.x, point.y, 48, 48);
      for (const r of bridgeRects)
        this.bridges.push(this.image("bridge", 480, r.y + 32, 224, 64, -20));
      for (let i = 0; i < 3; i++) {
        const t = bridgeTrap(0, i);
        this.traps.push(this.image("spike-slider", t.x, t.y, 128, 56, 0));
      }
      for (const [x, y] of [
        [672, 1128],
        [288, 1096],
        [288, 296],
        [672, 296],
      ])
        this.gates.push(this.image("overhead-gate", x, y, 192, 32, 1));
      this.active = true;
    }
    const s = w.bridgePuzzle;
    this.rock?.setPosition(s.boulder.x, s.boulder.y);
    // The server's target, drawn on the shooter's timeline.
    const target = bridgeMovingTarget(s.trapClock + lead);
    const targetVisible = bridgeEntryTargetVisible(s);
    const pulse = 0.6 + 0.15 * Math.sin(this.scene.time.now / 180);
    this.entryTarget?.setVisible(targetVisible).setPosition(target.x, target.y);
    this.entryGlow
      ?.setVisible(targetVisible && s.targetHit)
      .setPosition(target.x, target.y)
      .setAlpha(pulse);
    this.finalGlow?.setVisible(s.finalTargetHit).setAlpha(pulse);
    this.plates.forEach((im, i) =>
      im.setTint(heavyOnPlate(s, i === 0 ? "A" : "B") ? 0x80e9b0 : 0xffd36c),
    );
    const open = [
      s.firstGateOpen,
      s.goldSwitchOpen,
      s.finalTargetHit,
      s.finalTargetHit,
    ];
    this.gates.forEach((g, i) =>
      g.setAlpha(open[i] ? 0.12 : 1).setTint(open[i] ? 0x80e9b0 : 0xffffff),
    );
    this.bridges.forEach((im, i) =>
      im
        .setAlpha(bridgeOpen(s, w, i) ? 1 : 0.15)
        .setTint(bridgeOpen(s, w, i) ? 0xffffff : 0xee5962),
    );
    this.traps.forEach((im, i) => {
      const t = bridgeTrap(s.trapClock, i);
      im.setPosition(t.x, t.y)
        .setVisible(s.goldSwitchOpen)
        .setTint(w.slowTime ? 0x9abaff : 0xffffff);
    });
    const g = this.gfx;
    g.clear();
    for (let y = 330; y < 1320; y += 96)
      for (const x of [156, 804]) {
        g.fillStyle(0x536357);
        g.fillRect(x - 20, y - 24, 40, 48);
        g.lineStyle(2, 0x8e9b81, 0.8);
        g.strokeRect(x - 20, y - 24, 40, 48);
      }
    if (!s.complete) {
      g.fillStyle(0x42514d, 0.95);
      g.fillRect(448, 96, 64, 192);
      g.lineStyle(3, 0xe6b45b, 0.6);
      g.strokeRect(448, 96, 64, 192);
    } else {
      g.fillStyle(0x70f5a7, 0.4);
      g.fillCircle(480, 144, 30);
    }
  }
}
