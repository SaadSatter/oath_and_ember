// Audits a model-navigator run's model calls from its trace: why each call
// was made (policy_note events), what the reply did, how many calls went to
// waiting and to communication, and how many calls the 2026-11-05 changes
// could remove (edge-triggered movement lines; runs of wait-only and combat
// replies that one wait_until or fight intention could cover). Offline.
//
//   node --import tsx scripts/midterm/navigator-run-audit.ts <trace.jsonl> [out.json]

import { readFileSync, writeFileSync } from "node:fs";

type Line = { type: string; tick: number; player?: string; wallMs: number; data: Record<string, unknown> };
const [tracePath, out] = process.argv.slice(2);
if (!tracePath) {
  console.error("usage: navigator-run-audit.ts <trace.jsonl> [out.json]");
  process.exit(2);
}
const lines = readFileSync(tracePath, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Line);

const CATS: [string, RegExp][] = [
  ["no walking goal (nothing to carry on)", /no walking goal/],
  ["new partner message", /^new message from/],
  ["arrived at walking goal", /reached your walking goal/],
  ["walking goal unreachable", /cannot reach your goal/],
  ["something moved (game feedback)", /^new feedback: The .+ moved /],
  ["other new feedback line", /^new feedback:/],
  ["new thing on screen", /^new on your screen/],
  ["enemy close", /\(enemy\) is close/],
  ["dialogue line", /^dialogue on your screen/],
  ["damage", /took damage/],
  ["new action available", /new action is available/],
  ["action refused / reply unusable", /refused|could not be used/],
  ["walking move not taken", /did not take your last walking move/],
  ["walking budget", /walking moves since/],
];
const cat = (e: string) => CATS.find(([, re]) => re.test(e))?.[0] ?? `other: ${e.slice(0, 50)}`;

const calls = lines.filter((l) => l.type === "model_call");
const notes = lines.filter((l) => l.type === "policy_note" && (l.data as { source: string }).source === "model");
const replies = lines.filter((l) => l.type === "model_reply");

const byReason: Record<string, number> = {};
const onlyReason: Record<string, number> = {};
for (const n of notes) {
  const cs = [...new Set(((n.data as { events: string[] }).events).map(cat))];
  for (const c of cs) byReason[c] = (byReason[c] ?? 0) + 1;
  const key = cs.sort().join(" + ") || "(none)";
  onlyReason[key] = (onlyReason[key] ?? 0) + 1;
}

type Reply = { player: string; tick: number; kind: string; target?: string };
const replyKinds: Reply[] = replies.map((l) => {
  let r: { actions?: { type: string; ability?: string }[]; go_to?: unknown } = {};
  try {
    r = JSON.parse((l.data as { raw: string }).raw);
  } catch {
    return { player: l.player!, tick: l.tick, kind: "unparsed" };
  }
  const t = new Set((r.actions ?? []).map((a) => a.type));
  const kind = r.go_to ? "go_to" : !t.size ? "empty" : [...t].every((x) => x === "wait") ? "wait only" : [...t].every((x) => x === "wait" || x === "message") ? "message (+wait)" : t.has("attack") || t.has("defend") ? "combat" : t.has("ability") ? "ability" : [...t].every((x) => x === "move" || x === "wait") ? "manual moves" : [...t].sort().join("+");
  return { player: l.player!, tick: l.tick, kind };
});
const count = (xs: string[]) => xs.reduce((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {} as Record<string, number>);

/** Runs of consecutive replies of one kind per hero: one intention could have covered each run. */
function runs(kind: string) {
  let total = 0, runCount = 0;
  for (const p of ["sieg", "coco"]) {
    let inRun = false;
    for (const r of replyKinds.filter((x) => x.player === p)) {
      if (r.kind === kind) {
        total++;
        if (!inRun) runCount++;
        inRun = true;
      } else inRun = false;
    }
  }
  return { replies: total, runs: runCount, callsAnIntentionCouldSave: total - runCount };
}

// Movement lines: how many calls they triggered, and how many survive edge-triggering (one per burst).
const motionCalls = notes.filter((n) => (n.data as { events: string[] }).events.some((e) => /^new feedback: The .+ moved /.test(e)));
let kept = 0;
const lastByThing = new Map<string, number>();
for (const n of motionCalls) {
  const ev = (n.data as { events: string[] }).events.filter((e) => /^new feedback: The .+ moved /.test(e));
  const others = (n.data as { events: string[] }).events.filter((e) => !/^new feedback: The .+ moved /.test(e));
  let fresh = false;
  for (const e of ev) {
    const thing = /^new feedback: The (.+?) moved/.exec(e)![1];
    const prev = lastByThing.get(`${n.player}|${thing}`);
    if (prev === undefined || n.tick - prev > 60) fresh = true;
    lastByThing.set(`${n.player}|${thing}`, n.tick);
  }
  if (fresh || others.length) kept++;
}

const messagesSent = lines.filter((l) => l.type === "step" && (l.data as { action: { type: string }; status: string }).action.type === "message" && (l.data as { status: string }).status === "executed");
const report = {
  trace: tracePath.split("/").slice(-3).join("/"),
  modelCalls: { total: calls.length, byHero: count(calls.map((c) => c.player!)), byStatus: count(calls.map((c) => (c.data as { status: string }).status)) },
  callsWithAnswer: notes.length,
  callsContainingReason: Object.fromEntries(Object.entries(byReason).sort((a, b) => b[1] - a[1])),
  callsByExactReasonSet: Object.fromEntries(Object.entries(onlyReason).sort((a, b) => b[1] - a[1]).slice(0, 15)),
  replyKinds: { both: count(replyKinds.map((r) => r.kind)), sieg: count(replyKinds.filter((r) => r.player === "sieg").map((r) => r.kind)), coco: count(replyKinds.filter((r) => r.player === "coco").map((r) => r.kind)) },
  waiting: { ...runs("wait only"), note: "replies that only waited; one wait_until per run could replace the rest" },
  combat: { ...runs("combat"), note: "replies with attack/defend; one fight per run could replace the rest (upper bound: a run may switch targets)" },
  communication: { messagesSent: messagesSent.length, byHero: count(messagesSent.map((m) => m.player!)), callsTriggeredByPartnerMessage: byReason["new partner message"] ?? 0, repliesThatOnlyMessagedOrWaited: replyKinds.filter((r) => r.kind === "message (+wait)").length },
  movementLines: { callsTriggered: motionCalls.length, callsKeptWhenEdgeTriggered: kept },
};
console.log(JSON.stringify(report, null, 2));
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
