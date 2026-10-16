import type { World } from "../../../packages/shared/src/gameTypes.js";
import {
  SHRINE_OFFERING,
  shrinePoints,
} from "../../../packages/shared/src/shrine.js";
import type { InventoryService } from "./inventory.js";
export function ensureShrine(w: World, inventory: InventoryService) {
  if (!inventory.targets.has(SHRINE_OFFERING))
    inventory.register(w, {
      id: SHRINE_OFFERING,
      name: "Bald Goddess",
      sceneId: "GODDESS_SHRINE",
      kind: "offering",
      ...shrinePoints.offering,
      itemId: "griffin_wig",
      dialogue: {
        idle: "“My crown is cold. Seek a boastful creature whose glory grows above its eyes. Bring me something with… volume.”",
        wrong: {
          enchanted_shears:
            "“A trim? Darling, that ship has sailed. Bring me something to trim first.”",
          vanity_mirror:
            "“Yes, I have seen the problem. Repeatedly. Please stop reflecting on it.”",
          hedge_gate_key:
            "“It unlocks many things. A flattering hairstyle is not one of them.”",
        },
        success:
          "“At last! Divine volume. The Bald Goddess thanks you—and requests a new title.”",
      },
    });
}
