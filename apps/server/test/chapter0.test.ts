import { expect, it } from "vitest";
import { io } from "socket.io-client";
import { GameRoom } from "../src/GameRoom.js";
import { createApp } from "../src/app.js";
import { startCutscene, type StoryHost } from "../src/prologue.js";
import { collisionRects, maps } from "../../../packages/shared/src/maps.js";
import {
  neutral,
  type InputFrame,
  type Player,
} from "../../../packages/shared/src/gameTypes.js";
import {
  aldenAtShop,
  aldenGrave,
  graveVisible,
} from "../../../packages/shared/src/prologue.js";
import { oldTree } from "../../../packages/shared/src/environmentSolids.js";
import {
  BURIAL_FLAG,
  CLUES,
  FUNERAL,
  JOURNAL_FLAGS,
  SHRINE_QUEST,
  villagerLines,
  aldenFallen,
  chapter0Cutscenes,
  cocoKneel,
  flowerSpots,
  graveFront,
  stoneSpots,
  storySpots,
  offstageFor,
  shopDoor,
  strangerOnRoad,
} from "../../../packages/shared/src/chapter0.js";
import { npcs, npcPose } from "../../../packages/shared/src/npcs.js";
import { stallSolids, storyProps } from "../../../packages/shared/src/storyProps.js";

// Chapter 0, Part 1 (Phase 2): Coco's errand and her homecoming.

function pair() {
  const r = new GameRoom("CH0", false, "MAIN_HOUSE", true),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  return {
    r,
    sieg: r.state.players[a.playerId],
    coco: r.state.players[b.playerId],
  };
}
const host = (r: GameRoom) =>
  (r as unknown as { storyHost: StoryHost }).storyHost;
function input(r: GameRoom, id: string, frame: Partial<InputFrame> = {}) {
  const s = r.sessions.get(id)!;
  s.input = { ...neutral(s.input.seq + 1), ...frame };
  s.received = Date.now();
  r.tick();
  settle(r);
}
/** Let heroes the story is walking into place arrive (the scene then starts). */
function settle(r: GameRoom) {
  for (
    let i = 0;
    i < 60 * 8 && r.state.story?.cutscene?.line === -1;
    i++
  )
    r.tick();
}
function readScene(r: GameRoom, players: Player[], id: string) {
  for (
    let guard = 0;
    r.state.story?.cutscene?.id === id && guard < 200;
    guard++
  ) {
    settle(r);
    const run = r.state.story.cutscene;
    for (const p of players) r.readStoryLine(p.id, run.id, run.line);
  }
}
const press = (r: GameRoom, p: Player, point: { x: number; y: number }) => {
  Object.assign(p, point);
  input(r, p.id, { interactHeld: true });
  input(r, p.id, { interactHeld: false });
};
/** The prologue's last morning, then the errand's opening narration. */
function toErrand() {
  const room = pair(),
    { r, sieg, coco } = room;
  r.state.story!.stage = "HOME";
  startCutscene(r.state, "morning", host(r));
  readScene(r, [sieg, coco], "morning");
  readScene(r, [coco], "errand");
  r.state.serverTick += 120;
  return room;
}
/** Coco steps up to a villager and presses E. */
function talk(r: GameRoom, coco: Player, npcId: string) {
  const npc = npcs.find((n) => n.id === npcId)!;
  const pose = npcPose(npc, r.state.serverTick, r.state);
  Object.assign(coco, {
    sceneId: npc.scene,
    x: pose.x + 20,
    y: pose.y,
  });
  return r.talkToNpc(coco.id, npcId, true);
}
const counts = (r: GameRoom) => ({ ...r.state.inventory!.counts });

it("sends Coco on her errand while Sieg waits at home, watching", () => {
  const { r, sieg, coco } = toErrand();
  expect(r.state.story!.stage).toBe("ERRAND");
  expect(sieg.sceneId).toBe("VILLAGE_COTTAGE_UPPER");
  expect(coco.sceneId).toBe("MAIN_HOUSE");
  // Sieg is offstage: his input does nothing, Coco's moves her.
  const at = { x: sieg.x, y: sieg.y };
  for (let i = 0; i < 10; i++) input(r, sieg.id, { moveX: 1 });
  expect({ x: sieg.x, y: sieg.y }).toEqual(at);
  const x = coco.x;
  for (let i = 0; i < 10; i++) input(r, coco.id, { moveX: 1 });
  expect(coco.x).toBeGreaterThan(x);
  // Even dragged somewhere else, the story puts him back home.
  Object.assign(sieg, { sceneId: "MAIN_HOUSE", x: 400, y: 480 });
  input(r, coco.id);
  expect(sieg.sceneId).toBe("VILLAGE_COTTAGE_UPPER");
});

it("lets Coco walk to Emberbrook and back on her own, with the north road closed", () => {
  const { r, sieg, coco } = toErrand();
  press(r, coco, maps.MAIN_HOUSE.points.exit);
  expect(coco.sceneId).toBe("EMBERBROOK_VILLAGE");
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
  expect(sieg.sceneId).toBe("VILLAGE_COTTAGE_UPPER");
  // The shrine road waits for the end of Chapter 0.
  r.state.serverTick += 120;
  press(r, coco, maps.EMBERBROOK_VILLAGE.points.exit);
  expect(coco.sceneId).toBe("EMBERBROOK_VILLAGE");
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
  // Sieg's house is shut while he is upstairs.
  press(
    r,
    coco,
    maps.EMBERBROOK_VILLAGE.points.door_cottage,
  );
  expect(coco.sceneId).toBe("EMBERBROOK_VILLAGE");
  // Back down the west road, alone.
  press(r, coco, maps.EMBERBROOK_VILLAGE.points.back);
  expect(coco.sceneId).toBe("MAIN_HOUSE");
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
});

