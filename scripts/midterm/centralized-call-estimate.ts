// Offline estimate of how often model-centralized would call its planner,
// compared with model-navigator's estimate on the same route. No game is run
// and no provider is called.
//
//   node --import tsx scripts/midterm/centralized-call-estimate.ts <baseline trace.jsonl>
//
// Like navigator-call-estimate.ts, it replays each hero's own decision-time
// observations from a scripted baseline trace through the navigator's event
// detector, and assumes a model that picks the baseline's walking goals. A
// decision needs the model when an event fires or the baseline's action is
// not a walk; runs of such decisions with no event between them are batched
// by 4. The centralized estimate differs in three ways, each the player's
// own rule:
//   - partner-message events and message actions do not exist (no messaging);
//   - damage counts only when it is significant (CENTRAL.damageShare of
//     maximum HP since that hero's last plan, or crossing CENTRAL.lowHpShare);
//   - one planner call serves both heroes when they need it at the same tick
//     (the runner's barrier makes both decide at that moment).
// It is a lower bound for an ideal player on that route, not a prediction.

import { readFileSync } from "node:fs";
import { detectEvents, _internals } from "../../packages/agent/src/policies/navigator.ts";
import { CENTRAL } from "../../packages/agent/src/policies/centralized.ts";
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

/** The ticks at which one hero would need the model, under either player's rules. */
function callTicks(lines: Line[], hero: string, central: boolean) {
  const seq: { o: Observation; legal: ActionSpec[]; action?: GameAction }[] = [];
  for (const l of lines) {
    if (l.player !== hero) continue;
    if (l.type === "observation" && !(l.data as { inBatch?: boolean }).inBatch) seq.push({ o: (l.data as { observation: Observation }).observation, legal: (l.data as { legal: ActionSpec[] }).legal });
    if (l.type === "step" && seq.length && !seq.at(-1)!.action) seq.at(-1)!.action = (l.data as { action: GameAction }).action;
  }
  const seen = new Set<string>(), texts = new Set<string>();
  let snap: ReturnType<typeof _internals.snapshot> | undefined;
  let batch = 0, hpAtPlan = Infinity, walking = 0;
  const ticks: number[] = [];
  for (const { o, legal, action } of seq) {
    if (!action) continue;
    const prevHp = snap?.hp;
    let ev = detectEvents(snap, o, legal, seen, texts);
    for (const v of o.visible) if (["enemy", "creature", "object", "exit", "label"].includes(v.kind)) seen.add(`${o.area.name}|${v.kind}|${v.name}`);
    for (const m of o.messages) texts.add(norm(m.text));
    snap = _internals.snapshot(o, legal);
    if (o.self.hp > hpAtPlan) hpAtPlan = o.self.hp;
    if (central) {
      ev = ev.filter((e) => {
        if (/^new message from /.test(e)) return false;
        if (/^you took damage/.test(e)) {
          const low = o.self.hp <= CENTRAL.lowHpShare * o.self.maxHp && (prevHp ?? Infinity) > CENTRAL.lowHpShare * o.self.maxHp;
          return hpAtPlan - o.self.hp >= CENTRAL.damageShare * o.self.maxHp || low;
        }
        return true;
      });
      if (action.type === "message") continue;
    }
    if (ev.length) {
      ticks.push(o.tick);
      hpAtPlan = o.self.hp;
      batch = action.type === "move" ? 0 : 1;
    } else if (action.type === "move") {
      walking++;
      batch = 0;
    } else if (batch > 0 && batch < 4) batch++;
    else {
      ticks.push(o.tick);
      hpAtPlan = o.self.hp;
      batch = 1;
    }
  }
  return { ticks, decisions: seq.length, walking };
}

const [path] = process.argv.slice(2);
if (!path) {
  console.error("usage: centralized-call-estimate.ts <baseline trace.jsonl>");
  process.exit(2);
}
const lines = read(path);
const seconds = Math.round(episodeSeconds(lines) * 10) / 10;
const nav = { sieg: callTicks(lines, "sieg", false), coco: callTicks(lines, "coco", false) };
const cen = { sieg: callTicks(lines, "sieg", true), coco: callTicks(lines, "coco", true) };
const navTotal = nav.sieg.ticks.length + nav.coco.ticks.length;
const shared = new Set([...cen.sieg.ticks, ...cen.coco.ticks]);
const both = cen.sieg.ticks.filter((t) => cen.coco.ticks.includes(t)).length;
console.log(
  JSON.stringify(
    {
      trace: path,
      episodeGameSeconds: seconds,
      navigator: { sieg: nav.sieg.ticks.length, coco: nav.coco.ticks.length, total: navTotal, perGameSecond: Math.round((navTotal / seconds) * 100) / 100 },
      centralized: {
        siegNeeds: cen.sieg.ticks.length,
        cocoNeeds: cen.coco.ticks.length,
        sharedCalls: both,
        total: shared.size,
        perGameSecond: Math.round((shared.size / seconds) * 100) / 100,
      },
      decisions: { sieg: nav.sieg.decisions, coco: nav.coco.decisions },
    },
    null,
    2,
  ),
);
