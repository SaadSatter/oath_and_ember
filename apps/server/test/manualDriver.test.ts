// manualDriver option (docs/midterm/SERVER_CHANGES.md §2): the caller owns the
// clock; the same per-room step and broadcasts run as under the 60 Hz loop.
import { describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createApp } from "../src/app.js";
import { SNAPSHOT_INTERVAL_TICKS } from "../../../packages/shared/src/constants.js";
import type { World } from "../../../packages/shared/src/gameTypes.js";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function listen(app: ReturnType<typeof createApp>) {
  await new Promise<void>((done) => app.http.listen(0, "127.0.0.1", done));
  return `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
}
const req = (s: Socket, event: string, p: unknown) =>
  new Promise<any>((resolve, reject) =>
    (s.timeout(2000) as any).emit(event, p, (err: unknown, r: any) => (err ? reject(err) : resolve(r))),
  );

/** Two real players in a started room, as the browser client makes one. */
async function startedRoom(url: string) {
  const clients = [io(url), io(url)];
  await Promise.all(clients.map((s) => new Promise<void>((d) => s.on("connect", d))));
  const a = (await req(clients[0], "room:create", { checkpoint: "goddess" })).data;
  await req(clients[1], "room:join", { roomCode: a.roomCode });
  await req(clients[0], "role:select", { role: "OATH" });
  await req(clients[1], "role:select", { role: "EMBER" });
  await req(clients[0], "lobby:ready", { ready: true });
  await req(clients[1], "lobby:ready", { ready: true });
  return { clients, roomCode: a.roomCode as string };
}

describe("manualDriver", () => {
  it("without the option, rooms advance on their own and step() is refused", async () => {
    const app = createApp();
    const url = await listen(app);
    const { clients, roomCode } = await startedRoom(url);
    try {
      const room = app.manager.get(roomCode);
      const before = room.state.serverTick;
      await wait(250);
      expect(room.state.serverTick).toBeGreaterThan(before);
      expect(() => app.step(roomCode)).toThrow(/manualDriver/);
    } finally {
      clients.forEach((s) => s.disconnect());
      await app.close();
    }
  });

  it("with the option, nothing ticks on its own and step() advances exactly one tick", async () => {
    const app = createApp({ manualDriver: true });
    const url = await listen(app);
    const { clients, roomCode } = await startedRoom(url);
    try {
      const room = app.manager.get(roomCode);
      const before = room.state.serverTick;
      await wait(250);
      expect(room.state.serverTick).toBe(before);
      for (let i = 0; i < 7; i++) app.step(roomCode);
      expect(room.state.serverTick).toBe(before + 7);
    } finally {
      clients.forEach((s) => s.disconnect());
      await app.close();
    }
  });

  it("manual steps send the same broadcasts as live play: snapshots on the interval, sync on scene change", async () => {
    const app = createApp({ manualDriver: true });
    const url = await listen(app);
    const { clients, roomCode } = await startedRoom(url);
    const snapshots: number[] = [],
      syncs: World[] = [],
      transitions: string[] = [];
    clients[0].on("game:snapshot", (w: World) => snapshots.push(w.serverTick));
    clients[0].on("state:sync", (w: World) => syncs.push(w));
    clients[0].on("scene:transition", (e: { sceneId: string }) => transitions.push(e.sceneId));
    try {
      const room = app.manager.get(roomCode);
      const start = room.state.serverTick;
      const steps = SNAPSHOT_INTERVAL_TICKS * 3;
      // Snapshots are volatile emits (dropped while a socket is busy), so steps
      // are spaced as live play spaces ticks rather than fired in one burst.
      for (let i = 0; i < steps; i++) {
        app.step(roomCode);
        await wait(17);
      }
      await wait(150);
      const expected = [];
      for (let t = start + 1; t <= start + steps; t++)
        if (t % SNAPSHOT_INTERVAL_TICKS === 0) expected.push(t);
      expect(snapshots).toEqual(expected);

      // Labelled test fixture: make the next tick change the room's scene, to
      // check stepRoom's transition broadcast (rules are not under test here).
      const tick = room.tick.bind(room);
      room.tick = () => {
        tick();
        room.state.sceneId = "GRIFFIN_ENCLOSURE";
      };
      const syncCount = syncs.length;
      app.step(roomCode);
      await wait(150);
      expect(transitions).toEqual(["GRIFFIN_ENCLOSURE"]);
      expect(syncs.length).toBe(syncCount + 1);
      expect(syncs.at(-1)!.sceneId).toBe("GRIFFIN_ENCLOSURE");
    } finally {
      clients.forEach((s) => s.disconnect());
      await app.close();
    }
  });

  it("session expiry inside a manual step uses the room's injected clock", async () => {
    let now = 0;
    const app = createApp({
      manualDriver: true,
      runtime: { now: () => now, id: (() => { let n = 0; return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`; })() },
    });
    const room = app.manager.create("goddess");
    const a = room.add("sock-a"),
      b = room.add("sock-b");
    room.disconnect(a.playerId, "sock-a");
    now = 30_001;
    app.step(room.state.roomCode);
    expect(room.sessions.has(a.playerId)).toBe(false);
    expect(room.sessions.has(b.playerId)).toBe(true);
    await app.close();
  });
});
