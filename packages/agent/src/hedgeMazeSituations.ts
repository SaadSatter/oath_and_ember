// The three Hedge Maze situations (docs/midterm/HEDGE_MAZE_SITUATIONS.md):
//   S2-A  Full Hedge Maze   the label for S2-local (situationA.ts, frozen, unchanged)
//   S2-B  Cow puzzle        scenario S2-B: recorded play to tick 1197
//   S2-C  Wolf and key      scenario S2-C: recorded play to tick 1962
// All three are development-informed tuning situations, not held-out cases:
// the cuts were chosen from a run of the solution-aware scripted baseline,
// and S2-local had already been used for prompt and interface tuning.
//
// The frozen values below are checked by
// packages/agent/test/hedgeMazeSituations.test.ts; a change to any of them is
// a new version and needs the owner's approval.
//
// Version 2 (2026-11-04, owner approval): the game change ffbdecb (stone posts
// around the cow, griffin 640 HP, story lines). The checkpoints are re-derived
// from S2-A version 2's reference run at the same cut ticks. Version 1
// (2026-10-29, definition hashes 8032c9f2…e089 and 7d9014a1…4695) was never
// committed or run by a model.

import { createHash } from "node:crypto";
import { episodes } from "./evaluator.js";
import { situation, SUITE_REVISION, type SituationId } from "./suite.js";
import { defaultBudgetLimits } from "./budget.js";
import { tutorialId } from "./playerKnowledge.js";
import { briefingId } from "./policies/llm.js";
import { canonicalJson, SITUATION_A, SITUATION_A_HASH, SITUATION_A_PLAYERS } from "./situationA.js";
import { MAZE_CHECKPOINTS } from "./route/mazeCheckpointData.js";

function midMaze(
  id: "S2-B" | "S2-C",
  name: string,
  tests: readonly string[],
  hashes: Record<number, string>,
  baselineReference: Record<string, unknown>,
) {
  const def = situation(id);
  const cp = MAZE_CHECKPOINTS[id];
  const ep = episodes[def.preset];
  return Object.freeze({
    label: id,
    name,
    version: 2,
    frozenOn: "2026-11-04",
    gameChange: SITUATION_A.gameChange,
    situation: id as SituationId,
    preset: def.preset,
    suiteRevision: SUITE_REVISION,
    role: "development-informed tuning situation (not held out)",
    start: Object.freeze({
      description: cp.description,
      prefix: "opening scene, normal entry to Hedge Maze, then a prefix of the recorded live baseline run replayed through step()",
      area: "HEDGE_MAZE",
      tick: cp.cutTick,
      hashes: Object.freeze(hashes),
    }),
    /** Where the checkpoint comes from: the source trace and each hero's action count. */
    provenance: Object.freeze({
      trace: cp.source.trace,
      traceSha256: cp.source.sha256,
      sourceSituation: cp.source.situation,
      sourceSeed: cp.source.seed,
      sourcePlayer: cp.source.player,
      sourceGitHash: cp.source.gitHash,
      actions: Object.freeze({ sieg: cp.actions.sieg.length, coco: cp.actions.coco.length }),
      shortened: cp.shortened,
      actionsSha256: createHash("sha256").update(canonicalJson(cp.actions)).digest("hex"),
    }),
    objective: "Obtain the Enchanted Shears into the shared backpack through normal gameplay.",
    success: "The shared inventory holds at least one enchanted_shears (the same predicate as S2-A).",
    goal: ep.goal,
    tests,
    terminalReasons: SITUATION_A.terminalReasons,
    /** The same limits as S2-A, so the three situations are run under one budget rule. */
    limits: Object.freeze({
      ...ep.limits,
      wallClockSeconds: SITUATION_A.limits.wallClockSeconds,
      modelCallTimeoutMs: defaultBudgetLimits.callTimeoutMs,
      maxConsecutivePolicyFailures: SITUATION_A.limits.maxConsecutivePolicyFailures,
      /** harness EPISODE_CAP_USD (the test checks they agree). */
      episodeSpendCapUsd: SITUATION_A.limits.episodeSpendCapUsd,
    }),
    prompts: Object.freeze({ tutorialId: def.tutorial ? tutorialId(def.tutorial) : null, briefingId: def.briefing ? briefingId(def.briefing) : null }),
    seeds: Object.freeze({ tuning: Object.freeze([0, 1]), note: SITUATION_A.seeds.note }),
    players: SITUATION_A_PLAYERS,
    baselineReference: Object.freeze(baselineReference),
  });
}

export const SITUATION_B = midMaze(
  "S2-B",
  "Cow puzzle",
  ["Coco's Black Hole and Sieg's Push against a large blocker", "spatial reasoning about the lane and the grazing bay", "messages between the heroes", "then the wolf, key, gate and chest"],
  { 0: "8e3b386ba9e26694a120d23cf84ae1f20b47423647816142c1fd8e0191bc7666", 1: "c4349ca0d7960601b558f15e4e11c68e19df2ec2402ddf959a070f8e3a8d7a30" },
  { player: "baseline-quest", seed: 0, status: "success", reason: "success", gameTicks: 2313, gameSeconds: 38.6, decisions: 225, invalidActions: 0, messages: 6, modelCalls: 0, endHash: "b77d51ff1b9cd7ba1b9c0da552e7cb4fa1e3e9dece934eab7a27256830b23fd3" },
);

export const SITUATION_C = midMaze(
  "S2-C",
  "Wolf and key",
  ["wolf pursuit and timing (Coco's Slow Time with Sieg's Super Speed)", "taking the key from the wolf", "opening the gate", "Coco and Sieg cooperating to reach the chest"],
  { 0: "6d59c47ca7e9a16dcf9eea99b29d08992a6c67dc4c8c08e3c4f17eb05f49695d", 1: "c4884758983148f1160d88a3f714329f7058a4b78bd99166e2fb2132b63d61aa" },
  // The unchanged scripted baseline cannot resume mid-maze: its fixed script restarts
  // at the guards and its Sieg waits for a partner message sent before the cut.
  { player: "baseline-quest", seed: 0, status: "terminated", reason: "tick_limit", gameTicks: 18000, gameSeconds: 300, decisions: 1562, invalidActions: 0, messages: 0, modelCalls: 0, endHash: "0fca3656a6e0cfaa26f6f81c884a135dd919bd37aff134f3fcc2b08cd206aeab" },
);

const hash = (v: unknown) => createHash("sha256").update(canonicalJson(v)).digest("hex");
export const SITUATION_B_HASH = hash(SITUATION_B);
export const SITUATION_C_HASH = hash(SITUATION_C);

/** The three situations, in order, with their scenario ids and definition hashes. */
export const HEDGE_MAZE_SITUATIONS = Object.freeze([
  { label: "S2-A", situation: SITUATION_A.situation, definitionHash: SITUATION_A_HASH },
  { label: "S2-B", situation: SITUATION_B.situation, definitionHash: SITUATION_B_HASH },
  { label: "S2-C", situation: SITUATION_C.situation, definitionHash: SITUATION_C_HASH },
] as const);

/** The Hedge Maze label of a scenario id, if it has one; recorded in every run summary. */
export function mazeEvaluationLabel(id: SituationId): { label: string; definitionHash: string } | null {
  const s = HEDGE_MAZE_SITUATIONS.find((x) => x.situation === id);
  return s ? { label: s.label, definitionHash: s.definitionHash } : null;
}
