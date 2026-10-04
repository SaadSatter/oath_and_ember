import { describe, expect, it } from "vitest";
import { cadence, selectFrames, loadTemporal } from "./temporal.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Asset } from "./model.js";

describe("temporal evidence", () => {
  it("selects real irregular native timestamps without synthetic FPS frames", () => {
    expect(selectFrames([0, 40, 80, 160, 201, 281, 401])).toEqual([0, 80, 160, 281, 401]);
    for (const values of [[], [0, 0], [1, 0], [NaN], [-1]]) expect(() => selectFrames(values)).toThrow();
  });
  it("reports deterministic callback stalls without claiming game FPS", () => {
    expect(cadence([0, 16, 32, 132, 148])).toMatchObject({samples: 5, medianIntervalMs: 16, maximumIntervalMs: 100, intervalsOver50Ms: 1});
    expect(cadence([]).medianIntervalMs).toBeNull();
    expect(cadence([0, 16]).scope).toContain("not game render completion");
    expect(() => cadence([2, 1])).toThrow();
  });
  it("rejects tampered frame and candidate provenance before any upload", () => {
    const root = mkdtempSync(join(tmpdir(), "temporal-provenance-"));
    const dir = "art/qa/test/iteration-02";
    const digest = (s: string) => createHash("sha256").update(s).digest("hex");
    try {
      mkdirSync(join(root, dir, "temporal/frames-v1"), {recursive: true});
      writeFileSync(join(root, "atlas.png"), "atlas"); writeFileSync(join(root, "mask.png"), "mask");
      const frame = `${dir}/temporal/frames-v1/frame-0.png`;
      writeFileSync(join(root, frame), "frame");
      const packet = {schema_version: 1, candidateHashes: [digest("atlas"), digest("mask")], recordings: [], frames: [{path: frame, sha256: digest("frame"), ptsMs: 0, sequence: "start"}]};
      writeFileSync(join(root, dir, "temporal/frames-v1/manifest.json"), JSON.stringify(packet));
      const a = {runtime_files: ["atlas.png", "mask.png"]} as Asset;
      expect(loadTemporal(root, dir, a)?.frames).toHaveLength(1);
      writeFileSync(join(root, frame), "modified");
      expect(() => loadTemporal(root, dir, a)).toThrow("changed");
      writeFileSync(join(root, "atlas.png"), "modified");
      expect(() => loadTemporal(root, dir, a)).toThrow("provenance");
    } finally {rmSync(root, {recursive: true, force: true});}
  });
});
