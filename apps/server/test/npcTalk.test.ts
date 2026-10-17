import { expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createApp } from "../src/app.js";
import { GameRoom } from "../src/GameRoom.js";
import { maps } from "../../../packages/shared/src/maps.js";
import { SERVER_HZ, ticksFor } from "../../../packages/shared/src/constants.js";
import {
  npcs,
  npcPose,
  npcClock,
  NPC_TALK_RANGE,
} from "../../../packages/shared/src/npcs.js";
import type { World } from "../../../packages/shared/src/gameTypes.js";

const elder = npcs.find((n) => n.id === "elder")!;
// A tick at which the elder is walking, so a pause is visible.
const walking = (() => {
  for (let t = 0; ; t += 5) if (npcPose(elder, t).moving) return t;
})();
function village() {
  const r = new GameRoom("TALK23"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  r.transition("EMBERBROOK_VILLAGE");
  r.state.serverTick = walking;
  const [s, c] = [r.state.players[a.playerId], r.state.players[b.playerId]];
  const beside = (p: typeof s) => {
    const pose = npcPose(elder, r.state.serverTick, r.state);
    Object.assign(p, { x: pose.x + 30, y: pose.y });
  };
  return { r, s, c, beside };
}

it("pauses a villager's own clock while talking and resumes from the same spot", () => {
  const state: Pick<World, "npcTalks" | "npcOffsets" | "players"> = {
    npcTalks: { elder: { since: walking, listeners: ["hero"] } },
    npcOffsets: {},
    players: {
      hero: { x: 0, y: 0, sceneId: "EMBERBROOK_VILLAGE" } as World["players"][string],
    },
  };
  const before = npcPose(elder, walking);
  // Held: the same place at every later tick, standing still, facing the hero.
  for (const t of [walking + 1, walking + 90, walking + 600]) {
    const held = npcPose(elder, t, state);
    expect([held.x, held.y]).toEqual([before.x, before.y]);
    expect(held.moving).toBe(false);
  }
  expect(npcPose(elder, walking + 10, state).facing).toBe(
    Math.abs(before.x) >= Math.abs(before.y) ? "west" : "north",
  );
  // Released after 600 ticks: the offset absorbs the pause, so the walk
  // resumes exactly where it stopped and then advances at its normal pace.
  const released = { npcOffsets: { elder: 600 } };
  expect(npcClock("elder", walking + 600, released)).toBe(walking);
  const resumed = npcPose(elder, walking + 600, released);
  expect([resumed.x, resumed.y]).toEqual([before.x, before.y]);
  const next = npcPose(elder, walking + 601, released);
  expect(Math.hypot(next.x - resumed.x, next.y - resumed.y)).toBeCloseTo(
    elder.speed / SERVER_HZ,
    6,
  );
});

it("validates conversations on the server and holds a villager for every listener", () => {
  const { r, s, c, beside } = village();
  // Out of range, unknown names and other scenes are refused.
  Object.assign(s, { x: 40, y: 40 });
  expect(() => r.talkToNpc(s.id, "elder", true)).toThrow("closer");
  expect(() => r.talkToNpc(s.id, "nobody", true)).toThrow();
  beside(s);
  s.sceneId = "VILLAGE_COTTAGE";
  expect(() => r.talkToNpc(s.id, "elder", true)).toThrow("aren't here");
  s.sceneId = "EMBERBROOK_VILLAGE";
  // Both heroes can listen; the villager walks on only when both are done.
  expect(r.talkToNpc(s.id, "elder", true)).toEqual({ talking: true });
  beside(c);
  r.talkToNpc(c.id, "elder", true);
  const held = npcPose(elder, r.state.serverTick, r.state);
  for (let n = 0; n < ticksFor(2); n++) r.tick();
  expect(npcPose(elder, r.state.serverTick, r.state)).toMatchObject({
    x: held.x,
    y: held.y,
    moving: false,
  });
  r.talkToNpc(s.id, "elder", false);
  expect(r.state.npcTalks?.elder?.listeners).toEqual([c.id]);
  r.talkToNpc(c.id, "elder", false);
  expect(r.state.npcTalks?.elder).toBeUndefined();
  expect(r.state.npcOffsets?.elder).toBe(ticksFor(2));
  expect(npcPose(elder, r.state.serverTick, r.state)).toMatchObject({ x: held.x, y: held.y });
});

it("releases a conversation when its hero walks into a house, changes map or disconnects", () => {
  for (const leave of ["house", "map", "disconnect"] as const) {
    const { r, s, beside } = village();
    beside(s);
    r.talkToNpc(s.id, "elder", true);
    expect(r.state.npcTalks?.elder).toBeDefined();
    if (leave === "house") {
      Object.assign(s, maps.EMBERBROOK_VILLAGE.points.door_cottage);
      const session = r.sessions.get(s.id)!;
      session.input = { ...session.input, seq: session.input.seq + 1, interactHeld: true };
      session.received = Date.now();
      r.tick();
      expect(s.sceneId).toBe("VILLAGE_COTTAGE");
    }
    if (leave === "map") r.transition("TRANSITION_TRAIL");
    if (leave === "disconnect") r.disconnect(s.id);
    expect(r.state.npcTalks?.elder, leave).toBeUndefined();
  }
});

it("synchronizes a paused villager to both real clients and rejects malformed talk intents", async () => {
  const app = createApp({ startingScene: "EMBERBROOK_VILLAGE" });
  await new Promise<void>((res) => app.http.listen(0, "127.0.0.1", res));
  const port = (app.http.address() as { port: number }).port;
  const clients: Socket[] = [io(`http://127.0.0.1:${port}`), io(`http://127.0.0.1:${port}`)];
  const req = (s: Socket, event: string, p: unknown) =>
    new Promise<any>((res) => s.emit(event, p, res));
  try {
    await Promise.all(clients.map((s) => new Promise<void>((r) => s.on("connect", r))));
    const a = (await req(clients[0], "room:create", {})).data;
    await req(clients[1], "room:join", { roomCode: a.roomCode });
    await req(clients[0], "role:select", { role: "OATH" });
    await req(clients[1], "role:select", { role: "EMBER" });
    await req(clients[0], "lobby:ready", { ready: true });
    await req(clients[1], "lobby:ready", { ready: true });
    const room = app.manager.get(a.roomCode);
    const hero = room.state.players[a.playerId];
    const pose = npcPose(elder, room.state.serverTick, room.state);
    Object.assign(hero, { x: pose.x + NPC_TALK_RANGE - 10, y: pose.y });
    // Malformed or forged intents never reach the room.
    for (const bad of [
      { npcId: "elder" },
      { npcId: "elder", talking: "yes" },
      { npcId: "ELDER!", talking: true },
      { npcId: "elder", talking: true, x: 1 },
    ])
      expect((await req(clients[0], "npc:talk", bad)).ok).toBe(false);
    expect(room.state.npcTalks).toBeUndefined();
    expect(await req(clients[0], "npc:talk", { npcId: "elder", talking: true })).toEqual({
      ok: true,
      data: { talking: true },
    });
    // Both clients' snapshots show the same held villager.
    const seen = await Promise.all(
      clients.map((s) => new Promise<any>((res) => s.once("game:snapshot", res))),
    );
    const since = seen[0].npcTalks.elder.since;
    for (const w of seen) {
      expect(w.npcTalks.elder).toEqual({ since, listeners: [a.playerId] });
      // Held exactly where the villager stood when the server accepted the talk.
      const at = npcPose(elder, w.serverTick, w),
        then = npcPose(elder, since, { npcOffsets: w.npcOffsets });
      expect([at.x, at.y, at.moving]).toEqual([then.x, then.y, false]);
      expect(Math.hypot(at.x - pose.x, at.y - pose.y)).toBeLessThan(elder.speed);
    }
    await new Promise((r) => setTimeout(r, 300));
    expect((await req(clients[0], "npc:talk", { npcId: "elder", talking: false })).ok).toBe(true);
    // A snapshot already in flight may predate the release; take the first
    // one that reflects it (bounded wait).
    const after = await new Promise<any>((res, rej) => {
      const timer = setTimeout(() => rej(Error("no released snapshot")), 1500);
      const onSnap = (w: any) => {
        if (w.npcTalks?.elder) return;
        clearTimeout(timer);
        clients[1].off("game:snapshot", onSnap);
        res(w);
      };
      clients[1].on("game:snapshot", onSnap);
    });
    expect(after.npcTalks?.elder).toBeUndefined();
    expect(after.npcOffsets.elder).toBeGreaterThan(0);
  } finally {
    clients.forEach((s) => s.disconnect());
    await app.close();
  }
}, 15000);