it("buys each item once, through real conversations, and only Coco can", () => {
  const { r, sieg, coco } = toErrand();
  // Sieg is offstage: he cannot start the errand's conversations.
  Object.assign(sieg, { sceneId: "EMBERBROOK_VILLAGE" });
  expect(r.state.story!.cutscene).toBeUndefined();
  input(r, coco.id);
  expect(talk(r, coco, "healer")).toEqual({ talking: false, story: true });
  expect(r.state.story!.cutscene?.id).toBe("errand-brynn");
  // Coco is held for the conversation; Sieg cannot read it.
  expect(r.readStoryLine(sieg.id, "errand-brynn", 0).accepted).toBe(false);
  readScene(r, [coco], "errand-brynn");
  expect(counts(r)).toMatchObject({ moonleaf: 1 });
  // Talking to Brynn again is an ordinary chat: no second bundle.
  expect(talk(r, coco, "healer")).toEqual({ talking: true });
  r.talkToNpc(coco.id, "healer", false);
  expect(counts(r)).toMatchObject({ moonleaf: 1 });
  expect(r.state.story!.stage).toBe("ERRAND");
  talk(r, coco, "shopkeeper");
  readScene(r, [coco], "errand-store");
  expect(counts(r)).toMatchObject({ crystal_vial: 2, candlewick: 1 });
  expect(r.state.story!.stage).toBe("ERRAND");
  talk(r, coco, "baker");
  readScene(r, [coco], "errand-bakery");
  expect(counts(r)).toEqual({
    moonleaf: 1,
    crystal_vial: 2,
    candlewick: 1,
    fresh_bread: 1,
    honey_pastry: 1,
  });
  // The list is complete: the quest closes, and nothing else changes hands.
  input(r, coco.id);
  expect(r.state.story!.cutscene?.id).toBe("errand-done");
  readScene(r, [coco], "errand-done");
  expect(r.state.story!.stage).toBe("HOMEWARD");
  expect(counts(r)).toMatchObject({ moonleaf: 1, crystal_vial: 2 });
  for (const id of ["healer", "shopkeeper", "baker"]) {
    expect(talk(r, coco, id)).toEqual({ talking: true });
    r.talkToNpc(coco.id, id, false);
  }
  expect(counts(r)).toMatchObject({ moonleaf: 1, crystal_vial: 2 });
});

it("turns the stall keepers to Coco, and Coco to them, while they talk", () => {
  const { r, coco } = toErrand();
  input(r, coco.id);
  const keeper = npcs.find((n) => n.id === "shopkeeper")!;
  // Coco comes up from the south: the keeper (who usually faces west) turns
  // south to her, and she faces north to him.
  const at = npcPose(keeper, r.state.serverTick, r.state);
  Object.assign(coco, { sceneId: keeper.scene, x: at.x, y: at.y + 30 });
  r.talkToNpc(coco.id, "shopkeeper", true);
  expect(r.state.story!.cutscene?.id).toBe("errand-store");
  settle(r);
  expect(npcPose(keeper, r.state.serverTick, r.state).facing).toBe("south");
  expect(coco.facing).toBeCloseTo(-Math.PI / 2);
  readScene(r, [coco], "errand-store");
  // Released afterwards: back to the usual pose.
  expect(r.state.npcTalks?.shopkeeper).toBeUndefined();
  expect(npcPose(keeper, r.state.serverTick, r.state).facing).toBe("west");
});

it("cannot bring Coco home early: Papa is fine until the list is done", () => {
  const { r, coco } = toErrand();
  talk(r, coco, "healer");
  readScene(r, [coco], "errand-brynn");
  // Back at the shop with one item: an ordinary visit, Alden at his desk.
  Object.assign(coco, { sceneId: "MAIN_HOUSE", ...shopDoor });
  input(r, coco.id);
  expect(r.state.story!.cutscene).toBeUndefined();
  press(r, coco, maps.MAIN_HOUSE.points.door);
  expect(coco.sceneId).toBe("HOUSE_INTERIOR");
  for (let i = 0; i < 5; i++) input(r, coco.id);
  expect(r.state.story).toMatchObject({ stage: "ERRAND" });
  expect(r.state.story!.alden).toMatchObject({ ...aldenAtShop, action: "idle" });
});

