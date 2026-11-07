// View-only browser attachment (docs/midterm/SERVER_CHANGES.md §3, option B).
// A recording browser renders one hero's view, owns no session, and the server
// refuses every intent from it. Real Socket.IO, as AGENTS.md requires.
import { describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createApp } from "../src/app.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
import type { World } from "../../../packages/shared/src/gameTypes.js";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const req = (s: Socket, event: string, p: unknown) =>
  new Promise<any>((resolve, reject) =>
    (s.timeout(2000) as any).emit(event, p, (err: unknown, r: any) => (err ? reject(err) : resolve(r))),
  );

/** An evaluation host: manual clock, viewers on, two agent heroes with no sockets. */
async function host(viewers = true) {
  const app = createApp({ manualDriver: true, viewers });
  await new Promise<void>((d) => app.http.listen(0, "127.0.0.1", d));
  const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
  const room = app.manager.create("goddess");
  const sieg = room.add("agent-sieg").playerId,
    coco = room.add("agent-coco").playerId;
  room.select(sieg, "OATH");
  room.select(coco, "EMBER");
  room.ready(sieg, true);
  room.ready(coco, true);
  // The goddess's greeting starts after a short lead-in (line -1); wait for line 0.
  for (let i = 0; i < 600 && !((room.state.story?.cutscene?.line ?? -1) >= 0); i++) app.step(room.state.roomCode);
  const sockets: Socket[] = [];
  const connect = async () => {
    const s = io(url, { forceNew: true });
    sockets.push(s);
    await new Promise<void>((d) => s.on("connect", d));
    return s;
  };
  const close = async () => {
    sockets.forEach((s) => s.disconnect());
    await app.close();
  };
  return { app, room, sieg, coco, roomCode: room.state.roomCode, connect, close };
}

