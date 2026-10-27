# Oath and Ember game design rationale

Prepared for the Columbia AI Game Development midterm on 22 October 2026. Reviewed against repository commit `67cf1f9460d0ad1d60177d05b949a623f52720e7` and the illustrated mechanics manual. This document contains puzzle and story spoilers.

## How to read this document

I am presenting Oath and Ember as an original cooperative game. The supplied midterm brief establishes my intended concept and names Zelda and It Takes Two as inspirations. The repository establishes what has actually been implemented. Neither source, by itself, proves that players find a design enjoyable or that every implementation detail was my deliberate preference.

I distinguish five kinds of evidence throughout:

| Label | Meaning in this document |
| --- | --- |
| `design` | Original project rules or a deliberate requirement recorded in the supplied brief or a repository specification. A specification can be superseded; this label alone does not establish current behavior. |
| `code` | Behavior verified by reading the current implementation. Test assertions are supporting evidence, not a substitute for implementation. |
| `manual` | A rule stated in the mechanics manual, or a description from an external reference. An external inspiration is not automatically an inherited rule. |
| `observed` | A recorded automated run, gameplay capture, or test execution. The method and fixture limitations must accompany the observation. |
| `assumed` | A proposed explanation, intended benefit, or evaluation decision not yet confirmed by human evidence or by me as the designer. |

