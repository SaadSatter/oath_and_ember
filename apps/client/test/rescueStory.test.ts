import { expect, it } from "vitest";
import { storyView } from "../src/ui/storyDialogue.js";
import { cutscenes } from "../../../packages/shared/src/prologue.js";
import type { World } from "../../../packages/shared/src/gameTypes.js";
import {
  DRAGON_LENGTH,
  castDragon,
  castRoute,
  routeAt,
} from "../../../packages/shared/src/waterDragon.js";

const world = (story: NonNullable<World["story"]>, serverTick = 0) =>
  ({ story, serverTick }) as unknown as World;
const line = (cue: string) =>
  cutscenes.rescue.lines.findIndex((l) => l.cue === cue);

it("holds Alden's entrance until he has walked in, then lets E move it on", () => {
  const alden = {
    scene: "PROLOGUE_CLEARING" as const,
    x: 512,
    y: 120,
    facing: "south" as const,
    action: "walk" as const,
    target: { x: 512, y: 339 },
  };
  const w = world({
    stage: "FIGHT",
    flags: [],
    alden,
    cutscene: { id: "rescue", line: line("alden-enter"), acks: [], since: 0 },
  });
  expect(storyView(w, "OATH")!.held).toBe(true);
  delete w.story!.alden!.target;
  expect(storyView(w, "OATH")!.held).toBe(false);
});

it("holds the dragon's line until it has eaten every monster and burst", () => {
  const prey = [
    { id: "a", x: 330, y: 420 },
    { id: "b", x: 700, y: 420 },
  ];
  const dragon = castDragon(100, { x: 512, y: 384 }, prey);
  const w = world(
    {
      stage: "FIGHT",
      flags: [],
      dragon,
      cutscene: { id: "rescue", line: line("dragon"), acks: [], since: 100 },
    },
    100,
  );
  expect(storyView(w, "EMBER")!.held).toBe(true);
  w.serverTick = dragon.end - 1;
  expect(storyView(w, "EMBER")!.held).toBe(true);
  w.serverTick = dragon.end;
  expect(storyView(w, "EMBER")!.held).toBe(false);
});

it("routes the dragon right through each monster, in order, wrapping the clearing", () => {
  const centre = { x: 512, y: 384 };
  const ring = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return { id: `m${i}`, x: 512 + Math.cos(a) * 190, y: 415 + Math.sin(a) * 130 };
  });
  const cast = castDragon(0, centre, ring),
    route = castRoute(cast);
  // Every bite is later than the one before, and the head is on the monster.
  let last = -1;
  for (const [i, p] of cast.prey.entries()) {
    expect(p.at).toBeGreaterThan(last);
    last = p.at;
    const bite = routeAt(route, route.bites[i]);
    expect(Math.hypot(bite.x - p.x, bite.y - p.y)).toBeLessThan(1);
  }
  // Long enough to coil around the clearing, which the route laps in full.
  expect(DRAGON_LENGTH).toBeGreaterThan(1200);
  const xs = route.points.map((p) => p.x),
    ys = route.points.map((p) => p.y);
  expect(Math.min(...xs)).toBeLessThan(190);
  expect(Math.max(...xs)).toBeGreaterThan(834);
  expect(Math.min(...ys)).toBeLessThan(170);
  expect(Math.max(...ys)).toBeGreaterThan(590);
  // The same cast gives the same route (server and clients agree).
  expect(castRoute(cast)).toEqual(route);
  expect(cast.end).toBeGreaterThan(last);
});
