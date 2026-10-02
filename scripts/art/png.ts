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
  return checks;
}
