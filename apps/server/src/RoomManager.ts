import type { SceneId } from "../../../packages/shared/src/gameTypes.js";
import { randomInt } from "node:crypto";
import { GameRoom, type RoomRuntime } from "./GameRoom.js";
import type { StoryCheckpointId } from "../../../packages/shared/src/storyCheckpoints.js";
export class RoomManager {
  constructor(
    readonly encounter = false,
    readonly startingScene: SceneId = "MAIN_HOUSE",
    readonly prologue = false,
    readonly runtime?: RoomRuntime,
  ) {}
  rooms = new Map<string, GameRoom>();
  create(checkpoint?: StoryCheckpointId) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;
    do {
      code = Array.from(
        { length: 6 },
        () => alphabet[randomInt(alphabet.length)],
      ).join("");
    } while (this.rooms.has(code));
    const room = new GameRoom(
      code,
      checkpoint ? false : this.encounter,
      checkpoint ? "MAIN_HOUSE" : this.startingScene,
      checkpoint ? true : this.prologue,
      checkpoint,
      this.runtime,
    );
    this.rooms.set(code, room);
    return room;
  }
  get(code: string) {
    const room = this.rooms.get(code.trim().toUpperCase());
    if (!room) throw Error("Room not found. Check the code.");
    return room;
  }
}
