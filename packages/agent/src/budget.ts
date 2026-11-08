// Trusted model-call accounting. One ModelBudget per episode, owned by the
// runner. Every attempted model call goes through a MeteredGateway bound to
// that budget and one hero: the call, token and spend limits are checked
// before dispatch, a per-call timeout aborts the request, and the attempt is
// recorded whatever happens (success, error, timeout, refusal). Usage the
// provider did not report is recorded as unknown, never as zero.

import { AsyncLocalStorage } from "node:async_hooks";
import type { PlayerId } from "./types.js";

/**
 * The part of the persistent spend ledger (`ledger.ts`) a budget relies on.
 * Declared here so this module keeps importing only `types.ts`.
 */
export interface ReservationLedger {
  assertReservation(id: string, cap: number, paid?: boolean): void;
}

export type BudgetReason = "model_call_limit" | "token_limit" | "spend_limit";
export type CallStatus = "ok" | "error" | "timeout" | "refusal" | "aborted";

export interface BudgetLimits {
  /** Attempted calls per hero, failed and timed-out calls included. */
  maxModelCallsPerPlayer: number;
  /** Reported input + output tokens per hero. */
  maxTokensPerPlayer: number;
  /** Total for the whole episode, both heroes together (USD). */
  maxSpendUsd: number;
  /** Per-call timeout (ms). Owner decision 2026-10-27: 30 s, configurable. */
  callTimeoutMs: number;
}
export const defaultBudgetLimits: BudgetLimits = {
  maxModelCallsPerPlayer: 400,
  maxTokensPerPlayer: 4_000_000,
  maxSpendUsd: 1,
  callTimeoutMs: 30_000,
};

export interface Completion {
  text: string;
  /** Original provider text when an adapter normalizes its wire schema. */
  rawText?: string;
  /** Reported by the provider; null when it did not report usage. */
  tokens: { input: number; output: number } | null;
  /** Computed from reported usage and dated prices; null when unknown. */
  costUsd: number | null;
  /** Model id the provider says it used, when reported. */
  model?: string;
  /** Prompt-cache tokens, when the provider reports them (included in tokens.input). */
  cache?: { read: number; write: number };
  /** Safe diagnostic facts about the reply (never its thinking text, headers or credentials). */
  meta?: ReplyMeta;
}

/**
 * What the provider said about how a reply ended and what it contained, kept
 * for diagnosis. Content is summarised by block type and length only.
 */
export interface ReplyMeta {
  /** e.g. "end_turn", "max_tokens", "refusal"; null when not reported. */
  stopReason: string | null;
  /** One entry per content block, in order: its type and its text length. */
  blocks: { type: string; chars: number }[];
  /** Whether the request asked the provider to constrain the reply to the JSON schema. */
  structured: boolean;
  provider?: "openai";
  requestedModel?: string;
  effort?: string;
  reasoningTokens?: number;
  serviceTier?: string;
  cacheTtl?: string;
  pricingPremium?: number;
}

/** Per-call request options a player may set. Nothing here reaches game state. */
export interface CompletionOptions {
  /**
   * JSON schema the reply must follow, for providers that support constrained
   * output. It describes only the public action format (types.ts).
   */
  schema?: Record<string, unknown>;
}

/** A provider adapter. It never retries on its own (retries would be uncounted calls). */
export interface Gateway {
  readonly label: string;
  /** Worst-case cost of one call with this prompt, or null if prices are unknown. */
  worstCaseUsd(system: string, user: string, options?: CompletionOptions): number | null;
  complete(system: string, user: string, signal: AbortSignal, options?: CompletionOptions): Promise<Completion>;
}

/** A provider failure that still carries whatever usage the provider reported. */
export class ModelCallError extends Error {
  constructor(
    readonly status: Exclude<CallStatus, "ok">,
    message: string,
    readonly partial?: Pick<Completion, "tokens" | "costUsd" | "model" | "cache" | "meta">,
  ) {
    super(message);
  }
}

export class BudgetExhausted extends Error {
  constructor(readonly reason: BudgetReason, message: string) {
    super(message);
  }
}

export interface CallRecord {
  player: PlayerId;
  /** 1-based attempt number for this hero. */
  attempt: number;
  gateway: string;
  status: CallStatus;
  error?: string;
  latencyMs: number;
  tokens: { input: number; output: number } | null;
  costUsd: number | null;
  /** Worst-case amount held against the spend cap before the call. */
  reservedUsd: number | null;
  /** What the spend cap was actually charged: the reported cost, or the reservation if unknown. */
  chargedUsd: number;
  model?: string;
  cache?: { read: number; write: number };
  meta?: ReplyMeta;
}

