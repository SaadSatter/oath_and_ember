# Pilot-10 diagnosis: spatial memory and stale objectives (2026-10-29)

A read-only investigation of pilot-10, done at the owner's request after the
pilot-9 fixes (`a3b19ad`). Written by the Claude Code implementation agent;
this is not an independent review. Nothing in the implementation was changed:
no observation, memory, prompt, gameplay, baseline or pin change, no paid call,
no held-out S4/F content, no push or merge.

The owner's working hypothesis was that the next bottleneck is spatial memory
and exploration planning, not Black Hole mechanics. The trace supports that,
and adds a second cause: a completed objective that the player lost track of.

## Pilot metadata

| Field | Value |
| --- | --- |
| Ledger entry | `pilot-10` (stage `pilot`) |
| Scenario | revision 2 `S2-local` (Hedge Maze, local start, `S2-local-v2`), briefing on, tutorial `2ec2f251` |
| Seed / start | 0 / tick 405, start hash `2b9eddd4…` |
| Players | `model-history`; both heroes `llm(openai:gpt-6-luna@medium)·batch4·tutorial-2ec2f251·briefing-a97d9268` |
| Git | `d31d76a` (includes the pilot-9 fixes `a3b19ad`) |
| Launch | `scripts/midterm/live.ts`, `--no-viewer` (no viewer, no recording), episode cap $0.60 |
| Trace (local, not committed) | `evaluation-runs/live/S2-local-seed0-model-history-openai-2026-10-29T04-35-10-438Z/S2-local-seed0/trace.jsonl` (1,777 records) plus `summary.json`, `results.json`, `run.json`, `live.json` in the run folder |

## Result and cost

- **Ended:** `manual_stop` by the owner (`live.json`: `interrupted: true`). Not a success and not a limit.
- **Time:** 2,687 game ticks (44.8 game-seconds; the episode ended at tick 3,092) in 1,098 s wall time, against a 3,600 s wall cap and an 18,000-tick limit.
- **Model calls:** Sieg 116 (2 failed: one `openai_http_520` at tick 406, one aborted by the stop); Coco 105. No parse failures, no invalid actions.
- **Tokens:** input 1,819,757 (Sieg 943,693, Coco 876,064); output 91,140.
- **Spend:** $0.14552 charged; $0.131862 of it is known from reported usage (Sieg had 2 calls with unknown usage).
- **Progress reached by real play:**
  - Coco burned the dry hedge with Fireball (tick 588).
  - Black Hole pulls moved the cow west from x 26 to 23.84 (ticks 1309–1470).
  - Both heroes passed the cow and reached the key gate at (41, 14), which refused them for want of a key (Sieg tick 2422, Coco tick 3089).
- **Not reached:** neither hero ever had the key-carrying wolf on screen; no observation in the trace lists a wolf.

Pilot-10 was stopped by hand, so it is not evidence that the agents could not
finish the maze. It is evidence that progress was slow and expensive:
about 220 calls to reach the gate, with the key search not yet begun.

## What a model call actually contains

Each call is a fresh, single-turn request. There is no rolling conversation:

- Anthropic: one `messages` entry (`policies/llm.ts`, `AnthropicGateway.complete`).
- OpenAI: `instructions` plus one `input` item with `store: false` and no previous response id (`policies/openai.ts`).

The system prompt (general prompt, manual, tutorial, briefing) is identical
every call. The user message (`LLMPlayer.decide`) holds:

| Field | What it keeps | Limit |
| --- | --- | --- |
| `your_notes` | Free text the model wrote last turn | 400 characters, **replaced** every turn |
| `completed_actions` | Executed actions (a sent message is an action, so its text is here) | last 8 |
| `recent_rejected_actions` | Refused or stale actions | last 4 |
| `last_turn` | Each proposed action of the previous reply and its result | previous turn only |
| `observation.screen` | The current 20×12-tile view | now only |
| `observation.feedback` | Recent feedback lines | last 8 |
| `observation.messages` | Messages **received from the partner** | last 6 |
| `observation.dialogueLog` | Dialogue lines this hero's screen showed | last 12 |
| `observation.discovered` | Areas visited, and `exploredRows` | see below |

