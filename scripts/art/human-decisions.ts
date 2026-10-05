import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Asset, Finding } from "./model.js";
const reviewIds = [
  "character_consistency",
  "animation",
  "rendering",
  "vfx",
  "palette",
  "multiplayer",
  "responsive",
];
export function iterationLimit(a: Asset, automaticMax: number) {
  return Math.max(automaticMax, a.authorized_iteration_limit ?? 0);
}
export function approvalEvidence(root: string, a: Asset) {
  if (!["AWAITING_APPROVAL", "NEEDS_HUMAN_REVIEW"].includes(a.status))
    throw Error("Approval requires completed visual review");
  const prefix = `art/qa/${a.asset_id}/iteration-${String(a.iteration).padStart(2, "0")}/`;
  const qaPath = `${prefix}qa-report.json`;
  if (!existsSync(join(root, qaPath)))
    throw Error("Complete objective/browser QA before approval");
  const qa = JSON.parse(readFileSync(join(root, qaPath), "utf8"));
  if (
    qa.checks.some(
      (c: Finding) => c.id !== "visual_rubric" && c.result !== "PASS",
    )
  )
    throw Error("Human approval cannot waive objective failures");
  const reviewPath = [...a.reports]
    .reverse()
    .find((p) => p.startsWith(prefix) && existsSync(join(root, p)));
  if (!reviewPath)
    throw Error("Complete all seven visual review criteria before approval");
  const checks: Finding[] = JSON.parse(
    readFileSync(join(root, reviewPath), "utf8"),
  ).checks;
  if (!reviewIds.every((id) => checks.filter((c) => c.id === id).length === 1))
    throw Error("Complete all seven visual review criteria before approval");
  if (checks.some((c) => c.result === "FAIL"))
    throw Error(
      "Resolve classified failures before approval; only REVIEW findings may be explicitly accepted",
    );
  return {
    reviewPath,
    qaPath,
    acceptedFindings: checks.filter((c) => c.result === "REVIEW"),
  };
}
export function requireDecisionState(a: Asset) {
  if (
    ![
      "NEEDS_HUMAN_REVIEW",
      "AWAITING_APPROVAL",
      "QA_FAILED_ART",
      "QA_FAILED_IMPLEMENTATION",
    ].includes(a.status)
  )
    throw Error("Human decision requires a reviewed candidate");
  if (a.pending_revision) throw Error("A human revision is already pending");
}
