// Client view mode for evaluation recording (docs/midterm/SERVER_CHANGES.md §3).
// The server enforces view-only; this checks the client never even tries.
import { afterEach, expect, it, vi } from "vitest";

const emitted: { event: string; payload: unknown }[] = [];
const handlers = new Map<string, (...a: unknown[]) => void>();
vi.mock("socket.io-client", () => ({
  io: () => {
    const emit = (event: string, payload: unknown, ack?: (r: unknown) => void) => {
      emitted.push({ event, payload });
      if (event === "view:attach")
        ack?.({ ok: true, data: { roomCode: "ABCDEF", playerId: "p-sieg", viewOnly: true } });
      if (event === "clock:probe") ack?.({ ok: true, data: { serverTick: 0 } });
    };
    return {
      on: (event: string, fn: (...a: unknown[]) => void) => handlers.set(event, fn),
      emit,
      volatile: { emit },
      connected: true,
    };
  },
}));
import { NetworkClient, viewParams } from "../src/net/NetworkClient.js";
import { neutral } from "../../../packages/shared/src/gameTypes.js";

afterEach(() => {
  vi.unstubAllGlobals();
  emitted.length = 0;
  handlers.clear();
});

it("parses the view URL only when token, room and player are all present", () => {
  expect(viewParams("?view=tok&room=ABCDEF&player=p1")).toEqual({ viewToken: "tok", roomCode: "ABCDEF", playerId: "p1" });
  expect(viewParams("?view=tok&room=ABCDEF")).toBeNull();
  expect(viewParams("")).toBeNull();
});

it("attaches view-only, stores no session and never sends intent", async () => {
  const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("window", {});
  vi.stubGlobal("location", { search: "?view=tok123&room=ABCDEF&player=p-sieg" });
  const net = new NetworkClient();
  expect(net.viewOnly).toBe(true);
  handlers.get("connect")!();
  await new Promise((r) => setTimeout(r, 0));
  expect(emitted[0]).toEqual({ event: "view:attach", payload: { viewToken: "tok123", roomCode: "ABCDEF", playerId: "p-sieg" } });
  expect(net.session?.playerId).toBe("p-sieg");
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(storage.getItem).not.toHaveBeenCalled();

  net.sendInput({ ...neutral(1), moveX: 1 }, true);
  net.sendInput({ ...neutral(2), primaryHeld: true }, false);
  for (const event of ["story:read", "inventory:use", "npc:talk", "room:leave", "session:resume"] as const)
    await expect(net.request(event, {})).rejects.toThrow("View-only session.");
  expect(emitted.map((e) => e.event).filter((e) => e !== "clock:probe")).toEqual(["view:attach"]);
  clearInterval((net as unknown as { clockTimer?: ReturnType<typeof setInterval> }).clockTimer);
});

it("a normal client is unchanged: it resumes from storage and sends input", () => {
  vi.stubGlobal("sessionStorage", {
    getItem: () => JSON.stringify({ roomCode: "ABCDEF", playerId: "p1", reconnectToken: "t" }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal("window", {});
  vi.stubGlobal("location", { search: "" });
  const net = new NetworkClient();
  expect(net.viewOnly).toBe(false);
  handlers.get("connect")!();
  net.sendInput({ ...neutral(1), moveX: 1 }, true);
  expect(emitted.map((e) => e.event)).toEqual(["session:resume", "player:input"]);
});
