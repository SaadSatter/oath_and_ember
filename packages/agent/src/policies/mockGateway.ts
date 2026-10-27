// Offline stand-in for a model provider, for testing the launcher and the
// metered model path without spending money. It makes no network request.
//
// It reads only the user message the model player would send (that hero's
// observation and legal actions) and answers with seeded random legal
// actions. It has no game knowledge and no route; its results are launcher
// checks, never evaluation results. Usage and cost are reported as zero.

import type { Completion, Gateway } from "../budget.js";
import { ModelCallError } from "../budget.js";
import type { ActionSpec, GameAction } from "../types.js";

/** mulberry32: small deterministic PRNG. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MockGateway implements Gateway {
  readonly label: string;
  private readonly random: () => number;
  calls = 0;

  constructor(
    seed: number,
    /** Simulated thinking time per call, so a watched run looks like a model run. */
    private readonly delayMs = 0,
    /** Actions per reply (the model player's batch limit still applies). */
    private readonly batch = 2,
  ) {
    this.label = `mock:random-legal@${seed}`;
    this.random = rng(seed);
  }

  worstCaseUsd() {
    return 0;
  }

  private pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.random() * xs.length)];
  }

  private action(spec: ActionSpec): GameAction {
    const a: Record<string, unknown> = { type: spec.type };
    for (const [name, p] of Object.entries(spec.params ?? {})) {
      if ("optional" in p && p.optional && this.random() < 0.5) continue;
      if (p.kind === "enum") a[name] = this.pick(p.values);
      else if (p.kind === "int") a[name] = Math.min(p.max, p.min + Math.floor(this.random() * Math.min(60, p.max - p.min + 1)));
      else a[name] = "(mock player)".slice(0, p.maxLength);
    }
    return a as unknown as GameAction;
  }

  async complete(_system: string, user: string, signal: AbortSignal): Promise<Completion> {
    this.calls++;
    if (this.delayMs > 0)
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, this.delayMs);
        signal.addEventListener("abort", () => { clearTimeout(t); reject(new ModelCallError("aborted", "mock call aborted")); }, { once: true });
      });
    if (signal.aborted) throw new ModelCallError("aborted", "mock call aborted");
    let legal: ActionSpec[] = [];
    try {
      legal = (JSON.parse(user) as { legal_actions?: ActionSpec[] }).legal_actions ?? [];
    } catch {
      legal = [];
    }
    // Messages are skipped so the mock never floods its partner.
    const usable = legal.filter((s) => s.type !== "message");
    const actions = usable.length ? Array.from({ length: this.batch }, () => this.action(this.pick(usable))) : [];
    const text = JSON.stringify({ notes: "", actions });
    return { text, tokens: { input: Math.ceil(user.length / 4), output: Math.ceil(text.length / 4) }, costUsd: 0, model: "mock" };
  }
}
