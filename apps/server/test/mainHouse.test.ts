import { it, expect } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { move } from "../../../packages/shared/src/movement.js";
it("starts both heroes at the house, transitions only on server-accepted nearby interaction, and spawns the forest encounter", () => {
  const r = new GameRoom("HOU234"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
  expect(r.state.enemies).toEqual({});
  const p = r.state.players[a.playerId],
    session = r.sessions.get(p.id)!;
  session.input = { ...neutral(1), interactHeld: true };
  session.received = Date.now();
  r.tick();
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
  p.x = maps.MAIN_HOUSE.points.exit.x;
  p.y = maps.MAIN_HOUSE.points.exit.y;
  const revision = r.state.worldRevision;
  r.tick();
  expect(r.state.sceneId).toBe("FOREST_RUINS");
  expect(r.state.worldRevision).toBe(revision + 1);
  expect(Object.keys(r.state.enemies)).toHaveLength(4);
  expect(r.state.players[b.playerId].x).toBe(maps.FOREST_RUINS.spawn.x + 50);
  expect(p.skillPoints).toBe(1);
  expect(r.state.puzzles.gate.complete).toBe(false);
  r.reset();
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
});
it("shares house collision with prediction and leaves the exit reachable", () => {
  const r = new GameRoom("HOU234"),
    s = r.add("a"),
    p = r.state.players[s.playerId];
  p.x = 432;
  p.y = 410;
  move(
    p,
    { ...neutral(), moveY: -1 },
    maps.MAIN_HOUSE,
    collisionRects("MAIN_HOUSE", {}),
    0.2,
  );
  expect(p.y).toBe(393);
  p.x = 780;
  p.y = 500;
  move(
    p,
    { ...neutral(), moveX: 1 },
    maps.MAIN_HOUSE,
    collisionRects("MAIN_HOUSE", {}),
    0.15,
  );
  expect(p.x).toBeGreaterThan(800);
});