it("plays the homecoming at the door, then lets Coco into the silent shop", () => {
  const { r, sieg, coco } = toErrand();
  for (const [npc, scene] of [
    ["healer", "errand-brynn"],
    ["shopkeeper", "errand-store"],
    ["baker", "errand-bakery"],
  ]) {
    talk(r, coco, npc);
    readScene(r, [coco], scene);
  }
  input(r, coco.id);
  readScene(r, [coco], "errand-done");
  // Alden fell while she was away; nobody saw it.
  expect(r.state.story!.alden).toMatchObject({
    ...aldenFallen,
    action: "wounded",
  });
  // Walking up the garden path to the door starts the homecoming.
  Object.assign(coco, { sceneId: "MAIN_HOUSE", x: 480, y: 470 });
  input(r, coco.id);
  expect(r.state.story!.cutscene).toBeUndefined();
  Object.assign(coco, { x: 480, y: 420 });
  input(r, coco.id);
  expect(r.state.story!.cutscene?.id).toBe("homecoming");
  readScene(r, [coco], "homecoming");
  expect(r.state.story!.stage).toBe("SILENT_SHOP");
  expect(sieg.sceneId).toBe("VILLAGE_COTTAGE_UPPER");
  // Inside the shop is Coco's alone: Sieg no longer watches.
  expect(offstageFor(r.state.story, "OATH")).toMatchObject({ watch: false });
  r.state.serverTick += 120;
  press(r, coco, maps.MAIN_HOUSE.points.door);
  expect(coco.sceneId).toBe("HOUSE_INTERIOR");
  input(r, coco.id);
  expect(r.state.story!.cutscene?.id).toBe("silent");
  readScene(r, [coco], "silent");
  expect(r.state.story!.flags).toContain("chapter0.silent");
  // She can look around, but she does not leave.
  const x = coco.x;
  for (let i = 0; i < 10; i++) input(r, coco.id, { moveX: -1 });
  expect(coco.x).toBeLessThan(x);
  press(r, coco, maps.HOUSE_INTERIOR.spawn);
  expect(coco.sceneId).toBe("HOUSE_INTERIOR");
  // The silent scene never replays.
  for (let i = 0; i < 5; i++) input(r, coco.id);
  expect(r.state.story!.cutscene).toBeUndefined();
});

it("keeps the stalls' keepers and everyone's story spots on clear ground", () => {
  const blocked = (scene: string, p: { x: number; y: number }) =>
    collisionRects(scene as never, {}).some(
      (q) =>
        p.x + 13 > q.x &&
        p.x - 13 < q.x + q.w &&
        p.y + 13 > q.y &&
        p.y - 13 < q.y + q.h,
    );
  for (const id of ["shopkeeper", "baker"]) {
    const npc = npcs.find((n) => n.id === id)!;
    expect(blocked(npc.scene, npc.route[0])).toBe(false);
  }
  for (const scene of Object.values(chapter0Cutscenes))
    for (const at of Object.values(scene.placement))
      expect(blocked(at.scene ?? scene.scene, at)).toBe(false);
  // Each stall stands on its footprint.
  for (const [i, id] of ["stall-general", "stall-bakery"].entries()) {
    const prop = storyProps.find((p) => p.id === id)!,
      solid = stallSolids[i];
    expect(solid.x).toBeGreaterThanOrEqual(prop.x);
    expect(solid.y + solid.h).toBeLessThanOrEqual(prop.groundY + 8);
  }
});

it("runs the errand's conversations over real sockets", async () => {
  const app = createApp({ prologue: true });
  await new Promise<void>((done) => app.http.listen(0, "127.0.0.1", done));
  const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
  const sockets = [0, 1].map(() => io(url, { transports: ["websocket"] }));
  const req = (s: (typeof sockets)[number], event: string, data: unknown) =>
    new Promise<any>((resolve, reject) =>
      s
        .timeout(2000)
        .emit(event, data, (err: any, result: any) =>
          err ? reject(err) : resolve(result),
        ),
    );
  try {
    await Promise.all(
      sockets.map((s) => new Promise<void>((done) => s.on("connect", done))),
    );
    const a = (await req(sockets[0], "room:create", {})).data;
    const b = (await req(sockets[1], "room:join", { roomCode: a.roomCode }))
      .data;
    await req(sockets[0], "role:select", { role: "OATH" });
    await req(sockets[1], "role:select", { role: "EMBER" });
    await req(sockets[0], "lobby:ready", { ready: true });
    await req(sockets[1], "lobby:ready", { ready: true });
    const r = app.manager.get(a.roomCode);
    const coco = r.state.players[b.playerId];
    r.state.story!.stage = "HOME";
    startCutscene(r.state, "morning", host(r));
    readScene(r, Object.values(r.state.players), "morning");
    readScene(r, [coco], "errand");
    const brynn = npcs.find((n) => n.id === "healer")!.route[0];
    Object.assign(coco, {
      sceneId: "EMBERBROOK_VILLAGE",
      x: brynn.x + 20,
      y: brynn.y,
    });
    expect(
      (await req(sockets[1], "npc:talk", { npcId: "healer", talking: true }))
        .data,
    ).toEqual({ talking: false, story: true });
    expect(r.state.story!.cutscene?.id).toBe("errand-brynn");
    settle(r); // Coco turns to Brynn, then the first line appears
    // Sieg's client cannot read Coco's conversation along with her.
    expect(
      (await req(sockets[0], "story:read", { cutscene: "errand-brynn", line: 0 }))
        .data,
    ).toEqual({ accepted: false });
    expect(
      (await req(sockets[1], "story:read", { cutscene: "errand-brynn", line: 0 }))
        .data,
    ).toEqual({ accepted: true });
  } finally {
    for (const s of sockets) s.close();
    app.io.close();
    app.http.close();
  }
});

// Phase 3: Alden's last words, the stranger, and the reunion.

