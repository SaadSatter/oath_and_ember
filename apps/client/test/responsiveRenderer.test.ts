import { afterEach, it, expect, vi } from "vitest";
import type Phaser from "phaser";
import { attachResponsiveRenderer } from "../src/rendering/ResponsiveRenderer.js";
function harness() {
  let currentParent: ReturnType<typeof parent>;
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  const callbacks: ResizeObserverCallback[] = [];
  const parent = (width: number, height: number) => ({
    dataset: {} as Record<string, string>,
    size: { width, height },
    getBoundingClientRect() {
      return this.size;
    },
  });
  vi.stubGlobal("document", { querySelector: () => currentParent });
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    visualViewport: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    frames.set(++next, fn);
    return next;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(fn: ResizeObserverCallback) {
        callbacks.push(fn);
      }
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  function scene() {
    const scale = {
      width: 640,
      height: 360,
      zoom: 1,
      resize: vi.fn(function (this: any, w: number, h: number) {
        this.width = w;
        this.height = h;
      }),
      setZoom: vi.fn(function (this: any, z: number) {
        this.zoom = z;
      }),
      updateBounds: vi.fn(),
    };
    const camera = {
      setViewport: vi.fn().mockReturnThis(),
      setZoom: vi.fn().mockReturnThis(),
      roundPixels: false,
    };
    return {
      scale,
      cameras: { main: camera },
      events: { emit: vi.fn() },
      socket: { disconnect: vi.fn() },
      anims: { play: vi.fn() },
      player: { id: "hero", x: 120, y: 450 },
    };
  }
  return {
    parent,
    scene,
    select: (p: ReturnType<typeof parent>) => {
      currentParent = p;
    },
    resize: () => {
      callbacks.forEach((fn) => fn([], {} as ResizeObserver));
      for (const [id, fn] of [...frames]) {
        frames.delete(id);
        fn(0);
      }
    },
    pending: () => frames.size,
  };
}
afterEach(() => vi.unstubAllGlobals());
it("resizes one live presentation without reconnecting, resetting player or restarting animations", () => {
  const h = harness(),
    root = h.parent(1920, 1080),
    scene = h.scene();
  h.select(root);
  const cleanup = attachResponsiveRenderer(scene as unknown as Phaser.Scene);
  const identity = scene.player;
  for (const [width, height, expected] of [
    [1920, 1080, "640x360"],
    [1440, 900, "607x379"],
    [390, 844, "360x640"],
    [844, 390, "640x360"],
  ] as const) {
    root.size = { width, height };
    h.resize();
    expect(root.dataset.logicalSize).toBe(expected);
    expect(scene.player).toBe(identity);
    expect(scene.player).toEqual({ id: "hero", x: 120, y: 450 });
    expect(scene.socket.disconnect).not.toHaveBeenCalled();
    expect(scene.anims.play).not.toHaveBeenCalled();
    expect(scene.events.emit).not.toHaveBeenCalled();
    expect(scene.cameras.main.setZoom).toHaveBeenLastCalledWith(1);
  }
  // Portrait and landscape both use zoom=1, but CSS dimensions still need
  // refreshing on orientation change. A no-op resize must not refresh them.
  expect(scene.scale.setZoom).toHaveBeenLastCalledWith(1);
  expect(scene.scale.setZoom).toHaveBeenCalledTimes(4);
  const refreshes = scene.scale.setZoom.mock.calls.length;
  h.resize();
  expect(scene.scale.setZoom.mock.calls.length).toBe(refreshes);
  cleanup();
  expect(h.pending()).toBe(0);
});
it("maintains independent logical viewports for simultaneous clients sharing the same world coordinates", () => {
  const h = harness(),
    desktop = h.parent(1920, 1080),
    mobile = h.parent(390, 844),
    a = h.scene(),
    b = h.scene();
  h.select(desktop);
  const stopA = attachResponsiveRenderer(a as unknown as Phaser.Scene);
  h.select(mobile);
  const stopB = attachResponsiveRenderer(b as unknown as Phaser.Scene);
  expect(desktop.dataset.logicalSize).toBe("640x360");
  expect(mobile.dataset.logicalSize).toBe("360x640");
  expect(a.player).toEqual(b.player);
  expect(a.scale.zoom).toBe(3);
  expect(b.scale.zoom).toBe(1);
  mobile.size = { width: 844, height: 390 };
  h.resize();
  expect(mobile.dataset.logicalSize).toBe("640x360");
  expect(desktop.dataset.displayScale).toBe("3");
  expect(a.player).toEqual(b.player);
  stopA();
  stopB();
});
