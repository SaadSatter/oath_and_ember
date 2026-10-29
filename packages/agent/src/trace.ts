// Evaluator trace: one JSON object per line, each linked to the previous by
// a SHA-256 hash so edits or gaps are detectable. Traces hold privileged
// evaluator data (milestones, state hashes) and are never shown to players.

import { createHash } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";

export interface TraceLine {
  seq: number;
  type: string;
  tick: number;
  player?: string;
  wallMs: number;
  data: unknown;
  prev: string;
  hash: string;
}

const digest = (body: unknown) =>
  createHash("sha256").update(JSON.stringify(body)).digest("hex");

export class TraceWriter {
  private seq = 0;
  private prev = "0".repeat(64);
  private readonly started = Date.now();
  readonly lines: TraceLine[] = [];
  constructor(
    private readonly path?: string,
    /** Trusted observer of each line after it is written (live terminal status). */
    private readonly onLine?: (line: TraceLine) => void,
  ) {
    if (path) writeFileSync(path, "", { flag: "wx" });
  }
  write(event: { type: string; tick: number; player?: string; data: unknown }) {
    const body = { seq: this.seq++, ...event, wallMs: Date.now() - this.started, prev: this.prev };
    const line = { ...body, hash: digest(body) } as TraceLine;
    this.prev = line.hash;
    this.lines.push(line);
    if (this.path) appendFileSync(this.path, `${JSON.stringify(line)}\n`);
    this.onLine?.(line);
  }
}

export function verifyTrace(lines: TraceLine[]) {
  let prev = "0".repeat(64);
  lines.forEach((line, i) => {
    const { hash, ...body } = line;
    if (line.seq !== i || line.prev !== prev || digest(body) !== hash)
      throw Error(`Trace integrity failure at line ${i}`);
    prev = hash;
  });
}