**`exploredRows`** (`perception.ts`, `PlayerMemory.see`) is the only persistent
spatial memory.
- It is a grid of 4×4-tile blocks (12×10 for the 48×40 maze), marked `.` when any part of the block has been on this hero's screen and `?` otherwise, with `@` for the hero's block.
- It holds no terrain, no walls and no openings, and does not record where the hero walked.
- The system prompt never explains it; only `AGENT_INTERFACE.md` and the type comment do. Of the policies, only the exploration baseline reads it.

**Consequences:**
- Terrain seen more than one screen ago survives only if the model copies it into its 400-character notes. Those notes also carry the objective, partner status, cooldowns and the current plan.
- A hero cannot tell a corridor it has walked from one it only glimpsed, or an opening it has tried from one it has not.
- Facts about finished objectives have no place of their own; they compete for the same 400 characters.

## The cow passage: visibility timeline

Maze geometry (`packages/shared/src/hedgeMaze.ts`): the lane runs x 24–28 from
y 12 to y 30. The cow's 4×4 body starts centred at (26, 25), filling the lane
from y 23 to y 27. The grazing bay is x 18–24, y 23–27, west of the lane. A
hero's body is about 0.8 tiles wide.

| Tick | Event (trace) | Lane gap east of cow |
| --- | --- | --- |
| 1309 | Coco's Black Hole (cast SE at 1285) pulls the cow from x 26 to 25.7 | 0.3 tiles: closed |
| 1347 | Coco's screen: cow `C` in columns 24–27, hedge beyond. Screen is accurate | closed |
| 1415–1470 | The cow keeps moving west: 24.9, 24.3, 24.0, 23.9 | from 1.1 tiles at 24.9; passable |
| 1761 | Sieg, beside Coco in the bay: `CCCC` in columns 22–25, `..` in columns 26–27 on rows 18–29, a continuous open lane north | about 2.2 tiles |
| 1936–2018 | Coco casts Black Hole east (as Sieg asked). Cow stays at 23.84. Her screen at 1988 and 2018 shows the same open `..` lane. She writes "cow blocks the lane east" and "Black Hole did not move the cow", then goes south looking for the dry hedge | open |
| 2046–2261 | Sieg, from the south room, walks north through the gap. His notes say "in the passage east of the cow" (2101) and "safely north of the cow" (2221). He reaches y 12.4 | open |
| 2422 | Sieg at the key gate: "Gate (41,14) wants key; none in bag. Seek hedge/key." His only message between 1761 and 2422; it never mentions the cow passage | open |
| 2443 | Coco finds the passage herself by walking north from the south room at x 26.83 ("east of the cow in a narrow north-south passage") | open |

**Findings:**
- The observation showed the opening correctly from about tick 1415, and plainly to both heroes from tick 1761.
- Coco, looking from the bay side, read "the cow is still there" as "the lane is still blocked". She did not notice that the cow's new position had freed the far side of the lane.
- Sieg found and used the passage and did not report it. The general prompt asks heroes to report "a passage that opened" with where. He did not follow it.

## The stale dry-hedge request

| Tick | Event |
| --- | --- |
| 406 | Sieg messages: "I'll head north/east toward the cinder wisp. Please investigate the FIREBALL dry hedge." |
| 588 | Coco's Fireball burns the dry hedge at (19, 34). Both heroes get "The dry hedge at (19, 34) disappeared." |
| 588–1317 | Coco reports the hedge cleared or already gone in seven messages (588, 662, 721, 841, 865, 1105, 1317). Her notes keep "dry hedge at (19,34) is cleared/gone" until 1105 |
| 1165 | Notes: "Sieg asked me to investigate the FIREBALL dry hedge, but I don't see it here." |
| 1347 | Notes replaced: "Need locate the FIREBALL dry hedge Sieg asked me to investigate." The completion fact is gone from her notes. Her `completed_actions` still hold two of her own messages saying the hedge was already clear (1105, 1317) |
| ~1470 | The last of those messages leaves the 8-action log. From here on, nothing sent to Coco says the hedge was burned |
| 1470–2830 | Coco searches the south and west lanes for "the FIREBALL dry hedge". She fires at ordinary hedge (1625, 1667) and at the hedge beside the key gate (2665–2789), then reports "Fireball didn't open or reveal anything." |

