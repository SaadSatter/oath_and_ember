import { describe, it, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { runAgent, parseAgentArgs, type Execute } from "./agent.js";
import { classifyFeedback, selectAsset } from "./feedback.js";
import {
  buildReviewCard,
  formatReviewCard,
  writeReviewPage,
} from "./review-card.js";
import { planPresentation, applyPresentation } from "./engineer.js";
import { digest } from "./generation.js";
import type { Asset, Manifest, Finding } from "./model.js";
const repo = resolve(import.meta.dirname, "../..");
function fixture(animation = "ward", iteration = 3) {
  const root = mkdtempSync(join(tmpdir(), "art-conversation-"));
  for (const dir of [
    "art/briefs",
    "apps/client/src/assets",
    "apps/client/public/assets/characters/ember",
    "apps/client/public/assets/effects/coco",
  ]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  copyFileSync(join(repo, "art/ART_SPEC.md"), join(root, "art/ART_SPEC.md"));
  copyFileSync(
    join(repo, "apps/client/src/assets/effectPresentation.ts"),
    join(root, "apps/client/src/assets/effectPresentation.ts"),
  );
  // Workflow fixtures use a stable baseline, independent of the current art direction.
  const profilePath = join(
    root,
    "apps/client/src/assets/effectPresentation.ts",
  );
  const profileSource = readFileSync(profilePath, "utf8");
  const profileMatch = profileSource.match(
    /export const effectPresentationProfiles:[^=]+=(\s*\{[\s\S]*?\});\s*\/\/ END PROFILES/,
  )!;
  const profiles = JSON.parse(profileMatch[1]);
  profiles.ward = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    startRate: 1.5,
    endRate: 1.5,
    pulseMs: 210,
    rotationMs: 2400,
  };
  writeFileSync(
    profilePath,
    profileSource.replace(
      profileMatch[1],
      " " + JSON.stringify(profiles, null, 2),
    ),
  );
  const role =
    animation === "projectile"
      ? "effects/coco/flight"
      : "characters/ember/defense";
  for (const suffix of [".png", "-mask.png"])
    copyFileSync(
      join(repo, "apps/client/public/assets", role + suffix),
      join(root, "apps/client/public/assets", role + suffix),
    );
  const id = `coco_${animation}_v1`,
    dir = `art/qa/${id}/iteration-${String(iteration).padStart(2, "0")}`;
  mkdirSync(join(root, dir, "candidate"), { recursive: true });
  copyFileSync(
    join(root, "apps/client/public/assets", role + ".png"),
    join(root, dir, "candidate/atlas.png"),
  );
  copyFileSync(
    join(root, "apps/client/public/assets", role + "-mask.png"),
    join(root, dir, "candidate/mask.png"),
  );
  const a: Asset = {
    asset_id: id,
    version: 1,
    status: "NEEDS_HUMAN_REVIEW",
    character: "coco",
    animation,
    source_file: `${dir}/candidate`,
    canonical_references: [],
    runtime_files: [`${dir}/candidate/atlas.png`, `${dir}/candidate/mask.png`],
    directions: [],
    frame_count: animation === "projectile" ? 4 : 1,
    frame_dimensions: animation === "projectile" ? [64, 64] : [128, 128],
    anchor: animation === "projectile" ? [32, 32] : [64, 70],
    palette_behavior: {},
    qa_status: "REVIEW",
    iteration,
    approved_at: null,
    source_hash: digest(join(root, dir, "candidate/atlas.png")),
    integration_hash: digest(join(root, dir, "candidate/mask.png")),
    target: `assets/${role}.png`,
    mask_target: `assets/${role}-mask.png`,
    reports: [],
    generation_attempts: 3,
  };
  writeFileSync(
    join(root, dir, "candidate/submission.json"),
    JSON.stringify({
      kind: "production_atlas",
      image: "atlas.png",
      mask: "mask.png",
      frame_dimensions: a.frame_dimensions,
      frame_count: a.frame_count,
      anchor: a.anchor,
      provenance: "test fixture",
    }),
  );
  writeFileSync(join(root, "art/briefs", id + ".json"), JSON.stringify(a));
  const m: Manifest = {
    schema_version: 1,
    max_iterations: 3,
    assets: { [id]: a },
  };
  const save = () =>
    writeFileSync(join(root, "art/manifest.json"), JSON.stringify(m));
  save();
  const load = () =>
    JSON.parse(
      readFileSync(join(root, "art/manifest.json"), "utf8"),
    ) as Manifest;
  const asset = () => load().assets[id];
  function evidence(a: Asset) {
    const d = `art/qa/${id}/iteration-${String(a.iteration).padStart(2, "0")}`;
    mkdirSync(join(root, d, "temporal"), { recursive: true });
    copyFileSync(
      join(root, a.runtime_files[0]),
      join(root, d, "contact-sheet.png"),
    );
    for (const client of [1, 2])
      writeFileSync(
        join(root, d, "temporal", `1920x1080-client-${client}.webm`),
        "video fixture",
      );
    writeFileSync(
      join(root, d, "temporal/index.json"),
      JSON.stringify({
        recordings: [1, 2].map((client) => ({
          client,
          viewport: "1920x1080",
          path: `${d}/temporal/1920x1080-client-${client}.webm`,
        })),
      }),
    );
    const qa = `${d}/qa-report.json`,
      review = `${d}/vision-report.json`;
    const objective = [
      { id: "typecheck", result: "PASS" },
      { id: "browser_errors", result: "PASS" },
    ];
    writeFileSync(join(root, qa), JSON.stringify({ checks: objective }));
    const checks: Finding[] = [
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
      evidence: a.runtime_files[0],
      feedback:
        id === "animation"
          ? "Uncaptured intervals require human judgment"
          : "Reviewed evidence",
    }));
    writeFileSync(
      join(root, review),
      JSON.stringify({ checks: [...objective, ...checks] }),
    );
    const next = load();
    next.assets[id].reports.push(qa, review);
    next.assets[id].status = "NEEDS_HUMAN_REVIEW";
    next.assets[id].qa_status = "REVIEW";
    writeFileSync(join(root, "art/manifest.json"), JSON.stringify(next));
  }
  evidence(a);
  const commands: string[][] = [];
  const execute: Execute = (args, intent) => {
    commands.push(args);
    if (args[0] === "run") {
      let current = asset();
      if (current.status === "WAITING_FOR_ART" && current.pending_revision) {
        mkdirSync(join(root, current.source_file), { recursive: true });
        for (const file of ["atlas.png", "mask.png", "submission.json"])
          copyFileSync(
            resolve(
              root,
              current.pending_revision.reference_atlas!,
              "..",
              file,
            ),
            join(root, current.source_file, file),
          );
        execute(["integrate", id], intent);
        current = asset();
      }
      if (current.status === "READY_FOR_QA") evidence(current);
      return;
    }
    if (args[0] === "temporal") {
      const d = `art/qa/${id}/iteration-${String(asset().iteration).padStart(2, "0")}/temporal/frames-v1`;
      mkdirSync(join(root, d), { recursive: true });
      writeFileSync(join(root, d, "manifest.json"), "{}");
      return;
    }
    const r = spawnSync(
      process.execPath,
      ["--import", "tsx", join(repo, "scripts/art/cli.ts"), ...args],
      {
        cwd: repo,
        env: {
          ...process.env,
          ART_WORKSPACE_ROOT: root,
          OPENAI_API_KEY: "",
          ...(intent ? { ART_AGENT_INTENT_FILE: intent } : {}),
        },
        encoding: "utf8",
      },
    );
    if (r.status !== 0) throw Error(r.stderr || r.stdout);
  };
  return {
    root,
    id,
    dir,
    asset,
    load,
    commands,
    execute,
    evidence,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
describe("conversational art workflow", () => {
  it("classifies ART and IMPLEMENTATION and stops on ambiguity", () => {
    expect(
      classifyFeedback("Make the barrier brighter and the runes stronger.")
        .route,
    ).toBe("ART");
    expect(
      classifyFeedback("The art looks good, but render the Ward 15% larger.")
        .route,
    ).toBe("IMPLEMENTATION");
    expect(classifyFeedback("Slow the release fade.").route).toBe(
      "IMPLEMENTATION",
    );
    expect(classifyFeedback("Change the rune shapes.").route).toBe("ART");
    expect(classifyFeedback("Make it better").route).toBe("AMBIGUOUS");
    expect(classifyFeedback("Brighter artwork and slower fade").route).toBe(
      "COMBINED",
    );
  });
  it("selects the latest existing version and never invents a second asset for improvement", () => {
    const f = fixture();
    try {
      const m = f.load();
      m.assets.coco_ward_v4 = {
        ...f.asset(),
        asset_id: "coco_ward_v4",
        version: 4,
      };
      expect(selectAsset(m, "Make Coco's Ward brighter").asset?.asset_id).toBe(
        "coco_ward_v4",
      );
      expect(
        selectAsset(m, "Ward and projectile", undefined, undefined)
          .clarification,
      ).toBeDefined();
    } finally {
      f.cleanup();
    }
  });
  it("natural-language ART feedback delegates the same-version iteration to existing commands", () => {
    const f = fixture();
    try {
      const old = readFileSync(join(f.root, f.dir, "vision-report.json"));
      const result = runAgent(
        f.root,
        { text: "Make Coco's Ward brighter", allowProviderUpload: true },
        f.execute,
      );
      expect(f.commands[0]).toEqual([
        "revise",
        f.id,
        "--art",
        "Make Coco's Ward brighter",
      ]);
      expect(
        f.commands.some((c) => c[0] === "run" && c.includes("--defer-vision")),
      ).toBe(true);
      expect(f.asset().iteration).toBe(4);
      expect(f.asset().version).toBe(1);
      expect(f.asset().authorized_iteration_limit).toBe(4);
      expect(readFileSync(join(f.root, f.dir, "vision-report.json"))).toEqual(
        old,
      );
      const request = JSON.parse(
        readFileSync(
          join(f.root, `art/qa/${f.id}/iteration-04/human-request.json`),
          "utf8",
        ),
      );
      expect(request.classification.route).toBe("ART");
      expect(request.feedback).toBe("Make Coco's Ward brighter");
      expect(result.card?.unresolved.some((c) => c.id === "animation")).toBe(
        true,
      );
    } finally {
      f.cleanup();
    }
  }, 20000);
  it.each(["ward", "projectile"])(
    "automatically implements bounded % size changes for %s without regenerating art",
    (animation) => {
      const f = fixture(animation);
      try {
        const bytes = readFileSync(join(f.root, f.asset().runtime_files[0]));
        const result = runAgent(
          f.root,
          {
            assetId: f.id,
            text: `IMPROVE: render the ${animation} 15% larger`,
          },
          f.execute,
        );
        expect(result.clarification).toBeUndefined();
        expect(f.asset().iteration).toBe(4);
        expect(f.asset().generation_attempts).toBe(3);
        expect(f.commands.some((c) => c[0] === "generate")).toBe(false);
        expect(readFileSync(join(f.root, f.asset().runtime_files[0]))).toEqual(
          bytes,
        );
        const change = JSON.parse(
          readFileSync(
            join(f.root, `art/qa/${f.id}/iteration-04/engineer-change.json`),
            "utf8",
          ),
        );
        expect(change.after.scale).toBeCloseTo(1.15);
        expect(change.beforeHash).not.toBe(change.afterHash);
      } finally {
        f.cleanup();
      }
    },
    20000,
  );
  it("handles size and whole Ward rotation from one complete implementation prompt", () => {
    const f = fixture();
    try {
      const atlas = readFileSync(join(f.root, f.asset().runtime_files[0]));
      const result = runAgent(
        f.root,
        {
          assetId: f.id,
          text: "IMPROVE: The ward is too big and it's a little choppy with its rotation",
        },
        f.execute,
      );
      expect(result.clarification).toBeUndefined();
      const change = JSON.parse(
        readFileSync(
          join(f.root, `art/qa/${f.id}/iteration-04/engineer-change.json`),
          "utf8",
        ),
      );
      expect(change.after.scale).toBeCloseTo(0.8);
      expect(change.after.rotationMs).toBe(4000);
      expect(change.operations).toHaveLength(2);
      expect(f.asset().iteration).toBe(4);
      expect(readFileSync(join(f.root, f.asset().runtime_files[0]))).toEqual(
        atlas,
      );
      expect(f.commands.some((c) => c[0] === "generate")).toBe(false);
    } finally {
      f.cleanup();
    }
  });
  it("runs a combined art and presentation request in one iteration, both before QA", () => {
    const f = fixture();
    try {
      writeFileSync(
        join(f.root, "art/providers.json"),
        JSON.stringify({
          schema_version: 1,
          sprite_artist: { provider: "openai" },
          visual_qa: { provider: "manual" },
        }),
      );
      const original =
        "IMPROVE: Make the barrier brighter and the runes stronger. Also render the whole Ward 20% smaller and rotate smoothly once every 4 seconds.";
      const stages: string[] = [];
      const execute: Execute = (args, intent) => {
        stages.push(args[0]);
        if (args[0] === "generate") {
          const a = f.asset();
          mkdirSync(join(f.root, a.source_file), { recursive: true });
          for (const file of ["atlas.png", "mask.png", "submission.json"])
            copyFileSync(
              resolve(f.root, a.pending_revision!.reference_atlas!, "..", file),
              join(f.root, a.source_file, file),
            );
          const m = f.load();
          m.assets[f.id].status = "READY_FOR_INTEGRATION";
          writeFileSync(join(f.root, "art/manifest.json"), JSON.stringify(m));
          return;
        }
        if (args[0] === "run") {
          const profile = readFileSync(
            join(f.root, "apps/client/src/assets/effectPresentation.ts"),
            "utf8",
          );
          expect(profile).toContain('"rotationMs": 4000');
          expect(profile).toContain('"scale": 0.8');
        }
        f.execute(args, intent);
      };
      const result = runAgent(
        f.root,
        { assetId: f.id, text: original, allowProviderUpload: true },
        execute,
      );
      expect(result.clarification).toBeUndefined();
      expect(stages.slice(0, 4)).toEqual([
        "revise",
        "generate",
        "integrate",
        "run",
      ]);
      expect(f.asset().iteration).toBe(4);
      expect(f.asset().authorized_iteration_limit).toBe(4);
      const request = JSON.parse(
        readFileSync(
          join(f.root, `art/qa/${f.id}/iteration-04/human-request.json`),
          "utf8",
        ),
      );
      expect(request.classification.route).toBe("COMBINED");
      expect(request.original_feedback).toBe(
        original.replace(/^IMPROVE: /, ""),
      );
      expect(request.feedback).not.toContain("rotate");
      expect(request.tasks.implementation).toContain("rotate");
      expect(
        existsSync(
          join(f.root, `art/qa/${f.id}/iteration-04/engineer-change.json`),
        ),
      ).toBe(true);
    } finally {
      f.cleanup();
    }
  });
  it("resumes one combined manual-art handoff without losing or repeating its presentation task", () => {
    const f = fixture();
    try {
      const text =
        "IMPROVE: Make the barrier brighter. Render Ward 20% smaller and rotate smoothly every 4 seconds.";
      const first = runAgent(f.root, { assetId: f.id, text }, f.execute);
      expect(first.clarification).toContain("supply its art submission");
      expect(f.asset().iteration).toBe(3);
      const a = f.asset();
      mkdirSync(join(f.root, a.source_file), { recursive: true });
      for (const file of ["atlas.png", "mask.png", "submission.json"])
        copyFileSync(
          resolve(f.root, a.pending_revision!.reference_atlas!, "..", file),
          join(f.root, a.source_file, file),
        );
      const second = runAgent(f.root, { text: "RESUME" }, f.execute);
      expect(second.clarification).toBeUndefined();
      expect(f.asset().iteration).toBe(4);
      const changes = JSON.parse(
        readFileSync(
          join(f.root, `art/qa/${f.id}/iteration-04/engineer-change.json`),
          "utf8",
        ),
      );
      expect(changes.after.scale).toBeCloseTo(0.8);
      expect(changes.after.rotationMs).toBe(4000);
      const code = digest(
        join(f.root, "apps/client/src/assets/effectPresentation.ts"),
      );
      runAgent(f.root, { text: "RESUME" }, f.execute);
      expect(f.asset().iteration).toBe(4);
      expect(
        digest(join(f.root, "apps/client/src/assets/effectPresentation.ts")),
      ).toBe(code);
      expect(f.commands.filter((c) => c[0] === "revise")).toHaveLength(1);
    } finally {
      f.cleanup();
    }
  });
  it("combined requests with unsupported engineering stop before spending an art call or partially editing code", () => {
    const f = fixture();
    try {
      const before = digest(
        join(f.root, "apps/client/src/assets/effectPresentation.ts"),
      );
      const result = runAgent(
        f.root,
        {
          assetId: f.id,
          text: "IMPROVE: Make the barrier brighter. Render the Ward 20% smaller and change animation networking.",
        },
        f.execute,
      );
      expect(result.clarification).toContain("cannot fully interpret");
      expect(f.commands).toEqual([]);
      expect(f.asset().iteration).toBe(3);
      expect(
        digest(join(f.root, "apps/client/src/assets/effectPresentation.ts")),
      ).toBe(before);
    } finally {
      f.cleanup();
    }
  });
  it("interprets the full smaller-fit and pulse-instead-of-rotation request without a handoff", () => {
    const f = fixture();
    try {
      const result = runAgent(
        f.root,
        {
          assetId: f.id,
          text: "IMPROVE: Make the Ward smallerjust enough to fit Coco inside and instead of rotating make it pulse smoothly.",
        },
        f.execute,
      );
      expect(result.clarification).toBeUndefined();
      const change = JSON.parse(
        readFileSync(
          join(f.root, `art/qa/${f.id}/iteration-04/engineer-change.json`),
          "utf8",
        ),
      );
      expect(change.after.scale).toBeCloseTo(0.8);
      expect(change.after.rotationMs).toBe(0);
      expect(change.after.pulseMs * 2 * Math.PI).toBeCloseTo(1800);
      expect(change.after.pulseScale).toBe(0.04);
      expect(f.commands.some((c) => c[0] === "generate")).toBe(false);
    } finally {
      f.cleanup();
    }
  });
  it("centers Ward around Coco as presentation-only feedback without touching the atlas", () => {
    const f = fixture();
    try {
      const original = readFileSync(join(f.root, f.asset().runtime_files[0]));
      expect(classifyFeedback("Make the Ward center around Coco").route).toBe(
        "IMPLEMENTATION",
      );
      const result = runAgent(
        f.root,
        { assetId: f.id, text: "IMPROVE: Make the Ward center around Coco" },
        f.execute,
      );
      expect(result.clarification).toBeUndefined();
      const c = JSON.parse(
        readFileSync(
          join(f.root, `art/qa/${f.id}/iteration-04/engineer-change.json`),
          "utf8",
        ),
      );
      expect(c.after.centerOnCoco).toBe(true);
      expect(c.after.offsetX).toBe(0);
      expect(c.after.offsetY).toBe(0);
      expect(c.after.scale).toBe(c.before.scale);
      expect(readFileSync(join(f.root, f.asset().runtime_files[0]))).toEqual(
        original,
      );
      expect(f.commands.some((c) => c[0] === "generate")).toBe(false);
    } finally {
      f.cleanup();
    }
  });
  it("ambiguous feedback does not revise, edit code or upload", () => {
    const f = fixture();
    try {
      const before = readFileSync(join(f.root, "art/manifest.json"));
      const result = runAgent(
        f.root,
        { assetId: f.id, text: "IMPROVE: better please" },
        f.execute,
      );
      expect(result.clarification).toBeDefined();
      expect(f.commands).toEqual([]);
      expect(readFileSync(join(f.root, "art/manifest.json"))).toEqual(before);
    } finally {
      f.cleanup();
    }
  });
  it("unknown/broad engineering is a real handoff, never a partial or fictitious edit", () => {
    const f = fixture();
    try {
      const before = digest(
        join(f.root, "apps/client/src/assets/effectPresentation.ts"),
      );
      const result = runAgent(
        f.root,
        {
          assetId: f.id,
          text: "IMPROVE: render Ward 15% larger and rewrite network interpolation",
        },
        f.execute,
      );
      expect(result.clarification).toContain("Automatic engineering");
      expect(f.asset().status).toBe("WAITING_FOR_IMPLEMENTATION");
      expect(
        digest(join(f.root, "apps/client/src/assets/effectPresentation.ts")),
      ).toBe(before);
      expect(f.commands.some((c) => c[0] === "generate")).toBe(false);
    } finally {
      f.cleanup();
    }
  }, 15000);
  it("animated candidates choose actual local/remote video and static candidates choose a contact sheet", () => {
    const f = fixture();
    try {
      const card = buildReviewCard(f.root, f.asset());
      expect(card.best).toContain("client-2.webm");
      expect(card.remote).toContain("client-1.webm");
      const staticAsset = { ...f.asset(), animation: "illustration" };
      writeFileSync(
        join(f.root, f.dir, "temporal/index.json"),
        '{"recordings":[]}',
      );
      expect(buildReviewCard(f.root, staticAsset).best).toContain(
        "contact-sheet.png",
      );
    } finally {
      f.cleanup();
    }
  });
  it("review output/page includes evidence, preserved REVIEW and safe commands; escapes untrusted findings", () => {
    const f = fixture();
    try {
      const path = join(f.root, f.dir, "vision-report.json");
      const report = JSON.parse(readFileSync(path, "utf8"));
      report.checks[2].feedback = '<script>alert("x")</script>';
      writeFileSync(path, JSON.stringify(report));
      const card = writeReviewPage(f.root, f.asset());
      const terminal = formatReviewCard(f.root, card);
      expect(terminal).toContain("Review Card:");
      expect(terminal).toContain("IMPROVE");
      expect(terminal).toContain("Uncaptured intervals");
      const page = readFileSync(join(f.root, card.page!), "utf8");
      expect(page).toContain("<video controls");
      expect(page).toContain("&lt;script&gt;");
      expect(page).not.toContain("<script>alert");
    } finally {
      f.cleanup();
    }
  });
  it("pending improvements show clickable previous evidence and never imply a new preview is ready", () => {
    const f = fixture();
    try {
      f.execute([
        "revise",
        f.id,
        "--implementation",
        "Make the Ward pulse smoothly",
      ]);
      const card = writeReviewPage(f.root, f.asset());
      const terminal = formatReviewCard(f.root, card);
      expect(card.iteration).toBe(4);
      expect(card.evidenceIteration).toBe(3);
      expect(terminal).toContain("No new improvement preview yet");
      expect(terminal).toContain("PREVIOUS iteration 3");
      expect(terminal).toContain("\u001b]8;;file:");
      expect(terminal).toContain('"RESUME"');
      expect(terminal).not.toContain('"APPROVE"');
      const html = readFileSync(join(f.root, card.page!), "utf8");
      expect(html).toContain("Requested iteration 4 is pending");
    } finally {
      f.cleanup();
    }
  });
  it("APPROVE delegates human acceptance then publication and never rewrites machine REVIEW", () => {
    const f = fixture();
    try {
      const report = readFileSync(join(f.root, f.dir, "vision-report.json"));
      runAgent(f.root, { assetId: f.id, text: "APPROVE" }, f.execute);
      expect(f.asset().status).toBe("APPROVED");
      expect(f.asset().qa_status).toBe("REVIEW");
      expect(f.commands.slice(0, 2)).toEqual([
        ["approve", f.id],
        ["publish", f.id],
      ]);
      expect(readFileSync(join(f.root, f.dir, "vision-report.json"))).toEqual(
        report,
      );
      expect(
        existsSync(join(f.root, `art/approved/${f.id}/human-approval.json`)),
      ).toBe(true);
      runAgent(f.root, { assetId: f.id, text: "APPROVE" }, f.execute);
      expect(f.commands.filter((c) => c[0] === "publish")).toHaveLength(1);
    } finally {
      f.cleanup();
    }
  }, 15000);
  it("REJECT preserves evidence and prevents subsequent publication", () => {
    const f = fixture();
    try {
      runAgent(
        f.root,
        { assetId: f.id, text: "REJECT: wrong direction" },
        f.execute,
      );
      expect(f.asset().status).toBe("REJECTED");
      expect(existsSync(join(f.root, f.dir, "vision-report.json"))).toBe(true);
      expect(() =>
        runAgent(f.root, { assetId: f.id, text: "APPROVE" }, f.execute),
      ).toThrow();
      expect(f.commands.some((c) => c[0] === "publish")).toBe(false);
    } finally {
      f.cleanup();
    }
  }, 15000);
  it("objective failure cannot be waived by APPROVE", () => {
    const f = fixture();
    try {
      writeFileSync(
        join(f.root, f.dir, "qa-report.json"),
        JSON.stringify({
          checks: [
            {
              id: "browser_errors",
              result: "FAIL",
              feedback: "bad",
              category: "IMPLEMENTATION",
              evidence: f.dir,
            },
          ],
        }),
      );
      expect(() =>
        runAgent(f.root, { assetId: f.id, text: "APPROVE" }, f.execute),
      ).toThrow("objective");
      expect(f.asset().status).not.toBe("APPROVED");
      expect(f.commands.some((c) => c[0] === "publish")).toBe(false);
    } finally {
      f.cleanup();
    }
  }, 15000);
  it("provider uploads need explicit scoped authorization; interruption never retries automatically", () => {
    const f = fixture();
    try {
      writeFileSync(
        join(f.root, "art/providers.json"),
        JSON.stringify({
          schema_version: 1,
          sprite_artist: { provider: "openai" },
          visual_qa: { provider: "openai" },
        }),
      );
      const m = f.load();
      m.assets[f.id].status = "GENERATING_ART";
      writeFileSync(join(f.root, "art/manifest.json"), JSON.stringify(m));
      const result = runAgent(
        f.root,
        { assetId: f.id, text: "RESUME", allowProviderUpload: true },
        f.execute,
      );
      expect(result.clarification).toContain("Interrupted");
      expect(f.commands).toEqual([]);
      m.assets[f.id].status = "WAITING_FOR_ART";
      writeFileSync(join(f.root, "art/manifest.json"), JSON.stringify(m));
      writeFileSync(join(f.root, "art/agent-session.json"), "{}");
      const blocked = runAgent(
        f.root,
        { assetId: f.id, text: "RESUME" },
        f.execute,
      );
      expect(blocked.clarification).toContain("upload");
      expect(f.commands).toEqual([]);
    } finally {
      f.cleanup();
    }
  });
  it("fresh natural-language creation delegates to the Director and preserves original intent on RESUME", () => {
    const f = fixture();
    try {
      const m = f.load();
      m.assets = {};
      writeFileSync(join(f.root, "art/manifest.json"), JSON.stringify(m));
      const commands: string[][] = [];
      const execute: Execute = (args, intent) => {
        commands.push(args);
        if (args[0] !== "run") f.execute(args, intent);
      };
      const first = runAgent(
        f.root,
        { text: "Create Coco's projectile with bright runes" },
        execute,
      );
      expect(commands[0]).toEqual(["brief", "coco", "projectile"]);
      expect(first.card?.assetId).toBe("coco_projectile_v1");
      runAgent(f.root, { text: "RESUME" }, execute);
      const session = JSON.parse(
        readFileSync(join(f.root, "art/agent-session.json"), "utf8"),
      );
      const intent = JSON.parse(readFileSync(session.directorRequest, "utf8"));
      expect(intent.feedback).toBe(
        "Create Coco's projectile with bright runes",
      );
      expect(commands.filter((c) => c[0] === "brief")).toHaveLength(1);
    } finally {
      f.cleanup();
    }
  });
  it("stale implicit approvals remain blocked until a new review card is requested", () => {
    const f = fixture();
    try {
      runAgent(f.root, { text: "REVIEW", assetId: f.id }, f.execute);
      const session = JSON.parse(
        readFileSync(join(f.root, "art/agent-session.json"), "utf8"),
      );
      session.iteration = 2;
      writeFileSync(
        join(f.root, "art/agent-session.json"),
        JSON.stringify(session),
      );
      for (let n = 0; n < 2; n++)
        expect(
          runAgent(f.root, { text: "APPROVE" }, f.execute).clarification,
        ).toContain("Candidate changed");
      expect(f.commands).toEqual([]);
      runAgent(f.root, { text: "REVIEW" }, f.execute);
      expect(
        JSON.parse(readFileSync(join(f.root, "art/agent-session.json"), "utf8"))
          .iteration,
      ).toBe(3);
    } finally {
      f.cleanup();
    }
  });
  it("local QA mode never calls a configured provider, even with saved upload authorization", () => {
    const f = fixture();
    try {
      writeFileSync(
        join(f.root, "art/providers.json"),
        JSON.stringify({
          schema_version: 1,
          sprite_artist: { provider: "openai" },
          visual_qa: { provider: "openai" },
        }),
      );
      const m = f.load();
      m.assets[f.id].reports = m.assets[f.id].reports.filter(
        (p) => !p.includes("vision"),
      );
      writeFileSync(join(f.root, "art/manifest.json"), JSON.stringify(m));
      const commands: string[][] = [];
      runAgent(
        f.root,
        {
          assetId: f.id,
          text: "RESUME",
          localQaOnly: true,
          allowProviderUpload: true,
        },
        (args) => {
          commands.push(args);
        },
      );
      expect(commands.some((c) => ["vision", "generate"].includes(c[0]))).toBe(
        false,
      );
      expect(commands.find((c) => c[0] === "run")).toContain("--no-artist");
    } finally {
      f.cleanup();
    }
  });
  it("parser handles decision/asset/auth flags without shell execution", () => {
    expect(
      parseAgentArgs([
        "--asset",
        "coco_ward_v4",
        "--allow-provider-upload",
        "IMPROVE: render Ward 15% larger",
      ]),
    ).toMatchObject({
      assetId: "coco_ward_v4",
      allowProviderUpload: true,
      text: "IMPROVE: render Ward 15% larger",
    });
    expect(() => parseAgentArgs(["--route", "guess"])).toThrow();
  });
  it("engineer bounds and artifact/authorization checks fail closed", () => {
    const f = fixture();
    try {
      expect(
        planPresentation(f.root, f.asset(), "render Ward 90% larger")
          .clarification,
      ).toBeDefined();
      expect(
        planPresentation(f.root, f.asset(), "move Ward 20 px higher")
          .clarification,
      ).toBeDefined();
      const plan = planPresentation(f.root, f.asset(), "move Ward 4 px higher");
      expect(() => applyPresentation(f.root, f.asset(), plan)).toThrow(
        "authorization",
      );
    } finally {
      f.cleanup();
    }
  });
});
