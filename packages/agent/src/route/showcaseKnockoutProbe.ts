// OFFLINE CERTIFICATION PROBE for the showcase's knockout rule
// (docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md). Not a player, not a baseline,
// never shown to a model and never used in a showcase run or result.
//
// Question it answers: in showcase-maze-griffin-complete-v1, does the game's
// own respawn let play continue after a real knockout, with progress, the
// shared backpack and the Griffin unchanged, and can the episode still reach
// chapter0.complete?
//
// How: both heroes play the free scripted baseline (ShowcaseRouteBaseline).
// On reaching the Griffin Enclosure, Coco instead walks toward the Griffin and
// stands still without defending until the game reports her knockout (real
// damage from the Griffin's own attacks, through ordinary actions; no fixture,
// no HP edit, no teleport). From then on she plays the baseline again.

import type { ActionSpec, Observation, StepResult } from "../types.js";
import type { Decision, Policy, TurnReport } from "../policies/policy.js";
import { ShowcaseRouteBaseline } from "../policies/showcaseRoute.js";
import { planStep } from "../policies/navigate.js";

/** Where Coco walks to be seen and hit: just south of the Griffin's water (enclosure tiles). Probe-only knowledge. */
const EXPOSED = { x: 20, y: 13 };

export class ShowcaseKnockoutProbe implements Policy {
  readonly name = "certification-showcase-knockout-probe-v1";
  private readonly inner = new ShowcaseRouteBaseline("Coco");
  /** Coco's state as the probe saw it: playing the baseline, exposing herself, or recovered after a knockout. */
  stage: "baseline" | "exposed" | "recovered" = "baseline";
  knockoutSeenAtTick: number | null = null;

  async decide(input: { observation: Observation; legal: ActionSpec[]; last?: StepResult; batch?: TurnReport }): Promise<Decision> {
    const o = input.observation;
    const note = (d: Decision): Decision => ({ ...d, note: { probeStage: this.stage, ...(d.note ?? {}) } });
    const knockedOut = [input.last?.feedback ?? [], ...(input.batch?.steps.map((s) => s.result.feedback) ?? [])].flat().some((f) => /Your health ran out/.test(f));
    if (this.stage === "exposed" && knockedOut) {
      this.stage = "recovered";
      this.knockoutSeenAtTick = o.tick;
    }
    if (this.stage === "baseline" && o.area.name === "Griffin Enclosure" && !o.dialogue) this.stage = "exposed";
    if (this.stage !== "exposed") return note(await this.inner.decide(input));
    if (o.dialogue) return note({ action: input.legal.some((a) => a.type === "advance_dialogue") ? { type: "advance_dialogue" } : { type: "wait", ticks: 12 } });
    const s = planStep(o, EXPOSED, { maxTicks: 12, tolerance: 0.6 });
    return note({ action: s.kind === "move" ? { type: "move", direction: s.direction, ticks: s.ticks } : { type: "wait", ticks: 30 } });
  }
}

import { environmentFor } from "../suite.js";
import { runEpisode } from "../runner.js";
import { TraceWriter } from "../trace.js";
import type { GameRoom } from "../../../../apps/server/src/GameRoom.js";
import type { Player } from "../../../shared/src/gameTypes.js";

export interface KnockoutProbeRun {
  outcome: { status: string; reason: string | undefined; seconds: number };
  startHash: string;
  endHash: string;
  report: NonNullable<ReturnType<ReturnType<typeof environmentFor>["showcaseReport"]>>;
  probe: { stage: string; knockoutSeenAtTick: number | null };
  /** Authoritative state read by the evaluator around the first knockout (never given to a player). */
  aroundKnockout: { before: Snapshot; after: Snapshot } | null;
  traceLines: number;
}
interface Snapshot { tick: number; cocoHp: number; cocoScene: string | undefined; griffinHp: number | null; griffinPhase: string | null; backpack: Record<string, number>; storyFlags: number }

/** Runs the probe episode at `seed` and reports what happened around the knockout. */
export async function runShowcaseKnockoutProbe(seed = 0, tracePath?: string): Promise<KnockoutProbeRun> {
  let room!: GameRoom;
  let last: Snapshot | undefined;
  let around: { before: Snapshot; after: Snapshot } | null = null;
  const snap = (): Snapshot => {
    const w = room.state, coco = (Object.values(w.players) as Player[]).find((p) => p.role === "EMBER")!, g = w.puzzles.griffin?.griffin;
    return { tick: w.serverTick, cocoHp: coco.hp, cocoScene: coco.sceneId ?? w.sceneId, griffinHp: g?.hp ?? null, griffinPhase: g?.phase ?? null,
      backpack: Object.fromEntries((Object.entries(w.inventory?.counts ?? {}) as [string, number | undefined][]).filter(([, n]) => (n ?? 0) > 0)) as Record<string, number>, storyFlags: w.story?.flags.length ?? 0 };
  };
  const trace = new TraceWriter(tracePath);
  const env = environmentFor("showcase-maze-griffin-complete-v1", {
    room: (r) => (room = r),
    trace: (e) => {
      trace.write(e);
      if (e.type === "showcase_knockout" && !around && last) around = { before: last, after: snap() };
      if (room && e.type === "result") last = snap();
    },
  });
  const probe = new ShowcaseKnockoutProbe();
  const outcome = await runEpisode(env, { sieg: new ShowcaseRouteBaseline("Sieg"), coco: probe }, trace, { seed, wallClockMs: 600_000 });
  const reset = trace.lines.find((l) => l.type === "reset")!.data as { startHash: string };
  return {
    outcome: { status: outcome.status, reason: outcome.reason, seconds: outcome.seconds },
    startHash: reset.startHash,
    endHash: env.evaluatorReport().stateHash,
    report: env.showcaseReport()!,
    probe: { stage: probe.stage, knockoutSeenAtTick: probe.knockoutSeenAtTick },
    aroundKnockout: around,
    traceLines: trace.lines.length,
  };
}
