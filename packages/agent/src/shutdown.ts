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

/**
 * Signals closer together than this count as one shutdown request.
 *
 * One Ctrl-C under `npm run eval:live` reaches the launcher twice: the
 * terminal signals the whole foreground process group, and npm relays the
 * signal to its child as well. Reproduced 2026-10-28 with a process-group
 * SIGINT to a recorded mock run: without this window the relay counted as a
 * second press, forced an exit and lost the video. With plain `node` the
 * same SIGINT counted once.
 */
export const DUPLICATE_SIGNAL_MS = 1000;

/** Counts shutdown requests, folding duplicate deliveries into one. */
export class SignalCounter {
  private count = 0;
  private last = -Infinity;
  constructor(
    private readonly windowMs = DUPLICATE_SIGNAL_MS,
    private readonly now: () => number = () => performance.now(),
  ) {}
  /** The action for a signal now, or "duplicate" if it repeats the last request. */
  next(phase: LaunchPhase): SignalAction | "duplicate" {
    const t = this.now();
    if (this.count > 0 && t - this.last < this.windowMs) return "duplicate";
    this.last = t;
    return signalAction(phase, this.count++);
  }
}

/** Starts the viewer's post-episode lifetime immediately, independently of recording. */
export async function finishViewerAfterGrace(o: { milliseconds: number; signal: AbortSignal; close: () => Promise<void> }) {
  if (o.milliseconds > 0 && !o.signal.aborted) {
    await new Promise<void>((resolve) => {
      const done = () => { clearTimeout(timer); o.signal.removeEventListener("abort", done); resolve(); };
      const timer = setTimeout(done, o.milliseconds);
      o.signal.addEventListener("abort", done, { once: true });
    });
  }
  await o.close();
}
