import { createHash } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (k) =>
        `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
    )
    .join(",")}}`;
}
export const hash = (value: unknown): string =>
  createHash("sha256").update(canonical(value)).digest("hex");
export type TraceKind =
  | "reset"
  | "observe"
  | "legal"
  | "step"
  | "validation"
  | "message"
  | "model"
  | "terminal"
  | "error"
  | "effective";
export interface TraceEvent {
  sequence: number;
  kind: TraceKind;
  payload: unknown;
  previous: string;
  hash: string;
}
/** Evaluator-side only; never provide this writer, path or transcript to a player. */
export class TraceWriter {
  private sequence = 0;
  private previous = "0".repeat(64);
  private terminal = false;
  constructor(private readonly path: string) {
    writeFileSync(path, "", { flag: "wx" });
  }
  append(kind: TraceKind, payload: unknown): TraceEvent {
    if (this.terminal) throw new Error("Trace already terminal");
    const body = {
      sequence: this.sequence++,
      kind,
      payload,
      previous: this.previous,
    };
    const event = { ...body, hash: hash(body) };
    appendFileSync(this.path, `${JSON.stringify(event)}\n`);
    this.previous = event.hash;
    this.terminal = kind === "terminal";
    return event;
  }
}
export function verifyTrace(events: readonly TraceEvent[]): void {
  let previous = "0".repeat(64);
  events.forEach((event, sequence) => {
    const { hash: digest, ...body } = event;
    if (
      event.sequence !== sequence ||
      event.previous !== previous ||
      hash(body) !== digest
    )
      throw new Error("Trace integrity failure");
    if (sequence < events.length - 1 && event.kind === "terminal")
      throw new Error("Event after terminal");
    previous = digest;
  });
  if (events[0]?.kind !== "reset" || events.at(-1)?.kind !== "terminal")
    throw new Error("Incomplete trace");
}
