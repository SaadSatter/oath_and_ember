import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = new URL("../tools/sound-gallery/", import.meta.url);
const read = (path) => readFile(new URL(path, root));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const catalog = JSON.parse(await read("catalog.json"));
const manifest = JSON.parse(
  await read("reference/SOUND_ASSET_VERIFICATION.json"),
);
const plan = await read("reference/SOUND_DESIGN_PLAN.md");
assert.equal(sha(plan), catalog.planSha256);
assert.equal(catalog.planCommit, manifest.commit);
assert.equal(catalog.assets.length, 63);
assert.equal(new Set(catalog.assets.map((a) => a.id)).size, 63);
assert.equal(catalog.events.length, 204);
assert.equal(new Set(catalog.events.map((e) => e.id)).size, 204);
assert.equal(catalog.events.filter((e) => e.phase1).length, 28);
assert.equal(catalog.events.filter((e) => e.silent).length, 15);
assert.equal((await readdir(new URL("assets/", root))).length, 63);
for (const asset of catalog.assets) {
  const original = manifest.selected_assets.find((a) => a.id === asset.id);
  assert(original);
  const bytes = await read(asset.url.slice(1));
  assert.equal(sha(bytes), original.sha256, asset.id);
  assert.equal(bytes.length, original.bytes, asset.id);
  for (const key of ["member", "pack", "sha256", "signature"])
    assert.equal(asset[key], original[key]);
  const pack = manifest.packs[asset.pack];
  for (const key of ["creator", "license", "source_page", "download_url"])
    assert.equal(asset[key], pack[key]);
}
const mappedRows = plan
  .toString()
  .split("\n")
  .filter(
    (line) =>
      line.startsWith("| ") &&
      line.split("|").length === 9 &&
      !line.startsWith("| Event"),
  );
assert.equal(mappedRows.length, 204);
for (const [i, event] of catalog.events.entries()) {
  const cols = mappedRows[i]
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
  assert.equal(event.name, cols[0]);
  assert.equal(event.trigger, cols[1]);
  assert.equal(event.description, cols[2]);
  assert.equal(event.playback, cols[6]);
  if (event.silent) {
    assert.equal(event.assetId, null);
    assert.equal(event.gain, 0);
    assert.deepEqual(event.recipes, []);
  } else {
    const a = catalog.assets.find((a) => a.id === event.assetId);
    assert(a);
    assert.equal(a.member, cols[3].replaceAll("`", ""));
  }
  for (const recipe of event.recipes)
    for (const track of recipe.tracks)
      assert(catalog.assets.some((a) => a.id === track.assetId));
}
console.log(
  "Verified 63 source hashes/licenses, all 204 unchanged mapping rows, 28 Phase 1 proposals and 15 protected silence entries.",
);
