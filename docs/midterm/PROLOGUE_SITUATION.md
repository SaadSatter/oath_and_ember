# P1 — Into the Forest (version 1, frozen 2026-11-03)

P1 is a **directed narrative and navigation** situation in the Prologue. It sits alongside the frozen Hedge Maze Situation A (S2-A).

- **Design and approval.** The design is [PROLOGUE_SITUATION_PROPOSAL.md](PROLOGUE_SITUATION_PROPOSAL.md). The owner approved implementing it on 2026-11-03, with the configuration below.
- **Who built it and what ran.** The Claude Code implementation agent built it. No paid model call was made, no held-out start was built, and nothing was pushed.
- **Three-situation requirement.** P1 does not satisfy it. See "Rubric status".

- **Code:** [`packages/agent/src/prologueSituation.ts`](../../packages/agent/src/prologueSituation.ts) holds the frozen definition. The scenario itself is `P1` in `suite.ts` and `evaluator.ts`.
- **Tests:** [`packages/agent/test/prologueSituation.test.ts`](../../packages/agent/test/prologueSituation.test.ts).
- **Free check script:** [`scripts/midterm/prologue-situation.ts`](../../scripts/midterm/prologue-situation.ts).

**Definition hash** (SHA-256 of the canonical definition): `baa6b04b7de3d56e479cbb092d5d8a10875a290c89748b836917e32a895f73ac`. The test pins it. Any change to the start, success rule, limits, observation contract, prompts or baseline reference changes this hash and fails CI. Such a change is a new revision of P1, recorded with the owner's approval. It is never folded into version 1.

## How P1 differs from the Hedge Maze

The Hedge Maze situations test spatial puzzle solving: combat, Push and Black Hole on a large body, chasing and timing. P1 has no puzzle and no combat. The players must:
- read the story's dialogue and the quest journal;
- notice what the world shows (a shop door, road signs, an unmarked cart);
- go where the story points, across four areas.

The game gives no goal line to agents. Its Prologue was built as a guided sequence, so P1 tests directed, narrative-following play, not search.

## The approved configuration

| | Value | Source |
| --- | --- | --- |
| Start | The `prologue` title-screen checkpoint: the game's own opening (`beginPrologue`). Sieg is outside the shop on the road (Main house, 760, 490 px); Coco is inside with Alden (Alden's Magic Shop, 590, 322 px). Story stage `ARRIVAL`, no flags, empty backpack. No prefix and no fixture | Owner |
| End (success) | The authoritative story stage is `WOODS` or later. The game sets it, and moves the party into the Mossling Woods, when a hero presses E at the Forest Trail's exit after the cart has been found (`storyTravel`, `apps/server/src/prologue.ts`) | Owner: "the game's existing authoritative transition" |
| Game time | 10,800 ticks (180 s) | Owner |
| Model calls | 250 per hero, failed and timed-out calls included | Owner |
| Wall clock | 3,600 s for model players, 600 s for scripted players | Owner (model); harness default (scripted) |
| Spend cap | $0.60 per episode (`EPISODE_CAP_USD.P1`). A run may lower it, never raise it | Owner |
| Decisions | 1,600 per hero | Retained: S2-A's existing value |
| Tokens | 4,000,000 per hero | Retained: S2-A's existing value |
| Per-call timeout and failures | 30 s, SDK retries off; 3 consecutive policy failures end the episode with `error` | Retained |
| HUD goal lines | Hidden from every player | Owner |
| Briefing | None. No tutorial block, no walkthrough. Model players get the normal system prompt and the player manual only | Owner |
| Seeds | Tuning seeds 0 and 1 | As for S2-A |

**Terminal reasons:** `success`, `tick_limit`, `decision_limit`, `model_call_limit`, `token_limit`, `spend_limit`, `wall_clock_limit`, `error`, `manual_stop`. All are enforced and logged by the existing runner and budget.

**No limit was changed.** The decision and token limits were not part of the approval. P1 uses S2-A's existing values, as the owner instructed.

## Does success need both heroes? No.

Checked in the code (`apps/server/src/prologue.ts`, `tickStory` and `storyTravel`) and by test:

