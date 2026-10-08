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
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import { skills } from "../../../packages/shared/src/abilities.js";
import { heroNames } from "./assets/heroNames.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
const net = new NetworkClient(),
  panel = document.querySelector<HTMLDivElement>("#panel")!,
  hud = document.querySelector<HTMLDivElement>("#hud")!,
  notice = document.querySelector<HTMLDivElement>("#notice")!;
let skillOpen = false,
  debug = false,
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
  const w = net.world,
    me = w?.players[net.session?.playerId || ""];
  document.body.dataset.playing = String(w?.phase === "PLAYING" && !skillOpen);
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
    skillOpen,
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
        skillOpen = false;
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
  } else if (skillOpen) {
    panel.className = "card skills";
    panel.innerHTML =
      "<h2>Your path</h2><p>Spend points earned at cooperative checkpoints.</p>";
    for (const s of skills.filter((s) => s.role === me?.role)) {
      const b = document.createElement("button");
      b.textContent = `${s.name} · ${me?.unlockedSkills.includes(s.id) ? "Unlocked" : "1 point"} — ${s.description}`;
      b.disabled = !!me?.unlockedSkills.includes(s.id);
      b.onclick = () => void request("skill:unlock", { nodeId: s.id });
      panel.append(b);
    }
    const b = document.createElement("button");
    b.textContent = "Close";
    b.onclick = () => {
      skillOpen = false;
      renderUI();
    };
    panel.append(b);
  } else {
    panel.className = "hidden";
    panel.innerHTML = "";
  }
  hud.innerHTML =
    '<span id="stats"></span><button id="skills">Skills (Tab)</button>';
  hud.querySelector<HTMLButtonElement>("#skills")!.onclick = () => {
    skillOpen = !skillOpen;
    renderUI();
  };
}
net.onchange = renderUI;
renderUI();
window.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).tagName === "INPUT") return;
  if (
    [" ", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.key,
    )
  )
    e.preventDefault();
  if (!e.repeat && e.key === "F4") {
    e.preventDefault();
    characterRendering =
      characterRendering === "sprite" ? "geometric" : "sprite";
    tell(`Characters: ${characterRendering}`);
  }
  keys.add(e.key.toLowerCase());
  if (!e.repeat && e.key.toLowerCase() === "j") submitInput(true);
  if (!e.repeat && e.key === "Tab") {
    skillOpen = !skillOpen;
    renderUI();
  }
  if (!e.repeat && e.key === "F3") {
    e.preventDefault();
    debug = !debug;
  }
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
  if (e.key.toLowerCase() === "j") submitInput(true);
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
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-key]")) {
  const key = b.dataset.key!.toLowerCase();
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    keys.add(key);
    if (key === "j") submitInput(true);
  };
  b.onpointerup =
    b.onpointercancel =
    b.onlostpointercapture =
      () => {
        keys.delete(key);
        if (key === "j") submitInput(true);
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
  const held = (...names: string[]) => names.some((k) => keys.has(k));
  const i = neutral(++net.seq);
  if (!skillOpen) {
    i.moveX = Number(held("d", "arrowright")) - Number(held("a", "arrowleft"));
    i.moveY = Number(held("s", "arrowdown")) - Number(held("w", "arrowup"));
    i.jumpHeld = held(" ", "w", "arrowup");
    i.primaryHeld = held("j");
    i.secondaryHeld = held("k", "shift");
    i.interactHeld = held("e");
  }
  net.prediction.push(i, w);
  if (reliable) net.socket.emit("player:input", i);
  else net.socket.volatile.emit("player:input", i);
}
setInterval(() => submitInput(), 1000 / 30);
class Adventure extends Phaser.Scene {
  gfx!: Phaser.GameObjects.Graphics;
  labels: Phaser.GameObjects.Text[] = [];
  sceneKey = "";
  rendered = { x: 0, y: 0 };
  playerViews = new Map<string, PlayerView>();
  projectileView!: ProjectileView;
  enemyViews = new Map<string, EnemyView>();
  clearEnemyViews() {
    for (const view of this.enemyViews.values()) view.destroy();
    this.enemyViews.clear();
  }
  preload() {
    preloadHeroes(this);
    preloadMagic(this);
    preloadEnemies(this);
  }
  clearPlayerViews() {
    for (const view of this.playerViews.values()) view.destroy();
    this.playerViews.clear();
  }
  create() {
    registerHeroes(this);
    registerEnemies(this);
    warmMagicTextures(this);
    const detachResponsive = attachResponsiveRenderer(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, detachResponsive);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearPlayerViews();
      this.clearEnemyViews();
    });
    this.gfx = this.add.graphics();
    this.projectileView = new ProjectileView(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.projectileView.destroy(),
    );
  }
  update(_time: number, delta: number) {
    const w = net.world;
    if (!w || w.phase === "LOBBY") {
      this.gfx.clear();
      this.projectileView.clear();
      this.clearPlayerViews();
      this.clearEnemyViews();
      return;
    }
    const map = maps[w.sceneId],
      me = w.players[net.session?.playerId || ""];
    if (!me) return;
    this.cameras.main.setBounds(0, 0, map.width, map.height);
    const local = net.prediction.player || me;
    if (this.sceneKey !== w.sceneId) {
      this.clearPlayerViews();
      this.clearEnemyViews();
      this.projectileView.destroy();
      this.projectileView = new ProjectileView(this);
      this.sceneKey = w.sceneId;
      this.rendered = { x: local.x, y: local.y };
    }
    const err = Math.hypot(
      this.rendered.x - local.x,
      this.rendered.y - local.y,
    );
    const a = err > 100 ? 1 : smoothingFactor(delta);
    this.rendered.x += (local.x - this.rendered.x) * a;
    this.rendered.y += (local.y - this.rendered.y) * a;
    this.cameras.main.centerOn(this.rendered.x, this.rendered.y);
    const g = this.gfx;
    g.clear();
    g.fillStyle(w.sceneId === "FOREST_RUINS" ? 0x152c2b : 0x182338);
    g.fillRect(0, 0, map.width, map.height);
    g.lineStyle(1, 0xffffff, 0.04);
    for (let x = 0; x < map.width; x += 60) g.lineBetween(x, 0, x, map.height);
    for (let y = 0; y < map.height; y += 60) g.lineBetween(0, y, map.width, y);
    if (w.sceneId === "FOREST_RUINS") {
      for (let n = 0; n < 50; n++) {
        const x = 70 + ((n * 137) % 1650),
          y = 80 + ((n * 241) % 730);
        if (Math.abs(y - 450) > 130) {
          g.fillStyle(0x284840);
          g.fillCircle(x, y, 25);
          g.fillStyle(0x35564b);
          g.fillTriangle(x - 24, y, x, y - 45, x + 24, y);
        }
      }
    }
    for (const r of collisionRects(w.sceneId, w.puzzles)) {
      g.fillStyle(0x52656c);
      g.fillRoundedRect(r.x, r.y, r.w, r.h, 5);
      g.lineStyle(2, 0x839194);
      g.strokeRect(r.x, r.y, r.w, r.h);
    }
    for (const [id, q] of Object.entries(map.points)) {
      if (id === "boss" || id === "crate") continue;
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
    if (w.sceneId === "FOREST_RUINS") {
      const q = w.interactables.crate;
      g.fillStyle(0xad8656);
      g.fillRect(q.x - 20, q.y - 20, 40, 40);
    }
    for (const p of Object.values(w.players)) {
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
        interacting:
          p.id === me.id &&
          keys.has("e") &&
          !skillOpen &&
          net.socket.connected &&
          Object.values(w.players).every((hero) => hero.connected),
      });
    }
    for (const [id, view] of this.playerViews) {
      if (!w.players[id]) {
        view.destroy();
        this.playerViews.delete(id);
      }
    }
    for (const e of Object.values(w.enemies)) {
      const pos = net.interpolation.position(e.id, "enemies") || e;
      let view = this.enemyViews.get(e.id);
      if (!view) {
        view = new EnemyView(this, e);
        this.enemyViews.set(e.id, view);
      }
      view.update(e, pos, w.serverTick, debug);
    }
    for (const [id, view] of this.enemyViews)
      if (!w.enemies[id]) {
        view.destroy();
        this.enemyViews.delete(id);
      }
    this.projectileView.update(
      w,
      (id) => net.interpolation.position(id, "projectiles"),
      characterRendering === "geometric",
    );
    if (w.boss) {
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
      this.labels.push(
        this.add
          .text(q.x, q.y + 34, id.toUpperCase(), {
            fontSize: "12px",
            color: "#ecdfc7",
            backgroundColor: "#15232b",
          })
          .setOrigin(0.5),
      );
    }
    const stats = hud.querySelector("#stats");
    if (stats)
      stats.textContent = `${me.role ? heroNames[me.role] : "Choosing"} · HP ${Math.round(me.hp)} · ${me.skillPoints} points · Room ${w.roomCode} · ${net.socket.connected ? "Connected" : "Reconnecting"}`;
    let goal =
      w.sceneId === "FOREST_RUINS"
        ? !w.puzzles.gate.complete
          ? "Sieg: J at bramble. Coco: hold E at rune."
          : !w.puzzles.bridge.complete
            ? "Sieg: hold E at crate to push to plate. Coco: E at crystal."
            : "Both gates open. Explore east to board the airship."
        : w.sceneId === "AIRSHIP"
          ? `Hold E together: Sieg at crank, Coco at core. Engine ${Math.min(100, Math.round((w.puzzles.engine.progress / 3) * 100))}%`
          : `Coco: hold E at anchor. Sieg: J near Warden. Shield: ${w.boss?.phase}`;
    if (Object.values(w.players).some((p) => !p.connected))
      goal = "Partner disconnected. Game paused for up to 30 seconds.";
    document.querySelector<HTMLDivElement>("#objective")!.textContent = goal;
    const debugPanel = document.querySelector<HTMLDivElement>("#debug")!;
    debugPanel.hidden = !debug;
    if (debug)
      debugPanel.textContent = `F3 · ${characterRendering} (F4) · tick ${w.serverTick} · seq ${net.seq} / ack ${me.lastProcessedInputSeq}\npending ${net.prediction.pending.length} · correction ${net.prediction.error.toFixed(1)}px · buffer ${net.interpolation.buffer.length} · viewport ${this.scale.width}×${this.scale.height}`;
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
    root.dataset.worldPosition = `${me.x},${me.y}`;
    root.dataset.scene = w.sceneId;
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
