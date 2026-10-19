import { expect, it } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { Prediction } from "../../client/src/net/prediction.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { collisionRects, maps } from "../../../packages/shared/src/maps.js";
import {
  storySpots,
  SPOT_REACH,
} from "../../../packages/shared/src/chapter0.js";
import {
  prologueStart,
  cutscenes,
} from "../../../packages/shared/src/prologue.js";

const approaches = [
  {
    name: "well",
    start: { x: 680, y: 270 },
    moveX: 0,
    moveY: 1,
    stop: { x: 680, y: 283 },
  },
  {
    // The rock by the grave is gone; the old tree's trunk stands above it.
    name: "old tree",
    start: { x: 100, y: 362 },
    moveX: 0,
    moveY: -1,
    stop: { x: 100, y: 343 },
  },
  {
    name: "back fence",
    start: { x: 248, y: 215 },
    moveX: 0,
    moveY: -1,
    stop: { x: 248, y: 205 },
  },
  {
    name: "south cairn",
    start: { x: 548, y: 540 },
    moveX: 0,
    moveY: 1,
    stop: { x: 548, y: 557 },
  },
  {
    name: "porch barrel",
    start: { x: 510, y: 360 },
    moveX: 1,
    moveY: 0,
    stop: { x: 525, y: 360 },
  },
];

for (const prologue of [false, true])
  for (const role of ["OATH", "EMBER"] as const)
    it(`blocks ${role} at yard props with matching prediction (prologue=${prologue})`, () => {
      for (const approach of approaches) {
        const room = new GameRoom("YARD01", false, "MAIN_HOUSE", prologue);
        const first = room.add("first");
        const second = room.add("second");
        room.select(first.playerId, role);
        room.select(second.playerId, role === "OATH" ? "EMBER" : "OATH");
        room.ready(first.playerId, true);
        room.ready(second.playerId, true);
        if (room.state.story) room.state.story.stage = "FOREST_BOUND";
        const hero = room.state.players[first.playerId];
        Object.assign(hero, approach.start, { sceneId: "MAIN_HOUSE" });
        room.state.players[second.playerId].sceneId = "HOUSE_UPPER";
        const prediction = new Prediction();
        prediction.reset(hero, room.state.serverTick);
        const session = room.sessions.get(hero.id)!;
        for (let tick = 0; tick < 30; tick++) {
          const input = {
            ...neutral(tick + 1),
            targetTick: room.state.serverTick + 1,
            moveX: approach.moveX,
            moveY: approach.moveY,
          };
          prediction.push(input, room.state);
          session.input = input;
          session.received = Date.now();
          room.tick();
          expect(prediction.player!.x, approach.name).toBeCloseTo(hero.x);
          expect(prediction.player!.y, approach.name).toBeCloseTo(hero.y);
        }
        expect(hero.x, approach.name).toBe(approach.stop.x);
        expect(hero.y, approach.name).toBe(approach.stop.y);
      }
    });

it("keeps the gate, front door, roads and outdoor story marks reachable on foot", () => {
  const walls = collisionRects("MAIN_HOUSE", {});
  const clear = (x: number, y: number) =>
    !walls.some(
      (wall) =>
        x + 13 > wall.x &&
        x - 13 < wall.x + wall.w &&
        y + 13 > wall.y &&
        y - 13 < wall.y + wall.h,
    );
  const step = 4;
  const seen = new Set<string>();
  const queue = [{ x: 480, y: 344 }];
  while (queue.length) {
    const point = queue.pop()!;
    const key = `${point.x},${point.y}`;
    if (
      seen.has(key) ||
      point.x < 13 ||
      point.y < 13 ||
      point.x > maps.MAIN_HOUSE.width - 13 ||
      point.y > maps.MAIN_HOUSE.height - 13 ||
      !clear(point.x, point.y)
    )
      continue;
    seen.add(key);
    queue.push(
      { x: point.x + step, y: point.y },
      { x: point.x - step, y: point.y },
      { x: point.x, y: point.y + step },
      { x: point.x, y: point.y - step },
    );
  }
  const points = [
    maps.MAIN_HOUSE.spawn,
    ...Object.values(maps.MAIN_HOUSE.points),
    ...Object.values(prologueStart).filter(
      (point) => point.scene === "MAIN_HOUSE",
    ),
    ...Object.values(cutscenes).flatMap((scene) =>
      Object.values(scene.placement).filter(
        (point) => (point.scene ?? scene.scene) === "MAIN_HOUSE",
      ),
    ),
  ];
  for (const point of points) {
    expect(clear(point.x, point.y), JSON.stringify(point)).toBe(true);
    expect(
      [...seen].some((key) => {
        const [x, y] = key.split(",").map(Number);
        return Math.hypot(x - point.x, y - point.y) <= 6;
      }),
      JSON.stringify(point),
    ).toBe(true);
  }
  for (const spot of storySpots.filter((spot) => spot.scene === "MAIN_HOUSE"))
    expect(
      [...seen].some((key) => {
        const [x, y] = key.split(",").map(Number);
        return Math.hypot(x - spot.x, y - spot.y) <= SPOT_REACH;
      }),
      spot.id,
    ).toBe(true);
});
