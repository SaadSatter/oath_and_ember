// Public schema of the five-operation agent interface. Everything in this
// file may be shown to a game-playing agent: it describes the shape of the
// game's controls and screens, never their content or any puzzle answer.

export type PlayerId = "sieg" | "coco";
export const playerIds: readonly PlayerId[] = ["sieg", "coco"];

export type Direction = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
export const directions: readonly Direction[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
];

/** Timed actions run for at most this many simulation ticks (60 per second). */
export const MAX_ACTION_TICKS = 60;
export const MAX_MESSAGE_CHARS = 200;

export type AbilityName =
  | "push"
  | "super_speed"
  | "slow_time"
  | "flight"
  | "black_hole";

/** One action a player submits through `step`. */
export type GameAction =
  | { type: "move"; direction: Direction; ticks: number }
  | { type: "wait"; ticks: number }
  | { type: "attack"; direction?: Direction }
  | { type: "defend"; ticks: number }
  | { type: "ability"; ability: AbilityName; direction?: Direction; ticks?: number }
  | { type: "interact" }
  | { type: "use_item"; item?: string }
  | { type: "advance_dialogue" }
  | { type: "choose_dialogue"; option: number }
  | { type: "message"; text: string };

export type ActionType = GameAction["type"];
export const actionTypes: readonly ActionType[] = [
  "move",
  "wait",
  "attack",
  "defend",
  "ability",
  "interact",
  "use_item",
  "advance_dialogue",
  "choose_dialogue",
  "message",
];
export const abilityNames: readonly AbilityName[] = ["push", "super_speed", "slow_time", "flight", "black_hole"];

/**
 * The parameters each action type ever accepts, and which of them are
 * optional: the fixed public vocabulary behind legal_actions (actions.ts
 * builds the same parameters; a test keeps the two in step). Provider
 * adapters use it to describe one schema per action type. It never says which
 * action is legal or useful now; validate() still decides that.
 */
export const actionFields: Readonly<Record<ActionType, Readonly<Record<string, "required" | "optional">>>> = {
  move: { direction: "required", ticks: "required" },
  wait: { ticks: "required" },
  attack: { direction: "optional" },
  defend: { ticks: "required" },
  ability: { ability: "required", direction: "optional", ticks: "optional" },
  interact: {},
  use_item: { item: "optional" },
  advance_dialogue: {},
  choose_dialogue: { option: "required" },
  message: { text: "required" },
};

/** A currently available action and the parameters it accepts. */
export interface ActionSpec {
  type: ActionType;
  description: string;
  params?: Record<
    string,
    | { kind: "enum"; values: readonly (string | number)[]; optional?: boolean }
    | { kind: "int"; min: number; max: number; optional?: boolean }
    | { kind: "text"; maxLength: number }
  >;
}

export interface VisibleThing {
  /** Stable label for this observation only, e.g. "enemy-2". */
  ref: string;
  kind:
    | "partner"
    | "enemy"
    | "creature"
    | "object"
    | "exit"
    | "projectile"
    | "effect"
    /** Text painted or floating in the world: something to read, drawn without a screen character. */
    | "label";
  name: string;
  /** Tile coordinates (32 px tiles) within the current area. */
  x: number;
  y: number;
  /** For something drawn across several tiles (a floor trap column, a large creature): the block it covers, top-left tile and size in tiles. Its screen cells are those whose centre lies in that block. */
  extent?: { x: number; y: number; w: number; h: number };
  /** Distance from you in tiles, and the compass direction toward it. */
  distance: number;
  direction: Direction | "here";
  /** What the screen shows about it (health bar, lit/unlit, pose...). */
  details?: string;
}

export interface Observation {
  player: PlayerId;
  hero: "Sieg" | "Coco";
  tick: number;
  seconds: number;
  area: { name: string; widthTiles: number; heightTiles: number };
  self: {
    /** Tiles, truncated (not rounded) to two decimals, so the whole-number part is the "@" cell. */
    x: number;
    y: number;
    facing: Direction;
    hp: number;
    maxHp: number;
    status: string[];
  };
  abilities: { key: string; name: string; state: string }[];
  /**
   * The part of the area on your screen, one character per tile:
   * "@" you, "P" partner, "#" blocked, "~" water or gap, "." open ground,
   * "E" enemy, "C" creature, "o" object, ">" exit, "*" projectile/effect.
   */
  screen: { originX: number; originY: number; rows: string[] };
  visible: VisibleThing[];
  dialogue: null | {
    speaker: string;
    text: string;
    /** True when your E press moves this line on. */
    canAdvance: boolean;
    waiting?: string;
    choices?: { option: number; text: string }[];
  };
  journal: { current?: { quest: string; step: string; done: string[] }; completed: string[] };
  inventory: {
    items: { id: string; name: string; count: number; description: string }[];
    /** The object named in the backpack panel when you stand next to it. */
    nearbyTarget?: { id: string; name: string };
  };
  /** Areas you have been to, and coarse explored outline of this one. */
  discovered: { areas: string[]; exploredRows: string[] };
  /**
   * Dialogue lines your own screen showed, oldest first, including lines that
   * appeared and moved on while you were busy or waiting (the current line, if
   * any, is the last entry). Only what your dialogue box displayed: a line
   * meant for your partner appears as your screen showed it, and nothing that
   * has not been displayed yet is ever listed.
   */
  dialogueLog: { speaker: string; text: string; tick: number }[];
  /** Results of your own recent actions and things that just happened to you. */
  feedback: string[];
  /** Messages your partner sent you (most recent last). */
  messages: { from: "Sieg" | "Coco"; text: string; tick: number }[];
}

