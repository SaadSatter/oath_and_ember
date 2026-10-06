import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { digest } from "./generation.js";
import type { Asset } from "./model.js";
import type { EffectPresentation } from "../../apps/client/src/assets/effectPresentation.js";
const profileFile = "apps/client/src/assets/effectPresentation.ts";
export function planPresentation(root: string, a: Asset, feedback: string) {
  if (a.character !== "coco" || !["ward", "projectile"].includes(a.animation))
    return {
      clarification: "No reviewed presentation adapter for this asset.",
    };
  const source = readFileSync(join(root, profileFile), "utf8");
  const match = source.match(
    /export const effectPresentationProfiles:[^=]+=(\s*\{[\s\S]*?\});\s*\/\/ END PROFILES/,
  );
  if (!match)
    throw Error(
      "Presentation profile format changed; manual engineer required",
    );
  const profiles = JSON.parse(match[1]) as Record<string, EffectPresentation>;
  const next = { ...profiles[a.animation] };
  const operations: string[] = [];
  if (
    [...feedback.matchAll(/\d+(?:\.\d+)?\s*%\s*(?:larger|smaller)/gi)].length >
      1 ||
    [
      ...feedback.matchAll(
        /\d+(?:\.\d+)?\s*(?:px|pixels)\s*(?:higher|lower|left|right)/gi,
      ),
    ].length > 1
  )
    return {
      clarification:
        "Use one size and one offset operation per request; multiple operations require clarification.",
    };
  const center = /\bcent(?:er|re)(?:ed|ing)?\b[\s\S]{0,40}\bcoco\b/i.test(
    feedback,
  );
  if (center) {
    if (a.animation !== "ward")
      return {
        clarification:
          "Centering around Coco is supported for Ward only; projectile position remains server-owned.",
      };
    next.centerOnCoco = true;
    next.offsetX = 0;
    next.offsetY = 0;
    operations.push(
      "center Ward canvas on Coco's visual midpoint; reset presentation offsets, preserve gameplay anchor and pulse",
    );
  }
  const size = feedback.match(/(\d+(?:\.\d+)?)\s*%\s*(larger|smaller)/i);
  if (size) {
    const n = Number(size[1]);
    if (n > 50 || n <= 0)
      return { clarification: "Use a visual size change between 0 and 50%." };
    next.scale *= 1 + ((size[2].toLowerCase() === "larger" ? 1 : -1) * n) / 100;
    operations.push(`visual scale ${size[2]} ${n}%`);
  }
  const qualitativeSize = !size && /\btoo (big|small)\b/i.exec(feedback);
  const fitSmaller =
    !size &&
    !qualitativeSize &&
    /smaller\s*just enough to fit|smaller\s+enough to fit/i.test(feedback);
  if (fitSmaller) {
    next.scale *= 0.8;
    operations.push(
      "visual scale smaller 20% (fit request default; verify clearance in QA)",
    );
  }
  if (qualitativeSize) {
    const direction =
      qualitativeSize[1].toLowerCase() === "big" ? "smaller" : "larger";
    next.scale *= direction === "smaller" ? 0.8 : 1.2;
    operations.push(
      `visual scale ${direction} 20% (documented qualitative-size default)`,
    );
  }
  const rotation = /\b(rotat(?:e|ing|ion)|choppy)\b/i.test(feedback);
  const pulseRequested = /\bpuls(?:e|ing)\b/i.test(feedback);
  const stopRotation =
    /instead of rotat(?:ing|ion)|(?:stop|disable|no) (?:the )?rotation/i.test(
      feedback,
    );
  if (stopRotation) {
    next.rotationMs = 0;
    operations.push("disable whole-effect rotation");
  }
  if (pulseRequested) {
    if (a.animation !== "ward")
      return {
        clarification: "Pulse presentation is supported for Ward only.",
      };
    const pulsePeriod =
      /(?:every|per|in)\s*(\d+(?:\.\d+)?)\s*(?:seconds?|s)\b/i.exec(feedback);
    const periodMs = pulsePeriod ? Number(pulsePeriod[1]) * 1000 : 1800;
    if (periodMs < 500 || periodMs > 6000)
      return { clarification: "Use a pulse period from 0.5 to 6 seconds." };
    next.pulseMs = periodMs / (2 * Math.PI);
    next.pulseScale = 0.04;
    next.pulseDepth = 0.12;
    operations.push(
      `continuous scene-clock pulse: ${periodMs}ms, 4% scale excursion, alpha 0.84–0.96`,
    );
  }
  if (rotation && !stopRotation) {
    if (a.animation !== "ward")
      return {
        clarification:
          "Whole-effect rotation is supported for Ward only; projectile orientation must continue following velocity.",
      };
    const period =
      /(?:every|per|in)\s*(\d+(?:\.\d+)?)\s*(?:seconds?|s)\b/i.exec(feedback);
    next.rotationMs = period ? Number(period[1]) * 1000 : 4000;
    if (next.rotationMs < 1000 || next.rotationMs > 12000)
      return { clarification: "Use a rotation period from 1 to 12 seconds." };
    operations.push(
      `whole Ward constant scene-clock rotation, ${next.rotationMs}ms per revolution${period ? "" : " (default)"}; smoothness still requires QA`,
    );
  }
  const offset = feedback.match(
    /(\d+(?:\.\d+)?)\s*(?:px|pixels)\s*(higher|lower|left|right)/i,
  );
  if (offset) {
    const n = Number(offset[1]);
    if (n > 16 || n <= 0)
      return { clarification: "Use a visual offset between 0 and 16px." };
    const d = offset[2].toLowerCase();
    if (d === "higher" || d === "lower")
      next.offsetY += d === "higher" ? -n : n;
    else next.offsetX += d === "left" ? -n : n;
    operations.push(`visual offset ${n}px ${d}`);
  }
  // Each supported request must be wholly understood. Do not silently apply only
  // the easy clause of mixed/broad engineering feedback.
  const cleaned = feedback
    .replace(
      /\bcent(?:er|re)(?:ed|ing)?\b(?:\s+(?:the|ward|it))?\s+(?:around|on|over)\s+coco(?:\x27s (?:body|visual center))?/gi,
      " ",
    )
    .replace(
      /smaller\s*just enough to fit (?:coco|her|the character) inside/gi,
      " ",
    )
    .replace(/smaller\s+enough to fit (?:coco|her|the character) inside/gi, " ")
    .replace(
      /instead of rotat(?:ing|ion)|(?:stop|disable|no) (?:the )?rotation/gi,
      " ",
    )
    .replace(/\bpuls(?:e|ing)\b/gi, " ")
    .replace(
      /right now (?:it'?s|its|it is) just a floating dot rotating/gi,
      " ",
    )
    .replace(
      /(?:it'?s|its|it is) (?:a little )?choppy (?:with its )?rotation/gi,
      " ",
    )
    .replace(
      /(?:once )?(?:every|per|in)\s*\d+(?:\.\d+)?\s*(?:seconds?|s)\b/gi,
      " ",
    )
    .replace(/\btoo (?:big|small)\b/gi, " ")
    .replace(
      /\b(?:rotat(?:e|ing|ion)|smoothly|smooth|choppy|whole|entire|constant|continuously|continuous|speed|slightly|also|is|a|little|with|its|at|center|without|jumps|when|entering|holding|releasing|or)\b/gi,
      " ",
    )
    .replace(a.asset_id, "")
    .replace(/^(?:improve\s*:\s*)/i, "")
    .replace(
      /\b(?:the art looks (?:good|great)|please|make|render|visual|size|scale|increase|decrease|move|position|coco'?s?|ward|projectile|it|the|by|and|but|roughly|about|around)\b/gi,
      " ",
    )
    .replace(/\d+(?:\.\d+)?\s*%\s*(?:larger|smaller)/gi, " ")
    .replace(
      /\d+(?:\.\d+)?\s*(?:px|pixels)\s*(?:higher|lower|left|right)/gi,
      " ",
    )
    .replace(/[\s.,!]/g, "");
  if (!operations.length || cleaned)
    return {
      clarification:
        "Automatic engineering cannot fully interpret this presentation request. Supported operations: effect size, pixel offsets, whole Ward rotation, pulsing, and centering around Coco. Clarify the unsupported clause within the same prompt; no partial edit was applied.",
    };
  if (
    next.scale < 0.5 ||
    next.scale > 2 ||
    Math.abs(next.offsetX) > 16 ||
    Math.abs(next.offsetY) > 16
  )
    return {
      clarification:
        "Requested cumulative presentation values exceed the safe adapter bounds.",
    };
  profiles[a.animation] = next;
  return {
    feedback,
    file: profileFile,
    beforeHash: digest(join(root, profileFile)),
    source: source.replace(match[1], " " + JSON.stringify(profiles, null, 2)),
    operations,
    before: JSON.parse(match[1])[a.animation],
    after: next,
  };
}
export function applyPresentation(
  root: string,
  a: Asset,
  plan: ReturnType<typeof planPresentation>,
  combinedJournal?: string,
) {
  const combined = combinedJournal
    ? JSON.parse(readFileSync(combinedJournal, "utf8"))
    : undefined;
  const combinedAuthorized =
    combined?.assetId === a.asset_id &&
    combined?.classification?.route === "COMBINED" &&
    !("clarification" in plan) &&
    combined.classification.tasks?.implementation === plan.feedback;
  if (
    "clarification" in plan ||
    (!combinedAuthorized && a.pending_revision?.kind !== "implementation")
  )
    throw Error(
      "Explicit implementation authorization and a valid plan required",
    );
  if (plan.file !== profileFile)
    throw Error("Presentation plan must use the reviewed profile file");
  const verified = planPresentation(root, a, plan.feedback);
  if (
    "clarification" in verified ||
    verified.source !== plan.source ||
    verified.beforeHash !== plan.beforeHash
  )
    throw Error(
      "Presentation plan no longer matches its authorized feedback and baseline",
    );
  const artifactHashes = a.runtime_files.map((p) => digest(join(root, p)));
  if (
    artifactHashes[0] !== a.source_hash ||
    artifactHashes[1] !== a.integration_hash
  )
    throw Error("Candidate changed before engineering");
  if (digest(join(root, plan.file)) !== plan.beforeHash)
    throw Error("Presentation code changed since planning");
  const request =
    a.pending_revision?.request_file ||
    `art/qa/${a.asset_id}/iteration-${String(a.iteration).padStart(2, "0")}/human-request.json`;
  const dir = join(root, request, "..");
  const destination = join(dir, "engineer-change.json");
  if (existsSync(destination))
    throw Error("Engineering evidence already exists; do not reapply a change");
  writeFileSync(
    join(dir, "presentation-before.ts"),
    readFileSync(join(root, plan.file)),
  );
  writeFileSync(join(root, plan.file), plan.source);
  if (
    a.runtime_files.some((p, i) => digest(join(root, p)) !== artifactHashes[i])
  )
    throw Error("Engineering modified artwork unexpectedly");
  writeFileSync(
    destination,
    JSON.stringify(
      {
        adapter: "presentation-profiles-v1",
        file: plan.file,
        beforeHash: plan.beforeHash,
        afterHash: digest(join(root, plan.file)),
        operations: plan.operations,
        before: plan.before,
        after: plan.after,
        artifactHashes,
        authorization: combinedJournal || request,
      },
      null,
      2,
    ) + "\n",
  );
}
