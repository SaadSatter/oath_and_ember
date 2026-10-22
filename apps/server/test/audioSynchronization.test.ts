import { it, expect } from "vitest";
import { io } from "socket.io-client";
import { createApp } from "../src/app.js";
import { SoundEvents } from "../../client/src/audio/SoundEvents.js";
import type { World } from "../../../packages/shared/src/gameTypes.js";
it("two real clients derive the same once-only world cue from existing authoritative snapshots", async () => {
  const app = createApp({ encounter: true });
  await new Promise<void>((done) => app.http.listen(0, "127.0.0.1", done));
  const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
  const clients = [io(url), io(url)],
    histories = clients.map(() => new Map<number, World>());
  const req = (s: any, event: string, p: unknown) =>
    new Promise<any>((resolve, reject) =>
      s
        .timeout(2000)
        .emit(event, p, (err: unknown, result: any) =>
          err ? reject(err) : resolve(result),
        ),
    );
  clients.forEach((s, i) =>
    s.on("game:snapshot", (w: World) => histories[i].set(w.serverTick, w)),
  );
  try {
    await Promise.all(
      clients.map((s) => new Promise<void>((done) => s.on("connect", done))),
    );
    const a = (await req(clients[0], "room:create", {})).data;
    await req(clients[1], "room:join", { roomCode: a.roomCode });
    await req(clients[0], "role:select", { role: "OATH" });
    await req(clients[1], "role:select", { role: "EMBER" });
    await req(clients[0], "lobby:ready", { ready: true });
    await req(clients[1], "lobby:ready", { ready: true });
    await new Promise((done) => setTimeout(done, 130));
    const room = app.manager.get(a.roomCode),
      p = room.state.players[a.playerId];
    p.combat = {
      kind: "sword",
      seq: room.state.serverTick,
      startedTick: room.state.serverTick,
      facing: 0,
    };
    await new Promise((done) => setTimeout(done, 180));
    const ticks = [...histories[0].keys()]
      .filter((t) => histories[1].has(t))
      .sort((a, b) => a - b);
    expect(ticks.length).toBeGreaterThan(3);
    const listeners = [new SoundEvents(), new SoundEvents()];
    const cues = listeners.map((listener, i) =>
      ticks.flatMap((t) =>
        listener
          .observe(histories[i].get(t)!, a.playerId)
          .shots.map((s) => s.name),
      ),
    );
    expect(cues[0]).toEqual(cues[1]);
    expect(cues[0].filter((n) => n === "Sieg normal sword swing")).toHaveLength(
      1,
    );
  } finally {
    clients.forEach((s) => s.disconnect());
    await app.close();
  }
}, 15000);