export interface StepResult {
  accepted: boolean;
  /** Why the action was refused (schema, not currently legal, or server). */
  error?: string;
  /** Simulation ticks that passed while this action ran. */
  ticks: number;
  /** Why the action ended before its duration, if it did. */
  interrupted?: string;
  /**
   * The press was for a dialogue line that had already moved on before it
   * arrived (usually because the partner advanced it first). Nothing happened;
   * it is not an illegal action.
   */
  stale?: boolean;
  /**
   * Attack actions only: whether the J press produced a swing or cast
   * ("performed") or nothing ("none", for example while J was recovering).
   * `accepted` only means the input was taken; this says what it did.
   */
  attack?: "performed" | "none";
  /**
   * Move actions, and Push with a direction (since pilot-9), when the hero stayed in the same area: how far the
   * move actually carried the hero compared with how far the same input
   * would have carried them on open ground. `accepted` still only means the
   * input was taken; this says how far it went. Never names an obstacle.
   */
  movement?: MovementReport;
  feedback: string[];
  done: boolean;
}

/**
 * The outcome of one move (movementReport.ts). Each tick of the move is sorted
 * by what the server did: it moved the hero with this move's input
 * ("applied"), used other input or none ("notApplied": a scene or lock, stale
 * input, a paused tick), or placed the hero itself ("movedByGame": respawn,
 * flight landing, being carried). Outcomes compare applied ticks with open
 * ground: "full" at least 90% of the open-ground distance in the requested
 * direction; "partial" visibly moved but fell short (blocked partway, or slid
 * sideways off a corner); "none" did not visibly move; "not_applied" no tick
 * used the input. Tiles; positions truncated to two decimals like `self`.
 */
export interface MovementReport {
  outcome: "full" | "partial" | "none" | "not_applied";
  /** Progress along the requested direction over applied ticks. */
  movedTiles: number;
  /** Open-ground distance over applied ticks, at the speed movement used on each tick. */
  requestedTiles: number;
  /** Where the hero stood when the action began and ended, whatever moved them. */
  from: { x: number; y: number };
  to: { x: number; y: number };
  ticks: { applied: number; notApplied: number; movedByGame: number };
  /**
   * The applied ticks fell short of open ground: something stood in the way.
   * Decided on unrounded distances, so a short move is never called blocked
   * because of display rounding. movedTiles and requestedTiles are rounded to
   * two decimals; from and to are truncated like `self`, so to − from can
   * differ from movedTiles by up to 0.01.
   */
  blocked: boolean;
}

export type TerminationReason =
  | "success"
  | "tick_limit"
  | "decision_limit"
  | "model_call_limit"
  | "token_limit"
  | "spend_limit"
  | "wall_clock_limit"
  | "error"
  | "manual_stop";

export interface GameOutcome {
  status: "ongoing" | "success" | "terminated";
  reason?: TerminationReason;
  episode: string;
  ticks: number;
  seconds: number;
  decisions: Record<PlayerId, number>;
  invalidActions: Record<PlayerId, number>;
  /** Attempted model calls, failed and timed-out ones included. */
  modelCalls: Record<PlayerId, number>;
  failedModelCalls: Record<PlayerId, number>;
  /** Calls whose token usage the provider did not report (not counted as zero). */
  unknownUsageCalls: Record<PlayerId, number>;
  /** Reported tokens only. */
  tokens: Record<PlayerId, { input: number; output: number }>;
  /** known: sum of reported costs. charged: what counted against the cap (unknown costs at their reservation). */
  spendUsd: { known: number; charged: number };
  limits: EpisodeLimits;
  modelLimits?: import("./budget.js").BudgetLimits;
}

export interface EpisodeLimits {
  /** Simulated game time, in ticks (60 per second). "480 s" means 480 s of game time (owner, 2026-10-27). */
  maxTicks: number;
  maxDecisionsPerPlayer: number;
  maxModelCallsPerPlayer: number;
  maxTokensPerPlayer: number;
}

export interface EpisodeState {
  episode: string;
  seed: number;
  goal: string;
  tick: number;
  /** Hash of the authoritative start state (identical for identical seeds). */
  startHash: string;
  limits: EpisodeLimits;
}
