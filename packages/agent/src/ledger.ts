// Persistent spend ledger for paid model runs (owner decision 2026-10-27):
// claude-haiku-5-5 with a $25 total hard cap split into stages. It fails closed:
//   - every episode reserves its whole per-episode cap on disk before it starts;
//   - open reservations count as spent until settled (so a crash leaves money held);
//   - a settled episode whose spend is unknown is charged its whole reservation;
//   - an unreadable, inconsistent or locked ledger refuses all reservations.
// Within an episode, ModelBudget (budget.ts) enforces the same cap per call,
// including reservations for calls in flight.

import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync, writeSync } from "node:fs";

import { dirname } from "node:path";

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
  config: LedgerConfig;
  entries: LedgerEntry[];
}

export class LedgerError extends Error {}

const round = (x: number) => Math.round(x * 1e6) / 1e6;
// Persist charges conservatively at microdollar precision; never round spend down.
const charge = (x: number) => Math.ceil(Number(x.toFixed(12)) * 1e6) / 1e6;

export class SpendLedger {
  private data: LedgerFile;
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
  static open(path: string, config: LedgerConfig = APPROVED_LEDGER): SpendLedger {
    if (!Number.isFinite(config.totalCapUsd) || config.totalCapUsd <= 0 || config.totalCapUsd > APPROVED_LEDGER.totalCapUsd ||
      !config.stages || !Object.entries(config.stages).length || Object.entries(config.stages).some(([stage, cap]) =>
        !Object.hasOwn(APPROVED_LEDGER.stages, stage) || !Number.isFinite(cap) || cap <= 0 || cap > APPROVED_LEDGER.stages[stage]))
      throw new LedgerError("Ledger configuration exceeds the approved allocation.");
    config = structuredClone(config);
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
        try {
          data = JSON.parse(readFileSync(path, "utf8")) as LedgerFile;
        } catch {
          throw new LedgerError(`Ledger ${path} is unreadable; refusing to spend.`);
        }
        SpendLedger.validate(data);
        if (JSON.stringify(data.config) !== JSON.stringify(config))
          throw new LedgerError("Ledger configuration differs from the approved allocation; refusing to spend.");
      } else {
        data = { version: 1, config, entries: [] };
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

  close() {
    if (this.lockFd === undefined) return;
    closeSync(this.lockFd);
    this.lockFd = undefined;
    unlinkSync(`${this.path}.lock`);
  }

  private assertOpen() {
    if (this.lockFd === undefined) throw new LedgerError("Ledger is closed.");
  }

  /** Write atomically (temp file, fsync, rename) so a crash never leaves half a ledger. */
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
  }
}

/** For tests: write a raw ledger file. */
export function writeRawLedger(path: string, contents: string) {
  writeFileSync(path, contents);
}
