import { expect, it } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { collisionRects, maps } from "../../../packages/shared/src/maps.js";
import {
  WOODS,
  WOODS_CRATE_FLAG,
  WOODS_HP_FLOOR,
  onWoodsIslet,
  overWoodsWater,
  woodsCrate,
  woodsLesson,
  woodsMosslings,
  woodsObjective,
  woodsSteps,
} from "../../../packages/shared/src/prologueWoods.js";
import { cutscenes } from "../../../packages/shared/src/prologue.js";
import {
  beatMosslings,
  clearWoods,
  lessonMosslings,
  openLesson,
  readOn,
  send,
} from "./woodsPlay.js";

/** Two heroes, with the story moved on to the cart's tracks. */
function atTrailEnd() {
  const r = new GameRoom("WOODS1", false, "MAIN_HOUSE", true),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const sieg = r.state.players[a.playerId],
    coco = r.state.players[b.playerId];
  const story = r.state.story!;
  story.stage = "TRAIL";
  story.flags.push("prologue.visit", "prologue.detour", "prologue.cart");
  r.transition("PROLOGUE_TRAIL");
  r.state.serverTick += 120;
  return { r, sieg, coco };
}
function intoWoods() {
  const room = atTrailEnd(),
    { r, coco } = room;
  Object.assign(coco, maps.PROLOGUE_TRAIL.points.exit);
  send(r, coco, { interactHeld: true });
  send(r, coco);
  return room;
}
const blocked = (p: { x: number; y: number }, flying = false) =>
  collisionRects(WOODS, {})
    .filter((q) => !flying || !q.terrain)
    .some(
      (q) =>
        p.x + 13 > q.x &&
        p.x - 13 < q.x + q.w &&
        p.y + 13 > q.y &&
        p.y - 13 < q.y + q.h,
    );

it("leads the cart's tracks into the Mossling Woods, and stays shut until the lessons are done", () => {
  const { r, sieg, coco } = intoWoods();
  expect(r.state.sceneId).toBe(WOODS);
  expect(r.state.story!.stage).toBe("WOODS");
  expect([sieg.sceneId, coco.sceneId]).toEqual([WOODS, WOODS]);
  expect(r.state.checkpoint).toBe("Mossling Woods");
  // Arriving plays the woods' opening scene for both.
  expect(r.state.story!.cutscene?.id).toBe("woods");
  readOn(r, [sieg, coco]);
  // The way on is closed while lessons remain.
  r.state.serverTick += 120;
  Object.assign(coco, maps.PROLOGUE_WOODS.points.exit);
  send(r, coco, { interactHeld: true });
  send(r, coco);
  expect(r.state.sceneId).toBe(WOODS);
});

it("places every lesson's mosslings, the crate, the spawn and the exit on clear ground", () => {
  for (const spots of Object.values(woodsMosslings))
    for (const at of spots) expect(blocked(at)).toBe(false);
  expect(blocked(maps.PROLOGUE_WOODS.spawn)).toBe(false);
  expect(blocked(maps.PROLOGUE_WOODS.points.exit)).toBe(false);
  // The crate stands on the islet, which only Flight can reach.
  expect(blocked(woodsCrate)).toBe(false);
  expect(onWoodsIslet(woodsCrate)).toBe(true);
  const shore = { x: 760, y: woodsCrate.y };
  expect(blocked(shore)).toBe(false);
  let walked = false;
  for (let x = shore.x; x < woodsCrate.x; x += 4)
    if (blocked({ x, y: shore.y })) walked = true;
  expect(walked).toBe(true);
  for (let x = shore.x; x < woodsCrate.x; x += 4)
    expect(blocked({ x, y: shore.y }, true)).toBe(false);
  expect(overWoodsWater({ x: 810, y: woodsCrate.y })).toBe(true);
});

