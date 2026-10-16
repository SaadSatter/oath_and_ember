import type { SceneId } from "./gameTypes.js";
export const items = {
  hedge_gate_key: {
    name: "Hedge Gate Key",
    description:
      "Opens the locked gate in the hedge maze. Consumed only when the gate opens.",
    icon: "hedge-gate-key.png",
  },
  enchanted_shears: {
    name: "Enchanted Shears",
    description:
      "A shared enchanted garden tool. Keep it for the Griffin's nest.",
    icon: "enchanted-shears.png",
  },
  vanity_mirror: {
    name: "Vanity Mirror",
    description: "An ornate mirror for the proud Griffin. A shared quest tool.",
    icon: "vanity-mirror.png",
  },
  griffin_wig: {
    name: "Magnificent Griffin Wig",
    description: "Offer this magnificent hairpiece to the Bald Goddess.",
    icon: "griffin-wig.png",
  },
} as const;
export type ItemId = keyof typeof items;
export interface InventoryState {
  revision: number;
  counts: Partial<Record<ItemId, number>>;
  claimed: string[];
  unlocked: string[];
  completed: string[];
}
export interface InventoryTarget {
  id: string;
  name: string;
  sceneId: SceneId;
  x: number;
  y: number;
  kind: "chest" | "gate" | "offering";
  itemId?: ItemId;
}
export interface ItemIntent {
  requestId: string;
  targetId: string;
  itemId?: ItemId;
}
export interface ItemOutcome {
  message: string;
  revision: number;
}
export const emptyInventory = (): InventoryState => ({
  revision: 0,
  counts: {},
  claimed: [],
  unlocked: [],
  completed: [],
});
