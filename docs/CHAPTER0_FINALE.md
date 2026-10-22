# Chapter 0, finale: the Forgotten Shrine

Picks up after Part 1's decision by the grave (docs/CHAPTER0_PART1.md) and ends Chapter 0. The puzzles, enemies, the griffin, the shared backpack and the wig offering are unchanged; the story only adds scenes around them.

- **Script:** `packages/shared/src/chapter0Finale.ts`. Its scenes join the same `cutscenes` table.
- **When each scene plays:** `apps/server/src/chapter0Finale.ts`, called from the story tick.
- **Stages:** `DECISION` → `SHRINE_ROAD` → `TRIALS` → `GODDESS` → `WIG` → `DONE`.
- **Start point:** "The Forgotten Shrine" on the title screen begins at `SHRINE_ROAD`, in Emberbrook by the north road.
- **Start point:** "The Bald Goddess" on the title screen begins at `GODDESS` on the Goddess Shrine map, with the angel's blessing and all three trials passed; her greeting (`goddess-meet`) plays on arrival.

## Rules

- Each scene plays once. Its flag records it, so revisits, reconnects and replays of the same tick never repeat it.
- Every scene is shared: both heroes see each line, and either hero's E moves it on. A disconnect pauses it on its line.
- Scenes start only when both heroes are on the party's map and nobody is flying.
- Scenes marked `hold` freeze monsters, the griffin, maze runners, black holes, the bridge's spikes and the pond's spikes while they play, so nobody is hurt while held still.
- Nobody is teleported to the shrine. The party walks the existing route: Emberbrook north → Transition Trail → Grasslands → Puzzle Glade → Monster Clearing → Puzzle Map 2 → Goddess Shrine.
- The playtest shortcut from home to the shrine stays shut until Chapter 0 is complete.

## Act I: the road

The `decision` scene (Part 1) already carried Act I's lines. Its objective now reads "Find the Forgotten Shrine." and it leads into `SHRINE_ROAD`, which opens the north road.

## Act II: the Weeping Angel (Puzzle Glade)

The angel is the glade's weeping statue; her puzzle is unchanged.

- `angel-meet`: plays as the party first enters the glade. The camera frames her.
- Her puzzle runs as before: Coco burns the thicket, then Sieg pushes the chair to her. Her rock-refusal lines remain.
- `angel-blessing`: plays on the tick she is seated. It records `chapter0.angel-blessing` and the objective "Pass the Three Trials".
  - The glade's exit stays shut until it has played.
  - If the chair arrives before her first words, those play first.
- E at her afterwards shows her usual lines, under the name "Weeping Angel".

## Act III: the Three Trials (Puzzle Map 2)

The trials are Puzzle Map 2's own phases:

