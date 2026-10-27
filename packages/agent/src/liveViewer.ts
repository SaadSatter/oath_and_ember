// Live viewer host for watched evaluation runs (scripts/midterm/live.ts).
//
// It serves the real game client and the exact GameRoom that AgentEnvironment
// plays: the environment hands each new room to `hooks.room`, which registers
// it with the server's RoomManager, and advances it through `hooks.tick`
// (the server's manual driver: the same stepRoom as live play, which also
// broadcasts snapshots). There is no second simulation.
//
// Browsers attach with single-use view tokens (SERVER_CHANGES.md §3). The
// server ignores their input and rejects their requests, so viewing cannot
// change the game. The players never see this server: they observe only
// through the five-operation interface.
//
// Bound to 127.0.0.1. `/watch` shows both heroes side by side, each in its own
// view-only client, plus a status line from the trusted run (who is deciding,
// last actions). `/watch/<hero>` issues a fresh token on every load, so a
// browser refresh works.

import express from "express";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { createApp } from "../../../apps/server/src/app.js";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import type { EnvironmentOptions } from "./environment.js";

export interface ViewerStatus {
  title: string;
  heroes: Record<"sieg" | "coco", { state: string; last: string }>;
  gameSeconds: number;
  calls: number;
  spendUsd: number;
  outcome: string | null;
  notes: string[];
}

export interface Viewer {
  url: string;
  hooks: Required<Pick<EnvironmentOptions, "room" | "tick">> & Pick<EnvironmentOptions, "pace">;
  status: ViewerStatus;
  /** Number of view-only attachments issued so far. */
  readonly viewsIssued: number;
  close(): Promise<void>;
}

/**
 * Real-time pacing: `speed` × 60 ticks per second while game time runs. Time
 * spent deciding is not caught up afterwards (game time is frozen then).
 */
export function pacer(speed: number) {
  if (!(speed > 0) || !Number.isFinite(speed)) throw Error("Pacing speed must be positive.");
  const step = 1000 / 60 / speed;
  let next = performance.now();
  return async () => {
    // Never catch up on time spent deciding: at most one tick behind.
    const now = performance.now();
    if (now - next > step) next = now;
    next += step;
    const wait = next - performance.now();
    await new Promise<void>((resolve) => (wait > 1 ? setTimeout(resolve, wait) : setImmediate(resolve)));
  };
}

const PAGE = (title: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title.replace(/[<>&"]/g, "")}</title>
<style>
:root{color-scheme:dark;--bg:#101214;--panel:#1a1d21;--text:#e6e6e6;--muted:#9aa3ad;--accent:#f0b35a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.4 system-ui,sans-serif}
header{padding:8px 16px;display:flex;gap:16px;flex-wrap:wrap;align-items:baseline;border-bottom:1px solid #2a2e33}
header b{color:var(--accent)}#meta{color:var(--muted)}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:8px;padding:8px}
section{background:var(--panel);border-radius:6px;overflow:hidden;display:flex;flex-direction:column}
section h2{margin:0;padding:6px 10px;font-size:14px;display:flex;justify-content:space-between;gap:8px}
section h2 span{color:var(--muted);font-weight:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
iframe{border:0;width:100%;aspect-ratio:16/10;background:#000}
#notes{padding:0 16px 12px;color:var(--muted);font-size:12px}
</style></head><body>
<header><b>${title.replace(/[<>&"]/g, "")}</b><span id="meta">connecting…</span><span>read-only viewer</span></header>
<main>
<section><h2>Sieg <span id="sieg">…</span></h2><iframe src="/watch/sieg" title="Sieg's view"></iframe></section>
<section><h2>Coco <span id="coco">…</span></h2><iframe src="/watch/coco" title="Coco's view"></iframe></section>
</main><div id="notes"></div>
<script>
async function poll(){try{const s=await (await fetch('/watch/status',{cache:'no-store'})).json();
document.getElementById('meta').textContent=(s.outcome?('finished: '+s.outcome+' · '):'')+s.gameSeconds.toFixed(1)+' s game time · '+s.calls+' model calls · $'+s.spendUsd.toFixed(4);
for(const h of ['sieg','coco'])document.getElementById(h).textContent=s.heroes[h].state+(s.heroes[h].last?' · '+s.heroes[h].last:'');
document.getElementById('notes').textContent=s.notes.join('  ·  ');}catch(e){document.getElementById('meta').textContent='launcher stopped';}
setTimeout(poll,500)}poll();
</script></body></html>`;

export async function startViewer(o: { root: string; port: number; speed: number; title: string }): Promise<Viewer> {
  const game = createApp({ manualDriver: true, viewers: true });
  let room: GameRoom | undefined;
  let issued = 0;
  const status: ViewerStatus = {
    title: o.title,
    heroes: { sieg: { state: "starting", last: "" }, coco: { state: "starting", last: "" } },
    gameSeconds: 0,
    calls: 0,
    spendUsd: 0,
    outcome: null,
    notes: [],
  };
  // The built client, from this checkout (not the shell's cwd).
  game.app.use(express.static(join(o.root, "dist/client")));
  game.app.get("/watch", (_req, res) => {
    res.type("html").send(PAGE(o.title));
  });
  game.app.get("/watch/status", (_req, res) => {
    res.json(status);
  });
  game.app.get("/watch/:hero", (req, res) => {
    const role = req.params.hero === "sieg" ? "OATH" : req.params.hero === "coco" ? "EMBER" : null;
    const player = room && role ? Object.values(room.state.players).find((p) => p.role === role) : undefined;
    if (!room || !player) {
      res.status(503).type("html").send("<!doctype html><meta http-equiv=refresh content=1><body style='background:#000;color:#999;font:14px system-ui'>Waiting for the episode to start…");
      return;
    }
    const token = game.registerViewer(room.state.roomCode, player.id);
    issued++;
    const q = new URLSearchParams({ view: token, room: room.state.roomCode, player: player.id });
    res.redirect(302, `/?${q}`);
  });
  await new Promise<void>((resolve, reject) => {
    game.http.once("error", reject);
    game.http.listen(o.port, "127.0.0.1", () => resolve());
  });
  const port = (game.http.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/watch`,
    status,
    get viewsIssued() {
      return issued;
    },
    hooks: {
      room: (r) => {
        if (room) game.manager.rooms.delete(room.state.roomCode);
        room = r;
        game.manager.rooms.set(r.state.roomCode, r);
      },
      tick: (r) => game.step(r.state.roomCode),
      ...(o.speed > 0 ? { pace: pacer(o.speed) } : {}),
    },
    close: async () => {
      game.io.disconnectSockets(true);
      await game.close();
      await new Promise<void>((resolve) => game.http.close(() => resolve()));
    },
  };
}
