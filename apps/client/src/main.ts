import { GriffinView, preloadGriffin } from "./environment/GriffinView.js";
import { griffinState } from "../../../packages/shared/src/griffin.js";
import { ShrineView, preloadShrine } from "./environment/ShrineView.js";
import { shrineComplete } from "../../../packages/shared/src/shrine.js";
import {
  MirrorPondView,
  preloadMirrorPond,
} from "./environment/MirrorPondView.js";
import {
  mirrorPondState,
  pondStations,
} from "../../../packages/shared/src/mirrorPond.js";
import {
  HedgeMazeView,
  preloadHedgeMaze,
} from "./environment/HedgeMazeView.js";
import { hedgeMazeState } from "../../../packages/shared/src/hedgeMaze.js";
import { InventoryPanel } from "./ui/inventory.js";
import {
  bridgePoints,
  bridgeRects,
} from "../../../packages/shared/src/bridgePuzzle.js";
import {
  BridgePuzzleView,
  preloadBridgePuzzle,
} from "./environment/BridgePuzzleView.js";
import { SLOW_TIME_SCALE } from "../../../packages/shared/src/constants.js";
import { TemporalView, preloadTemporal } from "./entities/TemporalView.js";
import {
  constrainMotion,
  flightWalls,
} from "../../../packages/shared/src/movement.js";
import {
  EnvironmentView,
  preloadEnvironment,
} from "./environment/EnvironmentView.js";
import {
  EnemyView,
  preloadEnemies,
  registerEnemies,
} from "./entities/EnemyView.js";
import { renderAppearanceLobby } from "./ui/appearanceLobby.js";
import { preloadMagic, warmMagicTextures } from "./assets/magicTextures.js";
import { ProjectileView } from "./entities/ProjectileView.js";
import Phaser from "phaser";
import { attachResponsiveRenderer } from "./rendering/ResponsiveRenderer.js";
import { smoothingFactor } from "./rendering/viewport.js";
import { preloadHeroes, registerHeroes } from "./assets/heroLoader.js";
import { PlayerView, type CharacterRendering } from "./entities/PlayerView.js";
import "./styles.css";
import { NetworkClient } from "./net/NetworkClient.js";
import {
  maps,
  collisionRects,
  isPostTownScene,
  postTownRoute,
} from "../../../packages/shared/src/maps.js";
import { heroNames } from "./assets/heroNames.js";
import { speedTimer } from "./ui/speedTimer.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
const net = new NetworkClient(),
  panel = document.querySelector<HTMLDivElement>("#panel")!,
  hud = document.querySelector<HTMLDivElement>("#hud")!,
  notice = document.querySelector<HTMLDivElement>("#notice")!;
let debug = false,
  uiKey = "",
  keys = new Set<string>();
let characterRendering: CharacterRendering =
  new URLSearchParams(location.search).get("characters") === "geometric"
    ? "geometric"
    : "sprite";
