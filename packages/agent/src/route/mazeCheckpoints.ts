// Hedge Maze checkpoints for Situations B and C (docs/midterm/HEDGE_MAZE_SITUATIONS.md).
//
// A checkpoint is a prefix of a committed, hash-verified gameplay trace: the
// S2-A (S2-local) start, then each hero's recorded actions up to a cut tick,
// re-submitted in order through the environment's own step(). No fixture,
// teleport, flag or state write. If a hero's last action runs past the cut,
// only its duration is shortened so it ends at the cut. Inputs before the cut
// are unchanged, so the world at the cut is the recorded run's world at that
// tick (checked by packages/agent/test/hedgeMazeSituations.test.ts).
//
// Evaluator preparation only: players never see this module or its data.

import type { AgentEnvironment } from "../environment.js";
import type { GameAction, PlayerId } from "../types.js";

export interface CheckpointSource {
  /** Repository path of the committed source trace (course folder: without the midterms/saadsatter/ prefix). */
  trace: string;
  /** SHA-256 of the trace file's bytes. */
  sha256: string;
  situation: "S2-local";
  seed: number;
  player: string;
  gitHash: string;
}

export interface MazeCheckpoint {
  id: "S2-B" | "S2-C";
  /** Absolute game tick at which both heroes stop. */
  cutTick: number;
  /** What has happened by the cut, and what has not (from the recorded run). */
  description: string;
  source: CheckpointSource;
  /** Each hero's actions, in order: that hero's first `count` step lines of the source trace. */
  actions: Record<PlayerId, readonly GameAction[]>;
  /** The one action shortened to end at the cut, if any: its 0-based index in that hero's steps and its recorded ticks. */
  shortened: { player: PlayerId; index: number; recordedTicks: number; ticks: number } | null;
}

type StepLine = { type: string; tick: number; player?: string; data: unknown };

/**
 * Derive a checkpoint from a trace's step lines: every action that started
 * before `cutTick`, with an action still running at the cut shortened to end
 * there. Pure; used to generate the committed data and, in the test, to check it.
 */
export function deriveCheckpoint(lines: readonly StepLine[], cutTick: number) {
  const actions: Record<PlayerId, GameAction[]> = { sieg: [], coco: [] };
  let shortened: MazeCheckpoint["shortened"] = null;
  for (const p of ["sieg", "coco"] as PlayerId[]) {
    const steps = lines.filter((l) => l.type === "step" && l.player === p);
    for (const [index, l] of steps.entries()) {
      if (l.tick >= cutTick) break;
      const d = l.data as { action: GameAction; result: { ticks: number } };
      const end = l.tick + d.result.ticks;
      if (end > cutTick) {
        const a = d.action as GameAction & { ticks?: number };
        if (a.type !== "move" && a.type !== "wait") throw Error(`${p} step ${index} (${a.type}) runs past tick ${cutTick} and cannot be shortened.`);
        if (shortened) throw Error("Only one action may be shortened at a cut.");
        shortened = { player: p, index, recordedTicks: d.result.ticks, ticks: cutTick - l.tick };
        actions[p].push({ ...a, ticks: cutTick - l.tick } as GameAction);
      } else actions[p].push(d.action);
    }
  }
  return { actions, shortened };
}

/**
 * Play a checkpoint through the five operations. Both heroes submit their
 * recorded actions concurrently, exactly as in the recorded run; every action
 * must be accepted and the episode must not end. Both heroes must then be in
 * the Hedge Maze at the cut tick, between actions.
 */
export async function playCheckpoint(env: AgentEnvironment, cp: MazeCheckpoint) {
  await Promise.all(
    (["sieg", "coco"] as PlayerId[]).map(async (p) => {
      for (const [i, action] of cp.actions[p].entries()) {
        const r = await env.step(p, action);
        if (!r.accepted) throw Error(`${cp.id} checkpoint: ${p} action ${i} was refused (${r.error}).`);
        if (r.done) throw Error(`${cp.id} checkpoint: the episode ended during ${p} action ${i}.`);
      }
    }),
  );
  for (const p of ["sieg", "coco"] as PlayerId[]) {
    const o = await env.observe(p);
    if (o.area.name !== "Hedge Maze") throw Error(`${cp.id} checkpoint: ${p} is in ${o.area.name}, not the Hedge Maze.`);
    if (o.tick !== cp.cutTick) throw Error(`${cp.id} checkpoint: stopped at tick ${o.tick}, not ${cp.cutTick}.`);
  }
}