// Unforgeable within the runner API: only begin() admits a live signal, once.
const boundEntries = new WeakMap<ReservationLedger, Set<string>>();
const dispatches = new WeakMap<AbortSignal, { check: () => void; used: boolean; transported: boolean }>();
const transportContext = new AsyncLocalStorage<AbortSignal>();
// Ledger and lock refusals keep their reason but always surface as a model-call
// error, so no adapter can relabel a refused dispatch as a transport failure.
function checkGrant(grant: { check: () => void }) {
  try {
    grant.check();
  } catch (e) {
    throw new ModelCallError("error", `Paid dispatch refused: ${(e as Error).message}`);
  }
}
export function assertPaidDispatch(signal: AbortSignal) {
  const grant = dispatches.get(signal);
  if (!grant || grant.used || signal.aborted) throw new ModelCallError("error", "Paid dispatch requires persistent episode and per-call authorization.");
  checkGrant(grant);
  grant.used = true;
}

/** SDK transport itself is guarded, including direct SDK calls outside complete(). */
export function paidTransport<T>(signal: AbortSignal, operation: () => T): T {
  assertPaidDispatch(signal);
  return transportContext.run(signal, operation);
}
export function assertPaidTransport() {
  const signal = transportContext.getStore();
  const grant = signal && dispatches.get(signal);
  if (!signal || !grant || !grant.used || grant.transported || signal.aborted) throw new ModelCallError("error", "Paid transport is not authorized.");
  checkGrant(grant);
  grant.transported = true;
}

export class ModelBudget {
  readonly calls: Record<PlayerId, number> = { sieg: 0, coco: 0 };
  readonly failed: Record<PlayerId, number> = { sieg: 0, coco: 0 };
  readonly tokens: Record<PlayerId, { input: number; output: number }> = {
    sieg: { input: 0, output: 0 },
    coco: { input: 0, output: 0 },
  };
  /** Calls whose token usage was not reported. */
  readonly unknownUsage: Record<PlayerId, number> = { sieg: 0, coco: 0 };
  readonly records: CallRecord[] = [];
  /** Sum of reported costs. */
  knownSpendUsd = 0;
  /** What counts against the cap: reported costs plus reservations for calls of unknown cost, plus calls in flight. */
  chargedUsd = 0;
  private persistent?: { ledger: ReservationLedger; entry: string };
  /** Bind exactly once, after the episode's whole cap has been durably reserved. */
  bindLedger(ledger: ReservationLedger, entry: string) {
    if (this.persistent || this.calls.sieg || this.calls.coco) throw Error("Episode budget cannot be rebound.");
    ledger.assertReservation(entry, this.limits.maxSpendUsd);
    const bound = boundEntries.get(ledger) ?? new Set<string>();
    if (bound.has(entry)) throw Error("Persistent reservation already bound to a call budget.");
    bound.add(entry); boundEntries.set(ledger, bound);
    this.persistent = { ledger, entry };
  }
  private inFlightUsd = 0;
  private aborted = false;
  private readonly controllers = new Set<AbortController>();
  onRecord: (r: CallRecord) => void = () => {};
  /**
   * Called when a call is admitted, before it is dispatched, with the amount
   * held for it. Traced so an interrupted episode can be reconciled: a call
   * that started but has no record is charged its whole hold (ledger.ts).
   */
  onStart: (s: { player: PlayerId; attempt: number; reservedUsd: number }) => void = () => {};

  constructor(readonly limits: BudgetLimits) {
    if (!Number.isSafeInteger(limits.maxModelCallsPerPlayer) || !(limits.maxModelCallsPerPlayer > 0)) throw Error("maxModelCallsPerPlayer must be positive.");
    if (!Number.isSafeInteger(limits.maxTokensPerPlayer) || !(limits.maxTokensPerPlayer > 0)) throw Error("maxTokensPerPlayer must be positive.");
    if (!Number.isFinite(limits.maxSpendUsd) || !(limits.maxSpendUsd > 0)) throw Error("A positive spend cap is required.");
    if (!Number.isFinite(limits.callTimeoutMs) || !(limits.callTimeoutMs > 0)) throw Error("callTimeoutMs must be positive.");
  }

  /** Why this hero may not make another call, if anything. */
  exhausted(player: PlayerId): BudgetReason | undefined {
    if (this.calls[player] >= this.limits.maxModelCallsPerPlayer) return "model_call_limit";
    const t = this.tokens[player];
    if (t.input + t.output >= this.limits.maxTokensPerPlayer) return "token_limit";
    if (this.chargedUsd + this.inFlightUsd >= this.limits.maxSpendUsd) return "spend_limit";
    return undefined;
  }

  /** Abort every call in flight (wall-clock limit or manual stop). */
  abortAll() {
    this.aborted = true;
    for (const c of this.controllers) c.abort();
  }

