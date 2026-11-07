// Situation C of the A/B/C evaluation: "Griffin Trial, Prepared — Goddess
// Return", scenario id griffin-prepared-return-v1. Record and owner decisions:
// docs/midterm/SITUATION_C_PREPARED.md. Proposed declaration revision:
// docs/midterm/evaluation-abc/proposed/declaration-r10-c.json (not active).
//
// Owner decisions (2026-11-06), recorded by the implementation agent:
//   - Start: B-return's start exactly, plus Vanity Mirror and Enchanted Shears
//     added to the shared backpack by a start fixture (not earned in play).
//   - Id: griffin-prepared-return-v1 (r9 had declared griffin-prepared-v1).
//   - Success: wig claimed by any normal route (Griffin HP does not matter),
//     offered to the goddess, and chapter0.complete; no knockout. Leaving the
//     enclosure is allowed (the return requires it).
//   - Prompt: tutorial + a new C briefing (draft wording, pending the owner).
//
// Every pinned value is checked by packages/agent/test/griffinSituationC.test.ts
// and scripts/midterm/situation-c.ts. A change is a new version and needs the
// owner's approval.

import { createHash } from "node:crypto";
import { episodes } from "./evaluator.js";
import { situation, SUITE_REVISION, type SituationId } from "./suite.js";
import { defaultBudgetLimits } from "./budget.js";
import { tutorialId } from "./playerKnowledge.js";
import { briefingId } from "./policies/llm.js";
import { canonicalJson, SITUATION_A } from "./situationA.js";
import type { TerminationReason } from "./types.js";

export const SITUATION_C_ID = "griffin-prepared-return-v1" as const;
/**
 * Paid model runs on C are refused until the owner approves the C declaration
 * (harness validatePlan and live.ts). Mock and scripted baseline runs are allowed.
 */
export const SITUATION_C_PAID_APPROVED = false;

const def = situation(SITUATION_C_ID);
const episode = episodes[def.preset];

const TERMINAL_REASONS: readonly TerminationReason[] = Object.freeze([
  "success", "knocked_out", "tick_limit", "decision_limit", "model_call_limit", "token_limit", "spend_limit", "wall_clock_limit", "error", "manual_stop",
]);

