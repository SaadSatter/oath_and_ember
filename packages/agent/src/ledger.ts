// Persistent spend ledger for paid model runs (owner decision 2026-10-27):
// claude-haiku-5-5 with a $25 total hard cap split into stages. It fails closed:
//   - every episode reserves its whole per-episode cap on disk before it starts;
//   - open reservations count as spent until settled (so a crash leaves money held);
//   - a settled episode whose spend is unknown is charged its whole reservation;
//   - an unreadable, inconsistent or locked ledger refuses all reservations.
// Review H1: paid entrypoints open the one canonical ledger in the git common
// directory (repo.ts), shared by every worktree. It is never created
// implicitly: a missing canonical ledger refuses to spend until it is
// initialized after an inventory of every existing ledger.
// Re-review M1: initialization writes a permanent marker naming the ledger's
// id. A ledger that disappears, or is replaced by one with another id, is
// refused, and initialization never runs twice, so deleting the ledger can
// never restore the original allowance.
// Re-review M4: interrupted reservations are settled only by a reviewed,
// recorded reconciliation from the episode's verified trace (reconcile()
// below, scripts/midterm/ledger.ts). A call that started without a record is
// charged its whole hold; anything unverifiable is charged the whole
// reservation. Nothing is refunded automatically.
// Within an episode, ModelBudget (budget.ts) enforces the same cap per call,
// including reservations for calls in flight.

import { createHash, randomUUID } from "node:crypto";
import { chmodSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync, writeSync } from "node:fs";

import { dirname } from "node:path";
import { canonicalLedgerPath, ledgerInventory, ledgerMarkerPath, repoInfo, type LedgerInventoryItem, type RepoInfo } from "./repo.js";
import { verifyTrace, type TraceLine } from "./trace.js";

export interface LedgerConfig {
  totalCapUsd: number;
  stages: Record<string, number>;
}
/** Owner-approved allocation (2026-10-27). */
export const APPROVED_LEDGER: LedgerConfig = Object.freeze({
  totalCapUsd: 25,
  stages: Object.freeze({ smoke: 0.1, pilot: 8, final: 15, contingency: 1.9 }),
});

export interface LedgerEntry {
  id: string;
  stage: string;
  run: string;
  reservedUsd: number;
  /** null while open; then the amount charged (actual or, when unknown, the reservation). */
  chargedUsd: number | null;
  status: "open" | "settled" | "settled-unknown";
  openedAt: string;
  closedAt?: string;
  note?: string;
}
interface LedgerFile {
  version: 1;
  /** The canonical ledger's id, also written in its init marker (M1). Absent in legacy ledgers. */
  ledgerId?: string;
  config: LedgerConfig;
  entries: LedgerEntry[];
}

/** Written once, beside the canonical ledger, when it is initialized (M1). Never removed. */
export interface LedgerMarker {
  ledgerId: string;
  createdAt: string;
  path: string;
  adopted: string[];
}

export class LedgerError extends Error {}

const round = (x: number) => Math.round(x * 1e6) / 1e6;
// Persist charges conservatively at microdollar precision; never round spend down.
const charge = (x: number) => Math.ceil(Number(x.toFixed(12)) * 1e6) / 1e6;

export class SpendLedger {
  private data: LedgerFile;
  private canonicalInfo?: RepoInfo;
  private lockFd: number | undefined;

  private constructor(
    readonly path: string,
    data: LedgerFile,
    lockFd: number,
  ) {
    this.data = data;
    this.lockFd = lockFd;
  }

