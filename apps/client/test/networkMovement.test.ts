import { afterEach, expect, it, vi } from "vitest";
vi.mock("socket.io-client", () => ({
  io: () => ({ on: vi.fn(), emit: vi.fn(), volatile: { emit: vi.fn() } }),
}));
import { NetworkClient } from "../src/net/NetworkClient.js";
import { GameRoom } from "../../server/src/GameRoom.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";
afterEach(() => vi.unstubAllGlobals());
it("keeps local prediction through partner full syncs and rejects stale snapshots across scene generations", () => {
  vi.stubGlobal("sessionStorage", { getItem: () => null, removeItem: vi.fn() });
  vi.stubGlobal("window", {});
  const r = new GameRoom("NET001"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const net = new NetworkClient();
  net.session = a;
  net.accept(structuredClone(r.state), true);
  net.prediction.push(
    { ...neutral(1), targetTick: r.state.serverTick + 6, moveX: 1 },
    net.world!,
  );
  const before = net.prediction.player!.x;
  r.state.players[b.playerId].sceneId = "HOUSE_INTERIOR";
  net.accept(structuredClone(r.state), true);
  expect(net.prediction.player!.x).toBe(before);
  expect(net.prediction.pending).toHaveLength(1);
  const old = structuredClone(r.state);
  r.state.serverTick = 10;
  r.state.players[a.playerId].sceneId = "HOUSE_INTERIOR";
  r.state.players[a.playerId].movementEpoch!++;
  r.state.players[a.playerId].x = 608;
  net.accept(structuredClone(r.state), false);
  expect(net.prediction.pending).toHaveLength(0);
  expect(net.prediction.player!.x).toBe(608);
  net.accept(old, false);
  expect(net.world!.serverTick).toBe(10);
  expect(net.prediction.player!.sceneId).toBe("HOUSE_INTERIOR");
});