/** From the errand to Coco standing in the silent shop, free to look around. */
function toSilentShop() {
  const room = toErrand(),
    { r, coco } = room;
  for (const [npc, scene] of [
    ["healer", "errand-brynn"],
    ["shopkeeper", "errand-store"],
    ["baker", "errand-bakery"],
  ]) {
    talk(r, coco, npc);
    readScene(r, [coco], scene);
  }
  input(r, coco.id);
  readScene(r, [coco], "errand-done");
  Object.assign(coco, { sceneId: "MAIN_HOUSE", x: 480, y: 420 });
  input(r, coco.id);
  readScene(r, [coco], "homecoming");
  r.state.serverTick += 120;
  press(r, coco, maps.MAIN_HOUSE.points.door);
  input(r, coco.id);
  readScene(r, [coco], "silent");
  return room;
}
/** ...through Coco's last moments with Papa, to Sieg setting out. */
function toStranger() {
  const room = toSilentShop(),
    { r, coco } = room;
  Object.assign(coco, { x: aldenFallen.x + 60, y: aldenFallen.y + 20 });
  input(r, coco.id);
  readScene(r, [coco], "discovery");
  readScene(r, [room.sieg], "sets-out");
  r.state.serverTick += 120;
  return room;
}

it("lets Coco find Papa only by going to him, and plays his last words once", () => {
  const { r, sieg, coco } = toSilentShop();
  // Looking around the far side of the shop starts nothing.
  Object.assign(coco, { x: 620, y: 500 });
  for (let i = 0; i < 5; i++) input(r, coco.id);
  expect(r.state.story!.cutscene).toBeUndefined();
  Object.assign(coco, { x: aldenFallen.x + 60, y: aldenFallen.y + 20 });
  input(r, coco.id);
  const story = r.state.story!;
  expect(story.cutscene?.id).toBe("discovery");
  expect(coco).toMatchObject({ x: cocoKneel.x, y: cocoKneel.y });
  // Sieg is at home: he neither sees nor reads any of it.
  expect(sieg.sceneId).toBe("VILLAGE_COTTAGE_UPPER");
  expect(offstageFor(story, "OATH")).toMatchObject({ watch: false });
  expect(r.readStoryLine(sieg.id, "discovery", 0).accepted).toBe(false);
  const lines = chapter0Cutscenes.discovery.lines;
  const at = (cue: string) => lines.findIndex((l) => l.cue === cue);
  // Read up to the dropped bag: it now lies by the workbench.
  while (story.cutscene!.line < at("drop-bag"))
    r.readStoryLine(coco.id, "discovery", story.cutscene!.line);
  expect(story.flags).toContain("chapter0.bag");
  // Healing attempts change nothing: he is still alive, until he is not.
  while (story.cutscene!.line < at("alden-still")) {
    expect(story.alden?.action).toBe("wounded");
    r.readStoryLine(coco.id, "discovery", story.cutscene!.line);
  }
  expect(story.alden).toMatchObject({ ...aldenFallen, action: "still" });
  readScene(r, [coco], "discovery");
  // Alden stays where he lies; the shopping stays in the backpack.
  expect(story.alden).toMatchObject({ ...aldenFallen, action: "still" });
  expect(r.state.inventory!.counts).toMatchObject({
    moonleaf: 1,
    crystal_vial: 2,
    fresh_bread: 1,
  });
  expect(story.flags).toContain("chapter0.last-words");
  // Straight on to Sieg's part: he leaves home; she is waiting on the road.
  expect(story.stage).toBe("STRANGER");
  expect(story.cutscene?.id).toBe("sets-out");
  expect(sieg.sceneId).toBe("EMBERBROOK_VILLAGE");
  expect(story.stranger).toMatchObject(strangerOnRoad);
  // His mother stops to see him off, and he walks over to her.
  settle(r);
  expect(r.state.npcTalks?.mother?.listeners).toEqual([sieg.id]);
  const mother = npcPose(npcs.find((n) => n.id === "mother")!, r.state.serverTick, r.state);
  expect(Math.hypot(sieg.x - mother.x, sieg.y - mother.y)).toBeLessThan(40);
  readScene(r, [sieg], "sets-out");
  expect(r.state.npcTalks?.mother).toBeUndefined();
  // Coco stays beside Papa while Sieg's part plays.
  for (let i = 0; i < 10; i++) input(r, coco.id, { moveX: 1 });
  expect(coco).toMatchObject({ sceneId: "HOUSE_INTERIOR", x: cocoKneel.x });
  // It never plays again.
  for (let i = 0; i < 5; i++) input(r, sieg.id);
  expect(story.flags.filter((f) => f === "chapter0.last-words")).toHaveLength(1);
});

it("never lets Sieg into the shop before he has run there himself", () => {
  const { r, sieg } = toStranger();
  // Even standing at the door, the shop stays shut during his part.
  Object.assign(sieg, { sceneId: "MAIN_HOUSE" });
  press(r, sieg, maps.MAIN_HOUSE.points.door);
  expect(sieg.sceneId).toBe("MAIN_HOUSE");
  expect(r.state.story!.stage).toBe("STRANGER");
});

it("has the stranger warn Sieg of a fire that isn't there, then vanish", () => {
  const { r, sieg, coco } = toStranger();
  const story = r.state.story!;
  // She waits at Emberbrook's west entrance, on the road to the shop.
  expect(story.stranger).toMatchObject(strangerOnRoad);
  expect(sieg.sceneId).toBe("EMBERBROOK_VILLAGE");
  for (let i = 0; i < 80 && !story.cutscene; i++)
    input(r, sieg.id, { moveX: -1 });
  expect(story.cutscene?.id).toBe("stranger");
  expect(r.readStoryLine(coco.id, "stranger", 0).accepted).toBe(false);
  readScene(r, [sieg], "stranger");
  expect(story.stage).toBe("RUSHING");
  // In town he only runs: she is still standing there.
  expect(story.stranger).toBeDefined();
  r.state.serverTick += 120;
  press(r, sieg, maps.EMBERBROOK_VILLAGE.points.back);
  expect(sieg.sceneId).toBe("MAIN_HOUSE");
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
  expect(story.cutscene).toBeUndefined();
  // Out on the road to the shop, he wonders, and glances back: gone.
  for (let i = 0; i < 80 && !story.cutscene; i++)
    input(r, sieg.id, { moveX: -1 });
  expect(story.cutscene?.id).toBe("glance");
  expect(sieg.sceneId).toBe("MAIN_HOUSE");
  readScene(r, [sieg], "glance");
  expect(story.stranger).toBeUndefined();
  // No smoke, no fire, no answer.
  Object.assign(sieg, { x: 480, y: 420 });
  input(r, sieg.id);
  expect(story.cutscene?.id).toBe("no-fire");
  readScene(r, [sieg], "no-fire");
  expect(story.stage).toBe("FINDING");
  expect(coco).toMatchObject({ sceneId: "HOUSE_INTERIOR", x: cocoKneel.x });
});

