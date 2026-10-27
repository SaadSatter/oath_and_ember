import { createHash } from "node:crypto";
import type { TerminalReason } from "./contract.js";
import { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { neutral } from "../../shared/src/gameTypes.js";
import { shrineComplete } from "../../shared/src/shrine.js";
import {
  type Action,
  type ActionEnvelope,
  type EvaluationRole,
  type PresentationBoundary,
  type PlayerObservation,
  roles,
  type PublicKey,
} from "./contract.js";
import { EvaluationClock } from "./runtimeClock.js";
import { Episode } from "./episode.js";
import { MessageRelay } from "./messages.js";
import { validateEnvelope } from "./scheduler.js";
type Pending = {
  envelope: ActionEnvelope;
  resolve: (o: PlayerObservation) => void;
  reject: (e: unknown) => void;
};
/** Trusted coordinator. Policy workers receive only a role-bound facade, never this host. */
export class EvaluationEngine {
  private room!: GameRoom;
  private clock!: EvaluationClock;
  private episode!: Episode;
  private ids!: Record<EvaluationRole, string>;
  private seq = { SIEG: 0, COCO: 0 };
  private relay = new MessageRelay();
  private pending: Partial<Record<EvaluationRole, Pending>> = {};
  private observationIds = { SIEG: "", COCO: "" };
  private observationSerial = 0;
  private generation = 0;
  private used = new Set<string>();
  private flushing = false;
  private observationCache: Partial<
    Record<EvaluationRole, Promise<PlayerObservation>>
  > = {};
  private activePair?: Record<EvaluationRole, Pending>;
  private lastExecution:
    | {
        ticks: number;
        remaining: Record<EvaluationRole, number>;
        interrupted: boolean;
      }
    | undefined;
  constructor(
    private readonly presentation: PresentationBoundary,
    private readonly limits: {
      maxTicks?: number;
      maxSubmissionsPerRole?: number;
      trace?: (event: {
        type: string;
        tick: number;
        role?: EvaluationRole;
        data: unknown;
      }) => void;
    } = {},
  ) {}
  /** Trusted setup hook lets the socket server and browser attach the exact same room. */
  async reset(
    seed = 1,
    attach?: (
      room: GameRoom,
      ids: Record<EvaluationRole, string>,
    ) => void | Promise<void>,
  ) {
    if (this.flushing || Object.keys(this.pending).length)
      throw Error("Cannot reset with pending steps");
    this.generation++;
    this.clock = new EvaluationClock(seed);
    this.episode = new Episode(
      this.limits.maxTicks,
      this.limits.maxSubmissionsPerRole,
    );
    this.room = new GameRoom(
      "EVALAA",
      false,
      "GODDESS_SHRINE",
      false,
      undefined,
      this.clock,
    );
    this.ids = {
      SIEG: this.room.add("evaluation-sieg").playerId,
      COCO: this.room.add("evaluation-coco").playerId,
    };
    this.room.select(this.ids.SIEG, "OATH");
    this.room.select(this.ids.COCO, "EMBER");
    this.room.ready(this.ids.SIEG, true);
    this.room.ready(this.ids.COCO, true);
    this.seq = { SIEG: 0, COCO: 0 };
    this.relay = new MessageRelay();
    this.used.clear();
    this.observationSerial = 0;
    this.observationIds = { SIEG: "", COCO: "" };
    this.observationCache = {};
    this.lastExecution = undefined;
    await attach?.(this.room, { ...this.ids });
  }
  observe(role: EvaluationRole): Promise<PlayerObservation> {
    this.observationCache[role] ??= (async () => {
      const view = await this.presentation.observe(
        this.room,
        this.ids[role],
        role,
      );
      const observation_id = `observation-${this.generation}-${role}-${++this.observationSerial}`;
      this.observationIds[role] = observation_id;
      return {
        observation_id,
        role,
        view,
        messages: this.relay.read(role),
        execution: this.lastExecution ? { ...this.lastExecution, remaining: this.lastExecution.remaining[role] } : undefined,
      };
    })();
    return this.observationCache[role]!.then((value) => structuredClone(value));
  }
  legal_actions(role: EvaluationRole) {
    return this.presentation.legalActions(this.room, this.ids[role], role);
  }
  step(
    role: EvaluationRole,
    value: ActionEnvelope,
  ): Promise<PlayerObservation> {
    try {
      this.episode.submit(role);
      if (this.pending[role] || this.flushing)
        throw Error("Decision already pending");
      const envelope = validateEnvelope(value);
      this.relay.validate(role, envelope.message);
      if (
        envelope.observation_id !== this.observationIds[role] ||
        this.used.has(`${role}:${envelope.action_id}`)
      )
        throw Error("Stale or duplicate action");
      this.used.add(`${role}:${envelope.action_id}`);
      return new Promise((resolve, reject) => {
        this.pending[role] = { envelope, resolve, reject };
        if (this.pending.SIEG && this.pending.COCO) void this.flush();
      });
    } catch (e) {
      // A rejected joint submission releases the other role's barrier as well.
      for (const p of Object.values(this.pending)) p?.reject(e);
      this.pending = {};
      return Promise.reject(e);
    }
  }
  private input(role: EvaluationRole, keys: readonly PublicKey[]) {
    const frame = neutral(++this.seq[role]);
    frame.moveX =
      Number(keys.includes("right")) - Number(keys.includes("left"));
    frame.moveY = Number(keys.includes("down")) - Number(keys.includes("up"));
    for (const key of [
      "jump",
      "primary",
      "secondary",
      "sprint",
      "slowTime",
      "flight",
      "blackHole",
      "push",
      "interact",
    ] as const)
      frame[`${key}Held`] = keys.includes(key);
    this.room.receiveInput(this.ids[role], frame);
    this.limits.trace?.({
      type: "input",
      tick: this.episode.ticks + 1,
      role,
      data: structuredClone(frame),
    });
  }
  private expand(plan: Action[]): (PublicKey[] | string)[] {
    return plan.flatMap<PublicKey[] | string>((a) =>
      a.type === "controls"
        ? Array.from({ length: a.ticks }, () => a.held)
        : a.type === "wait"
          ? Array.from({ length: a.ticks }, () => [] as PublicKey[])
          : a.type === "press"
            ? [[a.key], []]
            : [a.token],
    );
  }
  private async flush() {
    this.flushing = true;
    const pair = this.pending as Record<EvaluationRole, Pending>;
    this.pending = {};
    this.activePair = pair;
    try {
      for (const role of roles)
        this.relay.send(role, pair[role].envelope.message);
      const plans = {
        SIEG: this.expand(pair.SIEG.envelope.plan),
        COCO: this.expand(pair.COCO.envelope.plan),
      };
      // Stop at the first expiring plan, so neither role waits for the partner's longer plan.
      const count = Math.min(plans.SIEG.length, plans.COCO.length);
      let executed = 0,
        interrupted = false;
      for (let tick = 0; tick < count && !this.episode.reason; tick++) {
        for (const role of roles) {
          if (this.episode.reason) break;
          const action = plans[role][tick];
          if (typeof action === "string") {
            const legal = await this.legal_actions(role);
            if (this.episode.reason) break;
            if (!legal.some((a) => a.token === action))
              throw Error("Unavailable UI token");
            await this.presentation.activate(this.room, this.ids[role], action);
            if (this.episode.reason) break;
            this.input(role, []);
          } else this.input(role, action);
        }
        if (this.episode.reason) break;
        const scene = this.room.state.sceneId;
        this.clock.advance();
        this.room.tick();
        this.episode.tick(shrineComplete(this.room.state));
        executed++;
        this.limits.trace?.({
          type: "state",
          tick: this.episode.ticks,
          data: {
            hash: createHash("sha256")
              .update(JSON.stringify(this.room.state))
              .digest("hex"),
          },
        });
        await this.presentation.afterTick?.(this.room);
        if (scene !== this.room.state.sceneId) {
          interrupted = true;
          break;
        }
      }
      // Decision pauses consume no game time and preserve held input.
      // A following wait or controls action explicitly releases held keys.
      this.lastExecution = {
        ticks: executed,
        remaining: {
          SIEG: plans.SIEG.length - executed,
          COCO: plans.COCO.length - executed,
        },
        interrupted,
      };
      this.observationCache = {};
      const observations = await Promise.all(
        roles.map((role) => this.observe(role)),
      );
      roles.forEach((role, i) => pair[role].resolve(observations[i]));
    } catch (error) {
      this.episode.stop("unrecoverable_error");
      for (const role of roles) pair[role].reject(error);
    } finally {
      this.flushing = false;
      this.activePair = undefined;
    }
  }
  outcome() {
    return this.episode.outcome();
  }
  stop(reason: TerminalReason) {
    this.episode.stop(reason);
    const error = Error(`Episode ${reason}`);
    for (const p of Object.values(this.pending)) p?.reject(error);
    for (const p of Object.values(this.activePair ?? {})) p?.reject(error);
    this.pending = {};
  }
  cancel() {
    this.stop("manual_cancel");
  }
}