- **Sieg is required.** The story starts only when Sieg is inside the shop (`role === "OATH"`), and three lines of the road scene are his inner narration, which only he can read. With both heroes idle, nothing starts: the episode ends at the tick limit, still in `ARRIVAL`.
- **Coco's participation is not required for success.** Every later trigger accepts either hero:
  - reaching the road;
  - E at "← FOREST";
  - coming within 96 px of the cart;
  - E at the trail's exit.

  The game also brings Coco along for each scene and each journey. The test runs Sieg's scripted baseline with a Coco who only waits, and P1 still succeeds.
- **This is preserved as built.** No cooperation requirement was added. It is P1's main limitation as a two-player evaluation: it measures whether the players can follow a directed story, not whether they cooperate.

## What agents observe in P1

Everything below comes from the actual game state and the client's own drawing rules. Code: `perception.ts` (`prologueProps`) and `actions.ts` (`localTalk`). They apply to the Prologue's stages only, so every other situation's observations are unchanged; the frozen hashes are tested.

**Shown, as a human player sees it:**
- the screen grid, partner, abilities, quest journal and dialogue, as in every situation (inner narration only to its own hero; the partner sees the neutral line and cannot move it on);
- **Main house:**
  - `door`, the shop's front door. It is drawn as house art with no label; the name is the owner's wording;
  - the road signs `EMBERBROOK →` and `← FOREST`, which the client draws while the roads are closed;
  - `garden gate (open)`, the fence's one opening;
- **Alden's Magic Shop:** `door` (the doorway out), `E · UPSTAIRS` and Alden;
- **Forest Trail:**
  - `tipped cart`. The cart is unlabelled art; the name is the owner's wording;
  - `crates` and `barrel` with their drawn `E · INSPECT`;
  - `E · FOLLOW THE TRACKS`, listed only once the cart has been found, as the client draws it;
- **Alden**, wherever the story puts him, as a `creature` (screen mark `C`), with `E Talk` while in reach;
- **E at Alden, or at the trail's crates or barrel,** opens a dialogue box in the client and sends nothing to the server. The interface returns the same pages as feedback and changes nothing in the game (tested).

**Not given:**
- the HUD goal line or the map hint line;
- story flags, stage names or scene ids;
- future dialogue: no line from a scene that has not played reaches either hero (tested over a whole episode);
- hero ids, the room code and state hashes;
- the scripted route;
- signposts the client does not draw: no label on the cart or the clearing, and no trail exit before the cart is found.

**One addition to flag for review: the garden gate.**
- The shop's garden fence has a single opening, 32 px wide (`aldenYardFenceSolids`: x 464–496 at y 432). It lies exactly between two tile centres.
- The grid shows what lies at each tile's centre (the rule every situation uses), so it draws the fence as unbroken `#`. The picture shows the gap.
- Rather than change the grid rule, which would move every frozen hash, P1 lists the opening as `garden gate (open)` and marks its cell `o`.
- The opening leaves only about 6 px of clearance on each side, so a player must line up with it. That is part of the game, not of the interface.

## Scripted baseline

`baseline-quest` plays P1 through the same five operations as the model players, from each hero's own observation. Its Prologue knowledge is a disclosed route: `PROLOGUE` in `policies/questKnowledge.ts`, SHA-256 `3594738b…6f5`. It was worked out from the story code and the static map geometry.

The route:
1. Sieg walks along the road to the garden gate, through it to the door, and presses E.
2. Inside, the visit scene plays (Sieg presses on each line). Sieg goes out of the door.
3. Sieg walks back through the gate to the road, where the fork scene plays, then presses E at `← FOREST`.
4. On the trail, Sieg walks toward the cart until its scene plays, then to the trail's exit, and presses E.

Coco leaves the shop after the visit and otherwise waits; the game brings her along. The baseline writes nothing to the game, uses no fixture and sends no message.

Its route was developed on P1 itself, so it is a **solution-aware reference**, like the Hedge Maze baseline. Nothing from it is given to the unaided model players.

| Seed | Outcome | Game time | Decisions (Sieg / Coco) | Invalid | Messages | Model calls | Start hash | End hash |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | success | 1,058 ticks (17.6 s) | 161 (104 / 57) | 0 | 0 | 0 | `688b2462…1530` | `c2f3b973…7e54` |
| 1 | success | 1,058 ticks (17.6 s) | 161 (104 / 57) | 0 | 0 | 0 | `e9922b16…0f12` | `30565934…87d3` |

