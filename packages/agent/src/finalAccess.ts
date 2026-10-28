// Held-out access control (review H2). S4, F and the final seeds are played by
// a player only inside an owner-approved final run:
//
//   - The owner records an approval with scripts/midterm/final-approve.ts. It
//     names one full commit hash, one player kind, the stage, and the exact
//     scenarios and seeds.
//   - authorizeFinalRun() is the only way to obtain a grant (re-review H2-a:
//     the constructor needs a module-private token). It issues one only when
//     HEAD equals that commit and the worktree is clean (checked from this
//     code's own worktree, repo.ts).
//   - Each final episode is claimed in an append-only, hash-chained register
//     before anything runs (once per approval). The claim returns a
//     single-use EpisodeTicket for that scenario, seed and player kind.
//   - runEpisode() binds the ticket to the policies it was given, refusing any
//     other player kind; AgentEnvironment.reset() admits a held-out or
//     final-seed episode only with a bound, unused ticket, and uses it up
//     (re-review H2-b). Alternate runners and hand-written loops reach the
//     same reset, so they cannot play held-out episodes either.
//   - Route development (the scripted route, checkpoint tests) uses a
//     separate, explicitly named RouteDevelopmentAccess. runEpisode() refuses
//     it, so it can never run a player or produce an evaluation result; at a
//     final seed it allows reset only (the start state), never a step.
//
// The register lives in the git common directory next to the spend ledger.
// Limits: code running in the same process can still call these functions
// deliberately (for example bind a real ticket and then drive other policies
// by hand); every such path needs a recorded owner approval and leaves a claim
// in the register. A process with shell access could still write the register
// through this module; the hash chain makes edits evident, not impossible.
// Truncating the newest lines is not detected by the chain alone; summaries
// record their claim hash so a missing claim can be noticed.

import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { evalStateDir, repoInfo, type RepoInfo } from "./repo.js";
import { SEEDS, SITUATIONS, type SituationId } from "./suite.js";

import { PLAYER_KINDS, type PlayerKind } from "./playerKinds.js";

export type FinalPlayerKind = PlayerKind;
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

const heldOutIds = () => new Set(SITUATIONS.filter((s) => s.heldOut).map((s) => s.id));

