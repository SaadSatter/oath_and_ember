// P1 "Into the Forest": a directed narrative and navigation situation in the
// Prologue (owner approval 2026-11-03; docs/midterm/PROLOGUE_SITUATION.md).
//
// The scenario the harness runs is "P1" (suite.ts, evaluator.ts). This module
// freezes its definition: every value of the current revision is either read
// from the code the harness runs (so it cannot drift) or is an observed fact
// pinned by packages/agent/test/prologueSituation.test.ts. A change to any of
// them changes P1_HASH and fails that test: it is then a new revision of P1,
// recorded with the owner's approval, never folded silently into an old one.
//
// Revisions:
//   1 (frozen 2026-11-03, commit b62df73; P1_V1 below, kept verbatim). Never
//     run by a model. Superseded before any model run by
//   2 (frozen 2026-11-03): the independent review's fixes F1 (episode-neutral
//     task line instead of "Complete the Goddess's quest together."), F2 (the
//     shop's camera bounds, so Coco sees "E · UPSTAIRS" as the client shows
//     it) and F4 (the fence opening listed as the art's "garden gateway" with
//     its exact collision gap, no grid mark), plus F6 (a 3,600 s wall-clock
//     ceiling). The world, start, success rule and limits are unchanged.
//     Frozen at commit 28a28de; kept verbatim below as P1_V2. Superseded
//     before any model run by
//   3 (frozen 2026-11-03): the fence opening's listing renamed by the owner
//     from "garden gateway" (a source region id) to "gap in garden fence".
//     Coordinates, extent, grid, prompts, world and limits are unchanged.

import { createHash } from "node:crypto";
import { episodes } from "./evaluator.js";
import { situation, SUITE_REVISION, type SituationId } from "./suite.js";
import type { PlayerKind } from "./playerKinds.js";
import { defaultBudgetLimits } from "./budget.js";
import { canonicalJson } from "./situationA.js";
import { PROLOGUE } from "./policies/questKnowledge.js";
import { taskId } from "./playerKnowledge.js";
import { GARDEN_GATEWAY } from "./perception.js";
import type { TerminationReason } from "./types.js";

/**
 * P1 revision 1 exactly as frozen at commit b62df73 (definition hash
 * baa6b04b…73ac, pinned in the test). A literal, so later code cannot change
 * it. Its baseline evidence is docs/midterm/evidence/p1-baseline/. The code
 * that produced its observations is commit b62df73; the current code produces
 * revision 2's.
 */