  /**
   * Open (or create) the ledger. Takes an exclusive lock file so two runs can
   * never spend from it at once; a stale lock must be removed by hand after
   * checking that no run is active.
   */
  static open(path: string, config: LedgerConfig = APPROVED_LEDGER, opts: { create?: boolean; initial?: Pick<LedgerFile, "ledgerId" | "entries"> } = {}): SpendLedger {
    if (!Number.isFinite(config.totalCapUsd) || config.totalCapUsd <= 0 || config.totalCapUsd > APPROVED_LEDGER.totalCapUsd ||
      !config.stages || !Object.entries(config.stages).length || Object.entries(config.stages).some(([stage, cap]) =>
        !Object.hasOwn(APPROVED_LEDGER.stages, stage) || !Number.isFinite(cap) || cap <= 0 || cap > APPROVED_LEDGER.stages[stage]))
      throw new LedgerError("Ledger configuration exceeds the approved allocation.");
    config = structuredClone(config);
    // A ledger that must already exist is checked before anything is created.
    if (opts.create === false && !existsSync(path))
      throw new LedgerError(`No ledger at ${path}; refusing to spend. Initialize it once with \`node --import tsx scripts/midterm/ledger.ts init\` after reviewing the inventory.`);
    mkdirSync(dirname(path), { recursive: true });
    let lockFd: number;
    try {
      lockFd = openSync(`${path}.lock`, "wx");
      writeSync(lockFd, String(process.pid));
    } catch {
      throw new LedgerError(`Ledger is locked (${path}.lock). Another run may be active; refusing to spend.`);
    }
    try {
      let data: LedgerFile;
      if (existsSync(path)) {
        if (opts.initial) throw new LedgerError(`A ledger already exists at ${path}; refusing to overwrite it.`);
        try {
          data = JSON.parse(readFileSync(path, "utf8")) as LedgerFile;
        } catch {
          throw new LedgerError(`Ledger ${path} is unreadable; refusing to spend.`);
        }
        SpendLedger.validate(data);
        if (JSON.stringify(data.config) !== JSON.stringify(config))
          throw new LedgerError("Ledger configuration differs from the approved allocation; refusing to spend.");
      } else if (opts.create === false) {
        throw new LedgerError(`No ledger at ${path}; refusing to spend. Initialize it once with \`node --import tsx scripts/midterm/ledger.ts init\` after reviewing the inventory.`);
      } else {
        data = { version: 1, ...(opts.initial?.ledgerId ? { ledgerId: opts.initial.ledgerId } : {}), config, entries: opts.initial?.entries ?? [] };
        SpendLedger.validate(data);
      }
      const ledger = new SpendLedger(path, data, lockFd);
      ledger.save();
      return ledger;
    } catch (e) {
      closeSync(lockFd);
      unlinkSync(`${path}.lock`);
      throw e;
    }
  }

  private static validate(d: LedgerFile) {
    const ok =
      d &&
      d.version === 1 &&
      d.config &&
      Number.isFinite(d.config.totalCapUsd) &&
      d.config.totalCapUsd > 0 &&
      d.config.stages &&
      Object.values(d.config.stages).every((cap) => Number.isFinite(cap) && cap > 0) &&
      (d.ledgerId === undefined || typeof d.ledgerId === "string") &&
      Array.isArray(d.entries) &&
      d.entries.every(
        (e) =>
          e &&
          typeof e.id === "string" &&
          typeof e.stage === "string" &&
          Object.hasOwn(d.config.stages, e.stage) &&
          typeof e.run === "string" &&
          typeof e.openedAt === "string" &&
          Number.isFinite(e.reservedUsd) &&
          e.reservedUsd > 0 &&
          ["open", "settled", "settled-unknown"].includes(e.status) &&
          (e.status === "open" ? e.chargedUsd === null : Number.isFinite(e.chargedUsd) && e.chargedUsd! >= 0 &&
            (e.status !== "settled-unknown" || e.chargedUsd! >= e.reservedUsd)),
      );
    if (!ok || new Set(d.entries.map((e) => e.id)).size !== d.entries.length) throw new LedgerError("Ledger contents are inconsistent; refusing to spend.");
  }

  /** Spent or held: settled charges plus every open reservation. */
  committed(stage?: string) {
    return round(
      this.data.entries
        .filter((e) => !stage || e.stage === stage)
        .reduce((sum, e) => sum + (e.status === "open" ? e.reservedUsd : e.chargedUsd!), 0),
    );
  }
  remaining(stage?: string) {
    if (stage !== undefined && !Object.hasOwn(this.data.config.stages, stage)) throw new LedgerError(`Unknown stage "${stage}".`);
    const cap = stage !== undefined ? this.data.config.stages[stage] : this.data.config.totalCapUsd;
    if (cap === undefined) throw new LedgerError(`Unknown stage "${stage}".`);
    return round(cap - this.committed(stage));
  }
  entries() {
    return this.data.entries.map((e) => ({ ...e }));
  }
  get ledgerId() {
    return this.data.ledgerId;
  }

