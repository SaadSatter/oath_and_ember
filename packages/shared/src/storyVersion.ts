import { cutscenes } from "./prologue.js";

// A fingerprint of the whole story script (every scene and line). The server
// sends only which scene and line are playing; each browser shows the words
// from its own copy. A tab loaded before the game was rebuilt, or a server
// still running an older build, would show the wrong (old) dialogue, so the
// two compare fingerprints and the browser says when they differ.
function fingerprint(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
export const storyVersion = fingerprint(JSON.stringify(cutscenes));
/** Whether this browser's story script differs from the server's. */
export const storyOutdated = (serverVersion: string | undefined) =>
  !!serverVersion && serverVersion !== storyVersion;
