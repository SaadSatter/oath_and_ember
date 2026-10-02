import { PNG } from "pngjs";
import { readFileSync } from "node:fs";
import type { Finding } from "./model.js";
export function inspectAtlas(
  imagePath: string,
  maskPath: string,
  dimensions: [number, number],
  count: number,
): Finding[] {
  const p = PNG.sync.read(readFileSync(imagePath)),
    m = PNG.sync.read(readFileSync(maskPath));
  const [w, h] = dimensions;
  const checks: Finding[] = [];
  const check = (id: string, ok: boolean, feedback: string) =>
    checks.push({
      id,
      result: ok ? "PASS" : "FAIL",
      category: ok ? undefined : "ART",
      evidence: imagePath,
      feedback: ok ? undefined : feedback,
    });
  check(
    "atlas_grid",
    p.width === w * count && p.height === h,
    "Supply a horizontal atlas matching the brief frame dimensions/count.",
  );
  check(
    "mask_dimensions",
    p.width === m.width && p.height === m.height,
    "Mask must match atlas dimensions.",
  );
  let transparent = 0,
    visible = 0,
    invalidMask = 0,
    masked = 0;
  const frames = new Set<number>();
  for (let i = 0; i < p.data.length; i += 4) {
    const a = p.data[i + 3];
    if (m.data[i + 3]) masked++;
    if (a === 0) transparent++;
    if (a > 0) {
      visible++;
      frames.add(Math.floor(((i / 4) % p.width) / w));
    }
    if (
      m.data[i + 3] &&
      (!a || m.data[i] !== 0 || m.data[i + 1] !== 255 || m.data[i + 2] !== 0)
    )
      invalidMask++;
  }
  check(
    "transparency",
    transparent > 0 && visible > 0,
    "Supply visible RGBA art with transparent background.",
  );
  check(
    "missing_frames",
    frames.size === count,
    "One or more frames are empty or outside the expected grid.",
  );
  check(
    "effect_mask",
    masked > 0 && invalidMask === 0,
    "Coco effect masks must use green only on visible effect pixels.",
  );
  const coverage = effectMaskDiagnostics(p, m);
  checks.push({
    id: "effect_mask_coverage",
    result: coverage.complete ? "PASS" : "FAIL",
    category: coverage.complete ? undefined : "IMPLEMENTATION",
    evidence: maskPath,
    feedback: coverage.complete
      ? undefined
      : `Effect mask coverage: ${coverage.missingPixels} missing, ${coverage.extraPixels} extra, ${coverage.invalidPixels} invalid pixels. Rebuild the isolated-effect mask from atlas alpha; preserve the atlas.`,
  });
  return checks;
}

export function buildEffectMask(atlas: PNG): PNG {
  const mask = new PNG({ width: atlas.width, height: atlas.height });
  for (let i = 0; i < atlas.data.length; i += 4)
    if (atlas.data[i + 3] > 0) mask.data.set([0, 255, 0, 255], i);
  return mask;
}
export function effectMaskDiagnostics(atlas: PNG, mask: PNG) {
  let visible = 0,
    missing = 0,
    extra = 0,
    invalid = 0;
  const dimensionsMatch =
    atlas.width === mask.width && atlas.height === mask.height;
  for (let i = 0; i < atlas.data.length; i += 4) {
    const active = atlas.data[i + 3] > 0;
    const covered =
      dimensionsMatch &&
      mask.data[i] === 0 &&
      mask.data[i + 1] === 255 &&
      mask.data[i + 2] === 0 &&
      mask.data[i + 3] === 255;
    if (active) {
      visible++;
      if (!covered) missing++;
    } else if (dimensionsMatch && mask.data[i + 3] > 0) extra++;
    if (dimensionsMatch && mask.data[i + 3] > 0 && !covered) invalid++;
  }
  return {
    dimensionsMatch,
    visiblePixels: visible,
    missingPixels: missing,
    extraPixels: extra,
    invalidPixels: invalid,
    complete:
      dimensionsMatch &&
      visible > 0 &&
      missing === 0 &&
      extra === 0 &&
      invalid === 0,
  };
}
