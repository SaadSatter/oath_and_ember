// Free checks for the prompt-tuned continuous showcase
// (docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md). No model call, no network,
// no spending. Excluded from the official A/B/C evaluation.
//
//   node --import tsx scripts/midterm/showcase.ts [--evidence <dir>]
//
// Prints and (with --evidence) writes: the definition hash, the start hashes
// at seeds 0 and 1 compared with S2-A's, the guidance text and hash, and the
// planner's full system prompt and hash for the proposed paid configuration.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { environmentFor, situation } from "../../packages/agent/src/suite.js";
import { SHOWCASE, SHOWCASE_GUIDANCE_ID, SHOWCASE_HASH, SHOWCASE_ID, SHOWCASE_LABEL, SHOWCASE_PAID_APPROVED, SHOWCASE_PAID_SCOPE } from "../../packages/agent/src/showcase.js";
import { guidance, guidanceHash } from "../../packages/agent/src/policies/situationGuidance.js";
import { CentralPlanner } from "../../packages/agent/src/policies/centralized.js";
import { ModelBudget, MeteredGateway } from "../../packages/agent/src/budget.js";
import { MockGateway } from "../../packages/agent/src/policies/mockGateway.js";
import { repoInfo } from "../../packages/agent/src/repo.js";

const argv = process.argv.slice(2);
const i = argv.indexOf("--evidence");
const evidence = i >= 0 ? resolve(argv[i + 1]) : undefined;
const repo = repoInfo();
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const starts: Record<string, unknown> = {};
for (const seed of [0, 1]) {
  const show = await environmentFor(SHOWCASE_ID).reset(seed);
  const again = await environmentFor(SHOWCASE_ID).reset(seed);
  const s2a = await environmentFor("S2-local").reset(seed);
  starts[seed] = { startHash: show.startHash, episode: show.episode, repeatIdentical: again.startHash === show.startHash, s2aStartHash: s2a.startHash, sameAsS2A: s2a.startHash === show.startHash, tick: show.tick };
}

const manual = readFileSync(join(repo.root, "manual/Oath_and_Ember_Player_Manual.md"), "utf8");
const budget = new ModelBudget({ maxModelCallsPerPlayer: 1, maxTokensPerPlayer: 1, maxSpendUsd: 0.01, callTimeoutMs: 1000 });
const gw = { sieg: new MeteredGateway(new MockGateway(0, 0), budget, "sieg"), coco: new MeteredGateway(new MockGateway(0, 0), budget, "coco") };
const s = situation(SHOWCASE_ID);
const g = guidance(SHOWCASE_GUIDANCE_ID);
const planner = new CentralPlanner(manual, gw, SHOWCASE_PAID_SCOPE.maxBatch, s.briefing, s.tutorial, s.task, g.text);

const report = {
  label: SHOWCASE_LABEL,
  scenario: SHOWCASE_ID,
  gitHead: repo.head.slice(0, 7) + (repo.dirty ? "+dirty" : ""),
  definitionHash: SHOWCASE_HASH,
  status: SHOWCASE.status,
  paidApproved: SHOWCASE_PAID_APPROVED,
  proposedPaidScope: SHOWCASE_PAID_SCOPE,
  limits: SHOWCASE.limits,
  starts,
  guidance: { id: g.id, status: g.status, sha256: guidanceHash(g.text), chars: g.text.length },
  briefingSha256: sha(s.briefing ?? ""),
  taskSha256: sha(s.task ?? ""),
  manualSha256: sha(manual),
  plannerPolicyNameSuffix: `guidance-${guidanceHash(g.text).slice(0, 8)}`,
  systemPromptSha256: planner.promptHash,
  systemPromptChars: planner.system.length,
};
console.log(JSON.stringify(report, null, 2));
if (evidence) {
  mkdirSync(evidence, { recursive: true });
  writeFileSync(join(evidence, "showcase-check.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(join(evidence, "guidance-showcase-maze-griffin-v1.txt"), g.text);
  writeFileSync(join(evidence, "planner-system-prompt.txt"), planner.system);
  console.error(`Wrote ${evidence}`);
}
