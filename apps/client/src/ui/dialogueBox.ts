// Classic black dialogue box with pixel lettering, used for villagers, the
// Bald Goddess and item pickups. Presentation only: opening it never sends
// anything to the server, and while it is open the hero's controls are held.
export const DIALOGUE_CPS = 45;
export const DIALOGUE_FONT = '16px "Press Start 2P"';
// Whole-pixel box geometry: a pixel font only stays sharp when its glyphs
// start on whole pixels, which CSS centring (translate -50%) cannot promise.
export function dialogueLayout(viewportWidth: number) {
  const width = Math.max(0, Math.min(720, viewportWidth - 24)) & ~1;
  return { left: Math.floor((viewportWidth - width) / 2), width, bottom: 18 };
}
export interface DialogueRequest {
  speaker?: string;
  pages: string[];
  /** Runs once when this conversation leaves the screen, however it ends. */
  onClose?: () => void;
}
// How much of a page is typed after `elapsedMs`.
export function typedText(page: string, elapsedMs: number) {
  const shown = Math.min(
    page.length,
    Math.floor((Math.max(0, elapsedMs) / 1000) * DIALOGUE_CPS),
  );
  return { text: page.slice(0, shown), done: shown >= page.length };
}
export class DialogueBox {
  private root = document.createElement("section");
  private speakerEl = document.createElement("div");
  private textEl = document.createElement("p");
  private queue: DialogueRequest[] = [];
  private current: DialogueRequest | null = null;
  private page = 0;
  private started = 0;
  private finished = false;
  private frame = 0;
  constructor(
    private onOpen: () => void,
    private sound: (name: string) => void = () => {},
  ) {
    this.root.className = "dialogue-box";
    this.root.hidden = true;
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-live", "polite");
    this.speakerEl.className = "dialogue-speaker";
    this.textEl.className = "dialogue-text";
    const arrow = document.createElement("span");
    arrow.className = "dialogue-next";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "▼";
    this.root.append(this.speakerEl, this.textEl, arrow);
    this.root.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.advance();
    });
    document.body.append(this.root);
    // Start loading the pixel font now so the first line never flashes in a
    // fallback face.
    void document.fonts?.load(DIALOGUE_FONT).catch(() => undefined);
    window.addEventListener("resize", () => this.open && this.place());
    window.addEventListener(
      "keydown",
      (e) => {
        if (!this.open) return;
        if (e.key.startsWith("F")) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        const key = e.key.toLowerCase();
        if (key === "escape") this.close();
        else if (["e", " ", "enter"].includes(key)) this.advance();
      },
      true,
    );
  }
  get open() {
    return !this.root.hidden;
  }
  say(request: DialogueRequest) {
    const pages = request.pages.map((p) => p.trim()).filter(Boolean);
    if (!pages.length) return;
    this.queue.push({ ...request, pages });
    if (!this.current) this.next();
  }
  /** Finish the page being typed, else turn the page, else close. */
  advance() {
    if (!this.current) return;
    this.sound("Dialogue next page / finish typing");
    if (!this.finished) {
      this.finished = true;
      this.draw();
      return;
    }
    if (this.page < this.current.pages.length - 1) {
      this.page++;
      this.startPage();
    } else this.next();
  }
  close() {
    if (this.open) this.sound("Ordinary NPC conversation open / close");
    for (const request of [this.current, ...this.queue]) request?.onClose?.();
    this.queue = [];
    this.current = null;
    this.hide();
  }
  private next() {
    this.current?.onClose?.();
    this.current = this.queue.shift() ?? null;
    if (!this.current) {
      this.hide();
      return;
    }
    this.page = 0;
    this.speakerEl.textContent = this.current.speaker ?? "";
    this.speakerEl.hidden = !this.current.speaker;
    if (this.root.hidden) {
      this.root.hidden = false;
      this.place();
      this.onOpen();
    }
    this.startPage();
  }
  private startPage() {
    this.started = performance.now();
    this.finished =
      matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    cancelAnimationFrame(this.frame);
    const tick = () => {
      this.draw();
      if (!this.finished && this.current)
        this.frame = requestAnimationFrame(tick);
    };
    tick();
  }
  private draw() {
    const page = this.current?.pages[this.page] ?? "";
    const typed = this.finished
      ? { text: page, done: true }
      : typedText(page, performance.now() - this.started);
    if (typed.done) this.finished = true;
    this.textEl.textContent = typed.text;
    this.textEl.setAttribute("aria-label", page);
    this.root.dataset.done = String(this.finished);
  }
  private place() {
    const box = dialogueLayout(window.innerWidth);
    this.root.style.left = `${box.left}px`;
    this.root.style.width = `${box.width}px`;
    this.root.style.bottom = `${box.bottom}px`;
  }
  private hide() {
    cancelAnimationFrame(this.frame);
    this.root.hidden = true;
  }
}
