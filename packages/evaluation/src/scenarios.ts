import { hash } from "./trace.js";
export interface EvaluationScenario {
  id: string;
  width: number;
  height: number;
  maxDelayTicks: number;
  developmentSeeds: readonly number[];
  heldoutSeeds: readonly number[];
}
/** Evaluator-only preregistration; never include manifest/seed in a worker prompt. */
export const SCENARIOS: readonly EvaluationScenario[] = Object.freeze([
  {
    id: "A",
    width: 1280,
    height: 800,
    maxDelayTicks: 0,
    developmentSeeds: [1101, 1102],
    heldoutSeeds: [8101, 8102, 8103],
  },
  {
    id: "B",
    width: 960,
    height: 720,
    maxDelayTicks: 0,
    developmentSeeds: [1201, 1202],
    heldoutSeeds: [8201, 8202, 8203],
  },
  {
    id: "C",
    width: 1280,
    height: 800,
    maxDelayTicks: 6,
    developmentSeeds: [1301, 1302],
    heldoutSeeds: [8301, 8302, 8303],
  },
]);
export const SCENARIO_MANIFEST_HASH = hash(SCENARIOS);
export function sealCampaign(frozenHashes: Record<string, string>) {
  return {
    scenarios: SCENARIOS,
    manifestHash: SCENARIO_MANIFEST_HASH,
    frozenHashes: { ...frozenHashes },
    seal: hash({ scenarios: SCENARIOS, frozenHashes }),
  };
}
