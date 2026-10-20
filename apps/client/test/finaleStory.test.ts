import { expect, it } from "vitest";
import { storyView } from "../src/ui/storyDialogue.js";
import { newMoments } from "../src/ui/storyBanners.js";
import {
  FINALE,
  motivations,
} from "../../../packages/shared/src/chapter0Finale.js";
import type { World } from "../../../packages/shared/src/gameTypes.js";

const world = (story: NonNullable<World["story"]>) =>
  ({ story }) as unknown as World;

it("offers each hero only their own reasons, until they have chosen", () => {
  const w = world({
    stage: "WIG",
    flags: [],
    cutscene: { id: "resolve", line: 0, acks: [], since: 0 },
  });
  const coco = storyView(w, "EMBER")!,
    sieg = storyView(w, "OATH")!;
  expect(coco.choices).toEqual(motivations.EMBER);
  expect(sieg.choices).toEqual(motivations.OATH);
  expect(coco.reader).toBe(false);
  w.story!.motivations = { OATH: "together" };
  expect(storyView(w, "OATH")!.choices).toBeUndefined();
  expect(storyView(w, "OATH")!.chosen).toBe(true);
  expect(storyView(w, "EMBER")!.choices).toHaveLength(3);
});

it("has each hero speak the reason they chose, to both screens", () => {
  const w = world({
    stage: "WIG",
    flags: [],
    motivations: { OATH: "duty", EMBER: "answer" },
    cutscene: { id: "resolve", line: 1, acks: [], since: 0 },
  });
  for (const role of ["OATH", "EMBER"] as const) {
    const view = storyView(w, role)!;
    expect(view.speaker).toBe("Coco");
    expect(view.text).toBe("Whoever killed Papa will answer to me.");
  }
  w.story!.cutscene!.line = 2;
  expect(storyView(w, "EMBER")!.text).toBe(
    "If these relics threaten everyone, someone has to act.",
  );
});

it("marks trials and the chapter's end as they happen, never replaying old ones", () => {
  // A screen joining late has already seen what was earned before.
  const seen = new Set([FINALE.trials.cooperation]);
  expect(
    newMoments(seen, [FINALE.trials.cooperation, FINALE.trials.ingenuity]),
  ).toEqual([{ kind: "trial", text: "Trial of Ingenuity · passed" }]);
  expect(newMoments(seen, [FINALE.trials.ingenuity])).toEqual([]);
  expect(newMoments(seen, [FINALE.complete])).toEqual([
    { kind: "complete", text: "CHAPTER 0 COMPLETE" },
  ]);
  expect(newMoments(seen, [FINALE.complete])).toEqual([]);
});