Progress, from the trace's evaluator markers (seed 0):

| Tick | Milestone |
| --- | --- |
| 234 | shop visit done |
| 290 | road fork |
| 410 | forest trail |
| 745 | cart found |
| 1,058 | Mossling Woods (success) |

**Seeds.** Seed 1 differs from seed 0 only in the room code and the two hero ids. Both heroes' first observations and legal actions are byte-identical (views hash `27cf4ce6…ff3a`), and the baseline plays the same steps. Seed 1 is therefore a repeated trial.

**Evidence.** The traces and summaries are in `docs/midterm/evidence/p1-baseline/`. They were generated at a clean checkout of the implementation commit; the commit is named in that folder's README.

## Players planned (prepared, not run)

| Role | Player | Information |
| --- | --- | --- |
| Primary | `baseline-quest` | Solution-aware scripted reference (above) |
| Primary | `model-memory` | Unaided: the manual and system prompt, its own notes, recent history and per-hero memory from its own observations. No briefing, no tutorial block, no walkthrough |
| Secondary | `model-obs-only` | Unaided, current observation only. Supported, not run |
| Reference | `baseline-explore` | Quest-free floor |

`model-guided` is not available on P1: there is no walkthrough.

**Prompt freeze.** Each model player's full system prompt (manual included) is pinned by SHA-256 in the definition. P1 is excluded from prompt tuning, so a changed prompt fails the P1 test and would be a new P1 revision. The prompts must not be changed in response to P1 results.

## Expected evaluation cost (estimate, not measured)

Assumptions:
- **Cost per call:** $0.0006–$0.0012, from the measured Hedge Maze pilots ($0.00057–$0.00084 on `gpt-6-luna` medium) and the budget's Haiku 5.5 estimate.
- **Wall time:** 6.4–7.9 s per call over an episode, measured in pilots 12, 13 and 15.
- **Calls:** about 150–350 per episode for both heroes. The 33 dialogue lines cost about 1–2 calls each, and navigation costs the rest.
- **Prices:** must be re-checked on the run day.

| | Per episode | 2 seeds × `model-memory` | Plus `model-obs-only` (2 seeds) |
| --- | --- | --- | --- |
| Model calls | 150–350 (cap 500) | 300–700 | 600–1,400 |
| Cost | $0.09–$0.42 (cap $0.60) | $0.18–$0.84 | $0.36–$1.68 |
| Wall time | 16–46 min (cap 60) | 0.5–1.5 h | 1–3 h |

## Reproduce

```sh
node --import tsx scripts/midterm/prologue-situation.ts
node --import tsx scripts/midterm/prologue-situation.ts --baseline --out <dir>
npx vitest run packages/agent/test/prologueSituation.test.ts
```

The script makes no model call: it builds no gateway, reads no key and opens no spend ledger. It exits 1 if any frozen value differs.

## Rubric status and limitations

- **Three situations.** **Not satisfied.** S2-A has one baseline run at each tuning seed and two exploratory model trials that were stopped by hand. S2-B and S2-C have no live trials. P1 has none.
- **Held out.** P1 is frozen and excluded from prompt tuning from version 1. It is **not** held out from development knowledge:
  - it was designed with full knowledge of the game's code;
  - the baseline's route was developed on it;
  - it runs on the tuning seeds.

  No final-seed run is planned without the owner's approval.
- **Cooperation.** P1 does not require meaningful cooperation from both agents (see above).
- **Ceiling.** The baseline finishes in under 18 game-seconds, so P1 may be easy for a model. That is still an interpretable result, but it may separate the players less than the maze does.
- **Scope.** Adding P1 extends the evaluated scope beyond the Hedge Maze into the Prologue. The README's scope statement has been updated. Professor approval of the scope is still not recorded.
- **Review.** The `game-rules-audit` skill and the independent `rules-reviewer` review are required before any paid run. Their outcomes are recorded in the change log of [EVALUATION_SUITE.md](EVALUATION_SUITE.md).
