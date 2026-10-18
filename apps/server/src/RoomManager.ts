import type { SceneId } from "../../../packages/shared/src/gameTypes.js";
import { randomInt } from "node:crypto";
import { GameRoom } from "./GameRoom.js";
export class RoomManager {
  constructor(
    readonly encounter = false,
    readonly startingScene: SceneId = "MAIN_HOUSE",
    readonly prologue = false,
  ) {}
  rooms = new Map<string, GameRoom>();
  create() {
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
      this.encounter,
      this.startingScene,
      this.prologue,
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
