import { it, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { digest } from "./generation.js";
import { iterationLimit } from "./human-decisions.js";
import { route } from "./model.js";
import { qaEnvironment } from "./qa-environment.js";
import type { Asset } from "./model.js";
const repo = resolve(import.meta.dirname, "../..");
function fixture(iteration = 3) {
  const root = mkdtempSync(join(tmpdir(), "human-art-"));
  const dir = `art/qa/coco_ward_v1/iteration-${String(iteration).padStart(2, "0")}`;
  mkdirSync(join(root, dir, "candidate"), { recursive: true });
  mkdirSync(join(root, "art/briefs"), { recursive: true });
  mkdirSync(join(root, "apps/client/src/animation"), { recursive: true });
  writeFileSync(
    join(root, "apps/client/src/animation/defense.ts"),
    "original presentation",
  );
  copyFileSync(join(repo, "art/ART_SPEC.md"), join(root, "art/ART_SPEC.md"));
  const atlas = `${dir}/candidate/atlas.png`,
    mask = `${dir}/candidate/mask.png`;
  const runtime = join(repo, "apps/client/public/assets/characters/ember");
  copyFileSync(join(runtime, "defense.png"), join(root, atlas));
  copyFileSync(join(runtime, "defense-mask.png"), join(root, mask));
  writeFileSync(
    join(root, dir, "candidate/submission.json"),
    JSON.stringify({
      kind: "production_atlas",
      image: "atlas.png",
      mask: "mask.png",
      frame_dimensions: [128, 128],
      frame_count: 1,
      anchor: [64, 70],
      provenance: "fixture",
    }),
  );
  const reviewPath = `${dir}/vision-report.json`,
    qaPath = `${dir}/qa-report.json`;
  const checks = [
    "character_consistency",
    "animation",
    "rendering",
    "vfx",
    "palette",
    "multiplayer",
    "responsive",
  ].map((id) => ({
    id,
    result: id === "animation" ? "REVIEW" : "PASS",
    category: id === "animation" ? "DESIGN" : undefined,
    evidence: atlas,
    feedback: "Reviewed evidence",
  }));
  writeFileSync(join(root, reviewPath), JSON.stringify({ checks }));
  writeFileSync(
    join(root, qaPath),
    JSON.stringify({
      checks: [
        { id: "objective", result: "PASS" },
        { id: "visual_rubric", result: "REVIEW" },
      ],
    }),
  );
  mkdirSync(join(root, "apps/client/public/assets/characters/ember"), {
    recursive: true,
  });
  copyFileSync(
    join(runtime, "defense.png"),
    join(root, "apps/client/public/assets/characters/ember/defense.png"),
  );
  copyFileSync(
    join(runtime, "defense-mask.png"),
    join(root, "apps/client/public/assets/characters/ember/defense-mask.png"),
  );
  const a: Asset = {
    asset_id: "coco_ward_v1",
    version: 1,
    status: "NEEDS_HUMAN_REVIEW",
    character: "coco",
    animation: "ward",
    source_file: `${dir}/candidate`,
    canonical_references: [],
    runtime_files: [atlas, mask],
    directions: ["omnidirectional"],
    frame_count: 1,
    frame_dimensions: [128, 128],
    anchor: [64, 70],
    palette_behavior: {},
    qa_status: "REVIEW",
    iteration,
    approved_at: null,
    target: "assets/characters/ember/defense.png",
    mask_target: "assets/characters/ember/defense-mask.png",
    reports: [qaPath, reviewPath],
    source_hash: digest(join(root, atlas)),
    integration_hash: digest(join(root, mask)),
    generation_attempts: 3,
  };
  writeFileSync(join(root, "art/briefs/coco_ward_v1.json"), JSON.stringify(a));
  writeFileSync(
    join(root, "art/manifest.json"),
    JSON.stringify({
      schema_version: 1,
      max_iterations: 3,
      assets: { coco_ward_v1: a },
    }),
  );
  const cli = (...args: string[]) =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", join(repo, "scripts/art/cli.ts"), ...args],
      {
        cwd: repo,
        env: { ...process.env, ART_WORKSPACE_ROOT: root, OPENAI_API_KEY: "" },
        encoding: "utf8",
      },
    );
  const asset = () =>
    JSON.parse(readFileSync(join(root, "art/manifest.json"), "utf8")).assets
      .coco_ward_v1 as Asset;
  return {
    root,
    dir,
    atlas,
    mask,
    reviewPath,
    qaPath,
    cli,
    asset,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
it("cleans only superseded iterations after approval, retaining reports and the approved evidence", () => {
  const f = fixture();
  try {
    const old = join(f.root, "art/qa/coco_ward_v1/iteration-01");
    const future = join(f.root, "art/qa/coco_ward_v1/iteration-04");
    const other = join(f.root, "art/qa/coco_ward_v2/iteration-01");
    for (const dir of [old, future, other]) mkdirSync(dir, { recursive: true });
    writeFileSync(join(old, "capture.webm"), "bulky media");
    const report = JSON.stringify({
      checks: [{ id: "animation", result: "REVIEW" }],
    });
    writeFileSync(join(old, "vision-report.json"), report);
    expect(f.cli("cleanup", "coco_ward_v1").status).toBe(1);
    expect(existsSync(old)).toBe(true);
    expect(f.cli("approve", "coco_ward_v1").status).toBe(0);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(join(f.root, f.atlas))).toBe(true);
    expect(existsSync(future)).toBe(true);
    expect(existsSync(other)).toBe(true);
    const history = join(
      f.root,
      "art/approved/coco_ward_v1/history/iteration-01",
    );
    expect(readFileSync(join(history, "vision-report.json"), "utf8")).toBe(
      report,
    );
    expect(existsSync(join(history, "capture.webm"))).toBe(false);
    expect(f.cli("cleanup", "coco_ward_v1").stdout).toContain("Removed 0");
  } finally {
    f.cleanup();
  }
}, 15000);
it("explicitly accepts REVIEW separately, preserves AI findings and publishes only after approval", () => {
  const f = fixture();
  try {
    const original = readFileSync(join(f.root, f.reviewPath));
    expect(f.cli("publish", "coco_ward_v1").status).toBe(1);
    expect(
      f.cli(
        "approve",
        "coco_ward_v1",
        "Watched both clients; accepted animation",
      ).status,
    ).toBe(0);
    expect(f.asset().status).toBe("APPROVED");
    expect(f.asset().qa_status).toBe("REVIEW");
    const decision = JSON.parse(
      readFileSync(join(f.root, f.asset().human_approval!), "utf8"),
    );
    expect(decision.acceptedFindings.map((c: { id: string }) => c.id)).toEqual([
      "animation",
    ]);
    expect(readFileSync(join(f.root, f.reviewPath))).toEqual(original);
    expect(f.cli("publish", "coco_ward_v1").status).toBe(0);
    expect(
      readFileSync(
        join(f.root, "apps/client/public/assets/characters/ember/defense.png"),
      ),
    ).toEqual(readFileSync(join(f.root, f.atlas)));
  } finally {
    f.cleanup();
  }
}, 15000);
it("records complete local review without forcing REVIEW to PASS and rejects duplicate criteria", () => {
  const f = fixture();
  try {
    const original = readFileSync(join(f.root, f.reviewPath));
    const review = JSON.parse(original.toString());
    const input = join(f.root, "local-review.json");
    writeFileSync(
      input,
      JSON.stringify({ checks: [...review.checks, review.checks[0]] }),
    );
    expect(f.cli("review", "coco_ward_v1", input).stderr).toContain(
      "exactly once",
    );
    writeFileSync(input, JSON.stringify({ checks: review.checks.slice(1) }));
    expect(f.cli("review", "coco_ward_v1", input).status).toBe(1);
    writeFileSync(
      input,
      JSON.stringify({ ...review, reviewer: "Local assistant inspection" }),
    );
    expect(f.cli("review", "coco_ward_v1", input).status).toBe(0);
    const local = JSON.parse(
      readFileSync(join(f.root, f.dir, "human-report.json"), "utf8"),
    );
    expect(local.reviewSource.reviewer).toBe("Local assistant inspection");
    expect(local.reviewSource.sha256).toBe(digest(input));
    expect(f.asset().status).toBe("NEEDS_HUMAN_REVIEW");
    expect(f.asset().qa_status).toBe("REVIEW");
    expect(f.cli("approve", "coco_ward_v1").status).toBe(0);
    const approval = JSON.parse(
      readFileSync(join(f.root, f.asset().human_approval!), "utf8"),
    );
    expect(approval.acceptedFindings.map((c: { id: string }) => c.id)).toEqual([
      "animation",
    ]);
    expect(readFileSync(join(f.root, f.reviewPath))).toEqual(original);
  } finally {
    f.cleanup();
  }
}, 15000);
it("never accepts objective failure, incomplete visual review or changed candidate", () => {
  const f = fixture();
  try {
    const originalReview = readFileSync(join(f.root, f.reviewPath));
    writeFileSync(
      join(f.root, f.qaPath),
      JSON.stringify({ checks: [{ id: "browser_errors", result: "FAIL" }] }),
    );
    expect(f.cli("approve", "coco_ward_v1").stderr).toContain("objective");
    writeFileSync(
      join(f.root, f.qaPath),
      JSON.stringify({ checks: [{ id: "objective", result: "PASS" }] }),
    );
    writeFileSync(
      join(f.root, f.reviewPath),
      JSON.stringify({ checks: [{ id: "animation", result: "REVIEW" }] }),
    );
    expect(f.cli("approve", "coco_ward_v1").stderr).toContain("seven");
    expect(f.asset().status).toBe("NEEDS_HUMAN_REVIEW");
    const failedReview = JSON.parse(originalReview.toString());
    failedReview.checks[0].result = "FAIL";
    failedReview.checks[0].category = "ART";
    writeFileSync(join(f.root, f.reviewPath), JSON.stringify(failedReview));
    expect(f.cli("approve", "coco_ward_v1").stderr).toContain(
      "classified failures",
    );
    writeFileSync(join(f.root, f.reviewPath), originalReview);
    writeFileSync(join(f.root, f.atlas), "changed candidate");
    expect(f.cli("approve", "coco_ward_v1").stderr).toContain(
      "changed after QA",
    );
  } finally {
    f.cleanup();
  }
}, 15000);
it("authorizes art iteration 4 without version churn or reusing the old submission", () => {
  const f = fixture();
  try {
    expect(
      f.cli(
        "revise",
        "coco_ward_v1",
        "--art",
        "Brighter ring; preserve silhouette",
      ).status,
    ).toBe(0);
    const a = f.asset();
    expect(a.version).toBe(1);
    expect(a.pending_revision?.to_iteration).toBe(4);
    expect(a.pending_revision?.feedback).toBe(
      "Brighter ring; preserve silhouette",
    );
    expect(a.pending_revision?.reference_atlas).toBe(f.atlas);
    expect(a.status).toBe("WAITING_FOR_ART");
    expect(iterationLimit(a, 3)).toBe(4);
    expect(a.authorized_generation_limit).toBe(4);
    expect(f.cli("run", "coco_ward_v1").stdout).toContain("WAITING_FOR_ART");
    expect(f.asset().iteration).toBe(3);
    expect(f.asset().source_file).not.toContain("iteration-03/candidate");
    const incoming = f.asset().source_file;
    mkdirSync(join(f.root, incoming), { recursive: true });
    for (const file of ["atlas.png", "mask.png", "submission.json"])
      copyFileSync(
        join(f.root, f.dir, "candidate", file),
        join(f.root, incoming, file),
      );
    expect(f.cli("integrate", "coco_ward_v1").status).toBe(0);
    expect(f.asset().iteration).toBe(4);
    expect(f.asset().pending_revision).toBeUndefined();
    expect(
      route(
        [
          {
            id: "art",
            result: "FAIL",
            category: "ART",
            feedback: "bad art",
            evidence: f.atlas,
          },
        ],
        4,
        iterationLimit(f.asset(), 3),
      ),
    ).toBe("NEEDS_HUMAN_REVIEW");
    expect(readFileSync(join(f.root, f.reviewPath), "utf8")).toContain(
      "REVIEW",
    );
  } finally {
    f.cleanup();
  }
}, 15000);
it("routes implementation to the engineer, forbids generation and stages unchanged art after code change", () => {
  const f = fixture();
  try {
    const bytes = readFileSync(join(f.root, f.atlas));
    expect(
      f.cli("revise", "coco_ward_v1", "--implementation", "Increase size 15%")
        .status,
    ).toBe(0);
    expect(f.cli("generate", "coco_ward_v1").status).toBe(1);
    expect(f.cli("run", "coco_ward_v1").stdout).toContain(
      "WAITING_FOR_IMPLEMENTATION",
    );
    expect(f.cli("integrate", "coco_ward_v1").stderr).toContain(
      "Game Engineer",
    );
    writeFileSync(
      join(f.root, "apps/client/src/animation/defense.ts"),
      "reviewed presentation change",
    );
    expect(f.cli("integrate", "coco_ward_v1").status).toBe(0);
    expect(f.asset().iteration).toBe(4);
    expect(f.asset().status).toBe("READY_FOR_QA");
    expect(readFileSync(join(f.root, f.asset().runtime_files[0]))).toEqual(
      bytes,
    );
    expect(f.asset().generation_attempts).toBe(3);
  } finally {
    f.cleanup();
  }
}, 20000);
it("rejects while preserving evidence and stopping future runs", () => {
  const f = fixture();
  try {
    expect(f.cli("reject", "coco_ward_v1", "Direction unsuitable").status).toBe(
      0,
    );
    expect(f.asset().status).toBe("REJECTED");
    expect(f.cli("run", "coco_ward_v1").stdout).toContain("REJECTED");
    expect(f.cli("approve", "coco_ward_v1").status).toBe(1);
    expect(f.cli("generate", "coco_ward_v1").status).toBe(1);
    expect(readFileSync(join(f.root, f.atlas)).length).toBeGreaterThan(0);
  } finally {
    f.cleanup();
  }
}, 15000);

it("respects the latest human disposition instead of resurrecting an earlier machine failure", () => {
  const f = fixture(2);
  try {
    const original = JSON.parse(
      readFileSync(join(f.root, f.reviewPath), "utf8"),
    );
    const failed = structuredClone(original);
    failed.checks[4] = {
      ...failed.checks[4],
      result: "FAIL",
      category: "ART",
      feedback: "Mask omits alpha-bearing halo coverage",
    };
    writeFileSync(join(f.root, f.reviewPath), JSON.stringify(failed));
    const disposition = `${f.dir}/investigation-disposition.json`;
    writeFileSync(join(f.root, disposition), JSON.stringify(original));
    const manifest = JSON.parse(
      readFileSync(join(f.root, "art/manifest.json"), "utf8"),
    );
    manifest.assets.coco_ward_v1.reports.push(disposition);
    writeFileSync(join(f.root, "art/manifest.json"), JSON.stringify(manifest));
    expect(f.cli("run", "coco_ward_v1").status).toBe(0);
    expect(f.asset().status).toBe("NEEDS_HUMAN_REVIEW");
  } finally {
    f.cleanup();
  }
}, 15000);

it("QA isolation prevents an outer ART journal from rejecting an unrelated implementation revision", () => {
  const f = fixture();
  try {
    const journal = join(f.root, "outer-art-request.json");
    writeFileSync(
      journal,
      JSON.stringify({ classification: { route: "ART" } }),
    );
    const outer = {
      ...process.env,
      ART_AGENT_INTENT_FILE: journal,
      ART_WORKSPACE_ROOT: f.root,
      OPENAI_API_KEY: "",
    };
    const run = (env: NodeJS.ProcessEnv) =>
      spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          join(repo, "scripts/art/cli.ts"),
          "revise",
          "coco_ward_v1",
          "--implementation",
          "Increase size 15%",
        ],
        { cwd: repo, env, encoding: "utf8" },
      );
    const leaked = run(outer);
    expect(leaked.status).toBe(1);
    expect(leaked.stderr).toContain(
      "Classification and revision route disagree",
    );
    const isolated = run(qaEnvironment(outer));
    expect(isolated.status).toBe(0);
    expect(f.asset().status).toBe("WAITING_FOR_IMPLEMENTATION");
    expect(outer.ART_AGENT_INTENT_FILE).toBe(journal);
  } finally {
    f.cleanup();
  }
});
it("retries failed QA in a new iteration without artist calls or changed artwork", () => {
  const f = fixture();
  try {
    const original = readFileSync(join(f.root, f.atlas));
    const failedPath = join(f.root, f.dir, "qa-report.json");
    writeFileSync(
      failedPath,
      JSON.stringify({
        checks: [
          { id: "qa_execution", result: "FAIL", category: "IMPLEMENTATION" },
        ],
      }),
    );
    const failed = readFileSync(failedPath);
    const result = f.cli("retry-qa", "coco_ward_v1");
    expect(result.stderr || result.stdout).toContain("artwork preserved");
    expect(result.status).toBe(0);
    expect(f.asset().iteration).toBe(4);
    expect(f.asset().status).toBe("READY_FOR_QA");
    expect(f.asset().generation_attempts).toBe(3);
    expect(readFileSync(join(f.root, f.asset().runtime_files[0]))).toEqual(
      original,
    );
    expect(readFileSync(failedPath)).toEqual(failed);
  } finally {
    f.cleanup();
  }
});
