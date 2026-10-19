import { expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createApp } from "../src/app.js";
import { RoomManager } from "../src/RoomManager.js";
import {
  storyCheckpointIds,
  type StoryCheckpointId,
} from "../../../packages/shared/src/storyCheckpoints.js";
import { collisionRects } from "../../../packages/shared/src/maps.js";
import {
  BURIAL_FLAG,
  FUNERAL,
  CLUES,
  spotsFor,
  storyTalk,
} from "../../../packages/shared/src/chapter0.js";
import {
  cutscenes,
  graveVisible,
} from "../../../packages/shared/src/prologue.js";
import type { World } from "../../../packages/shared/src/gameTypes.js";
import type { Session, Result } from "../../../packages/shared/src/protocol.js";

const stage = {
  prologue: "ARRIVAL",
  shopping: "ERRAND",
  funeral: "MOURNING",
  investigation: "INVESTIGATION",
} as const;
function opening(room: ReturnType<RoomManager["create"]>) {
  for (let guard = 0; room.state.story?.cutscene && guard < 300; guard++) {
    const run = room.state.story.cutscene;
    if (run.line < 0) {
      room.tick();
      continue;
    }
    for (const player of Object.values(room.state.players))
      room.readStoryLine(player.id, run.id, run.line);
  }
  expect(room.state.story?.cutscene).toBeUndefined();
}

for (const checkpoint of storyCheckpointIds) {
  it(`initializes and replays the ${checkpoint} checkpoint with coherent story state`, () => {
    const room = new RoomManager().create(checkpoint);
    const a = room.add("a"),
      b = room.add("b");
    room.select(a.playerId, "OATH");
    room.select(b.playerId, "EMBER");
    room.ready(a.playerId, true);
    room.ready(b.playerId, true);
    expect(room.state.storyStart).toBe(checkpoint);
    expect(room.state.story!.stage).toBe(stage[checkpoint]);
    for (const player of Object.values(room.state.players)) {
      expect(player.hp).toBe(100);
      expect(
        collisionRects(player.sceneId!, room.state.puzzles).some(
          (wall) =>
            player.x + 13 > wall.x &&
            player.x - 13 < wall.x + wall.w &&
            player.y + 13 > wall.y &&
            player.y - 13 < wall.y + wall.h,
        ),
      ).toBe(false);
    }
    opening(room);
    const state = room.state;
    if (checkpoint === "shopping") {
      expect(state.story!.stage).toBe("ERRAND");
      expect(state.story!.alden?.action).toBe("idle");
      expect(state.players[a.playerId].sceneId).toBe("VILLAGE_COTTAGE_UPPER");
      expect(state.inventory!.counts).toEqual({});
      expect(storyTalk(state.story, "EMBER", "healer", cutscenes)).toBe(
        "errand-brynn",
      );
    }
    if (checkpoint === "funeral") {
      expect(state.story!.stage).toBe("FUNERAL_PREP");
      expect(state.story!.alden).toBeUndefined();
      expect(graveVisible(state.story)).toBe(false);
      expect(state.inventory!.counts.wooden_sword).toBe(1);
      expect(state.inventory!.counts.crystal_vial).toBe(2);
      expect(
        spotsFor(state.story, "OATH").filter((spot) =>
          spot.id.startsWith("stone-"),
        ),
      ).toHaveLength(3);
      expect(
        spotsFor(state.story, "EMBER").filter((spot) =>
          spot.id.startsWith("flower-"),
        ),
      ).toHaveLength(3);
    }
    if (checkpoint === "investigation") {
      expect(state.sceneId).toBe("EMBERBROOK_VILLAGE");
      expect(state.story!.flags).toContain(BURIAL_FLAG);
      expect(state.story!.flags).toContain(FUNERAL.done);
      expect(
        state.story!.flags.some((flag) =>
          Object.values(CLUES).some((clue) => clue === flag),
        ),
      ).toBe(false);
      expect(graveVisible(state.story)).toBe(true);
      expect(state.story!.alden).toBeUndefined();
      for (const id of ["wooden_sword", "wildflowers", "river_stone"] as const)
        expect(state.inventory!.counts[id] ?? 0).toBe(0);
      expect(storyTalk(state.story, "OATH", "elder", cutscenes)).toBe(
        "ask-bertram",
      );
    }
    const expected = structuredClone(state.inventory);
    room.reset();
    room.state.phase = "PLAYING";
    opening(room);
    expect(room.state.inventory).toEqual(expected);
    expect(room.state.storyStart).toBe(checkpoint);
  });
}

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

for (const checkpoint of storyCheckpointIds)
  it(`synchronizes ${checkpoint} to both clients and preserves it on reconnect`, async () => {
    const app = createApp();
    await new Promise<void>((done) => app.http.listen(0, "127.0.0.1", done));
    const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
    const sockets = [
      io(url, { transports: ["websocket"], autoConnect: false }),
      io(url, { transports: ["websocket"], autoConnect: false }),
    ];
    const states: World[] = [];
    sockets.forEach((socket, index) =>
      socket.on("state:sync", (world) => {
        states[index] = world;
      }),
    );
    try {
      const connections = sockets.map(connected);
      sockets.forEach((socket) => socket.connect());
      await Promise.all(connections);
      for (const payload of [
        { checkpoint: "unknown" },
        { checkpoint, stage: "DONE" },
        { checkpoint, inventory: { wooden_sword: 99 } },
        { checkpoint, hp: 999 },
        null,
      ])
        expect((await request(sockets[0], "room:create", payload)).ok).toBe(
          false,
        );
      expect(app.manager.rooms.size).toBe(0);
      const created = await request<Session>(sockets[0], "room:create", {
        checkpoint,
      });
      if (!created.ok) throw Error(created.error);
      const session = created.data;
      const joined = await request<Session>(sockets[1], "room:join", {
        roomCode: session.roomCode,
        checkpoint: "prologue",
      });
      expect(joined.ok).toBe(true);
      expect(states.map((world) => world.storyStart)).toEqual([
        checkpoint,
        checkpoint,
      ]);
      await request(sockets[0], "role:select", { role: "OATH" });
      await request(sockets[1], "role:select", { role: "EMBER" });
      await request(sockets[0], "lobby:ready", { ready: true });
      await request(sockets[1], "lobby:ready", { ready: true });
      expect(states.map((world) => world.storyStart)).toEqual([
        checkpoint,
        checkpoint,
      ]);
      expect(states[0].story).toEqual(states[1].story);
      expect(states[0].inventory).toEqual(states[1].inventory);
      expect(states[0].phase).toBe("PLAYING");
      const room = app.manager.get(session.roomCode);
      expect(
        (await request(sockets[1], "room:create", { checkpoint: "prologue" }))
          .ok,
      ).toBe(false);
      sockets[0].disconnect();
      const connection = connected(sockets[0]);
      sockets[0].connect();
      await connection;
      expect((await request(sockets[0], "session:resume", session)).ok).toBe(
        true,
      );
      expect(states[0].storyStart).toBe(checkpoint);
      expect(states[0].roomCode).toBe(room.state.roomCode);
      room.state.phase = "COMPLETE";
      expect((await request(sockets[0], "game:restart", {})).ok).toBe(true);
      expect(room.state.storyStart).toBe(checkpoint);
      expect(room.state.story!.stage).toBe(stage[checkpoint]);
    } finally {
      sockets.forEach((socket) => socket.disconnect());
      await app.close();
    }
  });