it("brings them together inside, with Sieg's memory his alone", () => {
  const { r, sieg, coco } = toStranger();
  const story = r.state.story!;
  Object.assign(sieg, { sceneId: "MAIN_HOUSE", x: 480, y: 470 });
  story.stage = "RUSHING";
  story.flags.push("chapter0.stranger", "chapter0.glance");
  delete story.stranger;
  Object.assign(sieg, { x: 480, y: 420 });
  input(r, sieg.id);
  readScene(r, [sieg], "no-fire");
  r.state.serverTick += 120;
  press(r, sieg, maps.MAIN_HOUSE.points.door);
  expect(sieg.sceneId).toBe("HOUSE_INTERIOR");
  input(r, sieg.id);
  expect(story.cutscene?.id).toBe("reunion");
  // Both are in this scene; either one moves a shared line on.
  expect(r.readStoryLine(coco.id, "reunion", 0).accepted).toBe(true);
  expect(r.readStoryLine(sieg.id, "reunion", 1).accepted).toBe(true);
  const lines = chapter0Cutscenes.reunion.lines;
  const memory = lines.findIndex((l) => l.memory);
  while (story.cutscene!.line < memory)
    r.readStoryLine(coco.id, "reunion", story.cutscene!.line);
  // The memory is Sieg's: Coco cannot move it on.
  expect(r.readStoryLine(coco.id, "reunion", memory).accepted).toBe(false);
  expect(r.readStoryLine(sieg.id, "reunion", memory).accepted).toBe(true);
  readScene(r, [sieg, coco], "reunion");
  // Then the night passes: the next day begins outside.
  expect(story.stage).toBe("MOURNING");
  expect(story.cutscene?.id).toBe("next-day");
  readScene(r, [sieg, coco], "next-day");
  expect(story.stage).toBe("FUNERAL_PREP");
  expect(story.flags).toEqual(
    expect.arrayContaining([
      "chapter0.last-words",
      "chapter0.sets-out",
      "chapter0.reunion",
    ]),
  );
  // Nobody is offstage any more; both can move.
  const x = sieg.x;
  for (let i = 0; i < 10; i++) input(r, sieg.id, { moveX: 1 });
  expect(sieg.x).toBeGreaterThan(x);
});

it("waits through a disconnect in the middle of Papa's last words", () => {
  const { r, sieg, coco } = toSilentShop();
  Object.assign(coco, { x: aldenFallen.x + 60, y: aldenFallen.y + 20 });
  input(r, coco.id);
  r.readStoryLine(coco.id, "discovery", 0);
  expect(r.state.story!.cutscene).toMatchObject({ id: "discovery", line: 1 });
  r.disconnect(sieg.id);
  expect(r.readStoryLine(coco.id, "discovery", 1).accepted).toBe(true);
  for (let i = 0; i < 300; i++) r.tick();
  expect(r.state.story!.cutscene).toMatchObject({ id: "discovery", line: 1 });
  r.resume(sieg.id, r.sessions.get(sieg.id)!.token, "a2");
  expect(r.state.story!.cutscene).toMatchObject({ id: "discovery", line: 1 });
  r.readStoryLine(coco.id, "discovery", 1);
  expect(r.state.story!.cutscene!.line).toBe(2);
});

it("never sends a hero back to a spot they have already walked past", () => {
  const { r, sieg } = toStranger();
  const story = r.state.story!;
  story.stage = "RUSHING";
  story.flags.push("chapter0.stranger");
  delete story.stranger;
  r.state.serverTick += 120;
  press(r, sieg, maps.EMBERBROOK_VILLAGE.points.back);
  expect(sieg.sceneId).toBe("MAIN_HOUSE");
  // Sieg runs well past the glance's mark before the scene catches up.
  Object.assign(sieg, { x: 560, y: 494 });
  input(r, sieg.id, { moveX: -1 });
  expect(story.cutscene?.id).toBe("glance");
  // He stops where he was, past the mark (624), and is never moved back.
  expect(sieg.x).toBeLessThanOrEqual(560);
  expect(sieg.x).toBeGreaterThan(540);
});

// Phase 4: the funeral beneath the old tree.

/** From the night after the reunion to the next day's preparations. */
function toFuneralPrep() {
  const room = pair(),
    { r, sieg, coco } = room;
  const story = r.state.story!;
  story.stage = "MOURNING";
  story.flags.push("chapter0.silent", "chapter0.bag", "chapter0.reunion");
  story.alden = { ...aldenFallen, action: "still" };
  startCutscene(r.state, "next-day", host(r));
  readScene(r, [sieg, coco], "next-day");
  r.state.serverTick += 120;
  return room;
}
const at = (r: GameRoom, p: Player, spot: { x: number; y: number }) =>
  press(r, p, { x: spot.x, y: spot.y });

