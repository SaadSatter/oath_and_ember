import { it, expect } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { move } from "../../../packages/shared/src/movement.js";
it("starts both heroes at the house and transitions only on server-accepted nearby interaction", () => {
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
  p.x = 700;
  p.y = 500;
  session.input = { ...neutral(1), interactHeld: true };
  session.received = Date.now();
  r.tick();
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
  p.x = maps.MAIN_HOUSE.points.exit.x;
  p.y = maps.MAIN_HOUSE.points.exit.y;
  const revision = r.state.worldRevision;
  r.tick();
  expect(r.state.sceneId).toBe("TRANSITION_TRAIL");
  expect(r.state.worldRevision).toBe(revision + 1);
  expect(Object.keys(r.state.enemies)).toHaveLength(0);
  expect(r.state.players[b.playerId].x).toBe(
    maps.TRANSITION_TRAIL.spawn.x + 50,
  );
  expect(p.skillPoints).toBe(0);
  expect(r.state.puzzles.gate.complete).toBe(false);
  r.reset();
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
});
it("shares house collision with prediction and leaves the exit reachable", () => {
  const r = new GameRoom("HOU234"),
    s = r.add("a"),
    p = r.state.players[s.playerId];
  p.x = 432;
  p.y = 350;
  move(
    p,
    { ...neutral(), moveY: -1 },
    maps.MAIN_HOUSE,
    collisionRects("MAIN_HOUSE", {}),
    0.2,
  );
  expect(p.y).toBe(327);
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
it("offers a playtest shortcut from the starting map straight to the Goddess Shrine", () => {
  const r = new GameRoom("HOU235"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const p = r.state.players[a.playerId],
    session = r.sessions.get(p.id)!;
  const send = (input: object) => {
    session.input = { ...neutral(session.input.seq + 1), ...input };
    session.received = Date.now();
    r.tick();
  };
  // Walk from spawn out of the yard and west to the sign with real movement.
  const shrine = maps.MAIN_HOUSE.points.shrine;
  for (const goal of [{ x: 480, y: 470 }, shrine]) {
    for (let n = 0; n < 2000 && Math.hypot(p.x - goal.x, p.y - goal.y) > 4; n++)
      send({
        moveX: Math.abs(goal.x - p.x) > 2 ? Math.sign(goal.x - p.x) : 0,
        moveY: Math.abs(goal.y - p.y) > 2 ? Math.sign(goal.y - p.y) : 0,
      });
    expect(Math.hypot(p.x - goal.x, p.y - goal.y)).toBeLessThanOrEqual(4);
  }
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
  send({ interactHeld: true });
  expect(r.state.sceneId).toBe("GODDESS_SHRINE");
  expect(r.state.players[b.playerId].sceneId ?? r.state.sceneId).toBe(
    "GODDESS_SHRINE",
  );
});
