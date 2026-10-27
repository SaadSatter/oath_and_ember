import { hash, verifyTrace, type TraceEvent } from "./trace.js";
/** Replay only recorded effective intents; callback owns the real engine and clock. */
export async function replay(
  events: readonly TraceEvent[],
  apply: (
    payload: unknown,
  ) => Promise<{ state: unknown; observations: unknown }>,
): Promise<void> {
  verifyTrace(events);
  for (const event of events) {
    if (event.kind !== "effective") continue;
    const payload = event.payload as {
      intents: unknown;
      stateHash: string;
      observationHash: string;
    };
    const actual = await apply(payload.intents);
    if (
      hash(actual.state) !== payload.stateHash ||
      hash(actual.observations) !== payload.observationHash
    )
      throw new Error(`Replay mismatch at ${event.sequence}`);
  }
}