it("brings the next day: both outside, Papa at rest, Sieg's old sword with him", () => {
  const { r, sieg, coco } = toFuneralPrep();
  const story = r.state.story!;
  expect(story.stage).toBe("FUNERAL_PREP");
  expect(story.alden).toBeUndefined();
  expect([sieg.sceneId, coco.sceneId]).toEqual(["MAIN_HOUSE", "MAIN_HOUSE"]);
  expect(r.state.inventory!.counts.wooden_sword).toBe(1);
  // Nobody is held: they go about it in their own time.
  const x = sieg.x;
  for (let i = 0; i < 10; i++) input(r, sieg.id, { moveX: 1 });
  expect(sieg.x).toBeGreaterThan(x);
});

it("prepares the grave together: each gathers their own, once", () => {
  const { r, sieg, coco } = toFuneralPrep();
  const story = r.state.story!,
    counts = () => r.state.inventory!.counts;
  // Coco cannot take Sieg's stones; Sieg cannot pick Coco's flowers.
  at(r, coco, stoneSpots[0]);
  at(r, sieg, flowerSpots[0]);
  expect(counts().river_stone ?? 0).toBe(0);
  expect(counts().wildflowers ?? 0).toBe(0);
  // The stones cannot be laid before they are gathered.
  at(r, sieg, graveFront);
  expect(story.flags).not.toContain(FUNERAL.siteReady);
  for (const s of stoneSpots) {
    at(r, sieg, s);
    at(r, sieg, s); // a second press takes nothing more
  }
  expect(counts().river_stone).toBe(3);
  for (const s of flowerSpots) {
    at(r, coco, s);
    at(r, coco, s);
  }
  expect(counts().wildflowers).toBe(3);
  // Coco cannot say she's ready until the grave is prepared.
  at(r, coco, graveFront);
  expect(story.flags).not.toContain("chapter0.ready-EMBER");
  at(r, sieg, graveFront);
  expect(story.flags).toContain(FUNERAL.siteReady);
  expect(counts().river_stone).toBe(0);
  // One hero ready is not enough; both, and the funeral begins.
  at(r, sieg, graveFront);
  expect(story.cutscene).toBeUndefined();
  at(r, coco, graveFront);
  expect(story.cutscene?.id).toBe("funeral");
});

it("lays Papa to rest with Coco's flowers and Sieg's sword, and keeps them there", () => {
  const { r, sieg, coco } = toFuneralPrep();
  const story = r.state.story!;
  for (const s of stoneSpots) at(r, sieg, s);
  for (const s of flowerSpots) at(r, coco, s);
  at(r, sieg, graveFront);
  at(r, sieg, graveFront);
  at(r, coco, graveFront);
  settle(r);
  expect(story.cutscene).toMatchObject({ id: "funeral", line: 0 });
  // The first line lays him to rest: the grave is there.
  expect(story.flags).toContain(BURIAL_FLAG);
  const lines = chapter0Cutscenes.funeral.lines;
  const flowers = lines.findIndex((l) => l.setFlag === FUNERAL.flowers),
    sword = lines.findIndex((l) => l.setFlag === FUNERAL.sword);
  while (story.cutscene!.line < flowers)
    r.readStoryLine(coco.id, "funeral", story.cutscene!.line);
  expect(story.flags).toContain(FUNERAL.flowers);
  expect(r.state.inventory!.counts.wildflowers).toBe(0);
  expect(story.flags).not.toContain(FUNERAL.sword);
  while (story.cutscene!.line < sword)
    r.readStoryLine(sieg.id, "funeral", story.cutscene!.line);
  expect(story.flags).toContain(FUNERAL.sword);
  expect(r.state.inventory!.counts.wooden_sword).toBe(0);
  readScene(r, [sieg, coco], "funeral");
  expect(story.stage).toBe("INVESTIGATION");
  expect(story.flags).toContain(FUNERAL.done);
  // What the funeral left stays, for both, across a reconnect.
  const shown = (id: string) =>
    storyProps.find((p) => p.id === id)!.shown!(r.state.story);
  r.disconnect(coco.id);
  r.resume(coco.id, r.sessions.get(coco.id)!.token, "b2");
  for (const id of [
    "grave-stone-1",
    "grave-stone-2",
    "grave-stone-3",
    "grave-flowers",
    "grave-sword",
  ])
    expect(shown(id)).toBe(true);
  expect(shown("grave-site")).toBe(false);
  expect(shown("shop-book-1")).toBe(false); // the shop has been put right
  expect(shown("shop-bag")).toBe(false);
  expect(graveVisible(r.state.story)).toBe(true);
  // The regular campaign (no story) shows the grave as the funeral left it.
  for (const id of ["grave-flowers", "grave-sword", "grave-stone-1"])
    expect(storyProps.find((p) => p.id === id)!.shown!(undefined)).toBe(true);
  // Nothing replays: E at the grave does nothing more.
  at(r, sieg, graveFront);
  at(r, coco, graveFront);
  expect(story.cutscene).toBeUndefined();
});