I approved the design rationale for D1–D11 on 22 October 2026. The paragraphs headed **Approved design rationale** now record my confirmed design intent (`design`). This approval does not establish human-playtest outcomes or resolve the separate rules discrepancies, evaluation proposal, or open questions below. I treat the source DOCX as an early reference brief, following [AGENTS.md](../AGENTS.md#L1), rather than as operating instructions or a current rules specification. Its original platformer and skill-progression plans differ from parts of the current game.

## 1 Original concept and contribution

My game is a two-player, primarily top-down fantasy action-adventure about Sieg and Coco. Sieg is a swordsman whose strengths are physical combat, pushing and movement. Coco is a mage whose strengths are ranged magic, environmental manipulation and mobility. Exploration, conversations, combat and environmental puzzles share one world and one continuing story.

My central design goal is to make cooperation necessary at important progression points. I do not mean that the heroes must remain beside each other or press buttons simultaneously throughout the game. They have independent cameras, can explore separately, and sometimes occupy different interiors. What matters is that one hero cannot replace the other's contribution at a role-locked mechanism. A bridge target requires Coco's projectile, heavy-object movement requires Sieg, and the final bridge switches require both roles in different positions. These are stronger evidence for mandatory cooperation than the mere presence of a second player. See [the bridge design](puzzles/bridge-that-hates-cooperation/README.md#required-progression) and [its current rules](../packages/shared/src/bridgePuzzle.ts#L314).

My original contribution is the arrangement of these rules around these characters and this story: a persistent boulder carried through several trials, a bridge that punishes crowding before allowing a reunion, a shared quest for the goddess, and the interaction between time, speed, flight and environmental constraints. I am not claiming to have invented sword attacks, switches, cooperative play, or a game engine.

Original game design also does not mean that every asset was drawn from scratch. The project uses Phaser and other libraries, generated artwork, and supplied or licensed assets with provenance records. [The sprite documentation](SPRITE_ASSETS.md), [environment provenance](ENVIRONMENT_ASSET_PROVENANCE.json), [monster source records](../Images/Sprites/monster_sprites/README.md), and [audio provenance](audio/GAME_AUDIO_INTEGRATION.md) should accompany any asset attribution statement. Originality here concerns the game's world, protagonists, narrative, puzzle arrangements and rules, not an unsupported claim of exclusive authorship of every dependency or image.

## 2 Inspirations and what I adapted

### The Legend of Zelda

Zelda influenced the broad adventure structure I wanted: overhead fantasy exploration; navigating connected areas; alternating combat with puzzles; using abilities to interact with obstacles and switches; and learning through NPC dialogue and discoveries. Villages, forests, shrines and ruins provide a familiar fantasy vocabulary. My Emberbrook, Alden's shop, quest conversations and shrine branches use that vocabulary in an original setting.

For a concrete reference, [Nintendo's official description of Link's Awakening](https://www.nintendo.com/us/store/products/the-legend-of-zelda-links-awakening-switch/) describes exploration, dangerous dungeons, a mystery and memorable characters. I use it as an example of an adventure tradition, not evidence that I copied that specific game's rules or played a particular Zelda title during development. The named series influence comes from my supplied brief. No particular Zelda switch puzzle, damage formula, item sequence or level layout has been identified as a directly inherited rule.

### It Takes Two

It Takes Two influenced my cooperative philosophy: two people should have different mechanical responsibilities while both matter to progress. The reference encourages coordination through positioning, timing and connected abilities. [EA and Hazelight's official features page](https://www.ea.com/games/it-takes-two/it-takes-two/features) describes a game built for two, cooperative obstacles and changing abilities. This supports the broad reference, without establishing a one-to-one mapping between its mechanics and mine.

I adapt that philosophy to overhead fantasy exploration with two persistent hero identities. Sieg pushes and runs; Coco slows time, flies and pulls with Black Hole. In the bridge trial, slowing the hazards changes when Sieg can move the boulder. In Mirror Pond, one player adjusts a reflector while the other launches the spell. I am not reproducing Cody and May, their levels, or their platform-adventure sequence. Equal importance is my design goal, not a measured finding about actual playtime or player satisfaction.

## 3 Original decisions and alternatives

### D1 Complementary protagonists

**Confirmed design:** Sieg and Coco have different starting actions, with exclusive hero roles enforced by the server. [The approved capability plan](quests/bald-goddess/phase-1-world-plan.md#1-verified-current-capabilities) records the role separation; [starting skills](../packages/shared/src/abilities.ts#L2) and [role selection](../apps/server/src/GameRoom.ts#L276) implement it.

**Approved design rationale — `design`:** I want each player to notice opportunities the other cannot act on alone. Distinct abilities give them useful information to communicate: where to stand, when to slow a hazard, and when to fire. An alternative is two identical heroes, which would make either player interchangeable at most obstacles. Complementary roles better support the cooperative identity I am aiming for, but may also leave one player waiting. Agency balance needs human testing.

### D2 Shared quest inventory

**Confirmed design:** One backpack belongs to the party, while item selection remains local to each player. This is an explicit requirement in the [inventory design](quests/bald-goddess/phase-2-inventory-design.md#ownership-and-controls), implemented by [InventoryService](../apps/server/src/inventory.ts#L59).

**Approved design rationale — `design`:** I want the achievement to be “we found the tool,” rather than “the wrong person picked it up.” Separate inventories and a trading system would create logistical decisions, but could obstruct a puzzle for reasons unrelated to understanding it. A shared backpack keeps the focus on finding and applying items. It does not remove role or reach restrictions: Coco still has to approach the Griffin's nest.

### D3 Story as motivation

**Confirmed design:** Coco, Sieg, Alden, his death, the Ember and the investigation lead into the shrine quest. [Part 1](CHAPTER0_PART1.md) and [the finale](CHAPTER0_FINALE.md) record this narrative, while [the quest journal](../apps/client/src/ui/questLog.ts#L22) connects it to current tasks. Each hero makes an individual motivation choice near the ending; the server records both choices in [chooseMotivation](../apps/server/src/chapter0Finale.ts#L131).

**Approved design rationale — `design`:** I want exploration to answer a personal question rather than only increase a score. The early relationship with Alden gives the later search a human reason, and separate choices let each player express a reason to continue. A score-driven arena or an anonymous quest board would be simpler, but would not connect the characters' relationship to their cooperation as directly. The code proves the choices are stored; it does not yet demonstrate that they produce different later campaigns.

### D4 The Bridge That Hates Cooperation

**Confirmed design:** The bridge requires cooperation while restricting physical togetherness. Its original specification uses a persistent boulder, role-separated banks, targets, traps and a final reunion. Current source is [bridgePuzzle.ts](../packages/shared/src/bridgePuzzle.ts#L18).

The decision is not simply which switch to press. Players decide who can reach a control, when to leave the boulder supplying weight, how to coordinate Slow Time with physical pushing, and where Coco must cast a valid frontal shot. Two grounded occupants can collapse a bridge before the final target is solved. The final distinct-role switch positions then reward coordinated reunion. This makes the title a mechanical joke about spacing, rather than a rule against teamwork.

**Approved design rationale — `design`:** I want separation to become a resource the players manage together. A single switch that opens a permanent crossing would be easier to understand, but would remove the changing relationship between position, weight and support. A full reset on every mistake would add repetition; the actual local recovery rules preserve earlier unlocks so the current attempt remains the focus. Whether the added complexity is legible is still an open playtest question.

### D5 The Goddess Shrine hub and three branches

**Confirmed design:** The hub connects the western pond, eastern maze and northern Griffin enclosure. Shared tools from the first two branches support the Griffin's peaceful route; the wig is the goddess's accepted offering. The [world plan](quests/bald-goddess/phase-1-world-plan.md) records the structure, and [shrinePoints](../packages/shared/src/shrine.ts#L5), [travel](../apps/server/src/GameRoom.ts#L1234), and [the offering](../apps/server/src/shrine.ts#L7) implement the current connections.

Players decide which tool branch to attempt first, how to interpret the goddess's clue, and whether to prepare for the nonlethal Griffin interaction or take the combat alternative. The combat route means the current rules do **not** universally require both tool branches before the goddess can be satisfied. Branch travel moves the party; independent cameras do not mean three branches simulate simultaneously.

**Approved design rationale — `design`:** I want a small hub to make the adventure feel discoverable without becoming an unrestricted open world. A linear maze–pond–Griffin sequence would make dependencies clearer, but reduce route choice. The current hub offers bounded freedom with a common objective. It also needs clearer evidence that players understand the tool dependency without an external guide.

### D6 Hedge Maze

**Confirmed design and implementation:** The maze mixes navigation, five combat guards, a fireball-reactive bush, a cow that Black Hole can pull aside, a fleeing wolf with a key, and a key-gated shears reward. [The maze specification](quests/bald-goddess/hedge-maze-implementation.md) describes the intended sequence. Current [cow and bush behavior](../apps/server/src/hedgeMaze.ts#L132), [wolf movement](../apps/server/src/hedgeMaze.ts#L245), and [reward registration](../apps/server/src/hedgeMaze.ts#L29) establish the rules.

Players must distinguish an obstacle they can burn, one they can move, and an actor they must approach and interact with. Slow Time plus Super Speed helps Sieg catch a wolf that otherwise accelerates away. Coco's flight does not bypass the solid hedges. The current key transaction requires Sieg, proximity and clear sight, but does not require both timed abilities to be active; this differs from older notes.

**Approved design rationale — `design`:** I want players to reuse a small set of abilities in different contexts, rather than learn a new command for every obstacle. A static key in a dead end would test route finding, but not coordinated pursuit. Conversely, a rigid “both buffs active” transaction would enforce one prescribed solution. The current proximity rule permits an opportunistic catch, which may be desirable flexibility or may weaken intended cooperation; I need to decide that explicitly.

### D7 Mirror Pond

**Confirmed design and implementation:** Sieg manipulates mirrors from the bank, Coco reaches firing positions by flight, and reflected spells light four torches. All four raise the central sanctuary and allow one shared Vanity Mirror reward. See [the pond design](quests/bald-goddess/mirror-pond-implementation.md), [mirror rotation](../apps/server/src/mirrorPond.ts#L57), and [reflection and torch checks](../apps/server/src/mirrorPond.ts#L187).

Players decide how to cross the spike approach, which mirror angle produces a useful reflection, when the shooter is ready, and how to leave the mirror so the walkway remains usable. Reflection uses actual direction and angle rather than automatically correcting a shot toward a torch. Direct fire cannot substitute for a valid reflected spell. A reflected shot may light any torch it actually reaches, not only a preassigned paired torch.

**Approved design rationale — `design`:** I want a successful shot to be a joint prediction the players can see working. Preset mirror angles or automatic aiming would reduce frustration, but would also reduce discussion and experimentation. Continuous rotation makes the collaboration more expressive, at the cost of precision demands that need testing under real latency and on touch devices.

### D8 Griffin Enclosure

**Confirmed design and implementation:** The Griffin supports combat and a tool-based alternative. Coco can pull the airborne guardian ashore; Sieg can bait a locked-direction headbutt toward a pillar, creating a stun. A warned mouth beam can be avoided or blocked by geometry. For the peaceful route, Coco delivers the owned mirror and shears at the nest, the Griffin performs a timed grooming sequence and departs, and Coco collects the dropped wig. The server awards the shared reward once. See [the encounter design and its updates](quests/bald-goddess/griffin-implementation.md), [nest transactions](../apps/server/src/griffin.ts#L24), and [grooming](../apps/server/src/griffin.ts#L119).

**Approved design rationale — `design`:** I want preparation and observation to be credible alternatives to dealing damage. A mandatory boss kill would make the tool branches less meaningful. An automatic reward on entering the nest would remove the payoff of recognizing the guardian's vanity. The combat alternative preserves choice, but can bypass the tool branches and may place more control in Coco's hands; equal contribution remains a question to test.

### D9 One authoritative shared world

**Confirmed design:** [AGENTS.md](../AGENTS.md#L3) requires server-owned gameplay truth and client intent. [The networking design](NETWORKING.md) and [strict input schema](../apps/server/src/app.ts#L18) enforce that boundary. Shared kinematics provide both authoritative movement and client prediction.

**Approved design rationale — `design`:** I want both players to agree that a stone stayed on its plate, a mirror had a particular angle, or an item was consumed once. Client-owned outcomes would be easier to prototype, but conflicting local results could make a cooperative puzzle feel arbitrary. A fixed authoritative simulation with prediction offers responsive controls while keeping outcomes consistent. It adds reconciliation complexity, and measured networking improvements should not be confused with evidence of universally smooth play.

### D10 Independent exploration and local retries

**Confirmed design:** The source DOCX specifies independent cameras; the manual documents them. Individual interiors coexist with party-wide branch transitions. Local bridge and pond recoveries retain solved latches. Ordinary zero HP restores health and relocates a hero rather than ending the party's game.

**Approved design rationale — `design`:** I want players to investigate freely, then regroup when their abilities are needed. A shared camera could emphasize togetherness but would tether exploration. Permadeath or a full-map reset could increase tension, but would repeatedly discard shared puzzle understanding. The chosen recovery behavior favors experimentation; whether it makes combat feel too inconsequential needs human evaluation.

### D11 Bounded technical scope

**Confirmed design:** The project keeps one in-memory service and adds persistence or scaling only when requested. The engine is a dependency rather than an original contribution. Protocol changes need integration tests. See [project invariants](../AGENTS.md#L1) and [package configuration](../package.json).

**Approved design rationale — `design`:** I want a playable, inspectable cooperative episode before adding infrastructure. A database, multiple server instances or a newly written engine would consume time without directly demonstrating this midterm's cooperative design. The tradeoff is temporary sessions and a limited evaluation environment, which I should state openly.

## 4 Formal rules and manual verification

The [mechanics manual](../manual/Oath_and_Ember_Player_Manual.md) is my primary player-facing rules reference. The following verification adds implementation details and records exceptions. It does not silently edit the existing manual.

| Area | Manual statement | Current implementation verification |
| --- | --- | --- |
| Initial state | Two participants choose different heroes and both ready. | `GameRoom.add`, `select` and `ready` enforce two slots, unique roles and two connected ready players. Heroes reset to 100 HP, zero skill points, empty cooldowns and their starting skills. Ordinary reset replaces world inventory/progress; reconnect is different from reset. [Source](../apps/server/src/GameRoom.ts#L238). |
| Spawning | The manual does not promise one fixed campaign spawn. | Entry-point configuration defaults to the prologue unless `PROLOGUE=0`. A selected title-screen checkpoint can override the start. Prologue placement puts each role at its authored shop/house location; direct-map fixtures have their own spawns. [Entry](../apps/server/src/index.ts#L2), [checkpoint overrides](../apps/server/src/RoomManager.ts#L12), [role placement](../apps/server/src/prologue.ts#L103). |
| Movement | WASD/arrows, facing, solid obstacles, independent cameras. | Ordinary overhead speed is 190 world units/s; normalized diagonal input avoids a diagonal speed advantage. The actor box is 26 × 26, independent of artwork. Swept axis collision and bounded corner assistance constrain movement. [Constants](../packages/shared/src/constants.ts#L3), [movement](../packages/shared/src/movement.ts#L1). |
| Interaction | E near targets; I for backpack; Q for journal. | Inventory use requires an active connected living player, correct scene, distance at most 64, clear line of sight and target-specific availability. Gameplay input is suppressed while local panels/dialogue/story control is active; opening inventory does not pause the whole party. [Transaction](../apps/server/src/inventory.ts#L85), [input suppression](../apps/client/src/main.ts#L851). |
| Sieg | J slash; hold K defense; hold 1 Push; 2/Shift speed. | A basic sword hit is 25 damage in a frontal arc, with 0.45 s cooldown. Push has object/scene-specific reach and collision. Speed lasts 10 s; its 15 s activation cooldown leaves 5 s recovery after the effect. K also gives the legacy short collision-safe burst with a 2 s cooldown because Sieg starts with `dash`. [Combat](../apps/server/src/GameRoom.ts#L1041), [movement abilities](../packages/shared/src/movement.ts#L236). |
| Coco | J fireball, K Ward, 1/T Slow Time, 2/F Flight, 3/G Black Hole. | Starting fireball damage 20, speed 380 world units/s, range 672, cooldown 0.6 s; repeated shots require a new press. Slow Time lasts 10 s at a 0.2 scale, cooldown 20 s from cast. Boosted Sieg retains normal 190 movement during it. [Constants](../packages/shared/src/constants.ts#L26), [cast](../apps/server/src/GameRoom.ts#L1074), [Slow Time](../apps/server/src/GameRoom.ts#L890). |
| Flight | 20 s, 7 s recovery, crosses water/gaps but not solids. | Only terrain-tagged collision is bypassed. Expiry tries the last safe ground, nearby safe offsets, then map spawn; “last safe ground” in the manual is a simplification. Travel can terminate flight. [Movement](../packages/shared/src/movement.ts#L193). |
| Black Hole | Six-tile shot, three-tile radius, four-second vortex, 30 damage once per enemy, 10 s cooldown. | These are ordinary tuning values, with collision and sight constraints. The cow has a special harmless pull interaction; the Griffin has larger capture/grounding tuning. [Ordinary tuning](../packages/shared/src/blackHole.ts#L1), [Griffin override](../packages/shared/src/griffin.ts#L126). |
| Nonstarting skills | Heavy Break is conditional, not a starting skill. | Heavy charge is available only if `heavy` is unlocked: about 0.467 s minimum, 1.1 s full, 40 damage on heavy release, interrupted by damage. Legacy Telekinesis, Blink and fireball upgrades exist in definitions; no ordinary skill-tree UI or point income is established for this episode. [Skills](../packages/shared/src/abilities.ts#L2), [charge timing](../packages/shared/src/combat.ts#L4). |
| Defense and damage | Guarded damage is one quarter; 100 HP; zero HP restores health and respawns. | Ordinary `damage` applies those rules and cancels charge. Exceptions include the protected prologue ambush, a 15 HP floor, and pond spike contact subtracting 8 while clamping to at least 1 and relocating Sieg locally. There is no teammate revive command. [Damage](../apps/server/src/GameRoom.ts#L1744), [ambush](../packages/shared/src/prologue.ts#L358), [pond recovery](../apps/server/src/mirrorPond.ts#L120). |
| Enemies | Windups, ranged pressure and vulnerability conditions. | Mosslings use a directional spike windup; Wisps maintain ranged pressure; Sentinels use close melee and a warned beam. Server collision, line of sight and damage timing decide hits. Griffin phases have their own warnings, grounding and pillar rules. [Enemy definitions](../packages/shared/src/enemies.ts#L21), [simulation](../apps/server/src/enemySimulation.ts), [Griffin](../apps/server/src/griffin.ts#L261). |
| Puzzle completion | Different abilities, simultaneous or sustained contributions, persistent quest progress. | Concrete conditions are enumerated below. Not all mechanisms need E held: some latch, and bridge final switches check occupancy only. [Bridge](../packages/shared/src/bridgePuzzle.ts#L314), [inventory claims](../apps/server/src/inventory.ts#L113). |
| Shared inventory | Counts, item descriptions, compatible use, failed-use feedback. | Claim IDs and request receipts prevent duplicate reward/consumption. Key and wig are consumed once on normal gate/offering use. The Griffin's custom grooming handler also consumes its two tools; generic “tools stay owned” prose is not universal. [Inventory](../apps/server/src/inventory.ts#L59), [custom tool consumption](../apps/server/src/griffin.ts#L165). |
| Transitions | E at markers; some individual, some party-wide; progress survives hub travel. | Doors/stairs can relocate one hero. Branch transitions update the shared scene and cache state. Completed Bridge Ruins leads to the shrine. South return leads to Bridge Ruins; no shrine southeast exit currently exists. [Travel](../apps/server/src/GameRoom.ts#L1220), [route map](../packages/shared/src/maps.ts#L46), [current shrine points](../packages/shared/src/shrine.ts#L5). |
| Session recovery | Pauses while a partner is absent; slot reserved 30 s; temporary rooms. | The gameplay tick body returns while disconnected, but `serverTick` increments first. Some absolute-tick timers therefore need separate pause semantics verification; I do not infer that every duration freezes perfectly. Resume uses a private token; expiry removes the slot and returns the room to lobby. [Tick](../apps/server/src/GameRoom.ts#L876), [sessions](../apps/server/src/GameRoom.ts#L332), [expiry loop](../apps/server/src/app.ts#L309). |
| Termination | No single manual-defined bounded episode. | Chapter 0 ends narratively with `chapter0.complete` and story stage `DONE`; this is not automatically world phase `COMPLETE`. Legacy airship/boss code still exists; its boss defeat sets `COMPLETE`, but normal onward travel from the current shrine is missing. The proposed midterm episode stops at bridge completion instead. [Finale](../apps/server/src/chapter0Finale.ts#L79), [legacy boss](../apps/server/src/GameRoom.ts#L1682). |

### Puzzle progression conditions verified in source

- **Bridge:** the boulder must fully occupy plate A and Coco must land an accepted frontal moving-target shot; this latches the first gate. Coco's golden switch latches the spike gate. Plate B supports bridge 2; Coco's accepted frontal shot must originate in bridge 2's rectangle while weight and support are valid. The hit permanently opens the final gates. Both roles then occupy their own final switches for `ticksFor(0.767)`, currently 46 ticks. Earlier unlocks survive local failures. [Source](../packages/shared/src/bridgePuzzle.ts#L314).
- **Maze:** Coco's valid fireball burns the designated bush; Black Hole moves the cow with collision; Sieg claims the wolf's unique key within the normal interaction constraints. The shared key unlocks the gate once; the open gate makes the unique shears chest available. Guard defeat and puzzle actor movement are distinct systems. [Source](../apps/server/src/hedgeMaze.ts#L29).
- **Pond:** only a validated Coco shot from a station's firing neighborhood and incoming direction can acquire a reflection. A reflected swept hit lights an unlit torch; all four set `raised` and complete the pond puzzle. The raised sanctuary makes the unique chest available. Mirrors can obstruct people and rotation is rejected if the new mirror footprint would overlap a player. [Source](../apps/server/src/mirrorPond.ts#L57).
- **Griffin:** Coco's owned-tool delivery starts grooming once the mirror is delivered; missing shears causes a repeated wait/check phase. During cutting both tools are removed, the Griffin departs, and a later nest interaction awards one wig. Defeat offers an alternate nest reward path. The goddess consumes the owned wig once and records the offering as complete. [Nest](../apps/server/src/griffin.ts#L24), [grooming](../apps/server/src/griffin.ts#L119), [offering](../apps/server/src/shrine.ts#L7).

### Discrepancies to resolve rather than conceal

| Reference claim | Verified difference | Documentation status |
| --- | --- | --- |
| Manual describes side-view jumping and a touch Jump button. | Platformer and keyboard jump code remain, but current touch markup has Strike, Guard and Use only. The current shrine has no ordinary onward route to the legacy airship. | Manual sections “Controls at a glance” and “Side view areas” need a scope qualifier. [Markup](../apps/client/index.html#L66), [maps](../packages/shared/src/maps.ts#L289). |
| Older prologue documentation says it is opt-in. | Production entry enables it unless explicitly disabled; title checkpoints can override starts. | Preserve distinction between historical launch notes and current default. [Entry](../apps/server/src/index.ts#L2). |
| README/finale objective says a southeast shrine route continues to Forest Ruins. | No such shrine point or transition remains; the shrine implementation's last paragraph explicitly records shortcut removal. | Campaign continuity beyond Chapter 0 is unresolved; do not promise that route. [Objective](../packages/shared/src/chapter0Finale.ts#L738), [current travel](../apps/server/src/GameRoom.ts#L1234). |
| Older maze notes require both timed abilities and a 42 px catch radius. | Current key interaction uses the general 64 px reach and permits a catch without either timed ability. An explicit test asserts that behavior. | State coordinated pursuit as a useful strategy, not a transaction prerequisite. [Regression](../apps/server/test/hedgeMaze.test.ts#L341). |
| Bridge README/old recording says 23 final-switch ticks and implies holding E. | Current code uses 46 ticks at 60 Hz and role-specific occupancy, without checking E there. | Historical recording timing is not the current rule. [Completion](../packages/shared/src/bridgePuzzle.ts#L408). |
| Bridge specification describes a designated 40 × 40 firing pad. | Current final-target acceptance permits a cast origin anywhere in bridge 2's rectangle, subject to direction, weight and support. | Flag a design-to-code difference, without restoring a restriction during this documentation task. [Acceptance](../packages/shared/src/bridgePuzzle.ts#L448). |
| Pond prose/comment says clockwise rotation at 45 degrees/s. | Current direction depends on which side Sieg stands. The source applies 1.5 degrees per tick at 60 Hz, implying 90 degrees/s absent a modifying execution condition; no timing measurement was performed in this audit. | Direction is `code`; the 90 degrees/s figure is a source-derived calculation, not a fresh gameplay measurement. [Rotation](../apps/server/src/mirrorPond.ts#L79), [step](../packages/shared/src/mirrorPond.ts#L203). |
| Inventory specification says the mirror and shears remain owned. | Current grooming explicitly removes one of each during the CUT phase. | The custom encounter supersedes the generic retention assumption; approval of the intended permanent rule is still needed. [Specification](quests/bald-goddess/phase-2-inventory-design.md#proposed-item-definitions), [implementation](../apps/server/src/griffin.ts#L165). |
| Old `GAMEPLAY.md` describes a sequential skill tree and earlier campaign plans. | The current starting skills and quest plan disable ordinary point/tree progression; branch travel and the finale have evolved. | Treat that file as historical where it conflicts with the manual and current code. [Capability audit](quests/bald-goddess/phase-1-world-plan.md#1-verified-current-capabilities). |

## 5 Rule and source map

Each row uses one required evidence label. Separate rows distinguish a rule specification from its implementation or observation. Line locators refer to the audited source version; named functions and sections remain useful if lines move.

| Rule or design decision | Evidence label | Source locator | Rationale |
| --- | --- | --- | --- |
| Original two-hero fantasy adventure with essential cooperation | `design` | This document §1, recording the supplied midterm design brief | Establish the original concept without claiming invented-from-scratch genre mechanics. |
| Zelda adventure structure is a reference, not inherited rules | `manual` | [Nintendo reference](https://www.nintendo.com/us/store/products/the-legend-of-zelda-links-awakening-switch/) and §2 | Ground the genre comparison in an attributed primary reference. |
| Cooperative philosophy is inspired by It Takes Two | `manual` | [EA/Hazelight reference](https://www.ea.com/games/it-takes-two/it-takes-two/features) and §2 | Attribute the reference without claiming copied levels or mechanics. |
| Two participants, exclusive roles and ready gate | `manual` | [Player manual, Start a two player session](../manual/Oath_and_Ember_Player_Manual.md#start-a-two-player-session) | State the player's entry procedure. |
| Server enforces the two-role lobby | `code` | [GameRoom.add/select/ready, lines 238–315](../apps/server/src/GameRoom.ts#L238) | A second hero is a rule, not only a menu suggestion. |
| Starting abilities are deliberately available without a tree | `design` | [World plan, capability audit](quests/bald-goddess/phase-1-world-plan.md#1-verified-current-capabilities) | Avoid designing required puzzles around inaccessible upgrades. |
| Current skill sets and zero-point reset | `code` | [startingSkills, line 2](../packages/shared/src/abilities.ts#L2); [reset, line 503](../apps/server/src/GameRoom.ts#L503) | Verify what each role can do at episode entry. |
| Speed/time interaction | `manual` | [Manual, Slow Time](../manual/Oath_and_Ember_Player_Manual.md#slow-time) | Explain the complementary timing tool to players. |
| Boosted Sieg moves normally during Slow Time | `code` | [stepMovement, lines 252–267](../packages/shared/src/movement.ts#L252) | Show that the combination follows an explicit rule. |
| Flight cannot bypass solid boundaries | `code` | [flightWalls and stepMovement](../packages/shared/src/movement.ts#L172) | Preserve meaningful routes and obstacles. |
| A normal fireball has finite range and authoritative damage | `code` | [constants, line 28](../packages/shared/src/constants.ts#L28); [cast, line 1111](../apps/server/src/GameRoom.ts#L1111) | Avoid treating a visual spell as unrestricted interaction. |
| One shared backpack with independent selection | `design` | [Inventory design, Ownership and controls](quests/bald-goddess/phase-2-inventory-design.md#ownership-and-controls) | Make item acquisition a party achievement. |
| Item use validates scene, distance, sight and replay | `code` | [InventoryService.use/apply, lines 59–157](../apps/server/src/inventory.ts#L59) | Prevent duplicate rewards and incompatible local outcomes. |
| A single boulder persists through the bridge trials | `design` | [Bridge, Required progression](puzzles/bridge-that-hates-cooperation/README.md#required-progression) | Make movement of the object part of the puzzle. |
| Boulder weight, Coco targets and separate final occupancy | `code` | [heavyOnPlate, line 85](../packages/shared/src/bridgePuzzle.ts#L85); [tickBridgePuzzle, line 314](../packages/shared/src/bridgePuzzle.ts#L314) | Establish genuine role dependencies. |
| Local failures retain earlier bridge unlocks | `code` | [tickBridgePuzzle, lines 341–397](../packages/shared/src/bridgePuzzle.ts#L341) | Limit repetition while preserving the trial's challenge. |
| Earlier bridge run reached completion with no recorded errors | `observed` | [recording-boulder/report.json](puzzles/bridge-that-hates-cooperation/recording-boulder/report.json), `errors`, `events`, `state.complete` | Demonstrate a historical automated route; its 23 ticks are not current timing. |
| Hub branches and offering are original quest arrangements | `design` | [World plan](quests/bald-goddess/phase-1-world-plan.md); [shrine implementation](quests/bald-goddess/shrine-implementation.md) | Connect exploration choices to a shared narrative goal. |
| Branch travel is party-wide; no current southeast exit | `code` | [travel, line 1234](../apps/server/src/GameRoom.ts#L1234); [shrinePoints, line 5](../packages/shared/src/shrine.ts#L5) | State the actual limits of independent exploration. |
| Maze combines combat, route finding and abilities | `design` | [Maze implementation specification](quests/bald-goddess/hedge-maze-implementation.md) | Reuse character identity in several kinds of obstacle. |
| Wolf capture requires Sieg and reach, not active buffs | `code` | [maze reward, line 43](../apps/server/src/hedgeMaze.ts#L43); [test, line 341](../apps/server/test/hedgeMaze.test.ts#L341) | Distinguish a useful cooperative strategy from an enforced gate. |
| Maze recording includes five guards and a shears reward | `observed` | [Maze report](quests/bald-goddess/recording-maze/report.json), `allFiveGuardsDefeated`, `sharedShears`; [method](quests/bald-goddess/recording-maze/README.md) | Retain provenance for an automated replay rather than call it human playtesting. |
| Pond uses real angles and complementary positions | `design` | [Mirror Pond implementation](quests/bald-goddess/mirror-pond-implementation.md) | Require a shared prediction about the spell's path. |
| Reflection validates cast origin; all four torches raise sanctuary | `code` | [tracePondFireball, line 187](../apps/server/src/mirrorPond.ts#L187) | Tie the reward to actual spell interactions. |
| Pond run lights four torches and grants one shared mirror | `observed` | [Pond report](quests/bald-goddess/recording-pond/report.json), `allFourTorchesLit`, `sharedMirror`; [method](quests/bald-goddess/recording-pond/README.md) | Establish an earlier intent-driven traversal, with its manual-clock limitations. |
| Griffin supports combat and nonlethal acquisition | `design` | [Griffin implementation](quests/bald-goddess/griffin-implementation.md) | Give preparation a role alongside combat. |
| Custom grooming consumes tools and awards once after departure | `code` | [nest handler, line 24](../apps/server/src/griffin.ts#L24); [CUT/departure, line 119](../apps/server/src/griffin.ts#L119) | State the current custom transaction rather than obsolete retention prose. |
| Historical Griffin run completes offering using seeded branch tools | `observed` | [Griffin report](quests/bald-goddess/recording-griffin/report.json), `priorBranchToolsFixture`, `goddessComplete` | Supports that fixture's sequence, not an end-to-end campaign claim. |
| Alden's story and individual hero motivations drive progression | `design` | [Part 1](CHAPTER0_PART1.md); [Finale](CHAPTER0_FINALE.md) | Connect objectives to character stakes. |
| Server stores each hero's validated motivation | `code` | [chooseMotivation, line 131](../apps/server/src/chapter0Finale.ts#L131) | Establish personal agency without promising unimplemented branching content. |
| Latest ending fixture reached DONE and closed inventory | `observed` | [qa/end8/qa.json](../qa/end8/qa.json), `errors` and `log`; [driver](../scripts/qa-chapter0-ending.ts) | Verify the isolated scene sequence, not the puzzles skipped by the fixture. |
| Clients submit intent and cannot own outcomes | `design` | [AGENTS.md, lines 3–6](../AGENTS.md#L3); [Networking](NETWORKING.md) | Require one consistent cooperative world. |
| Strict protocol and shared deterministic movement | `code` | [inputSchema, line 18](../apps/server/src/app.ts#L18); [stepMovement, line 185](../packages/shared/src/movement.ts#L185) | Validate actions and keep prediction compatible with authority. |
| Controlled movement recording has bounded measured results | `observed` | [clock-taps VERIFICATION.json](../qa/movement-stability-clock-taps/VERIFICATION.json), `results`; [investigation](MOVEMENT_STABILITY_REPORT.md#follow-up-after-the-402-pm-recording) | Limit smoothness claims to the actual scenarios and measurements. |
| Ordinary recovery and session lifetime | `manual` | [Manual, Health and recovery](../manual/Oath_and_Ember_Player_Manual.md#health-and-recovery); [Connection and session limits](../manual/Oath_and_Ember_Player_Manual.md#connection-and-session-limits) | Give the player a usable account of failure and reconnect behavior. |
| One in-memory service | `design` | [AGENTS.md, line 8](../AGENTS.md#L8) | Keep the project bounded; acknowledge nonpersistent progress. |
| Bridge episode reset and starting geometry already exist | `code` | [walkthrough setup, line 13](../scripts/bridge-walkthrough.ts#L13); [reset, line 397](../apps/server/src/GameRoom.ts#L397); [map, line 199](../packages/shared/src/maps.ts#L199) | Support an independent episode without claiming a new evaluation interface. |
| Proposed midterm limits and observation policy | `assumed` | This document §8 | Make evaluation choices explicit and seek approval before treating them as implemented rules. |
| D1–D11 experiential explanations | `design` | This document §3; designer approval recorded on 22 October 2026 | Record confirmed design intent while keeping empirical outcomes unverified. |

## 6 Intended player experience and evidence limits

I want **adventure and discovery** to come from connected places with readable affordances: houses and stairs, NPC conversations, return markers and a hub whose branches have different obstacles. The quest journal supports orientation. The risk is that objective text and labels disclose too much or contradict removed routes; there is no human evidence yet that discovery and guidance are well balanced.

I want **emotional investment** to come from the relationship established with Alden, the loss that changes the heroes' goal, and the personal motivations chosen by each player. The scripted scenes and role-specific choices exist. Their emotional effect is a hypothesis, not something a passing socket test can validate.

I want **collaborative satisfaction** to come from seeing a joint plan change the world: the boulder provides support while a spell opens a gate; a reflection lights a torch; the shared backpack gains a reward. Unique role checks and synchronized outcomes make that experience possible. They do not prove that both players feel equally engaged.

I want **distinct identities** to remain legible through a small recurring ability set. Communication should concern timing, location, roles and intentions rather than who happens to own a quest item. The same abilities recur across different challenges, so learning can transfer. This benefit and the adequacy of feedback need human validation.

I see **replayability** in exchanging hero roles, improving coordination, trying a different branch order, and comparing combat with the Griffin's peaceful route. There is no verified procedural campaign, persistent metagame, retention study, or implemented consequence tree for the motivation choices. Replay value is an intended opportunity, not a measured result.

These goals express the approved D1–D11 design rationale in experiential terms. Their effects on players still require evidence. The relevant alternative is not necessarily a worse game: identical characters, a linear route or stricter puzzle gates might better serve a different audience. My argument is about suitability for this project's stated cooperative goal.

## 7 Playtesting and iteration

### Current audit results

On 22 October 2026, I reran `npm test` with local socket access against the reviewed tree: **525 passed, 1 failed, across 74 test files**. The failure is the directional sprint-atlas assertion in [playerView.test.ts:510](../apps/client/test/playerView.test.ts#L510), expecting frame 25 and receiving 26. I do not label the suite entirely passing. This is an automated regression run; I did not conduct a fresh human playtest or rerun every recorded browser route for this document. Only documentation was changed.

### Concrete iterations with available evidence

| Iteration | What the record supports | What it does not establish |
| --- | --- | --- |
| Movement scheduling and collision | [The movement investigation](MOVEMENT_STABILITY_REPORT.md) identifies command/tick scheduling, clock corrections, movement epochs and tree collision. The [clock-taps audit](../qa/movement-stability-clock-taps/VERIFICATION.json) records zero correction and zero penetrations in the long-idle/small-tap samples for both clients. It also retains one authoritative reversal in a different loop scenario. | No claim that all latency, combat and refresh situations are correction-free. The report's opening 30 Hz and unbound-Shift description is historical; current constants and controls differ. |
| Persistent bridge object and local retries | The [bridge specification](puzzles/bridge-that-hates-cooperation/README.md) and [regressions](../apps/server/test/bridgePuzzle.test.ts#L196) require physical pushing of the same object, swept collision and recovery without granting progress. The [recording report](puzzles/bridge-that-hates-cooperation/recording-boulder/report.json) records a completed earlier route. | The old 30 Hz recording does not validate the current final-switch tick count or target tolerance. |
| More readable target feedback | Current code reports an invalid-side hit, with a [regression](../apps/server/test/bridgePuzzle.test.ts#L163). [qa/bridge9/qa.json](../qa/bridge9/qa.json) records a later successful front hit after an initial miss. The [driver](../scripts/qa-bridge-target.ts) uses server position/boulder fixtures. | This fixture does not show an unaided player discovering the rule, nor a whole-bridge playthrough. |
| Flexible wolf capture | The [explicit no-buff catch regression](../apps/server/test/hedgeMaze.test.ts#L341) verifies the current proximity rule despite older “both abilities required” prose. The wolf's alert speed still makes time/speed coordination useful in pursuit. | No record establishes why I personally relaxed the transaction or whether it improves the experience. |
| Physical mirror aiming | [Pond updates](quests/bald-goddess/mirror-pond-implementation.md) record continuous angle control, free-travel reflected shots, visible misses and removal of an invisible speed requirement at the spike entrance. Source validates the actual reflection. | No novice aiming-error distribution or real-latency usability study is supplied. |
| Nonlethal Griffin interaction | [Encounter updates](quests/bald-goddess/griffin-implementation.md) record sleeping/waking, warning/beam presentation, grooming and departure changes. The [existing recording](quests/bald-goddess/recording-griffin/report.json) proves an earlier run with branch-tool fixtures; current source includes a later pickup and tool-consumption sequence. | That older recording is not proof of the latest grooming transaction or a full campaign without fixtures. |
| Story continuity and interface control | [qa/end8/qa.json](../qa/end8/qa.json) records inventory closing when the goddess speaks, the revelation–resolve–depart–watcher sequence, and DONE. [The ending driver](../scripts/qa-chapter0-ending.ts) sets up a finale fixture. [Story framing tests](../apps/client/test/storyFraming.test.ts) and [story-version tests](../apps/client/test/storyVersion.test.ts) check presentation and mismatch detection. | These observations do not measure emotional response or demonstrate that all preceding puzzles were solved normally in that run. |

### Automated QA versus human testing

The maze and pond recordings use planned action-intent sequences replayed through the authoritative simulation and real browser rendering. Their READMEs disclose controlled clocks and suppressed neutral browser input. Focused station screenshots use positioning fixtures; the Griffin recording starts with tools earned elsewhere supplied as fixtures. These are useful, reproducible checks, with narrower claims than “two people played the whole game and enjoyed it.”

The movement investigation mentions a user recording and a follow-up report, but it does not supply a structured participant study. I found no documented independent novice sessions, participant counts, interviews, completion-time study, enjoyment ratings, or communication analysis. I should collect those before claiming the cooperative design has been validated with humans.

## 8 Proposed bounded midterm episode

### Selection and status

I propose **The Bridge That Hates Cooperation**, from a fresh `BRIDGE_RUINS` room to its `bridgePuzzle.complete` latch, as the independently evaluated episode. This is an evaluation proposal (`assumed`, for my approval), not a claim that a midterm agent adapter already exists. It demonstrates asymmetric roles, persistent object movement, timing, positional constraints, synchronized outcomes and local recovery without requiring the full narrative campaign.

The game already supports this isolated starting scene through `createApp({ startingScene: "BRIDGE_RUINS", prologue: false })`, used by [the browser walkthrough](../scripts/bridge-walkthrough.ts#L13). This is a developer/test entry point, not a documented production title-screen “Bridge episode” option. The existing title checkpoint called “The Forgotten Shrine” starts earlier story content; it is not equivalent to a fresh bridge room.

### Episode contract

| Component | Implemented foundation and proposed evaluation boundary |
| --- | --- |
| Starting state | Fresh room, Sieg joined first and Coco second, different roles selected, both ready. In this insertion order, initial bridge positions are `(464, 1408)` and `(514, 1408)`. Both have 100 HP, normal starting abilities, empty inventory, no story, no enemies and no solved bridge latches. The boulder starts at `(288, 1408)`, stage 1, zero failures. Trap time advances after play starts; any deterministic seed/initial-clock capture policy must be recorded by a future runner. [Reset](../apps/server/src/GameRoom.ts#L397), [bridge state](../packages/shared/src/bridgePuzzle.ts#L46). |
| Available actions | Normal movement, facing through movement, J attack, K defense, E interaction, Sieg Push and Super Speed, Coco Slow Time/Flight/Black Hole, and ordinary UI access. Unhelpful legal actions remain legal; do not silently disable flight or magic to force an expected route. Both roles must still satisfy server-validated targets and final switch occupancy. |
| Visible observations | Each browser's own camera view, characters, boulder, hazards, role wards, target/gate/bridge feedback, status and objective text, cooldown icons and notices. The runner's internal `World` access is not automatically an allowed player observation. No structured observation schema has been implemented for a model-driven agent. |
| Legal-action constraints | Normal keyboard/UI intent and server validation apply. No direct position/HP/cooldown writes, force-completion flags, altered collision, fixture-latched gates, granted items, or hidden state as policy input. A future interface must specify legal timing, frame grouping and what one model action means. [Input schema](../apps/server/src/app.ts#L18). |
| Success | Stop when `bridgePuzzle.complete === true`, reached by the actual puzzle rules. The last requirement is both role-specific final switch positions for 46 ticks at the current 60 Hz rate. The evaluator may log the authoritative latch as an outcome without exposing it as hidden policy input. Reaching the subsequent story scene or leaving the map is not required. |
| Recoverable failure | Spike contact and unsupported/crowded bridge occupancy increment local failure state and recover actors; earlier completed latches stay. Ordinary HP depletion respawns rather than causing a permanent game over. These are failed attempts within an episode, not automatic episode termination. |
| Proposed episode limit | For my approval: cap an evaluation at **600 active-play seconds**, ending earlier on success, explicit quit, or unrecoverable room/server loss. Record resets/failures and completion time. This cap is not implemented, not justified by a human duration study, and requires a future timer that defines disconnect pauses. No existing universal action budget is claimed. |
| Existing harness limits | The browser walkthrough has per-wait and navigation deadlines and a bounded retry loop; these are automation safeguards, not the proposed 600 s game/evaluation rule. It is a scripted solver that reads server state, not a model-driven player. [Wait helper](../scripts/bridge-walkthrough.ts#L49), [navigation deadline](../scripts/bridge-walkthrough.ts#L85). |
| Excluded content | Prologue, Alden's errand/death/funeral/investigation, the Weeping Angel, Monster Clearing, shrine hub and tool branches, Griffin, ending choices/cinematics, and legacy airship/boss. No campaign-completion claim should be attached to this episode. |
| Restart | Create a fresh bridge room for each evaluated attempt. Reconnecting a reserved hero resumes state; it is not an evaluation reset. The reset protocol and any deterministic initial-clock requirement need to be specified in the future adapter. |

Neither deterministic walkthrough automation nor Socket.IO input support establishes an AI-playing interface. I found no implemented model-policy integration, evaluation action/observation contract, reward adapter or model-run results in the inspected application and scripts. If the midterm requires an AI player, that is outstanding work, not a feature supplied by this documentation.

## 9 Original game statement for the midterm README

> I designed Oath and Ember as an original two-player fantasy action-adventure about Sieg, a swordsman, and Coco, a mage. Zelda inspired its exploration, environmental puzzles and story-led discovery; It Takes Two inspired the goal of making different abilities equally important to cooperation. My contribution is the original world, characters, story and puzzle arrangements that connect physical pushing and speed with magic, flight and time manipulation. The midterm episode I propose is The Bridge That Hates Cooperation, where the heroes must coordinate distinct actions within one shared authoritative world. I use an existing engine and supplied or generated assets with attribution rather than claim every mechanic or asset was invented from scratch.

This is ready to adapt into a midterm README once I approve the proposed episode. The two inspiration citations and repository rule map should accompany it. It does not claim measured human-playtest success or an implemented AI player.

## 10 Missing evidence and decisions for my approval

1. **D1–D11 approved on 22 October 2026.** I confirm these explanations as my design rationale. Claims about player experience remain hypotheses pending human testing; this approval does not approve the separate episode limits or resolve implementation discrepancies.
2. **Confirm the episode.** Approve the fresh-bridge starting contract, success latch, observation restrictions, 600 s proposal and any action budget. Supply the actual course rubric if requirements extend beyond the excerpt in the task brief.
3. **Resolve the listed rules discrepancies.** Decide whether to update the manual/specifications or later change gameplay. This task does neither silently. Priorities are onward shrine travel, wolf catch requirements, final-switch input/timing, final-shot origins, mirror angular speed and Griffin tool retention.
4. **Run documented human sessions.** Recruit at least a clearly reported set of pairs; record experience level, role assignment, hints given, completion/failure counts, time, waiting periods and comments. Ask whether each role felt consequential. The participant plan and success criteria still need approval.
5. **Verify the current whole-bridge route.** Existing historical recordings prove earlier versions. Rerun current browser traversal without state mutations after setup, retain both views and the exact revision, and separately assess human discoverability. Do not replace evidence with a successful unit test alone.
6. **Check ability and agency balance.** Investigate whether the wolf's permissive catch and the Griffin's combat route weaken required cooperation, whether Coco's nest role sidelines Sieg, and whether Flight enables unintended shortcuts. Their impact is not established here.
7. **Repair the known sprint presentation regression.** The current automated suite has one failure; determine whether the expected frame or the implementation is wrong before claiming a clean submission build.
8. **Specify pause and timing semantics.** `serverTick` advances during a disconnected room's early return; test absolute-tick effect expiry and define what “active-play seconds” means in an evaluator. Also measure mirror rotation in a live current build rather than relying on stale speed comments.
9. **Verify platform and network usability.** Human touch-device play, realistic delay/loss, reconnects during puzzles and accessibility have not been established by the reviewed evidence. The touch Jump button described in the manual is absent.
10. **Document inspiration and asset provenance precisely.** Confirm any specific Zelda titles or particular cooperative examples that actually influenced me, if I want to name them. Keep original-game claims separate from library, licensed-asset and generated-art credits.
11. **Implement an AI adapter only if required.** Define observations, legal actions, sampling cadence, reset, termination and logging before a model-driven evaluation; report model results only after running it.
12. **Measure replayability and narrative reception.** Role switching and alternate routes are available opportunities. Claims about emotional engagement, replay value or superiority to the alternatives require evidence that is not currently supplied.

## References and review boundary

Primary inspiration references, consulted 22 October 2026:

- Nintendo, [The Legend of Zelda Link's Awakening official product description](https://www.nintendo.com/us/store/products/the-legend-of-zelda-links-awakening-switch/).
- Electronic Arts / Hazelight, [It Takes Two official features](https://www.ea.com/games/it-takes-two/it-takes-two/features).

Repository review covered the project instructions and early source DOCX; current mechanics manual; gameplay, networking, movement and rendering documentation; Chapter 0 scripts; bridge and goddess-quest specifications; the implementing shared/server/client systems; regression and real-socket tests; QA drivers; retained JSON reports; and the provenance/readme records for recordings and assets. I inventoried the broader repository to locate these sources. I did not independently watch every retained video, inspect every binary asset, or treat historical test counts as current results. The earlier DOCX's sample rates, code and roadmap are reference material, not proof that those choices remain implemented.

This is a documentation-only audit. The copy in `manual/GAME_DESIGN_RATIONALE.md` has the same content as `docs/GAME_DESIGN_RATIONALE.md`; both directories are one level below the repository root, so their relative source links resolve consistently.
