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
  private label(text: string, x: number, y: number, color = "#e9dfb8") {
    const t = this.scene.add
      .text(x, y, text, {
        fontSize: "11px",
        fontFamily: "monospace",
        color,
        backgroundColor: "#17262ae8",
        align: "center",
        padding: { x: 4, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.objects.push(t);
  }
  update(w: World, sceneId: SceneId) {
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
      this.label("CASTLE EXIT", 480, 16);
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
      this.entryTarget = this.image("magic-target", 672, 1160, 40, 48);
      this.image("magic-target", 480, 416, 48, 48);
      for (const point of [P.goldSwitch, P.switchWest, P.switchEast])
        this.image("gold-switch", point.x, point.y, 48, 48);
      this.label("A · WEIGHT SOCKET", 288, 1210);
      this.label("B · BOULDER ONLY", 288, 676);
      this.label("COCO · FRONT SHOT ↑", 672, 1252, "#d7b8ff");
      this.label("GATE · TARGET + ROCK ON A", 672, 1108);
      this.label("GOLD SWITCH · HOLD E", 672, 1048);
      this.label("PUSH SAME BOULDER\n1 + movement", 288, 1370);
      this.label("SPIKE TRIAL START", 288, 1172);
      this.label(
        "FRONT WEAK POINT ↓\nTHIRD BRIDGE REMOVED",
        480,
        364,
        "#d7b8ff",
      );
      this.label(
        "FIRING PAD · SHOOT NORTH ↑",
        480,
        P.firePad.y + 44,
        "#d7b8ff",
      );
      this.label("FINAL SWITCH", 288, 248);
      this.label("FINAL SWITCH", 672, 248);
      this.label("WEST · SIEG ONLY", 288, 1418);
      this.label("EAST · COCO ONLY", 672, 1418, "#d7b8ff");
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
    const target = bridgeMovingTarget(s.trapClock);
    const targetVisible = bridgeEntryTargetVisible(s);
    this.entryTarget
      ?.setVisible(targetVisible)
      .setPosition(target.x, target.y)
      .setTint(s.targetHit ? 0x80e9b0 : 0xffffff);
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
    if (!s.firstGateOpen) {
      g.lineStyle(4, 0xe6b45b, 0.8);
      g.lineBetween(192, 1240, 384, 1240);
    }
    const wire = (points: number[][], color: number) => {
      g.lineStyle(6, color, 0.18);
      g.beginPath();
      g.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach((p) => g.lineTo(p[0], p[1]));
      g.strokePath();
      g.lineStyle(2, color, 0.9);
      g.beginPath();
      g.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach((p) => g.lineTo(p[0], p[1]));
      g.strokePath();
    };
    wire(
      [
        [288, 1264],
        [352, 1264],
        [608, 1264],
        [608, 1128],
        [672, 1128],
      ],
      s.firstGateOpen ? 0x80e9b0 : 0xe6b45b,
    );
    if (targetVisible)
      wire(
        [
          [target.x, target.y],
          [744, 1160],
          [744, 1128],
          [672, 1128],
        ],
        s.targetHit ? 0x80e9b0 : 0xb887f5,
      );
    wire(
      [
        [672, 1088],
        [608, 1088],
        [352, 1088],
        [288, 1096],
      ],
      s.goldSwitchOpen ? 0x80e9b0 : 0xe6b45b,
    );
    wire(
      [
        [288, 736],
        [352, 736],
        [352, P.firePad.y],
        [480, P.firePad.y],
      ],
      heavyOnPlate(s, "B") || s.finalTargetHit ? 0x80e9b0 : 0xe6b45b,
    );
    wire(
      [
        [480, 416],
        [480, 320],
        [288, 320],
        [288, 296],
      ],
      s.finalTargetHit ? 0x80e9b0 : 0xb887f5,
    );
    wire(
      [
        [480, 320],
        [672, 320],
        [672, 296],
      ],
      s.finalTargetHit ? 0x80e9b0 : 0xb887f5,
    );
    wire(
      [
        [288, 208],
        [288, 160],
        [672, 160],
        [672, 208],
      ],
      s.complete ? 0x80e9b0 : 0xe6b45b,
    );
    for (const y of [1040, 960, 880]) {
      g.lineStyle(2, 0xe8928e, 0.6);
      g.lineBetween(256, y, 480, y);
    }
    g.lineStyle(3, 0xb887f5, 0.75);
    g.lineBetween(576, 288, 576, bridgeRects[1].y);
    g.lineBetween(448, bridgeRects[1].y, 448, bridgeRects[1].y + 64);
    g.lineBetween(576, bridgeRects[1].y + 64, 576, 1344);
    g.lineBetween(576, 1344, 768, 1344);
    g.lineStyle(3, 0xe6b45b, 0.75);
    g.lineBetween(192, 1344, 384, 1344);
    g.lineStyle(3, 0x91dfed, 0.9);
    g.strokeRect(P.firePad.x - 20, P.firePad.y - 20, 40, 40);
    g.fillStyle(0xffefab);
    if (targetVisible) g.fillCircle(target.x, target.y + 20, 6);
    g.fillCircle(480, 436, 7);
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
