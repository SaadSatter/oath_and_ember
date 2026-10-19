import type { SceneId } from "../../../packages/shared/src/gameTypes.js";
import express from "express";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { Server } from "socket.io";
import { z } from "zod";
import { storyCheckpointIds } from "../../../packages/shared/src/storyCheckpoints.js";
import { RoomManager } from "./RoomManager.js";
import type {
  ClientEvents,
  ServerEvents,
} from "../../../packages/shared/src/protocol.js";
import type { GameRoom } from "./GameRoom.js";
import {
  DT,
  SNAPSHOT_INTERVAL_TICKS,
} from "../../../packages/shared/src/constants.js";
const inputSchema = z
  .object({
    targetTick: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
    movementEpoch: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
    seq: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    moveX: z.number().int().min(-1).max(1),
    moveY: z.number().int().min(-1).max(1),
    jumpHeld: z.boolean(),
    primaryHeld: z.boolean(),
    secondaryHeld: z.boolean(),
    sprintHeld: z.boolean().optional(),
    slowTimeHeld: z.boolean().optional(),
    flightHeld: z.boolean().optional(),
    blackHoleHeld: z.boolean().optional(),
    pushHeld: z.boolean().optional(),
    interactHeld: z.boolean(),
  })
  .strict();
const inputPacketSchema = z.union([
  inputSchema,
  z.object({ frames: z.array(inputSchema).min(1).max(6) }).strict(),
]);
export function createApp(
  options: {
    encounter?: boolean;
    startingScene?: SceneId;
    prologue?: boolean;
  } = {},
) {
  const app = express(),
    http = createServer(app),
    manager = new RoomManager(
      options.encounter,
      options.startingScene,
      options.prologue,
    );
  const io = new Server<ClientEvents, ServerEvents>(http);
  app.get("/healthz", (_req, res) =>
    res.json({ ok: true, rooms: manager.rooms.size }),
  );
  app.use(express.static(resolve("dist/client")));
  io.on("connection", (socket) => {
    let room: GameRoom | undefined,
      id = "";
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
    socket.on("room:leave", (p, ack) =>
      request(ack, () => {
        z.object({}).strict().parse(p);
        const r = requireRoom();
        if (r.state.phase !== "LOBBY")
          throw Error("Return to the main page from the lobby.");
        socket.leave(r.state.roomCode);
        r.sessions.delete(id);
        delete r.state.players[id];
        for (const player of Object.values(r.state.players))
          player.ready = false;
        if (!r.sessions.size) manager.rooms.delete(r.state.roomCode);
        else io.to(r.state.roomCode).emit("state:sync", r.state);
        room = undefined;
        id = "";
      }),
    );
    socket.on("room:create", (p, ack) =>
      request(ack, () => {
        if (room) throw Error("Already in a room.");
        const parsed = z
          .object({ checkpoint: z.enum(storyCheckpointIds).optional() })
          .strict()
          .parse(p);
        const r = manager.create(parsed.checkpoint),
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
        const playerId = z.string().parse(p?.playerId);
        const prior = r.sessions.get(playerId)?.socketId;
        const s = r.resume(
          playerId,
          z.string().parse(p?.reconnectToken),
          socket.id,
        );
        // The session's old socket (if it is somehow still open) is closed.
        if (prior && prior !== socket.id)
          io.sockets.sockets.get(prior)?.disconnect(true);
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
    socket.on("appearance:select", (p, ack) =>
      request(ack, () => {
        requireRoom().setAppearance(id, p);
        sync();
      }),
    );
    socket.on("lobby:ready", (p, ack) =>
      request(ack, () => {
        requireRoom().ready(id, z.boolean().parse(p?.ready));
        sync();
      }),
    );
    socket.on("inventory:use", (p, ack) =>
      request(ack, () => {
        const intent = z
          .object({
            requestId: z
              .string()
              .min(1)
              .max(80)
              .regex(/^[a-zA-Z0-9_-]+$/),
            targetId: z.string().min(1).max(100),
            itemId: z
              .enum([
                "hedge_gate_key",
                "enchanted_shears",
                "vanity_mirror",
                "griffin_wig",
              ])
              .optional(),
          })
          .strict()
          .parse(p);
        const result = requireRoom().useItem(id, intent);
        sync();
        return result;
      }),
    );
    // Conversation is presentation, but pausing a villager is shared state:
    // the server checks range and holds the villager for both clients.
    socket.on("npc:talk", (p, ack) =>
      request(ack, () => {
        const intent = z
          .object({
            npcId: z
              .string()
              .min(1)
              .max(40)
              .regex(/^[a-z0-9_-]+$/),
            talking: z.boolean(),
          })
          .strict()
          .parse(p);
        const result = requireRoom().talkToNpc(
          id,
          intent.npcId,
          intent.talking,
        );
        sync();
        return result;
      }),
    );
    socket.on("story:read", (p, ack) =>
      request(ack, () => {
        const intent = z
          .object({
            cutscene: z
              .string()
              .min(1)
              .max(40)
              .regex(/^[a-z0-9_-]+$/),
            line: z.number().int().min(0).max(500),
          })
          .strict()
          .parse(p);
        const result = requireRoom().readStoryLine(
          id,
          intent.cutscene,
          intent.line,
        );
        sync();
        return result;
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
      const parsed = inputPacketSchema.safeParse(data);
      if (!parsed.success || !room) return;
      for (const frame of "frames" in parsed.data
        ? parsed.data.frames
        : [parsed.data])
        room.receiveInput(id, frame);
    });
    socket.on("clock:probe", (_p, ack) =>
      request(ack, () => ({ serverTick: requireRoom().state.serverTick })),
    );
    socket.on("disconnect", () => {
      if (room) {
        room.disconnect(id, socket.id);
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
    accumulator += Math.min((now - previous) / 1000, 5 * DT);
    previous = now;
    while (accumulator >= DT) {
      accumulator -= DT;
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
        if (r.state.serverTick % SNAPSHOT_INTERVAL_TICKS === 0)
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
