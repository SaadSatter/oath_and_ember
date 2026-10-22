import approved from "../audio/approvedCues.json" with { type: "json" };
import revised from "../audio/revisedCues.json" with { type: "json" };
import { GameAudio } from "../audio/GameAudio.js";

// Dev-only page (apps/client/sound-check.html): audition every cue by name.
const audio = new GameAudio();
const loops = new Set([
  "Heavy Break charge",
  "Black Hole opens / pulls",
  "Ironbound Sentinel palm beam active",
  "Ironbound Sentinel beam charge",
  "Lit braziers sustain",
  "Three moving spike sleds",
  "Griffin mouth beam charge",
  "Griffin mouth beam active",
  "Griffin beam contact tail after beam ends",
  "Water dragon rushes",
]);
const changed = Object.keys(revised.cues);
const rest = Object.entries(approved)
  .filter(([name, cue]) => !cue.silent && !(name in revised.cues))
  .map(([name]) => name);
const list = document.getElementById("list")!;
const filter = document.getElementById("filter") as HTMLInputElement;
function section(title: string, names: string[]) {
  const h = document.createElement("h2");
  h.textContent = `${title} (${names.length})`;
  const grid = document.createElement("div");
  grid.className = "grid";
  for (const name of names) {
    const b = document.createElement("button");
    b.textContent = name;
    if (loops.has(name)) b.className = "loop";
    b.onclick = () => audio.preview(name);
    grid.append(b);
  }
  list.append(h, grid);
}
section("Changed or new in the 2026-10-21 revision", changed);
section("Unchanged from the original review", rest);
filter.oninput = () => {
  const q = filter.value.toLowerCase();
  for (const b of list.querySelectorAll("button"))
    (b as HTMLElement).hidden = !b.textContent!.toLowerCase().includes(q);
};
