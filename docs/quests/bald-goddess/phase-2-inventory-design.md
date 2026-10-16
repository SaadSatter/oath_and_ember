# Shared inventory — approved and implemented foundation

October 14, 2026. All four map layouts are approved.

Style revision: use the user-supplied dark green / antique-gold panel and inventory button assets in `Images/UI/inventory/reference`, with generated transparent item sprites in `Images/UI/inventory/items`. See `inventory-styled-preview.html` and its PNG for the revised desktop/mobile proposal. Text labels in the first wireframe are replaced by item artwork; shared ownership and use rules remain the same. Inventory design and styled preview were approved by “Perfect you may continue now.” The foundation is implemented; map rewards will be registered by the approved map implementations.

## Ownership and controls

One room inventory belongs jointly to Coco and Sieg, even on separate maps. Both see the same items, quantities and quest progress. Each player independently selects an item and opens or closes their own panel. No personal copies or trading.

I or a backpack button toggles the panel. Desktop uses an item grid with a description and action area beside it. Mobile uses the same grid above the selected item's details, with large touch targets and a close button. Opening the panel clears held movement / attack intent; the shared world continues running. Escape closes it. Number keys remain ability shortcuts when the panel is closed; they never silently select inventory items.

E remains the primary world interaction. Near a chest, gate, goddess or nest, show the target and available action. Item selection alone never consumes or uses an item. A selected compatible item offers “Use on [target]” only when a valid target is nearby; otherwise show “Approach a compatible object.” No free dropping, discarding or selling quest tools. Nest delivery is an explicit interaction, not a destructive drop operation.

## Proposed item definitions

| Stable ID | Item | Use | Consumption |
|---|---|---|---|
| `hedge_gate_key` | Hedge Gate Key | Opens the maze reward gate | Consume once, atomically with opening the gate |
| `enchanted_shears` | Enchanted Hedge Shears | Optional Griffin quest tool | Retain; cuts hair during mirror distraction |
| `vanity_mirror` | Vanity Mirror | Optional Griffin quest tool | Retain; distracts Griffin at nest |
| `griffin_wig` | Magnificent Griffin Wig | Offer to the goddess | Consume once with successful quest completion |

Incorrect offerings consume nothing. Approved nest sequence: deliver mirror to distract, then deliver shears during distraction to cut automatically and grant one wig without defeating the Griffin. Retain both tools. Use existing verified PixelLab artwork where available, with labeled geometric placeholders for any missing icons during foundation work.

## Server-owned state and transactions

Room state contains `inventoryRevision`, item counts, claimed chest IDs, unique runner reward state, unlocked gate IDs, quest flags and placed-item references where needed. A placed shared tool remains owned; placement must not create another copy. Client selection and descriptions are local presentation state.

Clients send intent containing a request ID, target ID and optional item ID. The server resolves the actor from the connection, validates life state, scene, range, line of sight, target compatibility, item ownership and required puzzle state, then commits one atomic transaction. It never accepts client counts, rewards, gate completion or positions.

Concurrent chest claims grant exactly one item. Repeated requests return the original result. Opening the maze gate consumes exactly one key, once, and both clients receive the same new revision. Two attempts to offer the wig result in one quest completion. Wrong or stale requests return clear feedback and consume nothing. Pending UI disables that action until a result or authoritative refresh arrives.

Snapshots include shared inventory and quest state for reconnects within the current in-memory room lifetime. There is no persistence beyond the service lifetime. Players on different maps receive shared inventory changes, but interactions only affect targets in the actor's actual scene.

## Foundation validation after approval

Meaningful integration tests: concurrent chest claim; duplicate request; failed range / scene / ownership validation; concurrent key-gate use; invalid offering; single wig consumption; independent client selection; inventory synchronization while players occupy different scenes. Run typecheck, tests and build after protocol/gameplay changes.

Griffin nest tool effects are approved: mirror distracts; shears then cut automatically, awarding one wig through the nonlethal route. Combat and cutting share a single reward claim.


## Implementation checkpoint

Implemented: server-owned shared counts and quest transaction state, strict `inventory:use` intent validation, immutable per-player request receipts, atomic chest / key-gate / goddess transactions, range and scene / collision checks, revisioned synchronization and in-memory reconnect recovery. Desktop/mobile dialog uses the supplied panel and generated sprites, opens with I or its button, and suppresses held gameplay controls. Item selection remains local to each client. E invokes nearby registered inventory targets; ordinary map E interactions remain available elsewhere.

No demo rewards or test targets ship in the campaign. Until quest maps register rewards, the live backpack starts empty. Existing map transitions preserve the inventory; full game restart clears it. Nest tool effects are now specified and approved; their encounter implementation is still pending. This stage does not implement the four quest maps or independent scene simulation.

Validation: typecheck, 221 tests and build passed; two-browser desktop/mobile QA verified empty state, item artwork, independent selection, input suppression, shared key-gate consumption and Escape. QA screenshots use explicit server-side test fixtures, not starting player inventory. Run `node --import tsx scripts/qa-shared-inventory.ts` after building to repeat.
