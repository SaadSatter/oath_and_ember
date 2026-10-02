import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  cpSync,
  renameSync,
  rmSync,
} from "node:fs";
import { resolve, relative, join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  idSchema,
  findingSchema,
  submissionSchema,
  route,
  type Asset,
  type Manifest,
  type Finding,
} from "./model.js";
import { inspectAtlas } from "./png.js";
import { capture } from "./qa.js";
const root = resolve(
    process.env.ART_WORKSPACE_ROOT || resolve(import.meta.dirname, "../.."),
  ),
  art = join(root, "art");
const path = (p: string) => join(root, p);
const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const write = (p: string, v: unknown) => {
  mkdirSync(resolve(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
};
const hash = (p: string) =>
  createHash("sha256").update(readFileSync(p)).digest("hex");
const manifestFile = join(art, "manifest.json");
const lock = join(art, ".pipeline-lock");
try {
  mkdirSync(lock);
  writeFileSync(
    join(lock, "owner.json"),
    JSON.stringify({ pid: process.pid, started: new Date().toISOString() }),
  );
} catch {
  throw Error(
    "Another art command is running. If interrupted, check art/.pipeline-lock/owner.json before removing the stale lock.",
  );
}
const manifest: Manifest = existsSync(manifestFile)
  ? json(manifestFile)
  : { schema_version: 1, max_iterations: 3, assets: {} };
const save = () => {
  write(manifestFile + ".tmp", manifest);
  renameSync(manifestFile + ".tmp", manifestFile);
};
function report(a: Asset, checks: Finding[], stage: string) {
  const dir = path(
    `art/qa/${a.asset_id}/iteration-${String(a.iteration).padStart(2, "0")}`,
  );
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${stage}-report.json`);
  if (existsSync(file))
    throw Error("Evidence already exists; use art:revise for a new iteration.");
  a.status = route(checks, a.iteration, manifest.max_iterations);
  a.qa_status = checks.some((c) => c.result === "FAIL")
    ? "FAIL"
    : checks.some((c) => c.result === "REVIEW")
      ? "REVIEW"
      : "PASS";
  const value = {
    assetId: a.asset_id,
    iteration: a.iteration,
    result: a.qa_status,
    status: a.status,
    route:
      a.status === "QA_FAILED_ART"
        ? "SPRITE_ARTIST"
        : a.status === "QA_FAILED_IMPLEMENTATION"
          ? "GAME_ENGINEER"
          : a.status === "NEEDS_HUMAN_REVIEW"
            ? "HUMAN"
            : null,
    checks,
  };
  write(file, value);
  writeFileSync(
    join(dir, `${stage}-summary.md`),
    `# ${a.asset_id}: ${a.status}\n\n` +
      checks
        .map(
          (c) =>
            `- ${c.result} ${c.id}: ${c.feedback || ""} ${c.evidence || ""}`,
        )
        .join("\n") +
      "\n",
  );
  a.reports.push(relative(root, file));
  save();
  console.log(
    `${a.status}: ${value.route || "human approval"}; report ${relative(root, file)}`,
  );
  for (const check of checks.filter((c) => c.result !== "PASS"))
    console.log(
      `${check.category || "REVIEW"} ${check.id}: ${check.feedback || ""} (${check.evidence || ""})`,
    );
}
function waiting(a: Asset) {
  a.status = "WAITING_FOR_ART";
  save();
  console.log(
    `WAITING_FOR_ART\nBrief: art/briefs/${a.asset_id}.json\nSupply ${a.source_file}/atlas.png, mask.png and submission.json; then npm run art:run -- ${a.asset_id}`,
  );
}
function brief(character: string, animation: string) {
  if (
    !/^[a-z][a-z0-9_]*$/.test(character || "") ||
    !/^[a-z][a-z0-9_]*$/.test(animation || "")
  )
    throw Error("Usage: art:brief -- coco ward");
  let version = 1;
  while (manifest.assets[`${character}_${animation}_v${version}`]) version++;
  const id = `${character}_${animation}_v${version}`;
  const ward = character === "coco" && animation === "ward",
    projectile = character === "coco" && animation === "projectile";
  const refs = [
    "Images/Character Concept art.png",
    ...(ward
      ? [
          "Images/Sprites/Defense Basic Sprites.png",
          "docs/DEFENSE_ASSET_PROVENANCE.json",
        ]
      : projectile
        ? [
            "Images/Sprites/Magic Basic Spell.png",
            "docs/MAGIC_PROJECTILE_PROVENANCE.json",
          ]
        : []),
  ];
  const a: Asset = {
    asset_id: id,
    version,
    status: "BRIEF",
    character,
    animation,
    source_file: `art/incoming/${id}`,
    canonical_references: refs,
    runtime_files: [],
    directions: ward ? ["omnidirectional"] : ["right", "left", "up", "down"],
    frame_count: ward ? 1 : 4,
    frame_dimensions: ward ? [128, 128] : [64, 64],
    anchor: ward ? [64, 70] : [32, 32],
    palette_behavior: {
      source: "canonical_ember_magic",
      runtime_recolor: true,
      mask_channel: "green",
    },
    qa_status: "NOT_RUN",
    iteration: 0,
    approved_at: null,
    target: ward
      ? "assets/characters/ember/defense.png"
      : projectile
        ? "assets/effects/coco/flight.png"
        : null,
    mask_target: ward
      ? "assets/characters/ember/defense-mask.png"
      : projectile
        ? "assets/effects/coco/flight-mask.png"
        : null,
    reports: [],
  };
  const specPath = path("art/ART_SPEC.md");
  if (!existsSync(specPath)) throw Error("Missing art/ART_SPEC.md");
  const b = {
    ...a,
    art_spec: { path: "art/ART_SPEC.md", sha256: hash(specPath) },
    canonical_reference_hashes: Object.fromEntries(
      refs.filter((p) => existsSync(path(p))).map((p) => [p, hash(path(p))]),
    ),
    approved_runtime_hash:
      a.target && existsSync(path(`apps/client/public/${a.target}`))
        ? hash(path(`apps/client/public/${a.target}`))
        : null,
    asset_type: ward
      ? "defensive_vfx"
      : projectile
        ? "projectile_vfx"
        : "requires_engineer_binding",
    perspective: "top_down",
    frame_count_target: a.frame_count,
    frame_dimensions_target: a.frame_dimensions,
    ground_anchor: a.anchor,
    canonical_reference: refs,
    approved_runtime_reference: a.target
      ? `apps/client/public/${a.target}`
      : null,
    effect_behavior: ward
      ? "Separate hollow rim; existing start/held/end envelope; Coco body unchanged"
      : "Existing flight animation and authoritative projectile movement",
    must_preserve: [
      "canonical silhouette",
      "equipment",
      "hair",
      "skin",
      "costume proportions",
    ],
    must_not_change: [
      "gameplay",
      "collision",
      "staff structure",
      "skin/hair/eyes palette",
    ],
    acceptance_criteria: [
      "transparent horizontal atlas",
      "exact frame grid and anchor",
      "green effect-only mask",
      "stable design across frames",
      "local/remote visibility",
      "four responsive viewports",
    ],
    previous_feedback: Object.values(manifest.assets)
      .filter((x) => x.character === character && x.animation === animation)
      .flatMap((x) => x.reports)
      .map((p) => ({
        report: p,
        checks: existsSync(path(p)) ? json(path(p)).checks : [],
      })),
  };
  write(path(`art/briefs/${id}.json`), b);
  writeFileSync(
    path(`art/briefs/${id}.md`),
    `# Generation brief: ${id}\n\nSee the JSON contract and art/ART_SPEC.md.\n\n${JSON.stringify(b, null, 2)}\n`,
  );
  manifest.assets[id] = a;
  save();
  waiting(a);
}
async function integrate(a: Asset) {
  if (
    ![
      "BRIEF",
      "WAITING_FOR_ART",
      "READY_FOR_INTEGRATION",
      "INTEGRATING",
    ].includes(a.status)
  )
    throw Error(
      "Integration requires an art handoff or explicit art:revise; approved assets are immutable.",
    );
  if (!a.target || !a.mask_target) {
    a.status = "NEEDS_HUMAN_REVIEW";
    save();
    throw Error(
      "No runtime binding: Game Engineer must define a reviewed adapter; no gameplay changes.",
    );
  }
  const source = path(a.source_file);
  if (!existsSync(join(source, "submission.json"))) {
    waiting(a);
    return;
  }
  if (a.iteration >= manifest.max_iterations) {
    a.status = "NEEDS_HUMAN_REVIEW";
    save();
    throw Error("Iteration limit reached.");
  }
  a.iteration++;
  a.status = "READY_FOR_INTEGRATION";
  save();
  let checks: Finding[] = [];
  try {
    const s = submissionSchema.parse(json(join(source, "submission.json")));
    if (
      JSON.stringify(s.frame_dimensions) !==
        JSON.stringify(a.frame_dimensions) ||
      s.frame_count !== a.frame_count ||
      JSON.stringify(s.anchor) !== JSON.stringify(a.anchor)
    )
      throw Error(
        "Submission dimensions/count/anchor differ from brief; do not guess extraction or rescale artwork.",
      );
    checks = inspectAtlas(
      join(source, s.image),
      join(source, s.mask),
      a.frame_dimensions,
      a.frame_count,
    );
  } catch (e) {
    checks = [
      {
        id: "submission",
        result: "FAIL",
        category: "ART",
        evidence: relative(root, source),
        feedback: String(e),
      },
    ];
  }
  if (checks.some((c) => c.result === "FAIL")) {
    report(a, checks, "integration");
    return;
  }
  a.status = "INTEGRATING";
  save();
  const dir = path(
    `art/qa/${a.asset_id}/iteration-${String(a.iteration).padStart(2, "0")}/candidate`,
  );
  mkdirSync(dir, { recursive: true });
  for (const f of ["atlas.png", "mask.png", "submission.json"])
    copyFileSync(join(source, f), join(dir, f));
  a.source_hash = hash(join(dir, "atlas.png"));
  a.integration_hash = hash(join(dir, "mask.png"));
  a.runtime_files = [
    relative(root, join(dir, "atlas.png")),
    relative(root, join(dir, "mask.png")),
  ];
  write(join(dir, "integration.json"), {
    sourceHash: a.source_hash,
    maskHash: a.integration_hash,
    adapter: "exact-grid identity normalization",
    target: a.target,
    maskTarget: a.mask_target,
    anchor: a.anchor,
    checks,
  });
  a.status = "READY_FOR_QA";
  save();
  console.log(
    "READY_FOR_QA: normalized candidate staged; production assets preserved.",
  );
}
async function qa(a: Asset) {
  if (a.status !== "READY_FOR_QA")
    throw Error("QA requires READY_FOR_QA; integrate first or use art:revise.");
  const dir = path(
    `art/qa/${a.asset_id}/iteration-${String(a.iteration).padStart(2, "0")}`,
  );
  if (existsSync(join(dir, "qa-report.json")))
    throw Error("QA evidence exists; use art:revise.");
  const checks: Finding[] = [];
  try {
    for (const command of ["typecheck", "test", "build"]) {
      const r = spawnSync("npm", ["run", command], {
        cwd: root,
        stdio: "inherit",
      });
      if (r.status !== 0) throw Error(`${command} failed`);
      checks.push({ id: command, result: "PASS" });
    }
    checks.push(...(await capture(root, dir, a)));
  } catch (e) {
    checks.push({
      id: "qa_execution",
      result: "FAIL",
      category: "IMPLEMENTATION",
      evidence: relative(root, dir),
      feedback: String(e),
    });
  }
  if (!checks.some((c) => c.result === "FAIL"))
    checks.push({
      id: "visual_rubric",
      result: "REVIEW",
      evidence: relative(root, dir),
      feedback:
        "Review contact sheet, both-client sequences and VISUAL_QA.md. Screenshots do not prove design consistency, timing, correct scale, or palette isolation.",
    });
  report(a, checks, "qa");
}
async function main() {
  const [command, arg, arg2] = process.argv.slice(2);
  if (command === "brief") return brief(arg, arg2);
  if (command === "status") {
    console.table(
      Object.values(manifest.assets).map((a) => ({
        asset: a.asset_id,
        status: a.status,
        iteration: a.iteration,
        qa: a.qa_status,
      })),
    );
    return;
  }
  idSchema.parse(arg);
  const a = manifest.assets[arg];
  if (!a) throw Error("Unknown asset; create a brief first.");
  if (command === "run") {
    if (
      a.status === "BRIEF" ||
      a.status === "WAITING_FOR_ART" ||
      a.status === "READY_FOR_INTEGRATION" ||
      a.status === "INTEGRATING"
    )
      await integrate(a);
    if (a.status === "READY_FOR_QA") await qa(a);
    console.log(a.status);
    return;
  }
  if (command === "integrate") return integrate(a);
  if (command === "qa") return qa(a);
  if (command === "review") {
    if (a.status !== "NEEDS_HUMAN_REVIEW")
      throw Error("Review requires a pending human review.");
    const latest = a.reports.at(-1);
    if (!latest || !latest.endsWith("qa-report.json"))
      throw Error("Complete browser QA before visual review.");
    const review = json(resolve(arg2));
    const checks = findingSchema.array().min(1).parse(review.checks);
    if (checks.some((c) => c.result === "REVIEW"))
      throw Error("Resolve all review items with PASS or classified FAIL.");
    const original = json(path(latest));
    if (original.checks.some((c: Finding) => c.result === "FAIL"))
      throw Error("Fix objective failures in a new iteration.");
    for (const c of checks)
      if (
        !c.evidence ||
        !existsSync(path(c.evidence)) ||
        !c.evidence.startsWith(
          `art/qa/${a.asset_id}/iteration-${String(a.iteration).padStart(2, "0")}/`,
        )
      )
        throw Error(
          "Review checks must cite existing evidence for this asset.",
        );
    for (const required of [
      "character_consistency",
      "animation",
      "rendering",
      "vfx",
      "palette",
      "multiplayer",
      "responsive",
    ])
      if (!checks.some((c) => c.id === required))
        throw Error(`Missing review criterion: ${required}`);
    report(a, checks, "human");
    return;
  }
  if (command === "revise") {
    if (a.status === "APPROVED") throw Error("Create a new version.");
    if (a.iteration >= manifest.max_iterations)
      throw Error(
        "Iteration limit reached; create a new brief with revised direction.",
      );
    if (
      ![
        "QA_FAILED_ART",
        "QA_FAILED_IMPLEMENTATION",
        "NEEDS_HUMAN_REVIEW",
      ].includes(a.status)
    )
      throw Error("Revision requires a reviewed failure.");
    a.status = "READY_FOR_INTEGRATION";
    save();
    return;
  }
  if (command === "approve") {
    if (a.status !== "AWAITING_APPROVAL")
      throw Error("Resolve QA and submit art:review before explicit approval.");
    const dir = path(`art/approved/${a.asset_id}`);
    if (existsSync(dir)) throw Error("Approved version already exists.");
    if (
      hash(path(a.runtime_files[0])) !== a.source_hash ||
      hash(path(a.runtime_files[1])) !== a.integration_hash
    )
      throw Error("Candidate changed after QA; revise and rerun.");
    mkdirSync(dir, { recursive: true });
    for (const f of a.runtime_files)
      copyFileSync(
        path(f),
        join(dir, f.endsWith("mask.png") ? "mask.png" : "atlas.png"),
      );
    cpSync(
      path(
        `art/qa/${a.asset_id}/iteration-${String(a.iteration).padStart(2, "0")}/candidate/submission.json`,
      ),
      join(dir, "submission.json"),
    );
    copyFileSync(
      path(`art/briefs/${a.asset_id}.json`),
      join(dir, "brief.json"),
    );
    a.status = "APPROVED";
    a.approved_at = new Date().toISOString();
    save();
    write(join(dir, "provenance.json"), a);
    console.log(
      "APPROVED source preserved. Publish to production explicitly with art:publish.",
    );
    return;
  }
  if (command === "publish") {
    if (a.status !== "APPROVED" || !a.target || !a.mask_target)
      throw Error("Only approved bound assets can be published.");
    if (
      hash(path(`art/approved/${a.asset_id}/atlas.png`)) !== a.source_hash ||
      hash(path(`art/approved/${a.asset_id}/mask.png`)) !== a.integration_hash
    )
      throw Error("Approved source changed; create a new version.");
    const archive = path(`art/approved/${a.asset_id}/previous-runtime`);
    if (existsSync(archive)) throw Error("Already published.");
    mkdirSync(archive);
    const targets = [a.target, a.mask_target];
    for (let i = 0; i < targets.length; i++) {
      const dest = path(`apps/client/public/${targets[i]}`);
      if (existsSync(dest))
        copyFileSync(dest, join(archive, i === 0 ? "atlas.png" : "mask.png"));
      copyFileSync(
        path(
          `art/approved/${a.asset_id}/${i === 0 ? "atlas.png" : "mask.png"}`,
        ),
        dest,
      );
    }
    console.log("Published approved candidate; previous runtime preserved.");
    return;
  }
  throw Error("Unknown command");
}
main()
  .catch((e) => {
    console.error(String(e));
    process.exitCode = 1;
  })
  .finally(() => rmSync(lock, { recursive: true, force: true }));
