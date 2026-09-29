import express from "express";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { Server } from "socket.io";
import { z } from "zod";
import { RoomManager } from "./RoomManager.js";
import type {
  ClientEvents,
  ServerEvents,
} from "../../../packages/shared/src/protocol.js";
import type { GameRoom } from "./GameRoom.js";
const inputSchema = z
  .object({
    seq: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    moveX: z.number().int().min(-1).max(1),
    moveY: z.number().int().min(-1).max(1),
    jumpHeld: z.boolean(),
    primaryHeld: z.boolean(),
    secondaryHeld: z.boolean(),
    interactHeld: z.boolean(),
  })
  .strict();
export function createApp() {
  const app = express(),
    http = createServer(app),
    manager = new RoomManager();
  const io = new Server<ClientEvents, ServerEvents>(http);
  app.get("/healthz", (_req, res) =>
    res.json({ ok: true, rooms: manager.rooms.size }),
  );
  app.use(express.static(resolve("dist/client")));
  io.on("connection", (socket) => {
    let room: GameRoom | undefined,
      id = "";
    let lastInput = 0;
    const sync = () => {
      if (room) io.to(room.state.roomCode).emit("state:sync", room.state);
    };
    const attach = (r: GameRoom, s: { playerId: string }) => {
      room = r;
      id = s.playerId;
      socket.join(r.state.roomCode);
      sync();
    };
    const request = (ack: unknown, fn: () => unknown) => {
      if (typeof ack !== "function") return;
      try {
        ack({ ok: true, data: fn() });
      } catch (e) {
        ack({
          ok: false,
          error: e instanceof Error ? e.message : "Invalid request",
        });
      }
    };
    const requireRoom = () => {
      if (!room || !room.sessions.has(id)) throw Error("Join a room first.");
      return room;
    };
    socket.on("room:create", (_p, ack) =>
      request(ack, () => {
        if (room) throw Error("Already in a room.");
        const r = manager.create(),
          s = r.add(socket.id);
        attach(r, s);
        return s;
      }),
    );
    socket.on("room:join", (p, ack) =>
      request(ack, () => {
        if (room) throw Error("Already in a room.");
        const code = z
          .string()
          .trim()
          .regex(/^[a-zA-Z2-9]{6}$/)
          .parse(p?.roomCode);
        const r = manager.get(code),
          s = r.add(socket.id);
        attach(r, s);
        return s;
      }),
    );
    socket.on("session:resume", (p, ack) =>
      request(ack, () => {
        if (room) throw Error("Already in a room.");
        const r = manager.get(z.string().parse(p?.roomCode));
        const s = r.resume(
          z.string().parse(p?.playerId),
          z.string().parse(p?.reconnectToken),
          socket.id,
        );
        attach(r, s);
        return s;
      }),
    );
    socket.on("role:select", (p, ack) =>
      request(ack, () => {
        requireRoom().select(id, z.enum(["OATH", "EMBER"]).parse(p?.role));
        sync();
      }),
    );
    socket.on("lobby:ready", (p, ack) =>
      request(ack, () => {
        requireRoom().ready(id, z.boolean().parse(p?.ready));
        sync();
      }),
    );
    socket.on("skill:unlock", (p, ack) =>
      request(ack, () => {
        requireRoom().unlock(id, z.string().parse(p?.nodeId));
        sync();
      }),
    );
    socket.on("game:restart", (_p, ack) =>
      request(ack, () => {
        const r = requireRoom();
        if (r.state.phase !== "COMPLETE")
          throw Error("Finish the encounter before replaying.");
        r.reset();
        r.state.phase = "PLAYING";
        sync();
      }),
    );
    socket.on("player:input", (data) => {
      const parsed = inputSchema.safeParse(data);
      if (!parsed.success || !room || Date.now() - lastInput < 10) return;
      const s = room.sessions.get(id);
      if (
        !s ||
        parsed.data.seq <=
          Math.max(s.input.seq, room.state.players[id].lastProcessedInputSeq)
      )
        return;
      lastInput = Date.now();
      s.input = parsed.data;
      s.received = lastInput;
    });
    socket.on("disconnect", () => {
      if (room) {
        room.disconnect(id);
        io.to(room.state.roomCode).emit("connection:status", {
          connected: false,
        });
        sync();
      }
    });
  });
  let previous = performance.now(),
    accumulator = 0;
  // At most five catch-up steps prevent a stalled process from spiraling forever.
  const timer = setInterval(() => {
    const now = performance.now();
    accumulator += Math.min((now - previous) / 1000, 5 / 30);
    previous = now;
    while (accumulator >= 1 / 30) {
      accumulator -= 1 / 30;
      for (const [code, r] of manager.rooms) {
        for (const [id, s] of r.sessions)
          if (s.expires < Date.now()) {
            r.sessions.delete(id);
            delete r.state.players[id];
            r.state.phase = "LOBBY";
            io.to(code).emit("state:sync", r.state);
          }
        if (!r.sessions.size) {
          manager.rooms.delete(code);
          continue;
        }
        const scene = r.state.sceneId,
          phase = r.state.phase;
        r.tick();
        if (scene !== r.state.sceneId) {
          io.to(code).emit("scene:transition", { sceneId: r.state.sceneId });
          io.to(code).emit("state:sync", r.state);
        }
        if (phase !== "COMPLETE" && r.state.phase === "COMPLETE")
          io.to(code).emit("game:complete", { victory: true });
        if (r.state.serverTick % 2 === 0)
          io.to(code).volatile.emit("game:snapshot", r.state);
      }
    }
  }, 8);
  return {
    app,
    http,
    io,
    manager,
    close: async () => {
      clearInterval(timer);
      await new Promise<void>((res) => io.close(() => res()));
    },
  };
}
