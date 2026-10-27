import type {
  Enemy,
  Player,
  World,
} from "../../../packages/shared/src/gameTypes.js";
import { spawnEnemy } from "../../../packages/shared/src/enemies.js";
import {
  WOODS,
  WOODS_CRATE_FLAG,
  WOODS_CRATE_REACH,
  WOODS_DONE_FLAG,
  WOODS_ENTER_FLAG,
  WOODS_GUARD_REACH,
  WOODS_RETURN_REACH,
  onWoodsIslet,
  overWoodsWater,
  woodsCrate,
  woodsIntro,
  woodsIntroFlag,
  woodsLesson,
  woodsMosslings,
  woodsSteps,
  type WoodsStep,
} from "../../../packages/shared/src/prologueWoods.js";

// Runs the Mossling Woods tutorial (packages/shared/src/prologueWoods.ts).
// Each lesson opens with a short scene, then its mosslings appear; the server
// watches what each hero actually does (their attacks, guarded hits, Slow
// Time, Super Speed, the crate on the islet, black holes) and moves on once
// both have done their part and the mosslings are beaten.

/** A mossling never appears this close to a hero (unless nowhere else will do). */
const SPAWN_CLEARANCE = 140;

const alive = (w: World, step: WoodsStep) =>
  Object.values(w.enemies).filter(
    (e) => e.id.startsWith(`woods-${step}-`) && e.state !== "DEAD" && e.hp > 0,
  );

function raise(w: World, step: WoodsStep, at: { x: number; y: number }) {
  const woods = w.story!.woods!;
  const id = `woods-${step}-${woods.raised++}`;
  const e: Enemy = spawnEnemy(id, "mossling", at.x, at.y);
  w.enemies[id] = e;
  return e;
}

/** The lesson's spots, those clear of the heroes first, farthest first. */
function clearSpots(w: World, step: WoodsStep) {
  const heroes = Object.values(w.players).filter((p) => p.sceneId === WOODS);
  const away = (s: { x: number; y: number }) =>
    Math.min(...heroes.map((h) => Math.hypot(h.x - s.x, h.y - s.y)), Infinity);
  return [...woodsMosslings[step]].sort(
    (a, b) =>
      Number(away(b) >= SPAWN_CLEARANCE) - Number(away(a) >= SPAWN_CLEARANCE) ||
      away(b) - away(a),
  );
}

/** Begin a lesson: heal both heroes and bring on its mosslings. */
function beginLesson(w: World, step: WoodsStep) {
  const woods = w.story!.woods!;
  woods.since = w.serverTick;
  woods.did = {};
  for (const p of Object.values(w.players)) p.hp = p.maxHp;
  // Only Coco has a part in the flight and black-hole lessons' skills; Sieg's
  // part there is to watch, or to finish off what she gathers.
  if (step === "flight" || step === "black_hole") woods.did.OATH = true;
  for (const at of woodsMosslings[step]) raise(w, step, at);
}

/** Whether this hero has just done their part of the lesson. */
function didPart(
  w: World,
  step: WoodsStep,
  p: Player,
  partner: Player | undefined,
): boolean {
  const since = w.story!.woods!.since ?? 0;
  switch (step) {
    case "attack":
      return (
        !!p.combat &&
        p.combat.startedTick >= since &&
        (p.role === "OATH"
          ? p.combat.kind === "sword" || p.combat.kind === "heavy"
          : p.combat.kind === "cast")
      );
    case "defend":
      // A strike taken on guard, or guarding as a spike winds up nearby.
      return (
        (!!p.defensiveHit && p.defensiveHit.tick >= since) ||
        (p.actionState === "guard" &&
          alive(w, step).some(
            (e) =>
              e.state === "ATTACK" &&
              Math.hypot(e.x - p.x, e.y - p.y) <= WOODS_GUARD_REACH,
          ))
      );
    case "time":
      return p.role === "EMBER"
        ? !!w.slowTime &&
            w.slowTime.owner === p.id &&
            w.slowTime.startedTick >= since
        : (p.sprintRemaining ?? 0) > 0;
    case "flight":
      // Back from the islet with the crate, beside Sieg on dry ground.
      return (
        p.role === "EMBER" &&
        !!w.story!.flags.includes(WOODS_CRATE_FLAG) &&
        !!partner &&
        !onWoodsIslet(p) &&
        !overWoodsWater(p) &&
        Math.hypot(p.x - partner.x, p.y - partner.y) <= WOODS_RETURN_REACH
      );
    case "black_hole":
      return (
        p.role === "EMBER" &&
        Object.values(w.blackHoles ?? {}).some(
          (h) =>
            h.owner === p.id &&
            h.startedTick >= since &&
            h.damaged.some((id) => id.startsWith(`woods-${step}-`)),
        )
      );
  }
}

/** The woods' story, once per (unpaused) tick while no scene is playing. */
export function tickWoods(w: World, start: (id: string) => void) {
  const story = w.story;
  if (!story || story.stage !== "WOODS" || story.cutscene) return;
  const heroes = Object.values(w.players).filter((p) => p.role);
  if (!story.flags.includes(WOODS_ENTER_FLAG)) {
    if (heroes.length && heroes.every((p) => p.sceneId === WOODS))
      start("woods");
    return;
  }
  const woods = (story.woods ??= { step: 0, did: {}, raised: 0 });
  const step = woodsSteps[woods.step];
  if (!step) {
    if (!story.flags.includes(WOODS_DONE_FLAG)) start("woods-done");
    return;
  }
  if (!woodsLesson(story)) return start(woodsIntro(step));
  if (woods.since === undefined) beginLesson(w, step);
  for (const p of heroes)
    if (!woods.did[p.role!] && p.sceneId === WOODS) {
      const partner = heroes.find((q) => q !== p);
      if (didPart(w, step, p, partner)) woods.did[p.role!] = true;
    }
  const everyone = heroes.every((p) => woods.did[p.role!]);
  const left = alive(w, step);
  if (everyone && !left.length) {
    // On to the next lesson (its scene plays on the next tick).
    woods.step++;
    delete woods.since;
    woods.did = {};
    woods.raised = 0;
    return;
  }
  // Out of mosslings with a lesson still to learn that needs them: more come.
  if (!left.length) {
    if (step === "defend") raise(w, step, clearSpots(w, step)[0]);
    if (step === "black_hole" && !woods.did.EMBER)
      for (const at of woodsMosslings[step]) raise(w, step, at);
  }
}

/** E on the islet: Coco takes the merchants' crate (flight lesson only). */
export function woodsInteract(w: World, p: Player) {
  const story = w.story;
  if (
    !story ||
    p.role !== "EMBER" ||
    p.sceneId !== WOODS ||
    woodsLesson(story) !== "flight" ||
    story.flags.includes(WOODS_CRATE_FLAG) ||
    Math.hypot(p.x - woodsCrate.x, p.y - woodsCrate.y) > WOODS_CRATE_REACH
  )
    return false;
  story.flags.push(WOODS_CRATE_FLAG);
  return true;
}

/** In the woods the heroes cannot fall: it is only practice. */
export const woodsProtects = (w: World, p: Player) =>
  w.story?.stage === "WOODS" && p.sceneId === WOODS;
