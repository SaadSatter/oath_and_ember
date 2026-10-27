// The five-operation interface over the real, authoritative GameRoom.
//
// Scheduling ("decision points"): each hero's timed action runs for its own
// duration. The shared simulation advances only while no hero is deciding,
// one tick at a time for both heroes, so model latency never costs game time
// and two submissions never advance the game twice. When both heroes are
// deciding, their submissions are applied together in a fixed order
// (Sieg, then Coco), which keeps the run reproducible.

import { evaluationRuntime } from "./runtime.js";
import type { ModelBudget } from "./budget.js";
import { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { neutral, type Role, type SceneId } from "../../shared/src/gameTypes.js";
import { storyView } from "../../../apps/client/src/ui/storyDialogue.js";
import { items, type ItemId } from "../../shared/src/items.js";
import { questLog } from "../../../apps/client/src/ui/questLog.js";
import {
  legalActions,
  planFor,
  validate,
  type Plan,
} from "./actions.js";
import {
  areaName,
  heroName,
  perceive,
  PlayerMemory,
  roleOf,
  sceneOf,
  viewRect,
  type LabelMode,
} from "./perception.js";
import {
  episodes,
  milestones,
  stateHash,
  type EpisodePreset,
} from "./evaluator.js";
import {
  playerIds,
  type ActionSpec,
  type EpisodeLimits,
  type EpisodeState,
  type GameAction,
  type GameOutcome,
  type Observation,
  type PlayerId,
  type StepResult,
  type TerminationReason,
} from "./types.js";

/** Evaluator-side trace events. Contains privileged data; never give to players. */
export type TraceEvent = { type: string; tick: number; player?: PlayerId; data: unknown };

export interface EnvironmentOptions {
  preset?: EpisodePreset;
  /**
   * Runs right after reset, through this environment's own five operations,
   * to reach a scenario's starting state by real play (packages/agent/src/suite.ts).
   * Limits and success checks are paused and trace events suppressed while it
   * runs; afterwards decisions, invalid actions and each hero's memory are
   * cleared and the episode's game time starts from that tick.
   */
  prefix?: { name: string; run: (env: AgentEnvironment) => Promise<void> };
  limits?: Partial<EpisodeLimits>;
  labels?: LabelMode;
  trace?: (event: TraceEvent) => void;
  /**
   * Live viewing (scripts/midterm/live.ts; SERVER_CHANGES.md §4). Trusted
   * hooks, never visible to players:
   *   - `room` receives each new room right after reset creates it, so a
   *     view-only server can serve that exact room;
   *   - `tick` advances the room by exactly one tick instead of
   *     `room.tick()` (the server's manual driver, which also broadcasts);
   *   - `pace` is awaited between ticks while game time runs (not during a
   *     scenario prefix), to play at watchable speed.
   * None of them changes which ticks run or in what order relative to the
   * heroes' decisions; test/liveView.test.ts checks the hashes match.
   */
  room?: (room: GameRoom) => void;
  tick?: (room: GameRoom) => void;
  pace?: () => Promise<void>;
}

/** The interface every policy (baseline or model) uses. */
export interface GameInterface {
  reset(seed: number): Promise<EpisodeState>;
  observe(player: PlayerId): Promise<Observation>;
  legal_actions(player: PlayerId): Promise<ActionSpec[]>;
  step(player: PlayerId, action: GameAction): Promise<StepResult>;
  outcome(): Promise<GameOutcome>;
}

interface Running {
  frames: Partial<import("../../shared/src/gameTypes.js").InputFrame>[];
  index: number;
  startTick: number;
  hp: number;
  scene: SceneId;
  dialogue: string | null;
  feedback: string[];
  resolve: (r: StepResult) => void;
}

interface Slot {
  id: PlayerId;
  role: Role;
  key: string;
  memory: PlayerMemory;
  seq: number;
  /** Submitted and waiting for the partner's decision (barrier). */
  submitted?: {
    action: GameAction;
    resolve: (r: StepResult) => void;
    seenLine?: { cutscene: string; line: number };
  };
  running?: Running;
  decisions: number;
  invalid: number;
  requests: number;
}

const EXPLORE_EVERY = 10;

export class AgentEnvironment implements GameInterface {
  private room!: GameRoom;
  private slots!: Record<PlayerId, Slot>;
  private reason?: TerminationReason;
  private budget?: ModelBudget;
  private inPrefix = false;
  private startTick = 0;
  private readonly prefix?: EnvironmentOptions["prefix"];
  private episodeId = "";
  private seed = 0;
  private readonly preset: EpisodePreset;
  private readonly limits: EpisodeLimits;
  private readonly labels: LabelMode;
  private lastMilestones = new Set<string>();
  private lastBag = "";
  private lastJournal = "";
  private pacing = false;

  constructor(private readonly options: EnvironmentOptions = {}) {
    this.preset = options.preset ?? "milestone";
    this.limits = { ...episodes[this.preset].limits, ...options.limits };
    this.labels = options.labels ?? "as-drawn";
    this.prefix = options.prefix;
  }

  private trace(type: string, data: unknown, player?: PlayerId) {
    if (this.inPrefix) return;
    this.options.trace?.({ type, tick: this.room?.state.serverTick ?? 0, ...(player ? { player } : {}), data });
  }

  // ── 1. reset ────────────────────────────────────────────────────────────
  async reset(seed: number): Promise<EpisodeState> {
    if (!Number.isSafeInteger(seed)) throw Error("Seed must be an integer.");
    for (const slot of Object.values(this.slots ?? {})) this.release(slot, "The episode was reset.");
    this.seed = seed;
    this.reason = undefined;
    // The title screen's "The Bald Goddess" checkpoint, as RoomManager makes it.
    // Seeded ids and a game-time clock (runtime.ts): the same seed gives the
    // same hero ids and id-based tie-breaks; production rooms are unaffected.
    let room: GameRoom | undefined;
    const runtime = evaluationRuntime(seed, () => room?.state.serverTick ?? 0);
    this.room = room = new GameRoom(`EVAL${seed}`.slice(0, 12), false, "MAIN_HOUSE", true, "goddess", runtime);
    const sieg = this.room.add("agent-sieg").playerId;
    const coco = this.room.add("agent-coco").playerId;
    this.room.select(sieg, "OATH");
    this.room.select(coco, "EMBER");
    this.room.ready(sieg, true);
    this.room.ready(coco, true);
    if (this.room.state.phase !== "PLAYING") throw Error("Room did not start.");
    this.options.room?.(this.room);
    const slot = (id: PlayerId, key: string): Slot => ({
      id,
      role: roleOf(id),
      key,
      memory: new PlayerMemory(),
      seq: 0,
      decisions: 0,
      invalid: 0,
      requests: 0,
    });
    this.slots = { sieg: slot("sieg", sieg), coco: slot("coco", coco) };
    this.startTick = 0;
    let prefixInfo: { name: string; ticks: number } | undefined;
    if (this.prefix) {
      // Change watchers must be initialised before the prefix plays.
      this.lastMilestones = new Set(milestones(this.room.state));
      this.lastBag = JSON.stringify(this.room.state.inventory?.counts ?? {});
      this.lastJournal = JSON.stringify(questLog(this.room.state));
      // Reach the scenario's start by real play, through this interface.
      this.inPrefix = true;
      try {
        await this.prefix.run(this);
      } finally {
        this.inPrefix = false;
      }
      if (this.reason) throw Error(`Scenario prefix "${this.prefix.name}" ended the episode: ${this.reason}.`);
      for (const s of Object.values(this.slots)) {
        if (s.running || s.submitted) throw Error(`Scenario prefix "${this.prefix.name}" left an action in progress.`);
        Object.assign(s, { memory: new PlayerMemory(), decisions: 0, invalid: 0 });
      }
      this.startTick = this.room.state.serverTick;
      prefixInfo = { name: this.prefix.name, ticks: this.startTick };
    }
    const startHash = this.hash();
    this.episodeId = `${this.preset}-${seed}-${startHash.slice(0, 8)}`;
    this.lastMilestones = new Set(milestones(this.room.state));
    this.lastBag = JSON.stringify(this.room.state.inventory?.counts ?? {});
    this.lastJournal = JSON.stringify(questLog(this.room.state));
    for (const s of Object.values(this.slots)) this.explore(s);
    const state: EpisodeState = {
      episode: this.episodeId,
      seed,
      goal: episodes[this.preset].goal,
      tick: this.room.state.serverTick,
      startHash,
      limits: { ...this.limits },
    };
    this.trace("reset", { ...state, ...(prefixInfo ? { prefix: prefixInfo } : {}) });
    return state;
  }

  // ── 2. observe ──────────────────────────────────────────────────────────
  async observe(player: PlayerId): Promise<Observation> {
    const s = this.slot(player);
    return perceive(this.room, player, s.key, s.memory, { labels: this.labels });
  }

  // ── 3. legal_actions ────────────────────────────────────────────────────
  async legal_actions(player: PlayerId): Promise<ActionSpec[]> {
    const s = this.slot(player);
    if (this.reason) return [];
    return legalActions({ room: this.room, playerKey: s.key, messagesSent: s.memory.messagesSent });
  }

  // ── 4. step ─────────────────────────────────────────────────────────────
  step(player: PlayerId, action: GameAction): Promise<StepResult> {
    const s = this.slot(player);
    const refuse = (error: string, counted = true): Promise<StepResult> => {
      if (counted) s.invalid++;
      const result: StepResult = { accepted: false, error, ticks: 0, feedback: [error], done: !!this.reason };
      this.trace("invalid_action", { action, error }, player);
      return Promise.resolve(result);
    };
    if (this.reason) return refuse("The episode is over.", false);
    if (s.submitted || s.running) return refuse("You already have an action in progress.");
    s.decisions++;
    this.trace("action", { action, decision: s.decisions }, player);
    if (!this.inPrefix && s.decisions > this.limits.maxDecisionsPerPlayer) {
      this.stop("decision_limit");
      return refuse("Decision limit reached.", false);
    }
    const error = validate(action, legalActions({ room: this.room, playerKey: s.key, messagesSent: s.memory.messagesSent }));
    if (error) return refuse(error);
    const view = storyView(this.room.state, s.role);
    const seenLine = view ? { cutscene: view.cutscene, line: view.line } : undefined;
    return new Promise((resolve) => {
      s.submitted = { action, resolve, ...(seenLine ? { seenLine } : {}) };
      this.process();
    });
  }

  // ── 5. outcome ──────────────────────────────────────────────────────────
  async outcome(): Promise<GameOutcome> {
    const per = <T>(f: (s: Slot) => T) => ({ sieg: f(this.slots.sieg), coco: f(this.slots.coco) });
    // Episode time: from the scenario's start (after any prefix).
    const tick = this.room.state.serverTick - this.startTick;
    return {
      status: !this.reason ? "ongoing" : this.reason === "success" ? "success" : "terminated",
      ...(this.reason ? { reason: this.reason } : {}),
      episode: this.episodeId,
      ticks: tick,
      seconds: Math.round((tick / 60) * 10) / 10,
      decisions: per((s) => s.decisions),
      invalidActions: per((s) => s.invalid),
      modelCalls: per((s) => this.budget?.calls[s.id] ?? 0),
      failedModelCalls: per((s) => this.budget?.failed[s.id] ?? 0),
      unknownUsageCalls: per((s) => this.budget?.unknownUsage[s.id] ?? 0),
      tokens: per((s) => ({ ...(this.budget?.tokens[s.id] ?? { input: 0, output: 0 }) })),
      spendUsd: {
        known: Math.round((this.budget?.knownSpendUsd ?? 0) * 1e6) / 1e6,
        charged: Math.round((this.budget?.chargedUsd ?? 0) * 1e6) / 1e6,
      },
      limits: { ...this.limits },
      ...(this.budget ? { modelLimits: { ...this.budget.limits } } : {}),
    };
  }

  // ── Trusted runner hooks (not part of the player-facing interface) ──────
  /**
   * The runner's model budget, reported in outcome(). Model-call, token and
   * spend limits are enforced by the runner through this budget, not here.
   */
  attachBudget(budget: ModelBudget | undefined) {
    this.budget = budget;
  }
  /** Which suite preset and scenario prefix this environment plays (trusted; used by the held-out gate). */
  scenario() {
    return { preset: this.preset as string, prefix: this.prefix?.name ?? null };
  }
  /** Current simulation tick, for trusted trace records. */
  currentTick() {
    return this.room?.state.serverTick ?? 0;
  }
  /** Ends the episode now (wall clock, manual stop or error). */
  stop(reason: TerminationReason) {
    if (this.reason) return;
    this.reason = reason;
    this.trace("terminal", { reason, milestones: milestones(this.room.state), hash: this.hash() });
    for (const s of Object.values(this.slots)) this.release(s, `Episode ended: ${reason}.`);
  }
  /** Evaluator-only progress report. Never pass this to a player. */
  evaluatorReport() {
    return {
      milestones: milestones(this.room.state),
      area: this.room.state.sceneId,
      stateHash: this.hash(),
    };
  }

  // ── Scheduler ───────────────────────────────────────────────────────────
  private slot(player: PlayerId): Slot {
    if (!this.slots) throw Error("Call reset() first.");
    const s = this.slots[player];
    if (!s) throw Error(`Unknown player "${String(player)}".`);
    return s;
  }
  private deciding(s: Slot) {
    return !s.running;
  }

  /** Applies submissions once every deciding hero has submitted, then runs. */
  private process() {
    const order = playerIds.map((id) => this.slots[id]);
    if (order.some((s) => this.deciding(s) && !s.submitted)) return;
    for (const s of order) {
      const sub = s.submitted;
      if (!sub) continue;
      s.submitted = undefined;
      let plan: Plan;
      try {
        plan = planFor(sub.action, {
          room: this.room,
          playerKey: s.key,
          messagesSent: s.memory.messagesSent,
          requestId: () => `${s.id}-${++s.requests}`,
          deliver: (text) => this.deliver(s, text),
          ...(sub.seenLine ? { seenLine: sub.seenLine } : {}),
        });
      } catch (e) {
        s.invalid++;
        const error = (e as Error).message;
        this.trace("invalid_action", { action: sub.action, error }, s.id);
        sub.resolve({ accepted: false, error, ticks: 0, feedback: [error], done: false });
        continue;
      }
      if (plan.kind === "instant") {
        const r = plan.run();
        for (const line of r.feedback) s.memory.note(line);
        const feedback = [...r.feedback, ...this.watchSharedChanges()];
        this.trace("result", { ok: r.ok, feedback, ticks: 0 }, s.id);
        this.checkEnd();
        sub.resolve({ accepted: r.ok, ...(r.ok ? {} : { error: r.feedback[0] }), ticks: 0, feedback, done: !!this.reason });
      } else {
        const me = this.room.state.players[s.key];
        s.running = {
          frames: plan.frames,
          index: 0,
          startTick: this.room.state.serverTick,
          hp: me.hp,
          scene: sceneOf(this.room.state, me),
          dialogue: storyView(this.room.state, s.role)?.key ?? null,
          feedback: [],
          resolve: sub.resolve,
        };
      }
    }
    this.run();
  }

  /** Advances the shared simulation while every hero has an action running. */
  private run() {
    if (this.options.pace && !this.inPrefix) {
      // Paced: the same ticks, with a wait between them. While the loop
      // waits every hero is mid-action, so no submission can arrive.
      if (!this.pacing) void this.runPaced();
      return;
    }
    while (this.canTick()) this.tickOnce();
  }

  private canTick() {
    return !this.reason && playerIds.every((id) => this.slots[id].running);
  }

  private async runPaced() {
    this.pacing = true;
    const room = this.room;
    try {
      while (this.room === room && this.canTick()) {
        this.tickOnce();
        if (this.room === room && this.canTick()) await this.options.pace!();
      }
    } catch (e) {
      this.trace("pacing_error", { message: (e as Error).message });
      this.stop("error");
    } finally {
      this.pacing = false;
    }
  }

  /** One tick for both heroes: inputs, simulation, interruptions, results. */
  private tickOnce() {
    const order = playerIds.map((id) => this.slots[id]);
    for (const s of order) {
      const r = s.running!;
      const frame = r.frames[r.index] ?? {};
      this.room.receiveInput(s.key, { ...neutral(++s.seq), ...frame });
    }
    if (this.options.tick) this.options.tick(this.room);
    else this.room.tick();
    const w = this.room.state;
    if (w.serverTick % EXPLORE_EVERY === 0) for (const s of order) this.explore(s);
    const shared = this.watchSharedChanges();
    const finished: (() => void)[] = [];
    for (const s of order) {
      const r = s.running!;
      r.feedback.push(...shared);
      r.index++;
      const me = w.players[s.key];
      const scene = sceneOf(w, me);
      const dialogue = storyView(w, s.role)?.key ?? null;
      let interrupted: string | undefined;
      if (scene !== r.scene) {
        interrupted = `You arrived at ${areaName(scene)}.`;
        r.scene = scene;
      } else if (dialogue && dialogue !== r.dialogue) interrupted = "A dialogue line appeared.";
      else if (me.hp < r.hp) interrupted = `You took ${Math.round(r.hp - me.hp)} damage.`;
      if (me.hp > r.hp && r.hp <= 0) interrupted ??= "You recovered.";
      r.dialogue = dialogue;
      r.hp = me.hp;
      if (interrupted) {
        r.feedback.push(interrupted);
        s.memory.note(interrupted);
      }
      if (interrupted || r.index >= r.frames.length) finished.push(this.finish(s, interrupted));
    }
    // Judge the tick before answering, so a final step reports done.
    this.checkEnd();
    for (const resolve of finished) resolve();
  }

  /** Ends a hero's action; the returned callback delivers its result. */
  private finish(s: Slot, interrupted?: string) {
    const r = s.running!;
    s.running = undefined;
    this.explore(s);
    const ticks = this.room.state.serverTick - r.startTick;
    this.trace("result", { ok: true, ticks, interrupted, feedback: r.feedback, hash: this.hash() }, s.id);
    return () =>
      r.resolve({ accepted: true, ticks, ...(interrupted ? { interrupted } : {}), feedback: r.feedback, done: !!this.reason });
  }

  /** Resolves anything a hero is waiting on (episode over or reset). */
  private release(s: Slot, why: string) {
    const done: StepResult = { accepted: false, error: why, ticks: 0, feedback: [why], done: true };
    s.submitted?.resolve(done);
    s.submitted = undefined;
    if (s.running) {
      const r = s.running;
      s.running = undefined;
      r.resolve({ ...done, accepted: true, ticks: this.room.state.serverTick - r.startTick, feedback: [...r.feedback, why] });
    }
  }

  private checkEnd() {
    if (this.reason) return;
    const w = this.room.state;
    const now = milestones(w);
    for (const m of now) if (!this.lastMilestones.has(m)) this.trace("milestone", { milestone: m });
    this.lastMilestones = new Set(now);
    // A scenario prefix only reaches the start state: no success or limits yet.
    if (this.inPrefix) return;
    if (episodes[this.preset].success(w)) this.stop("success");
    else if (w.serverTick - this.startTick >= this.limits.maxTicks) this.stop("tick_limit");
  }

  /** Backpack and journal changes: both heroes see the same HUD/panels. */
  private watchSharedChanges(): string[] {
    const w = this.room.state;
    const out: string[] = [];
    const bag = JSON.stringify(w.inventory?.counts ?? {});
    if (bag !== this.lastBag) {
      const before = JSON.parse(this.lastBag) as Record<string, number>;
      for (const id of Object.keys(items) as ItemId[]) {
        const d = (w.inventory?.counts[id] ?? 0) - (before[id] ?? 0);
        if (d) out.push(`Shared backpack: ${d > 0 ? "+" : ""}${d} ${items[id].name}.`);
      }
      this.lastBag = bag;
    }
    const journal = JSON.stringify(questLog(w));
    if (journal !== this.lastJournal) {
      out.push("The quest journal was updated.");
      this.lastJournal = journal;
    }
    for (const line of out) for (const s of Object.values(this.slots)) s.memory.note(line);
    return out;
  }

  private deliver(from: Slot, text: string) {
    from.memory.messagesSent++;
    const to = from.id === "sieg" ? this.slots.coco : this.slots.sieg;
    to.memory.messages.push({ from: heroName(from.id) as "Sieg" | "Coco", text, tick: this.room.state.serverTick });
    this.trace("message", { to: to.id, text }, from.id);
  }

  private explore(s: Slot) {
    const me = this.room.state.players[s.key];
    s.memory.see(sceneOf(this.room.state, me), viewRect(this.room.state, me));
  }

  private hash() {
    return stateHash(this.room.state);
  }
}