function checkApproval(a: FinalApproval) {
  if (!/^[0-9a-f]{40}$/.test(a.revision)) throw new FinalAccessError("An approval names one full 40-character commit hash.");
  if (!PLAYER_KINDS.includes(a.player)) throw new FinalAccessError(`Unknown player ${a.player}.`);
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

// Module-private: only this file can construct grants, tickets and route
// development access. The WeakSets reject look-alike objects.
const ISSUE = Symbol("finalAccess.issue");
const grants = new WeakSet<FinalGrant>();
/** Ticket state lives here, out of reach of callers: a used ticket can never be revived. */
const ticketState = new WeakMap<EpisodeTicket, TicketState>();
const routeAccess = new WeakSet<RouteDevelopmentAccess>();

type TicketState = "claimed" | "bound" | "used" | "finished";

function transition(t: EpisodeTicket, from: TicketState[], to: TicketState, what: string) {
  const state = ticketState.get(t);
  if (!state || !from.includes(state)) throw new FinalAccessError(`The ticket for ${t.situation} seed ${t.seed} is ${state ?? "unknown"}; it cannot be ${what}.`);
  ticketState.set(t, to);
}

const freezeApproval = (a: FinalApproval): Readonly<FinalApproval> =>
  Object.freeze({ ...a, situations: Object.freeze([...a.situations]) as SituationId[], seeds: Object.freeze([...a.seeds]) as number[] });


/**
 * One claimed final episode: a scenario, a seed and the approved player kind.
 * Single use: bound by runEpisode() to policies of that kind, used up by
 * AgentEnvironment.reset(), closed by FinalGrant.finish().
 */
export class EpisodeTicket {
  readonly claim: string;
  readonly player: FinalPlayerKind;
  readonly situation: SituationId;
  readonly seed: number;
  readonly grant: FinalGrant;
  constructor(token: symbol, grant: FinalGrant, claim: string, situation: SituationId, seed: number) {
    if (token !== ISSUE) throw new FinalAccessError("Episode tickets are issued only by FinalGrant.claim().");
    this.grant = grant;
    this.claim = claim;
    this.player = grant.approval.player;
    this.situation = situation;
    this.seed = seed;
    ticketState.set(this, "claimed");
    Object.freeze(this);
  }
  get state(): TicketState {
    return ticketState.get(this)!;
  }
}

export function isTicket(t: unknown): t is EpisodeTicket {
  return typeof t === "object" && t !== null && ticketState.has(t as EpisodeTicket);
}

/** Proof that a final run was authorized for this revision. Only authorizeFinalRun() makes one. */
export class FinalGrant {
  readonly #claimed = new Set<string>();
  readonly info: RepoInfo;
  readonly approvalHash: string;
  readonly approval: Readonly<FinalApproval>;
  constructor(token: symbol, info: RepoInfo, approvalHash: string, approval: FinalApproval) {
    if (token !== ISSUE) throw new FinalAccessError("Final grants are issued only by authorizeFinalRun() from a recorded owner approval.");
    this.info = Object.freeze({ ...info });
    this.approvalHash = approvalHash;
    this.approval = freezeApproval(approval);
    grants.add(this);
    Object.freeze(this);
  }

  covers(player: string, situation: SituationId, seed: number, stage?: string) {
    return player === this.approval.player && this.approval.situations.includes(situation) && this.approval.seeds.includes(seed) &&
      (stage === undefined || stage === this.approval.stage);
  }

  /**
   * Claim one episode in the register before it starts. Re-checks HEAD and a
   * clean tree. Each (scenario, seed) may be claimed once per approval; a
   * contingency re-run needs a new approval. Returns the single-use ticket.
   */
  claim(player: string, situation: SituationId, seed: number, attempt: number): EpisodeTicket {
    if (!isGrant(this)) throw new FinalAccessError("Not an issued grant.");
    if (!this.covers(player, situation, seed)) throw new FinalAccessError(`The approval does not cover ${player} ${situation} seed ${seed}.`);
    const key = `${situation}/${seed}`;
    if (this.#claimed.has(key)) throw new FinalAccessError(`${situation} seed ${seed} was already claimed under this approval.`);
    assertRevision(this.info, this.approval.revision);
    const path = registerPath(this.info);
    const prior = readRegister(path).find((l) => l.data.event === "claim" && l.data.approval === this.approvalHash && l.data.situation === situation && l.data.seed === seed);
    if (prior) throw new FinalAccessError(`${situation} seed ${seed} was already claimed under this approval (register line ${prior.seq + 1}).`);
    const line = append(path, { event: "claim", approval: this.approvalHash, revision: this.approval.revision, player: this.approval.player, situation, seed, attempt });
    this.#claimed.add(key);
    return new EpisodeTicket(ISSUE, this, line.hash, situation, seed);
  }

  /** Close a claimed episode in the register; the ticket can never be used again. */
  finish(ticket: EpisodeTicket, result: { status: string; reason: string | null; endHash: string | null; chargedUsd: number | null }) {
    if (!isTicket(ticket) || ticket.grant !== this) throw new FinalAccessError("Not a ticket of this grant.");
    transition(ticket, ["claimed", "bound", "used"], "finished", "finished");
    return append(registerPath(this.info), { event: "finish", claim: ticket.claim, ...result });
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
  const { event: _e, ...approval } = match.data as FinalApproval & { event: "approve" };
  return new FinalGrant(ISSUE, now, match.hash, approval);
}

/**
 * The runner's binding (H2-a): the ticket must be unused and name exactly the
 * player kind of the policies about to play. Called by runEpisode() only.
 */
export function bindTicket(ticket: unknown, kind: FinalPlayerKind | null) {
  if (!isTicket(ticket)) throw new FinalAccessError("Not an issued episode ticket.");
  if (kind !== ticket.player) throw new FinalAccessError(`The ticket is for ${ticket.player}, but these policies are ${kind ?? "not an approved player kind"}.`);
  transition(ticket, ["claimed"], "bound", "bound to a run");
}

/**
 * Explicit, labelled access for route development: the scripted route and
 * checkpoint tests may build held-out start states and (at tuning seeds) play
 * the scripted route. Never accepted by runEpisode(), so it cannot run a
 * player or authorize a final evaluation. Every reset it admits is labelled
 * in the trace.
 */
export class RouteDevelopmentAccess {
  readonly purpose: string;
  constructor(token: symbol, purpose: string) {
    if (token !== ISSUE) throw new FinalAccessError("Use routeDevelopmentAccess(purpose).");
    this.purpose = purpose;
    routeAccess.add(this);
    Object.freeze(this);
  }
}

export function routeDevelopmentAccess(purpose: string) {
  if (typeof purpose !== "string" || purpose.trim().length < 8) throw new FinalAccessError("Route development access names its purpose.");
  return new RouteDevelopmentAccess(ISSUE, purpose.trim());
}

export function isRouteDevelopmentAccess(a: unknown): a is RouteDevelopmentAccess {
  return typeof a === "object" && a !== null && routeAccess.has(a as RouteDevelopmentAccess);
}

/** Does playing this scenario and seed need a final ticket? */
export function needsFinalGrant(scenario: { situation: SituationId | null; prefix: string | null }, seed: number) {
  if (SEEDS.final.includes(seed)) return true;
  if (scenario.situation && heldOutIds().has(scenario.situation)) return true;
  const heldOutPrefixes = SITUATIONS.filter((s) => s.heldOut && s.prefix).map((s) => s.prefix!.name);
  return scenario.prefix !== null && heldOutPrefixes.includes(scenario.prefix);
}

const PRESET_TO_SITUATION: Record<string, SituationId> = { "S2-local": "S2-local", "S3-local": "S3-local", S1: "S1", S2: "S2", S3: "S3", S4: "S4", full: "F" };

export type Admission =
  | { kind: "open" }
  | { kind: "final"; claim: string; player: FinalPlayerKind }
  | { kind: "route-development"; purpose: string; resetOnly: boolean };

/**
 * The environment's gate (H2-b), run at the top of every reset before
 * anything is created. A held-out or final-seed episode needs a bound,
 * unused ticket for exactly this suite scenario and seed (used up here), or
 * route development access (reset only at a final seed).
 */
export function admitReset(
  scenario: { preset: string; prefix: string | null },
  seed: number,
  access: { ticket?: unknown; routeDevelopment?: unknown },
): Admission {
  const situation = PRESET_TO_SITUATION[scenario.preset] ?? null;
  const what = `${situation ?? scenario.preset}${scenario.prefix ? ` (prefix: ${scenario.prefix})` : ""} seed ${seed}`;
  if (access.routeDevelopment !== undefined && !isRouteDevelopmentAccess(access.routeDevelopment)) throw new FinalAccessError("Invalid route development access.");
  if (access.ticket !== undefined && access.routeDevelopment !== undefined) throw new FinalAccessError("A final ticket and route development access cannot be combined.");
  if (!needsFinalGrant({ situation, prefix: scenario.prefix }, seed)) {
    if (access.ticket !== undefined) throw new FinalAccessError(`${what} is not held out; final tickets are only for held-out or final-seed episodes.`);
    return access.routeDevelopment ? { kind: "route-development", purpose: (access.routeDevelopment as RouteDevelopmentAccess).purpose, resetOnly: false } : { kind: "open" };
  }
  if (isRouteDevelopmentAccess(access.routeDevelopment))
    return { kind: "route-development", purpose: access.routeDevelopment.purpose, resetOnly: SEEDS.final.includes(seed) };
  const ticket = access.ticket;
  if (!isTicket(ticket)) throw new FinalAccessError(`${what} is held out or uses a final seed: it runs only in an owner-approved final run (scripts/midterm/evaluate.ts --final).`);
  const expected = situation ? SITUATIONS.find((s) => s.id === situation)?.prefix?.name ?? null : undefined;
  if (!situation || scenario.prefix !== expected) throw new FinalAccessError(`${what} is not a suite scenario; refusing.`);
  if (ticket.situation !== situation || ticket.seed !== seed) throw new FinalAccessError(`The ticket is for ${ticket.situation} seed ${ticket.seed}, not ${what}.`);
  transition(ticket, ["bound"], "used", "used for a reset (bind it in runEpisode first; a ticket admits one reset)");
  return { kind: "final", claim: ticket.claim, player: ticket.player };
}
