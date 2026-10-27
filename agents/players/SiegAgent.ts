import { IndependentPlayer } from "./policy.js";
import type { TextGateway } from "./modelGateway.js";
import type { DecisionRecord } from "./policy.js";
export class SiegAgent extends IndependentPlayer {
  constructor(
    manual: string,
    gateway: TextGateway,
    record?: (r: DecisionRecord) => void,
  ) {
    super("SIEG", manual, gateway, record);
  }
}
