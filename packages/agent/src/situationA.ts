// Situation A of the proposed three-situation Hedge Maze suite:
// "S2-A — Full Hedge Maze" (docs/midterm/SITUATION_A.md).
//
// S2-A is an evaluation LABEL for the existing current-revision S2-local
// scenario, not a new scenario. It reuses S2-local's id, preset, prefix,
// briefing, success predicate and limits unchanged. Nothing here changes
// gameplay or what a player observes. The frozen values below are checked by
// packages/agent/test/situationA.test.ts; a change to any of them is a new
// version of the situation and needs the owner's approval.
//
// Versions:
//   1 (frozen 2026-10-29): kept verbatim below as SITUATION_A_V1. Its runs
//     (the live baseline, pilots 11-15) replay only at the game it was played
//     on, last at commit 96625b5.
//   2 (frozen 2026-11-04, owner approval): the game change ffbdecb put stone
//     posts north and south of the cow (a 56 px opening heroes fit through,
//     the cow does not), doubled the griffin's HP and added story lines. The
//     start hashes and the baseline reference changed; the scenario id,
//     preset, prefix, objective, success rule, limits and prompts did not.

import { createHash } from "node:crypto";
import { episodes } from "./evaluator.js";
import { situation, SUITE_REVISION, type SituationId } from "./suite.js";
import type { PlayerKind } from "./playerKinds.js";
import { defaultBudgetLimits } from "./budget.js";
import { tutorialId } from "./playerKnowledge.js";
import { briefingId } from "./policies/llm.js";
import type { TerminationReason } from "./types.js";

/** Version 1 exactly as frozen on 2026-10-29 (definition hash 4b3c9bb3…4207, pinned in the test). */
export const SITUATION_A_V1 = Object.freeze({
  "label": "S2-A",
  "name": "Full Hedge Maze",
  "version": 1,
  "frozenOn": "2026-10-29",
  "situation": "S2-local",
  "preset": "S2-local-v2",
  "suiteRevision": 2,
  "start": {
    "description": "Hedge Maze entrance, after the opening and ordinary travel",
    "prefix": "opening scene, normal entry to Hedge Maze (before arrival dialogue)",
    "area": "HEDGE_MAZE",
    "tick": 405,
    "hashes": {
      "0": "2b9eddd41bdd6a25457eb66d7d5b3dde66047b2d9103b4be334b378497c8b53e",
      "1": "ebea7d5c286dd896e85031e783cc4620a822671e92ae280f336a952c97fb8f02"
    }
  },
  "objective": "Obtain the Enchanted Shears into the shared backpack through normal gameplay.",
  "success": "The shared inventory holds at least one enchanted_shears (evaluator preset S2-local-v2).",
  "goal": "S2-local (suite revision 2): from the Hedge Maze entrance, obtain the Enchanted Shears.",
  "terminalReasons": [
    "success",
    "tick_limit",
    "decision_limit",
    "model_call_limit",
    "token_limit",
    "spend_limit",
    "wall_clock_limit",
    "error",
    "manual_stop"
  ],
  "limits": {
    "maxTicks": 18000,
    "maxDecisionsPerPlayer": 1600,
    "maxModelCallsPerPlayer": 400,
    "maxTokensPerPlayer": 4000000,
    "wallClockSeconds": {
      "model": 3600,
      "scripted": 600
    },
    "modelCallTimeoutMs": 30000,
    "maxConsecutivePolicyFailures": 3,
    "episodeSpendCapUsd": 1.25
  },
  "prompts": {
    "tutorialId": "2ec2f251",
    "briefingId": "a97d9268"
  },
  "seeds": {
    "tuning": [
      0,
      1
    ],
    "note": "Seeds 0 and 1 differ only in the room code (EVAL0/EVAL1) and the two hero ids. Both heroes' observations and legal actions at reset are identical, and the scripted baseline plays an identical trajectory. Seed 1 is therefore a repeated trial, not a distinct situation. Id-based tie-breaks may still order a model run's simultaneous events differently."
  },
  "players": {
    "primary": [
      "baseline-quest",
      "model-memory"
    ],
    "secondary": [
      "model-obs-only"
    ],
    "supplementary": [
      "model-guided"
    ],
    "reference": [
      "baseline-explore"
    ]
  },
  "baselineReference": {
    "player": "baseline-quest",
    "seed": 0,
    "status": "success",
    "gameTicks": 2990,
    "gameSeconds": 49.8,
    "decisions": 340,
    "invalidActions": 0,
    "messages": 6,
    "modelCalls": 0,
    "endHash": "bf31311f6c56638bc7e5a6a45b9eaa621fa5042963c6e7c477e2ce74e729f936"
  }
});

const UNDERLYING: SituationId = "S2-local";
const def = situation(UNDERLYING);
const episode = episodes[def.preset];

/** The players of the planned comparison and the role each plays in it. */
export const SITUATION_A_PLAYERS: Readonly<Record<"primary" | "secondary" | "supplementary" | "reference", readonly PlayerKind[]>> = Object.freeze({
  /** The intended controlled comparison: scripted reference against unaided model players with memory. */
  primary: Object.freeze(["baseline-quest", "model-memory"] as PlayerKind[]),
  /** The rubric's observation-only comparison for a partial-observation game. Supported, never run. */
  secondary: Object.freeze(["model-obs-only"] as PlayerKind[]),
  /** Solution-informed (a written walkthrough): reported apart, never as the unaided result. */
  supplementary: Object.freeze(["model-guided"] as PlayerKind[]),
  /** The quest-free scripted player: a floor, not a competitor (it reaches the tick limit). */
  reference: Object.freeze(["baseline-explore"] as PlayerKind[]),
});

