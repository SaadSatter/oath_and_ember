import type { World, Player } from "../../../packages/shared/src/gameTypes.js";
import {
  items,
  type InventoryTarget,
  type ItemId,
  type ItemIntent,
  type ItemOutcome,
} from "../../../packages/shared/src/items.js";
import { collisionRects } from "../../../packages/shared/src/maps.js";
import { segmentHits } from "./enemySimulation.js";
interface Target extends InventoryTarget {
  interact?: (world: World, player: Player, intent: ItemIntent) => ItemOutcome;
  dialogue?: {
    idle: string;
    wrong: Partial<Record<ItemId, string>>;
    success: string;
  };
  reward?: ItemId;
  available?: (world: World, player: Player) => boolean;
}
/** Targets are registered by server map code, never supplied by clients. */
export class InventoryService {
  readonly targets = new Map<string, Target>();
  private receipts = new Map<
    string,
    { fingerprint: string; outcome?: ItemOutcome; error?: string }
  >();
  clear() {
    this.targets.clear();
    this.receipts.clear();
  }
  register(world: World, target: Target) {
    if (this.targets.has(target.id)) throw Error("Duplicate inventory target");
    this.targets.set(target.id, target);
    const {
      interact: _interact,
      reward: _reward,
      available: _available,
      dialogue: _dialogue,
      ...view
    } = target;
    if (target.kind === "offering") delete view.itemId;
    (world.inventoryTargets ??= {})[target.id] = view;
  }
  nearest(world: World, player: Player) {
    return [...this.targets.values()]
      .filter(
        (t) =>
          t.sceneId === (player.sceneId ?? world.sceneId) &&
          Math.hypot(t.x - player.x, t.y - player.y) <= 64,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - player.x, a.y - player.y) -
            Math.hypot(b.x - player.x, b.y - player.y) ||
          a.id.localeCompare(b.id),
      )[0];
  }
  use(world: World, player: Player, intent: ItemIntent): ItemOutcome {
    const key = `${player.id}:${intent.requestId}`;
    const fingerprint = JSON.stringify([
      intent.targetId,
      intent.itemId ?? null,
    ]);
    const receipt = this.receipts.get(key);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint)
        throw Error("Request ID already used for another action.");
      if (receipt.error) throw Error(receipt.error);
      return receipt.outcome!;
    }
    // Never evict successful receipts and accidentally allow a replay to consume again.
    if (this.receipts.size >= 8192)
      throw Error("Inventory request limit reached for this room.");
    try {
      const outcome = this.apply(world, player, intent);
      this.receipts.set(key, { fingerprint, outcome });
      return outcome;
    } catch (e) {
      const error = (e as Error).message;
      this.receipts.set(key, { fingerprint, error });
      throw Error(error);
    }
  }
  private apply(world: World, player: Player, intent: ItemIntent): ItemOutcome {
    if (world.phase !== "PLAYING" || !player.connected || player.hp <= 0)
      throw Error("Cannot interact right now.");
    const target = this.targets.get(intent.targetId);
    if (!target || target.sceneId !== (player.sceneId ?? world.sceneId))
      throw Error("That object is not on your map.");
    if (Math.hypot(target.x - player.x, target.y - player.y) > 64)
      throw Error("Move closer to the object.");
    const walls = collisionRects(
      player.sceneId ?? world.sceneId,
      world.puzzles,
      world.pushableOffsets,
      world.bridgePuzzle,
      world.players,
      world.serverTick,
      player.role,
    );
    if (
      walls.some((w) =>
        segmentHits(player.x, player.y, target.x, target.y, w, 0),
      )
    )
      throw Error("The object is blocked.");
    if (target.available && !target.available(world, player))
      throw Error("Solve the puzzle first.");
    if (target.interact) return target.interact(world, player, intent);
    const inventory = world.inventory!;
    let message: string;
    if (target.kind === "chest") {
      if (intent.itemId)
        throw Error("Interact with the chest without offering an item.");
      if (inventory.claimed.includes(target.id))
        return { message: "Already collected.", revision: inventory.revision };
      if (!target.reward) throw Error("This chest has no reward.");
      inventory.counts[target.reward] =
        (inventory.counts[target.reward] ?? 0) + 1;
      inventory.claimed.push(target.id);
      message = `Collected ${items[target.reward].name}.`;
    } else {
      const completed =
        target.kind === "gate" ? inventory.unlocked : inventory.completed;
      if (completed.includes(target.id))
        return {
          message:
            target.kind === "gate"
              ? "Gate already open."
              : "Offering already accepted.",
          revision: inventory.revision,
        };
      if (target.kind === "offering" && target.dialogue && !intent.itemId)
        return { message: target.dialogue.idle, revision: inventory.revision };
      if (!intent.itemId || intent.itemId !== target.itemId)
        throw Error(
          target.kind === "offering"
            ? (target.dialogue?.wrong[intent.itemId!] ??
                "A thoughtful gift, but the goddess wants something else. Nothing was consumed.")
            : "Select the correct key.",
        );
      if (!(inventory.counts[intent.itemId]! > 0))
        throw Error("That item is not in the shared backpack.");
      // Only explicitly consumable quest items can be spent. Tools stay owned.
      if (intent.itemId !== "hedge_gate_key" && intent.itemId !== "griffin_wig")
        throw Error("This tool cannot be consumed.");
      inventory.counts[intent.itemId]!--;
      completed.push(target.id);
      message =
        target.kind === "gate"
          ? "Gate opened."
          : (target.dialogue?.success ??
            "The goddess accepts the magnificent wig!");
    }
    inventory.revision++;
    return { message, revision: inventory.revision };
  }
}
