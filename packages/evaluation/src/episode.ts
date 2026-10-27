import type { Outcome, TerminalReason, EvaluationRole } from "./contract.js";
export class Episode {
  ticks = 0;
  submissions = { SIEG: 0, COCO: 0 };
  reason?: TerminalReason;
  constructor(
    readonly maxTicks = 28800,
    readonly maxSubmissionsPerRole = 1000,
  ) {}
  submit(role: EvaluationRole) {
    if (this.reason) throw Error("Episode terminated");
    if (this.submissions[role] >= this.maxSubmissionsPerRole) {
      this.reason = "action_limit";
      throw Error("Action limit");
    }
    this.submissions[role]++;
  }
  tick(success: boolean) {
    this.ticks++;
    if (success) this.reason = "success";
    else if (this.ticks >= this.maxTicks) this.reason = "time_limit";
  }
  stop(reason: TerminalReason) {
    this.reason ??= reason;
  }
  outcome(): Outcome {
    return {
      terminal: !!this.reason,
      reason: this.reason,
      ticks: this.ticks,
      submissions: { ...this.submissions },
    };
  }
}
