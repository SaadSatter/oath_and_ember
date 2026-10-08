import { io, type Socket } from "socket.io-client";
import type {
  ClientEvents,
  ServerEvents,
  Session,
} from "../../../../packages/shared/src/protocol.js";
import type { World } from "../../../../packages/shared/src/gameTypes.js";
import { Prediction } from "./prediction.js";
import { Interpolation } from "./interpolation.js";
export class NetworkClient {
  socket: Socket<ServerEvents, ClientEvents> = io();
  session: Session | null = null;
  world: World | null = null;
  prediction = new Prediction();
  interpolation = new Interpolation();
  seq = 0;
  private leaving = false;
  onchange = () => {};
  onerror = (s: string) => console.warn(s);
  constructor() {
    try {
      this.session = JSON.parse(
        sessionStorage.getItem("oath-session") || "null",
      );
    } catch {
      sessionStorage.removeItem("oath-session");
    }
    this.socket.on("connect", () => {
      if (this.session)
        this.request("session:resume", this.session)
          .then((s) => this.save(s as Session))
          .catch((e) => {
            this.session = null;
            this.world = null;
            sessionStorage.removeItem("oath-session");
            this.onerror(e.message);
            this.onchange();
          });
      this.onchange();
    });
    this.socket.on("disconnect", () => {
      this.prediction.pending = [];
      this.onchange();
    });
    this.socket.on("connect_error", () => {
      this.onerror("Server unavailable. Retrying connection…");
      this.onchange();
    });
    this.socket.on("state:sync", (w) => this.accept(w, true));
    this.socket.on("game:snapshot", (w) => this.accept(w, false));
    this.socket.on("server:error", (e) => this.onerror(e.message));
  }
  accept(w: World, full: boolean) {
    if (this.leaving) return;
    if (this.session && !w.players[this.session.playerId]) {
      this.session = null;
      this.world = null;
      sessionStorage.removeItem("oath-session");
      this.onerror("Your session expired. Join the room again.");
      this.onchange();
      return;
    }
    (
      window as unknown as { __enemySnapshot?: (world: World) => void }
    ).__enemySnapshot?.(structuredClone(w));
    const old = this.world;
    this.world = w;
    const p = w.players[this.session?.playerId || ""];
    if (
      full ||
      old?.sceneId !== w.sceneId ||
      old?.players[this.session?.playerId || ""]?.sceneId !== p?.sceneId
    ) {
      this.interpolation.clear();
      if (p) this.prediction.reset(p);
    } else if (p) this.prediction.reconcile(p, w);
    if (p) this.seq = Math.max(this.seq, p.lastProcessedInputSeq);
    this.interpolation.push(w);
    this.onchange();
  }
  async leaveRoom() {
    this.leaving = true;
    try {
      await this.request("room:leave", {});
      this.session = null;
      this.world = null;
      this.seq = 0;
      this.prediction.player = null;
      this.prediction.pending = [];
      this.prediction.error = 0;
      this.interpolation.clear();
      sessionStorage.removeItem("oath-session");
      this.onchange();
    } finally {
      this.leaving = false;
    }
  }
  save(s: Session) {
    this.session = s;
    sessionStorage.setItem("oath-session", JSON.stringify(s));
    if (this.world) this.accept(this.world, true);
    this.onchange();
  }
  // Acks have a deadline; a missing response never leaves the UI stuck forever.
  request(event: keyof ClientEvents, payload: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Request timed out. Check the connection.")),
        5000,
      );
      const emit = this.socket.emit.bind(this.socket) as (
        ...args: unknown[]
      ) => void;
      emit(
        event,
        payload,
        (r: { ok: boolean; data: unknown; error: string }) => {
          clearTimeout(timer);
          if (r.ok) resolve(r.data);
          else reject(Error(r.error));
        },
      );
    });
  }
}
