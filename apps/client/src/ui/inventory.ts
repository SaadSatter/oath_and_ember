import {
  items,
  type ItemId,
  type InventoryTarget,
} from "../../../../packages/shared/src/items.js";
import type { NetworkClient } from "../net/NetworkClient.js";

export class InventoryPanel {
  open = false;
  private selected: ItemId | undefined;
  private pending = false;
  private requestSequence = 0;
  private requestNonce = Math.random().toString(36).slice(2);
  private key = "";
  private lastFocus: HTMLElement | null = null;
  private button = document.createElement("button");
  private dialog = document.createElement("dialog");
  constructor(
    private net: NetworkClient,
    private clearControls: () => void,
    private tell: (s: string, target?: InventoryTarget) => void,
    private sound: (name: string) => void = () => {},
  ) {
    this.button.id = "inventory-toggle";
    this.button.innerHTML = 'Inventory<span class="key-hint"> (I)</span>';
    this.button.setAttribute("aria-haspopup", "dialog");
    this.button.onclick = () => this.toggle();
    this.dialog.className = "inventory-panel";
    this.dialog.setAttribute("aria-label", "Shared inventory");
    this.dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      this.close();
    });
    this.dialog.addEventListener("click", (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "button",
      );
      if (!button) return;
      if (button.dataset.item) {
        this.sound("Select inventory item");
        this.selected = button.dataset.item as ItemId;
        this.key = "";
        this.render();
      }
      if (button.dataset.close) this.close();
      if (button.dataset.use) void this.use(this.target());
    });
    document.body.append(this.button, this.dialog);
    window.addEventListener(
      "keydown",
      (e) => {
        if (
          (e.target as HTMLElement).matches("input, textarea, select") ||
          e.ctrlKey ||
          e.metaKey ||
          e.altKey
        )
          return;
        if (e.key.toLowerCase() === "i" && !e.repeat) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.toggle();
        }
        if (!this.open && e.key.toLowerCase() === "e" && this.target()) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!e.repeat) void this.use(this.target());
        }
      },
      true,
    );
  }
  private target(): InventoryTarget | undefined {
    const w = this.net.world,
      me = w?.players[this.net.session?.playerId ?? ""];
    if (!w || !me || w.phase !== "PLAYING" || me.hp <= 0) return;
    return Object.values(w.inventoryTargets ?? {})
      .filter(
        (t) =>
          t.sceneId === (me.sceneId ?? w.sceneId) &&
          Math.hypot(t.x - me.x, t.y - me.y) <= 64,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - me.x, a.y - me.y) -
            Math.hypot(b.x - me.x, b.y - me.y) || a.id.localeCompare(b.id),
      )[0];
  }
  private toggle() {
    if (this.open) {
      this.close();
      return;
    }
    if (this.button.hidden) return;
    this.lastFocus = document.activeElement as HTMLElement;
    this.open = true;
    this.sound("Inventory open");
    this.clearControls();
    this.key = "";
    this.render();
    this.dialog.showModal();
  }
  /** Also closed by the story when a scene begins (see main.ts). */
  close() {
    if (this.open) this.sound("Inventory close / Escape");
    this.open = false;
    this.clearControls();
    this.dialog.close();
    this.lastFocus?.focus();
  }
  private async use(target: InventoryTarget | undefined) {
    if (!target || this.pending || !this.net.socket.connected) return;
    this.pending = true;
    this.sound("Inventory Use/Open/Speak button");
    this.key = "";
    this.render();
    try {
      const result = (await this.net.request("inventory:use", {
        requestId:
          globalThis.crypto?.randomUUID?.() ??
          `${this.requestNonce}-${++this.requestSequence}`,
        targetId: target.id,
        ...(target.kind === "chest"
          ? {}
          : {
              itemId:
                target.id === "griffin-nest"
                  ? undefined
                  : (this.selected ??
                    (target.kind === "gate" ? target.itemId : undefined)),
            }),
      })) as { message: string };
      this.tell(result.message, target);
    } catch (e) {
      this.sound(
        target.kind === "offering" && target.id !== "griffin-nest"
          ? "Wrong shears / mirror / key offering"
          : "Rejected item / out-of-range / blocked / unavailable action",
      );
      this.tell((e as Error).message, target);
    } finally {
      this.pending = false;
      this.key = "";
      this.render();
    }
  }
  render() {
    const w = this.net.world,
      me = w?.players[this.net.session?.playerId ?? ""];
    this.button.hidden = w?.phase !== "PLAYING" || !me?.role;
    if (this.button.hidden && this.open) this.close();
    if (!this.open) return;
    const inventory = w?.inventory,
      target = this.target();
    const owned = (Object.keys(items) as ItemId[]).filter(
      (id) => (inventory?.counts[id] ?? 0) > 0,
    );
    if (!this.selected || !owned.includes(this.selected))
      this.selected = owned[0];
    const key = JSON.stringify([
      inventory,
      target?.id,
      this.selected,
      this.pending,
      this.net.socket.connected,
      me?.hp,
    ]);
    if (key === this.key) return;
    this.key = key;
    const focused = (document.activeElement as HTMLElement)?.dataset.item;
    this.dialog.innerHTML =
      '<header><h2>Shared inventory</h2><button data-close="true" aria-label="Close inventory">×</button></header><p class="inventory-subtitle">One backpack for Coco and Sieg</p><div class="inventory-content"><div class="inventory-grid"></div><section class="inventory-detail" aria-live="polite"></section></div><footer>I / Esc · Close &nbsp; E · Interact &nbsp; 1–9 · Abilities</footer>';
    const grid = this.dialog.querySelector(".inventory-grid")!;
    if (!owned.length) {
      const p = document.createElement("p");
      p.textContent =
        "Your shared backpack is empty. Explore together to collect quest items.";
      grid.append(p);
    }
    for (const id of owned) {
      const button = document.createElement("button");
      button.dataset.item = id;
      button.setAttribute("aria-pressed", String(this.selected === id));
      const icon = document.createElement("img");
      icon.src = `/assets/ui/inventory/items/${items[id].icon}`;
      icon.alt = "";
      const name = document.createElement("span");
      name.textContent = `${items[id].name} · ×${inventory!.counts[id]}`;
      button.append(icon, name);
      grid.append(button);
    }
    const detail = this.dialog.querySelector(".inventory-detail")!;
    if (this.selected) {
      const title = document.createElement("h3");
      title.textContent = items[this.selected].name;
      const description = document.createElement("p");
      description.textContent = items[this.selected].description;
      detail.append(title, description);
    }
    const hint = document.createElement("p");
    hint.textContent = target
      ? `Nearby: ${target.name}`
      : "Approach a compatible object to use an item.";
    detail.append(hint);
    if (target) {
      const use = document.createElement("button");
      use.dataset.use = "true";
      use.textContent = this.pending
        ? "Waiting…"
        : `${target.kind === "chest" ? "Open" : target.kind === "offering" && !this.selected ? "Speak to" : "Use on"} ${target.name}`;
      use.disabled =
        this.pending ||
        !this.net.socket.connected ||
        (target.kind === "gate" &&
          (this.selected !== target.itemId ||
            !(inventory?.counts[target.itemId!]! > 0)));
      detail.append(use);
    }
    if (focused)
      this.dialog
        .querySelector<HTMLButtonElement>(`[data-item="${focused}"]`)
        ?.focus();
  }
}
