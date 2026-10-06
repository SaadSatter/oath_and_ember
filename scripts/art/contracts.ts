import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { Asset } from "./model.js";
import {
  defenseAsset,
  defenseClip,
} from "../../apps/client/src/animation/defense.js";
import { magicAssets } from "../../apps/client/src/animation/projectile.js";
const runtimePath = z.string().regex(/^assets\/[a-zA-Z0-9_\/-]+\.png$/);
export const assetContractSchema = z
  .object({
    schema_version: z.literal(1),
    asset_type: z.enum(["effect", "equipment", "character_animation"]),
    pixel_content: z.enum(["effect_only", "character_equipment"]),
    normalization: z.literal("fixed_grid_v1"),
    frame_dimensions: z.tuple([
      z.number().int().positive(),
      z.number().int().positive(),
    ]),
    frame_count: z.number().int().positive(),
    columns: z.number().int().positive(),
    anchor: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
    directions: z.array(z.string()).min(1),
    mask: z
      .object({
        strategy: z.enum(["alpha_effect", "none", "semantic_external"]),
        channels: z.array(z.enum(["red", "green"])),
        normalization: z.literal("semantic_labels_v1").optional(),
      })
      .strict(),
    target: runtimePath,
    mask_target: runtimePath.nullable(),
    canonical_references: z.array(z.string()),
    source_palette: z.string(),
    behavior: z.string().min(1),
    requirements: z.array(z.string()).min(1),
    qa: z
      .object({
        mechanism: z.enum(["defense", "projectile"]),
        role: z.enum(["OATH", "EMBER"]),
      })
      .strict(),
  })
  .strict()
  .superRefine((c, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (
      c.mask.strategy === "alpha_effect" &&
      (c.pixel_content !== "effect_only" || c.mask.channels.join() !== "green")
    )
      issue("Alpha masks require effect_only pixels and the green channel");
    if ((c.mask.strategy === "none") !== (c.mask_target === null))
      issue("Mask strategy and runtime mask binding disagree");
    if (c.mask.strategy !== "none" && !c.mask.channels.length)
      issue("Recolor mask channels are required");
    if (c.mask.normalization && c.mask.strategy !== "semantic_external")
      issue("Semantic label normalization requires an external semantic mask");
    if (c.columns > c.frame_count) issue("Grid columns exceed frame count");
    if (
      c.anchor[0] > c.frame_dimensions[0] ||
      c.anchor[1] > c.frame_dimensions[1]
    )
      issue("Anchor lies outside the declared frame");
  });
export type AssetContract = z.infer<typeof assetContractSchema>;
export class ProviderBindingError extends Error {}
// Runtime capabilities belong here, not in the image provider. Derive slot URLs
// and frame requirements from the existing presentation definitions.
export function validateRuntimeCapability(c: AssetContract) {
  const slot =
    c.qa.mechanism === "defense" ? defenseAsset(c.qa.role) : magicAssets.flight;
  const target = slot.url.slice(1);
  const dimensions =
    c.qa.mechanism === "defense"
      ? [128, 128]
      : [magicAssets.flight.width, magicAssets.flight.height];
  const count =
    c.qa.mechanism === "defense"
      ? Math.max(
          ...["start", "loop", "end", "impact"].flatMap((phase) =>
            ["right", "left", "up", "down"].map((direction) => {
              const clip = defenseClip(
                c.qa.role,
                phase as Parameters<typeof defenseClip>[1],
                direction as Parameters<typeof defenseClip>[2],
              );
              return Math.max(
                clip.start + clip.count,
                (clip.heldFrame ?? 0) + 1,
              );
            }),
          ),
        )
      : magicAssets.flight.count;
  if (
    c.target !== target ||
    JSON.stringify(c.frame_dimensions) !== JSON.stringify(dimensions) ||
    c.frame_count !== count ||
    (c.qa.mechanism === "projectile" && c.qa.role !== "EMBER")
  )
    throw new ProviderBindingError(
      `Missing runtime capability: ${c.qa.mechanism}/${c.qa.role} loads ${target} with ${count} frames of ${dimensions.join("x")}; implement a reusable loader/clip and QA strategy for the requested binding/grid first.`,
    );
  if (c.mask_target !== target.replace(/\.png$/, "-mask.png"))
    throw new ProviderBindingError(
      "Existing runtime palette slot requires its companion mask binding; a non-recolorable/new mask strategy needs a reviewed runtime loader capability.",
    );
}
function contractDeclarations(root?: string): Record<string, unknown> {
  const file =
    root && existsSync(join(root, "art/contracts.json"))
      ? join(root, "art/contracts.json")
      : resolve(import.meta.dirname, "../../art/contracts.json");
  return z
    .record(z.string(), z.unknown())
    .parse(JSON.parse(readFileSync(file, "utf8")));
}
export function contractRegistry(root?: string): Record<string, AssetContract> {
  // A draft requiring a new capability must not disable unrelated reviewed assets.
  return Object.fromEntries(
    Object.entries(contractDeclarations(root)).flatMap(([key, value]) => {
      const parsed = assetContractSchema.safeParse(value);
      return parsed.success ? [[key, parsed.data]] : [];
    }),
  );
}
export function resolveContract(a: Asset, root?: string): AssetContract {
  const value =
    a.contract ?? contractDeclarations(root)[`${a.character}:${a.animation}`];
  if (!value)
    throw new ProviderBindingError(
      "Missing asset contract: Game Engineer must declare pixel content, fixed grid/anchor, safe mask strategy, runtime binding and QA mechanism in art/contracts.json. No provider request made.",
    );
  let c: AssetContract;
  try {
    c = assetContractSchema.parse(value);
  } catch (e) {
    throw new ProviderBindingError(
      `Unsafe or unsupported asset contract: ${String(e)}`,
    );
  }
  if (
    JSON.stringify([
      a.frame_dimensions,
      a.frame_count,
      a.anchor,
      a.directions,
      a.target,
      a.mask_target,
    ]) !==
    JSON.stringify([
      c.frame_dimensions,
      c.frame_count,
      c.anchor,
      c.directions,
      c.target,
      c.mask_target,
    ])
  )
    throw new ProviderBindingError(
      "Asset contract differs from brief grid/anchor/binding; Game Engineer must reconcile it before normalization.",
    );
  return c;
}
export function applyContract(a: Asset, c: AssetContract) {
  a.contract = c;
  a.frame_dimensions = c.frame_dimensions;
  a.frame_count = c.frame_count;
  a.anchor = c.anchor;
  a.directions = c.directions;
  a.target = c.target;
  a.mask_target = c.mask_target;
  a.canonical_references = c.canonical_references;
  a.palette_behavior = {
    source: c.source_palette,
    runtime_recolor: c.mask.strategy !== "none",
    mask_strategy: c.mask.strategy,
    channels: c.mask.channels,
  };
}