export const P1_V1 = Object.freeze({
  "label": "P1",
  "name": "Into the Forest",
  "version": 1,
  "frozenOn": "2026-11-03",
  "situation": "P1",
  "preset": "P1",
  "suiteRevision": 2,
  "kind": "directed narrative and navigation (the Prologue's opening): no puzzle, no combat",
  "role": "Frozen and excluded from prompt tuning from version 1. Not formally held out: it was designed with full knowledge of the game's code, and the scripted baseline's route was developed on it.",
  "start": {
    "description": "prologue checkpoint: the game's own opening",
    "checkpoint": "prologue",
    "prefix": null,
    "stage": "ARRIVAL",
    "heroes": {
      "sieg": "outside the shop, on the road (Main house, 760, 490 px), facing west",
      "coco": "inside the shop with Alden (Alden's Magic Shop, 590, 322 px), facing north"
    },
    "tick": 0,
    "hashes": {
      "0": "688b246237f8183790ca7f1f0d38a5b96570ffd323c3d662683ca04cf1b71530",
      "1": "e9922b16b72471fa38d5f50271e23c81a127bca5e2b563b79949a794e74b0f12"
    },
    "viewsHash": "27cf4ce6d8a6ccef16e2486ecca87446f1a6984a073e7fb7c15c6d0d4827ff3a"
  },
  "objective": "Follow the Prologue's story from its opening until the party reaches the Mossling Woods, through normal gameplay.",
  "success": "The authoritative story stage is WOODS or later (evaluator preset P1, stageReached). The game itself sets it when a hero presses E at the Forest Trail's exit after the cart has been found (storyTravel, apps/server/src/prologue.ts).",
  "goal": "P1 Into the Forest: from the Prologue's opening, reach the Mossling Woods (story stage WOODS).",
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
  "cooperation": "Not required: Sieg alone can complete P1; Coco may simply follow.",
  "limits": {
    "maxTicks": 10800,
    "maxDecisionsPerPlayer": 1600,
    "maxModelCallsPerPlayer": 250,
    "maxTokensPerPlayer": 4000000,
    "wallClockSeconds": {
      "model": 3600,
      "scripted": 600
    },
    "modelCallTimeoutMs": 30000,
    "maxConsecutivePolicyFailures": 3,
    "episodeSpendCapUsd": 0.6
  },
  "prompts": {
    "briefing": null,
    "tutorial": null,
    "walkthrough": null,
    "manualSha256": "4b091a6630dd56f236f89f8e2213a6bb7cad4a31d4851d1883f95867d92bfa86",
    "systemPromptSha256": {
      "model-history": {
        "sieg": "cbdb53a3522a0af7b9b3da26c3745523e565289aeba6a3c897ed2d4dc17789f1",
        "coco": "543cee242bd369c6dba367e527c7f9287640cf0806021eb273d4e84899656c95"
      },
      "model-obs-only": {
        "sieg": "2eaa7d9390584f0960ae2c1645a265961dc7f4122847137166b207c0a3e03395",
        "coco": "01679a9a69cf977694867d6c4f57e16fda2a06ff4f5e0cdf69b4a36909fbe78a"
      },
      "model-memory": {
        "sieg": "d20c441dd83cff000113d9948d379501322330643bf9e133b561ba88763f15f3",
        "coco": "5373fb20c7ffd1a6cab2185ee30c33279fa5a2fe1c2741f9405f3142d8f03797"
      }
    }
  },
  "observation": {
    "hudGoalLines": "hidden from every player (standing owner decision)",
    "shown": [
      "the screen grid, partner, enemies and abilities as in every situation",
      "dialogue lines as each hero's own dialogue box shows them (inner narration only to its hero)",
      "the quest journal (quest and current step names)",
      "map labels and markers exactly as the client draws them, with its sealing: no label on the cart or the clearing; the trail's way on only after the cart is found",
      "'door' for the shop's front door and doorway (unlabelled art; owner's wording)",
      "'tipped cart' for the merchants' cart (unlabelled art; owner's wording)",
      "'garden gate (open)' for the one opening in the garden fence, which the centre-sampled grid draws as fence",
      "Alden where the story puts him, with 'E Talk' when in reach",
      "E at Alden or at the trail's crates and barrel returns the client's local dialogue pages as feedback"
    ],
    "hidden": [
      "story flags and stage names",
      "future dialogue",
      "HUD goal lines",
      "hero ids and room code",
      "state hashes",
      "the scripted route"
    ]
  },
  "seeds": {
    "tuning": [
      0,
      1
    ],
    "note": "Seeds 0 and 1 differ only in the room code and the two hero ids; both heroes' observations and legal actions at reset are identical, and the scripted baseline plays an identical trajectory. Seed 1 is a repeated trial."
  },
  "players": {
    "primary": [
      "baseline-quest",
      "model-memory"
    ],
    "secondary": [
      "model-obs-only"
    ],
    "reference": [
      "baseline-explore"
    ]
  },
  "baseline": {
    "player": "baseline-quest",
    "knowledge": "Disclosed route knowledge (policies/questKnowledge.ts PROLOGUE), worked out from the story code and static map geometry. It plays only through the five operations, from its own observation; no state is written.",
    "routeSha256": "3594738b4912e6131fe63c748fd50dce2d8b7de6c742c69f467f1c6a9cbde6f5",
    "evidence": "docs/midterm/evidence/p1-baseline/",
    "reference": {
      "seed": 0,
      "status": "success",
      "reason": "success",
      "gameTicks": 1058,
      "gameSeconds": 17.6,
      "decisions": 161,
      "invalidActions": 0,
      "messages": 0,
      "modelCalls": 0,
      "endHash": "c2f3b973456f4c0dd693afa2c5c0dafc5cd5138f32c88bb3afe2bbd55d797e54"
    }
  },
  "reproduce": [
    "node --import tsx scripts/midterm/prologue-situation.ts",
    "node --import tsx scripts/midterm/prologue-situation.ts --baseline --out <dir>",
    "npx vitest run packages/agent/test/prologueSituation.test.ts"
  ]
}) as Readonly<Record<string, unknown>>;
export const P1_V1_HASH = createHash("sha256").update(canonicalJson(P1_V1)).digest("hex");

