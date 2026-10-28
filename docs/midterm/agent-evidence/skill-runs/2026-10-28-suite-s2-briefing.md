# game-rules-audit: suite (proposed S2 episode briefing)

| Field | Value |
| --- | --- |
| Date | 2026-10-28 |
| Session | 1d2c5393-985f-4736-86c2-40baf5a01504 (Claude Code) |
| Session URL | None unless the owner supplies one |
| Skill file SHA256 | 03d8eabcf325da46d0f5fa5911a10702f3ff6280969b6653ce6b454332ee3756 |
| Commit audited | 96fa097, working tree clean (before this report) |
| Target and focus | `suite`: pre-implementation audit of a **proposed**, owner-approved, S2-only episode briefing, after pilot-5 (`evaluation-runs/live/S2-seed0-model-history-openai-2026-10-28T17-08-29-877Z`, ledger entry `pilot-5`). Nothing is implemented yet. Proposed text below. |
| Files read | `AGENTS.md`, `CLAUDE.md`, `docs/midterm/EVALUATION_SUITE.md` (scenarios, players, change log), `docs/midterm/AGENT_INTERFACE.md` ("Never included"), `manual/Oath_and_Ember_Player_Manual.md` (searched for Bridge, shrine and quest areas: none mentioned), `packages/agent/src/suite.ts`, `packages/agent/src/evaluator.ts` (S2 goal), `packages/agent/src/harness.ts` (`policiesFor`, `runOne`), `packages/agent/src/policies/llm.ts` (`TASK`, `systemPrompt`, `LLMPlayer`), `packages/agent/src/policies/kind.ts`, `packages/agent/src/perception.ts` (`areaNames`, shrine `sceneProps`), `packages/shared/src/maps.ts` (`previousMap`, `BRIDGE_RUINS`), `packages/shared/src/shrine.ts` (`shrinePoints`), `packages/shared/src/storyCheckpoints.ts`, `apps/server/src/storyCheckpoints.ts` (goddess checkpoint), `apps/server/src/GameRoom.ts` (`transition`, Bridge Ruins exit), `packages/shared/src/bridgePuzzle.ts` (gate walls), `apps/client/src/environment/ShrineView.ts`, `apps/client/src/main.ts` (HUD goal lines), the pilot-5 trace, summary, `live.json` and `recording.json`, `packages/agent/test/environment.test.ts` (prompt test) |
| Commands run | `git rev-parse --short HEAD` → `96fa097`; `git status --short` → clean; skill file hash as above; `git log -- docs/midterm/EVALUATION_SUITE.md packages/agent/src/suite.ts` → one commit, `0c45f82` (the suite freeze); Node v24.22.1 `npx vitest run packages/agent/test/environment.test.ts` → 33/33 passed. An offline probe in the session scratchpad (S2 reset, Coco walks to the south marker and presses E through the interface) showed both heroes arriving in Bridge Ruins with `bridgePuzzle.stage = 1`, `complete = false`. `scan_secrets.py` on this report: see step 14. |

**Proposed briefing** (appended as its own block after the general system prompt, identical for both heroes and both providers, S2 only):

> Episode briefing for this evaluation (S2), the same for both players:
> - This evaluation episode is Mirror Pond.
> - Bridge Ruins is a puzzle you have already completed. It is the area that the shrine's "START / RETURN · E · Puzzle Map 2" sign leads back to. It is outside the scope of this episode: do not return to Bridge Ruins.
> - The goddess's offering is the overall quest goal, not your objective in this episode.
> - Solve this episode with your normal observations, actions and messages to your partner.

## Findings

