import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { resolveContract } from "./contracts.js";
import type { Asset, Finding } from "./model.js";
import { digest } from "./generation.js";
import { buildEffectMask, effectMaskDiagnostics, inspectAtlas } from "./png.js";
export function isMaskOnlyFailure(checks: Finding[]) {
  const failures = checks.filter(
    (c) =>
      c.result === "FAIL" &&
      (c.category === "ART" || c.category === "IMPLEMENTATION"),
  );
  return (
    failures.length > 0 &&
    failures.every(
      (c) =>
        c.id === "effect_mask_coverage" ||
        c.id === "effect_mask" ||
        c.id === "mask_dimensions" ||
        (c.id === "palette" &&
          /mask/i.test(c.feedback || "") &&
          /(alpha|halo|glow)/i.test(c.feedback || "") &&
          /(cover|omit|unmask)/i.test(c.feedback || "")),
    )
  );
}
export function prepareMaskRecovery(root: string, a: Asset, checks: Finding[]) {
  if (a.status === "APPROVED" || !isMaskOnlyFailure(checks)) return null;
  try {
    if (resolveContract(a, root).mask.strategy !== "alpha_effect") return null;
  } catch {
    return null;
  }
  // Semantic assurance comes from existing positive art findings, not mask geometry.
  for (const id of ["character_consistency", "rendering", "vfx"])
    if (
      !checks.some(
        (c) =>
          c.id === id &&
          c.result === "PASS" &&
          (c.confidence === undefined || c.confidence >= 0.85),
      )
    )
      return null;
  if (!a.source_hash || !a.integration_hash || a.runtime_files.length !== 2)
    throw Error("Mask recovery requires an integrated, hashed candidate.");
  const atlasFile = join(root, a.runtime_files[0]),
    maskFile = join(root, a.runtime_files[1]);
  if (
    digest(atlasFile) !== a.source_hash ||
    digest(maskFile) !== a.integration_hash
  )
    throw Error(
      "Candidate changed since review; cannot recover from stale evidence.",
    );
  const atlas = PNG.sync.read(readFileSync(atlasFile)),
    mask = PNG.sync.read(readFileSync(maskFile));
  const before = effectMaskDiagnostics(atlas, mask);
  const next = a.iteration + 1,
    source = `art/incoming/${a.asset_id}/repairs/iteration-${String(next).padStart(2, "0")}`,
    directory = join(root, source);
  if (existsSync(directory))
    throw Error(
      "Recovery already staged; resume it rather than overwrite history.",
    );
  mkdirSync(directory, { recursive: true });
  copyFileSync(atlasFile, join(directory, "atlas.png"));
  if (before.complete) copyFileSync(maskFile, join(directory, "mask.png"));
  else
    writeFileSync(
      join(directory, "mask.png"),
      PNG.sync.write(buildEffectMask(atlas)),
    );
  const submission = JSON.parse(
    readFileSync(join(root, a.source_file, "submission.json"), "utf8"),
  );
  submission.provenance += `; deterministic alpha-mask recovery from iteration ${a.iteration}; atlas preserved byte-for-byte; see recovery.json.`;
  writeFileSync(
    join(directory, "submission.json"),
    JSON.stringify(submission, null, 2) + "\n",
  );
  const after = effectMaskDiagnostics(
    atlas,
    PNG.sync.read(readFileSync(join(directory, "mask.png"))),
  );
  const checksAfter = inspectAtlas(
    join(directory, "atlas.png"),
    join(directory, "mask.png"),
    a.frame_dimensions,
    a.frame_count,
    resolveContract(a, root),
  );
  if (checksAfter.some((c) => c.result === "FAIL"))
    throw Error("Recovered mask did not pass objective validation.");
  const record = {
    assetId: a.asset_id,
    fromIteration: a.iteration,
    toIteration: next,
    result: before.complete ? "NOT_REPRODUCED" : "MASK_REPAIRED",
    atlasBefore: a.source_hash,
    atlasAfter: digest(join(directory, "atlas.png")),
    maskBefore: a.integration_hash,
    maskAfter: digest(join(directory, "mask.png")),
    before,
    after,
    triggerFindings: checks.filter((c) => c.result !== "PASS"),
    unresolvedReview: checks.filter((c) => c.result === "REVIEW"),
    method:
      "Green coverage iff atlas alpha > 0; no threshold, no RGB/alpha changes to artwork",
    source,
  };
  writeFileSync(
    join(directory, "recovery.json"),
    JSON.stringify(record, null, 2) + "\n",
  );
  return record;
}