export const SITUATION_GRIFFIN_C = Object.freeze({
  label: "C",
  logicalId: SITUATION_C_ID,
  declaredAs: "griffin-prepared-v1 (declaration r9); renamed by the owner 2026-11-06",
  name: "Griffin Trial, Prepared — Goddess Return",
  version: 1,
  status: "implemented and checked offline; proposed declaration r10 not approved; paid runs locked",
  /** The scenario the harness runs. */
  situation: SITUATION_C_ID as SituationId,
  preset: def.preset,
  suiteRevision: SUITE_REVISION,
  role: "declared holdout: no C-specific prompt, guidance, baseline or controller change",
  start: Object.freeze({
    description: def.start,
    prefix: def.prefix!.name,
    area: "GRIFFIN_ENCLOSURE",
    /** Absolute game tick after the prefix (the same as B-return). */
    tick: 540,
    evaluationSeed: 0,
    hashes: Object.freeze({
      0: "28777a85eebd55998461e7bbfff9ca36fd0bb0d68ba5d9888bc676acf84414d7",
      1: "dc638ff166d36edfc777d36c24f155f77d013fcb72633b4becda330aa63ccab7",
    } as Record<number, string>),
    /** SHA-256 of the prefix's per-hero actions: identical to B-return's prefix. */
    prefixActionsSha256: "1cf7940acb58e02d7509b7567c6e63457c48231b0424f9f77b6ae781d8fff81d",
    heroes: Object.freeze({
      sieg: Object.freeze({ tile: { x: 18.5, y: 33 }, hp: 100, abilities: ["Sword", "Guard", "Push", "Super Speed"] }),
      coco: Object.freeze({ tile: { x: 21.5, y: 33 }, hp: 100, abilities: ["Fireball", "Ward", "Slow Time", "Flight", "Black Hole"] }),
    }),
    griffin: "640/640 HP, phase NEST at the nest (640, 112) px, four standing pillars, no tool delivered, wig not claimed",
    inventory: "B-return's eight held items plus vanity_mirror 1 and enchanted_shears 1; griffin_wig 0",
    fixture: "setup.addItems({ vanity_mirror: 1, enchanted_shears: 1 }) after B-return's ordinary prefix; nothing else is written",
  }),
  parity: Object.freeze({
    bScenario: "griffin-unprepared-return-v1",
    bDefinitionHash: "b224f75d2ec71ad61082fe0cba4617057b73cd9feb5173c52f7f32dcd86ed6f1",
    bStartHash: "45b1a6aa2c164b2c31885d6e5d514fc8d7eae190ef76d7aad4422445f38db9b8",
    /** Paths of the authoritative world that differ from B-return's start (scripts/midterm/situation-c.ts). */
    worldDiffPaths: Object.freeze(["$.inventory.counts.enchanted_shears", "$.inventory.counts.vanity_mirror", "$.inventory.revision"]),
    /** Paths of each hero's observation that differ from B-return's start. */
    observationDiffPaths: Object.freeze(["$.inventory.items"]),
  }),
  objective: "Obtain the Griffin's wig through normal gameplay (by defeating the Griffin or through the nest), offer it to the Bald Goddess and reach chapter0.complete, with neither hero knocked out.",
  /** Read by the evaluator from authoritative state; an agent's claim never counts. */
  success: "Authoritative griffin.wigClaimed AND story.flags contains chapter0.complete (evaluator griffinWigReturned). Griffin HP is not part of the predicate.",
  failure: "knocked_out: a hero's health ran out during any tick (the game respawns them at full health; the episode fails). Checked before success on every tick. Leaving the enclosure is not a failure.",
  insufficient: Object.freeze([
    "entering the enclosure",
    "waking, damaging or defeating the Griffin",
    "delivering the Mirror or Shears at the nest",
    "the wig in the backpack without the offering",
    "the offering accepted without chapter0.complete",
    "puzzles.griffin.complete",
  ]),
  goal: episode.goal,
  terminalReasons: TERMINAL_REASONS,
  limits: Object.freeze({
    ...episode.limits,
    wallClockSeconds: SITUATION_A.limits.wallClockSeconds,
    modelCallTimeoutMs: defaultBudgetLimits.callTimeoutMs,
    maxConsecutivePolicyFailures: SITUATION_A.limits.maxConsecutivePolicyFailures,
    episodeSpendCapUsd: 0.75,
  }),
  prompts: Object.freeze({
    tutorialId: def.tutorial ? tutorialId(def.tutorial) : null,
    briefingId: def.briefing ? briefingId(def.briefing) : null,
    briefingStatus: "draft wording by the implementation agent, pending the owner",
    /** Pilot-31 (B pre-tuned) and Pilot-33 (B post-tuned) as recorded; reproduced by the check script. */
    pilot31PromptHash: "cbabb78b42b1227bafff0ef9e95b62ad5e03ba725691482e2e032384097bbb6a",
    pilot33PromptHash: "7ff08ba84c4ab14460d0f6707febdc19b8e417ced89d3127636ce7ed9f352144",
    preTunedPromptHash: "a6fa78a05e368b6f128844eff22b4b891d4892a772a27fba9c6fac066fab079e",
    postTunedPromptHash: "be19b8b5e9c350ecaf7ff7f4a478b3ca96bb1b3864d2527744823e2908548db8",
    guidanceId: "b-post-combined-v4",
    guidanceSha256: "1287454219c46dbce31bc5ea0beaee68cdb7addb55b957f2ca57d899ef1bdf34",
  }),
  conditions: Object.freeze({
    preTuned: "C1: model-centralized, gpt-6-luna medium, batch 4; generic planner prompt + tutorial + C briefing; no guidance block",
    postTuned: "C3: C1's prompt + the frozen b-post-combined-v4 block (Pilot-33's guidance, text unchanged); nothing C-specific",
    baseline: "C2: baseline-griffin-heuristic-v1, unchanged source (B's baseline)",
  }),
});

export const SITUATION_GRIFFIN_C_HASH = createHash("sha256").update(canonicalJson(SITUATION_GRIFFIN_C)).digest("hex");

export function griffinCEvaluationLabel(id: SituationId): { label: string; definitionHash: string } | null {
  return id === SITUATION_C_ID ? { label: SITUATION_GRIFFIN_C.label, definitionHash: SITUATION_GRIFFIN_C_HASH } : null;
}

/** Structural diff of two JSON values: equal-length arrays per element, anything else whole. */
export function stateDiff(b: unknown, c: unknown, path = "$"): { path: string; b: unknown; c: unknown }[] {
  if (JSON.stringify(b) === JSON.stringify(c)) return [];
  if (Array.isArray(b) && Array.isArray(c) && b.length === c.length)
    return b.flatMap((v, i) => stateDiff(v, c[i], `${path}[${i}]`));
  if (b && c && typeof b === "object" && typeof c === "object" && !Array.isArray(b) && !Array.isArray(c)) {
    const keys = [...new Set([...Object.keys(b), ...Object.keys(c)])].sort();
    return keys.flatMap((k) => stateDiff((b as Record<string, unknown>)[k], (c as Record<string, unknown>)[k], `${path}.${k}`));
  }
  return [{ path, b, c }];
}