  /** Read-only dispatch check: the durable reservation and exclusive lock must still exist. */
  assertReservation(id: string, cap: number, paid = false) {
    if (paid && !this.canonicalInfo) throw new LedgerError("Paid dispatch requires the canonical shared ledger.");
    if (this.canonicalInfo && readMarker(this.canonicalInfo)?.ledgerId !== this.data.ledgerId)
      throw new LedgerError("Canonical ledger initialization marker changed; refusing dispatch.");
    this.assertOpen();
    const disk = JSON.parse(readFileSync(this.path, "utf8")) as LedgerFile;
    SpendLedger.validate(disk);
    if (JSON.stringify(disk) !== JSON.stringify(this.data) || readFileSync(`${this.path}.lock`, "utf8").trim() !== String(process.pid))
      throw new LedgerError("The persistent ledger or its lock changed; refusing dispatch.");
    const entry = disk.entries.find((e) => e.id === id);
    if (!entry || entry.status !== "open" || !Number.isFinite(cap) || cap <= 0 || cap > entry.reservedUsd)
      throw new LedgerError("No adequate open persistent episode reservation; refusing dispatch.");
  }

  /** Hold `usd` for one episode, or throw if the stage or total would be exceeded. */
  reserve(stage: string, run: string, usd: number): string {
    this.assertOpen();
    if (!(usd > 0) || !Number.isFinite(usd)) throw new LedgerError("A reservation must be a positive amount.");
    if (!Object.hasOwn(this.data.config.stages, stage)) throw new LedgerError(`Unknown stage "${stage}".`);
    usd = charge(usd);
    if (usd > this.remaining(stage) + 1e-9)
      throw new LedgerError(`Stage "${stage}" has $${this.remaining(stage).toFixed(4)} left; $${usd} requested.`);
    if (usd > this.remaining() + 1e-9) throw new LedgerError(`The total budget has $${this.remaining().toFixed(4)} left; $${usd} requested.`);
    const id = `${stage}-${this.data.entries.length + 1}`;
    this.data.entries.push({ id, stage, run, reservedUsd: round(usd), chargedUsd: null, status: "open", openedAt: new Date().toISOString() });
    this.save();
    return id;
  }

  /**
   * Close a reservation with the episode's charge. `null` (unknown) charges the
   * whole reservation. A charge above the reservation is recorded as is and
   * flagged; ModelBudget prevents it in normal operation.
   */
  settle(id: string, chargedUsd: number | null, note?: string) {
    this.assertOpen();
    const e = this.data.entries.find((x) => x.id === id);
    if (!e || e.status !== "open") throw new LedgerError(`No open reservation "${id}".`);
    const known = chargedUsd !== null && Number.isFinite(chargedUsd) && chargedUsd >= 0;
    e.chargedUsd = charge(known ? chargedUsd! : e.reservedUsd);
    e.status = known ? "settled" : "settled-unknown";
    e.closedAt = new Date().toISOString();
    const flag = known && chargedUsd! > e.reservedUsd + 1e-9 ? "charge exceeded the reservation" : undefined;
    if (note || flag) e.note = [note, flag].filter(Boolean).join("; ");
    this.save();
  }

  /**
   * Settle an interrupted reservation after review (M4): the amount comes from
   * reconcile() on the episode's verified trace, never below what it found.
   * The note records who reviewed it and the evidence.
   */
  settleReviewed(id: string, r: Reconciliation, reviewedBy: string) {
    if (!reviewedBy.trim()) throw new LedgerError("A reviewed settlement names the reviewer.");
    const e = this.data.entries.find((x) => x.id === id);
    if (!e || e.status !== "open") throw new LedgerError(`No open reservation "${id}".`);
    if (r.entry !== id || r.reservedUsd !== e.reservedUsd) throw new LedgerError("The reconciliation is for another reservation.");
    this.settle(id, r.chargedUsd, `reviewed settlement by ${reviewedBy.trim()}: ${r.basis}${r.evidence ? `; evidence ${r.evidence.path} sha256 ${r.evidence.sha256}` : ""}`);
  }

