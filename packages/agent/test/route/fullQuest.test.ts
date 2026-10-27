// The Bald Goddess quest is completable from the goddess checkpoint to
// chapter0.complete through the five-operation interface (docs/midterm/ROUTE_LOG.md).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Director } from "./director.js";
import { fullQuest } from "./fullQuest.js";
import { TraceWriter, verifyTrace } from "../../src/trace.js";

async function run(seed: number) {
  const trace = new TraceWriter();
  const d = new Director({ trace: (e) => trace.write(e) });
  const outcome = await fullQuest(d, seed);
  return { d, outcome, trace, end: d.env.evaluatorReport().stateHash };
}

describe("scripted full-quest route", () => {
  it("finishes the quest (seed 1): success, no invalid actions, within the 480 s game-time limit", async () => {
    const { outcome, trace, d } = await run(1);
    expect(outcome).toMatchObject({ status: "success", reason: "success" });
    expect(outcome.invalidActions).toEqual({ sieg: 0, coco: 0 });
    expect(outcome.ticks).toBeLessThan(480 * 60);
    verifyTrace(trace.lines);
    const notes = d.log.map((l) => l.note);
    for (const step of ["Enchanted Shears", "Vanity Mirror", "Griffin Wig", "offered the wig"])
      expect(notes.some((n) => n.includes(step)), step).toBe(true);
    // Every milestone the evaluator saw, in order of appearance.
    const seen = trace.lines.filter((l) => l.type === "milestone").map((l) => (l.data as { milestone: string }).milestone);
    for (const m of ["goddess-meet-finished", "holding:enchanted_shears", "holding:vanity_mirror", "holding:griffin_wig"]) expect(seen).toContain(m);
    // Regression (found by this route, 2026-10-27): a hero asked to choose was
    // told "Your partner's line." Every observed choice must be offered plainly.
    const choiceViews = d.dialogues.map((v) => v.dialogue).filter((v) => v?.choices);
    expect(choiceViews.length).toBeGreaterThan(0);
    for (const v of choiceViews) expect(v!.waiting ?? "").not.toBe("Your partner's line.");
  }, 120_000);

  it("is deterministic: the same seed and actions end in the same raw state", async () => {
    const a = await run(2),
      b = await run(2);
    expect(a.outcome.status).toBe("success");
    expect(b.end).toBe(a.end);
    expect(b.outcome.ticks).toBe(a.outcome.ticks);
  }, 240_000);

  it("uses only the interface: the route never touches engine state", () => {
    for (const file of ["director.ts", "fullQuest.ts"]) {
      const src = readFileSync(new URL(file, import.meta.url), "utf8")
        // Comments may name the things the route must not use.
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      for (const forbidden of ["GameRoom", "apps/server", "shared/src", ".room", "puzzles", "receiveInput", "useItem(", "readStoryLine", "transition("])
        expect(src, `${file} uses ${forbidden}`).not.toContain(forbidden);
    }
  });
});