it("teaches each skill in turn, crediting only what each hero actually does", () => {
  const { r, sieg, coco } = intoWoods();
  const both = [sieg, coco];
  readOn(r, both);
  // Attack: the scene first, then two mosslings.
  openLesson(r, both);
  expect(woodsLesson(r.state.story)).toBe("attack");
  expect(lessonMosslings(r)).toHaveLength(woodsMosslings.attack.length);
  // Beating them is not enough: each hero must attack.
  send(r, sieg, { primaryHeld: true });
  send(r, sieg);
  beatMosslings(r);
  r.tick();
  expect(r.state.story!.woods!.step).toBe(0);
  expect(r.state.story!.woods!.did).toEqual({ OATH: true });
  expect(woodsObjective(r.state.story, "EMBER")).toContain("J");
  send(r, coco, { primaryHeld: true });
  send(r, coco);
  r.tick();
  expect(r.state.story!.woods!.step).toBe(1);

  // Defend: a hit taken without guarding teaches nothing, and heroes never
  // fall below the woods' floor; mosslings beaten too soon are replaced.
  openLesson(r, both);
  expect(woodsLesson(r.state.story)).toBe("defend");
  send(r, sieg);
  r.damage(sieg, 500);
  expect(sieg.hp).toBe(WOODS_HP_FLOOR);
  expect(sieg.sceneId).toBe(WOODS);
  beatMosslings(r);
  r.tick();
  expect(r.state.story!.woods!.did.OATH).toBeFalsy();
  expect(lessonMosslings(r)).toHaveLength(1);
  for (const p of both) {
    send(r, p, { secondaryHeld: true });
    r.damage(p, 10);
    send(r, p, { secondaryHeld: true });
  }
  expect(r.state.story!.woods!.did).toEqual({ OATH: true, EMBER: true });
  beatMosslings(r);
  r.tick();
  expect(r.state.story!.woods!.step).toBe(2);

  // Slow Time and Super Speed, each through the real ability request.
  openLesson(r, both);
  expect(woodsLesson(r.state.story)).toBe("time");
  // Lessons heal: a new one starts at full health.
  expect(sieg.hp).toBe(sieg.maxHp);
  send(r, coco, { slowTimeHeld: true });
  send(r, coco);
  expect(r.state.slowTime?.owner).toBe(coco.id);
  expect(r.state.story!.woods!.did.EMBER).toBe(true);
  send(r, sieg, { sprintHeld: true });
  send(r, sieg);
  expect(r.state.story!.woods!.did.OATH).toBe(true);
  beatMosslings(r);
  r.tick();
  expect(r.state.story!.woods!.step).toBe(3);

  // Flight: only Coco, only at the crate; then back beside Sieg on land.
  openLesson(r, both);
  expect(woodsLesson(r.state.story)).toBe("flight");
  Object.assign(sieg, woodsCrate);
  send(r, sieg, { interactHeld: true });
  send(r, sieg);
  expect(r.state.story!.flags).not.toContain(WOODS_CRATE_FLAG);
  Object.assign(sieg, { x: 740, y: 470 });
  send(r, coco, { flightHeld: true });
  expect(coco.flightRemaining).toBeGreaterThan(0);
  Object.assign(coco, woodsCrate);
  send(r, coco, { interactHeld: true });
  send(r, coco);
  expect(r.state.story!.flags).toContain(WOODS_CRATE_FLAG);
  expect(woodsObjective(r.state.story, "EMBER")).toContain("Fly back");
  // Still on the islet, within sight of Sieg: not back yet.
  r.tick();
  expect(r.state.story!.woods!.did.EMBER).toBeFalsy();
  Object.assign(coco, { x: 700, y: 470 });
  r.tick();
  r.tick();
  expect(r.state.story!.woods!.step).toBe(4);

  // Black Hole: it must catch a mossling; more come if they fall without one.
  openLesson(r, both);
  expect(woodsLesson(r.state.story)).toBe("black_hole");
  beatMosslings(r);
  r.tick();
  expect(lessonMosslings(r)).toHaveLength(woodsMosslings.black_hole.length);
  Object.assign(coco, { x: 760, y: 560 });
  Object.assign(sieg, { x: 600, y: 560 });
  send(r, coco, { moveY: 1, blackHoleHeld: true });
  for (let i = 0; i < 900 && !r.state.story!.woods!.did.EMBER; i++)
    send(r, coco);
  expect(r.state.story!.woods!.did.EMBER).toBe(true);
  beatMosslings(r);
  r.tick();
  expect(r.state.story!.woods!.step).toBe(woodsSteps.length);

  // The closing scene, then the way on to the clearing opens.
  r.tick();
  expect(r.state.story!.cutscene?.id).toBe("woods-done");
  readOn(r, both);
  expect(woodsObjective(r.state.story, "OATH")).toContain("E at the trail");
  r.state.serverTick += 120;
  Object.assign(coco, maps.PROLOGUE_WOODS.points.exit);
  send(r, coco, { interactHeld: true });
  expect(r.state.sceneId).toBe("PROLOGUE_CLEARING");
  expect(r.state.story!.stage).toBe("AMBUSH");
  // Practice is over: the clearing's floor is the ambush's, not the woods'.
  expect(sieg.hp).toBe(sieg.maxHp);
});

it("brings each lesson's mosslings only once its scene has been read", () => {
  const { r, sieg, coco } = intoWoods();
  readOn(r, [sieg, coco]);
  r.tick();
  expect(r.state.story!.cutscene?.id).toBe("woods-attack");
  expect(cutscenes["woods-attack"].hold).toBe(true);
  for (let i = 0; i < 30; i++) r.tick();
  expect(lessonMosslings(r)).toHaveLength(0);
  expect(woodsLesson(r.state.story)).toBeUndefined();
  readOn(r, [sieg, coco]);
  r.tick();
  expect(lessonMosslings(r).map((e) => e.type)).toEqual(
    woodsMosslings.attack.map(() => "mossling"),
  );
});

it("plays through from the trail to the clearing with every lesson", () => {
  const { r, sieg, coco } = intoWoods();
  clearWoods(r, sieg, coco);
  expect(r.state.story!.flags).toEqual(
    expect.arrayContaining([
      "prologue.woods",
      ...woodsSteps.map((s) => `prologue.woods-${s}`),
      WOODS_CRATE_FLAG,
      "prologue.woods-done",
    ]),
  );
});