**Why it persisted:**
- **The request stayed in view.** Sieg sent only 7 messages in the run, so his tick-406 request stayed among Coco's 6 most recent received messages until at least tick 2018. It carries no sign that it was answered.
- **Her replies did not.** A hero's observation lists only messages received (`environment.ts`, `deliver`). Coco's answers were visible to her only through `completed_actions`, from which ordinary moves pushed them out within a few turns.
- **The completion fact had no protected place.** It survived only in free-text notes that she rewrote each turn under a 400-character limit.
- **"Trust your latest observation" worked against her.** The burned hedge was no longer on any screen, so the current screen offered "no dry hedge visible", which fits "still to be found" as well as "already gone".
- **Losing the fact was not the whole cause.** At 1347 the fact was still in her action log, yet she wrote a search plan. A visible, unanswered partner request outweighed a fact buried among her own past actions.

Sieg's message at 2422 ("Seek hedge/key") then re-armed the search after Coco had reached the cow passage.

## The unexplored north and the missing wolf

- **Neither hero went north of y 10.4** (Sieg 10.92, Coco 10.4). The maze's northern corridor (y 4–8, x 8–40, with side branches) was never walked.
- **`exploredRows` marks it explored anyway.** At the end, both heroes' grids show that band as `.`, because the corridor along y 12–16 brings it onto the screen. To the model, "explored" therefore looked complete where no one had been.
- **Only the top band (y 0–4) and a few western blocks stayed `?`.** Coco's grid still had `?` in the north-west.
- **No wolf ever appeared** in either hero's `visible` list. The wolf roams while no hero can reach it. Nothing told either player that a key-carrier exists or where it might be; the gate only says "Select the correct key."
- **The key search had just begun.** By the stop, both heroes were testing the gate area and short northward probes. Neither had started a systematic search of unwalked corridors.

## Does the browser client show a hero's own sent messages?

**No. The browser client has no chat or message feature at all.**
- `apps/client/src`, `apps/server/src` and `packages/shared/src` have no chat, message panel or player-to-player text event. The protocol's only `message` payloads are server errors and item/puzzle result text.
- The manual describes no in-game chat.
- Human partners coordinate outside the game (voice or sitting together), so each naturally remembers what they themselves said.

The agent `message` action (`environment.ts`, `deliver`; 200 characters, 64 per
hero) is the interface's stand-in for that out-of-game channel. It currently
delivers to the partner's observation only.

So whether a hero should see its own sent messages is not settled by client
parity. It is a question of matching a human's memory of their own words, and
it needs the owner's decision.

## Proposed fixes, by expected impact

None is implemented. Each changes the observation contract or the prompt, so
each needs owner approval, and model results after any of them must be
reported separately from earlier pilots.

1. **Show a hero its own sent messages**, interleaved with received ones in tick order with `from` set to the hero, under the existing 6-entry window or a slightly larger one. *Expected impact: high, low cost.* Coco's "already cleared" replies would have sat next to Sieg's request for as long as the request stayed visible, removing the 1,300-tick dry-hedge loop. It adds no game information: only text the hero itself wrote.
2. **Per-hero remembered map at tile resolution.** Every tile this hero has had on screen, kept as last seen (`#`, `.`, `~`), with `?` for never seen; plus a separate mark for tiles the hero has walked. *Expected impact: high on maze scenarios.*
   - It lets the model tell walked from glimpsed corridors and choose unwalked openings.
   - It keeps the cow lane on record after the hero turns away.
   - It costs about 2,000 characters per call for the maze.
   - It must be built from this hero's own past screens only (see risks).