/**
 * P1 revision 2 exactly as frozen at commit 28a28de (definition hash
 * 7dfac8cd…a655, pinned in the test). A literal, so later code cannot change
 * it. Its baseline evidence is docs/midterm/evidence/p1-v2-baseline/. Never
 * run by a model.
 */
export const P1_V2 = Object.freeze({
  "label": "P1",
  "name": "Into the Forest",
  "version": 2,
  "frozenOn": "2026-11-03",
  "supersedes": {
    "version": 1,
    "definitionHash": "baa6b04b7de3d56e479cbb092d5d8a10875a290c89748b836917e32a895f73ac",
    "commit": "b62df73"
  },
  "changes": [
    "F1: model players' task line is the episode-neutral NEUTRAL_TASK instead of the Bald Goddess quest's",
    "F2: indoor observations use the client's house camera (cameraBounds), so Coco's opening view includes 'E · UPSTAIRS'",
    "F4: the fence opening is listed as the art's 'garden gateway', with its exact collision gap as extent and no grid mark ('garden gate (open)' removed)",
    "F6: a run may lower P1's 3,600 s wall clock, never raise it"
  ],
  "situation": "P1",
  "preset": "P1-v2",
  "suiteRevision": 2,
  "kind": "directed narrative and navigation (the Prologue's opening): no puzzle, no combat",
  "role": "Frozen and excluded from prompt tuning from version 1. Not formally held out: it was designed with full knowledge of the game's code, and the scripted baseline's route was developed on it.",
  "start": {
    "description": "prologue checkpoint: the game's own opening",
    "checkpoint": "prologue",
    "prefix": null,
    "stage": "ARRIVAL",
    "heroes": {
      "sieg": "outside the shop, on the road (Main house, 760, 490 px), facing west",
      "coco": "inside the shop with Alden (Alden's Magic Shop, 590, 322 px), facing north"
    },
    "tick": 0,
    "hashes": {
      "0": "688b246237f8183790ca7f1f0d38a5b96570ffd323c3d662683ca04cf1b71530",
      "1": "e9922b16b72471fa38d5f50271e23c81a127bca5e2b563b79949a794e74b0f12"
    },
    "viewsHash": "5ff8926cf179bc81b0998d3cfc0e4988f4c97c179baccdcb8887c17973ecca76"
  },
  "objective": "Follow the Prologue's story from its opening until the party reaches the Mossling Woods, through normal gameplay.",
  "success": "The authoritative story stage is WOODS or later (evaluator preset P1-v2, the same predicate as revision 1's P1, stageReached). The game itself sets it when a hero presses E at the Forest Trail's exit after the cart has been found (storyTravel, apps/server/src/prologue.ts).",
  "goal": "P1 Into the Forest (revision 2): from the Prologue's opening, reach the Mossling Woods (story stage WOODS).",
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
  "cooperation": "Not required: Sieg alone can complete P1; Coco may simply follow.",
  "limits": {
    "maxTicks": 10800,
    "maxDecisionsPerPlayer": 1600,
    "maxModelCallsPerPlayer": 250,
    "maxTokensPerPlayer": 4000000,
    "wallClockSeconds": {
      "model": 3600,
      "scripted": 600
    },
    "modelCallTimeoutMs": 30000,
    "maxConsecutivePolicyFailures": 3,
    "episodeSpendCapUsd": 0.6,
    "wallClockCeilingSeconds": 3600
  },
  "prompts": {
    "briefing": null,
    "tutorial": null,
    "walkthrough": null,
    "task": {
      "id": "4079cad5",
      "text": "Play the game together with your partner. You are not told your goal in advance: discover your objectives through play, from what the game itself shows you (its dialogue, your quest journal and what you see in the world), and follow them.\n- Base every decision on your current observation and the legal actions you are given.\n- Do not assume what will happen later in the story; find out by playing.\n- You have no walkthrough and no access to hidden game state.\n- Coordinate with your partner through messages when it helps."
    },
    "manualSha256": "4b091a6630dd56f236f89f8e2213a6bb7cad4a31d4851d1883f95867d92bfa86",
    "systemPromptSha256": {
      "model-history": {
        "sieg": "d4408182509f64d2a14fcba1a85141ac96aef46db66b24494a6b344d05689796",
        "coco": "3dc3102c3831efd54558b98abb88e283e107a3fdeaf80a721ee45bf18e058320"
      },
      "model-obs-only": {
        "sieg": "00f567e87a373b1fd2912bed5c6b8d588673eee2044bfd6285194919ee95ad2e",
        "coco": "602c7e3c6ff754fb173f6faa2321c6e59d2ede341459170dde39dfe3c884e184"
      },
      "model-memory": {
        "sieg": "3902600e793433812c5310463ef4c6775abc453c5a40d2dc377c1d8789425279",
        "coco": "37d7fd978756337ea904c6a8c515310789d57020e3fa8bdd35b0cd1f57964ae5"
      }
    }
  },
  "observation": {
    "hudGoalLines": "hidden from every player (standing owner decision)",
    "shown": [
      "the screen grid, partner, enemies and abilities as in every situation",
      "dialogue lines as each hero's own dialogue box shows them (inner narration only to its hero)",
      "the quest journal (quest and current step names)",
      "map labels and markers exactly as the client draws them, with its sealing: no label on the cart or the clearing; the trail's way on only after the cart is found",
      "'door' for the shop's front door and doorway (unlabelled art; owner's wording)",
      "'tipped cart' for the merchants' cart (unlabelled art; owner's wording)",
      "'garden gateway' (the fence art's own region name) for the fence's one opening, with its exact collision gap as extent and no grid mark; the centre-sampled grid shows '#' there",
      "indoors, the client's house camera: the view is held inside the map's cameraBounds",
      "Alden where the story puts him, with 'E Talk' when in reach",
      "E at Alden or at the trail's crates and barrel returns the client's local dialogue pages as feedback"
    ],
    "gardenGateway": {
      "x": 464,
      "y": 432,
      "w": 32,
      "h": 8
    },
    "hidden": [
      "story flags and stage names",
      "future dialogue",
      "HUD goal lines",
      "hero ids and room code",
      "state hashes",
      "the scripted route"
    ]
  },
  "seeds": {
    "tuning": [
      0,
      1
    ],
    "note": "Seeds 0 and 1 differ only in the room code and the two hero ids; both heroes' observations and legal actions at reset are identical, and the scripted baseline plays an identical trajectory. Seed 1 is a repeated trial."
  },
  "players": {
    "primary": [
      "baseline-quest",
      "model-memory"
    ],
    "secondary": [
      "model-obs-only"
    ],
    "reference": [
      "baseline-explore"
    ]
  },
  "baseline": {
    "player": "baseline-quest",
    "knowledge": "Disclosed route knowledge (policies/questKnowledge.ts PROLOGUE), worked out from the story code and static map geometry. It plays only through the five operations, from its own observation; no state is written.",
    "routeSha256": "3594738b4912e6131fe63c748fd50dce2d8b7de6c742c69f467f1c6a9cbde6f5",
    "evidence": "docs/midterm/evidence/p1-v2-baseline/",
    "reference": {
      "seed": 0,
      "status": "success",
      "reason": "success",
      "gameTicks": 1058,
      "gameSeconds": 17.6,
      "decisions": 161,
      "invalidActions": 0,
      "messages": 0,
      "modelCalls": 0,
      "endHash": "c2f3b973456f4c0dd693afa2c5c0dafc5cd5138f32c88bb3afe2bbd55d797e54"
    }
  },
  "reproduce": [
    "node --import tsx scripts/midterm/prologue-situation.ts",
    "node --import tsx scripts/midterm/prologue-situation.ts --baseline --out <dir>",
    "npx vitest run packages/agent/test/prologueSituation.test.ts"
  ]
}) as Readonly<Record<string, unknown>>;
export const P1_V2_HASH = createHash("sha256").update(canonicalJson(P1_V2)).digest("hex");

