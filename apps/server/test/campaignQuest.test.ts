import { it, expect } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import {
  maps,
  postTownRoute,
  previousMap,
} from "../../../packages/shared/src/maps.js";
import {
  neutral,
  type SceneId,
} from "../../../packages/shared/src/gameTypes.js";
import {
  shrinePoints,
  SHRINE_OFFERING,
} from "../../../packages/shared/src/shrine.js";
function setup() {
  const r = new GameRoom("ABC234", false, "FOREST_RUINS"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  return {
    r,
    w: r.state,
    s: r.state.players[a.playerId],
    c: r.state.players[b.playerId],
  };
}
it("requires the completed goddess quest before campaign boarding, then continues normally", () => {
  const { r, w, s, c } = setup();
  w.enemies = {};
  w.puzzles.gate.complete = true;
  w.puzzles.bridge.complete = true;
  Object.assign(s, maps.FOREST_RUINS.points.exit);
  r.tick();
  expect(w.sceneId).toBe("FOREST_RUINS");
  r.transition("GODDESS_SHRINE");
  w.inventory!.counts.griffin_wig = 1;
  Object.assign(c, shrinePoints.offering);
  r.useItem(c.id, {
    requestId: "campaign-offer",
    targetId: SHRINE_OFFERING,
    itemId: "griffin_wig",
  });
  r.transition("FOREST_RUINS", true);
  Object.assign(s, maps.FOREST_RUINS.points.exit);
  r.tick();
  expect(w.sceneId).toBe("AIRSHIP");
  expect(w.inventory!.counts.griffin_wig).toBe(0);
});
it("connects the campaign forest entrance to every hub branch and back using E with shared inventory preserved", () => {
  const { r, w, s } = setup();
  w.enemies = {};
  let seq = 0;
  const use = (point: { x: number; y: number }) => {
    Object.assign(s, point);
    w.serverTick += 31;
    r.receiveInput(s.id, neutral(++seq));
    r.tick();
    r.receiveInput(s.id, { ...neutral(++seq), interactHeld: true });
    r.tick();
  };
  use(maps.FOREST_RUINS.points.shrine);
  expect(w.sceneId).toBe("GODDESS_SHRINE");
  expect(w.inventory!.counts).toEqual({});
  for (const [point, scene] of [
    [shrinePoints.east, "HEDGE_MAZE"],
    [shrinePoints.west, "MIRROR_POND"],
    [shrinePoints.north, "GRIFFIN_ENCLOSURE"],
  ] as const) {
    use(point);
    expect(w.sceneId).toBe(scene);
    expect(w.inventory!.counts).toEqual({});
    use(maps[scene].points.back);
    expect(w.sceneId).toBe("GODDESS_SHRINE");
  }
  use(shrinePoints.back);
  expect(w.sceneId).toBe("BRIDGE_RUINS");
  expect(previousMap.BRIDGE_RUINS).toBe("MONSTER_CLEARING");
  expect(postTownRoute.MONSTER_CLEARING.next).toBe("BRIDGE_RUINS");
  // Return links cover the whole ordinary campaign without replacing the main-house start.
  expect(new GameRoom("DEF234").startingScene).toBe("MAIN_HOUSE");
});

it("puts the shrine directly after Puzzle Map 2 and unlocks its onward route only after the offering", () => {
  const { r, w, s, c } = setup();
  r.transition("BRIDGE_RUINS");
  w.bridgePuzzle!.complete = true;
  Object.assign(s, maps.BRIDGE_RUINS.points.exit);
  r.receiveInput(s.id, { ...neutral(1), interactHeld: true });
  r.tick();
  expect(w.sceneId).toBe("GODDESS_SHRINE");
  expect(previousMap.GODDESS_SHRINE).toBe("BRIDGE_RUINS");
  expect(previousMap.FOREST_RUINS).toBe("GODDESS_SHRINE");
  const use = (point: { x: number; y: number }) => {
    Object.assign(s, point);
    w.serverTick += 31;
    const seq = r.sessions.get(s.id)!.input.seq;
    r.receiveInput(s.id, neutral(seq + 1));
    r.tick();
    r.receiveInput(s.id, { ...neutral(seq + 2), interactHeld: true });
    r.tick();
  };
  use(shrinePoints.exit);
  expect(w.sceneId).toBe("GODDESS_SHRINE");
  w.inventory!.counts.griffin_wig = 1;
  Object.assign(c, shrinePoints.offering);
  r.useItem(c.id, {
    requestId: "finish",
    targetId: SHRINE_OFFERING,
    itemId: "griffin_wig",
  });
  use(shrinePoints.exit);
  expect(w.sceneId).toBe("FOREST_RUINS");
  use(maps.FOREST_RUINS.points.back);
  expect(w.sceneId).toBe("GODDESS_SHRINE");
  use(shrinePoints.back);
  expect(w.sceneId).toBe("BRIDGE_RUINS");
  expect(w.bridgePuzzle!.complete).toBe(true);
});
