import { expect, it } from "vitest";
import {
  followPrediction,
  followCamera,
  snapToPixel,
  blendCamera,
  stepFocusWeight,
  FOCUS_BLEND_MS,
} from "../src/rendering/viewport.js";
import { stickyCardinal } from "../src/animation/selectAnimation.js";
it("shows predicted motion on the frame it is predicted, with no trailing lag", () => {
  let rendered = { x: 100, y: 100 },
    glide = { x: 100, y: 100 };
  for (let frame = 0; frame < 20; frame++) {
    const next = { x: glide.x + 3, y: glide.y };
    rendered = followPrediction(rendered, glide, next, 1000 / 60);
    glide = next;
    expect(rendered).toEqual(glide);
  }
});
it("blends a reconciliation jump out over a few frames at any refresh rate", () => {
  for (const hz of [60, 120]) {
    let rendered = { x: 110, y: 100 };
    const glide = { x: 100, y: 100 };
    let previous = glide;
    for (let t = 0; t < 1000 / 60; t += 1000 / hz) {
      rendered = followPrediction(rendered, previous, glide, 1000 / hz);
      previous = glide;
    }
    expect(rendered.x).toBeCloseTo(107, 6);
  }
});
it("snaps camera and hero to the same physical pixel", () => {
  expect(snapToPixel({ x: 10.49, y: 20.5 })).toEqual({ x: 10, y: 21 });
  // At 3x, positions land on thirds of an art pixel, not whole art pixels.
  expect(snapToPixel({ x: 10.4, y: 20.9 }, 3)).toEqual({ x: 31 / 3, y: 21 });
});
it("trails the hero softly and identically at 60Hz and 120Hz", () => {
  const settle = (hz: number) => {
    let camera = { x: 0, y: 0 };
    const samples: number[] = [];
    for (let t = 0; t < 1000; t += 1000 / hz) {
      const hero = { x: (t / 1000) * 190, y: 0 };
      camera = followCamera(camera, hero, 1000 / hz);
      samples.push(hero.x - camera.x);
    }
    return { camera, lag: samples.at(-1)! };
  };
  const a = settle(60),
    b = settle(120);
  // Walking leaves a steady, modest lead and the same lag at either rate.
  expect(a.lag).toBeGreaterThan(5);
  expect(a.lag).toBeLessThan(30);
  expect(Math.abs(b.lag - a.lag)).toBeLessThan(1.5);
});
it("takes teleports and scene changes at once", () => {
  expect(followCamera({ x: 0, y: 0 }, { x: 900, y: 0 }, 16)).toEqual({
    x: 900,
    y: 0,
  });
});
it("keeps the shown cardinal while moving diagonally, as classic top-down games do", () => {
  expect(stickyCardinal("walk_east", "up", { x: 1, y: -1 })).toBe("walk_north");
  expect(stickyCardinal("walk_west", "down", { x: -1, y: 1 })).toBe("walk_south");
  expect(stickyCardinal("idle_right", "up", { x: 1, y: -1 })).toBe("idle_up");
});
it("turns when the shown cardinal is not one of the travelled directions", () => {
  expect(stickyCardinal("walk_east", "down", { x: 1, y: -1 })).toBe("walk_east");
  expect(stickyCardinal("walk_north", "right", { x: 0, y: -1 })).toBe("walk_north");
  expect(stickyCardinal("hurt", "up", { x: 1, y: -1 })).toBe("hurt");
});
it("eases framed areas in and out instead of snapping the camera", () => {
  const hero = { x: 600, y: 500 },
    plaza = { x: 640, y: 430, zoom: 1 };
  expect(blendCamera(hero, plaza, 0)).toEqual({ x: 600, y: 500, zoom: 1 });
  expect(blendCamera(hero, plaza, 1)).toEqual(plaza);
  let weight = 0,
    previous = blendCamera(hero, plaza, weight);
  for (let t = 0; t < FOCUS_BLEND_MS; t += 1000 / 60) {
    weight = stepFocusWeight(weight, true, 1000 / 60);
    const next = blendCamera(hero, plaza, weight);
    // No single frame moves more than a few pixels of a 80px framing change.
    expect(Math.hypot(next.x - previous.x, next.y - previous.y)).toBeLessThan(5);
    previous = next;
  }
  expect(weight).toBe(1);
  expect(stepFocusWeight(1, false, FOCUS_BLEND_MS / 2)).toBeCloseTo(0.5);
});
it("blends zoom together with position for framed puzzle views", () => {
  const mid = blendCamera({ x: 0, y: 0 }, { x: 100, y: 0, zoom: 0.5 }, 0.5);
  expect(mid).toEqual({ x: 50, y: 0, zoom: 0.75 });
});
