import type { World } from "../../../../packages/shared/src/gameTypes.js";
import {
  FINALE,
  trialNames,
  trialOrder,
} from "../../../../packages/shared/src/chapter0Finale.js";

// Moments the story marks without stopping play: a trial passed (a banner),
// and the end of Chapter 0 (fade to black, then the title card). Each shows
// once, as it happens; flags already earned when this screen first sees the
// room (a reconnect, a late join) are never replayed.

export interface StoryMoment {
  kind: "trial" | "complete";
  text: string;
}
/** Story flags whose arrival this screen should mark, in arrival order. */
export function newMoments(seen: Set<string>, flags: string[]) {
  const fresh = flags.filter((f) => !seen.has(f));
  fresh.forEach((f) => seen.add(f));
  return fresh.flatMap((f): StoryMoment[] => {
    const trial = trialOrder.find((t) => FINALE.trials[t] === f);
    if (trial) return [{ kind: "trial" as const, text: `${trialNames[trial]} · passed` }];
    if (f === FINALE.complete)
      return [{ kind: "complete" as const, text: "CHAPTER 0 COMPLETE" }];
    return [];
  });
}

export class StoryBanners {
  private seen: Set<string> | null = null;
  private room = "";
  private banner = document.createElement("div");
  private curtain = document.createElement("div");
  private timers: number[] = [];
  constructor() {
    this.banner.className = "story-banner";
    this.banner.hidden = true;
    this.curtain.className = "chapter-curtain";
    this.curtain.hidden = true;
    const title = document.createElement("div");
    title.className = "chapter-curtain-title";
    this.curtain.append(title);
    document.body.append(this.banner, this.curtain);
  }
  /** Call with every world update. */
  update(w: World | null) {
    if (!w?.story) return;
    if (w.roomCode !== this.room || !this.seen) {
      this.room = w.roomCode;
      this.seen = new Set(w.story.flags);
      return;
    }
    for (const moment of newMoments(this.seen, w.story.flags))
      if (moment.kind === "trial") this.showBanner(moment.text);
      else this.showCurtain(moment.text);
  }
  private later(ms: number, run: () => void) {
    this.timers.push(window.setTimeout(run, ms));
  }
  private showBanner(text: string) {
    this.banner.textContent = text;
    this.banner.hidden = false;
    this.banner.classList.remove("shown");
    void this.banner.offsetWidth;
    this.banner.classList.add("shown");
    this.later(3600, () => {
      if (this.banner.textContent === text) this.banner.hidden = true;
    });
  }
  /** Fade to black, "CHAPTER 0 COMPLETE", then back to the world. */
  private showCurtain(text: string) {
    const title = this.curtain.firstElementChild as HTMLElement;
    title.textContent = text;
    this.curtain.hidden = false;
    this.curtain.dataset.phase = "dark";
    this.later(1600, () => (this.curtain.dataset.phase = "title"));
    this.later(6400, () => (this.curtain.dataset.phase = "lift"));
    this.later(8200, () => {
      this.curtain.hidden = true;
      delete this.curtain.dataset.phase;
    });
  }
}