| # | Severity | Source (H/M) | Affected file | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Medium | M | `docs/midterm/EVALUATION_SUITE.md` change log; results reporting | The suite freeze rule says any later change to a scenario or player goes in the change log, and results from before and after are reported separately. Players were given only `TASK` = "Complete the Goddess's quest together." (`llm.ts:158`); S2's goal (Vanity Mirror, `evaluator.ts:65`) was never shown to them. The briefing changes what S2 model players are told. | S2 model results from before the briefing (pilot-4, pilot-5) and after it are not comparable. | Add a dated change-log row (owner-approved, with its reason). Mark briefed runs in the policy name, as proposed, and report them separately. |
| 2 | Low | M | proposed text, second bullet | It quotes the sign "START / RETURN · E · Puzzle Map 2" (`perception.ts:252`, `ShrineView.ts:177`). At the S2 start this sign is off-screen for both heroes: in pilot-5 only Coco saw it, after walking south. The briefing names the sign's text but not its position or direction. | A small piece of prior knowledge, which a returning player has ("START / RETURN": the way the party came). Without it, "Bridge Ruins" never appears on screen in the shrine, so "do not return to Bridge Ruins" cannot be acted on: the agent only learns that name after arriving. It tells nothing about solving Mirror Pond. | Accept as owner-approved scope, and say so in the change log. Do not add the sign's position or direction. |
| 3 | Low | M | `packages/agent/src/perception.ts:70` (pre-existing) | The agent-side area name is "Bridge Ruins" (`areaNames.BRIDGE_RUINS`). The game draws "Puzzle Map 2" on the shrine sign and in HUD lines (`main.ts:1766,1790,1832`), and the room's checkpoint name is "The Bridge That Hates Cooperation" (`GameRoom.ts`, `transition`). | Three names for one area. This was the naming gap behind finding 2. | Out of the briefing's scope. Record it for the owner. If the area name is ever aligned, it is an observation change that needs approval. |
| 4 | Info | H | `apps/server/src/GameRoom.ts:583`, `:1318` (pre-existing game behaviour) | `transition()` always creates a fresh bridge puzzle on entering Bridge Ruins, and the exit back to the shrine needs `bridgePuzzle.complete`. The goddess checkpoint sets the trials' story flags but no bridge state. | In S2, taking the south exit means re-solving the four-stage bridge before the party can return. A human player would face the same thing. | No change, per the owner's instruction (no transition or rule changes). Disclose it in the run report. |
| 5 | Info | M | `packages/agent/src/policies/questBaseline.ts` (existing asymmetry) | The scripted baselines receive no prompt, so the briefing does not apply to them. `QuestBaseline` already hard-codes each area's route. | The briefing narrows the information gap between the model and the quest baseline, without making them equal. | Disclose it in the comparison table notes. |
| 6 | Info | M | proposed wiring | `systemPrompt()` stays unchanged. The existing test that the general prompt names no quest area (`environment.test.ts:251-257`) remains valid. The briefing block is the only S2-specific text. The observation-only player also gets it, because it is a fixed instruction, not memory. | Keeps the boundary auditable. | Test that the briefing is present for both heroes in S2 and absent in S1 and S3. Test that the same system text reaches either provider. Test that it contains no coordinates or compass directions. |

## Checks performed

| Step | Result | Notes |
| --- | --- | --- |
| 1 Server authority | Pass | The briefing is prompt text only; no state is written. |
| 2 Rules and art preserved | Pass | No game change is proposed. The Bridge Ruins reset is pre-existing behaviour (finding 4). |
| 3 Real mechanics, no fixtures | Pass | The S2 start is unchanged (same prefix). No invisible wall or teleport. |
| 4 Observations player-visible only | Pass | The observation is unchanged. Finding 2 covers the one fact the briefing adds. |
| 5 Legal actions leak nothing | N/A | Not changed. |
| 6 No solution in player context | Pass, with finding 2 | No coordinates, directions, item to use, or pond mechanics. "Mirror Pond" is the scenario name and is drawn on the shrine's west sign; the briefing does not say where that sign is. |
| 7 Independent players | Pass | One fixed text, identical for both. No channel between them. |
| 8 One interface | Finding 5 | Baselines are unaffected; the asymmetry is disclosed. |
| 9 Limits and terminal reasons | N/A | Not changed. |
| 10 Determinism | Pass | No effect on state. The start hash is unchanged (`5397eba5…`, S2 and S3 identical). |
| 11 Suite and reporting | Finding 1 | A change-log entry and separate reporting are needed. |
| 12 Sync and recording | N/A | Not changed. |
| 13 Validation | Partial | `environment.test.ts`: 33/33 under Node v24.22.1. Full checks follow implementation. |
| 14 No overclaiming, no secrets | Pass | `scan_secrets.py` on this report: 0 findings. |

## Recommended tests

- S2 policies: both heroes' system text ends with the exact briefing block, and the two blocks are identical.
- S1 and S3 policies: no briefing block.
- With two recording gateways labelled as different providers, the system string sent is byte-identical.
- The briefing contains no coordinates (`(\d+, \d+)`) and no compass words (north, south, east, west).
- `systemPrompt()` is unchanged, and the existing spoiler test still passes.

## Open questions for the owner

1. Should the briefing also state S2's success condition (the Vanity Mirror in the shared backpack)? It is not in the approved text, and it is not proposed here.
2. Should "Bridge Ruins", "Puzzle Map 2" and the checkpoint name be aligned later (finding 3)?
