import { DT, ticksFor } from "../../../packages/shared/src/constants.js";
import { it, expect } from "vitest";
import { GameRoom } from "../src/GameRoom.js";
import { damageGriffin, pullGriffin, tickGriffin } from "../src/griffin.js";
import {
  griffinState,
  griffinMouth,
  griffinBeamEnd,
  griffinPillars,
  griffinNest,
  GRIFFIN_NEST,
  griffinWater,
} from "../../../packages/shared/src/griffin.js";
import {
  shrinePoints,
  SHRINE_OFFERING,
  shrineComplete,
} from "../../../packages/shared/src/shrine.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import { collisionRects, maps } from "../../../packages/shared/src/maps.js";
import { stepMovement } from "../../../packages/shared/src/movement.js";
function setup() {
  const r = new GameRoom("ABC234", false, "GRIFFIN_ENCLOSURE"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const w = r.state;
  return {
    r,
    w,
    s: w.players[a.playerId],
    c: w.players[b.playerId],
    g: griffinState(w.puzzles)!,
  };
}
function finishGrooming(w: ReturnType<typeof setup>["w"]) {
  const g = griffinState(w.puzzles)!;
  for (let i = 0; i < ticksFor(60) && !g.wigClaimed; i++)
    tickGriffin(w, () => {});
  expect(g.wigClaimed).toBe(true);
}
it("connects the northern shrine trail in both directions and preserves completed trials", () => {
  const { r, w, s, g } = setup();
  g.pillars[0] = true;
  g.hp = 212;
  r.transition("GODDESS_SHRINE", true);
  expect(s.y).toBe(160);
  Object.assign(s, shrinePoints.north);
  w.serverTick += ticksFor(1) + 1;
  r.receiveInput(s.id, { ...neutral(1), interactHeld: true });
  r.tick();
  expect(w.sceneId).toBe("GRIFFIN_ENCLOSURE");
  expect(griffinState(w.puzzles)).toMatchObject({
    hp: 212,
    pillars: [true, false, false, false],
  });
  Object.assign(s, maps.GRIFFIN_ENCLOSURE.points.back);
  w.serverTick += ticksFor(1) + 1;
  r.receiveInput(s.id, neutral(2));
  r.tick();
  r.receiveInput(s.id, { ...neutral(3), interactHeld: true });
  r.tick();
  expect(w.sceneId).toBe("GODDESS_SHRINE");
});
it("keeps water in the northern third, lets only flight cross it, and keeps pillars solid", () => {
  const { w, c, s } = setup();
  expect(griffinWater.every((r) => r.y + r.h <= 384)).toBe(true);
  const walls = collisionRects("GRIFFIN_ENCLOSURE", w.puzzles);
  Object.assign(s, { x: 500, y: 410 });
  Object.assign(c, { x: 500, y: 410 });
  for (let i = 0; i < ticksFor(1); i++) {
    stepMovement(
      s,
      { ...neutral(), moveY: -1 },
      maps.GRIFFIN_ENCLOSURE,
      walls,
      DT,
    );
    stepMovement(
      c,
      { ...neutral(), moveY: -1, flightHeld: true },
      maps.GRIFFIN_ENCLOSURE,
      walls,
      DT,
    );
  }
  expect(s.y).toBeGreaterThanOrEqual(397);
  expect(c.y).toBeLessThan(384);
  Object.assign(c, { x: 320, y: 576, flightRemaining: 10 });
  for (let i = 0; i < ticksFor(1); i++)
    stepMovement(
      c,
      { ...neutral(), moveX: 1 },
      maps.GRIFFIN_ENCLOSURE,
      walls,
      DT,
    );
  expect(c.x).toBeLessThanOrEqual(339);
});
it("pulls the airborne guardian ashore with Black Hole, respecting pillars and one damage per vortex", () => {
  const { w, g } = setup();
  Object.assign(g, { x: 640, y: 350 });
  const hole = {
    x: 640,
    y: 436,
    sceneId: "GRIFFIN_ENCLOSURE",
    damaged: [] as string[],
  };
  for (let i = 0; i < ticksFor(0.9); i++) pullGriffin(w, hole, 100);
  expect(g.y).toBeGreaterThanOrEqual(400);
  expect(g.phase).toBe("LAND");
  expect(g.grounded).toBe(14);
  expect(g.hp).toBe(296);
  Object.assign(g, { x: 330, y: 576 });
  const before = g.x;
  for (let i = 0; i < ticksFor(2); i++)
    pullGriffin(w, { ...hole, x: 440, y: 576 }, 100);
  expect(g.x).toBe(before);
});
it("locks its warned beam direction, deals damage once, and pillars shield players", () => {
  const { w, g, s, c } = setup();
  Object.assign(g, { x: 640, y: 312, phase: "FLY", cooldown: 0 });
  Object.assign(s, { x: 640, y: 700 });
  c.connected = false;
  tickGriffin(w, (p, n) => (p.hp -= n));
  expect(g.phase).toBe("BEAM_CHARGE");
  const aim = g.facing;
  s.x = 740;
  for (let i = 0; i < ticksFor(1.233); i++)
    tickGriffin(w, (p, n) => (p.hp -= n));
  expect(g.facing).toBe(aim);
  expect(s.hp).toBe(100);
  Object.assign(g, {
    x: 384,
    y: 410,
    phase: "BEAM",
    timer: 0.2,
    facing: Math.PI / 2,
    attackHits: [],
  });
  Object.assign(s, { x: 384, y: 700 });
  tickGriffin(w, (p, n) => (p.hp -= n));
  expect(s.hp).toBe(100);
  g.pillars[0] = true;
  tickGriffin(w, (p, n) => (p.hp -= n));
  tickGriffin(w, (p, n) => (p.hp -= n));
  expect(s.hp).toBe(74);
});
it("slows flight, telegraphs and charges to 20 percent and returns to defend an intruded nest", () => {
  const a = setup(),
    b = setup();
  for (const h of [a, b]) {
    h.g.cooldown = 10;
    h.g.phase = "BEAM_CHARGE";
    h.g.timer = 1;
  }
  b.w.slowTime = { owner: b.c.id, startedTick: 0, endsTick: ticksFor(10) };
  tickGriffin(a.w, () => {});
  tickGriffin(b.w, () => {});
  expect(1 - b.g.timer).toBeCloseTo((1 - a.g.timer) * 0.2);
  const { w, g, c } = setup();
  Object.assign(g, { y: 256, phase: "FLY", cooldown: 10 });
  Object.assign(c, { ...griffinNest, flightRemaining: 10 });
  const y = g.y;
  tickGriffin(w, () => {});
  expect(g.y).toBeLessThan(y);
  expect(g.facing).toBeLessThan(0);
  g.phase = "STUNNED";
  g.timer = 5;
  const still = g.y;
  tickGriffin(w, () => {});
  expect(g.y).toBe(still);
});
it("baits stationary Sieg, sweeps the fast headbutt into a pillar and stuns without clipping", () => {
  const { w, g, s, c } = setup();
  Object.assign(g, {
    x: 384,
    y: 440,
    phase: "LAND",
    grounded: 10,
    cooldown: 0,
    stationary: 2,
    lastSiegX: 384,
    lastSiegY: 720,
  });
  Object.assign(s, { x: 384, y: 720 });
  c.connected = false;
  tickGriffin(w, () => {});
  expect(g.phase).toBe("HEADBUTT_CHARGE");
  s.x = 500;
  for (let i = 0; i < ticksFor(2.167) && g.phase !== "STUNNED"; i++)
    tickGriffin(w, (p, n) => (p.hp -= n));
  expect(g.phase).toBe("STUNNED");
  expect(g.pillars[0]).toBe(true);
  expect(g.y).toBeLessThan(griffinPillars[0].y);
  expect(s.hp).toBe(100);
  expect(collisionRects("GRIFFIN_ENCLOSURE", w.puzzles)).not.toContainEqual(
    griffinPillars[0],
  );
});
it("validates nest range, ownership, role and order; awards one shared wig and finishes the goddess quest", () => {
  const { r, w, c, s, g } = setup();
  const use = (id: string, itemId?: "vanity_mirror" | "enchanted_shears") =>
    r.useItem(c.id, { requestId: id, targetId: GRIFFIN_NEST, itemId });
  expect(() => use("remote", "vanity_mirror")).toThrow("closer");
  Object.assign(c, griffinNest);
  expect(() => use("fake", "vanity_mirror")).toThrow("backpack");
  w.inventory!.counts = { vanity_mirror: 1, enchanted_shears: 1 };
  use("early", "enchanted_shears");
  expect(g.shearsDelivered).toBe(true);
  expect(g.wigClaimed).toBe(false);
  Object.assign(s, griffinNest);
  expect(() =>
    r.useItem(s.id, {
      requestId: "sieg",
      targetId: GRIFFIN_NEST,
      itemId: "vanity_mirror",
    }),
  ).toThrow("Coco");
  use("mirror", "vanity_mirror");
  expect(g.phase).toBe("GROOMING");
  use("cut", "enchanted_shears");
  use("cut", "enchanted_shears");
  use("again", "enchanted_shears");
  expect(w.inventory!.counts.griffin_wig).toBeUndefined();
  finishGrooming(w);
  use("finished", "enchanted_shears");
  expect(w.inventory!.counts).toEqual({
    vanity_mirror: 1,
    enchanted_shears: 1,
    griffin_wig: 1,
  });
  expect(g.wigClaimed).toBe(true);
  r.transition("GODDESS_SHRINE", true);
  Object.assign(c, shrinePoints.offering);
  r.useItem(c.id, {
    requestId: "offer",
    targetId: SHRINE_OFFERING,
    itemId: "griffin_wig",
  });
  expect(shrineComplete(w)).toBe(true);
  expect(w.inventory!.counts.griffin_wig).toBe(0);
  r.transition("GRIFFIN_ENCLOSURE");
  Object.assign(c, griffinNest);
  use("no-duplicate");
  expect(w.inventory!.counts.griffin_wig).toBe(0);
});
it("supports defeating the guardian and claiming shed plumage once without quest tools", () => {
  const { r, w, g, c } = setup();
  damageGriffin(w, 999);
  expect(g.phase).toBe("DEFEATED");
  Object.assign(c, griffinNest);
  r.useItem(c.id, { requestId: "plumage", targetId: GRIFFIN_NEST });
  expect(w.inventory!.counts.griffin_wig).toBe(1);
});

it("walks and flies from the real spawn to the nest, delivers both earned tools, and returns with the wig", () => {
  const { r, w, s, c, g } = setup();
  // Tools normally earned on the two completed branches; no movement/HP fixtures.
  w.inventory!.counts = { vanity_mirror: 1, enchanted_shears: 1 };
  let seq = 0;
  function step(dx: number, dy: number, fly = false) {
    seq++;
    r.receiveInput(s.id, neutral(seq));
    r.receiveInput(c.id, {
      ...neutral(seq),
      moveX: dx,
      moveY: dy,
      flightHeld: fly,
    });
    r.tick();
  }
  for (let n = 0; n < ticksFor(0.3); n++) step(-1, 0);
  step(0, -1, true);
  for (let n = 0; n < ticksFor(5.667) && c.y > 142; n++) step(0, -1);
  expect(c.y).toBeLessThan(150);
  expect(c.hp).toBeGreaterThan(0);
  expect(c.flightRemaining).toBeGreaterThan(0);
  r.useItem(c.id, {
    requestId: "walk-mirror",
    targetId: GRIFFIN_NEST,
    itemId: "vanity_mirror",
  });
  r.useItem(c.id, {
    requestId: "walk-shears",
    targetId: GRIFFIN_NEST,
    itemId: "enchanted_shears",
  });
  finishGrooming(w);
  expect(g.wigClaimed).toBe(true);
  expect(w.inventory!.counts.griffin_wig).toBe(1);
  for (let n = 0; n < ticksFor(5.667) && c.y < 1080; n++) step(0, 1);
  seq++;
  r.receiveInput(c.id, { ...neutral(seq), interactHeld: true });
  r.tick();
  expect(w.sceneId).toBe("GODDESS_SHRINE");
  expect(w.inventory!.counts.griffin_wig).toBe(1);
});

it("synchronizes Griffin attacks, pillar changes and a unique nest reward to two real clients", async () => {
  const { createApp } = await import("../src/app.js"),
    { io } = await import("socket.io-client");
  const app = createApp({ startingScene: "GRIFFIN_ENCLOSURE" });
  await new Promise<void>((resolve) =>
    app.http.listen(0, "127.0.0.1", resolve),
  );
  const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`,
    clients = [io(url), io(url)];
  const history = clients.map(() => new Map<number, any>());
  clients.forEach((c, i) =>
    c.on("game:snapshot", (w) => history[i].set(w.serverTick, w)),
  );
  const req = (c: any, event: string, data: any) =>
    new Promise<any>((resolve, reject) =>
      c
        .timeout(2000)
        .emit(event, data, (e: any, r: any) => (e ? reject(e) : resolve(r))),
    );
  try {
    await Promise.all(
      clients.map(
        (c) => new Promise<void>((resolve) => c.on("connect", resolve)),
      ),
    );
    const a = (await req(clients[0], "room:create", {})).data,
      b = (await req(clients[1], "room:join", { roomCode: a.roomCode })).data;
    await req(clients[0], "role:select", { role: "OATH" });
    await req(clients[1], "role:select", { role: "EMBER" });
    await req(clients[0], "lobby:ready", { ready: true });
    await req(clients[1], "lobby:ready", { ready: true });
    const room = app.manager.get(a.roomCode),
      w = room.state,
      g = griffinState(w.puzzles)!,
      c = w.players[b.playerId];
    expect((w.inventoryTargets![GRIFFIN_NEST] as any).interact).toBeUndefined();
    expect(
      (
        await req(clients[1], "inventory:use", {
          requestId: "forged",
          targetId: GRIFFIN_NEST,
          itemId: "enchanted_shears",
        })
      ).ok,
    ).toBe(false);
    // Both real clients observe the same authoritative stand-up phase.
    Object.assign(w.players[a.playerId], { x: 640, y: 450 });
    const wakeDeadline = Date.now() + 2500;
    let wakeTick: number | undefined;
    while (Date.now() < wakeDeadline && wakeTick === undefined) {
      wakeTick = [...history[0].keys()].find(
        (t) =>
          history[1].has(t) &&
          griffinState(history[0].get(t).puzzles)?.phase === "WAKING" &&
          griffinState(history[1].get(t).puzzles)?.phase === "WAKING",
      );
      if (wakeTick === undefined)
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(wakeTick).toBeDefined();
    expect(griffinState(history[0].get(wakeTick!).puzzles)).toEqual(
      griffinState(history[1].get(wakeTick!).puzzles),
    );
    // A continuous mouth beam stops at Sieg; Coco behind him is shielded.
    Object.assign(g, {
      x: 640,
      y: 500,
      facing: 0,
      phase: "BEAM",
      timer: 2,
      grounded: 10,
      attackHits: [],
    });
    Object.assign(w.players[a.playerId], { x: 800, y: 459 });
    Object.assign(c, { x: 900, y: 459 });
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(g.beam?.contactId).toBe(`player:${a.playerId}`);
    expect(w.players[a.playerId].hp).toBe(74);
    expect(c.hp).toBe(100);
    const beamTicks = [...history[0].keys()].filter(
      (t) =>
        history[1].has(t) &&
        griffinState(history[0].get(t).puzzles)?.beam?.contactId ===
          `player:${a.playerId}`,
    );
    expect(beamTicks.length).toBeGreaterThan(0);
    for (const t of beamTicks)
      expect(history[0].get(t).puzzles.griffin).toEqual(
        history[1].get(t).puzzles.griffin,
      );
    Object.assign(g, {
      phase: "HEADBUTT",
      x: 384,
      y: 500,
      facing: Math.PI / 2,
      timer: 0.7,
      grounded: 10,
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(g.pillars[0]).toBe(true);
    expect(g.phase).toBe("STUNNED");
    Object.assign(c, griffinNest);
    w.inventory!.counts = { vanity_mirror: 1, enchanted_shears: 1 };
    expect(
      (
        await req(clients[1], "inventory:use", {
          requestId: "mirror",
          targetId: GRIFFIN_NEST,
          itemId: "vanity_mirror",
        })
      ).ok,
    ).toBe(true);
    const cut = {
      requestId: "cut",
      targetId: GRIFFIN_NEST,
      itemId: "enchanted_shears",
    };
    expect((await req(clients[1], "inventory:use", cut)).ok).toBe(true);
    expect((await req(clients[1], "inventory:use", cut)).ok).toBe(true);
    expect(g.wigClaimed).toBe(false);
    const groomingDeadline = Date.now() + 2500;
    let groomingTick: number | undefined;
    while (groomingTick === undefined && Date.now() < groomingDeadline) {
      groomingTick = [...history[0].keys()].find(
        (t) =>
          history[1].has(t) &&
          griffinState(history[0].get(t).puzzles)?.phase === "GROOMING" &&
          griffinState(history[1].get(t).puzzles)?.phase === "GROOMING",
      );
      if (groomingTick === undefined)
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(groomingTick).toBeDefined();
    expect(history[0].get(groomingTick!).puzzles.griffin).toEqual(
      history[1].get(groomingTick!).puzzles.griffin,
    );
    finishGrooming(w);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const ticks = [...history[0].keys()].filter(
      (t) =>
        history[1].has(t) &&
        griffinState(history[0].get(t).puzzles)?.wigClaimed,
    );
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) {
      expect(history[0].get(t).puzzles.griffin).toEqual(
        history[1].get(t).puzzles.griffin,
      );
      expect(history[0].get(t).inventory).toEqual(history[1].get(t).inventory);
      expect(history[0].get(t).inventory.counts.griffin_wig).toBe(1);
    }
  } finally {
    clients.forEach((c) => c.disconnect());
    await app.close();
  }
}, 15000);

it("Black Hole overcomes flight AI and really drags the Griffin onto land over successive live ticks", () => {
  const { w, g, s, c } = setup();
  Object.assign(g, { x: 640, y: 312, cooldown: 10 });
  Object.assign(s, { x: 592, y: 600 });
  Object.assign(c, { x: 640, y: 500 });
  const hole = {
    x: 640,
    y: 404,
    sceneId: "GRIFFIN_ENCLOSURE",
    damaged: [] as string[],
  };
  for (let i = 0; i < ticksFor(3.667); i++) {
    tickGriffin(w, () => {});
    pullGriffin(w, hole, 100);
  }
  expect(g.y).toBeGreaterThanOrEqual(400);
  expect(g.grounded).toBeGreaterThan(0);
  expect(g.hp).toBe(296);
});

it("loops a two-second beam from its mouth and explodes only at the nearest contact", () => {
  const { w, g, s, c } = setup();
  Object.assign(g, {
    x: 640,
    y: 500,
    facing: 0,
    phase: "BEAM",
    timer: 2,
    grounded: 10,
    attackHits: [],
  });
  Object.assign(s, { x: 800, y: 459 });
  Object.assign(c, { x: 900, y: 459 });
  expect(griffinMouth(g)).toEqual({ x: 689, y: 459 });
  for (let i = 0; i < ticksFor(1); i++) tickGriffin(w, (p, n) => (p.hp -= n));
  expect(g.phase).toBe("BEAM");
  expect(g.beam).toMatchObject({ x: 779, y: 459, contactId: `player:${s.id}` });
  expect(s.hp).toBe(74);
  expect(c.hp).toBe(100);
  s.y = 600;
  tickGriffin(w, (p, n) => (p.hp -= n));
  expect(g.beam?.contactId).toBe(`player:${c.id}`);
  expect(c.hp).toBe(74);
  const wall = { x: 730, y: 430, w: 32, h: 60 };
  expect(griffinBeamEnd(g, [wall], [s, c])).toMatchObject({
    x: 730,
    y: 459,
    contactId: "solid:0",
  });
  c.sceneId = "GODDESS_SHRINE";
  expect(griffinBeamEnd(g, [], [s, c]).contactId).toBe("range");
  for (let i = 0; i < ticksFor(1.333); i++)
    tickGriffin(w, (p, n) => (p.hp -= n));
  expect(g.phase).not.toBe("BEAM");
  expect(s.hp).toBe(74);
});

it("drags a Griffin hit by a shoreline vortex physically onto land, with stronger collision-safe pull", () => {
  const { w, g } = setup();
  Object.assign(g, { x: 640, y: 312, cooldown: 10 });
  // The travelling spell stops against the Griffin, leaving its vortex over water.
  const hole = {
    x: 640,
    y: 350,
    sceneId: "GRIFFIN_ENCLOSURE",
    damaged: [] as string[],
  };
  for (let n = 0; n < ticksFor(0.667); n++) {
    const before = { x: g.x, y: g.y };
    pullGriffin(w, hole, 100);
    expect(Math.hypot(g.x - before.x, g.y - before.y)).toBeLessThanOrEqual(
      220 * DT + 1e-6,
    );
  }
  expect(g.y).toBeGreaterThan(400);
  expect(g.grounded).toBe(14);
  expect(g.hp).toBe(296);
  const distant = setup();
  Object.assign(distant.g, { x: 640, y: 312 });
  pullGriffin(distant.w, { ...hole, x: 790, y: 312, damaged: [] }, 100);
  expect(distant.g.x).toBeGreaterThan(640);
});

it("waits at the nest until a living connected hero enters unobstructed sight", () => {
  const { w, g, s, c } = setup();
  expect(g).toMatchObject({ ...griffinNest, phase: "NEST" });
  for (let i = 0; i < ticksFor(10); i++)
    tickGriffin(w, () => {
      throw Error("Dormant attack");
    });
  expect(g).toMatchObject({
    ...griffinNest,
    phase: "NEST",
    clock: 0,
    cooldown: 2,
  });
  Object.assign(c, { x: 640, y: 450, connected: false });
  tickGriffin(w, () => {});
  expect(g.phase).toBe("NEST");
  Object.assign(c, { connected: true, hp: 0 });
  tickGriffin(w, () => {});
  expect(g.phase).toBe("NEST");
  Object.assign(c, { hp: 100, sceneId: "GODDESS_SHRINE" });
  tickGriffin(w, () => {});
  expect(g.phase).toBe("NEST");
  c.sceneId = "GRIFFIN_ENCLOSURE";
  tickGriffin(w, () => {});
  expect(g.phase).toBe("WAKING");
  Object.assign(c, { x: 688, y: 1056 });
  tickGriffin(w, () => {});
  expect(g.phase).not.toBe("NEST");
  expect(s.hp).toBe(100);
});

it("detects Sieg too and wakes if attacked at the nest", () => {
  const a = setup();
  Object.assign(a.s, { x: 640, y: 450 });
  tickGriffin(a.w, () => {});
  expect(a.g.phase).toBe("WAKING");
  const b = setup();
  damageGriffin(b.w, 5);
  expect(b.g.phase).toBe("WAKING");
  expect(b.g.hp).toBe(315);
});

it("does not detect a hero behind a solid pillar", () => {
  const { w, g, s, c } = setup();
  Object.assign(g, { x: 384, y: 400 });
  Object.assign(s, { x: 384, y: 650 });
  c.connected = false;
  tickGriffin(w, () => {});
  expect(g.phase).toBe("NEST");
  s.x = 640;
  tickGriffin(w, () => {});
  expect(g.phase).toBe("WAKING");
});

it("stands up at the nest before moving, with wake-up synchronized to Slow Time", () => {
  const { w, g, s } = setup();
  Object.assign(s, { x: 640, y: 450 });
  tickGriffin(w, () => {});
  expect(g.phase).toBe("WAKING");
  expect(g).toMatchObject(griffinNest);
  w.slowTime = { owner: s.id, startedTick: 0, endsTick: ticksFor(10) };
  const before = g.timer;
  tickGriffin(w, () => {});
  expect(before - g.timer).toBeCloseTo(DT * 0.2, 6);
  for (let i = 0; i < ticksFor(2); i++) tickGriffin(w, () => {});
  expect(g.phase).toBe("WAKING");
  expect(g).toMatchObject(griffinNest);
  w.slowTime = undefined;
  for (let i = 0; i < ticksFor(1); i++) tickGriffin(w, () => {});
  expect(g.phase).not.toBe("WAKING");
  const facing = g.facing;
  damageGriffin(w, 999);
  tickGriffin(w, () => {});
  expect(g.phase).toBe("DEFEATED");
  expect(g.facing).toBe(facing);
});

it("returns to the nest and checks south then north before cutting; waits for shears and awards once", () => {
  const { r, w, c, g } = setup();
  Object.assign(g, { x: 900, y: 700, phase: "LAND", grounded: 20 });
  Object.assign(c, griffinNest);
  w.inventory!.counts = { vanity_mirror: 1, enchanted_shears: 1 };
  const drop = (
    requestId: string,
    itemId: "vanity_mirror" | "enchanted_shears",
  ) => r.useItem(c.id, { requestId, itemId, targetId: GRIFFIN_NEST });
  drop("mirror", "vanity_mirror");
  const stages = new Set<string>();
  for (let i = 0; i < ticksFor(20); i++) {
    tickGriffin(w, () => {
      throw Error("Grooming must not attack");
    });
    stages.add(g.groomingStage!);
    if (g.groomingStage !== "RETURN")
      expect(Math.hypot(g.x - griffinNest.x, g.y - griffinNest.y)).toBeLessThan(
        1,
      );
  }
  expect([...stages]).toEqual(["RETURN", "STAND", "SOUTH", "NORTH"]);
  expect(g.wigClaimed).toBe(false);
  expect(w.inventory!.counts.griffin_wig).toBeUndefined();
  const timer = g.timer;
  drop("mirror-again", "vanity_mirror");
  expect(g.timer).toBe(timer);
  drop("shears", "enchanted_shears");
  let sawCut = false;
  for (let i = 0; i < ticksFor(10) && !g.wigClaimed; i++) {
    tickGriffin(w, () => {});
    if (g.groomingStage === "CUT") {
      sawCut = true;
      expect(w.inventory!.counts.griffin_wig).toBeUndefined();
    }
  }
  expect(sawCut).toBe(true);
  expect(g.groomingStage).toBe("DONE");
  expect(w.inventory!.counts.griffin_wig).toBe(1);
  expect(w.puzzles.griffin.complete).toBe(true);
  drop("again", "enchanted_shears");
  tickGriffin(w, () => {});
  expect(w.inventory!.counts.griffin_wig).toBe(1);
});
