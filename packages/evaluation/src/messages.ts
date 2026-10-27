import type { EvaluationRole } from "./contract.js";
export class MessageRelay {
  private counts = { SIEG: 0, COCO: 0 };
  private inbox: Record<
    EvaluationRole,
    { from: EvaluationRole; text: string }[]
  > = { SIEG: [], COCO: [] };
  validate(role: EvaluationRole, text?: string) {
    if (
      text !== undefined &&
      (typeof text !== "string" ||
        [...text].length > 256 ||
        this.counts[role] >= 64)
    )
      throw Error("Message limit exceeded");
  }
  send(role: EvaluationRole, text?: string) {
    this.validate(role, text);
    if (text === undefined) return;
    this.counts[role]++;
    this.inbox[role === "SIEG" ? "COCO" : "SIEG"].push({ from: role, text });
  }
  read(role: EvaluationRole) {
    return this.inbox[role].splice(0);
  }
}
