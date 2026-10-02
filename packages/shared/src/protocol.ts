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
// Only intent crosses this boundary. Snapshots acknowledge input sequences;
// authoritative outcomes remain recoverable even when transient packets drop.
export interface ClientEvents {
  "room:leave": (p: Record<string, never>, ack: Ack) => void;
  "room:create": (p: Record<string, never>, ack: Ack<Session>) => void;
  "room:join": (p: { roomCode: string }, ack: Ack<Session>) => void;
  "session:resume": (p: Session, ack: Ack<Session>) => void;
  "role:select": (p: { role: Role }, ack: Ack) => void;
  "appearance:select": (p: CharacterAppearance, ack: Ack) => void;
  "lobby:ready": (p: { ready: boolean }, ack: Ack) => void;
  "player:input": (p: InputFrame) => void;
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