  /** @internal used by MeteredGateway */
  begin(player: PlayerId, worstCaseUsd: number | null) {
    if (this.aborted) throw new ModelCallError("aborted", "Episode budget has been closed.");
    const reason = this.exhausted(player);
    if (reason) throw new BudgetExhausted(reason, `${reason} reached for ${player}`);
    if (worstCaseUsd === null || !Number.isFinite(worstCaseUsd) || worstCaseUsd < 0)
      throw new BudgetExhausted("spend_limit", "No price is known for this model, so the spend cap cannot be enforced.");
    if (this.chargedUsd + this.inFlightUsd + worstCaseUsd > this.limits.maxSpendUsd)
      throw new BudgetExhausted(
        "spend_limit",
        `A call could cost up to $${worstCaseUsd.toFixed(4)}; $${(this.chargedUsd + this.inFlightUsd).toFixed(4)} of $${this.limits.maxSpendUsd} is used or reserved.`,
      );
    this.persistent?.ledger.assertReservation(this.persistent.entry, this.limits.maxSpendUsd);
    this.calls[player]++;
    this.inFlightUsd += worstCaseUsd;
    const controller = new AbortController();
    this.controllers.add(controller);
    const persistent = this.persistent;
    if (persistent) dispatches.set(controller.signal, { used: false, transported: false, check: () => {
      if (this.aborted || !this.controllers.has(controller)) throw Error("Call authorization is no longer active.");
      persistent.ledger.assertReservation(persistent.entry, this.limits.maxSpendUsd, true);
    } });
    this.onStart({ player, attempt: this.calls[player], reservedUsd: worstCaseUsd });
    return { attempt: this.calls[player], reservedUsd: worstCaseUsd, controller };
  }

  /** @internal used by MeteredGateway */
  settle(rec: Omit<CallRecord, "chargedUsd">, controller: AbortController) {
    if (!this.controllers.delete(controller)) throw Error("Model call was already settled.");
    dispatches.delete(controller.signal);
    // Bad/missing provider usage must not make cap arithmetic NaN or negative.
    rec = { ...rec,
      costUsd: rec.costUsd !== null && Number.isFinite(rec.costUsd) && rec.costUsd >= 0 ? rec.costUsd : null,
      tokens: rec.tokens && Number.isSafeInteger(rec.tokens.input) && rec.tokens.input >= 0 && Number.isSafeInteger(rec.tokens.output) && rec.tokens.output >= 0 ? rec.tokens : null,
    };
    this.inFlightUsd -= rec.reservedUsd ?? 0;
    const charged = rec.costUsd ?? rec.reservedUsd ?? 0;
    this.chargedUsd += charged;
    if (rec.costUsd !== null) this.knownSpendUsd += rec.costUsd;
    if (rec.tokens) {
      this.tokens[rec.player].input += rec.tokens.input;
      this.tokens[rec.player].output += rec.tokens.output;
    } else this.unknownUsage[rec.player]++;
    if (rec.status !== "ok") this.failed[rec.player]++;
    const full: CallRecord = { ...rec, chargedUsd: charged };
    this.records.push(full);
    this.onRecord(full);
    return full;
  }
}

/** The only way a player reaches a model: one hero, one budget, one timeout. */
export class MeteredGateway {
  constructor(
    readonly inner: Gateway,
    readonly budget: ModelBudget,
    readonly player: PlayerId,
  ) {}
  get label() {
    return this.inner.label;
  }

  async complete(system: string, user: string, options?: CompletionOptions): Promise<Completion & { record: CallRecord }> {
    const { attempt, reservedUsd, controller } = this.budget.begin(this.player, this.inner.worstCaseUsd(system, user, options));
    const started = performance.now();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(new ModelCallError(timedOut ? "timeout" : "aborted", timedOut ? "model call timed out" : "model call aborted")), { once: true });
    });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new ModelCallError("timeout", `model call exceeded ${this.budget.limits.callTimeoutMs} ms`));
      }, this.budget.limits.callTimeoutMs);
    });
    let accounted = false;
    const base = { player: this.player, attempt, gateway: this.inner.label, reservedUsd };
    try {
      const c = await Promise.race([this.inner.complete(system, user, controller.signal, options), timeout, aborted]);
      accounted = true;
      const record = this.budget.settle(
        { ...base, status: "ok", latencyMs: Math.round(performance.now() - started), tokens: c.tokens, costUsd: c.costUsd, ...(c.model ? { model: c.model } : {}), ...(c.cache ? { cache: c.cache } : {}), ...(c.meta ? { meta: c.meta } : {}) },
        controller,
      );
      return { ...c, record };
    } catch (e) {
      if (accounted) throw e;
      const err =
        e instanceof ModelCallError
          ? e
          : new ModelCallError(timedOut ? "timeout" : controller.signal.aborted ? "aborted" : "error", (e as Error)?.message ?? String(e));
      const status = timedOut ? "timeout" : err.status;
      this.budget.settle(
        {
          ...base,
          status,
          error: err.message.slice(0, 300),
          latencyMs: Math.round(performance.now() - started),
          tokens: err.partial?.tokens ?? null,
          costUsd: err.partial?.costUsd ?? null,
          ...(err.partial?.model ? { model: err.partial.model } : {}),
          ...(err.partial?.cache ? { cache: err.partial.cache } : {}),
          ...(err.partial?.meta ? { meta: err.partial.meta } : {}),
        },
        controller,
      );
      throw new ModelCallError(status, err.message, err.partial);
    } finally {
      clearTimeout(timer);
    }
  }
}
