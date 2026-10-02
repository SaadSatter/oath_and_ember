import { describe, it, expect, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { PNG } from "pngjs";
import { route, type Asset, type Finding } from "./model.js";
import { prepareMaskRecovery } from "./recovery.js";
import { effectMaskDiagnostics, inspectAtlas } from "./png.js";
import { digest } from "./generation.js";
import { advanceAsset } from "./runner.js";
const repo = resolve(import.meta.dirname, "../..");
const review: Finding[] = [
  ...["character_consistency", "rendering", "vfx"].map((id) => ({
    id,
    result: "PASS" as const,
    confidence: 0.96,
  })),
  {
    id: "palette",
    result: "FAIL",
    category: "ART",
    confidence: 0.96,
    evidence: "candidate/mask.png",
    feedback: "Mask omits alpha-bearing outer halo coverage.",
  },
  {
    id: "animation",
    result: "REVIEW",
    category: "DESIGN",
    confidence: 0.99,
    evidence: "sample.png",
    feedback: "Continuous smoothness unsupported.",
  },
];
function fixture(broken: boolean) {
  const root = mkdtempSync(join(tmpdir(), "art-recovery-"));
  const source = "source";
  mkdirSync(join(root, source));
  copyFileSync(
    join(repo, "apps/client/public/assets/characters/ember/defense.png"),
    join(root, source, "atlas.png"),
  );
  copyFileSync(
    join(repo, "apps/client/public/assets/characters/ember/defense-mask.png"),
    join(root, source, "mask.png"),
  );
  if (broken) {
    const atlas = PNG.sync.read(readFileSync(join(root, source, "atlas.png"))),
      mask = PNG.sync.read(readFileSync(join(root, source, "mask.png")));
    let index = -1;
    for (let i = 0; i < atlas.data.length; i += 4)
      if (atlas.data[i + 3] > 0 && atlas.data[i + 3] < 255) {
        index = i;
        break;
      }
    if (index < 0) throw Error("Expected faint alpha pixel");
    mask.data.set([0, 0, 0, 0], index);
    writeFileSync(join(root, source, "mask.png"), PNG.sync.write(mask));
  }
  writeFileSync(
    join(root, source, "submission.json"),
    JSON.stringify({
      kind: "production_atlas",
      image: "atlas.png",
      mask: "mask.png",
      frame_dimensions: [128, 128],
      frame_count: 1,
      anchor: [64, 70],
      provenance: "Test fixture",
    }),
  );
  const a: Asset = {
    asset_id: "coco_ward_v4",
    version: 4,
    character: "coco",
    animation: "ward",
    status: "QA_FAILED_ART",
    source_file: source,
    canonical_references: [],
    runtime_files: ["source/atlas.png", "source/mask.png"],
    directions: ["omnidirectional"],
    frame_count: 1,
    frame_dimensions: [128, 128],
    anchor: [64, 70],
    palette_behavior: {},
    qa_status: "FAIL",
    iteration: 1,
    approved_at: null,
    target: "assets/characters/ember/defense.png",
    mask_target: "assets/characters/ember/defense-mask.png",
    reports: [],
    source_hash: digest(join(root, source, "atlas.png")),
    integration_hash: digest(join(root, source, "mask.png")),
  };
  return {
    root,
    a,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
describe("actionable routing and mask-only recovery", () => {
  it("prioritizes actionable failures before review and retains iteration cap", () => {
    expect(route(review, 1)).toBe("QA_FAILED_ART");
    expect(
      route(
        [
          { id: "animation", result: "REVIEW" },
          {
            id: "scale",
            result: "FAIL",
            category: "IMPLEMENTATION",
            evidence: "runtime.png",
            feedback: "wrong scale",
          },
          {
            id: "design",
            result: "FAIL",
            category: "DESIGN",
            evidence: "runtime.png",
            feedback: "subjective",
          },
        ],
        1,
      ),
    ).toBe("QA_FAILED_IMPLEMENTATION");
    expect(route(review, 3)).toBe("NEEDS_HUMAN_REVIEW");
    expect(
      route(
        review.map((c) =>
          c.result === "FAIL" ? { ...c, confidence: 0.2 } : c,
        ),
        1,
      ),
    ).toBe("NEEDS_HUMAN_REVIEW");
    expect(route([review.at(-1)!], 1)).toBe("NEEDS_HUMAN_REVIEW");
  });
  it("repairs faint alpha coverage while preserving atlas bytes and previous mask", () => {
    const f = fixture(true);
    try {
      const original = readFileSync(join(f.root, "source/atlas.png")),
        oldMask = readFileSync(join(f.root, "source/mask.png"));
      expect(
        inspectAtlas(
          join(f.root, "source/atlas.png"),
          join(f.root, "source/mask.png"),
          [128, 128],
          1,
        ).some(
          (c) =>
            c.id === "effect_mask_coverage" &&
            c.result === "FAIL" &&
            c.category === "IMPLEMENTATION",
        ),
      ).toBe(true);
      const result = prepareMaskRecovery(f.root, f.a, review)!;
      expect(result.result).toBe("MASK_REPAIRED");
      expect(result.before.missingPixels).toBe(1);
      expect(result.after.complete).toBe(true);
      expect(result.atlasBefore).toBe(result.atlasAfter);
      expect(result.unresolvedReview[0].result).toBe("REVIEW");
      expect(readFileSync(join(f.root, result.source, "atlas.png"))).toEqual(
        original,
      );
      expect(readFileSync(join(f.root, "source/mask.png"))).toEqual(oldMask);
      expect(f.a.iteration).toBe(1);
    } finally {
      f.cleanup();
    }
  });
  it("records a disproven mask claim without altering either image", () => {
    const f = fixture(false);
    try {
      const result = prepareMaskRecovery(f.root, f.a, review)!;
      expect(result.result).toBe("NOT_REPRODUCED");
      expect(result.before.missingPixels).toBe(0);
      expect(result.maskBefore).toBe(result.maskAfter);
      expect(result.atlasBefore).toBe(result.atlasAfter);
    } finally {
      f.cleanup();
    }
  });
  it("rejects mixed art defects, character assets and stale candidates", () => {
    const f = fixture(true);
    try {
      expect(
        prepareMaskRecovery(f.root, { ...f.a, character: "sieg" }, review),
      ).toBeNull();
      expect(
        prepareMaskRecovery(f.root, f.a, [
          ...review,
          {
            id: "vfx",
            result: "FAIL",
            category: "ART",
            evidence: "atlas.png",
            feedback: "staff embedded in art",
          },
        ]),
      ).toBeNull();
      writeFileSync(join(f.root, "source/atlas.png"), "changed");
      expect(() => prepareMaskRecovery(f.root, f.a, review)).toThrow(
        "changed since review",
      );
    } finally {
      f.cleanup();
    }
  });
  it("routes recovery through a new QA iteration without invoking the artist or approving animation", async () => {
    const f = fixture(true);
    try {
      const generate = vi.fn();
      let captured = 0,
        reviewed = 0;
      await advanceAsset(f.a, {
        artistEnabled: true,
        visionEnabled: true,
        maxIterations: 3,
        hasSubmission: () => true,
        canReview: () => true,
        generate,
        recover: async (a) => {
          const r = prepareMaskRecovery(f.root, a, review);
          if (!r) return false;
          a.source_file = r.source;
          a.status = "READY_FOR_INTEGRATION";
          return true;
        },
        integrate: async (a) => {
          a.iteration++;
          a.status = "READY_FOR_QA";
        },
        qa: async (a) => {
          captured++;
          a.status = "NEEDS_HUMAN_REVIEW";
        },
        vision: async (a) => {
          reviewed++;
          a.status = route([review.at(-1)!], a.iteration);
        },
      });
      expect(generate).not.toHaveBeenCalled();
      expect(f.a.iteration).toBe(2);
      expect(captured).toBe(1);
      expect(reviewed).toBe(1);
      expect(f.a.status).toBe("NEEDS_HUMAN_REVIEW");
    } finally {
      f.cleanup();
    }
  });
});
