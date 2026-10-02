import { describe, it, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { route, findingSchema } from "./model.js";
import { inspectAtlas } from "./png.js";
const root = resolve(import.meta.dirname, "../..");
describe("visual asset workflow", () => {
  it("routes objective failures and bounds retries while requiring final review", () => {
    const fail = {
      id: "scale",
      result: "FAIL" as const,
      category: "IMPLEMENTATION" as const,
      evidence: "screen.png",
      feedback: "Reduce renderer scale by 40%.",
    };
    expect(route([fail], 1)).toBe("QA_FAILED_IMPLEMENTATION");
    expect(
      route(
        [{ ...fail, category: "ART", feedback: "Frames 4–5 change staff." }],
        1,
      ),
    ).toBe("QA_FAILED_ART");
    expect(route([{ ...fail, category: "DESIGN" }], 1)).toBe(
      "NEEDS_HUMAN_REVIEW",
    );
    expect(route([fail], 3)).toBe("NEEDS_HUMAN_REVIEW");
    expect(route([{ id: "design", result: "REVIEW" }], 1)).toBe(
      "NEEDS_HUMAN_REVIEW",
    );
    expect(route([{ id: "design", result: "PASS" }], 1)).toBe(
      "AWAITING_APPROVAL",
    );
    expect(findingSchema.safeParse({ id: "bad", result: "FAIL" }).success).toBe(
      false,
    );
  });
  it("accepts existing Ward atlas and rejects wrong frame grid", () => {
    const p = join(root, "apps/client/public/assets/characters/ember");
    expect(
      inspectAtlas(
        join(p, "defense.png"),
        join(p, "defense-mask.png"),
        [128, 128],
        1,
      ).every((c) => c.result === "PASS"),
    ).toBe(true);
    expect(
      inspectAtlas(
        join(p, "defense.png"),
        join(p, "defense-mask.png"),
        [64, 64],
        4,
      ).some((c) => c.id === "atlas_grid" && c.result === "FAIL"),
    ).toBe(true);
  });
  it("resumes manual handoff, stages immutable candidate, rejects early approval and retains failed iteration", () => {
    const temp = mkdtempSync(join(tmpdir(), "art-pipeline-test-"));
    mkdirSync(join(temp, "art"));
    copyFileSync(join(root, "art/ART_SPEC.md"), join(temp, "art/ART_SPEC.md"));
    const cli = (...args: string[]) =>
      spawnSync(
        process.execPath,
        ["--import", "tsx", join(root, "scripts/art/cli.ts"), ...args],
        {
          cwd: root,
          env: { ...process.env, ART_WORKSPACE_ROOT: temp, OPENAI_API_KEY: "" },
          encoding: "utf8",
        },
      );
    const manifest = () =>
      JSON.parse(readFileSync(join(temp, "art/manifest.json"), "utf8"));
    try {
      expect(cli("brief", "coco", "ward").status).toBe(0);
      expect(manifest().assets.coco_ward_v1.status).toBe("WAITING_FOR_ART");
      expect(cli("run", "coco_ward_v1").stdout).toContain("WAITING_FOR_ART");
      expect(cli("approve", "coco_ward_v1").status).toBe(1);
      writeFileSync(
        join(temp, "art/providers.json"),
        JSON.stringify({
          schema_version: 1,
          sprite_artist: { provider: "openai" },
        }),
      );
      expect(cli("generate", "coco_ward_v1").stdout).toContain(
        "OPENAI_API_KEY",
      );
      expect(manifest().assets.coco_ward_v1.status).toBe("WAITING_FOR_ART");
      expect(
        manifest().assets.coco_ward_v1.generation_attempts,
      ).toBeUndefined();
      rmSync(join(temp, "art/providers.json"));

      const incoming = join(temp, "art/incoming/coco_ward_v1");
      mkdirSync(incoming, { recursive: true });
      writeFileSync(
        join(incoming, "submission.json"),
        JSON.stringify({ kind: "reference_sheet" }),
      );
      expect(cli("integrate", "coco_ward_v1").status).toBe(0);
      expect(manifest().assets.coco_ward_v1.status).toBe("QA_FAILED_ART");
      expect(cli("revise", "coco_ward_v1").status).toBe(0);
      const runtime = join(root, "apps/client/public/assets/characters/ember");
      copyFileSync(join(runtime, "defense.png"), join(incoming, "atlas.png"));
      copyFileSync(
        join(runtime, "defense-mask.png"),
        join(incoming, "mask.png"),
      );
      writeFileSync(
        join(incoming, "submission.json"),
        JSON.stringify({
          kind: "production_atlas",
          image: "atlas.png",
          mask: "mask.png",
          frame_dimensions: [128, 128],
          frame_count: 1,
          anchor: [64, 70],
          provenance:
            "Existing extracted Ward; docs/DEFENSE_ASSET_PROVENANCE.json",
        }),
      );
      expect(cli("integrate", "coco_ward_v1").status).toBe(0);
      expect(manifest().assets.coco_ward_v1.status).toBe("READY_FOR_QA");
      expect(manifest().assets.coco_ward_v1.iteration).toBe(2);
      expect(cli("integrate", "coco_ward_v1").status).toBe(1);
      expect(cli("approve", "coco_ward_v1").status).toBe(1);
      const candidate = join(
        temp,
        manifest().assets.coco_ward_v1.runtime_files[0],
      );
      expect(readFileSync(candidate)).toEqual(
        readFileSync(join(runtime, "defense.png")),
      );
      expect(
        JSON.parse(
          readFileSync(
            join(
              temp,
              "art/qa/coco_ward_v1/iteration-01/integration-report.json",
            ),
            "utf8",
          ),
        ).route,
      ).toBe("SPRITE_ARTIST");
      // Simulate a completed evidence run to exercise the human gate separately from Chrome.
      const m = manifest(),
        asset = m.assets.coco_ward_v1;
      const qaPath = "art/qa/coco_ward_v1/iteration-02/qa-report.json";
      writeFileSync(
        join(temp, qaPath),
        JSON.stringify({ checks: [{ id: "objective", result: "PASS" }] }),
      );
      asset.status = "NEEDS_HUMAN_REVIEW";
      asset.reports.push(qaPath);
      writeFileSync(join(temp, "art/manifest.json"), JSON.stringify(m));
      const review = join(temp, "review.json");
      writeFileSync(
        review,
        JSON.stringify({
          checks: [
            "character_consistency",
            "animation",
            "rendering",
            "vfx",
            "palette",
            "multiplayer",
            "responsive",
          ].map((id) => ({
            id,
            result: "PASS",
            evidence: asset.runtime_files[0],
          })),
        }),
      );
      expect(cli("review", "coco_ward_v1", review).status).toBe(0);
      expect(manifest().assets.coco_ward_v1.status).toBe("AWAITING_APPROVAL");
      expect(cli("approve", "coco_ward_v1").status).toBe(0);
      expect(manifest().assets.coco_ward_v1.status).toBe("APPROVED");
      expect(
        readFileSync(join(temp, "art/approved/coco_ward_v1/atlas.png")),
      ).toEqual(readFileSync(candidate));
      expect(cli("revise", "coco_ward_v1").status).toBe(1);
      expect(cli("integrate", "coco_ward_v1").status).toBe(1);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }, 30000);
});
