# Goddess Shrine hub

Implemented the approved 40×32 strictly top-down central layout: a southern shared Start/Return courtyard, central shrine plaza, west Mirror Pond path, east Hedge Maze path and northern Griffin trail. Enter from E · GODDESS SHRINE in Forest Ruins, replacing the temporary direct maze/pond entry markers. The two finished puzzle maps return to the corresponding side of the hub, and the southern return leads back to the same Forest Ruins entrance. Inventory and puzzle progress survive travel; shrine travel does not heal either hero.

The supplied crying and happy goddess shrine PNGs are reused at native 168×168 size. Grass, stone paving, trees, bushes and the offering pad reuse existing PixelLab assets. The actual plinth/tree/shrub footprints are solid, including during Flight; roof overhangs remain decorative. Original statue sources remain in `Images/Maps/Bald_Goddess_Statue_*`.

Either hero uses E at the offering bowl for a cryptic clue. The shared backpack can also Speak to the goddess without a selected item. Selected offerings use the existing server inventory transaction service. Shears, mirror and key receive custom humorous rejections without consumption. No expected offering item ID or dialogue answer is published to the client target metadata. A genuinely owned Griffin Wig is consumed once and the offering completion recorded atomically. Both clients change to the happy statue with a small hairpiece overlay derived from the existing inventory icon. Replayed/concurrent offerings cannot consume a second wig or duplicate completion.

The Griffin encounter/reward acquisition remains the next map implementation; the north trail is laid out and labelled, without a fake reward chest or a completed boss encounter. Offering QA supplies the future reward only in isolated test fixtures. Travel currently uses the existing party-wide map system; independent simultaneous scene simulation remains separate work.

Validation: navigation from both spawn positions to offering and branch paths, E travel to/from both maps and campaign return, cryptic dialogue, range/ownership checks, wrong-item retention, one shared accepted offering, and two real socket clients receiving identical completion/inventory. `scripts/qa-shrine.ts` exercises real E dialogue, inventory button offerings, happy-state synchronization and both branch entrances in two browsers. Source offering fixtures are documented in that script.

Screenshots: `qa/shrine-entry.png`, `qa/shrine-crying-clue.png`, `qa/shrine-happy.png`.

The plaza camera frames both the goddess and offering area during interactions. Final checks: all 266 tests across 40 files, typecheck, production build and two-client browser QA pass.

The shrine now retains camera zoom 1 throughout. Near the offering it centers on the statue and bowl without resampling sprites; outside that area it follows the player. This replaces the reduced-resolution whole-plaza framing.

Campaign placement: the completed exit of Puzzle Map 2 (Bridge Ruins) now enters this hub directly. South RETURN leads back to that bridge. The former south-east debug Forest Ruins shortcut, switch, and exit marker have been removed; completing the offering does not add a forest entrance. Branch return locations and earlier bridge completion persist.
