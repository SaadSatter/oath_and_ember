// What the live launcher does on Ctrl-C (SIGINT), SIGTERM or SIGHUP
// (scripts/midterm/live.ts; docs/midterm/LIVE_RUN.md). Kept as a pure
// function so every phase is tested.
//
// In the S2 seed 0 OpenAI run (2026-10-28) a signal after the episode had
// ended only closed the viewer's linger wait. While the video was being
// finalized nothing could stop the launcher, and it had to be killed, which
// skipped its exit handler and left recording.json saying "recording".
// Now the second signal always exits, in every phase.

export type LaunchPhase = "setup" | "running" | "finished";
export type SignalAction =
  /** Before the episode: exit at once; nothing is reserved yet. */
  | "exit-now"
  /** First signal during the episode: end it (manual_stop) and save its records. */
  | "stop-episode"
  /** First signal after the episode: cut the remaining waits short (video end, linger). */
  | "finish-now"
  /** Any later signal: exit at once; the exit handler marks an unfinished video as not saved. */
  | "force-exit";

/** The action for a signal, given the phase and how many signals came before it. */
export function signalAction(phase: LaunchPhase, earlierSignals: number): SignalAction {
  if (phase === "setup") return "exit-now";
  if (earlierSignals > 0) return "force-exit";
  return phase === "running" ? "stop-episode" : "finish-now";
}
