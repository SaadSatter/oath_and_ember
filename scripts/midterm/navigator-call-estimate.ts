// Offline estimate of how often the model-navigator would call its model.
// No game is run and no provider is called.
//
//   node --import tsx scripts/midterm/navigator-call-estimate.ts <baseline trace.jsonl> [model trace.jsonl ...]
//
// For a scripted baseline trace it replays each hero's own observation
// sequence through the navigator's event detector (detectEvents, the same
// function the player uses) and counts the decisions where the navigator
// would have to ask its model:
//   - any event fired (new thing on screen, damage, dialogue line, ...), or
//   - the baseline's action was not a walk (attack, E, ability, message, wait,
//     dialogue): the walking helper never chooses those.
// Runs of model-needed decisions with no event between them are grouped into
// batches of up to 4, as a model reply can carry 4 actions. Walking decisions
// with no event are the helper's. This assumes a model that picks the same
// walking goals the baseline walked to: it is a lower bound for an ideal
// player on that route, not a prediction of a real model.
//
// For model traces it reports the measured calls, episode game time and calls
// per game-second (the old players' actual rate).

import { readFileSync } from "node:fs";
import { detectEvents, _internals } from "../../packages/agent/src/policies/navigator.ts";
import type { ActionSpec, GameAction, Observation } from "../../packages/agent/src/types.ts";

type Line = { type: string; tick: number; player?: string; data: Record<string, unknown> };
const read = (p: string) => readFileSync(p, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Line);
const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");

function episodeSeconds(lines: Line[]) {
  const reset = lines.find((l) => l.type === "reset");
  const out = lines.find((l) => l.type === "outcome");
  const end = out ? (out.data.outcome as { ticks: number }).ticks : Math.max(...lines.map((l) => l.tick));
  return (end - (reset?.tick ?? 0)) / 60;
}

function estimate(path: string) {
  const lines = read(path);
  const result: Record<string, unknown> = { trace: path, episodeGameSeconds: Math.round(episodeSeconds(lines) * 10) / 10 };
  let total = 0;
  for (const hero of ["sieg", "coco"]) {
    // Decision-time observations (not in-batch ones) and the action that followed each.
    const seq: { o: Observation; legal: ActionSpec[]; action?: GameAction }[] = [];
    for (const l of lines) {
      if (l.player !== hero) continue;
      if (l.type === "observation" && !(l.data as { inBatch?: boolean }).inBatch) seq.push({ o: (l.data as { observation: Observation }).observation, legal: (l.data as { legal: ActionSpec[] }).legal });
      if (l.type === "step" && seq.length && !seq.at(-1)!.action) seq.at(-1)!.action = (l.data as { action: GameAction }).action;
    }
    const seen = new Set<string>(), texts = new Set<string>();
    let snap: ReturnType<typeof _internals.snapshot> | undefined;
    let calls = 0, eventCalls = 0, walking = 0, batch = 0;
    for (const { o, legal, action } of seq) {
      if (!action) continue;
      const ev = detectEvents(snap, o, legal, seen, texts);
      for (const v of o.visible) if (["enemy", "creature", "object", "exit", "label"].includes(v.kind)) seen.add(`${o.area.name}|${v.kind}|${v.name}`);
      for (const m of o.messages) texts.add(norm(m.text));
      snap = _internals.snapshot(o, legal);
      if (ev.length) {
        calls++;
        eventCalls++;
        batch = action.type === "move" ? 0 : 1;
      } else if (action.type === "move") {
        walking++;
        batch = 0;
      } else if (batch > 0 && batch < 4) batch++;
      else {
        calls++;
        batch = 1;
      }
    }
    total += calls;
    result[hero] = { decisions: seq.length, estimatedModelCalls: calls, ofWhichEventCalls: eventCalls, walkingByHelper: walking };
  }
  result.estimatedModelCallsBoth = total;
  result.estimatedCallsPerGameSecond = Math.round((total / (result.episodeGameSeconds as number)) * 100) / 100;
  return result;
}

function measured(path: string) {
  const lines = read(path);
  const calls: Record<string, number> = {};
  for (const l of lines) if (l.type === "model_call") calls[l.player!] = (calls[l.player!] ?? 0) + 1;
  const total = Object.values(calls).reduce((a, b) => a + b, 0);
  const gs = episodeSeconds(lines);
  const area = lines.find((l) => l.type === "observation") as { data: { observation: Observation } } | undefined;
  const outcome = lines.find((l) => l.type === "outcome")?.data.outcome as { reason?: string } | undefined;
  const wall = Math.max(...lines.map((l) => (l as unknown as { wallMs: number }).wallMs)) / 1000;
  return { trace: path, area: area?.data.observation.area.name, reason: outcome?.reason ?? null, modelCalls: calls, total, episodeGameSeconds: Math.round(gs * 10) / 10, callsPerGameSecond: gs > 0 ? Math.round((total / gs) * 100) / 100 : null, wallSeconds: Math.round(wall), wallPerGameSecond: gs > 0 ? Math.round((wall / gs) * 10) / 10 : null };
}

const [baseline, ...models] = process.argv.slice(2);
if (!baseline) {
  console.error("usage: navigator-call-estimate.ts <baseline trace.jsonl> [model trace.jsonl ...]");
  process.exit(2);
}
console.log(JSON.stringify({ navigatorEstimateOnBaselineRoute: estimate(baseline), measuredModelRuns: models.map(measured) }, null, 2));