| Trial | Passed when | Flag |
| --- | --- | --- |
| Cooperation | Gate 1 is open (boulder on plate A plus Coco's front shot) and Coco has held the golden switch | `chapter0.trial-cooperation` |
| Ingenuity | The boulder is through the spikes and on plate B (Slow Time plus Super Speed) | `chapter0.trial-ingenuity` |
| Courage | The fragile bridge, the long shot, and both final switches held apart | `chapter0.trial-courage` |

- `trials-inscription`: plays on arrival. The inscription stone stands in the south courtyard, away from the boulder's lane. It is original placeholder geometry and not solid. E there re-reads it.
- Each trial passed shows a banner on both screens. It never stops play. The objective shows ✓ beside each trial.
- `trials-done`: plays when the divider opens. The heroes meet either side of the castle exit, and the exit waits until the scene has played. It ends with "Speak to the Guardian Goddess".

## Act IV: the Bald Goddess

`goddess-meet` plays on first arrival at the shrine, with the heroes before her statue. It ends with "Recover the Divine Wig". Her power had already faded; the wig is only her latest humiliation, and the script never says otherwise. She only says the wig is missing, never who took it, so the heroes search the pond and maze too; the quest tracker shows "Wig (missing)" until they have met the griffin.

## Act V: the wig

The three branches, the shared backpack, Coco's and Sieg's abilities, and the griffin's peaceful and combat routes are untouched. Short scenes play once each:

- `maze-banter`: entering the Hedge Maze;
- `mirror-banter`: the vanity mirror first reaching the backpack;
- `griffin-banter`: entering the Griffin Enclosure (it is still asleep);
- `wig-banter`: the wig first reaching the backpack, once nobody is in the air.

## Act VI: the goddess remembers

`revelation` plays when the existing offering accepts the wig (either hero offers it) and both heroes are at the shrine. Her statue turns happy as before, now wearing the wig: it sits on her head and falls to her shoulders, with her face shown in front of it. Offering the wig closes both heroes' backpacks as her scene begins. Whenever she speaks, the camera keeps her face and the heroes in view above the dialogue box, zooming out a step if it must.

She celebrates her hair, then looks at Coco and knows her name. Turning to Sieg, she senses only that something about him is familiar. She never calls him Sieg (nobody has introduced him to her). She half-remembers the name "Sigurd", cannot say who that was, and turns away troubled: "Forgive me. There is much I have forgotten." The talk then turns to Alden, the Ember and the seven divine relics as before.

What stays unrevealed:

- the cloaked woman's identity;
- who killed Alden;
- whether Alden had the Ember;
- who came with him to the shrine;
- Coco's mother's fate;
- who Sigurd was, and any link between Sigurd and Sieg (ancestry, rebirth or otherwise);
- the full meaning of the oath.

## Act VII: the decision, and the Mistress of the Mist

`resolve` follows straight after the revelation.

- **The choice:** each hero sees only their own three reasons and picks one with 1 to 3 (or ↑↓ then E, or a tap).
  - The request is `story:choose`. The server accepts only the current choosing line, only that hero's own role, and only a listed reason.
  - The first choice stands; later or repeated picks change nothing.
  - The partner sees "Waiting for … to choose".
  - The line moves on once both have chosen and both are connected.
- **Saved:** `story.motivations` (e.g. `{ EMBER: "truth", OATH: "promise" }`), plus a flag per hero: `chapter0.motivation-<ROLE>-<id>`. Later dialogue can read either.

| Hero | Reason ids |
| --- | --- |
| Coco | `truth`, `answer`, `scared` |
| Sieg | `promise`, `duty`, `together` |

- Each hero then speaks their chosen line, and the closing lines play.
- `depart`: Coco and Sieg walk out toward the south entrance and fade from view as "Coco and Sieg leave the shrine" shows. They stop short of the road back, so pressing E to read can never carry them off the map.
- `watcher`, the final cinematic, plays without the heroes (they stay hidden):
  - The goddess, alone at her altar, calls out: "Show yourself, Mistress of the Mist."
  - Mist gathers right in front of the altar, between it and the offering bowl (`mist-gather`). The cloaked woman takes shape out of it, facing south, her face hidden (`stranger-appear`; she fades in).
  - Their exchange follows ("So... the oath lives on.", the offering, "nothing in this world comes without sacrifice").
  - One shot holds the goddess and the woman together, with no panning; on the last line the camera glides back a little further. The shrine's signs are hidden while any of its scenes play.
  - The mist thins and she fades, then both screens fade to black: **CHAPTER 0 COMPLETE**. The heroes are back at the south road afterwards.
  - Each part plays once. After a reconnect the ending picks up where it was (`depart`, then `watcher`).
- The story reaches `DONE` with `chapter0.complete`. The shrine's south-east path to the Forest Ruins opens, and later campaign content is reachable as before.

Story state lives in the room's memory. It survives reconnects and travel; nothing is written to disk (AGENTS.md).

## Lines added

Where the brief gave stage directions, lines were added:

- "Words are carved into a stone at the entrance.";
- "A sealed gate opens, revealing the path to the Goddess Shrine.";
- the narration lines for the goddess's looks, pauses and silences;
- the choice prompt;
- the narration for the heroes leaving, the mist and the final shot;
- the "New objective" lines after the goddess's introduction.

## Verification

- `apps/server/test/chapter0Finale.test.ts`: every trigger plays once; exits stay gated; monsters hold; choices are validated, wait for both heroes, survive reconnects and go over real sockets.
- `apps/client/test/finaleStory.test.ts`: each hero sees only their own choices; reasons are spoken; banners never replay.
- `scripts/qa-chapter0-finale.ts`: two Chrome clients start from the title screen, read every scene with E, choose with their own keys, and reach the end card. Screenshots are in `qa/chapter0-finale/`.
  - Travel and puzzle latches are set on the server as fixtures; each puzzle keeps its own walkthrough.
