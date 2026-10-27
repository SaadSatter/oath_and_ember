// Held-out access control (review H2). S4, F and the final seeds are played by
// a player only inside an owner-approved final run:
//
//   - The owner records an approval with scripts/midterm/final-approve.ts. It
//     names one full commit hash, one player kind, the stage, and the exact
//     scenarios and seeds.
//   - authorizeFinalRun() issues a grant only when HEAD equals that commit and
//     the worktree is clean (checked from this code's own worktree, repo.ts).
//   - Each final episode is claimed in an append-only, hash-chained register
//     before anything runs (once per approval), and finished afterwards.
//   - runEpisode() refuses held-out or final-seed episodes without a claimed
//     grant, so alternate entrypoints cannot play them either.
//
// The register lives in the git common directory next to the spend ledger.
// Limits: a process with shell access could still write the register through
// this module; the hash chain makes edits evident, not impossible. Truncating
// the newest lines is not detected by the chain alone.

import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { evalStateDir, repoInfo, type RepoInfo } from "./repo.js";
import { SEEDS, SITUATIONS, type SituationId } from "./suite.js";

export type FinalPlayerKind = "baseline-quest" | "baseline-explore" | "model-history" | "model-obs-only";
export type FinalStage = "final" | "contingency";

export interface FinalApproval {
  revision: string;
  player: FinalPlayerKind;
  stage: FinalStage;
  situations: SituationId[];
  seeds: number[];
  approvedBy: string;
  note?: string;
}

type Event =
  | ({ event: "approve" } & FinalApproval)
  | { event: "claim"; approval: string; revision: string; player: FinalPlayerKind; situation: SituationId; seed: number; attempt: number }
  | { event: "finish"; claim: string; status: string; reason: string | null; endHash: string | null; chargedUsd: number | null };

export interface RegisterLine {
  seq: number;
  at: string;
  prev: string;
  hash: string;
  data: Event;
}

export class FinalAccessError extends Error {}

const GENESIS = "0".repeat(64);
const digest = (prev: string, seq: number, at: string, data: Event) =>
  createHash("sha256").update(JSON.stringify({ prev, seq, at, data })).digest("hex");

export function registerPath(info: Pick<RepoInfo, "commonDir"> = repoInfo()) {
  return join(evalStateDir(info), "final-register.jsonl");
}

/** Read and verify the whole register; any edit, reorder or bad line refuses. */
export function readRegister(path: string): RegisterLine[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  if (text && !text.endsWith("\n")) throw new FinalAccessError(`Final register ${path} ends mid-line; refusing.`);
  const lines = text.split("\n").filter(Boolean).map((l, i) => {
    try {
      return JSON.parse(l) as RegisterLine;
    } catch {
      throw new FinalAccessError(`Final register line ${i + 1} is unreadable; refusing.`);
    }
  });
  let prev = GENESIS;
  lines.forEach((l, i) => {
    if (l.seq !== i || l.prev !== prev || l.hash !== digest(l.prev, l.seq, l.at, l.data))
      throw new FinalAccessError(`Final register hash chain is broken at line ${i + 1}; refusing.`);
    prev = l.hash;
  });
  return lines;
}

