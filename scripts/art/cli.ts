import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  cpSync,
  renameSync,
  rmSync,
  readdirSync,
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
import { extractTemporal } from "./temporal.js";
import {
  loadProviderConfig,
  requireApiKey,
  ProviderUnavailableError,
} from "./provider-config.js";
import {
  OpenAISpriteProvider,
  GeneratedArtError,
  effectLayout,
} from "./generation.js";
import { OpenAIVisionReviewer } from "./vision.js";
import { prepareMaskRecovery } from "./recovery.js";
import {
  approvalEvidence,
  iterationLimit,
  requireDecisionState,
} from "./human-decisions.js";
import { advanceAsset } from "./runner.js";
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
  a.status = route(
    checks,
    a.iteration,
    iterationLimit(a, manifest.max_iterations),
    loadProviderConfig(root).visual_qa.confidence_threshold,
  );
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
function iterationDirectory(a: Asset) {
  return `art/qa/${a.asset_id}/iteration-${String(a.iteration).padStart(2, "0")}`;
}
function canReview(a: Asset) {
  if (a.pending_revision) return false;
  const directory = iterationDirectory(a);
  const qaReport = path(`${directory}/qa-report.json`);
  return (
    existsSync(qaReport) &&
    !json(qaReport).checks.some((c: Finding) => c.result === "FAIL") &&
    !a.reports.some((p) => p.startsWith(`${directory}/vision`)) &&
    !readdirSync(path(directory)).some((f) => /^vision-attempt-[0-9]+$/.test(f))
  );
}
async function generate(a: Asset) {
  if (
    ![
      "BRIEF",
      "WAITING_FOR_ART",
      "GENERATING_ART",
      "READY_FOR_INTEGRATION",
      "QA_FAILED_ART",
      ...(a.status === "NEEDS_HUMAN_REVIEW" &&
      a.generation_history?.at(-1) &&
      existsSync(path(`${a.generation_history.at(-1)}/error.json`)) &&
      json(path(`${a.generation_history.at(-1)}/error.json`)).status ===
        "PROVIDER_FAILURE"
        ? ["NEEDS_HUMAN_REVIEW"]
        : []),
    ].includes(a.status)
  )
    throw Error(
      "Generation requires an art handoff or ART failure; create a new version for approved art.",
    );
  if (a.status === "GENERATING_ART") {
    const last = a.generation_history?.at(-1);
    if (last && existsSync(path(`${last}/submission.json`))) {
      a.source_file = last;
      a.status = "READY_FOR_INTEGRATION";
      save();
      console.log("Recovered completed generation; no new request made.");
      return;
    }
  }
  if (a.pending_revision?.reference_atlas) {
    const request = json(path(a.pending_revision.request_file));
    if (
      hash(path(a.pending_revision.reference_atlas)) !==
      request.candidate_hashes[0]
    )
      throw Error("Human revision reference changed after the decision");
  }
  const config = loadProviderConfig(root);
  if (config.sprite_artist.provider === "manual") {
    waiting(a);
    return;
  }
  let key: string;
  try {
    key = requireApiKey();
    effectLayout(a);
  } catch (e) {
    if (e instanceof ProviderUnavailableError) waiting(a);
    else {
      a.status = "NEEDS_HUMAN_REVIEW";
      save();
    }
    console.log(String(e));
    return;
  }
  if (
    a.iteration >= iterationLimit(a, manifest.max_iterations) ||
    (a.generation_attempts || 0) >=
      (a.authorized_generation_limit ?? manifest.max_iterations)
  ) {
    a.status = "NEEDS_HUMAN_REVIEW";
    save();
    console.log(
      "Generation/iteration limit reached; create a new brief with human direction.",
    );
    return;
  }
  const previousSource = a.source_file;
  a.generation_attempts = (a.generation_attempts || 0) + 1;
  const destination = `art/incoming/${a.asset_id}/generated/attempt-${String(a.generation_attempts).padStart(2, "0")}`;
  mkdirSync(path(destination), { recursive: true });
  a.generation_history ||= [];
  a.generation_history.push(destination);
  a.status = "GENERATING_ART";
  save();
  write(path(`${destination}/attempt.json`), {
    assetId: a.asset_id,
    attempt: a.generation_attempts,
    previousSource,
    status: "REQUESTING",
    started: new Date().toISOString(),
  });
  console.log(
    `SPRITE_ARTIST generating ${a.asset_id}, attempt ${a.generation_attempts}/${a.authorized_generation_limit ?? manifest.max_iterations} (${config.sprite_artist.model}).`,
  );
  try {
    const provider = new OpenAISpriteProvider(
      root,
      a,
      path(destination),
      config.sprite_artist,
      key,
    );
    const feedback: Finding[] = a.reports.length
      ? json(path(a.reports.at(-1)!)).checks
      : [];
    const generated = await provider.generate({
      assetId: a.asset_id,
      briefPath: `art/briefs/${a.asset_id}.json`,
      humanFeedback:
        a.pending_revision?.kind === "art"
          ? a.pending_revision.feedback
          : undefined,
      editSource:
        a.pending_revision?.kind === "art"
          ? a.pending_revision.reference_atlas
          : undefined,
      referencePaths: [
        ...a.canonical_references,
        ...(existsSync(path(`${previousSource}/atlas.png`))
          ? [`${previousSource}/atlas.png`]
          : []),
      ],
      feedback,
    });
    a.source_file = generated.submissionDirectory;
    a.status = "READY_FOR_INTEGRATION";
    save();
    write(path(`${destination}/completion.json`), {
      status: "READY_FOR_INTEGRATION",
      provenance: generated.provenance,
    });
  } catch (e) {
    write(path(`${destination}/error.json`), {
      error: String(e),
      status:
        e instanceof GeneratedArtError ? "ART_FAILURE" : "PROVIDER_FAILURE",
    });
    if (e instanceof GeneratedArtError) {
      a.iteration++;
      a.pending_revision = undefined;
      report(
        a,
        [
          {
            id: "generated_art",
            result: "FAIL",
            category: "ART",
            evidence: destination,
            feedback: String(e),
          },
        ],
        "generation",
      );
    } else {
      a.status = "NEEDS_HUMAN_REVIEW";
      save();
      console.log(
        `HUMAN: ${String(e)}; inspect ${destination}/error.json. A request may have been billed; no HTTP retry was made.`,
      );
    }
  }
}
async function vision(a: Asset) {
  if (
    ![
      "NEEDS_HUMAN_REVIEW",
      "QA_FAILED_ART",
      "QA_FAILED_IMPLEMENTATION",
    ].includes(a.status)
  )
    throw Error(
      "Vision review requires completed QA awaiting review; approved/passed assets are immutable.",
    );
  const config = loadProviderConfig(root);
  if (config.visual_qa.provider === "manual") {
    console.log(
      "Vision provider is manual; use art:review or enable visual_qa in art/providers.json.",
    );
    return;
  }
  let key: string;
  try {
    key = requireApiKey();
  } catch (e) {
    console.log(String(e));
    return;
  }
  const directory = iterationDirectory(a);
  mkdirSync(path(directory), { recursive: true });
  const attempts = readdirSync(path(directory)).filter((f) =>
    /^vision-attempt-[0-9]+$/.test(f),
  ).length;
  if (attempts >= manifest.max_iterations)
    throw Error("Vision attempt limit reached; human review required.");
  const destination = `${directory}/vision-attempt-${String(attempts + 1).padStart(2, "0")}`;
  mkdirSync(path(destination));
  console.log(
    `VISUAL_QA reviewing ${a.asset_id}, iteration ${a.iteration} (${config.visual_qa.model}).`,
  );
  try {
    const reviewer = new OpenAIVisionReviewer(root, config.visual_qa, key);
    const result = await reviewer.review(a, path(destination));
    report(
      a,
      [...result.packet.objectiveChecks, ...result.checks],
      attempts === 0
        ? "vision"
        : `vision-${String(attempts + 1).padStart(2, "0")}`,
    );
  } catch (e) {
    write(path(`${destination}/error.json`), { error: String(e) });
    report(
      a,
      [
        {
          id: "vision_execution",
          result: "REVIEW",
          category: "DESIGN",
          evidence: `${destination}/error.json`,
          feedback: `Vision unavailable or invalid: ${String(e)}. No artistic PASS inferred. Retry explicitly with art:vision or submit art:review.`,
        },
      ],
      `vision-error-${String(attempts + 1).padStart(2, "0")}`,
    );
  }
}
async function recover(a: Asset) {
  if (a.pending_revision) return false;
  if (
    a.iteration >= iterationLimit(a, manifest.max_iterations) ||
    ["APPROVED", "REJECTED", "WAITING_FOR_IMPLEMENTATION"].includes(a.status)
  )
    return false;
  const latest = [...a.reports]
    .reverse()
    .find((p) => p.startsWith(`${iterationDirectory(a)}/`));
  if (!latest) return false;
  const checks: Finding[] = json(path(latest)).checks;
  const previous = path(`${a.source_file}/recovery.json`);
  if (
    existsSync(previous) &&
    json(previous).result === "NOT_REPRODUCED" &&
    json(previous).atlasAfter === a.source_hash &&
    json(previous).maskAfter === a.integration_hash
  ) {
    // Repeat claim contradicted by exact pixel data: retain original FAIL, seek human adjudication.
    const { isMaskOnlyFailure } = await import("./recovery.js");
    if (isMaskOnlyFailure(checks)) {
      report(
        a,
        checks.map((c) =>
          c.result === "FAIL" &&
          (c.category === "ART" || c.category === "IMPLEMENTATION")
            ? {
                ...c,
                result: "REVIEW" as const,
                category: "DESIGN" as const,
                feedback: `Repeated mask claim conflicts with verified complete atlas-alpha coverage. Human adjudication required; original vision FAIL is preserved. ${c.feedback}`,
              }
            : c,
        ),
        "mask-dispute",
      );
      return false;
    }
  }
  const result = prepareMaskRecovery(root, a, checks);
  if (!result) return false;
  a.source_file = result.source;
  a.status = "READY_FOR_INTEGRATION";
  save();
  console.log(
    `${result.result}: ${result.before.missingPixels} missing mask pixels; atlas unchanged. New iteration ${result.toIteration}; animation REVIEW remains unresolved.`,
  );
  return true;
}
async function integrate(a: Asset) {
  if (
    a.status === "WAITING_FOR_IMPLEMENTATION" &&
    a.pending_revision?.kind === "implementation"
  ) {
    const request = json(path(a.pending_revision.request_file));
    const entries = Object.entries(request.implementation_baseline || {}) as [
      string,
      string,
    ][];
    if (
      !entries.length ||
      !entries.some(
        ([p, before]) => existsSync(path(p)) && hash(path(p)) !== before,
      )
    )
      throw Error(
        "Game Engineer handoff: implement the requested presentation change before integration",
      );
    if (
      !a.pending_revision.reference_atlas ||
      !a.pending_revision.reference_mask ||
      hash(path(a.pending_revision.reference_atlas)) !== a.source_hash ||
      hash(path(a.pending_revision.reference_mask)) !== a.integration_hash
    )
      throw Error(
        "Implementation revision must preserve the reviewed atlas and mask",
      );
    a.source_file = relative(
      root,
      resolve(path(a.pending_revision.reference_atlas), ".."),
    );
    a.status = "READY_FOR_INTEGRATION";
  }
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
  if (a.iteration >= iterationLimit(a, manifest.max_iterations)) {
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
    a.pending_revision = undefined;
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
  if (a.pending_revision) {
    write(
      join(dir, "human-request.json"),
      json(path(a.pending_revision.request_file)),
    );
    a.pending_revision = undefined;
  }
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
    if (a.pending_revision && a.status === "NEEDS_HUMAN_REVIEW") {
      console.log(
        "Pending human revision requires explicit provider-failure review; inspect saved attempt before art:generate. No automatic retry.",
      );
      return;
    }
    if (a.status === "REJECTED" || a.status === "WAITING_FOR_IMPLEMENTATION") {
      console.log(
        `${a.status}: ${a.pending_revision?.request_file || "candidate abandoned"}`,
      );
      return;
    }
    const config = loadProviderConfig(root);
    if (a.status === "GENERATING_ART") {
      console.log(
        "Interrupted generation: inspect the saved attempt; retry explicitly with art:generate to avoid silently duplicating a billed request.",
      );
      return;
    }
    if (a.status === "NEEDS_HUMAN_REVIEW") {
      const latest = [...a.reports]
        .reverse()
        .find((p) => p.startsWith(`${iterationDirectory(a)}/`));
      if (latest) {
        const checks: Finding[] = json(path(latest)).checks;
        const next = route(
          checks,
          a.iteration,
          iterationLimit(a, manifest.max_iterations),
          loadProviderConfig(root).visual_qa.confidence_threshold,
        );
        if (next !== a.status) report(a, checks, "routing");
      }
    }
    await advanceAsset(a, {
      artistEnabled: config.sprite_artist.provider === "openai",
      visionEnabled: config.visual_qa.provider === "openai",
      maxIterations: iterationLimit(a, manifest.max_iterations),
      hasSubmission: (a) =>
        existsSync(path(`${a.source_file}/submission.json`)),
      canReview,
      recover,
      generate,
      integrate,
      qa,
      vision,
    });
    console.log(a.status);
    return;
  }
  if (command === "recover") {
    if (!(await recover(a)))
      throw Error(
        "No safely recoverable mask-only failure, or iteration limit reached.",
      );
    return;
  }
  if (command === "generate") return generate(a);
  if (command === "temporal") {
    const packet = extractTemporal(root, a);
    console.log(
      `Prepared ${packet.frames.length} timestamped frames; candidate and QA iteration preserved. Phase alignment approximate; no API request made.`,
    );
    return;
  }
  if (command === "vision") return vision(a);
  if (command === "integrate") return integrate(a);
  if (command === "capture") return qa(a);
  if (command === "qa") {
    await qa(a);
    if (
      loadProviderConfig(root).visual_qa.provider === "openai" &&
      canReview(a)
    )
      await vision(a);
    return;
  }
  if (command === "review") {
    if (a.status !== "NEEDS_HUMAN_REVIEW")
      throw Error("Review requires a pending human review.");
    const latest = [...a.reports]
      .reverse()
      .find((p) => p === `${iterationDirectory(a)}/qa-report.json`);
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
  if (command === "reject") {
    if (["APPROVED", "REJECTED"].includes(a.status))
      throw Error("Cannot reject an approved or already rejected asset");
    const feedback = process.argv.slice(4).join(" ").trim();
    if (!feedback) throw Error("Usage: art:reject -- asset_id reason");
    const file = `${iterationDirectory(a)}/human-rejection.json`;
    if (existsSync(path(file))) throw Error("Decision already recorded");
    write(path(file), {
      decision: "reject",
      feedback,
      assetId: a.asset_id,
      iteration: a.iteration,
      created_at: new Date().toISOString(),
    });
    (a.human_decisions ||= []).push(file);
    a.pending_revision = undefined;
    a.status = "REJECTED";
    save();
    console.log("REJECTED: evidence preserved; no generation or publication.");
    return;
  }
  if (command === "revise" && ["--art", "--implementation"].includes(arg2)) {
    requireDecisionState(a);
    const args = process.argv.slice(5);
    const feedback =
      args[0] === "--feedback-file"
        ? readFileSync(resolve(args[1]), "utf8")
        : args.join(" ");
    if (!feedback.trim()) throw Error("Revision requires explicit feedback");
    const kind: "art" | "implementation" =
      arg2 === "--art" ? "art" : "implementation";
    const toIteration = a.iteration + 1;
    const file = `art/qa/${a.asset_id}/iteration-${String(toIteration).padStart(2, "0")}/human-request.json`;
    if (existsSync(path(file))) throw Error("Revision already requested");
    const request = {
      kind,
      feedback,
      request_file: file,
      from_iteration: a.iteration,
      to_iteration: toIteration,
      reference_atlas: a.runtime_files[0],
      reference_mask: a.runtime_files[1],
      previous_source: a.source_file,
    };
    const codeRoot = "apps/client/src";
    const codeFiles = existsSync(path(codeRoot))
      ? readdirSync(path(codeRoot), { recursive: true })
          .map(String)
          .filter((p) => /\.(ts|css)$/.test(p) && !p.startsWith("net/"))
          .map((p) => `${codeRoot}/${p}`)
      : [];
    write(path(file), {
      ...request,
      assetId: a.asset_id,
      decision: `revise_${kind}`,
      created_at: new Date().toISOString(),
      authorized_iterations: 1,
      automatic_max_iterations: manifest.max_iterations,
      candidate_hashes: [a.source_hash, a.integration_hash],
      implementation_baseline: Object.fromEntries(
        codeFiles
          .filter((p) => existsSync(path(p)))
          .map((p) => [p, hash(path(p))]),
      ),
    });
    a.pending_revision = request;
    (a.human_decisions ||= []).push(file);
    a.authorized_iteration_limit = Math.max(
      manifest.max_iterations,
      toIteration,
    );
    if (kind === "art") {
      a.authorized_generation_limit = Math.max(
        manifest.max_iterations,
        (a.generation_attempts || 0) + 1,
      );
      a.source_file = `art/incoming/${a.asset_id}/human-revisions/iteration-${String(toIteration).padStart(2, "0")}`;
      a.status = "WAITING_FOR_ART";
    } else a.status = "WAITING_FOR_IMPLEMENTATION";
    save();
    console.log(
      `${a.status}: iteration ${toIteration}; exact feedback preserved in ${file}. ${kind === "art" ? "Run art:run for the configured artist or supply the new submission." : "Game Engineer: change presentation code, then art:integrate and art:run. Atlas is preserved; no artist call."}`,
    );
    return;
  }
  if (command === "revise") {
    if (a.status === "APPROVED") throw Error("Create a new version.");
    if (a.iteration >= iterationLimit(a, manifest.max_iterations))
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
    const acceptance = approvalEvidence(root, a);
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
    const decisionFile = `${iterationDirectory(a)}/human-approval.json`;
    write(path(decisionFile), {
      decision: "approve",
      assetId: a.asset_id,
      iteration: a.iteration,
      created_at: new Date().toISOString(),
      feedback:
        process.argv.slice(4).join(" ").trim() ||
        "Explicit human acceptance via art:approve",
      ...acceptance,
      reviewHash: hash(path(acceptance.reviewPath)),
      candidateHashes: [a.source_hash, a.integration_hash],
    });
    copyFileSync(path(decisionFile), join(dir, "human-approval.json"));
    copyFileSync(
      path(acceptance.reviewPath),
      join(dir, "accepted-review.json"),
    );
    a.human_approval = decisionFile;
    (a.human_decisions ||= []).push(decisionFile);
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