3. **Explain `exploredRows`** in the general prompt (what `.`, `?` and `@` mean, and that seen is not walked), or replace it with item 2. *Expected impact: low on its own.*
4. **Give verified facts their own field**: a short, append-style list the model maintains (for example "done: dry hedge at (19,34) burned, tick 588"), separate from the free-text plan, with a larger limit than the notes. *Expected impact: medium.* It protects completion facts from being overwritten by plans.
5. **Prompt: report passages and answer requests.** The existing rules already ask for this; Sieg did not follow them. A one-line addition could ask heroes to say when a partner's request is done and to report a route they have just used. *Expected impact: low to medium.* Rules already in the prompt were not followed here.

## Persistent spatial memory versus verified objective memory

These are different and should stay separate:

- **Spatial memory** (item 2) records what the hero's screen showed and where the hero walked. It is factual for the moment it was seen and can go stale: the cow moves, a hedge burns, the gate opens, enemies roam. It must be labelled "as last seen at tick N" and must not be presented as current.
- **Objective memory** (items 1 and 4) records what the hero did or confirmed: "I burned the dry hedge," "the gate needs a key," "Sieg asked me to …, and I replied …". Each entry comes from the hero's own feedback, journal or messages. Once an entry is true, it stays true until the hero sees otherwise.

Pilot-10 failed on both, in different ways:
- The cow lane was a spatial-memory failure, made worse by misreading a correct screen.
- The dry hedge was an objective-memory failure: a finished task kept looking unfinished.

A remembered map would not have fixed the hedge loop, and a facts list would not have shown the lane.

## Risks

- **Hidden-state leakage.**
  - A remembered map must be built only from this hero's own past `screen` grids, never from `World` geometry, `mazePaths` or collision rectangles. Otherwise it would reveal unseen corridors.
  - It must not merge the partner's screens; the partner's view reaches a hero only by message.
  - Dynamic walls (dry hedge, gate, cow) must appear only as they looked when last seen.
  - Walked-tile marks must come from the hero's own `self` position history.
  - The objective list must accept only text the model writes from its own observations. The runner must not fill it from milestones or puzzle state.
- **Dynamic objects.**
  - A remembered map can be wrong after the world changes: the cow still drawn blocking a lane it has left, or a burned hedge still drawn as wall.
  - Mitigation: overwrite tiles whenever they are on screen again, mark the age of each region, and keep moving things (creatures, enemies, effects) out of the remembered map entirely.
  - Pilot-10 shows the opposite danger too: Coco trusted an old belief ("cow blocks the lane") over a correct current screen. A map must not strengthen stale beliefs.
- **Human-player parity.**
  - A human remembers a maze imperfectly, and the game has no minimap or automap. A tile-perfect remembered map is more than a human has.
  - That is arguably fair, since a human sees the continuous screen and can sketch the maze, but it is a design decision for the owner and should be documented as an interface aid.
  - Seeing one's own messages matches a human remembering what they said; the client has no chat to compare against.
- **Frozen baselines and pins.**
  - The `scriptedFreeze.test.ts` digest hashes actions and state hashes, not observations. Adding observation fields leaves the pins unchanged unless a baseline reads the changed field.
  - **Exploration baseline:** it walks toward `?` blocks in `exploredRows`. Changing `exploredRows` itself, rather than adding a new field, would change `explore/*` trajectories and their pins.
  - **Quest baseline:** it finds partner phrases in `o.messages` by text alone (`questBaseline.ts`). Adding a hero's own messages to that list could make it "hear" its own phrase and change `quest/*` trajectories. Own messages would need either a separate field or a `from` filter in the baseline, and the freeze comparison must be rerun (without the held-out `route/seed1`).
  - All held-out S4/F content stays untouched.

## Not done in this investigation

No implementation change, no paid run, no test run (documentation only), no
S4/F or `route/seed1` inspection, no pin change, no push or merge.
