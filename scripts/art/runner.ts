import type { Asset } from "./model.js";
export interface PipelineStages {
  recover?: (a: Asset) => Promise<boolean>;
  artistEnabled: boolean;
  visionEnabled: boolean;
  maxIterations: number;
  hasSubmission: (a: Asset) => boolean;
  canReview: (a: Asset) => boolean;
  generate: (a: Asset) => Promise<void>;
  integrate: (a: Asset) => Promise<void>;
  qa: (a: Asset) => Promise<void>;
  vision: (a: Asset) => Promise<void>;
}
// Orchestrate existing stages. Only ART failures trigger regeneration; no automatic code repairs.
export async function advanceAsset(a: Asset, s: PipelineStages) {
  const status = () => a.status;
  for (let step = 0; step < s.maxIterations * 4 + 4; step++) {
    if (
      [
        "QA_FAILED_ART",
        "QA_FAILED_IMPLEMENTATION",
        "NEEDS_HUMAN_REVIEW",
      ].includes(status()) &&
      a.iteration < s.maxIterations &&
      s.recover &&
      (await s.recover(a))
    ) {
      if (status() !== "READY_FOR_INTEGRATION")
        throw Error("Recovery must stage a new candidate before QA.");
    }
    if (status() === "QA_FAILED_ART") {
      if (!s.artistEnabled || a.iteration >= s.maxIterations) return;
      const before = a.iteration;
      await s.generate(a);
      if (status() === "QA_FAILED_ART" && a.iteration > before) continue;
      if (status() !== "READY_FOR_INTEGRATION") return;
    }
    if (
      ["BRIEF", "WAITING_FOR_ART"].includes(status()) &&
      !s.hasSubmission(a) &&
      s.artistEnabled
    ) {
      const before = a.iteration;
      await s.generate(a);
      if (status() === "QA_FAILED_ART" && a.iteration > before) continue;
      if (status() !== "READY_FOR_INTEGRATION") return;
    }
    if (
      [
        "BRIEF",
        "WAITING_FOR_ART",
        "READY_FOR_INTEGRATION",
        "INTEGRATING",
      ].includes(status())
    ) {
      const before = a.iteration;
      await s.integrate(a);
      if (status() === "QA_FAILED_ART") {
        if (a.iteration <= before)
          throw Error("ART retry made no iteration progress.");
        continue;
      }
      if (status() !== "READY_FOR_QA") return;
    }
    if (status() === "READY_FOR_QA") await s.qa(a);
    if (status() === "NEEDS_HUMAN_REVIEW" && s.visionEnabled && s.canReview(a))
      await s.vision(a);
    if (status() === "QA_FAILED_ART") continue;
    return;
  }
  throw Error("Pipeline exceeded bounded stage limit; human review required.");
}
