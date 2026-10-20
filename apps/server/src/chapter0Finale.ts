import type {
  Player,
  SceneId,
  World,
} from "../../../packages/shared/src/gameTypes.js";
import {
  FINALE,
  motivationFlag,
  motivations,
  roadsOpen,
  trialOrder,
  trialsPassed,
} from "../../../packages/shared/src/chapter0Finale.js";
import { castOf, cutscenes } from "../../../packages/shared/src/prologue.js";
import { gladeSolved } from "../../../packages/shared/src/statueGlade.js";
import { heavyOnPlate } from "../../../packages/shared/src/bridgePuzzle.js";
import { shrineComplete } from "../../../packages/shared/src/shrine.js";

// When Chapter 0's finale scenes play (the script is chapter0Finale.ts). Each
// waits for its moment in the existing puzzles, plays once (its flag records
// it), and never moves the party: travel stays the campaign's own.

type Start = (id: string, by?: Player) => void;

/** Both heroes are on this map, the party's map, and nobody is in the air. */
function partyOn(w: World, scene: SceneId, heroes: Player[]) {
  return (
    w.sceneId === scene &&
    heroes.every(
      (p) => (p.sceneId ?? w.sceneId) === scene && !(p.flightRemaining! > 0),
    )
  );
}

/** Story triggers for the finale; called each tick no scene is playing. */
export function tickFinale(
  w: World,
  start: Start,
  coco: Player,
  sieg: Player,
) {
  const story = w.story;
  if (!story || !roadsOpen(story) || story.stage === "DONE") return;
  const has = (f: string) => story.flags.includes(f);
  const heroes = [coco, sieg];
  const on = (scene: SceneId) => partyOn(w, scene, heroes);
  const bag = w.inventory?.counts ?? {};
  // The Three Trials are passed as Puzzle Map 2's own latches close; each is
  // recorded once, and only after the inscription has set them.
  const bridge = w.bridgePuzzle;
  if (
    story.stage === "TRIALS" &&
    has(FINALE.inscription) &&
    w.sceneId === "BRIDGE_RUINS" &&
    bridge
  ) {
    const passed = trialsPassed(bridge, heavyOnPlate(bridge, "B"));
    // In order: a later latch implies the earlier trials were passed.
    let earlier = true;
    for (const t of trialOrder) {
      earlier &&= passed[t];
      if (earlier && !has(FINALE.trials[t])) story.flags.push(FINALE.trials[t]);
    }
  }
  if (story.stage === "SHRINE_ROAD" && on("PUZZLE_GLADE")) {
    if (!has(FINALE.angelMeet)) start("angel-meet");
    else if (gladeSolved(w.puzzles) && !has(FINALE.blessing))
      start("angel-blessing");
  } else if (story.stage === "TRIALS" && on("BRIDGE_RUINS")) {
    if (!has(FINALE.inscription)) start("trials-inscription");
    else if (bridge?.complete && has(FINALE.trials.courage))
      start("trials-done");
  } else if (
    story.stage === "GODDESS" &&
    on("GODDESS_SHRINE") &&
    !has(FINALE.goddessMeet)
  )
    start("goddess-meet");
  else if (story.stage === "WIG") {
    if (shrineComplete(w) && on("GODDESS_SHRINE")) {
      // The goddess remembers; then each hero decides; then the watcher.
      // Each follows the last, and picks up again after a reconnect.
      if (!has(FINALE.revelation)) start("revelation");
      else if (!has(FINALE.resolve)) start("resolve");
      else if (!has(FINALE.complete)) start("watcher");
    } else if (on("HEDGE_MAZE") && !has(FINALE.maze)) start("maze-banter");
    else if (
      on("MIRROR_POND") &&
      (bag.vanity_mirror ?? 0) > 0 &&
      !has(FINALE.mirror)
    )
      start("mirror-banter");
    else if (on("GRIFFIN_ENCLOSURE") && !has(FINALE.griffin))
      start("griffin-banter");
    else if (
      on("GRIFFIN_ENCLOSURE") &&
      (bag.griffin_wig ?? 0) > 0 &&
      !has(FINALE.wig)
    )
      start("wig-banter");
  }
}

/** While a scene that holds the world plays, monsters and traps wait. */
export function finaleHoldsWorld(w: World) {
  const run = w.story?.cutscene;
  return !!run && !!cutscenes[run.id]?.hold;
}

/**
 * Ways on that wait for the finale's scene there to have played: the glade
 * until the angel's blessing, the bridge's castle exit until the trials are
 * done, and the shrine's road on until Chapter 0 is complete.
 */
export function finaleBlocksExit(w: World, scene: SceneId) {
  const story = w.story;
  if (!story || !roadsOpen(story)) return false;
  const has = (f: string) => story.flags.includes(f);
  if (scene === "PUZZLE_GLADE") return !has(FINALE.blessing);
  if (scene === "BRIDGE_RUINS") return !has(FINALE.trialsPassed);
  if (scene === "GODDESS_SHRINE") return !has(FINALE.complete);
  return false;
}

/**
 * A hero picks their reason to go on. Only for the line that asks, only for
 * their own role, once; repeats and stale requests change nothing.
 */
export function chooseMotivation(
  w: World,
  playerId: string,
  id: string,
  line: number,
  choice: string,
) {
  const run = w.story?.cutscene,
    p = w.players[playerId];
  if (!run || !p?.role || run.id !== id || run.line !== line) return false;
  const scene = cutscenes[id];
  if (!scene.lines[line]?.choose || !castOf(scene).includes(p.role))
    return false;
  const story = w.story!;
  const chosen = (story.motivations ??= {});
  if (chosen[p.role]) return chosen[p.role] === choice;
  if (!motivations[p.role].some((m) => m.id === choice)) return false;
  chosen[p.role] = choice;
  story.flags.push(motivationFlag(p.role, choice));
  return true;
}

/** Whether every hero in a choosing line has chosen. */
export function everyoneChose(w: World) {
  const run = w.story?.cutscene;
  if (!run) return false;
  const scene = cutscenes[run.id];
  return (
    !!scene.lines[run.line]?.choose &&
    castOf(scene).every((r) => !!w.story!.motivations?.[r])
  );
}