  /** Release the lock. Idempotent and safe in exit handlers; open reservations stay open (fail closed). */
  close() {
    if (this.lockFd === undefined) return;
    try { closeSync(this.lockFd); } catch { /* already closed */ }
    this.lockFd = undefined;
    try { unlinkSync(`${this.path}.lock`); } catch { /* already removed */ }
  }

  private assertOpen() {
    if (this.lockFd === undefined) throw new LedgerError("Ledger is closed.");
  }

  /** Write atomically (temp file, fsync, rename, directory fsync) so a crash never leaves half a ledger. */
  private save() {
    const tmp = `${this.path}.tmp`;
    const fd = openSync(tmp, "w");
    try {
      writeSync(fd, JSON.stringify(this.data, null, 2));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, this.path);
    try {
      const dir = openSync(dirname(this.path), "r");
      try { fsyncSync(dir); } finally { closeSync(dir); }
    } catch {
      // Some platforms cannot fsync a directory; the rename is still atomic.
    }
  }

  /**
   * The canonical ledger shared by every worktree (review H1). Refuses when it
   * does not exist, and while any legacy per-worktree ledger still exists, so
   * spend recorded elsewhere can never be ignored.
   */
  static openCanonical(info: RepoInfo = repoInfo(), config: LedgerConfig = APPROVED_LEDGER): SpendLedger {
    const legacy = ledgerInventory(info).filter((i) => i.kind === "legacy" && i.exists);
    if (legacy.length)
      throw new LedgerError(`Legacy ledgers exist (${legacy.map((l) => l.path).join(", ")}); migrate them with \`node --import tsx scripts/midterm/ledger.ts init --adopt <path>\` before spending.`);
    const path = canonicalLedgerPath(info);
    const marker = readMarker(info);
    if (!marker && existsSync(path)) throw new LedgerError(`The ledger at ${path} has no initialization marker (${ledgerMarkerPath(info)}); refusing to spend from an unrecorded ledger.`);
    if (marker && !existsSync(path))
      throw new LedgerError(`The canonical ledger ${marker.ledgerId} (initialized ${marker.createdAt}) is missing from ${path}. It is never re-created: restore it from a backup and have the owner review the spend before any paid run.`);
    const ledger = SpendLedger.open(path, config, { create: false });
    if (ledger.ledgerId !== marker!.ledgerId) {
      ledger.close();
      throw new LedgerError(`The ledger at ${path} (id ${ledger.ledgerId ?? "none"}) is not the one initialized on ${marker!.createdAt} (id ${marker!.ledgerId}); refusing to spend.`);
    }
    ledger.canonicalInfo = info;
    return ledger;
  }