/** Append one event under an exclusive lock, after re-verifying the chain. */
function append(path: string, data: Event): RegisterLine {
  mkdirSync(dirname(path), { recursive: true });
  let lock: number;
  try {
    lock = openSync(`${path}.lock`, "wx");
  } catch {
    throw new FinalAccessError(`Final register is locked (${path}.lock); refusing.`);
  }
  try {
    const lines = readRegister(path);
    const seq = lines.length, prev = lines.at(-1)?.hash ?? GENESIS, at = new Date().toISOString();
    const line: RegisterLine = { seq, at, prev, hash: digest(prev, seq, at, data), data };
    const fd = openSync(path, "a");
    try {
      writeSync(fd, JSON.stringify(line) + "\n");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    return line;
  } finally {
    closeSync(lock);
    unlinkSync(`${path}.lock`);
  }
}

const HELD_OUT = new Set(SITUATIONS.filter((s) => s.heldOut).map((s) => s.id));

function checkApproval(a: FinalApproval) {
  if (!/^[0-9a-f]{40}$/.test(a.revision)) throw new FinalAccessError("An approval names one full 40-character commit hash.");
  if (!["baseline-quest", "baseline-explore", "model-history", "model-obs-only"].includes(a.player)) throw new FinalAccessError(`Unknown player ${a.player}.`);
  if (!["final", "contingency"].includes(a.stage)) throw new FinalAccessError("An approval's stage is final or contingency.");
  if (!a.situations.length || a.situations.some((s) => !SITUATIONS.some((x) => x.id === s))) throw new FinalAccessError("An approval names known scenarios.");
  if (!a.seeds.length || a.seeds.some((s) => !SEEDS.final.includes(s))) throw new FinalAccessError(`Final runs use seeds ${SEEDS.final.join(", ")} only.`);
  if (!a.approvedBy.trim()) throw new FinalAccessError("An approval names who approved it.");
}

/** Record the owner's approval (scripts/midterm/final-approve.ts asks for a typed confirmation first). */
export function recordApproval(info: RepoInfo, approval: FinalApproval) {
  checkApproval(approval);
  return append(registerPath(info), { event: "approve", ...approval });
}

const grants = new WeakSet<FinalGrant>();

/** Proof that a final run was authorized for this revision. Only authorizeFinalRun() makes one. */
export class FinalGrant {
  private readonly claimed = new Map<string, string>();
  private constructor(
    readonly info: RepoInfo,
    readonly approvalHash: string,
    readonly approval: FinalApproval,
  ) {}

  /** @internal */
  static issue(info: RepoInfo, hash: string, approval: FinalApproval) {
    const g = new FinalGrant(info, hash, approval);
    grants.add(g);
    return g;
  }

  covers(player: string, situation: SituationId, seed: number, stage?: string) {
    return player === this.approval.player && this.approval.situations.includes(situation) && this.approval.seeds.includes(seed) &&
      (stage === undefined || stage === this.approval.stage);
  }

  /**
   * Claim one episode in the register before it starts. Re-checks HEAD and a
   * clean tree. Each (scenario, seed) may be claimed once per approval; a
   * contingency re-run needs a new approval.
   */
  claim(player: string, situation: SituationId, seed: number, attempt: number): string {
    if (!this.covers(player, situation, seed)) throw new FinalAccessError(`The approval does not cover ${player} ${situation} seed ${seed}.`);
    assertRevision(this.info, this.approval.revision);
    const path = registerPath(this.info);
    const prior = readRegister(path).find((l) => l.data.event === "claim" && l.data.approval === this.approvalHash && l.data.situation === situation && l.data.seed === seed);
    if (prior) throw new FinalAccessError(`${situation} seed ${seed} was already claimed under this approval (register line ${prior.seq + 1}).`);
    const line = append(path, { event: "claim", approval: this.approvalHash, revision: this.approval.revision, player: this.approval.player, situation, seed, attempt });
    this.claimed.set(`${situation}/${seed}`, line.hash);
    return line.hash;
  }

  finish(claim: string, result: { status: string; reason: string | null; endHash: string | null; chargedUsd: number | null }) {
    return append(registerPath(this.info), { event: "finish", claim, ...result });
  }

  hasClaim(situation: SituationId, seed: number) {
    return this.claimed.has(`${situation}/${seed}`);
  }
}

export function isGrant(g: unknown): g is FinalGrant {
  return typeof g === "object" && g !== null && grants.has(g as FinalGrant);
}

function assertRevision(info: RepoInfo, revision: string) {
  const now = repoInfo(info.root);
  if (now.dirty) throw new FinalAccessError("Final runs need a clean worktree.");
  if (now.head !== revision) throw new FinalAccessError(`HEAD is ${now.head.slice(0, 12)}, but the approval is for ${revision.slice(0, 12)}.`);
}

/**
 * Issue a grant for a planned final run: the latest matching approval for the
 * current, clean HEAD that covers every requested scenario and seed.
 */
export function authorizeFinalRun(plan: { player: string; stage: string; situations: SituationId[]; seeds: number[] }, info: RepoInfo = repoInfo()): FinalGrant {
  const now = repoInfo(info.root);
  if (now.dirty) throw new FinalAccessError("Final runs need a clean worktree.");
  const lines = readRegister(registerPath(now));
  const match = [...lines].reverse().find((l) => {
    const d = l.data;
    return d.event === "approve" && d.revision === now.head && d.player === plan.player && d.stage === plan.stage &&
      plan.situations.every((s) => d.situations.includes(s)) && plan.seeds.every((s) => d.seeds.includes(s));
  });
  if (!match) throw new FinalAccessError(`No owner approval in ${registerPath(now)} covers ${plan.player} ${plan.situations.join(",")} seeds ${plan.seeds.join(",")} (${plan.stage}) at ${now.head.slice(0, 12)}.`);
  return FinalGrant.issue(now, match.hash, match.data as FinalApproval & { event: "approve" });
}

/** Does playing this environment need a final grant? */
export function needsFinalGrant(scenario: { situation: SituationId | null; prefix: string | null }, seed: number) {
  if (SEEDS.final.includes(seed)) return true;
  if (scenario.situation && HELD_OUT.has(scenario.situation)) return true;
  const heldOutPrefixes = SITUATIONS.filter((s) => s.heldOut && s.prefix).map((s) => s.prefix!.name);
  return scenario.prefix !== null && heldOutPrefixes.includes(scenario.prefix);
}

const PRESET_TO_SITUATION: Record<string, SituationId> = { S1: "S1", S2: "S2", S3: "S3", S4: "S4", full: "F" };

/**
 * The runner's gate: a held-out or final-seed episode needs a grant that has
 * claimed exactly this suite scenario and seed. Throws before anything runs.
 */
export function assertEpisodeAccess(scenario: { preset: string; prefix: string | null }, seed: number, grant: unknown) {
  const situation = PRESET_TO_SITUATION[scenario.preset] ?? null;
  if (!needsFinalGrant({ situation, prefix: scenario.prefix }, seed)) return;
  const what = `${situation ?? scenario.preset}${scenario.prefix ? ` (prefix: ${scenario.prefix})` : ""} seed ${seed}`;
  if (!isGrant(grant)) throw new FinalAccessError(`${what} is held out or uses a final seed: it runs only in an owner-approved final run (scripts/midterm/evaluate.ts --final).`);
  const expected = situation ? SITUATIONS.find((s) => s.id === situation)?.prefix?.name ?? null : undefined;
  if (!situation || scenario.prefix !== expected) throw new FinalAccessError(`${what} is not a suite scenario; refusing.`);
  if (!grant.hasClaim(situation, seed)) throw new FinalAccessError(`${what} was not claimed in the final register; refusing.`);
}