describe("view-only attachment", () => {
  it("is refused when the server was not started with viewers", async () => {
    const h = await host(false);
    try {
      expect(() => h.app.registerViewer(h.roomCode, h.sieg)).toThrow(/disabled/);
      const s = await h.connect();
      const r = await req(s, "view:attach", { roomCode: h.roomCode, playerId: h.sieg, viewToken: "x".repeat(32) });
      expect(r).toEqual({ ok: false, error: "View-only sessions are disabled." });
    } finally {
      await h.close();
    }
  });

  it("accepts only a matching, unused token for that room and hero", async () => {
    const h = await host();
    try {
      const token = h.app.registerViewer(h.roomCode, h.sieg);
      const bad = [
        { roomCode: h.roomCode, playerId: h.sieg, viewToken: "y".repeat(32) },
        { roomCode: h.roomCode, playerId: h.coco, viewToken: token },
      ];
      for (const p of bad) {
        const s = await h.connect();
        expect((await req(s, "view:attach", p)).ok).toBe(false);
      }
      const other = h.app.manager.create("goddess");
      other.add("other-a");
      const s0 = await h.connect();
      expect((await req(s0, "view:attach", { roomCode: other.state.roomCode, playerId: h.sieg, viewToken: token })).ok).toBe(false);
      // The token was not consumed by the failures above; it works once.
      const s1 = await h.connect();
      const ok = await req(s1, "view:attach", { roomCode: h.roomCode, playerId: h.sieg, viewToken: token });
      expect(ok).toEqual({ ok: true, data: { roomCode: h.roomCode, playerId: h.sieg, viewOnly: true } });
      const s2 = await h.connect();
      expect((await req(s2, "view:attach", { roomCode: h.roomCode, playerId: h.sieg, viewToken: token })).ok).toBe(false);
      // Attaching never takes over the hero's session.
      expect(h.room.sessions.get(h.sieg)!.socketId).toBe("agent-sieg");
      expect(h.room.state.players[h.sieg].connected).toBe(true);
    } finally {
      await h.close();
    }
  });

  it("receives the same state broadcasts as a player", async () => {
    const h = await host();
    try {
      const s = await h.connect();
      const syncs: World[] = [],
        snaps: number[] = [];
      s.on("state:sync", (w: World) => syncs.push(w));
      s.on("game:snapshot", (w: World) => snaps.push(w.serverTick));
      await req(s, "view:attach", { roomCode: h.roomCode, playerId: h.coco, viewToken: h.app.registerViewer(h.roomCode, h.coco) });
      await wait(50);
      expect(syncs.length).toBeGreaterThan(0);
      expect(syncs[0].players[h.coco].role).toBe("EMBER");
      for (let i = 0; i < 6; i++) {
        h.app.step(h.roomCode);
        await wait(17);
      }
      await wait(100);
      expect(snaps.length).toBeGreaterThan(0);
    } finally {
      await h.close();
    }
  });

  it("rejects every intent request and leaves the world unchanged", async () => {
    const h = await host();
    try {
      const s = await h.connect();
      await req(s, "view:attach", { roomCode: h.roomCode, playerId: h.sieg, viewToken: h.app.registerViewer(h.roomCode, h.sieg) });
      const cut = h.room.state.story?.cutscene;
      expect(cut?.id).toBe("goddess-meet");
      const attempts: [string, unknown][] = [
        ["story:read", { cutscene: cut!.id, line: cut!.line }],
        ["story:choose", { cutscene: cut!.id, line: cut!.line, choice: "promise" }],
        ["inventory:use", { requestId: "r1", targetId: "goddess-offering", itemId: "griffin_wig" }],
        ["npc:talk", { npcId: "goddess", talking: true }],
        ["role:select", { role: "EMBER" }],
        ["appearance:select", {}],
        ["lobby:ready", { ready: false }],
        ["skill:unlock", { nodeId: "slow_time" }],
        ["game:restart", {}],
        ["room:leave", {}],
        ["room:create", {}],
        ["room:join", { roomCode: h.roomCode }],
        ["session:resume", { roomCode: h.roomCode, playerId: h.sieg, reconnectToken: "x" }],
      ];
      for (const [event, payload] of attempts) {
        const before = JSON.stringify(h.room.state);
        const r = await req(s, event, payload);
        expect({ event, r }).toEqual({ event, r: { ok: false, error: "View-only session." } });
        expect(JSON.stringify(h.room.state)).toBe(before);
      }
      expect(h.room.sessions.size).toBe(2);
    } finally {
      await h.close();
    }
  });

  it("ignores player:input: ten steps later the hero has moved only as the agent asked", async () => {
    const h = await host();
    try {
      const s = await h.connect();
      await req(s, "view:attach", { roomCode: h.roomCode, playerId: h.sieg, viewToken: h.app.registerViewer(h.roomCode, h.sieg) });
      const p = h.room.state.players[h.sieg];
      const seqBefore = h.room.sessions.get(h.sieg)!.input.seq;
      for (let i = 1; i <= 10; i++) {
        s.emit("player:input", { ...neutral(seqBefore + i), moveX: 1, primaryHeld: true });
        await wait(5);
        h.app.step(h.roomCode);
      }
      await wait(50);
      expect(h.room.sessions.get(h.sieg)!.input.seq).toBe(seqBefore);
      expect(p.lastProcessedInputSeq).toBeLessThanOrEqual(seqBefore);
      expect(h.room.sessions.get(h.sieg)!.input.moveX).toBe(0);
    } finally {
      await h.close();
    }
  });

  it("a viewer disconnecting leaves the hero connected, its input intact and the story running", async () => {
    const h = await host();
    try {
      const s = await h.connect();
      await req(s, "view:attach", { roomCode: h.roomCode, playerId: h.sieg, viewToken: h.app.registerViewer(h.roomCode, h.sieg) });
      // The agent (not the browser) holds input for Sieg.
      const seq = h.room.sessions.get(h.sieg)!.input.seq + 1;
      expect(h.room.receiveInput(h.sieg, { ...neutral(seq), moveX: 1 })).toBe(true);
      const story = { ...h.room.state.story!.cutscene! };
      s.disconnect();
      await wait(100);
      expect(h.room.state.players[h.sieg].connected).toBe(true);
      expect(h.room.sessions.get(h.sieg)!.socketId).toBe("agent-sieg");
      expect(h.room.sessions.get(h.sieg)!.input.moveX).toBe(1);
      // Advancing a line still works: the scene is not paused by a missing hero.
      const r = h.room.readStoryLine(h.sieg, story.id, story.line);
      h.app.step(h.roomCode);
      expect(r.accepted).toBe(true);
      expect(h.room.state.story!.cutscene!.line).toBeGreaterThan(story.line);
    } finally {
      await h.close();
    }
  });
});
