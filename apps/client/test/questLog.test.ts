import { describe, it, expect } from "vitest";
import {
  objectiveChecklist,
  questLine,
  questLog,
} from "../src/ui/questLog.js";
import {
  storyStages,
  type StoryStage,
} from "../../../packages/shared/src/prologue.js";

const world = (stage?: StoryStage, puzzles = {}) => ({
  story: stage ? { stage, flags: [] } : undefined,
  puzzles,
  boss: null,
});

describe("quest journal", () => {
  it("covers every story stage before DONE exactly once", () => {
    const covered = questLine.flatMap((q) => q.steps.flatMap((s) => s.stages));
    expect(covered).toEqual(storyStages.filter((s) => s !== "DONE"));
  });
  it("lists finished quests and the steps behind the current one", () => {
    const log = questLog(world("FUNERAL_PREP"));
    expect(log.completed.map((q) => q.name)).toEqual([
      "Prologue · A Promise Kept",
    ]);
    expect(log.current).toEqual({
      name: "Chapter 0 · The Forgotten Oath",
      step: "Say goodbye to Alden",
      done: ["Alden's shopping list", "Silence at the shop"],
    });
  });
  it("marks all of Chapter 0 done, plus campaign milestones", () => {
    const log = questLog(
      world("DONE", {
        gate: { complete: true },
        bridge: { complete: false },
      }) as never,
    );
    expect(log.current).toBeUndefined();
    expect(log.completed.map((q) => q.name)).toEqual([
      "Prologue · A Promise Kept",
      "Chapter 0 · The Forgotten Oath",
      "Chapter 0 · The Forgotten Shrine",
      "Forest Ruins",
    ]);
    expect(log.completed.at(-1)!.done).toEqual(["Clear the bramble gate"]);
  });
  it("shows nothing completed without a story", () => {
    expect(questLog(world())).toEqual({ completed: [] });
  });
  it("turns ticked objectives into a checklist", () => {
    expect(
      objectiveChecklist(
        "Alden's Shopping List  ✓ Moonleaf herbs  · Fresh bread",
      ),
    ).toEqual({
      text: "Alden's Shopping List",
      items: [
        { done: true, text: "Moonleaf herbs" },
        { done: false, text: "Fresh bread" },
      ],
    });
    expect(objectiveChecklist("Go inside (E at the door).").items).toEqual([]);
  });
});
