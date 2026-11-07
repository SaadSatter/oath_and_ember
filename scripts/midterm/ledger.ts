// The shared spend ledger (review H1; re-review M1, M4): inventory, one-time
// initialization, and reviewed recovery of interrupted reservations.
//
//   node --import tsx scripts/midterm/ledger.ts               inventory and balances (read-only)
//   node --import tsx scripts/midterm/ledger.ts init          create the canonical ledger (owner only;
//                                             asks for a typed confirmation)
//   node --import tsx scripts/midterm/ledger.ts init --adopt <p>   also migrate a legacy per-worktree ledger
//   node --import tsx scripts/midterm/ledger.ts open          list open reservations (read-only)
//   node --import tsx scripts/midterm/ledger.ts unlock        remove a lock whose process is gone (typed confirmation)
//   node --import tsx scripts/midterm/ledger.ts reconcile <entry> --trace <trace.jsonl> --by "<name>"
//   node --import tsx scripts/midterm/ledger.ts reconcile <entry> --no-trace --by "<name>"
//
// The canonical ledger lives in the git common directory, so every worktree
// shares one $25 allocation. It is never created implicitly by a paid run and
// never re-initialized: a permanent marker records its initialization.
//
// Reconciling an interrupted reservation: the charge is computed from the
// episode's verified trace (ledger.ts reconcile()): every recorded call at
// its charge, plus the whole hold of every call that started without a
// record. An unverifiable or missing trace charges the whole reservation.
// The result, the trace's sha256 and the reviewer are shown, confirmed by
// typing, and written into the entry's note. Nothing is ever refunded
// automatically.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { APPROVED_LEDGER, readMarker, reconcile, removeStaleLock, SpendLedger, staleLock } from "../../packages/agent/src/ledger.js";
import { canonicalLedgerPath, ledgerInventory, ledgerMarkerPath, repoInfo, unmeteredWorktrees } from "../../packages/agent/src/repo.js";
import { confirmTyped } from "./tty.js";

const repo = repoInfo();
const command = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "status";
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};

function balances(path: string) {
  try {
    const d = JSON.parse(readFileSync(path, "utf8")) as { entries: { stage: string; status: string; reservedUsd: number; chargedUsd: number | null }[] };
    const committed = (stage?: string) =>
      d.entries.filter((e) => !stage || e.stage === stage).reduce((a, e) => a + (e.status === "open" ? e.reservedUsd : e.chargedUsd ?? 0), 0);
    return {
      entries: d.entries.length,
      open: d.entries.filter((e) => e.status === "open").length,
      committedUsd: Math.round(committed() * 1e6) / 1e6,
      byStage: Object.fromEntries(Object.keys(APPROVED_LEDGER.stages).map((s) => [s, Math.round(committed(s) * 1e6) / 1e6])),
    };
  } catch {
    return { error: "unreadable" };
  }
}

const path = canonicalLedgerPath(repo);

if (command === "status") {
  const inventory = ledgerInventory(repo).map((i) => ({ ...i, ...(i.exists ? balances(i.path) : {}) }));
  console.log(JSON.stringify({
    commonDir: repo.commonDir, allocation: APPROVED_LEDGER, marker: { path: ledgerMarkerPath(repo), ...(readMarker(repo) ?? { initialized: false }) }, inventory,
    unmeteredWorktrees: unmeteredWorktrees(repo),
  }, null, 2));
  const unmetered = unmeteredWorktrees(repo);
  if (unmetered.length) console.error(`WARNING: ${unmetered.map((u) => u.file).join(", ")} can make paid calls outside the shared ledger. Never run paid commands there.`);
} else if (command === "init") {
  const adopt: string[] = [];
  process.argv.forEach((a, i) => { if (a === "--adopt") adopt.push(process.argv[i + 1]); });
  const inventory = ledgerInventory(repo).map((i) => ({ ...i, ...(i.exists ? balances(i.path) : {}) }));
  console.log(JSON.stringify({ inventory, marker: ledgerMarkerPath(repo) }, null, 2));
  await confirmTyped(`Create the canonical ledger at the path above with a $${APPROVED_LEDGER.totalCapUsd} total cap${adopt.length ? `, adopting ${adopt.join(", ")}` : ""}? This can be done only once.`, "INIT LEDGER");
  const { ledger, adopted } = SpendLedger.initCanonical(repo, { adopt });
  console.log(JSON.stringify({ created: ledger.path, ledgerId: ledger.ledgerId, adopted, remaining: ledger.remaining() }, null, 2));
  ledger.close();
} else if (command === "open") {
  const d = JSON.parse(readFileSync(path, "utf8")) as { entries: { id: string; stage: string; run: string; reservedUsd: number; status: string; openedAt: string }[] };
  console.log(JSON.stringify(d.entries.filter((e) => e.status === "open"), null, 2));
  const lock = staleLock(path);
  console.log(`Lock: ${"pid" in lock ? `stale (process ${lock.pid} is gone)` : lock.refused}`);
} else if (command === "unlock") {
  const s = staleLock(path);
  if (!("pid" in s)) throw Error(`Not removing the lock: ${s.refused}.`);
  await confirmTyped(`The lock ${path}.lock names process ${s.pid}, which is not running. Its open reservations stay open. Remove the lock?`, `UNLOCK ${s.pid}`);
  removeStaleLock(path, s.pid);
  console.log("Lock removed. Reconcile any open reservation with `ledger.ts reconcile`.");
} else if (command === "reconcile") {
  const id = process.argv[3];
  const by = arg("--by") ?? "";
  if (!id || id.startsWith("--")) throw Error("Name the open reservation: reconcile <entry> --trace <trace.jsonl> --by \"<name>\".");
  if (!by.trim()) throw Error("--by \"<name>\" is required: a reconciliation records who reviewed it.");
  const tracePath = arg("--trace");
  if (!tracePath && !process.argv.includes("--no-trace")) throw Error("Give --trace <trace.jsonl>, or --no-trace to charge the whole reservation.");
  const ledger = SpendLedger.openCanonical(repo);
  try {
    const entry = ledger.entries().find((e) => e.id === id && e.status === "open");
    if (!entry) throw Error(`No open reservation "${id}".`);
    const trace = tracePath ? { path: resolve(tracePath), text: readFileSync(resolve(tracePath), "utf8") } : null;
    const r = reconcile(entry, trace);
    console.log(JSON.stringify({ entry, reconciliation: r, refundedUsd: Math.round((entry.reservedUsd - r.chargedUsd) * 1e6) / 1e6 }, null, 2));
    await confirmTyped(`Settle ${id} at $${r.chargedUsd} (${r.basis})?`, `SETTLE ${id}`);
    ledger.settleReviewed(id, r, by);
    console.log(`Settled. Remaining: ${entry.stage} $${ledger.remaining(entry.stage)}, total $${ledger.remaining()}.`);
  } finally {
    ledger.close();
  }
} else {
  throw Error(`Unknown command "${command}" (status, init, open, unlock or reconcile).`);
}
