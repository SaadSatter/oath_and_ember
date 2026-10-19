import { expect, it } from "vitest";
import { io } from "socket.io-client";
import { GameRoom } from "../src/GameRoom.js";
import { createApp } from "../src/app.js";
import { collisionRects, maps } from "../../../packages/shared/src/maps.js";
import {
  neutral,
  type InputFrame,
  type Player,
  type SceneId,
} from "../../../packages/shared/src/gameTypes.js";
import {
  AMBUSH_HP_FLOOR,
  AMBUSH_MAX,
  AMBUSH_OPENING,
  AMBUSH_RISE_SECONDS,
  AMBUSH_SECONDS,
  aldenAtShop,
  cutscenes,
  prologueStart,
} from "../../../packages/shared/src/prologue.js";
import { ticksFor } from "../../../packages/shared/src/constants.js";

function pair(prologue = true) {
  const r = new GameRoom("STORY1", false, "MAIN_HOUSE", prologue),
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
const blocked = (scene: SceneId, p: { x: number; y: number }) =>
  collisionRects(scene, {}).some(
    (q) =>
      p.x + 13 > q.x &&
      p.x - 13 < q.x + q.w &&
      p.y + 13 > q.y &&
      p.y - 13 < q.y + q.h,
  );
/** Both heroes read every remaining line of the running scene. */
function readAll(r: GameRoom, players: Player[]) {
  for (let guard = 0; r.state.story?.cutscene && guard < 100; guard++) {
    settle(r);
    const run = r.state.story.cutscene!;
    for (const p of players) r.readStoryLine(p.id, run.id, run.line);
  }
}
function enterShop(r: GameRoom, sieg: Player) {
  Object.assign(sieg, maps.MAIN_HOUSE.points.door);
  input(r, sieg.id, { interactHeld: true });
  input(r, sieg.id, { interactHeld: false });
}

it("keeps the normal campaign start unchanged without the prologue", () => {
  const { r, sieg, coco } = pair(false);
  expect(r.state.story).toBeUndefined();
  expect([sieg.sceneId, coco.sceneId]).toEqual(["MAIN_HOUSE", "MAIN_HOUSE"]);
});

it("opens with Sieg on the road, Coco and Alden in the shop, on clear ground", () => {
  const { r, sieg, coco } = pair();
  expect(r.state.story).toMatchObject({ stage: "ARRIVAL", flags: [] });
  expect(r.state.story!.alden).toMatchObject(aldenAtShop);
  for (const [p, start] of [
    [sieg, prologueStart.OATH],
    [coco, prologueStart.EMBER],
  ] as const)
    expect(p).toMatchObject({
      sceneId: start.scene,
      x: start.x,
      y: start.y,
      facing: start.facing,
    });
  expect(blocked(sieg.sceneId!, sieg)).toBe(false);
  expect(blocked(coco.sceneId!, coco)).toBe(false);
  expect(blocked("HOUSE_INTERIOR", aldenAtShop)).toBe(false);
  for (const scene of Object.values(cutscenes))
    for (const at of Object.values(scene.placement))
      expect(blocked(at.scene ?? scene.scene, at)).toBe(false);
});

it("leaves both heroes free to explore until Sieg walks into the shop", () => {
  const { r, sieg, coco } = pair();
  const x = coco.x;
  for (let i = 0; i < 10; i++) input(r, coco.id, { moveX: 1 });
  expect(coco.x).toBeGreaterThan(x);
  expect(r.state.story!.cutscene).toBeUndefined();
  enterShop(r, sieg);
  expect(r.state.story!.cutscene).toMatchObject({ id: "visit", line: 0 });
  // Sieg set the scene off by walking in: he stays where he stopped, and Coco
  // walks over to take her place beside him, as the scene arranges them.
  const OATH = cutscenes.visit.placement.OATH!,
    EMBER = cutscenes.visit.placement.EMBER!;
  const entered = maps.HOUSE_INTERIOR.spawn;
  expect(sieg.sceneId).toBe("HOUSE_INTERIOR");
  expect(Math.hypot(sieg.x - entered.x, sieg.y - entered.y)).toBeLessThan(4);
  expect(coco.sceneId).toBe("HOUSE_INTERIOR");
  expect(coco.x - sieg.x).toBeCloseTo(EMBER.x - OATH.x, 0);
  expect(coco.y - sieg.y).toBeCloseTo(EMBER.y - OATH.y, 0);
});

it("holds heroes still, and keeps doors and attacks closed, while a scene plays", () => {
  const { r, sieg, coco } = pair();
  enterShop(r, sieg);
  const at = { x: sieg.x, y: sieg.y };
  for (let i = 0; i < 20; i++)
    input(r, sieg.id, { moveX: 1, primaryHeld: i % 2 === 0 });
  expect({ x: sieg.x, y: sieg.y }).toEqual(at);
  expect(sieg.combat).toBeUndefined();
  // Standing on the door's interaction area still does not leave.
  Object.assign(coco, maps.HOUSE_INTERIOR.spawn);
  input(r, coco.id, { interactHeld: true });
  expect(coco.sceneId).toBe("HOUSE_INTERIOR");
  // E held through the scene's end must be released before it opens a door.
  readAll(r, [sieg, coco]);
  input(r, coco.id, { interactHeld: true });
  expect(coco.sceneId).toBe("HOUSE_INTERIOR");
  input(r, coco.id, { interactHeld: false });
  input(r, coco.id, { interactHeld: true });
  expect(coco.sceneId).toBe("MAIN_HOUSE");
});

it("lets Coco and Sieg leave through the prologue shop threshold after the visit", () => {
  const { r, sieg, coco } = pair();
  enterShop(r, sieg);
  readAll(r, [sieg, coco]);
  expect(r.state.story!.stage).toBe("LEAVING");
  for (const hero of [coco, sieg]) {
    Object.assign(hero, maps.HOUSE_INTERIOR.spawn);
    for (let tick = 0; tick < ticksFor(1); tick++)
      input(r, hero.id, { moveY: 1 });
    expect(hero.y).toBe(579);
    input(r, hero.id, { interactHeld: true });
    expect(hero.sceneId).toBe("MAIN_HOUSE");
    expect(Math.hypot(hero.x - 480, hero.y - 344)).toBeLessThan(42);
    expect(r.state.story!.stage).toBe("LEAVING");
  }
});

it("moves a line on as soon as either hero reads it, ignoring stale and repeated reads", () => {
  const { r, sieg, coco } = pair();
  enterShop(r, sieg);
  const run = () => r.state.story!.cutscene!;
  expect(r.readStoryLine(coco.id, "visit", 3).accepted).toBe(false);
  expect(r.readStoryLine(coco.id, "fork", 0).accepted).toBe(false);
  expect(r.readStoryLine(sieg.id, "visit", 0).accepted).toBe(true);
  expect(run()).toMatchObject({ line: 1, acks: [] });
  // Both pressing at once, or a late duplicate, cannot skip the next line.
  expect(r.readStoryLine(coco.id, "visit", 0).accepted).toBe(false);
  expect(r.readStoryLine(sieg.id, "visit", 0).accepted).toBe(false);
  expect(run().line).toBe(1);
  expect(r.readStoryLine(coco.id, "visit", 1).accepted).toBe(true);
  expect(run().line).toBe(2);
});

it("waits for a disconnected partner instead of moving on", () => {
  const { r, sieg, coco } = pair();
  enterShop(r, sieg);
  r.disconnect(coco.id);
  r.readStoryLine(sieg.id, "visit", 0);
  for (let i = 0; i < 600; i++) r.tick();
  expect(r.state.story!.cutscene!.line).toBe(0);
  const token = r.sessions.get(coco.id)!.token;
  r.resume(coco.id, token, "b2");
  expect(r.state.story!.cutscene).toMatchObject({ id: "visit", line: 0 });
  r.readStoryLine(coco.id, "visit", 0);
  expect(r.state.story!.cutscene!.line).toBe(1);
});

it("plays the road fork when either hero reaches the road, and closes both roads", () => {
  const { r, sieg, coco } = pair();
  enterShop(r, sieg);
  readAll(r, [sieg, coco]);
  expect(r.state.story).toMatchObject({
    stage: "LEAVING",
    flags: ["prologue.visit"],
  });
  // Coco runs ahead; Sieg is still inside.
  Object.assign(coco, { sceneId: "MAIN_HOUSE", x: 480, y: 470 });
  input(r, coco.id);
  expect(r.state.story!.cutscene).toMatchObject({ id: "fork", line: 0 });
  // Coco stops where she reached the road; Sieg, still inside, is brought out.
  expect(coco).toMatchObject({ sceneId: "MAIN_HOUSE", x: 480, y: 470 });
  expect(sieg).toMatchObject({ sceneId: "MAIN_HOUSE", x: 540, y: 492 });
  // Sieg's thoughts are his alone: Coco cannot read them, Sieg moves them on.
  const thought = cutscenes.fork.lines.findIndex((l) => l.audience);
  while (r.state.story!.cutscene!.line < thought)
    for (const p of [sieg, coco])
      r.readStoryLine(p.id, "fork", r.state.story!.cutscene!.line);
  expect(r.readStoryLine(coco.id, "fork", thought).accepted).toBe(false);
  r.readStoryLine(sieg.id, "fork", thought);
  expect(r.state.story!.cutscene!.line).toBe(thought + 1);
  readAll(r, [sieg, coco]);
  expect(r.state.story).toMatchObject({
    stage: "FOREST_BOUND",
    flags: ["prologue.visit", "prologue.detour"],
  });
  // Emberbrook stays closed until the next morning...
  Object.assign(sieg, maps.MAIN_HOUSE.points.exit);
  input(r, sieg.id, { interactHeld: true });
  input(r, sieg.id, { interactHeld: false });
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
  // The scene never replays.
  Object.assign(coco, { x: 480, y: 470 });
  input(r, coco.id);
  expect(r.state.story!.cutscene).toBeUndefined();
});

it("restarts the prologue cleanly on a new game", () => {
  const { r, sieg, coco } = pair();
  enterShop(r, sieg);
  readAll(r, [sieg, coco]);
  r.reset();
  expect(r.state.story).toMatchObject({ stage: "ARRIVAL", flags: [] });
  expect(r.state.story!.cutscene).toBeUndefined();
});

it("synchronizes story lines to two real sockets, validates reads and survives reconnect", async () => {
  const app = createApp({ prologue: true });
  await new Promise<void>((resolve) =>
    app.http.listen(0, "127.0.0.1", resolve),
  );
  const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
  const sockets = [
    io(url, { transports: ["websocket"] }),
    io(url, { transports: ["websocket"] }),
  ];
  const req = (s: (typeof sockets)[number], event: string, data: unknown) =>
    new Promise<any>((resolve, reject) =>
      s
        .timeout(2000)
        .emit(event, data, (err: any, result: any) =>
          err ? reject(err) : resolve(result),
        ),
    );
  // The next snapshot both sockets receive for the same tick.
  const synced = async () => {
    for (;;) {
      const pair = await Promise.all(
        sockets.map(
          (s) =>
            new Promise<any>((resolve) => s.once("game:snapshot", resolve)),
        ),
      );
      if (pair[0].serverTick === pair[1].serverTick) return pair;
    }
  };
  try {
    await Promise.all(
      sockets.map(
        (s) => new Promise<void>((resolve) => s.on("connect", resolve)),
      ),
    );
    const a = (await req(sockets[0], "room:create", {})).data;
    const b = (await req(sockets[1], "room:join", { roomCode: a.roomCode }))
      .data;
    await req(sockets[0], "role:select", { role: "OATH" });
    await req(sockets[1], "role:select", { role: "EMBER" });
    await req(sockets[0], "lobby:ready", { ready: true });
    await req(sockets[1], "lobby:ready", { ready: true });
    const room = app.manager.get(a.roomCode);
    expect(room.state.story?.stage).toBe("ARRIVAL");
    Object.assign(room.state.players[a.playerId], maps.MAIN_HOUSE.points.door);
    sockets[0].emit("player:input", { ...neutral(1), interactHeld: true });
    // The heroes walk into place before the first line shows.
    for (let i = 0; i < 100 && room.state.story?.cutscene?.line !== 0; i++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    expect(room.state.story?.cutscene).toMatchObject({ id: "visit", line: 0 });
    // Outcomes cannot be sent: only a well-formed "read" is accepted.
    for (const bad of [
      { cutscene: "visit", line: -1 },
      { cutscene: "visit", line: 0, stage: "DONE" },
      { cutscene: "../visit", line: 0 },
    ])
      expect((await req(sockets[0], "story:read", bad)).ok).toBe(false);
    expect(
      (await req(sockets[0], "story:read", { cutscene: "visit", line: 0 }))
        .data,
    ).toEqual({ accepted: true });
    await req(sockets[1], "story:read", { cutscene: "visit", line: 0 });
    const states = await synced();
    expect(states[0].story).toEqual(states[1].story);
    expect(states[0].story.cutscene).toMatchObject({ id: "visit", line: 1 });
    // A reconnecting hero lands back on the same line.
    await new Promise<void>((resolve) => {
      sockets[1].once("disconnect", () => resolve());
      sockets[1].disconnect();
    });
    sockets[1].connect();
    await new Promise<void>((resolve) => sockets[1].once("connect", resolve));
    expect((await req(sockets[1], "session:resume", b)).ok).toBe(true);
    expect(room.state.story?.cutscene).toMatchObject({ id: "visit", line: 1 });
    // ...and keeps receiving the shared scene.
    await req(sockets[0], "story:read", { cutscene: "visit", line: 1 });
    await req(sockets[1], "story:read", { cutscene: "visit", line: 1 });
    const after = await synced();
    expect(after[1].story).toEqual(after[0].story);
    expect(after[1].story.cutscene.line).toBe(2);
  } finally {
    sockets.forEach((s) => s.disconnect());
    await new Promise((resolve) => app.http.close(resolve));
  }
});

/** Both heroes read every line of one scene (chained scenes are left alone). */
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
/** Play from the start to the forest trail. */
function toTrail() {
  const room = pair(),
    { r, sieg, coco } = room;
  enterShop(r, sieg);
  readAll(r, [sieg, coco]);
  Object.assign(coco, { sceneId: "MAIN_HOUSE", x: 480, y: 470 });
  input(r, coco.id);
  readAll(r, [sieg, coco]);
  r.state.serverTick += 120; // travel cooldown after the last scene change
  press(r, coco, maps.MAIN_HOUSE.points.shrine);
  return room;
}
/** ...and on into the clearing, through the ambush scene to the fight. */
function toFight() {
  const room = toTrail(),
    { r, sieg, coco } = room;
  Object.assign(sieg, maps.PROLOGUE_TRAIL.points.cart);
  input(r, sieg.id);
  readAll(r, [sieg, coco]);
  r.state.serverTick += 120;
  press(r, coco, maps.PROLOGUE_TRAIL.points.exit);
  input(r, coco.id);
  readAll(r, [sieg, coco]);
  return room;
}

it("follows Coco west into the forest, where the cart opens the way on", () => {
  const { r, sieg, coco } = toTrail();
  expect(r.state.sceneId).toBe("PROLOGUE_TRAIL");
  expect(r.state.story!.stage).toBe("TRAIL");
  expect([sieg.sceneId, coco.sceneId]).toEqual([
    "PROLOGUE_TRAIL",
    "PROLOGUE_TRAIL",
  ]);
  // The tracks lead nowhere until someone has looked at the cart.
  r.state.serverTick += 120;
  press(r, coco, maps.PROLOGUE_TRAIL.points.exit);
  expect(r.state.sceneId).toBe("PROLOGUE_TRAIL");
  // Either hero walking up to the cart starts its scene, for both.
  Object.assign(sieg, maps.PROLOGUE_TRAIL.points.cart);
  input(r, sieg.id);
  expect(r.state.story!.cutscene?.id).toBe("cart");
  readAll(r, [sieg, coco]);
  expect(r.state.story!.flags).toContain("prologue.cart");
  r.state.serverTick += 120;
  press(r, coco, maps.PROLOGUE_TRAIL.points.exit);
  expect(r.state.sceneId).toBe("PROLOGUE_CLEARING");
  input(r, coco.id);
  expect(r.state.story!.cutscene?.id).toBe("ambush");
  // The first golem and wisp rise, and hold still while the scene plays.
  const enemies = Object.values(r.state.enemies);
  expect(enemies.map((e) => e.type).sort()).toEqual([
    "cinder_wisp",
    "ironbound_sentinel",
  ]);
  expect(enemies.every((e) => e.passive)).toBe(true);
  for (const e of enemies) expect(blocked("PROLOGUE_CLEARING", e)).toBe(false);
  readAll(r, [sieg, coco]);
  expect(r.state.story!.stage).toBe("FIGHT");
  expect(Object.values(r.state.enemies).every((e) => !e.passive)).toBe(true);
});

it("raises the ambush one monster at a time, and replaces each one beaten", () => {
  const { r, sieg, coco } = toFight();
  const alive = () =>
    Object.values(r.state.enemies).filter((e) => e.state !== "DEAD");
  // Nobody gets hurt in this test: it is about the monsters.
  const hold = () => {
    for (const p of [sieg, coco]) p.hp = 100;
  };
  expect(alive()).toHaveLength(AMBUSH_OPENING);
  const rise = ticksFor(AMBUSH_RISE_SECONDS);
  for (let i = 0; i < rise; i++) {
    hold();
    input(r, coco.id);
  }
  expect(alive()).toHaveLength(AMBUSH_OPENING + 1);
  // Beat one: the count drops, then a new one rises in its place.
  const victim = alive()[0];
  victim.hp = 0;
  hold();
  input(r, coco.id);
  const after = alive().length;
  for (let i = 0; i < rise; i++) {
    hold();
    input(r, coco.id);
  }
  expect(alive().length).toBe(after + 1);
  // Never more than eight at once (four golems, four wisps), on clear ground.
  for (let i = 0; i < rise * 12 && r.state.story!.stage === "FIGHT"; i++) {
    hold();
    r.state.story!.fightStart = r.state.serverTick; // keep Alden away
    input(r, coco.id);
  }
  const all = alive();
  expect(all).toHaveLength(AMBUSH_MAX);
  for (const type of ["ironbound_sentinel", "cinder_wisp"])
    expect(all.filter((e) => e.type === type)).toHaveLength(AMBUSH_MAX / 2);
  for (const e of all) expect(blocked("PROLOGUE_CLEARING", e)).toBe(false);
  expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
});

it("never lets a hero fall in the ambush, and sends Alden when one is nearly down", () => {
  const { r, sieg, coco } = toFight();
  r.damage(sieg, 500);
  expect(sieg.hp).toBe(AMBUSH_HP_FLOOR);
  expect(sieg.sceneId).toBe("PROLOGUE_CLEARING");
  r.state.projectiles.shot = {
    id: "shot",
    sceneId: "PROLOGUE_CLEARING",
    faction: "enemies",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 1,
    owner: "ambush-wisp-1",
  };
  input(r, coco.id);
  const story = r.state.story!;
  expect(story.cutscene?.id).toBe("rescue");
  expect(r.state.projectiles.shot).toBeUndefined();
  expect(Object.values(r.state.enemies).every((e) => e.passive)).toBe(true);
  // Just before Alden comes, eight monsters have walked in around the heroes,
  // leaving the north open for him.
  const ring = Object.values(r.state.enemies).filter((e) => e.state !== "DEAD");
  expect(ring).toHaveLength(AMBUSH_MAX);
  expect(ring.every((e) => !e.march)).toBe(true);
  const centre = { x: (sieg.x + coco.x) / 2, y: (sieg.y + coco.y) / 2 };
  for (const e of ring) {
    const d = Math.hypot(e.x - centre.x, e.y - centre.y);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(260);
    expect(e.y < centre.y - 100 && Math.abs(e.x - centre.x) < 60).toBe(false);
    expect(blocked("PROLOGUE_CLEARING", e)).toBe(false);
  }
  expect(story.alden).toMatchObject({ scene: "PROLOGUE_CLEARING" });
  // Alden walks in from the north while the clearing glows.
  const startY = story.alden!.y;
  for (let i = 0; i < 30; i++) input(r, coco.id);
  expect(story.alden!.y).toBeGreaterThan(startY);
  // The spell lands: every monster standing falls on one tick.
  const standing = Object.values(r.state.enemies).filter(
    (e) => e.state !== "DEAD",
  ).length;
  const flash = cutscenes.rescue.lines.findIndex((l) => l.cue === "flash");
  while (story.cutscene!.line < flash)
    for (const p of [sieg, coco])
      r.readStoryLine(p.id, "rescue", story.cutscene!.line);
  const dead = Object.values(r.state.enemies).map((e) => e.deadTick);
  expect(dead).toHaveLength(standing);
  expect(new Set(dead)).toEqual(new Set([r.state.serverTick]));
  // Home: both healed and waking upstairs at the shop.
  readScene(r, [sieg, coco], "rescue");
  expect(story.cutscene?.id).toBe("home");
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
  expect([sieg.sceneId, coco.sceneId]).toEqual(["HOUSE_UPPER", "HOUSE_UPPER"]);
  expect([sieg.hp, coco.hp]).toEqual([100, 100]);
  expect(story.alden?.scene).toBe("HOUSE_UPPER");
});

it("sends Alden after a while even if nobody is hurt", () => {
  const { r, coco } = toFight();
  for (let i = 0; i < ticksFor(AMBUSH_SECONDS) - 2; i++) {
    for (const e of Object.values(r.state.enemies)) e.passive = true;
    input(r, coco.id);
  }
  expect(r.state.story!.stage).toBe("FIGHT");
  for (let i = 0; i < 4; i++) input(r, coco.id);
  expect(r.state.story!.cutscene?.id).toBe("rescue");
});

it("ends with Sieg's farewell, Coco's morning, and Coco off on her errand alone", () => {
  const { r, sieg, coco } = toFight();
  r.damage(coco, 500);
  input(r, coco.id);
  readScene(r, [sieg, coco], "rescue");
  readScene(r, [sieg, coco], "home");
  // The farewell is Sieg's alone; Coco is downstairs and only sees narration.
  expect(r.state.story!.cutscene?.id).toBe("farewell");
  expect(sieg.sceneId).toBe("MAIN_HOUSE");
  expect(coco.sceneId).toBe("HOUSE_INTERIOR");
  expect(r.readStoryLine(coco.id, "farewell", 0).accepted).toBe(false);
  readScene(r, [sieg, coco], "farewell");
  expect(r.state.story!.cutscene?.id).toBe("morning");
  expect(coco.sceneId).toBe("HOUSE_INTERIOR");
  expect(r.readStoryLine(sieg.id, "morning", 0).accepted).toBe(false);
  readScene(r, [sieg, coco], "morning");
  // Chapter 0, Part 1 picks up at once: Coco's errand, which Sieg watches.
  expect(r.state.story!.cutscene?.id).toBe("errand");
  expect(r.readStoryLine(sieg.id, "errand", 0).accepted).toBe(false);
  readScene(r, [coco], "errand");
  expect(r.state.story).toMatchObject({ stage: "ERRAND" });
  expect(r.state.story!.flags).toEqual([
    "prologue.visit",
    "prologue.detour",
    "prologue.cart",
    "prologue.ambush",
    "prologue.rescue",
    "prologue.home",
    "prologue.farewell",
    "prologue.complete",
    "chapter0.errand",
  ]);
  expect(r.state.story!.alden).toMatchObject(aldenAtShop);
  expect(sieg.sceneId).toBe("VILLAGE_COTTAGE_UPPER");
  r.state.serverTick += 120;
  press(r, coco, maps.MAIN_HOUSE.points.exit);
  // Coco walks to Emberbrook by herself; the party stays where it was.
  expect(coco.sceneId).toBe("EMBERBROOK_VILLAGE");
  expect(sieg.sceneId).toBe("VILLAGE_COTTAGE_UPPER");
  expect(r.state.sceneId).toBe("MAIN_HOUSE");
});

it("never waits forever for a walk-in, whatever holds a hero up", () => {
  const { r, sieg, coco } = pair();
  Object.assign(sieg, maps.MAIN_HOUSE.points.door);
  // Sieg steps in; then something keeps Coco from ever finishing her walk.
  sieg.sceneId = "MAIN_HOUSE";
  const s = r.sessions.get(sieg.id)!;
  s.input = { ...neutral(s.input.seq + 1), interactHeld: true };
  s.received = Date.now();
  r.tick();
  r.tick(); // the visit starts once he is inside
  expect(r.state.story!.cutscene).toMatchObject({ id: "visit", line: -1 });
  r.state.story!.walks![coco.id] = {
    ...r.state.story!.walks![coco.id],
    pending: { beside: "nobody-left", dx: 0, dy: 0 },
  };
  for (let i = 0; i < 60 * 13 && r.state.story!.cutscene!.line === -1; i++)
    r.tick();
  expect(r.state.story!.cutscene!.line).toBe(0);
  expect(r.state.story!.walks).toBeUndefined();
});

it("lets a client back in that reconnects before its old socket is noticed gone", () => {
  const { r, sieg } = pair();
  const s = r.sessions.get(sieg.id)!;
  // The old socket has not been reported closed yet.
  s.socketId = "old-socket";
  const back = r.resume(sieg.id, s.token, "new-socket");
  expect(back.playerId).toBe(sieg.id);
  expect(s.socketId).toBe("new-socket");
  // When the old socket's close arrives late, it changes nothing.
  r.disconnect(sieg.id, "old-socket");
  expect(sieg.connected).toBe(true);
  // The current socket closing still counts.
  r.disconnect(sieg.id, "new-socket");
  expect(sieg.connected).toBe(false);
});
