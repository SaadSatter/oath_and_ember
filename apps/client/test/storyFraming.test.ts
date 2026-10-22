import { expect, it } from "vitest";
import {
  DIALOGUE_COVER,
  storyFraming,
} from "../src/rendering/storyFraming.js";
import {
  altarShot,
  goddessFocus,
  pullBack,
  watcherPose,
} from "../../../packages/shared/src/chapter0Finale.js";

/** What the camera shows, in world units, for a framing on this screen. */
const shown = (
  f: { x: number; y: number; zoom: number },
  w: number,
  h: number,
) => ({
  top: f.y - h / f.zoom / 2,
  // Everything above the dialogue box.
  clear: f.y - h / f.zoom / 2 + (h / f.zoom) * (1 - DIALOGUE_COVER),
  left: f.x - w / f.zoom / 2,
  right: f.x + w / f.zoom / 2,
});
// A large screen (2 screen pixels per world pixel), a mid one, a small one.
const screens = [
  [640, 360, 2],
  [960, 540, 2],
  [1280, 720, 1],
];

it("never zooms out below the screen's own pixel scale", () => {
  for (const [w, h, pixel] of screens)
    for (const target of [goddessFocus, altarShot, pullBack])
      for (const hero of [null, { x: 600, y: 604 }, { x: 680, y: 940 }])
        expect(storyFraming(target, hero, w, h, pixel).zoom).toBe(1);
});

it("keeps the goddess's face above the dialogue box, with the hero when they fit", () => {
  const hero = { x: 600, y: 604 };
  for (const [w, h, pixel] of screens) {
    const view = shown(storyFraming(goddessFocus, hero, w, h, pixel), w, h);
    expect(view.top).toBeLessThanOrEqual(goddessFocus.y - 80);
    expect(view.clear).toBeGreaterThanOrEqual(goddessFocus.y + 40);
    if (h >= 720) expect(view.clear).toBeGreaterThanOrEqual(hero.y + 30);
  }
});

it("holds the goddess and the woman in one shot, with no need to pan", () => {
  for (const [w, h, pixel] of screens) {
    const view = shown(storyFraming(altarShot, null, w, h, pixel), w, h);
    // The shrine's roof at the top, the woman above the box.
    expect(view.top).toBeLessThanOrEqual(256);
    expect(view.clear).toBeGreaterThanOrEqual(watcherPose.y);
  }
});
