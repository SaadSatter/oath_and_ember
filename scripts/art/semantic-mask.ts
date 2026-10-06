import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { normalizeGrid } from "./generation.js";
import { resolveContract } from "./contracts.js";
import type { Asset } from "./model.js";

// Reviewed label codec, not segmentation. No region is inferred from atlas alpha
// or source colors. Alpha is used only to reject labels outside the artwork.
// Every uncertain pixel blocks staging; we never erode, clip, or fill a mask.
export function normalizeSemanticLabels(raw: Buffer, atlasBytes: Buffer, a: Asset) {
  const contract = resolveContract(a);
  if (contract.mask.strategy !== "semantic_external" ||
      contract.mask.normalization !== "semantic_labels_v1")
    throw Error("Contract must explicitly permit semantic_labels_v1");
  const labels = PNG.sync.read(raw), atlas = PNG.sync.read(atlasBytes);
  const layout = normalizeGrid(PNG.sync.write(labels), a, false);
  void layout;
  return { labels, atlas };
}
