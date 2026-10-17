import Phaser from "phaser";
import type {
  SceneId,
  World,
} from "../../../../packages/shared/src/gameTypes.js";
import {
  griffinAirborne,
  griffinWakeDuration,
  griffinGroomDurations,
  griffinBeamEnd,
  griffinMouth,
  griffinMouthDirections,
  griffinMouthDirection,
  griffinBounds,
  griffinWalls,
  griffinNest,
  griffinPillars,
  griffinState,
  griffinWater,
  griffinTrees,
} from "../../../../packages/shared/src/griffin.js";
import { griffinProps } from "../animation/griffinProps.js";
import { enemyDirection } from "../animation/EnemyPresentation.js";
const dirs = ["south", "east", "north", "west"];
export function preloadGriffin(s: Phaser.Scene) {
  for (const item of ["vanity-mirror", "enchanted-shears", "griffin-wig"])
    s.load.image(`griffin:${item}`, `/assets/ui/inventory/items/${item}.png`);
  s.load.spritesheet(
    "griffin:pillar",
    "/assets/environment/griffin/pillar.png",
    { frameWidth: 160, frameHeight: 160 },
  );
  s.load.image("griffin:wall", "/assets/environment/bridge-ruins/wall.png");
  for (const [name, width, height] of [
    ["grooming", 176, 176],
    ["sleep", 176, 176],
    ["mouth", 164, 164],
    ["charge", 128, 128],
    ["beam", 128, 128],
    ["beam-middle", 64, 128],
    ["explosion", 128, 128],
  ] as const)
    s.load.spritesheet(
      `griffin:${name}`,
      `/assets/enemies/griffin/${name}.png`,
      { frameWidth: width, frameHeight: height },
    );
  for (const kind of ["flight", "takeoff", "run"])
    s.load.spritesheet(
      `griffin:${kind}`,
      `/assets/enemies/griffin/${kind}.png`,
      { frameWidth: 164, frameHeight: 164 },
    );
}
export class GriffinView {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private active = false;
  private sprite?: Phaser.GameObjects.Sprite;
  private effects: Phaser.GameObjects.Graphics;
  private pillars: Phaser.GameObjects.Sprite[] = [];
  private fallenPillars: boolean[] = [];
  private status?: Phaser.GameObjects.Text;
  private shadow?: Phaser.GameObjects.Ellipse;
  private mirror?: Phaser.GameObjects.Image;
  private shears?: Phaser.GameObjects.Image;
  private wig?: Phaser.GameObjects.Image;
  private propClock = -1;
  private propClockReceivedAt = 0;
  private charge?: Phaser.GameObjects.Image;
  private beamBody?: Phaser.GameObjects.TileSprite;
  private beamStart?: Phaser.GameObjects.Image;
  private beamTip?: Phaser.GameObjects.Image;
  private explosion?: Phaser.GameObjects.Image;
  constructor(private scene: Phaser.Scene) {
    this.effects = scene.add.graphics().setDepth(1800);
    scene.textures
      .get("griffin:pillar")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    scene.anims.create({
      key: "griffin:pillar-collapse",
      frames: scene.anims.generateFrameNumbers("griffin:pillar", {
        start: 1,
        end: 10,
      }),
      frameRate: 10,
      repeat: 0,
    });
    scene.textures
      .get("griffin:grooming")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    scene.textures
      .get("griffin:sleep")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const kind of ["flight", "takeoff", "run"]) {
      const key = `griffin:${kind}`,
        columns = kind === "run" ? 9 : 10;
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      dirs.forEach((dir, row) =>
        scene.anims.create({
          key: `${key}:${dir}`,
          frames: scene.anims.generateFrameNumbers(key, {
            start: row * columns + 1,
            end: row * columns + columns - 1,
          }),
          frameRate: kind === "run" ? 12 : 10,
          repeat: kind === "takeoff" ? 0 : -1,
        }),
      );
    }
  }
  clear() {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
    this.pillars = [];
    this.fallenPillars = [];
    this.effects.clear();
    this.active = false;
    this.propClock = -1;
  }
  private image(key: string, x: number, y: number, depth: number) {
    this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const o = this.scene.add.image(x, y, key).setDepth(depth);
    this.objects.push(o);
    return o;
  }
  private label(text: string, x: number, y: number) {
    const o = this.scene.add
      .text(x, y, text, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f0dfaf",
        backgroundColor: "#172b25e8",
        align: "center",
        padding: { x: 5, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(1900);
    this.objects.push(o);
    return o;
  }
  update(w: World, id: SceneId) {
    if (id !== "GRIFFIN_ENCLOSURE") {
      if (this.active) this.clear();
      return;
    }
    const g = griffinState(w.puzzles);
    if (!g) return;
    if (!this.active) {
      this.active = true;
      const grass = this.scene.add
        .tileSprite(0, 0, 1280, 1152, "TRANSITION_TRAIL:terrain:1")
        .setOrigin(0)
        .setDepth(-110);
      this.objects.push(grass);
      for (const r of [
        { x: 24, y: 384, w: 1232, h: 96 },
        { x: 544, y: 480, w: 192, h: 648 },
      ]) {
        const path = this.scene.add
          .tileSprite(r.x, r.y, r.w, r.h, "pond:stone", 12)
          .setOrigin(0)
          .setDepth(-105);
        this.objects.push(path);
      }
      for (const r of griffinWater) {
        const o = this.scene.add
          .tileSprite(r.x, r.y, r.w, r.h, "pond:water", 6)
          .setOrigin(0)
          .setDepth(-100);
        this.objects.push(o);
      }
      const stone = this.scene.add
        .tileSprite(560, 24, 160, 168, "pond:stone", 12)
        .setOrigin(0)
        .setDepth(-95);
      this.objects.push(stone);
      const rim = this.scene.add.graphics().setDepth(-90);
      this.objects.push(rim);
      // Flat overhead nest: interwoven straw rings on the northern stone island.
      for (let i = 0; i < 9; i++)
        rim
          .lineStyle(3, i % 2 ? 0x80603c : 0xc5a76a)
          .strokeEllipse(640, 112, 112 - i * 6, 78 - i * 4);
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12;
        rim
          .lineStyle(2, 0xd0b47b)
          .lineBetween(
            640 + Math.cos(a) * 42,
            112 + Math.sin(a) * 26,
            640 + Math.cos(a + 0.2) * 59,
            112 + Math.sin(a + 0.2) * 42,
          );
      }
      for (let x = 80; x < 1250; x += 112) {
        this.image("griffin:wall", x, 18, 20);
      }
      for (const [i, r] of griffinPillars.entries()) {
        const pillar = this.scene.add
          .sprite(r.x + 32, r.y + 32, "griffin:pillar", 0)
          .setOrigin(0.5, 0.8)
          .setDepth(r.y + 64);
        this.objects.push(pillar);
        this.pillars.push(pillar);
        this.label(`P${i + 1}`, r.x + 32, r.y + 80);
      }
      for (const p of griffinTrees)
        this.image("ruins:fall-tree", p.x, p.y, p.y);
      this.label("GRIFFIN ENCLOSURE", 640, 1000);
      this.label("SOUTH · GODDESS SHRINE\nE · Return", 640, 1100);
      this.label("NEST · Drop mirror + shears", 640, 230);
      this.mirror = this.image(
        "griffin:vanity-mirror",
        griffinNest.x - 24,
        griffinNest.y,
        200,
      )
        .setDisplaySize(42, 42)
        .setVisible(false);
      this.shears = this.image(
        "griffin:enchanted-shears",
        griffinNest.x + 24,
        griffinNest.y,
        200,
      )
        .setDisplaySize(42, 42)
        .setVisible(false);
      this.wig = this.image(
        "griffin:griffin-wig",
        griffinNest.x,
        griffinNest.y,
        201,
      )
        .setDisplaySize(42, 42)
        .setVisible(false);
      this.shadow = this.scene.add
        .ellipse(g.x, g.y, 76, 32, 0x0c1d23, 0.45)
        .setDepth(g.y - 1);
      this.objects.push(this.shadow);
      this.sprite = this.scene.add
        .sprite(g.x, g.y, "griffin:flight")
        .setOrigin(0.5, 106 / 164);
      this.objects.push(this.sprite);
      this.status = this.label("", g.x, g.y - 108);
      for (const key of ["mouth", "charge", "beam", "beam-middle", "explosion"])
        this.scene.textures
          .get(`griffin:${key}`)
          .setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.charge = this.image("griffin:charge", 0, 0, 1801).setVisible(false);
      this.beamStart = this.image("griffin:beam", 0, 0, 1800)
        .setOrigin(0.08, 0.5)
        .setScale(0.55)
        .setVisible(false);
      this.beamBody = this.scene.add
        .tileSprite(0, 0, 1, 128, "griffin:beam-middle")
        .setOrigin(0, 0.5)
        .setScale(1, 0.55)
        .setDepth(1800)
        .setVisible(false);
      this.objects.push(this.beamBody);
      this.beamTip = this.image("griffin:beam", 0, 0, 1801)
        .setOrigin(0.88, 0.5)
        .setScale(0.55)
        .setVisible(false);
      this.explosion = this.image("griffin:explosion", 0, 0, 1802)
        .setOrigin(0.5, 1)
        .setScale(0.7)
        .setVisible(false);
    }
    const air = griffinAirborne(g),
      dir = enemyDirection(g.facing),
      row = dirs.indexOf(dir);
    const kind = g.phase === "TAKEOFF" ? "takeoff" : air ? "flight" : "run";
    this.sprite!.setOrigin(0.5, 106 / 164);
    this.sprite!.setPosition(g.x, g.y - (air ? 22 : 0))
      .setDepth(g.y)
      .setAlpha(g.hp <= 0 ? 0.55 : 1);
    this.sprite!.anims.timeScale = w.slowTime ? 0.2 : 1;
    if (
      [
        "NEST",
        "STUNNED",
        "DISTRACTED",
        "DEFEATED",
        "HEADBUTT_CHARGE",
        "BEAM_CHARGE",
        "BEAM",
      ].includes(g.phase)
    ) {
      this.sprite!.anims.stop();
      this.sprite!.setTexture(
        `griffin:${kind}`,
        row * (kind === "run" ? 9 : 10),
      );
    } else this.sprite!.play(`griffin:${kind}:${dir}`, true);
    if (g.phase === "BEAM_CHARGE" || g.phase === "BEAM") {
      this.sprite!.anims.stop();
      this.sprite!.setTexture(
        "griffin:mouth",
        griffinMouthDirections.indexOf(griffinMouthDirection(g.facing)),
      );
    }
    if (g.phase === "NEST" || g.phase === "WAKING" || g.phase === "DEFEATED") {
      this.sprite!.anims.stop();
      const frame =
        g.phase === "NEST"
          ? 0
          : g.phase === "DEFEATED"
            ? griffinMouthDirections.indexOf(griffinMouthDirection(g.facing))
            : 8 +
              Math.min(
                9,
                Math.floor(Math.max(0, griffinWakeDuration - g.timer) * 10),
              );
      this.sprite!.setTexture("griffin:sleep", frame)
        .setOrigin(0.5, 130 / 176)
        .setPosition(g.x, g.y)
        .setAlpha(1);
    }
    if (
      g.phase === "GROOMING" &&
      !["RETURN", "DEPART", "DONE"].includes(g.groomingStage ?? "")
    ) {
      this.sprite!.anims.stop();
      if (g.groomingStage === "STAND") {
        this.sprite!.setTexture(
          "griffin:sleep",
          8 + Math.min(9, Math.floor(Math.max(0, 1 - g.timer) * 10)),
        ).setOrigin(0.5, 130 / 176);
      } else {
        const stage = g.groomingStage;
        const elapsed =
          stage === "DONE"
            ? 0.9
            : Math.max(
                0,
                griffinGroomDurations[stage as "SOUTH" | "NORTH" | "CUT"] -
                  g.timer,
              );
        const offset = stage === "SOUTH" ? 0 : stage === "NORTH" ? 9 : 18;
        const frame =
          offset +
          (stage === "CUT" || stage === "DONE"
            ? Math.min(8, Math.floor(elapsed * 10))
            : Math.floor(elapsed * 10) % 9);
        this.sprite!.setTexture("griffin:grooming", frame).setOrigin(
          0.5,
          132 / 176,
        );
      }
      this.sprite!.setPosition(g.x, g.y).setAlpha(1);
    }
    this.shadow!.setPosition(g.x, g.y)
      .setDepth(g.y - 1)
      .setScale(air ? 1 : 0.7);
    this.pillars.forEach((p, i) => {
      const fallen = g.pillars[i];
      if (this.fallenPillars[i] === undefined) {
        p.setFrame(fallen ? 10 : 0);
      } else if (fallen && !this.fallenPillars[i]) {
        p.play("griffin:pillar-collapse");
      } else if (!fallen && this.fallenPillars[i]) {
        p.anims.stop();
        p.setFrame(0);
      }
      this.fallenPillars[i] = fallen;
    });
    // Extrapolate only presentation between snapshots; the server owns stages,
    // tool consumption and whether the dropped wig can be collected.
    if (this.propClock !== g.clock) {
      this.propClock = g.clock;
      this.propClockReceivedAt = this.scene.time.now;
    }
    const ahead =
      Math.min(
        0.1,
        Math.max(0, (this.scene.time.now - this.propClockReceivedAt) / 1000),
      ) * (w.slowTime ? 0.2 : 1);
    const props = griffinProps(g, ahead);
    for (const key of ["mirror", "shears", "wig"] as const) {
      const prop = props[key];
      this[key]
        ?.setVisible(prop.visible)
        .setPosition(prop.x, prop.y)
        .setRotation(prop.rotation);
    }
    const departed = g.groomingStage === "DONE";
    this.sprite?.setVisible(!departed);
    this.shadow?.setVisible(!departed);
    this.status?.setVisible(!departed);
    if (g.wigDropped && !g.wigClaimed)
      this.status
        ?.setVisible(true)
        .setPosition(griffinNest.x, griffinNest.y + 52);
    this.status!.setPosition(
      g.wigDropped ? griffinNest.x : g.x,
      g.wigDropped
        ? griffinNest.y + 52
        : g.phase === "GROOMING"
          ? g.y + 64
          : g.y - 112,
    ).setText(
      g.wigClaimed
        ? "WIG ACQUIRED · Return to shrine"
        : g.wigDropped
          ? "WIG DROPPED · E at nest to collect"
          : g.groomingStage === "DEPART"
            ? "FLYING AWAY"
            : g.phase === "GROOMING"
              ? g.groomingStage === "RETURN"
                ? "RETURNING TO THE NEST"
                : g.groomingStage === "STAND"
                  ? "PICKING UP THE MIRROR"
                  : g.groomingStage === "CUT"
                    ? "A LITTLE TRIM…"
                    : "CHECKING THAT MAGNIFICENT HAIR"
              : g.hp <= 0
                ? "DEFEATED · E at nest for wig"
                : `GRIFFIN ${g.hp}/320 · ${g.phase.replaceAll("_", " ")}`,
    );
    const fx = this.effects;
    fx.clear();
    const mouth = griffinMouth(g),
      charging = g.phase === "BEAM_CHARGE",
      firing = g.phase === "BEAM";
    this.charge!.setVisible(charging);
    this.beamStart!.setVisible(firing);
    this.beamBody!.setVisible(firing);
    this.beamTip!.setVisible(firing);
    this.explosion!.setVisible(false);
    if (charging) {
      const elapsed = Math.max(0, 1.2 - g.timer);
      this.charge!.setPosition(mouth.x, mouth.y)
        .setFrame(Math.min(8, Math.floor(elapsed / 0.13)))
        .setScale(0.2 + Math.min(1, elapsed / 1.2) * 0.35);
      const end = griffinBeamEnd(
        g,
        [...griffinBounds, ...griffinWalls(w.puzzles)],
        Object.values(w.players),
      );
      fx.lineStyle(1, 0xff6060, 0.4).lineBetween(
        mouth.x,
        mouth.y,
        end.x,
        end.y,
      );
    }
    if (firing) {
      const end =
        g.beam ??
        griffinBeamEnd(
          g,
          [...griffinBounds, ...griffinWalls(w.puzzles)],
          Object.values(w.players),
        );
      const length = Math.hypot(end.x - mouth.x, end.y - mouth.y),
        elapsed = g.clock - (g.beamStarted ?? g.clock),
        angle = g.facing;
      this.beamStart!.setPosition(mouth.x, mouth.y)
        .setFrame(Math.floor(elapsed / 0.08) % 3)
        .setRotation(angle)
        .setVisible(length > 20);
      this.beamBody!.setPosition(
        mouth.x + Math.cos(angle) * 32,
        mouth.y + Math.sin(angle) * 32,
      )
        .setSize(Math.max(1, length - 60), 128)
        .setFrame(Math.floor(elapsed / 0.08) % 10)
        .setRotation(angle)
        .setVisible(length > 60);
      this.beamTip!.setPosition(end.x, end.y)
        .setFrame(14 + (Math.floor(elapsed / 0.08) % 3))
        .setRotation(angle)
        .setVisible(length > 35);
    }
    if (new URLSearchParams(location.search).has("griffinQA"))
      document.querySelector<HTMLElement>("#game")!.dataset.griffinVisual =
        JSON.stringify({
          pose: this.sprite!.texture.key,
          frame: this.sprite!.frame.name,
          charge: this.charge!.visible,
          beam: this.beamBody!.visible,
          impact: this.explosion!.visible,
          beamFrame: this.beamBody!.frame.name,
          tipFrame: this.beamTip!.frame.name,
          startFrame: this.beamStart!.frame.name,
          impactFrame: this.explosion!.frame.name,
          phase: g.phase,
          mouth,
          endpoint: g.beam,
        });
    if (g.phase === "HEADBUTT_CHARGE")
      fx.lineStyle(3, 0xff6e49, 0.8)
        .lineBetween(g.x, g.y, g.aimX, g.aimY)
        .strokeCircle(g.aimX, g.aimY, 26);
    if (g.phase === "STUNNED")
      for (let i = 0; i < 4; i++) {
        const a = g.clock * 2 + (i * Math.PI) / 2;
        fx.fillStyle(0xffdf76).fillCircle(
          g.x + Math.cos(a) * 38,
          g.y - 58 + Math.sin(a) * 12,
          4,
        );
      }
  }
}
