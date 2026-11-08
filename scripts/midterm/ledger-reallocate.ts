// One-off migration of the canonical spend ledger's stage split, approved by the
// owner on 2026-11-07: move $2 from final to pilot for the showcase v2 attempt
// (pilot $9 -> $11, final $15 -> $13; total stays $25).
//
//   node --import tsx scripts/midterm/ledger-reallocate.ts            # check only
//   node --import tsx scripts/midterm/ledger-reallocate.ts --apply    # migrate
//
// Refuses unless: the ledger is unlocked, its config is exactly the previous
// approved split, no reservation is open, its id matches the init marker, and
// spend already committed fits the new caps. Takes the ledger's own exclusive
// lock, rewrites only `config` (every entry is kept byte for byte), and writes
// evidence to docs/midterm/evidence/showcase-v2-authorization/reallocation.json.
// Makes no reservation and no provider call.
import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import { APPROVED_LEDGER, readMarker } from "../../packages/agent/src/ledger.js";
import { canonicalLedgerPath, repoInfo } from "../../packages/agent/src/repo.js";

const BEFORE = { totalCapUsd: 25, stages: { smoke: 0.1, pilot: 9, final: 15, contingency: 0.9 } };
const AFTER = APPROVED_LEDGER;
const apply = process.argv.includes("--apply");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const fail = (m: string): never => {
  console.error(`ledger-reallocate: ${m}`);
  process.exit(1);
};

const info = repoInfo();
const path = canonicalLedgerPath(info);
if (!existsSync(path)) fail(`no canonical ledger at ${path}.`);
if (JSON.stringify(AFTER) !== JSON.stringify({ totalCapUsd: 25, stages: { smoke: 0.1, pilot: 11, final: 13, contingency: 0.9 } }))
  fail("APPROVED_LEDGER in code is not the owner-approved new split; refusing.");

let lockFd: number;
try {
  lockFd = openSync(`${path}.lock`, "wx");
} catch {
  fail(`the ledger is locked (${path}.lock): a run is active. Wait for it to finish and settle.`);
}
class Refusal extends Error {}
/** Inside the lock: throw, so the finally below always releases it. */
const refuse = (m: string): never => {
  throw new Refusal(m);
};
writeSync(lockFd!, String(process.pid));
try {
  const beforeText = readFileSync(path, "utf8");
  const data = JSON.parse(beforeText);
  if (JSON.stringify(data.config) === JSON.stringify(AFTER)) refuse("already migrated; nothing to do.");
  if (JSON.stringify(data.config) !== JSON.stringify(BEFORE)) refuse(`unexpected current config ${JSON.stringify(data.config)}; refusing.`);
  const marker = readMarker(info);
  if (!marker || marker.ledgerId !== data.ledgerId) refuse("ledger id does not match the init marker; refusing.");
  const open = data.entries.filter((e: { status: string }) => e.status === "open");
  if (open.length) refuse(`open reservation(s): ${open.map((e: { id: string }) => e.id).join(", ")}. Wait for them to settle.`);
  const committed = (stage?: string) =>
    data.entries.filter((e: { stage: string }) => stage === undefined || e.stage === stage).reduce((t: number, e: { chargedUsd: number }) => t + e.chargedUsd, 0);
  for (const [stage, cap] of Object.entries(AFTER.stages)) if (committed(stage) > cap + 1e-9) refuse(`committed ${stage} spend exceeds the new $${cap} cap.`);
  const entriesSha = sha(JSON.stringify(data.entries));
  const after = { ...data, config: structuredClone(AFTER) };
  const afterText = JSON.stringify(after, null, 2);
  const report = {
    authorization: "Owner chose 'Move $2 from final' in Claude Code session e3e1a5e6 (2026-11-07): pilot $9->$11, final $15->$13, total $25 unchanged",
    beforeConfig: BEFORE,
    afterConfig: AFTER,
    entryCount: data.entries.length,
    allEntriesPreservedSha256: entriesSha,
    ledgerIdentityPreserved: true,
    openReservations: 0,
    committedUsd: { total: Math.round(committed() * 1e6) / 1e6, pilot: Math.round(committed("pilot") * 1e6) / 1e6, final: Math.round(committed("final") * 1e6) / 1e6 },
    pilotRemainingAfterUsd: Math.round((AFTER.stages.pilot - committed("pilot")) * 1e6) / 1e6,
    beforeFileSha256: sha(beforeText),
    afterFileSha256: sha(afterText),
    newReservationMade: false,
    applied: apply,
  };
  if (apply) {
    const tmp = `${path}.tmp`;
    const fd = openSync(tmp, "w");
    try {
      writeSync(fd, afterText);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, path);
    if (sha(JSON.stringify(JSON.parse(readFileSync(path, "utf8")).entries)) !== entriesSha) refuse("entries changed during migration; investigate before spending.");
    const dir = join(info.root, "docs/midterm/evidence/showcase-v2-authorization");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "reallocation.json"), JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify(report, null, 2));
  console.log(apply ? "Migrated." : "Check only: run again with --apply to migrate.");
} catch (e) {
  process.exitCode = 1;
  console.error(`ledger-reallocate: ${e instanceof Refusal ? e.message : (e as Error).stack}`);
} finally {
  closeSync(lockFd!);
  unlinkSync(`${path}.lock`);
}
