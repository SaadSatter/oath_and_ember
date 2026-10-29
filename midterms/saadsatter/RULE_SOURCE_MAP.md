# Rule and source map: the Bald Goddess episode

Each rule of the evaluated episode carries one evidence label:

| Label | Meaning |
| --- | --- |
| `code` | Implemented and enforced by the server or the evaluation runner, at the cited location |
| `manual` | Stated to players in the public player manual |
| `observed` | Seen in a recorded run, test or trace |
| `assumed` | Believed but not verified |
| `design` | The owner's own design decision; Oath and Ember is an original game, so its rules are design |

Line locators were checked against the source at the commit this folder was packaged from (`SUBMITTED_COMMIT.txt`). Function names stay useful if lines move. Paths are relative to this folder.

Sources reused:
- the designer's rule verification and map in [GAME_DESIGN_RATIONALE.md §4–§5](docs/GAME_DESIGN_RATIONALE.md#4-formal-rules-and-manual-verification), approved on 22 October 2026;
- design decisions D1–D11 in the same file, §3.

That file's §8 proposes an earlier episode (the Bridge); the owner replaced it with the episode below (see [REQUIREMENTS_CHECKLIST.md](docs/midterm/REQUIREMENTS_CHECKLIST.md)).

## Episode bounds

| Rule | Label | Locator |
| --- | --- | --- |
| The episode is the Bald Goddess quest, chosen as one bounded episode of a larger campaign | `design` | [CLAUDE.md, "The evaluated episode"](CLAUDE.md); [REQUIREMENTS_CHECKLIST.md, 1b](docs/midterm/REQUIREMENTS_CHECKLIST.md) |
| Start: the title screen's "The Bald Goddess" checkpoint (story stage `GODDESS`, both heroes at the shrine) | `code` | [storyCheckpoints.ts, `goddess`, line 34](packages/shared/src/storyCheckpoints.ts#L34); [environment.ts `reset`, line 269](packages/agent/src/environment.ts#L269) |
| Success: the story records `chapter0.complete`; players see "CHAPTER 0 COMPLETE" | `code` | [chapter0Finale.ts, `FINALE`, line 38](packages/shared/src/chapter0Finale.ts#L38); [evaluator.ts, success check, line 48](packages/agent/src/evaluator.ts#L48) |
| Excluded: prologue, village, earlier chapters, the airship and legacy boss, campaign beyond Chapter 0 | `design` | [README.md, "Scope"](README.md#scope) |
| The full episode can be finished through the interface alone (scripted route, tick 12,412) | `observed` | [ROUTE_LOG.md](docs/midterm/ROUTE_LOG.md); [evidence/route/seed1](docs/midterm/evidence/route/seed1/) |
| The owner finished the full episode by normal play | `observed` (owner report, no recording) | [2026-10-27-owner-full-episode.md](docs/midterm/playtests/2026-10-27-owner-full-episode.md) |

## Heroes, controls and abilities

| Rule | Label | Locator |
| --- | --- | --- |
| Two players, two different heroes (Sieg, Coco), both ready before play | `manual` | [Manual, "Start a two player session"](manual/Oath_and_Ember_Player_Manual.md#start-a-two-player-session) |
| The server enforces unique roles and two ready players | `code` | [GameRoom.ts `add` line 243, `select` line 283, `ready` line 310](apps/server/src/GameRoom.ts#L243) |
| Complementary heroes with role-locked abilities | `design` | [D1](docs/GAME_DESIGN_RATIONALE.md#d1-complementary-protagonists) |
| Starting skills per role, with no skill tree in this episode | `code` | [abilities.ts `startingSkills`, line 2](packages/shared/src/abilities.ts#L2) |
| Walking speed 190 world units/s, 32 px tiles, normalized diagonals | `code` | [constants.ts, line 9](packages/shared/src/constants.ts#L9); [movement.ts `stepMovement`, line 185](packages/shared/src/movement.ts#L185) |
| Super Speed doubles movement for 10 s, then 5 s recharge; during Slow Time it restores Sieg's normal speed | `manual` | [Manual, "Push and Super Speed"](manual/Oath_and_Ember_Player_Manual.md#push-and-super-speed) |
| Boosted Sieg moves at normal speed during Slow Time | `code` | [movement.ts, sprint handling, line 236](packages/shared/src/movement.ts#L236) |
| Slow Time: 10 s at one fifth speed, 20 s cooldown from cast | `manual`, `code` | [Manual, "Slow Time"](manual/Oath_and_Ember_Player_Manual.md#slow-time); [GameRoom.ts, cast, line 909](apps/server/src/GameRoom.ts#L909) |
| Flight crosses water and gaps, not solid walls | `manual`, `code` | [Manual, "Flight"](manual/Oath_and_Ember_Player_Manual.md#flight); [movement.ts `flightWalls`, line 172](packages/shared/src/movement.ts#L172) |
| Black Hole: a shot that becomes a short-lived vortex pulling things in | `manual`, `code` | [Manual, "Black Hole"](manual/Oath_and_Ember_Player_Manual.md#black-hole); [blackHole.ts, tuning, line 1](packages/shared/src/blackHole.ts#L1) |
| Guarded damage is one quarter; at 0 HP a hero is restored to full health at the area's spawn | `manual`, `code` | [Manual, "Health and recovery"](manual/Oath_and_Ember_Player_Manual.md#health-and-recovery); [GameRoom.ts `damage`, line 1753](apps/server/src/GameRoom.ts#L1753) |
| Clients send intent only; the server owns position, HP, damage, puzzles, items and cooldowns | `design`, `code` | [AGENTS.md](AGENTS.md); [app.ts input schema, line 19](apps/server/src/app.ts#L19) |

## Shrine hub, items and the three branches

| Rule | Label | Locator |
| --- | --- | --- |
| A shrine hub with three branches (Mirror Pond, Hedge Maze, Griffin Enclosure) and an offering to the goddess | `design` | [D5](docs/GAME_DESIGN_RATIONALE.md#d5-the-goddess-shrine-hub-and-three-branches) |
| Shrine exits and travel; branch travel moves the whole party | `code` | [shrine.ts `shrinePoints`, line 5](packages/shared/src/shrine.ts#L5); [GameRoom.ts `transition`, line 559](apps/server/src/GameRoom.ts#L559) |
| One shared backpack for the party, with local item selection | `design`, `code` | [D2](docs/GAME_DESIGN_RATIONALE.md#d2-shared-quest-inventory); [inventory.ts `InventoryService`, line 22; `use`, line 59](apps/server/src/inventory.ts#L22) |
| Item use checks scene, distance, line of sight and duplicate requests | `code` | [inventory.ts, line 59](apps/server/src/inventory.ts#L59) |

## Hedge Maze (Enchanted Shears)

| Rule | Label | Locator |
| --- | --- | --- |
| The maze mixes route finding, guards, a burnable hedge, a movable cow and a fleeing key carrier | `design` | [D6](docs/GAME_DESIGN_RATIONALE.md#d6-hedge-maze) |
| Coco's fireball burns the dry hedge | `code` | [hedgeMaze.ts, contact and `burned`, lines 142–155](apps/server/src/hedgeMaze.ts#L142) |
| Black Hole pulls the cow aside, with collision | `code` | [hedgeMaze.ts, cow pull, line 165](apps/server/src/hedgeMaze.ts#L165) |
| The wolf flees reachable heroes, outruns even boosted Sieg, and is slowed by Slow Time | `code` | [hedgeMaze.ts `mazeWolf`, line 248](apps/server/src/hedgeMaze.ts#L248); [hedgeMaze.test.ts, line 174](apps/server/test/hedgeMaze.test.ts#L174) |
| Only Sieg can take the key from the wolf, within normal reach | `code` | [hedgeMaze.ts, key target, lines 36–56](apps/server/src/hedgeMaze.ts#L36) |
| The key opens the gate once; the open gate makes the shears chest available | `code` | [hedgeMaze.ts, gate line 58, chest line 67](apps/server/src/hedgeMaze.ts#L58) |
| Taking the key does not require both timed abilities to be active (older notes said it did) | `code` | [hedgeMaze.test.ts, line 253](apps/server/test/hedgeMaze.test.ts#L253); discrepancy recorded in [GAME_DESIGN_RATIONALE.md §4](docs/GAME_DESIGN_RATIONALE.md#discrepancies-to-resolve-rather-than-conceal) |
| The model-guided baseline (an LLM with a written maze guide) solved the maze (pilots 11 and 12) | `observed` | [evidence/pilot-11-model-guided](docs/midterm/evidence/pilot-11-model-guided/README.md); [EVALUATION.md](EVALUATION.md) |

## Mirror Pond (Vanity Mirror)

| Rule | Label | Locator |
| --- | --- | --- |
| Sieg turns mirrors, Coco fires from flight positions, reflected spells light four torches | `design` | [D7](docs/GAME_DESIGN_RATIONALE.md#d7-mirror-pond) |
| Mirror rotation, rejected if the mirror would overlap a hero | `code` | [mirrorPond.ts, rotation, lines 72–86](apps/server/src/mirrorPond.ts#L72) |
| Only a valid reflected shot lights a torch; all four raise the sanctuary and make the chest available | `code` | [mirrorPond.ts `tracePondFireball`, line 178; chest, line 43](apps/server/src/mirrorPond.ts#L178) |

## Griffin Enclosure, offering and finale

These cover the held-out scenarios S4 and F. They are listed from the design record and source locations only; this session did not re-audit their details.

| Rule | Label | Locator |
| --- | --- | --- |
| The Griffin can be fought or handled peacefully with the branch tools | `design` | [D8](docs/GAME_DESIGN_RATIONALE.md#d8-griffin-enclosure) |
| Nest transactions and the encounter's phases | `code` | [griffin.ts `ensureGriffin`, line 24; `tickGriffin`, line 261](apps/server/src/griffin.ts#L24) |
| The goddess accepts the wig as the offering | `code` | [shrine.ts, offering target, line 13](apps/server/src/shrine.ts#L13) |
| The finale's trials and the heroes' individual motivation choices | `design`, `code` | [D3](docs/GAME_DESIGN_RATIONALE.md#d3-story-as-motivation); [chapter0Finale.ts, line 71; `chooseMotivation`, line 131](apps/server/src/chapter0Finale.ts#L71) |

## Evaluation interface (the AI players' rules)

| Rule | Label | Locator |
| --- | --- | --- |
| Five operations: `reset`, `observe`, `legal_actions`, `step`, `outcome` on a real `GameRoom` | `code` | [environment.ts `GameInterface`](packages/agent/src/environment.ts#L103); [AGENT_INTERFACE.md](docs/midterm/AGENT_INTERFACE.md) |
| An observation holds only what that hero's screen, dialogue, journal, backpack and HUD show, plus the manual | `design`, `code` | [perception.ts `perceive`, line 448](packages/agent/src/perception.ts#L448); [environment.test.ts, "player isolation and hidden information"](packages/agent/test/environment.test.ts) |
| The HUD goal lines are hidden from every player (a documented restriction) | `design` | [REQUIREMENTS_CHECKLIST.md, owner decisions](docs/midterm/REQUIREMENTS_CHECKLIST.md#owner-decisions-in-force-2026-10-27) |
| The legal actions are rebuilt each turn; every action is validated before it reaches the game | `code` | [actions.ts `legalActions` line 80, `validate` line 141](packages/agent/src/actions.ts#L80) |
| Messages: up to 200 characters, 64 per hero, delivered only to the partner | `code` | [actions.ts, line 21](packages/agent/src/actions.ts#L21); [environment.test.ts, "delivers messages only to the partner"](packages/agent/test/environment.test.ts) |
| Game time runs only while both heroes have an action running (lockstep), so results do not depend on model latency | `code` | [environment.ts, scheduling](packages/agent/src/environment.ts); [environment.test.ts, "shared clock scheduler"](packages/agent/test/environment.test.ts) |
| Tick, decision, model-call, token, spend, per-call timeout and wall-clock limits, with explicit terminal reasons; failed calls count | `code` | [budget.ts `ModelBudget`, line 161](packages/agent/src/budget.ts#L161); [runner.ts `runEpisode`, line 41](packages/agent/src/runner.ts#L41); [budget.test.ts](packages/agent/test/budget.test.ts) |
| Scenario limits, tuning seeds 0–1, final seeds 100–101, S4 and F held out | `design` | [EVALUATION_SUITE.md](docs/midterm/EVALUATION_SUITE.md); [suite.ts `SITUATIONS` line 133, `SEEDS` line 174](packages/agent/src/suite.ts#L133) |
| How long a human pair needs for the episode | `assumed` | Not measured. The suite's game-time limits come from scripted-route timings, not a human study |

## Known discrepancies

Unresolved differences between older documents and the current code are listed in [GAME_DESIGN_RATIONALE.md §4, "Discrepancies to resolve rather than conceal"](docs/GAME_DESIGN_RATIONALE.md#discrepancies-to-resolve-rather-than-conceal). They include the wolf's catch rule, Griffin tool retention, the manual's jump control and shrine travel beyond Chapter 0. None was changed for the midterm.
