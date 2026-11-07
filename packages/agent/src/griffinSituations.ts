// Situation B of the declared A/B/C evaluation (declaration
// oath-ember-abc-2026-11-06; docs/midterm/DECLARED_EVALUATION_SUITE.md):
// "Griffin Trial — Unprepared", logical and scenario id griffin-unprepared-v1.
// Record: docs/midterm/SITUATION_B_GRIFFIN.md.
//
// Every value below is either read from the scenario the harness runs (so it
// cannot drift from it) or an observed fact pinned by
// packages/agent/test/griffinSituationB.test.ts (start hashes, the prefix
// history's SHA, the start state, the witness and baseline references). A
// change to any of them is a new version and needs the owner's approval.
//
// Status: certified offline (2026-11-06), not yet run by any model. The
// briefing wording and the post-tuned guidance are drafts pending the owner.

import { createHash } from "node:crypto";
import { episodes } from "./evaluator.js";
import { situation, SUITE_REVISION, type SituationId } from "./suite.js";
import { defaultBudgetLimits } from "./budget.js";
import { tutorialId } from "./playerKnowledge.js";
import { briefingId } from "./policies/llm.js";
import { canonicalJson, SITUATION_A } from "./situationA.js";
import type { TerminationReason } from "./types.js";

const ID: SituationId = "griffin-unprepared-v1";
const def = situation(ID);
const episode = episodes[def.preset];

const TERMINAL_REASONS: readonly TerminationReason[] = Object.freeze([
  "success", "knocked_out", "left_area", "tick_limit", "decision_limit", "model_call_limit", "token_limit", "spend_limit", "wall_clock_limit", "error", "manual_stop",
]);

