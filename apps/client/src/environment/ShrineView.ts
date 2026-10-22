import Phaser from "phaser";
import type {
  World,
  SceneId,
} from "../../../../packages/shared/src/gameTypes.js";
import {
  shrinePaths,
  shrineTrees,
  shrineShrubs,
  shrinePoints,
  shrineComplete,
} from "../../../../packages/shared/src/shrine.js";
export function preloadShrine(s: Phaser.Scene) {
  for (const mood of ["crying", "happy"])
    s.load.image(
      `shrine:${mood}`,
      `/assets/environment/goddess-shrine/${mood}.png`,
    );
  s.load.image("shrine:wig", "/assets/ui/inventory/items/griffin-wig.png");
}
/** The statue art (168 px) is drawn centred at (640, 336). */
const STATUE_LEFT = 640 - 84,
  STATUE_TOP = 336 - 84;
/** The goddess's head within the happy statue art. */
const FACE = { x: 74, y: 55, w: 22, h: 16 };
/** The wig as drawn on her head: shrunk smoothly once, not per frame. */
const WIG_SIZE = 44;
function goddessWig(scene: Phaser.Scene) {
  const key = "shrine:wig-worn";
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get("shrine:wig").getSourceImage() as HTMLImageElement;
  const texture = scene.textures.createCanvas(key, WIG_SIZE, WIG_SIZE)!;
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, WIG_SIZE, WIG_SIZE);
  texture.refresh();
  return key;
}
/**
 * Her face, cut from the happy statue: only the stone of her head and its
 * outline, so the hair around it is not covered by the shrine's background.
 */
function goddessFace(scene: Phaser.Scene) {
  const key = "shrine:goddess-face";
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get("shrine:happy").getSourceImage() as HTMLImageElement;
  const texture = scene.textures.createCanvas(key, FACE.w, FACE.h)!;
  const ctx = texture.getContext();
  ctx.drawImage(source, FACE.x, FACE.y, FACE.w, FACE.h, 0, 0, FACE.w, FACE.h);
  const image = ctx.getImageData(0, 0, FACE.w, FACE.h),
    d = image.data;
  const stone = (i: number) => {
    const r = d[i] / 255,
      g = d[i + 1] / 255,
      b = d[i + 2] / 255,
      max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      light = (max + min) / 2,
      sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
    return d[i + 3] > 0 && light > 0.38 && sat < 0.3;
  };
  const keep = new Uint8Array(FACE.w * FACE.h);
  for (let p = 0; p < keep.length; p++) if (stone(p * 4)) keep[p] = 1;
  // ...plus the dark outline around it.
  const outline = new Uint8Array(keep.length);
  for (let y = 0; y < FACE.h; y++)
    for (let x = 0; x < FACE.w; x++) {
      if (keep[y * FACE.w + x]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx,
          ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < FACE.w && ny < FACE.h && keep[ny * FACE.w + nx])
          outline[y * FACE.w + x] = 1;
      }
    }
  for (let p = 0; p < keep.length; p++)
    if (!keep[p] && !outline[p]) d[p * 4 + 3] = 0;
  ctx.putImageData(image, 0, 0);
  texture.refresh();
  return key;
}

export class ShrineView {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private active = false;
  private statue?: Phaser.GameObjects.Image;
  private wig?: Phaser.GameObjects.Image;
  private face?: Phaser.GameObjects.Image;
  private title?: Phaser.GameObjects.Text;
  /** Signs for play; hidden while a story scene is on screen. */
  private labels: Phaser.GameObjects.Text[] = [];
  constructor(private scene: Phaser.Scene) {}
  clear() {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
    this.labels = [];
    this.active = false;
  }
  private image(key: string, x: number, y: number, depth = -10) {
    this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const o = this.scene.add.image(x, y, key).setDepth(depth);
    this.objects.push(o);
    return o;
  }
  private label(t: string, x: number, y: number, color = "#e9dfb8") {
    const o = this.scene.add
      .text(x, y, t, {
        fontFamily: "monospace",
        fontSize: "12px",
        color,
        backgroundColor: "#13291fe6",
        align: "center",
        padding: { x: 5, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(2000);
    this.objects.push(o);
    this.labels.push(o);
    return o;
  }
  update(w: World, id: SceneId) {
    if (id !== "GODDESS_SHRINE") {
      if (this.active) this.clear();
      return;
    }
    if (!this.active) {
      this.active = true;
      const ground = this.scene.add
        .tileSprite(0, 0, 1280, 1024, "TRANSITION_TRAIL:terrain:1")
        .setOrigin(0)
        .setDepth(-110);
      this.objects.push(ground);
      for (const r of shrinePaths) {
        const o = this.scene.add
          .tileSprite(r.x, r.y, r.w, r.h, "pond:stone", 12)
          .setOrigin(0)
          .setDepth(-100);
        this.objects.push(o);
      }
      for (const [i, p] of shrineTrees.entries())
        this.image(
          i % 2 ? "ruins:base-tree" : "ruins:fall-tree",
          p.x,
          p.y - 55,
          p.y,
        );
      // Decorative shrubs frame the plaza; all entrance lanes remain six tiles wide.
      for (const p of shrineShrubs)
        this.image("maze:hedge:south", p.x, p.y, p.y);
      this.statue = this.image("shrine:crying", 640, 336, 437);
      // The wig sits on her head and falls behind it; her face is laid back
      // over it so it shows through, framed by the hair.
      this.wig = this.image(goddessWig(this.scene), 643, 311, 438).setVisible(
        false,
      );
      this.face = this.image(goddessFace(this.scene), 0, 0, 439)
        .setOrigin(0, 0)
        .setPosition(STATUE_LEFT + FACE.x, STATUE_TOP + FACE.y)
        .setVisible(false);
      this.image(
        "ruins:weight-plate",
        shrinePoints.offering.x,
        shrinePoints.offering.y,
        -20,
      );
      this.title = this.label("THE BALD GODDESS", 640, 454);
      this.label(
        "E · Speak / offer a gift\nI · Shared inventory",
        640,
        593,
        "#dbbdf5",
      );
      this.label("WEST · MIRROR POND\nE · Travel", 168, 558, "#9ee3e9");
      this.label("EAST · HEDGE MAZE\nE · Travel", 1112, 558, "#9ee3e9");
      this.label("NORTH · GRIFFIN TRAIL", 640, 102, "#dac7a6");
      this.label("START / RETURN\nE · Puzzle Map 2", 640, 933);
    }
    const complete = shrineComplete(w);
    this.statue?.setTexture(complete ? "shrine:happy" : "shrine:crying");
    this.wig?.setVisible(complete);
    this.face?.setVisible(complete);
    // Signs would sit over the goddess's scenes (and the woman before her).
    for (const label of this.labels) label.setVisible(!w.story?.cutscene);
    this.title?.setText(
      complete ? "THE GODDESS OF DIVINE VOLUME" : "THE BALD GODDESS",
    );
  }
}
