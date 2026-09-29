import Phaser from "phaser";
import "./styles.css";
import { NetworkClient } from "./net/NetworkClient.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import { skills } from "../../../packages/shared/src/abilities.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
const net = new NetworkClient(),
  panel = document.querySelector<HTMLDivElement>("#panel")!,
  hud = document.querySelector<HTMLDivElement>("#hud")!,
  notice = document.querySelector<HTMLDivElement>("#notice")!;
let skillOpen = false,
  debug = false,
  uiKey = "",
  keys = new Set<string>();
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
  const k = JSON.stringify([
    net.session?.playerId,
    w?.phase,
    w?.players &&
      Object.values(w.players).map((p) => [
        p.role,
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
    panel.innerHTML = `<div class="eyebrow">GATHER YOUR PARTY</div><h1>Room ${w.roomCode}</h1><button id="copy">Copy code</button><div class="roles"><button id="oath">OATH<br><small>Guardian • sword & mechanisms</small></button><button id="ember">EMBER<br><small>Arcanist • bolts & runes</small></button></div><p id="slots"></p><button id="ready">${me?.ready ? "Cancel ready" : "Ready for adventure"}</button>`;
    panel.querySelector("#slots")!.textContent = Object.values(w.players)
      .map(
        (p) =>
          `${p.id === me?.id ? "You" : "Partner"}: ${p.role || "choosing"} · ${p.connected ? (p.ready ? "ready" : "not ready") : "disconnected"}`,
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
  keys.add(e.key.toLowerCase());
  if (!e.repeat && e.key === "Tab") {
    skillOpen = !skillOpen;
    renderUI();
  }
  if (!e.repeat && e.key === "F3") {
    e.preventDefault();
    debug = !debug;
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-key]")) {
  const key = b.dataset.key!.toLowerCase();
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    keys.add(key);
  };
  b.onpointerup = b.onpointercancel = () => {
    keys.delete(key);
  };
}
setInterval(() => {
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
  net.socket.volatile.emit("player:input", i);
}, 1000 / 30);
class Adventure extends Phaser.Scene {
  gfx!: Phaser.GameObjects.Graphics;
  labels: Phaser.GameObjects.Text[] = [];
  sceneKey = "";
  rendered = { x: 0, y: 0 };
  create() {
    this.gfx = this.add.graphics();
  }
  update() {
    const w = net.world;
    if (!w || w.phase === "LOBBY") {
      this.gfx.clear();
      return;
    }
    const map = maps[w.sceneId],
      me = w.players[net.session?.playerId || ""];
    if (!me) return;
    this.cameras.main.setBounds(0, 0, map.width, map.height);
    const local = net.prediction.player || me;
    if (this.sceneKey !== w.sceneId) {
      this.sceneKey = w.sceneId;
      this.rendered = { x: local.x, y: local.y };
    }
    const err = Math.hypot(
      this.rendered.x - local.x,
      this.rendered.y - local.y,
    );
    const a = err > 100 ? 1 : 0.3;
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
      g.fillStyle(p.role === "OATH" ? 0xe4b56b : 0xc5a1f5);
      if (p.role === "OATH")
        g.fillRoundedRect(pos.x - 13, pos.y - 17, 26, 34, 4);
      else g.fillCircle(pos.x, pos.y, 14);
      g.lineStyle(3, 0xffffff);
      g.lineBetween(
        pos.x,
        pos.y,
        pos.x + Math.cos(p.facing) * 25,
        pos.y + Math.sin(p.facing) * 25,
      );
      if (p.actionState === "guard") {
        g.lineStyle(2, 0x90d9ef);
        g.strokeCircle(pos.x, pos.y, 23);
      }
      g.fillStyle(0xe05260);
      g.fillRect(pos.x - 18, pos.y - 28, (36 * p.hp) / p.maxHp, 4);
    }
    for (const e of Object.values(w.enemies)) {
      const q = net.interpolation.position(e.id, "enemies") || e;
      g.fillStyle(0x88b477);
      g.fillCircle(q.x, q.y, 18);
      g.fillStyle(0xeb6175);
      g.fillRect(q.x - 18, q.y - 28, (e.hp / 60) * 36, 4);
    }
    for (const p of Object.values(w.projectiles)) {
      const q = net.interpolation.position(p.id, "projectiles") || p;
      g.fillStyle(0xdac1ff);
      g.fillCircle(q.x, q.y, 6);
    }
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
      stats.textContent = `${me.role} · HP ${Math.round(me.hp)} · ${me.skillPoints} points · Room ${w.roomCode} · ${net.socket.connected ? "Connected" : "Reconnecting"}`;
    let goal =
      w.sceneId === "FOREST_RUINS"
        ? !w.puzzles.gate.complete
          ? "Oath: J at bramble. Ember: hold E at rune."
          : !w.puzzles.bridge.complete
            ? "Oath: hold E at crate to push to plate. Ember: E at crystal."
            : "Both gates open. Explore east to board the airship."
        : w.sceneId === "AIRSHIP"
          ? `Hold E together: Oath at crank, Ember at core. Engine ${Math.min(100, Math.round((w.puzzles.engine.progress / 3) * 100))}%`
          : `Ember: hold E at anchor. Oath: J near Warden. Shield: ${w.boss?.phase}`;
    if (Object.values(w.players).some((p) => !p.connected))
      goal = "Partner disconnected. Game paused for up to 30 seconds.";
    this.labels.push(
      this.add
        .text(
          16,
          70,
          goal + "\nWASD / arrows · J attack · K defense · E use · Space jump",
          {
            fontSize: "14px",
            color: "#f6e9cd",
            backgroundColor: "#10202bdd",
            wordWrap: { width: Math.max(260, this.scale.width - 32) },
          },
        )
        .setScrollFactor(0),
    );
    if (debug)
      this.labels.push(
        this.add
          .text(
            16,
            130,
            `F3 · tick ${w.serverTick} · seq ${net.seq} / ack ${me.lastProcessedInputSeq}\npending ${net.prediction.pending.length} · correction ${net.prediction.error.toFixed(1)}px · buffer ${net.interpolation.buffer.length}`,
            { fontSize: "12px", color: "#a5e4ba", backgroundColor: "#000000" },
          )
          .setScrollFactor(0),
      );
  }
}
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#10202b",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: Adventure,
});