export const SITUATION_GRIFFIN_B = Object.freeze({
  label: "B",
  logicalId: "griffin-unprepared-v1",
  name: "Griffin Trial — Unprepared",
  version: 1,
  certifiedOn: "2026-11-06",
  status: "certified offline; awaiting owner approval for live runs",
  declaration: "oath-ember-abc-2026-11-06",
  /** The scenario the harness runs. Pass this id to evaluate.ts and live.ts. */
  situation: ID,
  preset: def.preset,
  suiteRevision: SUITE_REVISION,
  role: "development case under the A/B/C declaration (B-derived guidance may be developed here); C is the declared holdout",
  start: Object.freeze({
    description: def.start,
    prefix: def.prefix!.name,
    area: "GRIFFIN_ENCLOSURE",
    /** Absolute game tick after the prefix; the episode's own time starts at 0 here. */
    tick: 439,
    /** Declared: seed 0 for every repetition. Seed 1 is recorded only to show ids are the sole difference. */
    evaluationSeed: 0,
    hashes: Object.freeze({
      0: "1a270d7b5e456d1be0e3250d37baae26a77b5ca3099b18433a9c8e5a25fb0051",
      1: "7bfeb7f7b2e9e14c16a180481d2f4351e6d96d17aea94dda520dae3acae20bb1",
    } as Record<number, string>),
    /** SHA-256 of the canonical per-hero action lists the prefix submitted (171 Sieg, 56 Coco). */
    prefixActionsSha256: "2f6bc21934769a657c224cfad63019f555c4a37802bd226842740ee4948420b6",
    heroes: Object.freeze({
      sieg: Object.freeze({ tile: { x: 18.5, y: 33 }, px: { x: 592, y: 1056 }, hp: 100, abilities: ["Sword", "Guard", "Push", "Super Speed"], allReady: true }),
      coco: Object.freeze({ tile: { x: 21.5, y: 33 }, px: { x: 688, y: 1056 }, hp: 100, abilities: ["Fireball", "Ward", "Slow Time", "Flight", "Black Hole"], allReady: true }),
    }),
    griffin: "newGriffin(): 640/640 HP, phase NEST at the nest (640, 112) px, four standing pillars, no tool delivered, wig not claimed",
    inventory: "the same eight held items as S2-A; no vanity_mirror, enchanted_shears or griffin_wig",
  }),
  objective: "Defeat the Griffin (its HP reaches 0) and obtain the Magnificent Griffin Wig into the shared backpack through normal gameplay, with neither hero knocked out and both staying in the Griffin Enclosure.",
  /** Read by the evaluator from authoritative state; an agent's claim never counts. */
  success: "Authoritative Griffin HP == 0 AND shared inventory griffin_wig count > 0 (evaluator griffinDefeatedAndWig).",
  failure: "knocked_out: a hero's health ran out during any tick (the game respawns them at full health; the trial fails). left_area: any hero outside GRIFFIN_ENCLOSURE. Both are checked before success on every tick.",
  insufficient: Object.freeze([
    "entering the enclosure",
    "waking or damaging the Griffin",
    "the Griffin's DEFEATED phase without the wig",
    "puzzles.griffin.complete (also set by the peaceful route)",
    "a wig with Griffin HP above 0",
  ]),
  goal: episode.goal,
  terminalReasons: TERMINAL_REASONS,
  limits: Object.freeze({
    ...episode.limits,
    wallClockSeconds: SITUATION_A.limits.wallClockSeconds,
    modelCallTimeoutMs: defaultBudgetLimits.callTimeoutMs,
    maxConsecutivePolicyFailures: SITUATION_A.limits.maxConsecutivePolicyFailures,
    /** The declared A/B/C run cap (harness EPISODE_CAP_USD; the test checks they agree). */
    episodeSpendCapUsd: 0.75,
  }),
  prompts: Object.freeze({
    tutorialId: def.tutorial ? tutorialId(def.tutorial) : null,
    briefingId: def.briefing ? briefingId(def.briefing) : null,
    briefingStatus: "draft wording, pending the owner",
  }),
  conditions: Object.freeze({
    preTuned: "model-centralized with no guidance block: the generic planner prompt, unchanged since Pilot-30 (040685c), plus the tutorial and this briefing",
    postTuned: "model-centralized + guidance griffin-b-post-v1 (proposed, not approved; paid runs refuse it until approved)",
    baseline: "baseline-quest, unchanged",
  }),
  /**
   * Offline certification witness (route/griffinWitness.ts): a scripted,
   * solution-aware controller, not a player. Seed 0.
   */
  witness: Object.freeze({
    kind: "scripted solution-aware certification controller (not a baseline, not shown to any model)",
    seed: 0,
    status: "success",
    reason: "success",
    gameTicks: 3929,
    gameSeconds: 65.5,
    decisions: Object.freeze({ sieg: 575, coco: 585 }),
    invalidActions: 0,
    knockouts: 0,
    finalHp: Object.freeze({ sieg: 100, coco: 35 }),
    actionsSha256: "17145c6e2c2059f3d2cd24778ebe2fbbdb198c411703b4af175409b70450ca01",
    endHash: "f15f9a6e08c5b2aa41b79f4b25c29871ef01241ffe90b7c2170e70f96b3373b6",
  }),
  /** The unchanged scripted baseline at seed 0 (offline, free). */
  baselineReference: Object.freeze({
    player: "baseline-quest",
    seed: 0,
    status: "terminated",
    reason: "knocked_out",
    gameTicks: 636,
    gameSeconds: 10.6,
    decisions: Object.freeze({ sieg: 38, coco: 61 }),
    invalidActions: 0,
    modelCalls: 0,
    endHash: "b6e239cd058fd454f045cd8e2a207a67753ace82ee8f6b2d2fd66af4adf28377",
  }),
});

export const SITUATION_GRIFFIN_B_HASH = createHash("sha256").update(canonicalJson(SITUATION_GRIFFIN_B)).digest("hex");

/** The Griffin Trial label of a scenario id, if it has one; recorded in every run summary. */
export function griffinEvaluationLabel(id: SituationId): { label: string; definitionHash: string } | null {
  return id === ID ? { label: SITUATION_GRIFFIN_B.label, definitionHash: SITUATION_GRIFFIN_B_HASH } : null;
}