  /**
   * Create the canonical ledger once. Refuses if it already exists, if any
   * ledger is locked, or if a legacy ledger exists that is not named in
   * `adopt`. Adopted ledgers are validated, their entries copied (spend and
   * open holds included) and the files renamed so they cannot be reused.
   */
  static initCanonical(info: RepoInfo, opts: { adopt?: string[]; config?: LedgerConfig } = {}): { ledger: SpendLedger; inventory: LedgerInventoryItem[]; adopted: string[] } {
    const config = opts.config ?? APPROVED_LEDGER;
    const inventory = ledgerInventory(info);
    const canonical = inventory.find((i) => i.kind === "canonical")!;
    const prior = readMarker(info);
    if (prior) throw new LedgerError(`The canonical ledger was initialized on ${prior.createdAt} (id ${prior.ledgerId}); it is never re-initialized${canonical.exists ? "" : ", even though it is missing (restore it from a backup)"}.`);
    if (canonical.exists || canonical.locked) throw new LedgerError(`The canonical ledger already exists (${canonical.path}); it is never re-initialized.`);
    const locked = inventory.filter((i) => i.locked);
    if (locked.length) throw new LedgerError(`Ledger locks exist (${locked.map((l) => `${l.path}.lock`).join(", ")}); a run may be active.`);
    const adopt = new Set(opts.adopt ?? []);
    const legacy = inventory.filter((i) => i.kind === "legacy" && i.exists);
    const unnamed = legacy.filter((l) => !adopt.has(l.path));
    if (unnamed.length) throw new LedgerError(`Legacy ledgers must be adopted explicitly: ${unnamed.map((l) => l.path).join(", ")}.`);
    for (const p of adopt) if (!legacy.some((l) => l.path === p)) throw new LedgerError(`${p} is not a legacy ledger of this repository.`);
    // Validate every legacy file before creating anything.
    const legacyEntries = [...adopt].map((p) => {
      let data: LedgerFile;
      try {
        data = JSON.parse(readFileSync(p, "utf8")) as LedgerFile;
      } catch {
        throw new LedgerError(`Legacy ledger ${p} is unreadable; refusing to initialize.`);
      }
      SpendLedger.validate(data);
      if (JSON.stringify(data.config) !== JSON.stringify(config)) throw new LedgerError(`Legacy ledger ${p} has a different allocation; refusing to initialize.`);
      return { path: p, entries: data.entries };
    });
    // Build the adopted entries in memory and check them before anything is
    // written, so a failed adoption never leaves a half-made ledger (M4).
    const entries: LedgerEntry[] = [];
    for (const l of legacyEntries)
      for (const e of l.entries)
        entries.push({ ...e, id: `migrated-${entries.length + 1}-${e.id}`, note: [e.note, `migrated from ${l.path}`].filter(Boolean).join("; ") });
    const committed = (stage?: string) => entries.filter((e) => !stage || e.stage === stage).reduce((a, e) => a + (e.status === "open" ? e.reservedUsd : e.chargedUsd!), 0);
    if (committed() > config.totalCapUsd + 1e-9) throw new LedgerError("Adopted spend exceeds the total cap.");
    for (const [stage, cap] of Object.entries(config.stages)) if (committed(stage) > cap + 1e-9) throw new LedgerError(`Adopted spend exceeds the ${stage} stage cap.`);
    // The marker is written first and never removed: from here on, a missing
    // ledger is refused rather than re-created (M1).
    const ledgerId = randomUUID();
    const markerPath = ledgerMarkerPath(info);
    mkdirSync(dirname(markerPath), { recursive: true });
    const marker: LedgerMarker = { ledgerId, createdAt: new Date().toISOString(), path: canonical.path, adopted: legacyEntries.map((l) => l.path) };
    writeFileSync(markerPath, JSON.stringify(marker, null, 2) + "\n", { flag: "wx" });
    try { chmodSync(markerPath, 0o444); } catch { /* best effort */ }
    const ledger = SpendLedger.open(canonical.path, config, { create: true, initial: { ledgerId, entries } });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    for (const l of legacyEntries) renameSync(l.path, `${l.path}.migrated-${stamp}`);
    ledger.canonicalInfo = info;
    return { ledger, inventory, adopted: legacyEntries.map((l) => l.path) };
  }
}

/** The canonical ledger's init marker, or null if it was never initialized. */
export function readMarker(info: Pick<RepoInfo, "commonDir">): LedgerMarker | null {
  const path = ledgerMarkerPath(info);
  if (!existsSync(path)) return null;
  try {
    const m = JSON.parse(readFileSync(path, "utf8")) as LedgerMarker;
    if (typeof m.ledgerId !== "string" || typeof m.createdAt !== "string") throw Error();
    return m;
  } catch {
    throw new LedgerError(`The ledger marker ${path} is unreadable; refusing to spend.`);
  }
}

export interface Reconciliation {
  entry: string;
  reservedUsd: number;
  chargedUsd: number;
  basis: string;
  evidence: { path: string; sha256: string } | null;
  calls: { recorded: number; startedWithoutRecord: number };
}

/**
 * What an interrupted episode must be charged, from its trace (M4). Never
 * refunds uncertainty:
 *   - a missing, unreadable or unverifiable trace, or one that does not name
 *     this reservation, is charged the whole reservation;
 *   - otherwise the charge is every recorded call's charge plus the whole
 *     hold of every call that started (model_call_start) without a record.
 * A trailing line cut off mid-write is dropped; a call it might have
 * recorded then counts as started without a record.
 */
