// The shared spend ledger (review H1): inventory and one-time initialization.
//
//   node --import tsx scripts/midterm/ledger.ts               inventory and balances (read-only)
//   node --import tsx scripts/midterm/ledger.ts init          create the canonical ledger (owner only;
//                                             asks for a typed confirmation)
//   node --import tsx scripts/midterm/ledger.ts init --adopt <p>   also migrate a legacy per-worktree ledger
//
// The canonical ledger lives in the git common directory, so every worktree
// shares one $25 allocation. It is never created implicitly by a paid run.

import { readFileSync } from "node:fs";
import { APPROVED_LEDGER, SpendLedger } from "../../packages/agent/src/ledger.js";
import { ledgerInventory, repoInfo } from "../../packages/agent/src/repo.js";
import { confirmTyped } from "./tty.js";

const repo = repoInfo();
const command = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "status";

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

const inventory = ledgerInventory(repo).map((i) => ({ ...i, ...(i.exists ? balances(i.path) : {}) }));

if (command === "status") {
  console.log(JSON.stringify({ commonDir: repo.commonDir, allocation: APPROVED_LEDGER, inventory }, null, 2));
} else if (command === "init") {
  const adopt: string[] = [];
  process.argv.forEach((a, i) => { if (a === "--adopt") adopt.push(process.argv[i + 1]); });
  console.log(JSON.stringify({ inventory }, null, 2));
  await confirmTyped(`Create the canonical ledger at the path above with a $${APPROVED_LEDGER.totalCapUsd} total cap${adopt.length ? `, adopting ${adopt.join(", ")}` : ""}?`, "INIT LEDGER");
  const { ledger, adopted } = SpendLedger.initCanonical(repo, { adopt });
  console.log(JSON.stringify({ created: ledger.path, adopted, remaining: ledger.remaining() }, null, 2));
  ledger.close();
} else {
  throw Error(`Unknown command "${command}" (status or init).`);
}
