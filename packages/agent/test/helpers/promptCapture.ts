// Test helper (offline): plays a short S2-local seed-0 episode with scripted
// model replies and records every system and user message each hero's model
// player sent. Used to pin the model-history and model-obs-only prompts so a
// new policy cannot change them. No provider request is made.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defaultBudgetLimits, ModelBudget, type Completion, type Gateway } from "../../src/budget.js";
import { policiesFor, type ModelSetup, type PlayerKind } from "../../src/harness.js";
import { runEpisode } from "../../src/runner.js";
import { environmentFor } from "../../src/suite.js";
import { TraceWriter } from "../../src/trace.js";

export const MANUAL = readFileSync("manual/Oath_and_Ember_Player_Manual.md", "utf8");

/** Fixed replies, used in turn by each hero (a message, moves in several directions, a wait). */
export const SCRIPTED_REPLIES = [
  '{"notes":"start","actions":[{"type":"move","direction":"n","ticks":30},{"type":"move","direction":"e","ticks":30}]}',
  '{"actions":[{"type":"message","text":"I am looking around here."},{"type":"wait","ticks":20}]}',
  '{"notes":"second","actions":[{"type":"move","direction":"s","ticks":40},{"type":"move","direction":"w","ticks":40}]}',
  '{"actions":[{"type":"move","direction":"e","ticks":60}]}',
  '{"actions":[{"type":"message","text":"Done with that, going on."},{"type":"move","direction":"n","ticks":45}]}',
  '{"actions":[{"type":"wait","ticks":30}]}',
];

/** Replies from SCRIPTED_REPLIES per hero and records what each hero sent. */
export class ScriptedCapture implements Gateway {
  readonly label = "mock:capture";
  calls: { hero: "Sieg" | "Coco"; system: string; user: string }[] = [];
  private turn = { Sieg: 0, Coco: 0 };
  worstCaseUsd() {
    return 0.0001;
  }
  async complete(system: string, user: string): Promise<Completion> {
    const hero = system.startsWith("You are playing the cooperative game Oath and Ember as Sieg") ? "Sieg" : "Coco";
    this.calls.push({ hero, system, user });
    const text = SCRIPTED_REPLIES[this.turn[hero]++ % SCRIPTED_REPLIES.length];
    return { text, tokens: { input: 1, output: 1 }, costUsd: 0 };
  }
}

/** Plays `decisions` decisions per hero of S2-local seed 0 with `kind`, and returns the capture. */
export async function capturePrompts(kind: PlayerKind, decisions = 8) {
  const gateway = new ScriptedCapture();
  const setup: ModelSetup = { gateway, manual: MANUAL, ledger: undefined as never, stage: "pilot", priceSource: "test", maxBatch: 4 };
  const budget = new ModelBudget(defaultBudgetLimits);
  const policies = policiesFor(kind, budget, setup, "S2-local");
  const env = environmentFor("S2-local", { limits: { maxDecisionsPerPlayer: decisions } });
  const trace = new TraceWriter();
  const outcome = await runEpisode(env, policies, trace, { seed: 0, wallClockMs: 120_000, budget });
  return { gateway, outcome, trace, policies };
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

/** One digest per hero over every (system, user) pair it sent, in order. */
export function promptDigest(calls: ScriptedCapture["calls"]) {
  const per = (hero: "Sieg" | "Coco") => sha(JSON.stringify(calls.filter((c) => c.hero === hero).map((c) => [c.system, c.user])));
  return { sieg: per("Sieg"), coco: per("Coco"), calls: calls.length };
}
