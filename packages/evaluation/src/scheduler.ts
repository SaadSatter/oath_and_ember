import { publicKeys, type ActionEnvelope } from "./contract.js";
export function validateEnvelope(value: ActionEnvelope): ActionEnvelope {
  if (
    !value ||
    typeof value.observation_id !== "string" ||
    typeof value.action_id !== "string" ||
    !value.action_id.length ||
    value.action_id.length > 100 ||
    !Array.isArray(value.plan) ||
    value.plan.length < 1 ||
    value.plan.length > 8
  )
    throw Error("Invalid action envelope");
  const exact = (object: object, allowed: string[]) => {
    if (Object.keys(object).some((k) => !allowed.includes(k)))
      throw Error("Unexpected action field");
  };
  exact(value, ["observation_id", "action_id", "plan", "message"]);
  let ticks = 0;
  for (const action of value.plan) {
    if (!action || !["controls", "press", "ui", "wait"].includes(action.type))
      throw Error("Invalid action");
    exact(
      action,
      action.type === "controls"
        ? ["type", "held", "ticks"]
        : action.type === "wait"
          ? ["type", "ticks"]
          : action.type === "press"
            ? ["type", "key"]
            : ["type", "token"],
    );
    if (action.type === "controls" || action.type === "wait") {
      if (!Number.isSafeInteger(action.ticks) || action.ticks < 1)
        throw Error("Invalid duration");
      ticks += action.ticks;
    } else ticks += action.type === "press" ? 2 : 1;
    if (
      action.type === "controls" &&
      (!Array.isArray(action.held) ||
        action.held.some((k) => !publicKeys.includes(k)))
    )
      throw Error("Invalid controls");
    if (action.type === "press" && !publicKeys.includes(action.key))
      throw Error("Invalid key");
    if (
      action.type === "ui" &&
      (typeof action.token !== "string" || action.token.length > 200)
    )
      throw Error("Invalid UI token");
  }
  if (ticks > 240) throw Error("Plan exceeds 240 ticks");
  return structuredClone(value);
}
