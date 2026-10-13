import {
  SERVER_HZ,
  INPUT_LEAD_TICKS,
  MAX_PREDICTION_LEAD,
} from "../../../../packages/shared/src/constants.js";
// Input sequence and render cadence never determine this simulation clock.
export class SimulationClock {
  private anchorTick = 0;
  private anchorTime = 0;
  private initialized = false;
  private calibrated = false;
  private lastProbeSent = -Infinity;
  reset(tick: number, now: number) {
    this.anchorTick = tick;
    this.anchorTime = now;
    this.initialized = true;
    this.lastProbeSent = now;
    this.calibrated = false;
  }
  sample(tick: number, sent: number, received: number) {
    if (sent < this.lastProbeSent) return;
    this.lastProbeSent = sent;
    // Queued replies measure scheduling delay, not the server's current clock.
    // Reject them; accepted probes gently adjust an already calibrated timeline.
    const rtt = received - sent;
    if (rtt < 0 || rtt > 200) return;
    const candidate = tick + (rtt * SERVER_HZ) / 2000;
    const current = this.estimate(received);
    this.anchorTick = this.calibrated
      ? current + Math.max(-0.25, Math.min(0.25, candidate - current))
      : candidate;
    this.calibrated = true;
    this.anchorTime = received;
    this.initialized = true;
  }
  estimate(now: number) {
    return (
      this.anchorTick + (Math.max(0, now - this.anchorTime) * SERVER_HZ) / 1000
    );
  }
  target(serverTick: number, now: number) {
    if (!this.initialized) this.reset(serverTick, now);
    return Math.max(
      serverTick + INPUT_LEAD_TICKS,
      Math.min(
        serverTick + MAX_PREDICTION_LEAD,
        Math.floor(this.estimate(now)) + INPUT_LEAD_TICKS,
      ),
    );
  }
}