export function reconcile(entry: Pick<LedgerEntry, "id" | "reservedUsd" | "run">, trace: { path: string; text: string } | null): Reconciliation {
  const full = (basis: string, evidence: Reconciliation["evidence"] = null): Reconciliation =>
    ({ entry: entry.id, reservedUsd: entry.reservedUsd, chargedUsd: entry.reservedUsd, basis: `whole reservation: ${basis}`, evidence, calls: { recorded: 0, startedWithoutRecord: 0 } });
  if (!trace) return full("no trace was given");
  const evidence = { path: trace.path, sha256: createHash("sha256").update(trace.text).digest("hex") };
  const raw = trace.text.split("\n");
  if (raw.at(-1) === "") raw.pop();
  let lines: TraceLine[];
  try {
    lines = raw.map((l, i) => {
      try {
        return JSON.parse(l) as TraceLine;
      } catch (e) {
        if (i === raw.length - 1 && !trace.text.endsWith("\n")) return null;
        throw e;
      }
    }).filter((l): l is TraceLine => l !== null);
    verifyTrace(lines);
  } catch {
    return full("the trace is unreadable or its hash chain does not verify", evidence);
  }
  const res = lines.find((l) => l.type === "ledger_reservation")?.data as { entry?: string; run?: string } | undefined;
  if (!res || res.entry !== entry.id || res.run !== entry.run) return full("the trace does not name this reservation", evidence);
  const key = (d: { player?: string; attempt?: number }) => `${d.player}/${d.attempt}`;
  const recorded = new Map<string, number>();
  for (const l of lines.filter((l) => l.type === "model_call")) {
    const d = l.data as { player?: string; attempt?: number; chargedUsd?: number };
    if (!Number.isFinite(d.chargedUsd) || d.chargedUsd! < 0) return full("a call record has no valid charge", evidence);
    recorded.set(key(d), d.chargedUsd!);
  }
  let started = 0, held = 0;
  for (const l of lines.filter((l) => l.type === "model_call_start")) {
    const d = l.data as { player?: string; attempt?: number; reservedUsd?: number };
    if (recorded.has(key(d))) continue;
    if (!Number.isFinite(d.reservedUsd) || d.reservedUsd! < 0) return full("a started call has no valid hold", evidence);
    started++;
    held += d.reservedUsd!;
  }
  const charged = [...recorded.values()].reduce((a, b) => a + b, 0) + held;
  return {
    entry: entry.id, reservedUsd: entry.reservedUsd, chargedUsd: Math.ceil(Number(charged.toFixed(12)) * 1e6) / 1e6,
    basis: `${recorded.size} recorded call(s) at their charges, ${started} call(s) started without a record at their whole hold`,
    evidence, calls: { recorded: recorded.size, startedWithoutRecord: started },
  };
}

/** A lock left by a process that is no longer running (M4), or why it cannot be treated as stale. */
export function staleLock(path: string): { pid: number } | { refused: string } {
  const lock = `${path}.lock`;
  if (!existsSync(lock)) return { refused: "there is no lock" };
  const pid = Number(readFileSync(lock, "utf8").trim());
  if (!Number.isSafeInteger(pid) || pid <= 0) return { refused: "the lock does not name a process id" };
  if (pid === process.pid) return { refused: "the lock is held by this process" };
  try {
    process.kill(pid, 0);
    return { refused: `process ${pid} is still running` };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EPERM") return { refused: `process ${pid} exists (owned by another user)` };
    return { pid };
  }
}

/** Remove a stale lock after staleLock() found its process gone (scripts/midterm/ledger.ts asks first). */
export function removeStaleLock(path: string, pid: number) {
  const s = staleLock(path);
  if (!("pid" in s) || s.pid !== pid) throw new LedgerError(`The lock is not the stale lock of process ${pid}: ${"refused" in s ? s.refused : `it names ${s.pid}`}.`);
  unlinkSync(`${path}.lock`);
}

/** For tests: write a raw ledger file. */
export function writeRawLedger(path: string, contents: string) {
  writeFileSync(path, contents);
}
