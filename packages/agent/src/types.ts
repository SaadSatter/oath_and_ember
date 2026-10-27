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
    | "effect";
  name: string;
  /** Tile coordinates (32 px tiles) within the current area. */
  x: number;
  y: number;
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
  feedback: string[];
  done: boolean;
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
