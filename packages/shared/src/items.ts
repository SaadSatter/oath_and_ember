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
  // Chapter 0: Alden's shopping list. Coco buys these in Emberbrook.
  moonleaf: {
    name: "Moonleaf Herbs",
    description: "A fresh bundle from Brynn's Apothecary. Paid for, for once.",
    icon: "moonleaf.png",
  },
  crystal_vial: {
    name: "Crystal Vial",
    description: "Clear and empty. Papa is working on something.",
    icon: "crystal-vial.png",
  },
  candlewick: {
    name: "Candlewick",
    description: "A coil of cotton wick from the general store.",
    icon: "candlewick.png",
  },
  fresh_bread: {
    name: "Fresh Bread",
    description: "Alden's usual loaf from the village bakery. Still warm.",
    icon: "fresh-bread.png",
  },
  honey_pastry: {
    name: "Honey Pastry",
    description: "A very important magical ingredient. For happiness.",
    icon: "honey-pastry.png",
  },
  // Chapter 0: the funeral beneath the old tree.
  river_stone: {
    name: "Smooth Stone",
    description: "A smooth stone from the road, to mark Alden's grave.",
    icon: "river-stone.png",
  },
  wildflowers: {
    name: "Wildflowers",
    description: "Daisies and blue wildflowers from Papa's garden.",
    icon: "wildflowers.png",
  },
  wooden_sword: {
    name: "Wooden Practice Sword",
    description:
      "The first sword Alden gave Sieg, when he was seven. Not for fighting.",
    icon: "wooden-sword.png",
  },
  // Chapter 0: found in the locked compartment of Alden's desk.
  alden_journal: {
    name: "Alden's Journal",
    description:
      "\"If the Ember has been found, the others will not remain hidden for long. I can only hope the old guardian remembers what she promised.\"",
    icon: "alden-journal.png",
  },
  strange_cloth: {
    name: "Strange Cloth",
    description:
      "A scrap of cloth with a symbol neither of them knows. Papa kept it with Coco's things from when she was little.",
    icon: "strange-cloth.png",
  },
  star_drawing: {
    name: "Drawing of Seven Stars",
    description: "Seven stars drawn in a ring around a dark circle.",
    icon: "star-drawing.png",
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
