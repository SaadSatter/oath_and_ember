import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
export type EvaluationRole = "SIEG" | "COCO";
export const roles: readonly EvaluationRole[] = ["SIEG", "COCO"];
export const publicKeys = [
  "left",
  "right",
  "up",
  "down",
  "jump",
  "primary",
  "secondary",
  "sprint",
  "slowTime",
  "flight",
  "blackHole",
  "push",
  "interact",
] as const;
export type PublicKey = (typeof publicKeys)[number];
export type Action =
  | { type: "controls"; held: PublicKey[]; ticks: number }
  | { type: "press"; key: PublicKey }
  | { type: "ui"; token: string }
  | { type: "wait"; ticks: number };
export interface ActionEnvelope {
  observation_id: string;
  action_id: string;
  plan: Action[];
  message?: string;
}
export interface LegalAction {
  token: string;
  label: string;
}
/** Trusted adapter. Never pass this object or its room argument into policy workers. */
export interface PresentationBoundary {
  observe(
    room: GameRoom,
    playerId: string,
    role: EvaluationRole,
  ): unknown | Promise<unknown>;
  legalActions(
    room: GameRoom,
    playerId: string,
    role: EvaluationRole,
  ): readonly LegalAction[] | Promise<readonly LegalAction[]>;
  activate(
    room: GameRoom,
    playerId: string,
    token: string,
  ): void | Promise<void>;
  afterTick?(room: GameRoom): void | Promise<void>;
}
export interface PlayerObservation {
  observation_id: string;
  role: EvaluationRole;
  view: unknown;
  execution?: {
    ticks: number;
    remaining: number;
    interrupted: boolean;
  };
  messages: readonly { from: EvaluationRole; text: string }[];
}
export type TerminalReason =
  | "success"
  | "time_limit"
  | "action_limit"
  | "model_call_budget"
  | "token_budget"
  | "unrecoverable_error"
  | "wall_clock_limit"
  | "manual_cancel";
export interface Outcome {
  terminal: boolean;
  reason?: TerminalReason;
  ticks: number;
  submissions: Record<EvaluationRole, number>;
}
