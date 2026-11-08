# Oath and Ember

GitHub login: `saadsatter`. **Oath and Ember** is an original cooperative two-hero fantasy action-adventure. Sieg (sword) and Coco (magic) play on an authoritative Socket.IO game server. The Bald Goddess quest is playable from the goddess checkpoint to "Chapter 0 complete". For the midterm, AI players control both heroes through a five-operation interface (reset, observe, legal_actions, step, outcome). They are compared with free scripted baselines on three declared situations.

| Deliverable | Where |
| --- | --- |
| Evaluation report | [EVALUATION.md](EVALUATION.md): declared suite, comparison table, design choices, CI evidence, limitations |
| Agent-team log | [AGENT-TEAM.md](AGENT-TEAM.md) |
| Rule/source map | [RULE_SOURCE_MAP.md](RULE_SOURCE_MAP.md) |
| Peer notes | [PEER_NOTES.md](PEER_NOTES.md). No class time was available for a classmate playtest, so human playtests with friends serve as the peer notes; the professor allows a non-classmate playtester. Session 2 (7 November, about 1 hour) was **unassisted** on the current build and reached Chapter 0 complete. Session 1 (2 November) was assisted, on an earlier build; this is disclosed |
| Recording (4 min) | **[Pilot-39 continuous showcase](https://drive.google.com/file/d/1gdwVPO4_xMDQnH0v7ETj5DDXnfqUBLcR/view?usp=drive_link)**. Two AI players go from the Goddess Shrine through the Hedge Maze and defeat the Griffin in combat, then return the wig. It is a trace-verified **replay** of the recorded actions (no model calls). The run is gameplay-complete; its recorded result is `success: false`, because the token limit ended it during the finale dialogue ([details](evidence/showcase/pilot-39-original/README.md)) |
| CI | `.github/workflows/midterm-saadsatter.yml` runs `scripts/midterm/ci-checks.sh`; green for this submission ([EVALUATION.md, CI evidence](EVALUATION.md#ci-evidence)) |
| Evidence | [evidence/README.md](evidence/README.md): traces, summaries, SHA-256 manifest |
| Game's own README | [GAME_README.md](GAME_README.md) |

## Scope

The declared suite (`oath-ember-abc-2026-11-06`, revision r11) has three situations from the Bald Goddess quest. Each tests a different capability:

| Situation | Tests | Start | Success |
| --- | --- | --- | --- |
| **A — Hedge Maze** (`S2-local`, seed 0) | Puzzle solving | Both heroes at the maze entrance after normal travel | Enchanted Shears in the shared backpack |
| **B — Griffin, unprepared** (`griffin-unprepared-return-v1`, seed 0) | Combat | Fresh 640-HP Griffin; no Mirror, Shears or wig | Griffin defeated (HP 0), wig claimed, offered at the goddess, `chapter0.complete`; no knockout |
| **C — Griffin, prepared** (`griffin-prepared-return-v1`, seed 0) | Inventory reasoning | B's start with the Vanity Mirror and Enchanted Shears in the backpack | Wig claimed by any normal route, offered, `chapter0.complete`; no knockout |

Each situation has three conditions: pre-tuned model, post-tuned model and a free deterministic baseline, with one primary run each. All nine cells have a recorded outcome:

| | Pre-tuned model | Post-tuned model | Baseline |
| --- | --- | --- | --- |
| A | Fail (Pilot-28, stopped at the cow) | Success (Pilot-30, 89.5 game-s) | Success (31.5 game-s) |
| B | Fail (Pilot-31, knocked out; ran on the older enclosure-only start, disclosed in EVALUATION.md) | Success (Pilot-33, 51.0 game-s); earlier v1 attempt Pilot-32 failed | Success (89.8 game-s) |
| C | Success, peaceful route (Pilot-34, 133.3 game-s) | Success, peaceful route (Pilot-35, 56.3 game-s) | Success, combat route (89.8 game-s) |

The model player is one centralized planner (OpenAI `gpt-6-luna`, medium effort) that orders both heroes, each through its own legal controls. It has no repository, shell or evaluator access. The baselines are rule-aware heuristics with per-hero map memory and zero model calls. Full numbers, tuning disclosures and caveats (one run per cell, so this is not a statistical result) are in [EVALUATION.md](EVALUATION.md).

**Included:** the playable game (prologue, shrine hub, Mirror Pond, Hedge Maze, Griffin, finale), the agent interface and players, the baselines, the evaluation harness, traces and tests. The continuous Pilot-39 showcase is a separate, prompt-tuned demonstration, excluded from the A/B/C comparison.

**Excluded:** persistence, online matchmaking, and any further chapters. The five-operation interface drives the real game server and does not change the game's rules.

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

All commands run from `midterms/saadsatter/`. Each opens a read-only viewer and saves the trace, summary and a `recording.webm` in the printed output folder.

**Baselines (free, deterministic, no API key):**

```sh
cd midterms/saadsatter
npm run eval:live -- --scenario S2-local --seed 0 --player baseline-maze-heuristic                         # A
npm run eval:live -- --scenario griffin-unprepared-return-v1 --seed 0 --player baseline-griffin-heuristic  # B
npm run eval:live -- --scenario griffin-prepared-return-v1 --seed 0 --player baseline-griffin-heuristic    # C
```

**Model player, free check (no API key):** the same planner and interface, driven by a mock gateway that picks random legal actions. It shows the pipeline running end to end; it is not expected to succeed.

```sh
npm run eval:live -- --scenario S2-local --seed 0 --player model-centralized --gateway mock
```

**Model player, paid (needs an OpenAI key):** each paid episode reserves its cap in a local spend ledger first. Initialize the ledger once, then supply the key through `OPENAI_API_KEY` or the hidden prompt, never as an argument.

```sh
node --import tsx scripts/midterm/ledger.ts init
npm run eval:live -- --scenario S2-local --seed 0 --player model-centralized \
  --gateway openai --model gpt-6-luna --effort medium --max-batch 4 --max-spend-usd 0.75 --paid
```

**Verify a recorded model run without calling a model:** the replay re-submits the run's recorded actions to the real game server and checks every step against the trace.

```sh
node --import tsx scripts/midterm/replay-video.ts evidence/traces/pilot-30-model-centralized-S2-local-seed0/trace.jsonl --check-only
# REPLAY MATCHES THE TRACE: start hash, 644 step results, end (success, 6deca1132fc2e626) and 5369 ticks.
```

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
| CraftPix packs (forest trees, map, paths, ruins, buildings, an example swordsman) | Free downloads under the [CraftPix file licence](https://craftpix.net/file-licenses/), section 2, "Freebie products": use in personal and commercial projects is permitted (2.1.1); the assets may be modified and included in game projects (2.1.2); games with the assets may be sold and distributed (2.1.3). No attribution is required; CraftPix is credited here anyway | `apps/client/public/assets/environment/trees/License.txt`, `Images/Sprites/**/License.txt` |
| Generated and hand-edited sprites (heroes, enemies, Griffin, items, maps) | The developer's own work, made for this project (owner statement); per-asset records | [SPRITE_ASSETS.md](docs/SPRITE_ASSETS.md), [ENVIRONMENT_ASSET_PROVENANCE.json](docs/ENVIRONMENT_ASSET_PROVENANCE.json), [COMBAT_ASSET_PROVENANCE.json](docs/COMBAT_ASSET_PROVENANCE.json), `Images/**/provenance*.json`, `Images/**/PROVENANCE.md` |

## Repository and version

The project's history and full evidence live in `SaadSatter/oath_and_ember`, branch `midterm/evaluation`. This folder is generated from one of its commits by `scripts/midterm/package_submission.py`; the commit is in `SUBMITTED_COMMIT.txt`. Large art sources and historical QA captures are not copied: [MANIFEST.txt](MANIFEST.txt) lists what is included and why.
