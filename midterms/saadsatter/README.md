# Oath and Ember — declared A/B/C evaluation

GitHub login: `saadsatter`. **Oath and Ember** is an original cooperative
two-character fantasy action-adventure. The implemented Bald Goddess quest is
playable from the goddess checkpoint to Chapter 0 completion.

**Declared evaluation scope (2026-11-06):** three bounded tasks from that quest:
A — Hedge Maze; B — Griffin Trial, Unprepared; C — Griffin Trial, Prepared.
Each has pre-tuned model, post-tuned model and free scripted-baseline conditions,
with two repetitions per cell. **Declaration is not completed evaluation:** A is
frozen and has Pilot-30 evidence; new B/C checkpoints/integration are pending.
No new paid run is authorized by these documents.

| Deliverable | Where / status |
| --- | --- |
| Current declared suite and comparison | [EVALUATION.md](EVALUATION.md); only A/pre/1 has an observed result |
| Declaration and machine records | `docs/midterm/DECLARED_EVALUATION_SUITE.md`; `docs/midterm/evaluation-abc/declaration.json` and `declared-results.json` (included after course packaging) |
| Agent-team log | [AGENT-TEAM.md](AGENT-TEAM.md) — owner-authored completion still required |
| Rules/source map | [RULE_SOURCE_MAP.md](RULE_SOURCE_MAP.md) |
| Human playtest notes | [PEER_NOTES.md](PEER_NOTES.md) — scaffold, not completed evidence |
| Full live model recording | [Pilot-30 evidence/video](evidence/traces/pilot-30-model-centralized-S2-local-seed0/README.md); about 32.7 minutes, not yet the required 3–5 minute submission video |
| Preserved historical evaluation | [EVALUATION_HISTORY_BEFORE_ABC_DECLARATION.md](EVALUATION_HISTORY_BEFORE_ABC_DECLARATION.md) — older versions/results, not pooled with current suite |
| CI | Source template `ci/midterm-saadsatter.yml`; packaged to course `.github/workflows/midterm-saadsatter.yml`. Latest-green CI still pending |
| Game's own README | [GAME_README.md](GAME_README.md) (created during packaging) |

## Scope

**A — Hedge Maze:** frozen S2-local v2 seed 0. Obtain Enchanted Shears through
normal play. Pilot-30 succeeded in 89.5 game seconds, 167 model calls and an
estimated $0.443258. It is a preserved, development-informed pre-solution-prompt
pilot, not a historically preregistered final run.

**B — Griffin Trial, Unprepared:** start at a fresh encounter without the Mirror,
Shears or wig. Defeat the Griffin and acquire the wig; no hero knockout and no
leaving the enclosure before success.

**C — Griffin Trial, Prepared:** near-matched encounter/hero conditions, but the
shared bag contains the Mirror and Shears. Same strict combat-defeat plus wig
objective. C is reserved from model-outcome tuning; post-tuned C transfers only
guidance frozen from A/B, with no C-specific walkthrough. The tools' peaceful
reward path does not satisfy strict defeat; see [EVALUATION.md](EVALUATION.md).

The selected model player is **one centralized planner for both heroes**, with
only their normal observations and legal controls. The cheap comparator is the
existing solution-aware `baseline-quest`; this asymmetry and its expected strict
Griffin failures are disclosed. Legal B/C preparation must preserve all world
consequences, not manufacture inventory-only fixture states. The final hashes
and exact matching remain unverified until approved certification.

The full game also includes the shrine hub, Mirror Pond, prologue and finale.
Those remain playable context or historical supplementary evaluations, not
additional current suite cases. No airship/legacy-boss, persistence or online
matchmaking expansion is part of this scope. The five-operation adapter drives
the authoritative server without changing the game's rules.

The owner must post this scope revision in the Week 3 discussion thread and
finish the human playtest/reflection and course PR requirements. Those external
or personally authored steps have not been performed by this agent.

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

Read [EVALUATION.md](EVALUATION.md) before running anything. B/C logical IDs in
the declaration are **not yet registered runner scenarios**. No command below
starts a paid model.

```sh
cd midterms/saadsatter
# Existing free reference on frozen A; creates a new run, does not overwrite Pilot-30.
node --import tsx scripts/midterm/evaluate.ts --player baseline-quest --situations S2-local --seeds 0
```

At the current gameplay snapshot, the A reference succeeds in 3,128 ticks /
52.1 game seconds with pinned end hash `6644f2ca…f56`. That historical reference
is not silently counted as a new declared baseline trial. New scenario
registration/certification, post-tuned prompt freeze and any paid evaluation
require separate approval. Full evidence and model settings are linked from
[EVALUATION.md](EVALUATION.md). The exact source/asset packaging procedure is
`scripts/midterm/package_submission.py`; use a committed revision and rehearse
in a separate course checkout, never overwrite another project's folder.

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
