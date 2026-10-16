import { afterEach, it, expect, vi } from "vitest";
import type Phaser from "phaser";
import {
  attachResponsiveRenderer,
  pixelZoom,
} from "../src/rendering/ResponsiveRenderer.js";
function harness() {
  let currentParent: ReturnType<typeof parent>;
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  const callbacks: ResizeObserverCallback[] = [];
  const parent = (width: number, height: number) => ({
    dataset: {} as Record<string, string>,
    style: { top: "", height: "" },
    size: { width, height },
    getBoundingClientRect() {
      return this.size;
    },
  });
  vi.stubGlobal("document", {
    querySelector: (selector: string) =>
      selector === "#game" ? currentParent : null,
  });
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
  for (const [width, height, expected, zoom] of [
    [1920, 1080, "640x360", 3],
    [1440, 900, "720x450", 2],
    [390, 844, "390x693", 1],
    [844, 390, "693x390", 1],
  ] as const) {
    root.size = { width, height };
    h.resize();
    expect(root.dataset.logicalSize).toBe(expected);
    expect(scene.player).toBe(identity);
    expect(scene.player).toEqual({ id: "hero", x: 120, y: 450 });
    expect(scene.socket.disconnect).not.toHaveBeenCalled();
    expect(scene.anims.play).not.toHaveBeenCalled();
    expect(scene.events.emit).not.toHaveBeenCalled();
    // Art is enlarged by a whole-number camera zoom, never by CSS stretching.
    expect(scene.cameras.main.setZoom).toHaveBeenLastCalledWith(zoom);
    expect(pixelZoom(scene as unknown as Phaser.Scene)).toBe(zoom);
    expect(scene.scale.zoom).toBe(1);
  }
  // Orientation changes refresh the canvas; a no-op resize does not.
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
  expect(mobile.dataset.logicalSize).toBe("390x693");
  expect(a.player).toEqual(b.player);
  expect(pixelZoom(a as unknown as Phaser.Scene)).toBe(3);
  expect(pixelZoom(b as unknown as Phaser.Scene)).toBe(1);
  mobile.size = { width: 844, height: 390 };
  h.resize();
  expect(mobile.dataset.logicalSize).toBe("693x390");
  expect(desktop.dataset.displayScale).toBe("3");
  expect(a.player).toEqual(b.player);
  stopA();
  stopB();
});
it("renders a high-DPI screen at device resolution without revealing more world", () => {
  const h = harness(),
    root = h.parent(1440, 900),
    scene = h.scene();
  h.select(root);
  vi.stubGlobal("window", {
    devicePixelRatio: 2,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  const stop = attachResponsiveRenderer(scene as unknown as Phaser.Scene);
  expect(scene.scale.resize).toHaveBeenLastCalledWith(2880, 1800);
  expect(scene.scale.setZoom).toHaveBeenLastCalledWith(0.5);
  expect(scene.cameras.main.setZoom).toHaveBeenLastCalledWith(5);
  expect(root.dataset.logicalSize).toBe("576x360");
  stop();
});
