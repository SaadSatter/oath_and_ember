import type { Role, World } from "../../../../packages/shared/src/gameTypes.js";
import {
  castOf,
  cutscenes,
  storyLineHeld,
  storySpeakerNames,
} from "../../../../packages/shared/src/prologue.js";
import { offstageFor } from "../../../../packages/shared/src/chapter0.js";
import {
  motivationText,
  motivations,
} from "../../../../packages/shared/src/chapter0Finale.js";
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
  /** The line cannot be moved on yet (Alden walking in, his dragon eating). */
  held: boolean;
  /** A choosing line: this hero's own options, until they have chosen. */
  choices?: { id: string; text: string }[];
  /** A choosing line this hero has answered: waiting on the partner. */
  chosen?: boolean;
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
  if (line.choose) {
    const mine = w.story?.motivations?.[role];
    return {
      key: `${run.id}:${run.line}`,
      cutscene: run.id,
      line: run.line,
      speaker: "",
      voice: "NARRATION",
      text: line.text,
      reader: false,
      watching,
      memory: false,
      prompt: "",
      held: false,
      choices: !watching && !mine ? motivations[role] : undefined,
      chosen: !!mine,
    };
  }
  // A hero speaking the reason they chose.
  const text = line.motivation
    ? (motivationText(w.story, line.motivation) ?? "…")
    : line.text;
  return {
    key: `${run.id}:${run.line}`,
    cutscene: run.id,
    line: run.line,
    speaker: shown
      ? storySpeakerNames[line.speaker] + (line.memory ? " · memory" : "")
      : "",
    voice: shown ? line.speaker : "NARRATION",
    text: shown ? text : (line.elsewhere ?? "…"),
    reader: shown && !watching,
    watching,
    memory: shown && !!line.memory,
    prompt: shown && !watching ? (line.prompt ?? "") : "",
    held: storyLineHeld(w.story!, line, w.serverTick),
  };
}

export class StoryDialogue {
  private root = document.createElement("section");
  private speakerEl = document.createElement("div");
  private textEl = document.createElement("p");
  private statusEl = document.createElement("div");
  private choicesEl = document.createElement("ol");
  private picked = 0;
  private view: StoryView | null = null;
  private started = 0;
  private finished = false;
  private sent = false;
  private held = false;
  private frame = 0;
  constructor(
    /** Resolves false when the server did not take the read. */
    private read: (cutscene: string, line: number) => Promise<boolean>,
    private onOpen: () => void,
    private choose: (cutscene: string, line: number, choice: string) => void = () =>
      undefined,
  ) {
    this.root.className = "dialogue-box story-box";
    this.root.hidden = true;
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-live", "polite");
    this.speakerEl.className = "dialogue-speaker";
    this.textEl.className = "dialogue-text";
    this.statusEl.className = "story-status";
    this.choicesEl.className = "story-choices";
    this.choicesEl.hidden = true;
    const arrow = document.createElement("span");
    arrow.className = "dialogue-next";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "▼";
    this.root.append(
      this.speakerEl,
      this.textEl,
      this.choicesEl,
      this.statusEl,
      arrow,
    );
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
        const key = e.key.toLowerCase();
        const options = this.view?.choices;
        if (options && !this.sent) {
          if (["1", "2", "3"].includes(key)) this.pick(Number(key) - 1);
          else if (["arrowup", "w"].includes(key)) this.highlight(-1);
          else if (["arrowdown", "s"].includes(key)) this.highlight(1);
          else if (["e", " ", "enter"].includes(key)) this.pick(this.picked);
          return;
        }
        if (["e", " ", "enter"].includes(key)) this.advance();
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
    if (
      view.key !== this.view?.key ||
      !!view.choices !== !!this.view?.choices
    ) {
      const fresh = view.key !== this.view?.key;
      this.view = view;
      this.held = view.held;
      this.renderChoices();
      if (!fresh) return;
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
    // A held line becomes readable in place: the ▼ comes back with it.
    if (view.held !== this.held) {
      this.held = view.held;
      this.view = view;
      this.draw();
    }
    this.statusEl.textContent = view.watching
      ? `Watching ${partnerName}…`
      : view.chosen
        ? `Waiting for ${partnerName} to choose…`
        : view.choices
          ? "1–3 or ↑↓ then E · Choose"
          : this.sent
            ? ""
            : view.prompt;
  }
  private renderChoices() {
    const options = this.view?.choices;
    this.choicesEl.replaceChildren();
    this.choicesEl.hidden = !options;
    if (!options) return;
    this.picked = 0;
    options.forEach((option, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${index + 1}. ${option.text}`;
      button.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.pick(index);
      });
      item.append(button);
      this.choicesEl.append(item);
    });
    this.highlight(0);
  }
  private highlight(step: number) {
    const buttons = [...this.choicesEl.querySelectorAll("button")];
    if (!buttons.length) return;
    this.picked = (this.picked + step + buttons.length) % buttons.length;
    buttons.forEach((b, i) =>
      b.setAttribute("aria-selected", String(i === this.picked)),
    );
  }
  /** Send this hero's choice (once; the server keeps the first). */
  private pick(index: number) {
    const view = this.view,
      option = view?.choices?.[index];
    if (!view || !option || this.sent) return;
    this.sent = true;
    this.choicesEl
      .querySelectorAll("button")
      .forEach((b, i) => {
        b.disabled = true;
        b.setAttribute("aria-selected", String(i === index));
      });
    this.choose(view.cutscene, view.line, option.id);
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
    if (!view.reader || this.sent || view.held) return;
    this.sent = true;
    this.draw();
    void this.read(view.cutscene, view.line).then((accepted) => {
      // Refused (e.g. the line was held after all): E works again.
      if (!accepted && this.view?.key === view.key) {
        this.sent = false;
        this.draw();
      }
    });
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
      this.finished && !!this.view?.reader && !this.sent && !this.view?.held,
    );
  }
  private place() {
    const box = dialogueLayout(window.innerWidth);
    this.root.style.left = `${box.left}px`;
    this.root.style.width = `${box.width}px`;
    this.root.style.bottom = `${box.bottom}px`;
  }
}
