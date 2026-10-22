import { expect, it } from "vitest";
import {
  storyOutdated,
  storyVersion,
} from "../../../packages/shared/src/storyVersion.js";
import { cutscenes } from "../../../packages/shared/src/prologue.js";

it("flags a page whose story script differs from the server's", () => {
  expect(storyVersion).toMatch(/^[0-9a-z]+$/);
  expect(storyOutdated(storyVersion)).toBe(false);
  // An older server (before a rebuild) has a different fingerprint.
  expect(storyOutdated(`${storyVersion}x`)).toBe(true);
  // A server too old to send one says nothing either way.
  expect(storyOutdated(undefined)).toBe(false);
});

it("covers every scene, the finale included, so any changed line shows up", () => {
  for (const id of ["visit", "rescue", "errand", "funeral", "decision", "angel-meet", "goddess-meet", "revelation", "watcher"])
    expect(cutscenes[id], id).toBeDefined();
});
