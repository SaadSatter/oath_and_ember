import { it, expect } from "vitest";
import { io } from "socket.io-client";
import { createApp } from "../src/app.js";
it("leaves a lobby, releases its slot, updates the partner, and permits creating/joining again", async () => {
  const app = createApp();
  await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
  const clients = [io(url), io(url)];
  const req = (index: number, event: string, p: unknown) =>
    new Promise<any>((resolve, reject) =>
      clients[index]
        .timeout(2000)
        .emit(event, p, (err: Error, result: unknown) =>
          err ? reject(err) : resolve(result),
        ),
    );
  try {
    await Promise.all(
      clients.map((s) => new Promise<void>((r) => s.on("connect", r))),
    );
    const first = (await req(0, "room:create", {})).data;
    await req(1, "room:join", { roomCode: first.roomCode });
    await req(0, "role:select", { role: "OATH" });
    await req(1, "role:select", { role: "EMBER" });
    await req(1, "lobby:ready", { ready: true });
    expect((await req(0, "room:leave", { playerId: "other" })).ok).toBe(false);
    const partnerUpdate = new Promise<any>((r) =>
      clients[1].once("state:sync", r),
    );
    expect((await req(0, "room:leave", {})).ok).toBe(true);
    const updated = await partnerUpdate;
    expect(updated.players[first.playerId]).toBeUndefined();
    expect(Object.values(updated.players)).toHaveLength(1);
    expect(Object.values(updated.players)[0]).toMatchObject({ ready: false });
    expect((await req(0, "session:resume", first)).ok).toBe(false);
    expect((await req(0, "room:join", { roomCode: first.roomCode })).ok).toBe(
      true,
    );
    expect((await req(0, "role:select", { role: "OATH" })).ok).toBe(true);
    await req(0, "lobby:ready", { ready: true });
    await req(1, "lobby:ready", { ready: true });
    expect((await req(0, "room:leave", {})).ok).toBe(false);
    const room = app.manager.get(first.roomCode);
    room.state.phase = "LOBBY";
    await req(0, "room:leave", {});
    await req(1, "room:leave", {});
    expect(app.manager.rooms.has(first.roomCode)).toBe(false);
    expect((await req(0, "room:create", {})).ok).toBe(true);
  } finally {
    clients.forEach((s) => s.disconnect());
    await app.close();
  }
});