const tell = (s: string) => {
  notice.textContent = s;
  setTimeout(() => {
    if (notice.textContent === s) notice.textContent = "";
  }, 6000);
};
const inventory = new InventoryPanel(
  net,
  () => {
    keys.clear();
    submitInput(true);
  },
  tell,
);
net.onerror = tell;
async function request(e: Parameters<typeof net.request>[0], p: unknown) {
  try {
    return await net.request(e, p);
  } catch (err) {
    tell((err as Error).message);
    return null;
  }
}
function renderUI() {
  inventory.render();
  const w = net.world,
    me = w?.players[net.session?.playerId || ""];
  document.body.dataset.playing = String(w?.phase === "PLAYING");
  const abilityBar =
    document.querySelector<HTMLDivElement>("#special-abilities")!;
  abilityBar.hidden = w?.phase !== "PLAYING" || !me?.role;
  for (const button of abilityBar.querySelectorAll<HTMLButtonElement>(
    "button",
  )) {
    const ability = button.dataset.ability;
    button.hidden = ["time-stop", "flight", "black-hole"].includes(
      ability || "",
    )
      ? me?.role !== "EMBER"
      : me?.role !== "OATH";
    const speed = ability === "super-speed";
    if (
      speed ||
      ability === "time-stop" ||
      ability === "flight" ||
      ability === "black-hole"
    ) {
      const active =
        ability === "time-stop" &&
        w?.slowTime &&
        me &&
        w.slowTime.owner === me.id
          ? Math.max(0, (w.slowTime.endsTick - w.serverTick) / 30)
          : 0;
      const timer =
        ability === "black-hole"
          ? speedTimer(0, me?.cooldowns.black_hole, 4, 10)
          : ability === "flight"
            ? speedTimer(me?.flightRemaining, me?.cooldowns.flight, 20, 7)
            : speed
              ? speedTimer(me?.sprintRemaining, me?.cooldowns.sprint)
              : speedTimer(active, me?.cooldowns.slow_time, 10, 10);
      const label =
        ability === "black-hole"
          ? "Black Hole"
          : ability === "flight"
            ? "Flight"
            : speed
              ? "Super Speed"
              : "Slow Time";
      button.dataset.timerPhase = timer.phase;
      button.style.setProperty("--speed-angle", `${timer.angle}deg`);
      button.setAttribute(
        "aria-label",
        timer.phase === "ready"
          ? label
          : `${label} ${timer.phase}, ${Math.ceil(timer.seconds)} seconds remaining`,
      );
    }
    button.disabled =
      (ability === "black-hole" &&
        !!me &&
        me.unlockedSkills.includes("black_hole") &&
        (me.cooldowns.black_hole ?? 0) > 0) ||
      (ability === "flight" &&
        !!me &&
        me.unlockedSkills.includes("flight") &&
        (me.cooldowns.flight ?? 0) > 0) ||
      !net.socket.connected ||
      !me?.connected ||
      !me.hp ||
      (ability === "time-stop" &&
        (!me.unlockedSkills.includes("slow_time") ||
          (me.cooldowns.slow_time ?? 0) > 0));
    if (ability === "time-stop")
      button.title = me?.unlockedSkills.includes("slow_time")
        ? (me.cooldowns.slow_time ?? 0) > 0
          ? `Slow Time · recharging (${Math.ceil(me.cooldowns.slow_time)}s)`
          : "Slow Time · 10 seconds (T)"
        : "Slow Time";
    if (ability === "black-hole")
      button.title = !me?.unlockedSkills.includes("black_hole")
        ? "Black Hole"
        : "Black Hole · 6-tile shot, 3-tile pull radius (3)";
    if (ability === "flight")
      button.title = !me?.unlockedSkills.includes("flight")
        ? "Flight"
        : "Flight · 20 seconds (2), then 7-second cooldown";
    if (speed)
      button.title = !me?.unlockedSkills.includes("dash")
        ? "Super Speed"
        : (me.cooldowns.sprint ?? 0) > 0
          ? "Super Speed · recharging"
          : "Super Speed · 2× speed for 10 seconds (Shift)";
  }
  document.querySelector<HTMLDivElement>("#screen-ui")!.hidden =
    !w || w.phase === "LOBBY";
  const k = JSON.stringify([
    net.session?.playerId,
    w?.phase,
    w?.players &&
      Object.values(w.players).map((p) => [
        p.role,
        p.appearance,
        p.ready,
        p.connected,
        p.unlockedSkills,
        p.skillPoints,
      ]),
    net.socket.connected,
  ]);
  if (k === uiKey) return;
  uiKey = k;
  if (!net.session || !w) {
    panel.className = "card";
    panel.innerHTML =
      '<div class="eyebrow">A COOPERATIVE ADVENTURE</div><h1>Oath <span>&</span> Ember</h1><p>Steel and sorcery. Two heroes. One shared fate.</p><button id="create">Create room</button><div class="join"><input id="code" aria-label="Room code" maxlength="6" placeholder="ROOM CODE"><button id="join">Join</button></div><small>Two browser sessions required • Working prototype</small>';
    panel.querySelector("#create")!.addEventListener("click", async () => {
      const s = await request("room:create", {});
      if (s) net.save(s as never);
    });
    panel.querySelector("#join")!.addEventListener("click", async () => {
      const s = await request("room:join", {
        roomCode: (
          panel.querySelector("#code") as HTMLInputElement
        ).value.trim(),
      });
      if (s) net.save(s as never);
    });
    hud.innerHTML = "";
    return;
  }
  if (w.phase === "LOBBY") {
    panel.className = "card";
    panel.innerHTML = `<div class="eyebrow">GATHER YOUR PARTY</div><h1>Room ${w.roomCode}</h1><button id="leave">← Back to main page</button><button id="copy">Copy code</button><div class="roles"><button id="oath">Sieg<br><small>Guardian • sword & mechanisms</small></button><button id="ember">Coco<br><small>Arcanist • bolts & runes</small></button></div><p id="slots"></p><button id="ready">${me?.ready ? "Cancel ready" : "Ready for adventure"}</button>`;
    const leave = panel.querySelector<HTMLButtonElement>("#leave")!;
    leave.disabled = !net.socket.connected;
    leave.onclick = async () => {
      leave.disabled = true;
      try {
        await net.leaveRoom();
        keys.clear();
        renderUI();
      } catch (err) {
        leave.disabled = !net.socket.connected;
        tell((err as Error).message);
      }
    };
    panel.querySelector("#slots")!.textContent = Object.values(w.players)
      .map(
        (p) =>
          `${p.id === me?.id ? "You" : "Partner"}: ${p.role ? heroNames[p.role] : "choosing"} · ${p.connected ? (p.ready ? "ready" : "not ready") : "disconnected"}`,
      )
      .join(" / ");
    for (const [selector, role] of [
      ["#oath", "OATH"],
      ["#ember", "EMBER"],
    ]) {
      const b = panel.querySelector<HTMLButtonElement>(selector)!;
      b.disabled = Object.values(w.players).some(
        (p) => p.id !== me?.id && p.role === role,
      );
      b.onclick = () => void request("role:select", { role });
    }
    renderAppearanceLobby(
      panel,
      w,
      me?.id || "",
      (appearance) => void request("appearance:select", appearance),
    );
    panel.querySelector<HTMLButtonElement>("#ready")!.onclick = () =>
      void request("lobby:ready", { ready: !me?.ready });
    panel.querySelector<HTMLButtonElement>("#copy")!.onclick = () =>
      void navigator.clipboard
        .writeText(w.roomCode)
        .then(() => tell("Room code copied."))
        .catch(() => tell(w.roomCode));
    return;
  }
  if (w.phase === "COMPLETE") {
    panel.className = "card";
    panel.innerHTML =
      '<div class="eyebrow">THE STORM BREAKS</div><h1>Victory</h1><p>The airship survives. Your oath holds.</p><button id="again">Play again</button>';
    panel.querySelector<HTMLButtonElement>("#again")!.onclick = () =>
      void request("game:restart", {});
  } else {
    panel.className = "hidden";
    panel.innerHTML = "";
  }
  hud.innerHTML = '<span id="stats"></span>';
}
net.onchange = renderUI;
renderUI();
window.addEventListener("keydown", (e) => {
  if (inventory.open) return;
  if (
    (e.target as HTMLElement).tagName === "INPUT" ||
    ((e.target as HTMLElement).closest("#special-abilities") &&
      ["Enter", " "].includes(e.key))
  )
    return;
  if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
    e.preventDefault();
  if (!e.repeat && e.key === "F4") {
    e.preventDefault();
    characterRendering =
      characterRendering === "sprite" ? "geometric" : "sprite";
    tell(`Characters: ${characterRendering}`);
  }
  keys.add(e.key.toLowerCase());
  if (
    !e.repeat &&
    [
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
      " ",
      "j",
      "k",
      "shift",
      "t",
      "f",
      "g",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "e",
    ].includes(e.key.toLowerCase())
  )
    submitInput(true);
  if (!e.repeat && e.key === "F3") {
    e.preventDefault();
    debug = !debug;
  }
});
window.addEventListener("keyup", (e) => {
  if (
    (e.target as HTMLElement).tagName === "INPUT" ||
    ((e.target as HTMLElement).closest("#special-abilities") &&
      ["Enter", " "].includes(e.key))
  )
    return;
  keys.delete(e.key.toLowerCase());
  if (
    [
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
      " ",
      "j",
      "k",
      "shift",
      "t",
      "f",
      "g",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "e",
    ].includes(e.key.toLowerCase())
  )
    submitInput(true);
});
window.addEventListener("blur", () => {
  keys.clear();
  submitInput(true);
});
// Device capability changes update CSS live, independently of canvas size.
const touchMedia = window.matchMedia("(any-pointer: coarse)");
const updateTouch = () => {
  document.body.dataset.touch = String(
    touchMedia.matches ||
      new URLSearchParams(location.search).get("touch") === "1",
  );
};
touchMedia.addEventListener("change", updateTouch);
updateTouch();
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "#special-abilities button",
)) {
  const key =
    button.dataset.ability === "push"
      ? "1"
      : button.dataset.ability === "time-stop"
        ? "t"
        : button.dataset.ability === "black-hole"
          ? "g"
          : button.dataset.ability === "flight"
            ? "f"
            : "shift";
  const canActivate = () => {
    const ability = button.dataset.ability;
    if (!["super-speed", "flight", "black-hole"].includes(ability || ""))
      return true;
    const node =
      ability === "flight"
        ? "flight"
        : ability === "black-hole"
          ? "black_hole"
          : "dash";
    const cooldown = ability === "super-speed" ? "sprint" : node;
    const label =
      ability === "flight"
        ? "Flight"
        : ability === "black-hole"
          ? "Black Hole"
          : "Super Speed";
    const me = net.world?.players[net.session?.playerId || ""];
    if (!me?.unlockedSkills.includes(node)) {
      tell(`${label} is unavailable.`);
      return false;
    }
    if ((me.cooldowns[cooldown] ?? 0) > 0) {
      tell(`${label} is recharging.`);
      return false;
    }
    return true;
  };
  let held = false;
  const release = () => {
    if (!held) return;
    held = false;
    keys.delete(key);
    submitInput(true);
  };
  button.onpointerdown = (event) => {
    if (button.disabled) return;
    event.preventDefault();
    if (!canActivate()) return;
    held = true;
    button.setPointerCapture(event.pointerId);
    keys.add(key);
    submitInput(true);
  };
  button.onpointerup =
    button.onpointercancel =
    button.onlostpointercapture =
      release;
  button.onkeydown = (event) => {
    if (button.disabled || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (!canActivate()) return;
    held = true;
    keys.add(key);
    submitInput(true);
  };
  button.onkeyup = (event) => {
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      release();
    }
  };
  button.onblur = release;
}
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-key]")) {
  const key = b.dataset.key!.toLowerCase();
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    keys.add(key);
    if (["w", "a", "s", "d", " ", "j", "k", "e"].includes(key))
      submitInput(true);
  };
  b.onpointerup =
    b.onpointercancel =
    b.onlostpointercapture =
      () => {
        keys.delete(key);
        if (["w", "a", "s", "d", " ", "j", "k", "e"].includes(key))
          submitInput(true);
      };
}
function submitInput(reliable = false) {
  const w = net.world;
  if (
    !w ||
    w.phase !== "PLAYING" ||
    !net.socket.connected ||
    !net.session ||
    Object.values(w.players).some((p) => !p.connected)
  )
    return;
  const held = (...names: string[]) =>
    !inventory.open && names.some((k) => keys.has(k));
  const i = neutral(++net.seq);
  i.targetTick = net.clock.target(w.serverTick, performance.now());
  {
    i.moveX = Number(held("d", "arrowright")) - Number(held("a", "arrowleft"));
    i.moveY = Number(held("s", "arrowdown")) - Number(held("w", "arrowup"));
    i.jumpHeld = held(" ", "w", "arrowup");
    i.primaryHeld = held("j");
    i.secondaryHeld = held("k");
    i.sprintHeld = held("shift");
    i.slowTimeHeld = held("t");
    const role = w.players[net.session.playerId]?.role;
    i.interactHeld = held("e");
    i.pushHeld = role === "OATH" && held("1");
    i.sprintHeld ||= role === "OATH" && held("2");
    i.slowTimeHeld ||= role === "EMBER" && held("1");
    i.flightHeld = role === "EMBER" && held("2", "f");
    i.blackHoleHeld = role === "EMBER" && held("3", "g");
  }
  net.prediction.push(i, w, !reliable);
  net.sendInput(i, reliable);
}
setInterval(() => submitInput(), 1000 / 30);
class Adventure extends Phaser.Scene {
  temporalView!: TemporalView;
  gfx!: Phaser.GameObjects.Graphics;
  environment!: EnvironmentView;
  bridgeView!: BridgePuzzleView;
  labels: Phaser.GameObjects.Text[] = [];
  sceneKey = "";
  rendered = { x: 0, y: 0 };
  movementTrace: string[] = [];
  lastMovementTrace = 0;
  playerViews = new Map<string, PlayerView>();
  projectileView!: ProjectileView;
  enemyViews = new Map<string, EnemyView>();
  clearEnemyViews() {
    for (const view of this.enemyViews.values()) view.destroy();
    this.enemyViews.clear();
  }
  preload() {
    preloadHedgeMaze(this);
    preloadMirrorPond(this);
    preloadShrine(this);
    preloadGriffin(this);
    preloadHeroes(this);
    preloadTemporal(this);
    preloadMagic(this);
    preloadEnemies(this);
    preloadEnvironment(this);
    preloadBridgePuzzle(this);
  }
  clearPlayerViews() {
    for (const view of this.playerViews.values()) view.destroy();
    this.playerViews.clear();
  }
  private mazeView!: HedgeMazeView;
  private pondView!: MirrorPondView;
  private shrineView!: ShrineView;
  private griffinView!: GriffinView;
  create() {
    this.mazeView = new HedgeMazeView(this);
    this.pondView = new MirrorPondView(this);
    this.shrineView = new ShrineView(this);
    this.griffinView = new GriffinView(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.griffinView.clear(),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.shrineView.clear(),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.pondView.clear(),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.mazeView.clear(),
    );
    registerHeroes(this);
    registerEnemies(this);
    warmMagicTextures(this);
    const detachResponsive = attachResponsiveRenderer(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, detachResponsive);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearPlayerViews();
      this.clearEnemyViews();
    });
    this.temporalView = new TemporalView(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.temporalView.destroy(),
    );
    this.gfx = this.add.graphics();
    this.environment = new EnvironmentView(this);
    this.bridgeView = new BridgePuzzleView(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.bridgeView.clear(),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.environment.clear(),
    );
    this.projectileView = new ProjectileView(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.projectileView.destroy(),
    );
  }
  update(_time: number, delta: number) {
    const w = net.world;
    if (!w || w.phase === "LOBBY") {
      this.gfx.clear();
      this.environment.clear();
      this.bridgeView.clear();
      this.mazeView.clear();
      this.pondView.clear();
      this.shrineView.clear();
      this.griffinView.clear();
      this.sceneKey = "";
      this.projectileView.clear();
      this.clearPlayerViews();
      this.clearEnemyViews();
      return;
    }
    const me = w.players[net.session?.playerId || ""];
    if (!me) return;
    const sceneId = me.sceneId ?? w.sceneId;
    const house = sceneId === "MAIN_HOUSE" || sceneId === "HOUSE_INTERIOR";
    const map = maps[sceneId];
    if (house) this.cameras.main.removeBounds();
    else this.cameras.main.setBounds(0, 0, map.width, map.height);
    this.cameras.main.setZoom(1);
    this.cameras.main.setBackgroundColor(
      sceneId === "HOUSE_INTERIOR" ? 0x2d2827 : house ? 0x29432c : 0x10202b,
    );
    const local = net.prediction.player || me;
    if (this.sceneKey !== sceneId) {
      this.clearPlayerViews();
      this.clearEnemyViews();
      this.projectileView.destroy();
      this.projectileView = new ProjectileView(this);
      this.sceneKey = sceneId;
      this.environment.show(sceneId);
      this.rendered = { x: local.x, y: local.y };
    }
    this.environment.updatePushables(w.pushableOffsets);
    this.bridgeView.update(w, sceneId);
    this.mazeView.update(w, sceneId);
    this.pondView.update(w, sceneId);
    this.griffinView.update(w, sceneId);
    this.shrineView.update(w, sceneId);
    const err = Math.hypot(
      this.rendered.x - local.x,
      this.rendered.y - local.y,
    );
    const a = err > 100 ? 1 : smoothingFactor(delta);
    this.rendered =
      err > 100
        ? { x: local.x, y: local.y }
        : constrainMotion(
            this.rendered,
            {
              x: (local.x - this.rendered.x) * a,
              y: (local.y - this.rendered.y) * a,
            },
            map,
            flightWalls(
              collisionRects(
                sceneId,
                w.puzzles,
                w.pushableOffsets,
                w.bridgePuzzle,
                w.players,
                w.serverTick,
                me.role,
              ),
              !!local.flightRemaining,
            ),
          );
    const firingBridge = bridgeRects[1];
    const frameTarget =
      sceneId === "BRIDGE_RUINS" &&
      me.role === "EMBER" &&
      this.rendered.x >= 448 &&
      this.rendered.x <= 576 &&
      this.rendered.y >= firingBridge.y &&
      this.rendered.y <= firingBridge.y + firingBridge.h;
    const targetSpan = Math.abs(this.rendered.y - bridgePoints.target.y);
    this.cameras.main.setZoom(
      frameTarget ? Math.min(1, this.scale.height / (targetSpan + 160)) : 1,
    );
    if (frameTarget) {
      this.cameras.main.centerOn(
        480,
        (this.rendered.y + bridgePoints.target.y) / 2,
      );
    } else if (
      sceneId === "MIRROR_POND" &&
      me.role === "EMBER" &&
      pondStations.some(
        (p) =>
          Math.hypot(p.shot.x - this.rendered.x, p.shot.y - this.rendered.y) <
          40,
      )
    ) {
      const p = pondStations.find(
        (p) =>
          Math.hypot(p.shot.x - this.rendered.x, p.shot.y - this.rendered.y) <
          40,
      )!;
      const xs = [p.x, p.torch.x, this.rendered.x],
        ys = [p.y, p.torch.y, this.rendered.y];
      const left = Math.min(...xs),
        top = Math.min(...ys),
        right = Math.max(...xs),
        bottom = Math.max(...ys);
      this.cameras.main.setZoom(
        Math.min(
          1,
          this.scale.width / (right - left + 180),
          this.scale.height / (bottom - top + 180),
        ),
      );
      this.cameras.main.centerOn((left + right) / 2, (top + bottom) / 2);
    } else if (
      sceneId === "GRIFFIN_ENCLOSURE" &&
      griffinState(w.puzzles) &&
      Math.abs(this.rendered.x - griffinState(w.puzzles)!.x) <
        this.scale.width - 180 &&
      Math.abs(this.rendered.y - griffinState(w.puzzles)!.y) <
        this.scale.height - 160
    ) {
      const g = griffinState(w.puzzles)!;
      this.cameras.main.centerOn(
        (this.rendered.x + g.x) / 2,
        (Math.min(this.rendered.y - 64, g.y - 110) +
          Math.max(this.rendered.y + 24, g.y + 24)) /
          2,
      );
    } else if (
      sceneId === "GODDESS_SHRINE" &&
      this.rendered.x >= 512 &&
      this.rendered.x <= 768 &&
      this.rendered.y >= 350 &&
      this.rendered.y <= 608
    ) {
      // Keep the statue and offering visible at native pixel scale. Shrinking
      // the whole plaza into this viewport discards detail before CSS upscales it.
      this.cameras.main.centerOn(640, 430);
    } else if (house) {
      const halfX = this.scale.width / (2 * this.cameras.main.zoom),
        halfY = this.scale.height / (2 * this.cameras.main.zoom);
      const bounds = map.cameraBounds ?? {
        x: 0,
        y: 0,
        w: map.width,
        h: map.height,
      };
      const center = (
        position: number,
        start: number,
        size: number,
        half: number,
      ) =>
        size < half * 2
          ? start + size / 2
          : Phaser.Math.Clamp(position, start + half, start + size - half);
      this.cameras.main.centerOn(
        center(this.rendered.x, bounds.x, bounds.w, halfX),
        center(this.rendered.y, bounds.y, bounds.h, halfY),
      );
    } else this.cameras.main.centerOn(this.rendered.x, this.rendered.y);
    const g = this.gfx;
    g.clear();
    if (
      !house &&
      !isPostTownScene(sceneId) &&
      sceneId !== "BRIDGE_RUINS" &&
      sceneId !== "HEDGE_MAZE" &&
      sceneId !== "MIRROR_POND" &&
      sceneId !== "GODDESS_SHRINE" &&
      sceneId !== "GRIFFIN_ENCLOSURE"
    ) {
      g.fillStyle(sceneId === "FOREST_RUINS" ? 0x152c2b : 0x182338);
      g.fillRect(0, 0, map.width, map.height);
      g.lineStyle(1, 0xffffff, 0.04);
      for (let x = 0; x < map.width; x += 60)
        g.lineBetween(x, 0, x, map.height);
      for (let y = 0; y < map.height; y += 60)
        g.lineBetween(0, y, map.width, y);
    }
    for (const r of collisionRects(
      sceneId,
      w.puzzles,
      w.pushableOffsets,
      w.bridgePuzzle,
      w.players,
      w.serverTick,
      me.role,
    )) {
      if (
        (house ||
          isPostTownScene(sceneId) ||
          sceneId === "BRIDGE_RUINS" ||
          sceneId === "HEDGE_MAZE" ||
          sceneId === "MIRROR_POND" ||
          sceneId === "GODDESS_SHRINE" ||
          sceneId === "GRIFFIN_ENCLOSURE") &&
        !debug
      )
        continue;
      g.fillStyle(0x52656c);
      g.fillRoundedRect(r.x, r.y, r.w, r.h, 5);
      g.lineStyle(2, 0x839194);
      g.strokeRect(r.x, r.y, r.w, r.h);
    }
    for (const [id, q] of Object.entries(map.points)) {
      if (id === "boss" || id === "crate" || (house && id === "door")) continue;
      g.fillStyle(
        ["rune", "crystal", "core", "anchor"].includes(id)
          ? 0xbd93f9
          : 0xd5ae65,
        0.8,
      );
      g.fillCircle(q.x, q.y, 18);
      g.lineStyle(2, 0xf6e6bf, 0.6);
      g.strokeCircle(q.x, q.y, 30);
    }
    if (sceneId === "FOREST_RUINS") {
      const q = w.interactables.crate;
      g.fillStyle(0xad8656);
      g.fillRect(q.x - 20, q.y - 20, 40, 40);
    }
    for (const p of Object.values(w.players)) {
      if ((p.sceneId ?? w.sceneId) !== sceneId) continue;
      const pos =
        p.id === me.id
          ? this.rendered
          : net.interpolation.position(p.id, "players") || p;
      let view = this.playerViews.get(p.id);
      if (!view) {
        view = new PlayerView(this);
        this.playerViews.set(p.id, view);
      }
      const motion = p.id === me.id ? local : p;
      view.update(p, motion, pos, map.mode, characterRendering, {
        serverTick: w.serverTick,
        timeScale:
          w.slowTime && !(p.role === "OATH" && (p.sprintRemaining ?? 0) > 0)
            ? SLOW_TIME_SCALE
            : 1,
        slowTimeStarting:
          w.slowTime?.owner === p.id &&
          w.serverTick - w.slowTime.startedTick < 5,
        interacting:
          p.id === me.id &&
          keys.has("e") &&
          net.socket.connected &&
          Object.values(w.players).every((hero) => hero.connected),
      });
    }
    for (const [id, view] of this.playerViews) {
      if (!w.players[id] || (w.players[id].sceneId ?? w.sceneId) !== sceneId) {
        view.destroy();
        this.playerViews.delete(id);
      }
    }
    for (const e of Object.values(sceneId === w.sceneId ? w.enemies : {})) {
      const pos = net.interpolation.position(e.id, "enemies") || e;
      let view = this.enemyViews.get(e.id);
      if (!view) {
        view = new EnemyView(this, e);
        this.enemyViews.set(e.id, view);
      }
      view.update(
        e,
        pos,
        w.serverTick,
        debug,
        w.slowTime ? SLOW_TIME_SCALE : 1,
      );
    }
    for (const [id, view] of this.enemyViews)
      if (sceneId !== w.sceneId || !w.enemies[id]) {
        view.destroy();
        this.enemyViews.delete(id);
      }
    this.projectileView.update(
      {
        ...w,
        blackHoles: Object.fromEntries(
          Object.entries(w.blackHoles ?? {}).filter(
            ([, hole]) => hole.sceneId === sceneId,
          ),
        ),
        projectiles: Object.fromEntries(
          Object.entries(w.projectiles).filter(
            ([, q]) => (q.sceneId ?? w.sceneId) === sceneId,
          ),
        ),
        projectileImpacts: w.projectileImpacts?.filter(
          (q) => (q.sceneId ?? w.sceneId) === sceneId,
        ),
      },
      (id) => net.interpolation.position(id, "projectiles"),
      characterRendering === "geometric",
    );
    if (w.boss && sceneId === w.sceneId) {
      const p = map.points.boss;
      g.fillStyle(w.boss.phase === "SHIELDED" ? 0x7898bf : 0xe26b65);
      g.fillRoundedRect(p.x - 40, p.y - 55, 80, 90, 15);
      g.lineStyle(4, 0xa6dcff);
      if (w.boss.phase === "SHIELDED") g.strokeCircle(p.x, p.y, 62);
      g.fillStyle(0xe96277);
      g.fillRect(p.x - 60, p.y - 80, (120 * w.boss.hp) / 220, 7);
    }
    this.labels.forEach((t) => t.destroy());
    this.labels = [];
    for (const [id, q] of Object.entries(map.points)) {
      if ((house && id === "door") || sceneId === "GODDESS_SHRINE") continue;
      this.labels.push(
        this.add
          .text(
            q.x,
            q.y + 34,
            id === "back"
              ? "E · RETURN"
              : id === "shrine"
                ? "E · GODDESS SHRINE"
                : id === "maze"
                  ? "E · HEDGE MAZE"
                  : id === "pond"
                    ? "E · MIRROR POND"
                    : id.toUpperCase(),
            {
              fontSize: "12px",
              color: "#ecdfc7",
              backgroundColor: "#15232b",
            },
          )
          .setOrigin(0.5),
      );
    }
    const stats = hud.querySelector("#stats");
    if (stats)
      stats.textContent = `${me.role ? heroNames[me.role] : "Choosing"} · HP ${Math.round(me.hp)} · Room ${w.roomCode} · ${net.socket.connected ? "Connected" : "Reconnecting"}`;
    let goal =
      sceneId === "MAIN_HOUSE"
        ? "E by the front door: enter house. Follow the path east; E at the exit for the transition trail."
        : sceneId === "HOUSE_INTERIOR"
          ? "Explore the house. E near the lower-right doorway: return outside."
          : isPostTownScene(sceneId)
            ? sceneId === "MONSTER_CLEARING" &&
              Object.values(w.enemies).some((e) => e.hp > 0)
              ? "Defeat the monster wave, then press E at the east exit to enter Puzzle Map 2."
              : sceneId === "MONSTER_CLEARING"
                ? "Wave cleared! E at the east exit: Puzzle Map 2 — The Bridge That Hates Cooperation."
                : `${postTownRoute[sceneId].name}: explore the paths; E at the golden exit to continue${sceneId === "PUZZLE_GLADE" ? " toward the monster clearing and ruins puzzles" : ""}.`
            : sceneId === "FOREST_RUINS"
              ? !w.puzzles.gate.complete
                ? "Sieg: J at bramble. Coco: hold E at rune."
                : !w.puzzles.bridge.complete
                  ? "Sieg: hold 1 at crate to push to plate. Coco: E at crystal."
                  : !shrineComplete(w)
                    ? "Before boarding: E at GODDESS SHRINE in the south-west. Complete the maze and pond, obtain the Griffin wig, and offer it to the goddess."
                    : "Shrine quest complete and both gates open. Explore east to board the airship."
              : sceneId === "AIRSHIP"
                ? `Hold E together: Sieg at crank, Coco at core. Engine ${Math.min(100, Math.round((w.puzzles.engine.progress / 3) * 100))}%`
                : `Coco: hold E at anchor. Sieg: J near Warden. Shield: ${w.boss?.phase}`;
    if (sceneId === "BRIDGE_RUINS")
      goal = `Puzzle Map 2 · Stage ${w.bridgePuzzle?.stage}/4 · ${w.bridgePuzzle?.message}`;
    if (map.points.back) goal += " · E at RETURN to travel back.";
    if (Object.values(w.players).some((p) => !p.connected))
      goal = "Partner disconnected. Game paused for up to 30 seconds.";
    if (sceneId === "HEDGE_MAZE") {
      const maze = hedgeMazeState(w.puzzles)!;
      goal = !maze.burned
        ? "Hedge Maze: defeat the guards, then Coco burns the dry amber bush with Fireball (J)."
        : !maze.cow.parked
          ? "Coco: enter the side bay and cast Black Hole (3) into the cow's left flank. Clear its path."
          : !maze.runner.caught
            ? "Coco: Slow Time (1). Sieg: Super Speed (2), chase the fleeing carrier and press E to tag it."
            : !w.puzzles.hedgeGate.complete
              ? "Use the shared key at the eastern gate (E)."
              : "Open the shears chest with E, then return to the western entrance. Shared progress is retained.";
    }
    if (sceneId === "MIRROR_POND") {
      const pond = mirrorPondState(w.puzzles)!;
      goal = pond.raised
        ? "All four flames lit! The sanctuary has risen. Open the shared mirror chest (E), then return east."
        : `Mirror Pond · ${pond.torches.filter(Boolean).length}/4 torches · Sieg: Speed through east spikes; hold Push (1) to rotate mirrors 360°. Coco: Flight (2) through water culvert; Fireball (J) from A1–A4.`;
    }
    if (sceneId === "GRIFFIN_ENCLOSURE") {
      const g = griffinState(w.puzzles)!;
      goal = g.wigClaimed
        ? "Griffin Wig acquired · Return south to the goddess and offer it from the shared inventory."
        : "Griffin · Coco: Fly to the northern nest; offer Mirror, then Shears. Black Hole pulls it ashore. Sieg: stand to bait a headbutt, dodge behind a pillar. Slow Time helps both heroes dodge.";
    }
    if (sceneId === "GODDESS_SHRINE")
      goal = shrineComplete(w)
        ? "The Bald Goddess · Quest complete! E at the south-east golden switch to continue to Forest Ruins; south returns to Puzzle Map 2."
        : "Goddess Shrine · E at the offering bowl for a clue. West: Mirror Pond for the mirror. East: Hedge Maze for shears. North: Griffin for the wig. Return here to offer it. I opens the shared backpack.";
    document.querySelector<HTMLDivElement>("#objective")!.textContent = goal;
    const debugPanel = document.querySelector<HTMLDivElement>("#debug")!;
    debugPanel.hidden = !debug;
    if (debug)
      debugPanel.textContent = `F3 · ${characterRendering} (F4) · tick ${w.serverTick} · seq ${net.seq} / ack ${me.lastProcessedInputSeq}\npending ${net.prediction.pending.length} · correction ${net.prediction.error.toFixed(1)}px · buffer ${net.interpolation.buffer.length} · viewport ${this.scale.width}×${this.scale.height}`;
    this.temporalView.update(w, sceneId, this.playerViews, this.time.now);
    const root = document.querySelector<HTMLDivElement>("#game")!;
    root.dataset.playerId = me.id;
    if (new URLSearchParams(location.search).has("enemyQA")) {
      root.dataset.enemyState = JSON.stringify({
        serverTick: w.serverTick,
        enemies: w.enemies,
        projectiles: w.projectiles,
        players: w.players,
      });
      root.dataset.enemyVisuals = JSON.stringify(
        Object.fromEntries(
          [...this.enemyViews].map(([id, v]) => [id, v.inspect()]),
        ),
      );
    }
    if (debug || new URLSearchParams(location.search).has("movementQA")) {
      root.dataset.movementSample = JSON.stringify({
        delta,
        keys: [...keys],
        time: performance.now(),
        tick: w.serverTick,
        ack: me.lastProcessedInputSeq,
        pending: net.prediction.pending.length,
        predictionTick: net.prediction.simulationTick,
        predictionLead: net.prediction.simulationTick - w.serverTick,
        estimatedServerTick: net.clock.estimate(performance.now()),
        serverMovementInput: me.movementInput,
        commands: net.prediction.pending.slice(-6).map((i) => ({
          seq: i.seq,
          tick: i.targetTick,
          x: i.moveX,
          y: i.moveY,
        })),
        remotes: Object.fromEntries(
          Object.values(w.players)
            .filter(
              (p) => p.id !== me.id && (p.sceneId ?? w.sceneId) === sceneId,
            )
            .map((p) => [
              p.id,
              {
                authoritative: { x: p.x, y: p.y },
                rendered: net.interpolation.position(p.id, "players") ?? {
                  x: p.x,
                  y: p.y,
                },
              },
            ]),
        ),
        authoritative: { x: me.x, y: me.y },
        predicted: { x: local.x, y: local.y },
        rendered: { ...this.rendered },
        correction: net.prediction.error,
        sceneId,
        intent: local.movementIntent,
      });
      if (debug && performance.now() - this.lastMovementTrace >= 50) {
        this.lastMovementTrace = performance.now();
        this.movementTrace.push(
          JSON.stringify({
            time: performance.now(),
            tick: w.serverTick,
            lead: net.prediction.simulationTick - w.serverTick,
            keys: [...keys],
            intent: local.movementIntent,
            authoritative: { x: me.x, y: me.y },
            predicted: { x: local.x, y: local.y },
            rendered: { ...this.rendered },
            correction: net.prediction.error,
          }),
        );
        if (this.movementTrace.length > 90) this.movementTrace.shift();
        root.dataset.movementTrace = `[${this.movementTrace.join(",")}]`;
      }
    }
    root.dataset.worldPosition = `${me.x},${me.y}`;
    root.dataset.scene = sceneId;
    (
      window as unknown as { __enemyRendered?: (sample: unknown) => void }
    ).__enemyRendered?.({
      serverTick: w.serverTick,
      enemies: w.enemies,
      visuals: Object.fromEntries(
        [...this.enemyViews].map(([id, v]) => [id, v.inspect()]),
      ),
    });
    root.dataset.projectileVisuals = JSON.stringify(
      this.projectileView.inspect(),
    );
    root.dataset.projectileState = JSON.stringify({
      projectiles: w.projectiles,
      impacts: w.projectileImpacts,
    });
    if (new URLSearchParams(location.search).has("siegQA"))
      root.dataset.playerVisuals = JSON.stringify(
        Object.fromEntries(
          [...this.playerViews].map(([id, view]) => [id, view.inspectCombat()]),
        ),
      );
    root.dataset.combatActions = JSON.stringify(
      Object.values(w.players).map((p) => ({
        id: p.id,
        role: p.role,
        combat: p.combat,
        heavyCharge: p.heavyCharge,
      })),
    );
  }
}
new Phaser.Game({
  // Two-client video QA caps rendering only; simulation and input stay at 30 Hz.
  fps: new URLSearchParams(location.search).has("recordingQA")
    ? { target: 24, limit: 24, forceSetTimeOut: true }
    : undefined,
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#10202b",
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
    width: 640,
    height: 360,
    autoRound: false,
  },
  scene: Adventure,
});