it("gives the grave clear ground beneath one old tree", () => {
  const tree = storyProps.find((p) => p.id === "old-tree")!;
  expect(tree.shown).toBeUndefined(); // always there, story or not
  expect(maps.MAIN_HOUSE.walls).toContainEqual(oldTree.footprint);
  // Nothing solid around the grave but the old tree's trunk.
  const around = { x: 20, y: 340, w: 180, h: 110 };
  const crowding = collisionRects("MAIN_HOUSE", {}).filter(
    (q) =>
      q !== oldTree.footprint &&
      q.x < around.x + around.w &&
      q.x + q.w > around.x &&
      q.y < around.y + around.h &&
      q.y + q.h > around.y,
  );
  expect(crowding).toEqual([]);
  // The keepsakes are drawn in front of the grave, and the sword is big
  // enough to read at a glance (twice the item icon's 20px height).
  for (const id of ["grave-flowers", "grave-sword", "grave-stone-3"])
    expect(storyProps.find((p) => p.id === id)!.groundY).toBeGreaterThan(
      aldenGrave.groundY,
    );
  expect(storyProps.find((p) => p.id === "grave-sword")!.scale).toBe(2);
});

it("keeps every funeral spot and mark on clear ground", () => {
  const blocked = (p: { x: number; y: number }) =>
    collisionRects("MAIN_HOUSE", {}).some(
      (q) =>
        p.x + 13 > q.x &&
        p.x - 13 < q.x + q.w &&
        p.y + 13 > q.y &&
        p.y - 13 < q.y + q.h,
    );
  for (const s of storySpots)
    expect(
      collisionRects(s.scene, {}).some(
        (q) =>
          s.x + 13 > q.x &&
          s.x - 13 < q.x + q.w &&
          s.y + 13 > q.y &&
          s.y - 13 < q.y + q.h,
      ),
      s.id,
    ).toBe(false);
  expect(blocked(graveFront)).toBe(false);
});

// Phase 5: the investigation in Emberbrook, and Alden's hidden journal.

/** The day after the funeral, both heroes in Emberbrook. */
function toInvestigation() {
  const room = pair(),
    { r, sieg, coco } = room;
  const story = r.state.story!;
  story.stage = "INVESTIGATION";
  story.flags.push(
    "chapter0.last-words",
    BURIAL_FLAG,
    FUNERAL.flowers,
    FUNERAL.sword,
    FUNERAL.done,
  );
  delete story.alden;
  for (const [p, x] of [
    [sieg, 600],
    [coco, 640],
  ] as const)
    Object.assign(p, { sceneId: "EMBERBROOK_VILLAGE", x, y: 560 });
  r.state.serverTick += 120;
  return room;
}
/** This hero steps up to a villager and asks; returns the server's answer. */
function ask(r: GameRoom, p: Player, npcId: string) {
  const npc = npcs.find((n) => n.id === npcId)!;
  const pose = npcPose(npc, r.state.serverTick, r.state);
  Object.assign(p, { sceneId: npc.scene, x: pose.x + 24, y: pose.y + 8 });
  return r.talkToNpc(p.id, npcId, true);
}

it("lets either hero start each conversation, in any order, with both taking part", () => {
  const { r, sieg, coco } = toInvestigation();
  const story = r.state.story!;
  // Coco asks the merchant; Sieg, nearby, walks over to stand beside her.
  expect(ask(r, coco, "merchant")).toEqual({ talking: false, story: true });
  expect(story.cutscene?.id).toBe("ask-merchant");
  expect(r.state.npcTalks?.merchant?.listeners.sort()).toEqual(
    [sieg.id, coco.id].sort(),
  );
  settle(r);
  // Both are at the merchant: Coco where she asked, Sieg walked across.
  const merchant = npcPose(
    npcs.find((n) => n.id === "merchant")!,
    r.state.serverTick,
    r.state,
  );
  expect(Math.hypot(coco.x - merchant.x, coco.y - merchant.y)).toBeLessThan(40);
  expect(Math.hypot(sieg.x - coco.x, sieg.y - coco.y)).toBeLessThan(60);
  expect(r.state.sceneId).toBe("MAIN_HOUSE"); // the party never moved
  // Both are in the conversation: either moves it on.
  // The merchant turns to whichever hero is speaking.
  const lines = chapter0Cutscenes["ask-merchant"].lines;
  expect(lines[0].speaker).toBe("SIEG");
  expect(r.state.npcTalks?.merchant?.listeners[0]).toBe(sieg.id);
  expect(r.readStoryLine(sieg.id, "ask-merchant", 0).accepted).toBe(true);
  expect(r.readStoryLine(coco.id, "ask-merchant", 1).accepted).toBe(true);
  const coco3 = lines.findIndex((l, i) => i > 1 && l.speaker === "COCO");
  if (coco3 > 0) {
    while (story.cutscene!.line < coco3)
      r.readStoryLine(sieg.id, "ask-merchant", story.cutscene!.line);
    expect(r.state.npcTalks?.merchant?.listeners[0]).toBe(coco.id);
  }
  readScene(r, [sieg, coco], "ask-merchant");
  expect(story.flags).toContain(CLUES.merchant);
  expect(r.state.npcTalks?.merchant).toBeUndefined();
  // Asked once is enough: the merchant is back to ordinary talk.
  expect(ask(r, sieg, "merchant")).toEqual({ talking: true });
  r.talkToNpc(sieg.id, "merchant", false);
  // Sieg asks Bertram while Coco is inside the apothecary: she is brought out.
  Object.assign(coco, { sceneId: "VILLAGE_APOTHECARY", x: 368, y: 444 });
  ask(r, sieg, "elder");
  expect(story.cutscene?.id).toBe("ask-bertram");
  expect(coco.sceneId).toBe("EMBERBROOK_VILLAGE");
  readScene(r, [sieg, coco], "ask-bertram");
  expect(story.stage).toBe("INVESTIGATION");
  // The last one, and the investigation closes.
  ask(r, coco, "healer");
  readScene(r, [sieg, coco], "ask-brynn");
  input(r, coco.id);
  expect(story.cutscene?.id).toBe("clues-done");
  readScene(r, [sieg, coco], "clues-done");
  expect(story.stage).toBe("JOURNAL");
  for (const flag of Object.values(CLUES))
    expect(story.flags.filter((f) => f === flag)).toHaveLength(1);
});

