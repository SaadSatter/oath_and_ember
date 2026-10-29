# Oath and Ember: the Bald Goddess episode, played by two AI players

GitHub login: `saadsatter`. Project: **Oath and Ember**, an original two-player fantasy action-adventure. For the midterm, its Bald Goddess quest is played by two independent AI players, one for Sieg and one for Coco, and compared with scripted baselines.

| Deliverable | Where |
| --- | --- |
| Evaluation report | [EVALUATION.md](EVALUATION.md) |
| Agent team log | [AGENT-TEAM.md](AGENT-TEAM.md) |
| Rule and source map | [RULE_SOURCE_MAP.md](RULE_SOURCE_MAP.md) |
| Peer playtest notes | [PEER_NOTES.md](PEER_NOTES.md) |
| Recording | [pilot-11 replay video](https://github.com/SaadSatter/oath_and_ember/blob/midterm/evaluation/docs/midterm/evidence/pilot-11-model-guided/replay.webm): a trace-verified replay of the model-guided baseline (`model-guided`: an LLM with a written Hedge Maze guide in its prompt) succeeding (see [its notes](docs/midterm/evidence/pilot-11-model-guided/README.md)) |
| CI | `.github/workflows/midterm-saadsatter.yml` running [scripts/midterm/ci-checks.sh](scripts/midterm/ci-checks.sh) |
| The game's own README | [GAME_README.md](GAME_README.md) |

## Scope

**The episode.** It starts at the title screen's "The Bald Goddess" chapter start: story stage `GODDESS`, both heroes arriving at the Goddess Shrine. It ends when the story records `chapter0.complete` and players see "CHAPTER 0 COMPLETE".
- In between: the shrine hub, Mirror Pond (the Vanity Mirror), the Hedge Maze (the Enchanted Shears), the Griffin Enclosure (the wig), the offering and the finale.
- Everything is played with the real game rules on the authoritative server.

**Excluded:**
- the prologue, the village and the earlier Chapter 0 parts before the shrine;
- the legacy airship and boss;
- anything after Chapter 0;
- persistence and online matchmaking.

The game itself is larger. The episode is a bounded slice of it, and nothing outside it is evaluated.

**What was adapted for the AI players.** The game was not changed to suit them. A headless interface (`packages/agent/`) drives a real `GameRoom` through five operations: `reset`, `observe`, `legal_actions`, `step` and `outcome`.
- Each hero's observation is built from what that player's screen, dialogue, journal, backpack and HUD show, plus the public [player manual](manual/Oath_and_Ember_Player_Manual.md).
- The HUD's goal lines are hidden from every player.
- Game time runs in lockstep, only while both heroes have an action running, so model latency never changes the game.
- Server changes for evaluation (a deterministic clock and ids, a manual driver, view-only browser sessions) are optional and off in normal play: [SERVER_CHANGES.md](docs/midterm/SERVER_CHANGES.md).

**Original game.** Oath and Ember's world, heroes, story and puzzle arrangements are original. The Legend of Zelda inspired its exploration and puzzle structure; It Takes Two inspired making two different hero roles equally necessary. No specific level, rule or asset was copied from either. Design decisions and their alternatives are recorded in [GAME_DESIGN_RATIONALE.md](docs/GAME_DESIGN_RATIONALE.md) (D1–D11).

## Setup

Every command below runs from `midterms/saadsatter/`, the folder that holds this README.

```sh
cd midterms/saadsatter
node --version                    # must be 24.x (package.json "engines")
npm ci                            # install exactly the locked dependencies
npx playwright install chromium   # only for the browser viewer, its recording and their tests
```

No API key is needed for setup, play, tests or the free evaluation commands.

## Play

```sh
cd midterms/saadsatter
npm run build
npm start                         # http://localhost:3000
```

1. Open two browser windows at http://localhost:3000.
2. In the first, select the story start "The Bald Goddess" and press "Create room".
3. In the second, type the room code into "ROOM CODE" and press "Join".
4. Each player picks a different hero (Sieg or Coco) and presses "Ready for adventure".

Controls are in the [player manual](manual/Oath_and_Ember_Player_Manual.md).

## Test

```sh
cd midterms/saadsatter
bash scripts/midterm/ci-checks.sh            # typecheck, deterministic tests, build: what CI runs
bash scripts/midterm/ci-checks.sh --tests    # tests only
```

The script runs every test except the ones that build or play the held-out scenarios (the full scripted route and its checkpoint freeze, `suite.test.ts`, `finalAccess.test.ts`); [EVALUATION.md](EVALUATION.md#ci-evidence) says why. `npm test` runs everything, held-out tests included.

## Evaluate

Free, offline commands (no model, no key):

```sh
cd midterms/saadsatter

# Scripted quest-aware baseline and exploration baseline on the tuning scenarios, seeds 0 and 1
node --import tsx scripts/midterm/evaluate.ts --player baseline-quest --situations S1,S2,S3 --seeds tuning
node --import tsx scripts/midterm/evaluate.ts --player baseline-explore --situations S1,S2,S3 --seeds tuning

# Both model players end to end with a scripted fake model (free; tests the application, not a model)
npm run eval:live -- --scenario S2-local --seed 0 --player model-memory --gateway mock --no-viewer

# Watch the baseline play in a browser viewer (opens http://localhost:3030/watch)
npm run eval:live -- --scenario S2-local --seed 0 --player baseline-quest
```

Each run writes a hash-chained trace, a summary and results to `evaluation-runs/` and prints where.

**Paid model runs** spend real money and need the owner's key and ledger. They are documented in [LIVE_RUN.md](docs/midterm/LIVE_RUN.md) and [MODEL_BUDGET.md](docs/midterm/MODEL_BUDGET.md). The pilot command, for example:

```sh
npm run eval:live -- --scenario S2-local --seed 0 --player model-memory \
  --gateway openai --model gpt-6-luna --effort medium --max-spend-usd 0.60 --paid --no-viewer
```

It refuses to run without `--paid`, an approved model, a key in `OPENAI_API_KEY` and an initialized spend ledger. Held-out scenarios (S4, F) and final seeds need a recorded owner approval for the exact commit (`scripts/midterm/final-approve.ts`).

## Sources and terms

**Code.** Original project code, written by AI coding agents under the owner's direction (see [AGENT-TEAM.md](AGENT-TEAM.md)). Runtime dependencies are installed from `package-lock.json` and not included:

| Dependency | Licence |
| --- | --- |
| Phaser 4.2.1 | MIT |
| Socket.IO 4.8.3 (server and client) | MIT |
| Express 5 | MIT |
| Zod 4 | MIT |
| `@anthropic-ai/sdk` | Apache-2.0 |

Development tools are listed in `package.json`.

**Assets.** Runtime assets are in `apps/client/public/assets/`. Their licence and provenance files are kept beside them, and the art sources' licence texts are under `Images/`:

| Source | Terms | Records |
| --- | --- | --- |
| Kenney packs (Roguelike Indoors; Impact, Interface, RPG and Sci-Fi sounds) | CC0 1.0 | `apps/client/public/assets/environment/kenney-indoors/License.txt`, `apps/client/public/assets/audio/*-License.txt` |
| Other sound clips (rubberduck, artisticdude, AntumDeluge, Almitory, SketchMan3, HaelDB, EZduzziteh) | CC0, per clip | `apps/client/public/assets/audio/REVISION_2026-10-21.json`, [GAME_AUDIO_INTEGRATION.md](docs/audio/GAME_AUDIO_INTEGRATION.md) |
| LPC house interiors | CC BY-SA 3.0: credit the authors; derivatives use the same licence | `apps/client/public/assets/environment/lpc-interiors/LICENSE-CC-BY-SA-3.0.txt`, `CREDITS-original.txt` |
| Press Start 2P font | SIL Open Font License 1.1 | `apps/client/public/assets/fonts/PressStart2P-OFL.txt` |
| CraftPix packs (forest trees, map, paths, ruins, buildings, an example swordsman) | CraftPix file licence (https://craftpix.net/file-licenses/) | `apps/client/public/assets/environment/trees/License.txt`, `Images/Sprites/**/License.txt` |
| Generated and hand-edited sprites (heroes, enemies, Griffin, items, maps) | Produced for this project; per-asset records | [SPRITE_ASSETS.md](docs/SPRITE_ASSETS.md), [ENVIRONMENT_ASSET_PROVENANCE.json](docs/ENVIRONMENT_ASSET_PROVENANCE.json), [COMBAT_ASSET_PROVENANCE.json](docs/COMBAT_ASSET_PROVENANCE.json), `Images/**/provenance*.json`, `Images/**/PROVENANCE.md` |

**Open for the owner before publication:** the generated sprites' tool terms must be confirmed to permit publication. This is not resolved here.

## Repository and version

The project's history and full evidence live in `SaadSatter/oath_and_ember`, branch `midterm/evaluation`. This folder is generated from one of its commits by `scripts/midterm/package_submission.py`; the commit is in `SUBMITTED_COMMIT.txt`. Large art sources and historical QA captures are not copied: [MANIFEST.txt](MANIFEST.txt) lists what is included and why.
