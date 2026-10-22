import { expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { GameRoom } from "../src/GameRoom.js";
import { createApp } from "../src/app.js";
import { maps } from "../../../packages/shared/src/maps.js";
import {
  neutral,
  type InputFrame,
  type Player,
  type World,
} from "../../../packages/shared/src/gameTypes.js";
import { SHRINE_QUEST } from "../../../packages/shared/src/chapter0.js";
import {
  FINALE,
  finaleCutscenes,
  finaleObjective,
  motivationFlag,
  roadsOpen,
  trialInscription,
  watcherPose,
} from "../../../packages/shared/src/chapter0Finale.js";
import { gladeState } from "../../../packages/shared/src/statueGlade.js";
import { bridgePoints } from "../../../packages/shared/src/bridgePuzzle.js";
import {
  SHRINE_OFFERING,
  shrinePoints,
} from "../../../packages/shared/src/shrine.js";
import type { Result, Session } from "../../../packages/shared/src/protocol.js";

// Chapter 0's finale: the Weeping Angel, the Three Trials, the Bald Goddess,
// her wig, what she remembers, each hero's choice, and the watcher.

/** Two heroes at the "Forgotten Shrine" checkpoint (after the decision). */
function pair() {
  const r = new GameRoom("FIN", false, "MAIN_HOUSE", true, "shrine"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  return {
    r,
    story: r.state.story!,
    sieg: r.state.players[a.playerId],
    coco: r.state.players[b.playerId],
  };
}
function input(r: GameRoom, id: string, frame: Partial<InputFrame> = {}) {
  const s = r.sessions.get(id)!;
  s.input = { ...neutral(s.input.seq + 1), ...frame };
  s.received = Date.now();
  r.tick();
  settle(r);
}
function settle(r: GameRoom) {
  for (let i = 0; i < 60 * 14 && r.state.story?.cutscene?.line === -1; i++)
    r.tick();
}
/** Read a scene to its end (choosing lines are answered by `choose`). */
function readScene(r: GameRoom, players: Player[], id: string) {
  for (let guard = 0; r.state.story?.cutscene?.id === id && guard < 300; guard++) {
    settle(r);
    const run = r.state.story!.cutscene!;
    if (finaleCutscenes[id]?.lines[run.line]?.choose) return;
    for (const p of players) r.readStoryLine(p.id, run.id, run.line);
  }
}
/** Tick until a scene starts (or give up). */
function tickUntilScene(r: GameRoom, max = 30) {
  for (let i = 0; i < max && !r.state.story?.cutscene; i++) r.tick();
  settle(r);
  return r.state.story?.cutscene?.id;
}
const flagCount = (story: World["story"], flag: string) =>
  story!.flags.filter((f) => f === flag).length;

it("leaves the decision on the shrine road, with the roads open and the shortcut shut", () => {
  const { r, story, sieg } = pair();
  expect(story.stage).toBe("SHRINE_ROAD");
  expect(story.flags).toContain(SHRINE_QUEST);
  expect(roadsOpen(story)).toBe(true);
  expect(r.state.sceneId).toBe("EMBERBROOK_VILLAGE");
  expect(finaleObjective(story)).toMatch(/Find the Forgotten Shrine/);
  // The playtest shortcut from home would skip the angel and the trials.
  r.transition("MAIN_HOUSE");
  r.state.serverTick += 120;
  Object.assign(sieg, maps.MAIN_HOUSE.points.shrine);
  input(r, sieg.id, { interactHeld: true });
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
  // The road east and north is open to the party.
  Object.assign(sieg, maps.MAIN_HOUSE.points.exit);
  input(r, sieg.id, { interactHeld: true });
  input(r, sieg.id);
  expect(r.state.sceneId).toBe("EMBERBROOK_VILLAGE");
});

it("meets the Weeping Angel once on arrival, keeps the way sealed, and blesses them once she is seated", () => {
  const { r, story, sieg, coco } = pair();
  r.transition("PUZZLE_GLADE");
  expect(tickUntilScene(r)).toBe("angel-meet");
  // Both read it: the scene is the whole party's.
  expect(r.readStoryLine(sieg.id, "angel-meet", 0).accepted).toBe(true);
  readScene(r, [sieg, coco], "angel-meet");
  expect(story.stage).toBe("SHRINE_ROAD");
  expect(flagCount(story, FINALE.angelMeet)).toBe(1);
  // Back and forth: it never plays again.
  r.transition("GRASSLANDS");
  r.transition("PUZZLE_GLADE");
  for (let i = 0; i < 10; i++) r.tick();
  expect(story.cutscene).toBeUndefined();
  // Her puzzle runs as before; the exit stays shut until she is seated...
  const exit = maps.PUZZLE_GLADE.points.exit;
  r.state.serverTick += 120;
  Object.assign(coco, exit);
  input(r, coco.id, { interactHeld: true });
  expect(r.state.sceneId).toBe("PUZZLE_GLADE");
  // ...and when she is, the blessing plays (before anyone can leave).
  gladeState(r.state.puzzles)!.seatedTick = r.state.serverTick;
  input(r, coco.id, { interactHeld: true });
  expect(r.state.sceneId).toBe("PUZZLE_GLADE");
  settle(r);
  expect(story.cutscene?.id).toBe("angel-blessing");
  readScene(r, [sieg, coco], "angel-blessing");
  expect(story.stage).toBe("TRIALS");
  expect(flagCount(story, FINALE.blessing)).toBe(1);
  expect(finaleObjective(story)).toMatch(/Pass the Three Trials/);
  // No teleport: the party is still in the glade, and walks on itself.
  expect(r.state.sceneId).toBe("PUZZLE_GLADE");
  r.state.serverTick += 120;
  input(r, coco.id, { interactHeld: true });
  expect(r.state.sceneId).toBe("MONSTER_CLEARING");
});

it("plays the angel's first words before her blessing if the puzzle is solved first", () => {
  const { r, story, sieg, coco } = pair();
  r.transition("PUZZLE_GLADE");
  gladeState(r.state.puzzles)!.seatedTick = 1;
  expect(tickUntilScene(r)).toBe("angel-meet");
  readScene(r, [sieg, coco], "angel-meet");
  expect(tickUntilScene(r)).toBe("angel-blessing");
  readScene(r, [sieg, coco], "angel-blessing");
  expect(story.stage).toBe("TRIALS");
});

/** Through the angel to Puzzle Map 2's entrance. */
function toTrials() {
  const room = pair(),
    { r, story, sieg, coco } = room;
  story.flags.push(FINALE.angelMeet, FINALE.blessing);
  story.stage = "TRIALS";
  r.transition("BRIDGE_RUINS");
  expect(tickUntilScene(r)).toBe("trials-inscription");
  readScene(r, [sieg, coco], "trials-inscription");
  return room;
}

it("reads the inscription, then passes each trial as the bridge's own latches close", () => {
  const { r, story, sieg, coco } = toTrials();
  expect(story.stage).toBe("TRIALS");
  expect(flagCount(story, FINALE.inscription)).toBe(1);
  const s = r.state.bridgePuzzle!;
  const trials = () => Object.values(FINALE.trials).filter((f) => story.flags.includes(f));
  r.tick();
  expect(trials()).toEqual([]);
  // Cooperation: Gate 1 and the golden switch.
  s.firstGateOpen = true;
  s.goldSwitchOpen = true;
  s.stage = 3;
  r.tick();
  expect(trials()).toEqual([FINALE.trials.cooperation]);
  // Ingenuity: the boulder on plate B, past the spikes.
  Object.assign(s.boulder, bridgePoints.plateB);
  r.tick();
  expect(trials()).toEqual([FINALE.trials.cooperation, FINALE.trials.ingenuity]);
  // Courage: the long shot and the switches held apart. The castle exit
  // waits for the scene.
  s.finalTargetHit = true;
  s.complete = true;
  Object.assign(sieg, maps.BRIDGE_RUINS.points.exit);
  input(r, sieg.id, { interactHeld: true });
  expect(r.state.sceneId).toBe("BRIDGE_RUINS");
  expect(trials()).toHaveLength(3);
  expect(story.cutscene?.id).toBe("trials-done");
  readScene(r, [sieg, coco], "trials-done");
  expect(story.stage).toBe("GODDESS");
  for (const f of Object.values(FINALE.trials)) expect(flagCount(story, f)).toBe(1);
  // The heroes reunite either side of the castle exit; E there goes on.
  r.state.serverTick += 120;
  input(r, sieg.id, { interactHeld: true });
  expect(r.state.sceneId).toBe("GODDESS_SHRINE");
});

it("keeps a reconnecting hero's trials, and the inscription readable on clear ground", () => {
  const { r, story, sieg } = toTrials();
  r.state.bridgePuzzle!.goldSwitchOpen = true;
  r.tick();
  r.disconnect(sieg.id);
  for (let i = 0; i < 5; i++) r.tick();
  expect(story.flags).toContain(FINALE.trials.cooperation);
  // The stone stands in the courtyard, away from the boulder's lane.
  expect(trialInscription.y).toBeGreaterThan(1344);
  expect(Math.abs(trialInscription.x - bridgePoints.boulderStart.x)).toBeGreaterThan(60);
});

/** Through the trials to the goddess's first words. */
function toWig() {
  const room = pair(),
    { r, story, sieg, coco } = room;
  story.flags.push(
    FINALE.angelMeet,
    FINALE.blessing,
    FINALE.inscription,
    ...Object.values(FINALE.trials),
    FINALE.trialsPassed,
  );
  story.stage = "GODDESS";
  r.transition("GODDESS_SHRINE");
  expect(tickUntilScene(r)).toBe("goddess-meet");
  readScene(r, [sieg, coco], "goddess-meet");
  return room;
}

it("meets the Bald Goddess on arrival, once, then sends them after her wig", () => {
  const { r, story, sieg, coco } = toWig();
  expect(story.stage).toBe("WIG");
  expect(flagCount(story, FINALE.goddessMeet)).toBe(1);
  // Heroes stood before her for it.
  for (const p of [sieg, coco]) expect(p.y).toBeGreaterThan(560);
  r.transition("HEDGE_MAZE");
  r.transition("GODDESS_SHRINE");
  for (let i = 0; i < 10; i++) r.tick();
  expect(story.cutscene).toBeUndefined();
  expect(finaleObjective(story, r.state.inventory?.counts)).toMatch(/Recover the Divine Wig/);
});

it("holds the maze's monsters while its words play, then lets them loose", () => {
  const { r, story, sieg, coco } = toWig();
  r.transition("HEDGE_MAZE");
  r.tick();
  expect(story.cutscene?.id).toBe("maze-banter");
  const before = JSON.stringify(
    Object.values(r.state.enemies).map((e) => [e.x, e.y, e.state]),
  );
  const hp = [sieg.hp, coco.hp];
  for (let i = 0; i < 120; i++) r.tick();
  expect(
    JSON.stringify(Object.values(r.state.enemies).map((e) => [e.x, e.y, e.state])),
  ).toBe(before);
  expect([sieg.hp, coco.hp]).toEqual(hp);
  readScene(r, [sieg, coco], "maze-banter");
  expect(flagCount(story, FINALE.maze)).toBe(1);
  r.transition("GODDESS_SHRINE");
  r.transition("HEDGE_MAZE");
  for (let i = 0; i < 10; i++) r.tick();
  expect(story.cutscene).toBeUndefined();
});

it("speaks once each over the mirror, the griffin and the wig, without touching the items", () => {
  const { r, story, sieg, coco } = toWig();
  const bag = r.state.inventory!;
  r.transition("MIRROR_POND");
  for (let i = 0; i < 5; i++) r.tick();
  expect(story.cutscene).toBeUndefined();
  bag.counts.vanity_mirror = 1;
  expect(tickUntilScene(r)).toBe("mirror-banter");
  readScene(r, [sieg, coco], "mirror-banter");
  expect(bag.counts.vanity_mirror).toBe(1);
  r.transition("GODDESS_SHRINE");
  r.transition("GRIFFIN_ENCLOSURE");
  expect(tickUntilScene(r)).toBe("griffin-banter");
  readScene(r, [sieg, coco], "griffin-banter");
  // Not while Coco is in the air over the water.
  bag.counts.griffin_wig = 1;
  coco.flightRemaining = 2;
  for (let i = 0; i < 3; i++) r.tick();
  expect(story.cutscene).toBeUndefined();
  coco.flightRemaining = 0;
  expect(tickUntilScene(r)).toBe("wig-banter");
  readScene(r, [sieg, coco], "wig-banter");
  expect(bag.counts.griffin_wig).toBe(1);
  for (const f of [FINALE.mirror, FINALE.griffin, FINALE.wig])
    expect(flagCount(story, f)).toBe(1);
});

/** Offer the wig through the existing offering interaction. */
function offer(r: GameRoom, hero: Player) {
  r.state.inventory!.counts.griffin_wig = 1;
  Object.assign(hero, { x: shrinePoints.offering.x, y: shrinePoints.offering.y + 40 });
  return r.useItem(hero.id, {
    requestId: "offer-wig-1",
    targetId: SHRINE_OFFERING,
    itemId: "griffin_wig",
  });
}

it("remembers only after the wig, then waits for each hero's own choice", () => {
  const { r, story, sieg, coco } = toWig();
  story.flags.push(FINALE.wig);
  for (let i = 0; i < 5; i++) r.tick();
  expect(story.cutscene).toBeUndefined();
  offer(r, coco);
  expect(tickUntilScene(r)).toBe("revelation");
  // The shrine's road on stays shut until the chapter ends.
  readScene(r, [sieg, coco], "revelation");
  expect(flagCount(story, FINALE.revelation)).toBe(1);
  expect(story.cutscene?.id).toBe("resolve");
  settle(r);
  const line = story.cutscene!.line;
  // Reading cannot skip a choice; nor can a wrong role, id or line.
  expect(r.readStoryLine(sieg.id, "resolve", line).accepted).toBe(false);
  expect(r.chooseStoryLine(sieg.id, "resolve", line, "truth").accepted).toBe(false);
  expect(r.chooseStoryLine(sieg.id, "resolve", line, "nonsense").accepted).toBe(false);
  expect(r.chooseStoryLine(sieg.id, "resolve", line + 1, "promise").accepted).toBe(false);
  expect(r.chooseStoryLine(sieg.id, "revelation", line, "promise").accepted).toBe(false);
  // Sieg chooses; the line waits for Coco.
  expect(r.chooseStoryLine(sieg.id, "resolve", line, "promise").accepted).toBe(true);
  for (let i = 0; i < 5; i++) r.tick();
  expect(story.cutscene?.line).toBe(line);
  // A changed mind is not accepted: the first choice stands.
  expect(r.chooseStoryLine(sieg.id, "resolve", line, "duty").accepted).toBe(false);
  expect(r.chooseStoryLine(sieg.id, "resolve", line, "promise").accepted).toBe(true);
  // Coco's choice arrives while Sieg is away: the line waits for him.
  r.disconnect(sieg.id);
  expect(r.chooseStoryLine(coco.id, "resolve", line, "scared").accepted).toBe(true);
  for (let i = 0; i < 5; i++) r.tick();
  expect(story.cutscene?.line).toBe(line);
  sieg.connected = true;
  r.tick();
  expect(story.cutscene?.line).toBe(line + 1);
  expect(story.motivations).toEqual({ OATH: "promise", EMBER: "scared" });
  expect(story.flags).toContain(motivationFlag("OATH", "promise"));
  expect(story.flags).toContain(motivationFlag("EMBER", "scared"));
  expect(flagCount(story, motivationFlag("OATH", "promise"))).toBe(1);
  readScene(r, [sieg, coco], "resolve");
  // They leave by the south road...
  expect(story.cutscene?.id).toBe("depart");
  settle(r);
  for (const p of [sieg, coco]) {
    expect(p.y).toBeGreaterThan(900);
    // Clear of the road back, so pressing E to read cannot leave the map.
    for (const point of Object.values(shrinePoints))
      expect(Math.hypot(p.x - point.x, p.y - point.y)).toBeGreaterThan(60);
  }
  expect(story.stranger).toBeUndefined();
  readScene(r, [sieg, coco], "depart");
  expect(flagCount(story, FINALE.departed)).toBe(1);
  // ...and the goddess calls out the Mistress of the Mist, who takes shape
  // at the entrance only once the mist has gathered.
  expect(story.cutscene?.id).toBe("watcher");
  settle(r);
  const lines = finaleCutscenes.watcher.lines,
    appears = lines.findIndex((l) => l.cue === "stranger-appear");
  expect(lines.findIndex((l) => l.cue === "mist-gather")).toBeLessThan(appears);
  while (story.cutscene!.line < appears) {
    expect(story.stranger).toBeUndefined();
    r.readStoryLine(sieg.id, "watcher", story.cutscene!.line);
  }
  expect(story.stranger).toEqual(watcherPose);
  expect(watcherPose.facing).toBe("south");
  expect(story.stage).toBe("WIG");
  readScene(r, [sieg, coco], "watcher");
  expect(story.stranger).toBeUndefined();
  expect(story.stage).toBe("DONE");
  expect(flagCount(story, FINALE.complete)).toBe(1);
  expect(finaleObjective(story)).toMatch(/Chapter 0 complete/);
  // Nothing replays, and the former debug forest shortcut stays removed.
  for (let i = 0; i < 20; i++) r.tick();
  expect(story.cutscene).toBeUndefined();
  r.state.serverTick += 120;
  Object.assign(sieg, { x: 848, y: 688 });
  input(r, sieg.id, { interactHeld: true });
  input(r, sieg.id);
  expect(r.state.sceneId).toBe("GODDESS_SHRINE");
});

it("has the goddess sense something familiar in Sieg, and only recall the name Sigurd", () => {
  const lines = finaleCutscenes.revelation.lines;
  const goddess = lines.filter((l) => l.speaker === "GODDESS").map((l) => l.text);
  // She never names him: nobody has introduced him to her.
  for (const text of goddess) expect(text).not.toMatch(/\bSieg\b/);
  expect(goddess).toContain("...Sigurd.");
  expect(goddess).toContain("There's something familiar about you.");
  // Nothing says who Sigurd was.
  const sigurd = lines.findIndex((l) => l.text === "...Sigurd.");
  expect(lines[sigurd + 2]).toMatchObject({
    speaker: "GODDESS",
    text: "I... cannot remember.",
  });
  // Then the talk turns to Alden and the Ember, as before.
  const forgive = lines.findIndex((l) => l.text.startsWith("Forgive me."));
  expect(lines[forgive + 1].text).toBe("Enough riddles. Did you know Papa?");
  expect(lines.some((l) => /seven divine relics/.test(l.text))).toBe(true);
});

it("never lets the shrine's road on open before the chapter ends", () => {
  const { r, story, sieg } = toWig();
  offer(r, sieg);
  r.tick();
  expect(story.cutscene?.id).toBe("revelation");
  // A disconnect mid-revelation pauses it on its line, and nothing skips.
  r.disconnect(sieg.id);
  const line = story.cutscene!.line;
  for (let i = 0; i < 30; i++) r.tick();
  expect(story.cutscene?.line).toBe(line);
  sieg.connected = true;
  // Mid-scene, even standing on the exit, the road on stays shut.
  delete story.cutscene;
  story.flags.push(FINALE.revelation, FINALE.resolve);
  r.state.serverTick += 120;
  Object.assign(sieg, { x: 848, y: 688 });
  input(r, sieg.id, { interactHeld: true });
  expect(r.state.sceneId).toBe("GODDESS_SHRINE");
  // The ending picks up where the chain left off: they leave, then the mist.
  expect(r.state.story!.cutscene?.id).toBe("depart");
  readScene(r, [sieg], "depart");
  expect(r.state.story!.cutscene?.id).toBe("watcher");
});

const request = <T>(socket: Socket, event: string, payload: unknown) =>
  new Promise<Result<T>>((resolve, reject) =>
    socket
      .timeout(3000)
      .emit(event, payload, (error: Error | null, response: Result<T>) =>
        error ? reject(error) : resolve(response),
      ),
  );
const connected = (socket: Socket) =>
  new Promise<void>((resolve) => socket.once("connect", resolve));

it("syncs each hero's choice over real sockets, validates it, and keeps it on reconnect", async () => {
  const app = createApp();
  await new Promise<void>((done) => app.http.listen(0, "127.0.0.1", done));
  const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
  const sockets = [0, 1].map(() =>
    io(url, { transports: ["websocket"], autoConnect: false }),
  );
  const states: World[] = [];
  sockets.forEach((socket, i) =>
    socket.on("state:sync", (w) => {
      states[i] = w;
    }),
  );
  try {
    const links = sockets.map(connected);
    sockets.forEach((s) => s.connect());
    await Promise.all(links);
    const created = await request<Session>(sockets[0], "room:create", {
      checkpoint: "shrine",
    });
    if (!created.ok) throw Error(created.error);
    const session = created.data;
    await request(sockets[1], "room:join", { roomCode: session.roomCode });
    await request(sockets[0], "role:select", { role: "OATH" });
    await request(sockets[1], "role:select", { role: "EMBER" });
    await request(sockets[0], "lobby:ready", { ready: true });
    await request(sockets[1], "lobby:ready", { ready: true });
    const room = app.manager.get(session.roomCode)!;
    const story = room.state.story!;
    expect(story.stage).toBe("SHRINE_ROAD");
    // Straight to the choosing line.
    story.flags.push(FINALE.revelation);
    story.stage = "WIG";
    story.cutscene = { id: "resolve", line: 0, acks: [], since: room.state.serverTick };
    // Malformed and unknown requests change nothing.
    for (const payload of [
      { cutscene: "resolve", line: 0 },
      { cutscene: "resolve", line: 0, choice: "promise", extra: 1 },
      { cutscene: "resolve", line: 0, choice: "<script>" },
      null,
    ])
      expect((await request(sockets[0], "story:choose", payload)).ok).toBe(false);
    const sieg = await request<{ accepted: boolean }>(sockets[0], "story:choose", {
      cutscene: "resolve",
      line: 0,
      choice: "duty",
    });
    expect(sieg.ok && sieg.data.accepted).toBe(true);
    // Sieg reconnects; his choice is still his.
    sockets[0].disconnect();
    const back = connected(sockets[0]);
    sockets[0].connect();
    await back;
    expect((await request(sockets[0], "session:resume", session)).ok).toBe(true);
    expect(states[0].story!.motivations).toEqual({ OATH: "duty" });
    // Coco's choice from Sieg's side is refused; from hers it is taken.
    const wrong = await request<{ accepted: boolean }>(sockets[0], "story:choose", {
      cutscene: "resolve",
      line: 0,
      choice: "truth",
    });
    expect(wrong.ok && wrong.data.accepted).toBe(false);
    const coco = await request<{ accepted: boolean }>(sockets[1], "story:choose", {
      cutscene: "resolve",
      line: 0,
      choice: "truth",
    });
    expect(coco.ok && coco.data.accepted).toBe(true);
    for (let i = 0; i < 3; i++) room.tick();
    expect(room.state.story!.cutscene?.line).toBe(1);
    expect(room.state.story!.motivations).toEqual({ OATH: "duty", EMBER: "truth" });
    // Both screens agree on the story.
    await request(sockets[0], "clock:probe", {});
    await request(sockets[1], "clock:probe", {});
    await new Promise((done) => setTimeout(done, 150));
    expect(states[0].story!.motivations).toEqual(states[1].story!.motivations);
    expect(states[0].story!.flags).toEqual(states[1].story!.flags);
  } finally {
    sockets.forEach((s) => s.disconnect());
    await app.close();
  }
});
