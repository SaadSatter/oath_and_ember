import type { Role, World } from "../../../../packages/shared/src/gameTypes.js";
import {
  castOf,
  cutscenes,
  storySpeakerNames,
} from "../../../../packages/shared/src/prologue.js";
import { offstageFor } from "../../../../packages/shared/src/chapter0.js";
import { dialogueLayout, typedText } from "./dialogueBox.js";

// The prologue's shared dialogue. The server decides which line is on screen;
// this box types it out, and E (or a tap) tells the server it has been read.
// Both heroes see the same line, and either one's E moves it on for both;
// inner narration shows only to its hero, who alone moves it on.

export interface StoryView {
  key: string;
  cutscene: string;
  line: number;
  speaker: string;
  /** Speaker id for colouring; empty for narration. */
  voice: string;
  text: string;
  /** This hero is meant to confirm the line (false for a partner's thoughts). */
  reader: boolean;
  /** Offstage, following the partner's scene without taking part. */
  watching: boolean;
  /** A remembered line. */
  memory: boolean;
  /** What pressing on means here, e.g. "E · Cast healing magic". */
  prompt: string;
}

/** What this hero should see for the world's current story line, if any. */
export function storyView(
  w: World | null,
  role: Role | null,
): StoryView | null {
  const run = w?.story?.cutscene;
  const line = run && cutscenes[run.id]?.lines[run.line];
  if (!run || !line || !role) return null;
  const cast = castOf(cutscenes[run.id]);
  // A hero outside the scene sees nothing of it, unless they are watching
  // their partner from offstage: then they see it as the partner does.
  const watching = !cast.includes(role);
  if (watching && !offstageFor(w.story, role)?.watch) return null;
  const viewer = watching ? cast[0] : role;
  const shown = !line.audience || line.audience === viewer;
  return {
    key: `${run.id}:${run.line}`,
    cutscene: run.id,
    line: run.line,
    speaker: shown
      ? storySpeakerNames[line.speaker] + (line.memory ? " · memory" : "")
      : "",
    voice: shown ? line.speaker : "NARRATION",
    text: shown ? line.text : (line.elsewhere ?? "…"),
    reader: shown && !watching,
    watching,
    memory: shown && !!line.memory,
    prompt: shown && !watching ? (line.prompt ?? "") : "",
  };
}

export class StoryDialogue {
  private root = document.createElement("section");
  private speakerEl = document.createElement("div");
  private textEl = document.createElement("p");
  private statusEl = document.createElement("div");
  private view: StoryView | null = null;
  private started = 0;
  private finished = false;
  private sent = false;
  private frame = 0;
  constructor(
    private read: (cutscene: string, line: number) => void,
    private onOpen: () => void,
  ) {
    this.root.className = "dialogue-box story-box";
    this.root.hidden = true;
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-live", "polite");
    this.speakerEl.className = "dialogue-speaker";
    this.textEl.className = "dialogue-text";
    this.statusEl.className = "story-status";
    const arrow = document.createElement("span");
    arrow.className = "dialogue-next";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "▼";
    this.root.append(this.speakerEl, this.textEl, this.statusEl, arrow);
    this.root.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.advance();
    });
    document.body.append(this.root);
    window.addEventListener("resize", () => this.open && this.place());
    window.addEventListener(
      "keydown",
      (e) => {
        if (!this.open || e.key.startsWith("F")) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        if (["e", " ", "enter"].includes(e.key.toLowerCase())) this.advance();
      },
      true,
    );
  }
  get open() {
    return !this.root.hidden;
  }
  /** Follow the server's current line; call every frame. */
  sync(w: World | null, role: Role | null, partnerName: string) {
    const view = storyView(w, role);
    if (!view) {
      if (this.view) {
        this.view = null;
        cancelAnimationFrame(this.frame);
        this.root.hidden = true;
      }
      return;
    }
    if (view.key !== this.view?.key) {
      this.view = view;
      this.sent = false;
      this.speakerEl.textContent = view.speaker;
      this.speakerEl.hidden = !view.speaker;
      this.root.dataset.voice = view.voice;
      this.root.classList.toggle(
        "story-thought",
        !view.reader && !view.watching,
      );
      this.root.classList.toggle("story-memory", view.memory);
      if (this.root.hidden) {
        this.root.hidden = false;
        this.place();
        this.onOpen();
      }
      this.startPage();
    }
    this.statusEl.textContent = view.watching
      ? `Watching ${partnerName}…`
      : this.sent
        ? ""
        : view.prompt;
  }
  /** Finish typing, else tell the server this line has been read. */
  advance() {
    const view = this.view;
    if (!view) return;
    if (!this.finished) {
      this.finished = true;
      this.draw();
      return;
    }
    if (!view.reader || this.sent) return;
    this.sent = true;
    this.draw();
    this.read(view.cutscene, view.line);
  }
  private startPage() {
    this.started = performance.now();
    this.finished =
      matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    cancelAnimationFrame(this.frame);
    const tick = () => {
      this.draw();
      if (!this.finished && this.view) this.frame = requestAnimationFrame(tick);
    };
    tick();
  }
  private draw() {
    const page = this.view?.text ?? "";
    const typed = this.finished
      ? { text: page, done: true }
      : typedText(page, performance.now() - this.started);
    if (typed.done) this.finished = true;
    this.textEl.textContent = typed.text;
    this.textEl.setAttribute("aria-label", page);
    this.root.dataset.done = String(
      this.finished && !!this.view?.reader && !this.sent,
    );
  }
  private place() {
    const box = dialogueLayout(window.innerWidth);
    this.root.style.left = `${box.left}px`;
    this.root.style.width = `${box.width}px`;
    this.root.style.bottom = `${box.bottom}px`;
  }
}
