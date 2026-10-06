import { z } from "zod";
import type { AssetContract } from "./contracts.js";
export const statuses = [
  "BRIEF",
  "WAITING_FOR_ART",
  "GENERATING_ART",
  "READY_FOR_INTEGRATION",
  "INTEGRATING",
  "READY_FOR_QA",
  "QA_FAILED_ART",
  "QA_FAILED_IMPLEMENTATION",
  "NEEDS_HUMAN_REVIEW",
  "AWAITING_APPROVAL",
  "APPROVED",
  "WAITING_FOR_IMPLEMENTATION",
  "REJECTED",
] as const;
export const idSchema = z.string().regex(/^[a-z][a-z0-9_]*_v[1-9][0-9]*$/);
export const findingSchema = z
  .object({
    id: z.string(),
    result: z.enum(["PASS", "FAIL", "REVIEW"]),
    category: z.enum(["ART", "IMPLEMENTATION", "DESIGN"]).optional(),
    evidence: z.string().optional(),
    feedback: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    evidence_paths: z.array(z.string()).optional(),
  })
  .superRefine((v, c) => {
    if (v.result === "FAIL" && (!v.category || !v.evidence || !v.feedback))
      c.addIssue({
        code: "custom",
        message: "Failures need category, evidence and actionable feedback",
      });
  });
export type Finding = z.infer<typeof findingSchema>;
export function route(
  checks: Finding[],
  iteration: number,
  max = 3,
  confidenceThreshold = 0.85,
) {
  const failures = checks.filter((c) => c.result === "FAIL");
  if (failures.length && iteration >= max) return "NEEDS_HUMAN_REVIEW";
  const actionable = failures.filter(
    (c) => c.confidence === undefined || c.confidence >= confidenceThreshold,
  );
  // Vision validation downgrades low-confidence decisions to REVIEW first.
  // Objective/high-confidence actionable failures take precedence over uncertainty.
  if (actionable.some((c) => c.category === "ART")) return "QA_FAILED_ART";
  if (actionable.some((c) => c.category === "IMPLEMENTATION"))
    return "QA_FAILED_IMPLEMENTATION";
  if (checks.some((c) => c.result === "REVIEW") || failures.length)
    return "NEEDS_HUMAN_REVIEW";
  return "AWAITING_APPROVAL";
}
export const submissionSchema = z
  .object({
    kind: z.literal("production_atlas"),
    image: z.literal("atlas.png"),
    mask: z.literal("mask.png"),
    frame_dimensions: z.tuple([
      z.number().int().positive(),
      z.number().int().positive(),
    ]),
    frame_count: z.number().int().positive(),
    anchor: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
    provenance: z.string().min(1),
  })
  .strict();
export interface SpriteGenerationRequest {
  assetId: string;
  briefPath: string;
  referencePaths: string[];
  feedback: Finding[];
  humanFeedback?: string;
  editSource?: string;
}
export interface GeneratedAsset {
  submissionDirectory: string;
  provenance: string;
}
export interface SpriteGenerationProvider {
  generate(request: SpriteGenerationRequest): Promise<GeneratedAsset>;
}
export class ManualProvider implements SpriteGenerationProvider {
  async generate(_request: SpriteGenerationRequest): Promise<GeneratedAsset> {
    throw Error(
      "WAITING_FOR_ART: supply a reviewed production atlas and submission.json",
    );
  }
}
export interface Asset {
  asset_id: string;
  version: number;
  status: (typeof statuses)[number];
  character: string;
  animation: string;
  source_file: string;
  canonical_references: string[];
  runtime_files: string[];
  directions: string[];
  frame_count: number;
  frame_dimensions: [number, number];
  anchor: [number, number];
  palette_behavior: Record<string, unknown>;
  qa_status: string;
  iteration: number;
  approved_at: string | null;
  source_hash?: string;
  integration_hash?: string;
  target: string | null;
  mask_target: string | null;
  reports: string[];
  contract?: AssetContract;
  capability_handoff?: {
    reason: string;
    previous_status: string;
    request_file: string;
  };
  authorized_iteration_limit?: number;
  authorized_generation_limit?: number;
  human_decisions?: string[];
  human_approval?: string;
  pending_revision?: {
    kind: "art" | "implementation";
    feedback: string;
    request_file: string;
    from_iteration: number;
    to_iteration: number;
    reference_atlas?: string;
    reference_mask?: string;
    previous_source: string;
  };
  generation_attempts?: number;
  generation_history?: string[];
}
export interface Manifest {
  schema_version: 1;
  max_iterations: number;
  assets: Record<string, Asset>;
}