const ID: SituationId = "P1";
const def = situation(ID);
const EP = episodes[def.preset];

const TERMINAL_REASONS: readonly TerminationReason[] = Object.freeze([
  "success", "tick_limit", "decision_limit", "model_call_limit", "token_limit", "spend_limit", "wall_clock_limit", "error", "manual_stop",
]);

export const P1_PLAYERS: Readonly<Record<"primary" | "secondary" | "reference", readonly PlayerKind[]>> = Object.freeze({
  /** Scripted reference (knows the route) against the unaided model player with memory. */
  primary: Object.freeze(["baseline-quest", "model-memory"] as PlayerKind[]),
  /** The rubric's observation-only comparison. Supported, not run. */
  secondary: Object.freeze(["model-obs-only"] as PlayerKind[]),
  /** The quest-free scripted player, as a floor. */
  reference: Object.freeze(["baseline-explore"] as PlayerKind[]),
});

export const P1 = Object.freeze({
  label: "P1",
  name: "Into the Forest",
  version: 3,
  frozenOn: "2026-11-03",
  /** The revision this one replaces, unchanged and still pinned (P1_V1). */
  supersedes: Object.freeze({ version: 2, definitionHash: "7dfac8cd2b91b5d096328265a4eba068a8a86055750c204896394ebdc6b1a655", commit: "28a28de" }),
  changes: Object.freeze([
    "Owner's wording: the fence opening is listed as 'gap in garden fence' instead of 'garden gateway' (a source region id). Coordinates, extent (the exact collision gap) and the grid (no mark) are unchanged",
    "Everything else as revision 2: NEUTRAL_TASK, the client's house camera, the 3,600 s wall-clock ceiling",
  ]),
  situation: ID,
  preset: def.preset,
  suiteRevision: SUITE_REVISION,
  kind: "directed narrative and navigation (the Prologue's opening): no puzzle, no combat",
  role:
    "Frozen and excluded from prompt tuning from version 1. Not formally held out: it was designed with full " +
    "knowledge of the game's code, and the scripted baseline's route was developed on it.",
  start: Object.freeze({
    description: def.start,
    /** The title screen's "Prologue" checkpoint (storyCheckpoints.ts); no prefix, no fixture. */
    checkpoint: EP.checkpoint,
    prefix: null,
    stage: "ARRIVAL",
    heroes: Object.freeze({
      sieg: "outside the shop, on the road (Main house, 760, 490 px), facing west",
      coco: "inside the shop with Alden (Alden's Magic Shop, 590, 322 px), facing north",
    }),
    tick: 0,
    /** Raw authoritative state hash after reset (ids and room code included). */
    hashes: Object.freeze({
      0: "688b246237f8183790ca7f1f0d38a5b96570ffd323c3d662683ca04cf1b71530",
      1: "e9922b16b72471fa38d5f50271e23c81a127bca5e2b563b79949a794e74b0f12",
    } as Record<number, string>),
    /** SHA-256 of both heroes' first observation and legal actions (identical at seeds 0 and 1). */
    viewsHash: "dbfbef0bbac8df08c1b749ea47e991ed130a3f501b442841b32b657e2d60363d",
  }),
  objective: "Follow the Prologue's story from its opening until the party reaches the Mossling Woods, through normal gameplay.",
  /** Read by the evaluator from authoritative state; an agent's claim never counts. */
  success:
    "The authoritative story stage is WOODS or later (evaluator preset P1-v3, the same predicate as revisions 1 and 2, stageReached). The game itself sets it " +
    "when a hero presses E at the Forest Trail's exit after the cart has been found (storyTravel, apps/server/src/prologue.ts).",
  goal: EP.goal,
  terminalReasons: TERMINAL_REASONS,
  /**
   * Checked in the code and by the test: the trigger that starts the story
   * (Sieg inside the shop) is Sieg's alone, and three lines of the road scene
   * are his alone to read. Every later trigger (the road, the forest sign,
   * the cart, the trail's exit) accepts either hero, and the game brings Coco
   * along for each scene and each journey. Coco's participation is therefore
   * not required for success. No cooperation requirement was added.
   */
  cooperation: "Not required: Sieg alone can complete P1; Coco may simply follow.",
  limits: Object.freeze({
    ...EP.limits,
    /** Real-world ceiling: model players, scripted players (harness defaults). */
    wallClockSeconds: Object.freeze({ model: 3600, scripted: 600 }),
    modelCallTimeoutMs: defaultBudgetLimits.callTimeoutMs,
    maxConsecutivePolicyFailures: 3,
    /** harness EPISODE_CAP_USD.P1 (the test checks they agree); a run may lower it, never raise it. */
    episodeSpendCapUsd: 0.6,
    /** harness WALL_CLOCK_CEILING_S.P1: a run may lower the model wall clock, never raise it. */
    wallClockCeilingSeconds: 3600,
  }),
  /** What model players receive beyond the shared observation. */
  prompts: Object.freeze({
    /** No episode briefing, no tutorial block, no walkthrough (owner decision 2026-11-03). */
    briefing: def.briefing ?? null,
    tutorial: def.tutorial ?? null,
    walkthrough: null,
    /** The task line of the system prompt (suite.ts `task`; playerKnowledge.ts NEUTRAL_TASK). */
    task: Object.freeze({ id: def.task ? taskId(def.task) : null, text: def.task ?? null }),
    /** The committed player manual (manual/Oath_and_Ember_Player_Manual.md). */
    manualSha256: "4b091a6630dd56f236f89f8e2213a6bb7cad4a31d4851d1883f95867d92bfa86",
    /**
     * SHA-256 of each hero's whole system prompt (LLMPlayer.promptHash, batch 4)
     * at the freeze. P1 is excluded from prompt tuning: a different prompt is a
     * new P1 revision, not version 1.
     */
    systemPromptSha256: Object.freeze({
      "model-history": Object.freeze({ sieg: "d4408182509f64d2a14fcba1a85141ac96aef46db66b24494a6b344d05689796", coco: "3dc3102c3831efd54558b98abb88e283e107a3fdeaf80a721ee45bf18e058320" }),
      "model-obs-only": Object.freeze({ sieg: "00f567e87a373b1fd2912bed5c6b8d588673eee2044bfd6285194919ee95ad2e", coco: "602c7e3c6ff754fb173f6faa2321c6e59d2ede341459170dde39dfe3c884e184" }),
      "model-memory": Object.freeze({ sieg: "3902600e793433812c5310463ef4c6775abc453c5a40d2dc377c1d8789425279", coco: "37d7fd978756337ea904c6a8c515310789d57020e3fa8bdd35b0cd1f57964ae5" }),
    }),
  }),
  /** The observation contract for P1's areas (perception.ts prologueProps; actions.ts localTalk). */
  observation: Object.freeze({
    hudGoalLines: "hidden from every player (standing owner decision)",
    shown: Object.freeze([
      "the screen grid, partner, enemies and abilities as in every situation",
      "dialogue lines as each hero's own dialogue box shows them (inner narration only to its hero)",
      "the quest journal (quest and current step names)",
      "map labels and markers exactly as the client draws them, with its sealing: no label on the cart or the clearing; the trail's way on only after the cart is found",
      "'door' for the shop's front door and doorway (unlabelled art; owner's wording)",
      "'tipped cart' for the merchants' cart (unlabelled art; owner's wording)",
      "'gap in garden fence' (owner's wording) for the fence's one opening, with its exact collision gap as extent and no grid mark; the centre-sampled grid shows '#' there",
      "indoors, the client's house camera: the view is held inside the map's cameraBounds",
      "Alden where the story puts him, with 'E Talk' when in reach",
      "E at Alden or at the trail's crates and barrel returns the client's local dialogue pages as feedback",
    ]),
    /** The fence opening's passable span (world px), as listed. */
    gardenGateway: Object.freeze({ ...GARDEN_GATEWAY }),
    hidden: Object.freeze(["story flags and stage names", "future dialogue", "HUD goal lines", "hero ids and room code", "state hashes", "the scripted route"]),
  }),
  seeds: Object.freeze({
    tuning: Object.freeze([0, 1]),
    note:
      "Seeds 0 and 1 differ only in the room code and the two hero ids; both heroes' observations and legal " +
      "actions at reset are identical, and the scripted baseline plays an identical trajectory. Seed 1 is a repeated trial.",
  }),
  players: P1_PLAYERS,
  /** The scripted baseline: where its route knowledge comes from, and its committed reference result. */
  baseline: Object.freeze({
    player: "baseline-quest" as PlayerKind,
    knowledge:
      "Disclosed route knowledge (policies/questKnowledge.ts PROLOGUE), worked out from the story code and static map " +
      "geometry. It plays only through the five operations, from its own observation; no state is written.",
    routeSha256: createHash("sha256").update(canonicalJson(PROLOGUE)).digest("hex"),
    evidence: "docs/midterm/evidence/p1-v3-baseline/",
    reference: Object.freeze({
      seed: 0,
      status: "success",
      reason: "success",
      gameTicks: 1058,
      gameSeconds: 17.6,
      decisions: 161,
      invalidActions: 0,
      messages: 0,
      modelCalls: 0,
      endHash: "c2f3b973456f4c0dd693afa2c5c0dafc5cd5138f32c88bb3afe2bbd55d797e54",
    }),
  }),
  reproduce: Object.freeze([
    "node --import tsx scripts/midterm/prologue-situation.ts",
    "node --import tsx scripts/midterm/prologue-situation.ts --baseline --out <dir>",
    "npx vitest run packages/agent/test/prologueSituation.test.ts",
  ]),
});

/** Hash of the current (revision 3) definition. Pinned in the test; recorded in every P1 run summary. */
export const P1_HASH = createHash("sha256").update(canonicalJson(P1)).digest("hex");

/** The evaluation label of a scenario id, if it is P1. */
/** Every P1 revision, oldest first, with its definition hash. */
export const P1_REVISIONS = Object.freeze([
  { version: 1, preset: "P1", definitionHash: P1_V1_HASH, status: "superseded before any model run (review findings F1, F2, F4, F6)" },
  { version: 2, preset: "P1-v2", definitionHash: P1_V2_HASH, status: "superseded before any model run (owner's wording for the fence opening)" },
  { version: 3, preset: "P1-v3", definitionHash: P1_HASH, status: "current" },
] as const);

export function prologueEvaluationLabel(id: SituationId): { label: string; definitionHash: string } | null {
  return id === ID ? { label: P1.label, definitionHash: P1_HASH } : null;
}
