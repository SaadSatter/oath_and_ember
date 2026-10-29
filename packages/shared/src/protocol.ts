import type { CharacterAppearance } from "./appearance.js";
import type { World, Role, InputFrame } from "./gameTypes.js";
export type Result<T = unknown> =
  { ok: true; data: T } | { ok: false; error: string };
export interface Session {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
}
export type Ack<T = unknown> = (r: Result<T>) => void;
/**
 * A view-only attachment (evaluation recording): renders one hero's view but
 * holds no reconnect token and cannot submit intent. Only enabled on servers
 * created with `viewers: true`.
 */
export interface ViewSession {
  roomCode: string;
  playerId: string;
  viewOnly: true;
}
// Only intent crosses this boundary. Snapshots acknowledge input sequences;
// authoritative outcomes remain recoverable even when transient packets drop.
export interface ClientEvents {
  "inventory:use": (
    p: import("./items.js").ItemIntent,
    ack: Ack<import("./items.js").ItemOutcome>,
  ) => void;
  "room:leave": (p: Record<string, never>, ack: Ack) => void;
  /** Start or end a conversation; the server pauses the villager for all. */
  "npc:talk": (
    p: { npcId: string; talking: boolean },
    ack: Ack<{ talking: boolean; story?: boolean }>,
  ) => void;
  /** "I've read this story line"; the server moves the scene on. */
  "story:read": (
    p: { cutscene: string; line: number },
    ack: Ack<{ accepted: boolean }>,
  ) => void;
  /** "This is my reason" at a choosing story line (each hero, once). */
  "story:choose": (
    p: { cutscene: string; line: number; choice: string },
    ack: Ack<{ accepted: boolean }>,
  ) => void;
  "room:create": (
    p: { checkpoint?: import("./storyCheckpoints.js").StoryCheckpointId },
    ack: Ack<Session>,
  ) => void;
  "room:join": (p: { roomCode: string }, ack: Ack<Session>) => void;
  "session:resume": (p: Session, ack: Ack<Session>) => void;
  /** Attach a view-only browser with a single-use token from the evaluation host. */
  "view:attach": (
    p: { roomCode: string; playerId: string; viewToken: string },
    ack: Ack<ViewSession>,
  ) => void;
  "role:select": (p: { role: Role }, ack: Ack) => void;
  "appearance:select": (p: CharacterAppearance, ack: Ack) => void;
  "lobby:ready": (p: { ready: boolean }, ack: Ack) => void;
  "clock:probe": (
    p: Record<string, never>,
    ack: Ack<{ serverTick: number }>,
  ) => void;
  "player:input": (p: InputFrame | { frames: InputFrame[] }) => void;
  "skill:unlock": (p: { nodeId: string }, ack: Ack) => void;
  "game:restart": (p: Record<string, never>, ack: Ack) => void;
}
export interface ServerEvents {
  "room:state": (s: World) => void;
  "state:sync": (s: World) => void;
  "game:snapshot": (s: World) => void;
  "scene:transition": (s: { sceneId: string }) => void;
  "connection:status": (s: { connected: boolean }) => void;
  "game:complete": (s: { victory: boolean }) => void;
  "game:event": (s: { eventId: string; kind: string }) => void;
  "server:error": (s: { message: string }) => void;
}
