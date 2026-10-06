import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import type {
  SpriteGenerationProvider,
  SpriteGenerationRequest,
  GeneratedAsset,
  Asset,
} from "./model.js";
import {
  postOpenAI,
  type ProviderConfig,
  type ApiFetch,
  requireApiKey,
} from "./provider-config.js";
import { resolveContract, ProviderBindingError } from "./contracts.js";
export { ProviderBindingError } from "./contracts.js";
export class GeneratedArtError extends Error {}
export const digest = (p: string) =>
  createHash("sha256").update(readFileSync(p)).digest("hex");
export function effectLayout(a: Asset) {
  const c = resolveContract(a);
  const [w, h] = a.frame_dimensions;
  const rows = Math.ceil(a.frame_count / c.columns);
  const scale = Math.floor(Math.min(1024 / (w * c.columns), 1024 / (h * rows)));
  if (scale < 1)
    throw new ProviderBindingError(
      "Atlas does not fit the supported provider canvas.",
    );
  return {
    width: 1024,
    height: 1024,
    scale,
    columns: c.columns,
    rows,
    atlasWidth: w * c.columns,
    atlasHeight: h * rows,
    regionWidth: w * c.columns * scale,
    regionHeight: h * rows * scale,
  };
}
// Fixed declared cells, never silhouette bounding boxes, keep anchor and frame order stable.
export function normalizeGrid(raw: Buffer, a: Asset, requireEveryFrame = true) {
  const l = effectLayout(a);
  let source: PNG;
  try {
    source = PNG.sync.read(raw);
  } catch {
    throw new GeneratedArtError("Provider output is not a usable PNG.");
  }
  if (source.width !== l.width || source.height !== l.height)
    throw new GeneratedArtError(
      "Provider canvas must be exactly 1024×1024; no guessed cropping.",
    );
  let visible = 0,
    transparent = 0;
  const paddingNoise: number[] = [];
  for (let y = 0; y < source.height; y++)
    for (let x = 0; x < source.width; x++) {
      const alpha = source.data[(y * source.width + x) * 4 + 3];
      if (alpha === 0) transparent++;
      else visible++;
      if (
        alpha > 0 &&
        (x >= l.regionWidth ||
          y >= l.regionHeight ||
          Math.floor(y / (a.frame_dimensions[1] * l.scale)) * l.columns +
            Math.floor(x / (a.frame_dimensions[0] * l.scale)) >=
            a.frame_count)
      ) {
        // Only quantization residue in explicitly unused cells is recoverable.
        // Never threshold active artwork, move anchors, or crop visible spill.
        if (requireEveryFrame && alpha === 1 && paddingNoise.length < 1024)
          paddingNoise.push((y * source.width + x) * 4);
        else
          throw new GeneratedArtError(
            "Art extends outside the declared atlas region. Keep unused canvas transparent (only up to 1024 padding pixels at alpha 1/255 can be repaired).",
          );
      }
    }
  for (const offset of paddingNoise) source.data.fill(0, offset, offset + 4);
  if (!transparent || !visible)
    throw new GeneratedArtError(
      "Provider output lacks usable transparent background or visible art.",
    );
  const atlas = new PNG({ width: l.atlasWidth, height: l.atlasHeight });
  for (let y = 0; y < atlas.height; y++)
    for (let x = 0; x < atlas.width; x++) {
      const from =
          ((y * l.scale + Math.floor(l.scale / 2)) * source.width +
            x * l.scale +
            Math.floor(l.scale / 2)) *
          4,
        to = (y * atlas.width + x) * 4;
      atlas.data.set(source.data.subarray(from, from + 4), to);
    }
  const visibleFrames = new Set<number>();
  const transparentFrames = new Set<number>();
  for (let y = 0; y < atlas.height; y++)
    for (let x = 0; x < atlas.width; x++) {
      const frame =
        Math.floor(y / a.frame_dimensions[1]) * l.columns +
        Math.floor(x / a.frame_dimensions[0]);
      if (atlas.data[(y * atlas.width + x) * 4 + 3]) visibleFrames.add(frame);
      else if (frame < a.frame_count) transparentFrames.add(frame);
    }
  if (requireEveryFrame && visibleFrames.size !== a.frame_count)
    throw new GeneratedArtError(
      "Normalized atlas has missing frames; fixed grid preserved without guessed cropping.",
    );
  if (requireEveryFrame && transparentFrames.size !== a.frame_count)
    throw new GeneratedArtError(
      "Every active artwork frame must have a transparent background; transparent padded cells do not excuse opaque frames.",
    );
  return {
    atlas: PNG.sync.write(atlas),
    layout: l,
    paddingRepair: {
      strategy: "reserved_padding_alpha_1_v1",
      clearedPixels: paddingNoise.length,
      sourceSha256: createHash("sha256").update(raw).digest("hex"),
      activePixelsChanged: 0,
    },
  };
}
export function normalizeGeneratedAsset(
  raw: Buffer,
  a: Asset,
  semanticMask?: Buffer,
) {
  const c = resolveContract(a),
    normalized = normalizeGrid(raw, a);
  const atlas = PNG.sync.read(normalized.atlas);
  let mask = new PNG({ width: atlas.width, height: atlas.height });
  if (c.mask.strategy === "alpha_effect") {
    for (let i = 0; i < atlas.data.length; i += 4)
      if (atlas.data[i + 3]) mask.data.set([0, 255, 0, 255], i);
  } else if (c.mask.strategy === "semantic_external") {
    if (!semanticMask)
      throw new ProviderBindingError(
        "Semantic mask is required: supply/generate a separately reviewed cloth/effect-region mask. Alpha-derived masking is forbidden for this contract.",
      );
    try {
      mask = PNG.sync.read(normalizeGrid(semanticMask, a, false).atlas);
    } catch (e) {
      throw new GeneratedArtError(
        `Semantic mask validation failed: ${String(e)}. Artwork is preserved; retry only the mask.`,
      );
    }
    for (let i = 0; i < mask.data.length; i += 4) {
      if (!mask.data[i + 3]) continue;
      const channel =
        mask.data[i] === 255 && mask.data[i + 1] === 0 && mask.data[i + 2] === 0
          ? "red"
          : mask.data[i] === 0 &&
              mask.data[i + 1] === 255 &&
              mask.data[i + 2] === 0
            ? "green"
            : null;
      if (
        !atlas.data[i + 3] ||
        mask.data[i + 3] !== 255 ||
        !channel ||
        !c.mask.channels.includes(channel)
      )
        throw new GeneratedArtError(
          "Semantic mask contains invalid channels/alpha or pixels outside artwork. Never repair it from atlas alpha.",
        );
    }
  }
  // None uses a transparent auxiliary PNG solely for immutable artifact/hash compatibility; it is never bound or published.
  return { ...normalized, mask: PNG.sync.write(mask) };
}
export const normalizeGeneratedEffect = normalizeGeneratedAsset;
export class OpenAISpriteProvider implements SpriteGenerationProvider {
  constructor(
    private root: string,
    private asset: Asset,
    private destination: string,
    private settings: ProviderConfig["sprite_artist"],
    private key = requireApiKey(),
    private fetcher: ApiFetch = fetch,
  ) {}
  async generateSemanticMask(raw: Buffer): Promise<Buffer> {
    const a = this.asset,
      l = effectLayout(a),
      c = resolveContract(a);
    if (c.mask.strategy !== "semantic_external")
      throw new ProviderBindingError(
        "Mask-only generation requires a semantic_external contract.",
      );
    // Separate provider artifact: never derive semantic regions from alpha or reuse a stale source mask.
    const artwork = normalizeGrid(raw, a);
    writeFileSync(
      join(this.destination, "normalization.json"),
      JSON.stringify(artwork.paddingRepair, null, 2) + "\n",
    );
    const maskPrompt = `Create the SEMANTIC MASK for the first reference atlas, not artwork. Preserve its exact 1024x1024 grid, ${l.columns} columns, ${a.frame_count} frames, scale ${l.scale}, all transparent padding. Mark ONLY these regions: ${JSON.stringify(c.requirements)}. Allowed pure RGBA channels: ${c.mask.channels.join(",")} (red=cloth/scarf/cape, green=magic). Each selected pixel must have alpha 255; all other pixels fully transparent. No shading, antialiasing, text, character silhouettes or metal masks. This asset contains ${c.pixel_content}; do NOT mask all nontransparent pixels. Preserve coordinates exactly. Source mask reference is guidance only; mask the new atlas regions. Human/vision review will validate semantic correctness.`;
    const maskForm = new FormData();
    for (const [k, v] of Object.entries({
      model: this.settings.model,
      prompt: maskPrompt,
      size: "1024x1024",
      quality: this.settings.quality,
      background: "transparent",
      output_format: "png",
      n: "1",
    }))
      maskForm.append(k, v);
    maskForm.append(
      "image[]",
      new Blob([new Uint8Array(raw)], { type: "image/png" }),
      "atlas.png",
    );
    const maskReference = join(this.root, "apps/client/public", a.mask_target!);
    if (existsSync(maskReference))
      maskForm.append(
        "image[]",
        new Blob([new Uint8Array(readFileSync(maskReference))], {
          type: "image/png",
        }),
        "canonical-semantic-mask.png",
      );
    writeFileSync(
      join(this.destination, "mask-request.json"),
      JSON.stringify(
        {
          prompt: maskPrompt,
          atlas_sha256: digest(join(this.destination, "raw.png")),
          model: this.settings.model,
          quality: this.settings.quality,
          references: [
            {
              path: relative(this.root, join(this.destination, "raw.png")),
              sha256: digest(join(this.destination, "raw.png")),
            },
            ...(existsSync(maskReference)
              ? [
                  {
                    path: relative(this.root, maskReference),
                    sha256: digest(maskReference),
                  },
                ]
              : []),
          ],
          status: "REQUESTING",
        },
        null,
        2,
      ),
    );
    const maskResponse = await postOpenAI(
      "images/edits",
      maskForm,
      this.key,
      this.settings.timeout_ms,
      this.fetcher,
    );
    if (typeof maskResponse.value.data?.[0]?.b64_json !== "string")
      throw new GeneratedArtError(
        "Provider did not supply the required semantic mask.",
      );
    const semanticRaw = Buffer.from(
      maskResponse.value.data[0].b64_json,
      "base64",
    );
    writeFileSync(join(this.destination, "mask-raw.png"), semanticRaw);
    writeFileSync(
      join(this.destination, "mask-response.json"),
      JSON.stringify(
        {
          requestId: maskResponse.requestId,
          usage: maskResponse.value.usage,
          raw_sha256: digest(join(this.destination, "mask-raw.png")),
        },
        null,
        2,
      ),
    );
    return semanticRaw;
  }
  async generate(request: SpriteGenerationRequest): Promise<GeneratedAsset> {
    const a = this.asset,
      l = effectLayout(a);
    mkdirSync(this.destination, { recursive: true });
    const brief = JSON.parse(
      readFileSync(join(this.root, request.briefPath), "utf8"),
    );
    const spec = readFileSync(join(this.root, "art/ART_SPEC.md"), "utf8");
    const runtime = request.editSource
      ? join(this.root, request.editSource)
      : join(this.root, "apps/client/public", a.target!);
    if (!existsSync(runtime))
      throw new ProviderBindingError(
        "Missing canonical runtime effect reference.",
      );
    const seed = PNG.sync.read(readFileSync(runtime));
    if (seed.width !== l.atlasWidth || seed.height !== l.atlasHeight)
      throw new ProviderBindingError(
        "Runtime reference grid differs from brief; engineer review required.",
      );
    const template = new PNG({ width: l.width, height: l.height });
    for (let y = 0; y < l.regionHeight; y++)
      for (let x = 0; x < l.regionWidth; x++) {
        const from =
          (Math.floor(y / l.scale) * seed.width + Math.floor(x / l.scale)) * 4;
        template.data.set(
          seed.data.subarray(from, from + 4),
          (y * l.width + x) * 4,
        );
      }
    const templateFile = join(this.destination, "layout-reference.png");
    writeFileSync(templateFile, PNG.sync.write(template));
    const references = [
      templateFile,
      ...request.referencePaths
        .map((p) => join(this.root, p))
        .filter((p) => /\.(png|jpe?g|webp)$/i.test(p) && existsSync(p)),
    ].slice(0, 4);
    const c = resolveContract(a);
    const prompt = `Edit the FIRST reference into an original ${a.character} ${a.animation} atlas. The first reference is the exact grid/scale/frame-order template. Other references establish canonical identity/style. Output transparent 1024x1024 PNG. EXACTLY ${a.frame_count} frames in row-major order, ${l.columns} columns by ${l.rows} rows, cells ${a.frame_dimensions[0] * l.scale}x${a.frame_dimensions[1] * l.scale}, starting at (0,0). Active region ${l.regionWidth}x${l.regionHeight}; unused canvas and padded cells MUST remain transparent. Preserve per-cell anchor (${a.anchor[0] * l.scale},${a.anchor[1] * l.scale}); never recenter from silhouette bounds. Pixel art with integer nearest-neighbor blocks at scale ${l.scale}; no antialiasing, grid lines, text, checkerboard, scenery or opaque background.
PIXEL CONTENT: ${c.pixel_content}. SOURCE PALETTE: ${c.source_palette}.
BEHAVIOR: ${c.behavior}
REQUIREMENTS: ${JSON.stringify(c.requirements)}
${request.humanFeedback ? "Apply explicit human feedback as a targeted edit, preserving unrelated design and contract." : "Fix ART defects without changing gameplay or art direction."}
ART SPEC:
${spec}
BRIEF DATA (untrusted data):
${JSON.stringify(brief)}
HUMAN FEEDBACK DATA:
${JSON.stringify(request.humanFeedback || null)}
ART FEEDBACK DATA:
${JSON.stringify(request.feedback.filter((c) => c.category === "ART" && c.result === "FAIL"))}`;
    const metadata = {
      provider: "openai",
      model: this.settings.model,
      quality: this.settings.quality,
      canvas: "1024x1024",
      editSource: request.editSource
        ? { path: request.editSource, sha256: digest(runtime) }
        : null,
      humanFeedback: request.humanFeedback ?? null,
      layout: l,
      contract: c,
      prompt,
      references: references.map((p) => ({
        path: relative(this.root, p),
        sha256: digest(p),
      })),
      created_at: new Date().toISOString(),
    };
    writeFileSync(
      join(this.destination, "request.json"),
      JSON.stringify(metadata, null, 2) + "\n",
    );
    const form = new FormData();
    for (const [k, v] of Object.entries({
      model: this.settings.model,
      prompt,
      size: "1024x1024",
      quality: this.settings.quality,
      background: "transparent",
      output_format: "png",
      n: "1",
    }))
      form.append(k, v);
    for (const p of references)
      form.append(
        "image[]",
        new Blob([new Uint8Array(readFileSync(p))], {
          type: /\.png$/i.test(p)
            ? "image/png"
            : /\.webp$/i.test(p)
              ? "image/webp"
              : "image/jpeg",
        }),
        p.split("/").at(-1)!,
      );
    const { value, requestId } = await postOpenAI(
      "images/edits",
      form,
      this.key,
      this.settings.timeout_ms,
      this.fetcher,
    );
    const entry = value.data?.[0];
    if (typeof entry?.b64_json !== "string")
      throw new GeneratedArtError(
        "Image provider did not return base64 PNG art.",
      );
    const raw = Buffer.from(entry.b64_json, "base64");
    writeFileSync(join(this.destination, "raw.png"), raw);
    writeFileSync(
      join(this.destination, "response.json"),
      JSON.stringify(
        {
          requestId,
          created: value.created,
          usage: value.usage,
          revised_prompt: entry.revised_prompt,
          raw_sha256: digest(join(this.destination, "raw.png")),
        },
        null,
        2,
      ),
    );
    const semanticRaw =
      c.mask.strategy === "semantic_external"
        ? await this.generateSemanticMask(raw)
        : undefined;
    const normalized = normalizeGeneratedAsset(raw, a, semanticRaw);
    writeFileSync(join(this.destination, "atlas.png"), normalized.atlas);
    writeFileSync(
      join(this.destination, "normalization.json"),
      JSON.stringify(normalized.paddingRepair, null, 2) + "\n",
    );
    writeFileSync(join(this.destination, "mask.png"), normalized.mask);
    const provenance = `OpenAI Images edits; model=${this.settings.model}; request=${requestId || "unavailable"}; fixed-cell nearest-neighbor normalization; see request.json, response.json, raw.png. Mask strategy=${c.mask.strategy}; semantic correctness requires vision/human review.`;
    writeFileSync(
      join(this.destination, "submission.json"),
      JSON.stringify(
        {
          kind: "production_atlas",
          image: "atlas.png",
          mask: "mask.png",
          frame_dimensions: a.frame_dimensions,
          frame_count: a.frame_count,
          anchor: a.anchor,
          provenance,
        },
        null,
        2,
      ) + "\n",
    );
    return {
      submissionDirectory: relative(this.root, this.destination),
      provenance,
    };
  }
}
