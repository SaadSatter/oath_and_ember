import type {
  StoryStage,
} from "../../../../packages/shared/src/prologue.js";
import { storyStages } from "../../../../packages/shared/src/prologue.js";
import type { World } from "../../../../packages/shared/src/gameTypes.js";

// The quest journal is presentation only: it reads the server's story stage
// and puzzle state, and never decides progress itself.

interface Step {
  name: string;
  stages: StoryStage[];
}
interface Quest {
  name: string;
  steps: Step[];
}
const step = (name: string, ...stages: StoryStage[]): Step => ({
  name,
  stages,
});
export const questLine: Quest[] = [
  {
    name: "Prologue · A Promise Kept",
    steps: [
      step("Visit Alden's magic shop", "ARRIVAL", "LEAVING"),
      step("Find the merchants' lost shipment", "FOREST_BOUND", "TRAIL"),
      step("Train in the Mossling Woods", "WOODS"),
      step("Survive the ambush in the clearing", "AMBUSH", "FIGHT"),
      step("Make it home", "HOME"),
    ],
  },
  {
    name: "Chapter 0 · The Forgotten Oath",
    steps: [
      step("Alden's shopping list", "ERRAND", "HOMEWARD"),
      step("Silence at the shop", "SILENT_SHOP", "STRANGER", "RUSHING", "FINDING"),
      step("Say goodbye to Alden", "MOURNING", "FUNERAL_PREP"),
      step("Ask around Emberbrook", "INVESTIGATION"),
      step("Open Alden's desk", "JOURNAL"),
      step("Choose the road ahead", "DECISION"),
    ],
  },
  {
    name: "Chapter 0 · The Forgotten Shrine",
    steps: [
      step("Find the Forgotten Shrine", "SHRINE_ROAD"),
      step("Pass the Three Trials", "TRIALS"),
      step("Speak to the Guardian Goddess", "GODDESS"),
      step("Recover the Divine Wig", "WIG"),
    ],
  },
];

export interface QuestEntry {
  name: string;
  /** Finished steps; for a finished quest, all of them. */
  done: string[];
}
export interface QuestLog {
  completed: QuestEntry[];
  /** The quest in progress, with the steps already behind the heroes. */
  current?: QuestEntry & { step: string };
}

const at = (s: StoryStage) => storyStages.indexOf(s);

export function questLog(
  w: Pick<World, "story" | "puzzles" | "boss">,
): QuestLog {
  const log: QuestLog = { completed: [] };
  const stage = w.story && at(w.story.stage);
  if (stage !== undefined)
    for (const quest of questLine) {
      const last = Math.max(...quest.steps.flatMap((s) => s.stages.map(at)));
      const first = Math.min(...quest.steps.flatMap((s) => s.stages.map(at)));
      if (stage > last)
        log.completed.push({
          name: quest.name,
          done: quest.steps.map((s) => s.name),
        });
      else if (stage >= first) {
        const now = quest.steps.find((s) => s.stages.map(at).includes(stage));
        log.current = {
          name: quest.name,
          step: now?.name ?? "",
          done: quest.steps
            .filter((s) => Math.max(...s.stages.map(at)) < stage)
            .map((s) => s.name),
        };
      }
    }
  // The regular campaign's milestones, as the server records them.
  const p = w.puzzles;
  const ruins = [
    p.gate?.complete && "Clear the bramble gate",
    p.bridge?.complete && "Raise the crystal bridge",
  ].filter((s): s is string => !!s);
  if (ruins.length) log.completed.push({ name: "Forest Ruins", done: ruins });
  const airship = [
    p.engine?.complete && "Restart the airship's engine",
    w.boss?.phase === "DEFEATED" && "Defeat the Warden",
  ].filter((s): s is string => !!s);
  if (airship.length) log.completed.push({ name: "The Airship", done: airship });
  return log;
}

/**
 * The HUD's objective as a heading and checklist. Objective lines mark their
 * parts with "✓" (done) or "·" (to do), separated by two spaces.
 */
export function objectiveChecklist(goal: string): {
  text: string;
  items: { done: boolean; text: string }[];
} {
  const [text, ...rest] = goal.split(/ {2,}/);
  const items = rest
    .filter((s) => /^[✓·] /.test(s))
    .map((s) => ({ done: s.startsWith("✓"), text: s.slice(2) }));
  return items.length === rest.length
    ? { text: text!, items }
    : { text: goal, items: [] };
}