it("has the village speak differently once Alden is gone", () => {
  const { r } = toInvestigation();
  const mother = npcs.find((n) => n.id === "mother")!;
  expect(villagerLines("mother", mother.lines, undefined)).toEqual(
    mother.lines,
  );
  expect(villagerLines("mother", mother.lines, r.state.story)).not.toEqual(
    mother.lines,
  );
});

it("opens Papa's locked compartment together, and finds what he hid once", () => {
  const { r, sieg, coco } = toInvestigation();
  const story = r.state.story!,
    counts = () => r.state.inventory!.counts;
  story.stage = "JOURNAL";
  for (const p of [sieg, coco])
    Object.assign(p, { sceneId: "HOUSE_INTERIOR", x: 600, y: 500 });
  const forceDrawer = storySpots.find((s) => s.id === "force-drawer")!,
    undoSeal = storySpots.find((s) => s.id === "undo-seal")!;
  // Each part is the right hero's; one part alone opens nothing.
  at(r, coco, forceDrawer);
  expect(story.flags).not.toContain(JOURNAL_FLAGS.drawer);
  at(r, sieg, forceDrawer);
  expect(story.flags).toContain(JOURNAL_FLAGS.drawer);
  expect(story.cutscene).toBeUndefined();
  at(r, coco, undoSeal);
  expect(story.cutscene?.id).toBe("journal");
  settle(r);
  // Inside: the journal, the cloth and the drawing, once.
  expect(counts()).toMatchObject({
    alden_journal: 1,
    strange_cloth: 1,
    star_drawing: 1,
  });
  readScene(r, [sieg, coco], "journal");
  expect(story.stage).toBe("DECISION");
  at(r, sieg, forceDrawer);
  at(r, coco, undoSeal);
  expect(story.cutscene).toBeUndefined();
  expect(counts()).toMatchObject({
    alden_journal: 1,
    strange_cloth: 1,
    star_drawing: 1,
  });
});

// Phase 6: the road ahead.

it("decides by the old tree, unlocks the Forgotten Shrine once, and opens the road north", () => {
  const { r, sieg, coco } = toInvestigation();
  const story = r.state.story!;
  story.stage = "DECISION";
  story.flags.push(JOURNAL_FLAGS.found);
  for (const p of [sieg, coco])
    Object.assign(p, { sceneId: "MAIN_HOUSE", x: 700, y: 500 });
  input(r, sieg.id);
  expect(story.cutscene).toBeUndefined();
  // Coco walks up to the grave first: she stays, Sieg comes over.
  Object.assign(coco, { x: graveFront.x + 60, y: graveFront.y + 20 });
  input(r, coco.id);
  expect(story.cutscene?.id).toBe("decision");
  settle(r);
  expect(Math.hypot(coco.x - (graveFront.x + 60), coco.y - (graveFront.y + 20))).toBeLessThan(4);
  expect(sieg.sceneId).toBe("MAIN_HOUSE");
  readScene(r, [sieg, coco], "decision");
  // The finale picks up on the road north (chapter0Finale.test.ts).
  expect(story.stage).toBe("SHRINE_ROAD");
  expect(story.flags.filter((f) => f === SHRINE_QUEST)).toHaveLength(1);
  // Back at the grave, nothing replays.
  Object.assign(coco, { x: graveFront.x, y: graveFront.y });
  for (let i = 0; i < 5; i++) input(r, coco.id);
  expect(story.cutscene).toBeUndefined();
  expect(story.flags.filter((f) => f === SHRINE_QUEST)).toHaveLength(1);
  // The road: to Emberbrook together, and north out of it toward the shrine.
  r.state.serverTick += 120;
  Object.assign(sieg, maps.MAIN_HOUSE.points.exit);
  input(r, sieg.id, { interactHeld: true });
  input(r, sieg.id, { interactHeld: false });
  expect(r.state.sceneId).toBe("EMBERBROOK_VILLAGE");
  r.state.serverTick += 120;
  Object.assign(sieg, maps.EMBERBROOK_VILLAGE.points.exit);
  input(r, sieg.id, { interactHeld: true });
  input(r, sieg.id, { interactHeld: false });
  expect(r.state.sceneId).toBe("TRANSITION_TRAIL");
  // The grave stays dressed as the funeral left it.
  expect(graveVisible(story)).toBe(true);
});

it("plays the decision whichever hero reaches the tree first", () => {
  const { r, sieg, coco } = toInvestigation();
  const story = r.state.story!;
  story.stage = "DECISION";
  Object.assign(coco, { sceneId: "HOUSE_INTERIOR", x: 600, y: 500 });
  Object.assign(sieg, { sceneId: "MAIN_HOUSE", x: graveFront.x + 40, y: graveFront.y });
  input(r, sieg.id);
  expect(story.cutscene?.id).toBe("decision");
  // Coco, inside the shop, is brought out for it.
  expect(coco.sceneId).toBe("MAIN_HOUSE");
});
