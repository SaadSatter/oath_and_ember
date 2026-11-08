// Host sleep guard and suspension monitor for evaluation launchers.
//
// Finding (2026-11-05, S2-local model-navigator paid run): every one of the
// run's ten model-call timeouts overlapped a macOS system sleep (pmset log:
// "Idle Sleep", then repeated "Maintenance Sleep"). While the host sleeps the
// process is suspended, so a 30 s per-call timer cannot fire until the host
// wakes, and the network is down in between; three timeouts in a row then
// ended the episode with "error". The per-call timeout itself was correct.
//
// keepAwake() holds a sleep-prevention assertion for as long as this process
// lives (macOS: `caffeinate -i -s -w <pid>`), so an unattended run is not put
// to sleep. SuspendMonitor records any wall-clock gap a running process could
// not have produced (the host was suspended), so a run that was suspended
// anyway is labelled as such instead of looking like slow model calls.

import { spawn, type ChildProcess } from "node:child_process";

export interface KeepAwake {
  /** "caffeinate": the assertion is held. "unavailable": it could not be started. "unsupported": not macOS. */
  mode: "caffeinate" | "unavailable" | "unsupported";
  detail?: string;
  stop(): void;
}

type Spawner = (cmd: string, args: string[]) => ChildProcess;

/** Prevent idle and system sleep for the lifetime of `pid` (default: this process). */
export function keepAwake(opts: { platform?: string; pid?: number; spawner?: Spawner } = {}): KeepAwake {
  const platform = opts.platform ?? process.platform;
  if (platform !== "darwin") return { mode: "unsupported", stop() {} };
  const spawner: Spawner = opts.spawner ?? ((cmd, args) => spawn(cmd, args, { stdio: "ignore" }));
  try {
    // -i idle sleep, -s system sleep (on AC power); -w ends with the watched process.
    const child = spawner("caffeinate", ["-i", "-s", "-w", String(opts.pid ?? process.pid)]);
    let failed: string | undefined;
    child.on?.("error", (e: Error) => (failed = e.message));
    child.unref?.();
    return {
      mode: "caffeinate",
      get detail() {
        return failed;
      },
      stop() {
        try {
          child.kill?.();
        } catch {
          // Already gone: it also exits with the watched process.
        }
      },
    };
  } catch (e) {
    return { mode: "unavailable", detail: (e as Error).message, stop() {} };
  }
}

export interface Suspension {
  /** ISO time the gap began (last tick seen before it). */
  from: string;
  to: string;
  seconds: number;
}

/**
 * Checks the wall clock every `intervalMs`; a gap longer than `thresholdMs`
 * between two checks means the whole process was not running (host sleep or
 * a stop signal), not that something was slow.
 */
export class SuspendMonitor {
  readonly suspensions: Suspension[] = [];
  private last: number;
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    private readonly onSuspend: (s: Suspension) => void = () => {},
    private readonly intervalMs = 1000,
    private readonly thresholdMs = 5000,
    private readonly now: () => number = Date.now,
  ) {
    this.last = now();
  }
  start() {
    this.last = this.now();
    this.timer = setInterval(() => this.check(), this.intervalMs);
    this.timer.unref?.();
    return this;
  }
  /** One check (called by the interval; exposed for tests). */
  check() {
    const t = this.now();
    const gap = t - this.last;
    if (gap > this.thresholdMs) {
      const s = { from: new Date(this.last).toISOString(), to: new Date(t).toISOString(), seconds: Math.round(gap / 100) / 10 };
      this.suspensions.push(s);
      this.onSuspend(s);
    }
    this.last = t;
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  totalSeconds() {
    return Math.round(this.suspensions.reduce((a, s) => a + s.seconds, 0) * 10) / 10;
  }
}
