import type { World } from "../../../../packages/shared/src/gameTypes.js";
import { objectiveChecklist, questLog } from "./questLog.js";

/** Quest journal (Q): finished quests and what to do now. Read-only. */
export class QuestPanel {
  open = false;
  readonly button = document.createElement("button");
  private dialog = document.createElement("dialog");
  private world: World | undefined;
  private goal = "";
  private key = "";
  private lastFocus: HTMLElement | null = null;
  constructor(
    private playerId: () => string | undefined,
    /** Another window (a scene, dialogue or the backpack) has the screen. */
    private busy: () => boolean,
    private clearControls: () => void,
    private sound: (name: string) => void = () => {},
  ) {
    this.button.id = "quest-toggle";
    this.button.innerHTML = 'Quests<span class="key-hint"> (Q)</span>';
    this.button.hidden = true;
    this.button.setAttribute("aria-haspopup", "dialog");
    this.button.onclick = () => this.toggle();
    this.dialog.className = "inventory-panel quest-panel";
    this.dialog.setAttribute("aria-label", "Quest journal");
    this.dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      this.close();
    });
    this.dialog.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-close]")) this.close();
    });
    document.body.append(this.dialog);
    // Registered before the other windows, so while the journal is open the
    // game and the backpack never see a key.
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
        if (e.key.toLowerCase() === "q") {
          if (!e.repeat && (this.open || !this.busy())) this.toggle();
          if (this.open || !e.repeat) e.preventDefault();
        }
        if (this.open && e.key !== "Escape") {
          if (e.key.toLowerCase() !== "q") e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
  }
  private toggle() {
    if (this.open) return this.close();
    if (this.button.hidden) return;
    this.lastFocus = document.activeElement as HTMLElement;
    this.open = true;
    this.sound("Inventory open");
    this.clearControls();
    this.key = "";
    this.render();
    this.dialog.showModal();
  }
  close() {
    if (!this.open) return;
    this.sound("Inventory close / Escape");
    this.open = false;
    this.clearControls();
    this.dialog.close();
    this.lastFocus?.focus();
  }
  /** Called every frame with the HUD's current objective line. */
  update(w: World | undefined, goal?: string) {
    this.world = w;
    if (goal !== undefined) this.goal = goal;
    this.render();
  }
  render() {
    const w = this.world,
      me = w?.players[this.playerId() ?? ""];
    this.button.hidden = w?.phase !== "PLAYING" || !me?.role;
    if (this.button.hidden && this.open) this.close();
    if (!this.open || !w) return;
    const log = questLog(w);
    const key = JSON.stringify([log, this.goal]);
    if (key === this.key) return;
    this.key = key;
    const el = (tag: string, text?: string, cls?: string) => {
      const e = document.createElement(tag);
      if (text !== undefined) e.textContent = text;
      if (cls) e.className = cls;
      return e;
    };
    this.dialog.replaceChildren();
    const header = el("header");
    const close = el("button", "×") as HTMLButtonElement;
    close.dataset.close = "true";
    close.setAttribute("aria-label", "Close quest journal");
    header.append(el("h2", "Quests"), close);
    const now = el("section", undefined, "quest-current");
    now.append(el("h3", "Current objective"));
    if (log.current) {
      now.append(el("p", log.current.name, "quest-name"));
      const steps = el("ul", undefined, "quest-steps");
      for (const s of log.current.done) steps.append(el("li", s, "done"));
      if (log.current.step) steps.append(el("li", log.current.step, "now"));
      now.append(steps);
    }
    const goal = objectiveChecklist(this.goal);
    now.append(el("p", goal.text || "Explore together.", "quest-goal"));
    if (goal.items.length) {
      const list = el("ul", undefined, "quest-checklist");
      for (const item of goal.items)
        list.append(el("li", item.text, item.done ? "done" : "todo"));
      now.append(list);
    }
    const done = el("section", undefined, "quest-done");
    done.append(el("h3", "Completed"));
    if (!log.completed.length)
      done.append(el("p", "No quests completed yet.", "inventory-subtitle"));
    for (const q of log.completed) {
      const details = el("details") as HTMLDetailsElement;
      details.append(el("summary", `✓ ${q.name}`));
      const steps = el("ul", undefined, "quest-steps");
      for (const s of q.done) steps.append(el("li", s, "done"));
      details.append(steps);
      done.append(details);
    }
    this.dialog.append(
      header,
      el("div", undefined, "quest-content"),
      el("footer", "Q / Esc · Close"),
    );
    this.dialog.querySelector(".quest-content")!.append(now, done);
  }
}