const TERMINAL_REASONS: readonly TerminationReason[] = Object.freeze([
  "success", "tick_limit", "decision_limit", "model_call_limit", "token_limit", "spend_limit", "wall_clock_limit", "error", "manual_stop",
]);

/**
 * The frozen definition. Every value is either read from the existing S2-local
 * definition (so it cannot drift from what the harness runs) or is an
 * observed fact pinned by the test (start hashes, baseline reference).
 */
export const SITUATION_A = Object.freeze({
  label: "S2-A",
  name: "Full Hedge Maze",
  version: 2,
  frozenOn: "2026-11-04",
  /** The version this one replaces, kept verbatim as SITUATION_A_V1. */
  supersedes: Object.freeze({ version: 1, definitionHash: "4b3c9bb309e7d0bcc022f1df6a7e58cf11a3767c02fd7bd6cb62dfa845cd4207", commit: "96625b5" }),
  gameChange: "ffbdecb: stone posts north and south of the Hedge Maze cow, griffin 640 HP, new chapter 0 story lines",
  /** The scenario the harness actually runs. Pass this id to evaluate.ts and live.ts. */
  situation: UNDERLYING,
  preset: def.preset,
  suiteRevision: SUITE_REVISION,
  start: Object.freeze({
    description: def.start,
    prefix: "opening scene, normal entry to Hedge Maze (before arrival dialogue)",
    area: "HEDGE_MAZE",
    /** Absolute game tick after the prefix; the episode's own time starts at 0 here. */
    tick: 405,
    /** Raw authoritative state hash after reset (ids and room code included). */
    hashes: Object.freeze({
      0: "fdc498771fe89a1ac96fb1ce8bd972c38ad96e84bdeb18b195292e42e20203ca",
      1: "febddd1a479ac6f2750c940ac2fa9f6e469d6a5bd2d4ec89bac9f32514f86519",
    } as Record<number, string>),
  }),
  objective: "Obtain the Enchanted Shears into the shared backpack through normal gameplay.",
  /** Read by the evaluator from authoritative state; an agent's claim never counts. */
  success: "The shared inventory holds at least one enchanted_shears (evaluator preset S2-local-v2).",
  goal: episode.goal,
  terminalReasons: TERMINAL_REASONS,
  limits: Object.freeze({
    ...episode.limits,
    /** Real-world ceiling: model players, scripted players (harness defaults). */
    wallClockSeconds: Object.freeze({ model: 3600, scripted: 600 }),
    modelCallTimeoutMs: defaultBudgetLimits.callTimeoutMs,
    maxConsecutivePolicyFailures: 3,
    /**
     * Suite cap per episode, both heroes together (harness EPISODE_CAP_USD; the
     * test checks they agree). A run may lower it, never raise it.
     */
    episodeSpendCapUsd: 1.25,
  }),
  /** Text model players receive beyond the shared observation (never the scripted ones). */
  prompts: Object.freeze({
    tutorialId: def.tutorial ? tutorialId(def.tutorial) : null,
    briefingId: def.briefing ? briefingId(def.briefing) : null,
  }),
  seeds: Object.freeze({
    /** Seed 0 is the reference; seed 1 is a repeated trial of the same situation. */
    tuning: Object.freeze([0, 1]),
    note:
      "Seeds 0 and 1 differ only in the room code (EVAL0/EVAL1) and the two hero ids. Both heroes' observations " +
      "and legal actions at reset are identical, and the scripted baseline plays an identical trajectory. Seed 1 is " +
      "therefore a repeated trial, not a distinct situation. Id-based tie-breaks may still order a model run's " +
      "simultaneous events differently.",
  }),
  players: SITUATION_A_PLAYERS,
  /** The scripted baseline's reference result at seed 0 (midterms/saadsatter/evidence/traces/baseline-quest-S2-local-seed0-v2/). */
  baselineReference: Object.freeze({
    player: "baseline-quest" as PlayerKind,
    seed: 0,
    status: "success",
    gameTicks: 2974,
    gameSeconds: 49.6,
    decisions: 339,
    invalidActions: 0,
    messages: 6,
    modelCalls: 0,
    endHash: "22900abe990a552a3daecc404c57700b3f69da51f51161802fd8c74b5687495e",
  }),
});

/** Canonical JSON (sorted keys) so the hash does not depend on key order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

/** Hash of the frozen definition. Pinned in the test; recorded in every S2-A run summary. */
export const SITUATION_A_HASH = createHash("sha256").update(canonicalJson(SITUATION_A)).digest("hex");

/** The evaluation label of a scenario id, if it has one (S2-local is S2-A). */
export function evaluationLabel(id: SituationId): { label: string; definitionHash: string } | null {
  return id === UNDERLYING ? { label: SITUATION_A.label, definitionHash: SITUATION_A_HASH } : null;
}
