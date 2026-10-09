// Loaded only by the separate Vite development HTML entry. The production build
// has a single main entry and includes neither this page nor this fixture.
import Phaser from "phaser";
import { siegPalettes } from "../../../../packages/shared/src/appearance.js";
import { preloadHeroes, registerHeroes } from "../assets/heroLoader.js";
import { PlayerView } from "../entities/PlayerView.js";
import { siegBasicClip } from "../animation/siegAttack.js";
import type { CombatDirection } from "../animation/combat.js";
import type { Player } from "../../../../packages/shared/src/gameTypes.js";
const facing = { right: 0, left: Math.PI, up: -Math.PI / 2, down: Math.PI / 2 };
class Preview extends Phaser.Scene {
  view!: PlayerView;
  direction: CombatDirection = "right";
  repeatAt = Infinity;
  hero: Player = {
    id: "preview",
    role: "OATH",
    ready: true,
    connected: true,
    x: 400,
    y: 300,
    vx: 0,
    vy: 0,
    grounded: true,
    hp: 100,
    maxHp: 100,
    facing: 0,
    actionState: "idle",
    cooldowns: {},
    skillPoints: 0,
    unlockedSkills: [],
    lastProcessedInputSeq: 0,
  };
  preload() {
    preloadHeroes(this);
  }
  create() {
    registerHeroes(this);
    this.cameras.main.setZoom(3).centerOn(400, 300);
    const g = this.add.graphics();
    g.lineStyle(1, 0x638579, 0.4);
    for (let x = 0; x < 800; x += 20) g.lineBetween(x, 0, x, 450);
    for (let y = 0; y < 450; y += 20) g.lineBetween(0, y, 800, y);
    g.lineStyle(1, 0xffff00);
    g.lineBetween(390, 313, 410, 313);
    g.lineBetween(400, 303, 400, 323);
    this.view = new PlayerView(this);
    document.querySelector<HTMLSelectElement>("#palette")!.onchange = (
      event,
    ) => {
      this.hero.appearance = {
        primaryPalette: (event.target as HTMLSelectElement)
          .value as (typeof siegPalettes)[number],
      };
    };
    document
      .querySelectorAll<HTMLButtonElement>("[data-direction]")
      .forEach(
        (button) =>
          (button.onclick = () =>
            this.trigger(button.dataset.direction as CombatDirection)),
      );
    document.querySelector<HTMLButtonElement>("#turn")!.onclick = () => {
      this.hero.facing += Math.PI;
    };
  }
  trigger(direction: CombatDirection) {
    this.direction = direction;
    this.hero.facing = facing[direction];
    this.hero.combat = {
      seq: (this.hero.combat?.seq ?? 0) + 1,
      startedTick: Math.floor((this.time.now * 30) / 1000),
      facing: this.hero.facing,
      kind: "sword",
    };
    this.repeatAt = this.time.now + siegBasicClip(direction).durationMs + 500;
  }
  update() {
    if (!this.view) return;
    if (
      document.querySelector<HTMLInputElement>("#repeat")!.checked &&
      this.time.now >= this.repeatAt
    )
      this.trigger(this.direction);
    const walk = document.querySelector<HTMLInputElement>("#walk")!.checked;
    this.hero.vx = walk ? Math.cos(this.hero.facing) * 190 : 0;
    this.hero.vy = walk ? Math.sin(this.hero.facing) * 190 : 0;
    this.view.update(this.hero, this.hero, this.hero, "TOP_DOWN", "sprite", {
      serverTick: Math.floor((this.time.now * 30) / 1000),
    });
    const observation = this.view.inspectCombat();
    document.querySelector<HTMLElement>("#readout")!.textContent =
      JSON.stringify(observation, null, 2);
    document.querySelector<HTMLElement>("#game")!.dataset.preview =
      JSON.stringify(observation);
  }
}
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 800,
  height: 450,
  backgroundColor: "#243b35",
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scene: [Preview],
});
