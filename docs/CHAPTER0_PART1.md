# Chapter 0, Part 1: The Forgotten Oath

Part 1 continues straight from the prologue (`npm run prologue`): after Alden's
morning lesson, Coco sets off on his errand. It ends when the Forgotten Shrine
quest unlocks and the road north out of Emberbrook opens; the existing shrine
adventure (puzzles, rewards, the griffin, the goddess) is unchanged.

## Status

| Phase | Content | State |
| --- | --- | --- |
| 2 | The errand in Emberbrook, the homecoming, the silent shop | Done |
| 3 | Alden's last words, the stranger, the reunion | Done |
| 4 | The funeral | Done |
| 5 | The investigation and the journal | Done |
| 6 | The decision; the Forgotten Shrine unlocks | Done |

## How it fits the prologue's story engine

- **Script as data:** `packages/shared/src/chapter0.ts`. Its scenes join the prologue's `cutscenes` table, and the stages continue the same list: `ERRAND`, `HOMEWARD`, `SILENT_SHOP`, then later phases, then `DONE`.
- **Scenes with a cast:** a scene may name its `cast`.
  - Only those heroes are held still, placed, and asked to read its lines.
  - A scene with a cast never moves the party; the other hero carries on.
- **Offstage:** `offstageByStage` says which hero the story has set aside at each stage, and where.
  - The server holds that hero there, every tick, so a reconnect cannot lose them.
  - `watch: true`: their screen follows the partner and shows the partner's lines read-only ("Watching Coco…").
  - `watch: false`: they see their own spot and a "Meanwhile…" card.
- **Story conversations:** `storyTalks` lists the villagers whose talk is a story scene at a given stage, for a given hero.
  - E at the villager sends the usual `npc:talk`; the server starts the scene, and the ack says `story: true`.
  - Once its flag is set, the villager is back to ordinary chat.
- **Items:** a scene's `gives` adds to the shared backpack when the scene first ends. The flag that records the scene also guards the gift, so nothing is handed over twice.
- **Set dressing:** `packages/shared/src/storyProps.ts` places story images, each shown only at the right point in the story:
  - the market stalls (always, with collision);
  - the clutter in the shop (from `SILENT_SHOP` until the burial);
  - the dropped shopping bag (from the moment Coco drops it until the burial).
- **One read is enough:** whichever hero in a scene presses E first moves a shared line on for both. A private line (`audience`) can only be moved on by its own hero.

## The errand (Phase 2)

1. **The morning:** Alden's list now matches Part 1's: moonleaf, two crystal vials, candlewick, fresh bread. Then the opening narration (`errand`), which Sieg watches from home.
2. **The road:** Coco walks the road to Emberbrook and back on her own; the party's scene stays at the shop.
   - Emberbrook's north road (to the shrine) stays shut until Chapter 0 ends.
   - Hearthside Cottage (Sieg's home; Mother is his mother) is shut while he is upstairs.
3. **The shops:**
   - Brynn (outside her apothecary): moonleaf.
   - The General Store stall: 2 crystal vials and candlewick.
   - The Bakery stall: fresh bread, plus a honey pastry.
   - Each is a real conversation with E. Nothing completes on its own.
4. **List complete:** "Quest completed: Alden's Shopping List", then "New objective: Return home to Papa". Nothing ominous on the way.
   - Unseen, Alden now lies wounded below his desk.
   - Coming home before the list is done is just an ordinary visit: Alden is fine.
5. **The homecoming:** plays as Coco comes up the garden path. Until it has played, the door stays shut.
6. **The silent shop:**
   - Books on the floor, a chair knocked over. The narration plays and Coco can look around.
   - She does not leave.
   - From here Sieg no longer watches: he must not see Alden's last moments as if he were there.

## Last words, the stranger, the reunion (Phase 3)

The order is fixed, so the two perspectives can never cross:

1. **Coco finds him (`discovery`).** It starts only when Coco comes within 90 units of Alden; looking around the rest of the shop starts nothing.
   - She drops the bag (it stays by the workbench), and the script plays as written.
   - At the two healing prompts ("E · Cast healing magic") a soft green light gathers on Alden and slips away. It cannot succeed and needs no mashing; E simply moves on.
   - On "Alden's hand falls still" he lies still and stays visible.
   - Sieg is at home throughout, not watching, and cannot read any of it.
2. **Sieg sets out (`sets-out`).**
   - He steps out of Hearthside Cottage. His mother, the villager in the red dress and apron, stops and turns to him, and he walks over to her.
   - Coco is now held beside Papa, with a "Coco stays beside Papa." card.
3. **The stranger:**
   - She stands at Emberbrook's west entrance, where the road leaves the village for Alden's shop.
   - Walking toward her, Sieg gets the narration, his greeting, and her false warning: "There's a fire at the shop, Sieg. You should hurry, knight."
   - He runs for the west road. Only once he is out of town, on the road to the shop, does he wonder how she knew his name and glance back toward Emberbrook (`glance`): she has vanished. She never goes near the shop.
4. **No fire (`no-fire`):** this plays at the door. Only then does the door open for Sieg; until then the shop stays shut to him even if he stands at the door.
5. **The reunion (`reunion`):** both heroes, inside.
   - Sieg's memory of the prologue's evening is his alone: Coco sees "Sieg is quiet for a long moment."
   - The memory lines are labelled "· memory" in a sepia voice.
   - The phase ends at stage `MOURNING` ("Stay together.").

Sieg walks the roads between Emberbrook and the shop by himself (the party's scene stays at the shop). A disconnect at any point pauses the scene on its current line.

**Lines added where the brief gave stage directions:**
- the three lines of Mother seeing Sieg off;
- "Around the same time, Sieg leaves home…";
- "Coco tries to see how badly he is hurt.";
- the healing narration;
- "Then Sieg sees him.";
- "…" for the pause;
- Sieg's "Meanwhile…" cards.

## The funeral (Phase 4)

1. **The following day (`next-day`).** It follows the reunion straight away. Both heroes are outside the shop, and Alden is no longer shown (he is laid to rest). Sieg has his old wooden practice sword with him (shared backpack).
2. **Preparing the grave (`FUNERAL_PREP`).** Both heroes are free, each with their own short task. E at a story spot does it, once: `storySpots` in `chapter0.ts`, with labels in game.
   - Sieg picks up 3 smooth stones along the road, then lays them around the dug site beneath the old tree.
   - Coco picks 3 bunches of flowers in Papa's garden.
   - When the grave is ready, each presses E at it. Once both are ready, the funeral begins: one hero ready is not enough.
   - The stones and flowers pass through the shared backpack and are used up when laid.
3. **The funeral (`funeral`).** The script plays as written.
   - The first line records the burial (`chapter0.burial`): the grave appears and the shop is put right.
   - "Coco places flowers beside the grave" lays her bouquet.
   - "Sieg places it beside the grave" lays the wooden sword. It is a story item only, with no combat use.
   - It ends in silence, at stage `INVESTIGATION`.
4. **What stays.** The stones, the flowers and the sword stay at the grave for good: they are story flags, so both heroes see them, through reconnects and return visits. The regular campaign, which takes place after the funeral, shows the grave dressed the same way.

**Lines added:** the two narration lines of the following day, and Sieg's and Coco's lines about the stones and flowers.

## The investigation and the journal (Phase 5)

1. **Asking around Emberbrook (`INVESTIGATION`).** Each hero walks to the village on their own.
   - Three conversations, in any order: Elder Bertram (who walks the plaza), Brynn (by her apothecary), and a new traveling merchant (east lawn). Each plays the brief's lines.
   - Either hero can start one with E (`storyTalks` with `role: "ANY"`; the scene's `talkTo`).
   - The villager stops and turns to them, and the hero who spoke stays where they are. Their partner walks over to stand beside them, or is brought in from another map (from inside a house, say).
   - The party's scene never moves.
   - Each conversation is recorded once (`chapter0.clue-*`); asking again is ordinary talk.
   - What Brynn says stays a rumor; nothing is confirmed.
2. **The village has heard.** Once Alden has died, the villagers' ordinary lines turn to condolences (`villagerLines`).
3. **Back to the shop (`clues-done`, then `JOURNAL`).** With all three told, the objective is to search Papa's belongings. His desk has a locked compartment, opened together, in either order:
   - Sieg forces the stuck drawer;
   - Coco undoes Papa's seal.
4. **The journal (`journal`).**
   - Inside are Alden's journal, the strange cloth, and the drawing of seven stars around a dark circle. They go into the shared backpack once, with their own icons and descriptions.
   - The scene plays the brief's lines; Alden's words are read in a sepia "Alden's Journal" voice.
   - It ends at stage `DECISION`.
   - Nothing is revealed about the Ember, the attacker, the woman, the cloth's symbol or the oath.

**Lines added:** Sieg asks the merchant about "a woman in a dark hooded cloak" (the brief starts with his answer); a narration line listing what is in the compartment; the condolence lines.

## The road ahead (Phase 6)

- **The decision (`decision`).** It starts when either hero comes to the old tree by the grave. That hero stays where they are; the other walks over, or is brought out of the shop. The brief's lines play.
- **The quest.** "Quest unlocked: The Forgotten Shrine", then its objective, are recorded once (`chapter0.shrine-quest`), and the story reaches `DONE`.
  - The road north out of Emberbrook opens.
  - Travel is shared again, as in the regular campaign.
  - On the chapter's own maps (home, the shop, Emberbrook and its houses), the objective shows the quest: "investigate the abandoned shrine and discover what Alden knew about the Ember."
  - The grave stays dressed as the funeral left it.

## Conversations

Villagers turn to face the hero they talk to, story scenes included: Coco at the errand stalls, both heroes during the investigation, and Sieg's mother. Through a scene, the villager turns to whichever hero is speaking (`turnToSpeaker` in `apps/server/src/prologue.ts`), and the heroes face the villager. The villager walks on when the scene ends.

## Story flags, in order

Prologue, then:
- `chapter0.errand`, `.moonleaf`, `.store`, `.bakery`, `.errand-done`, `.homecoming`, `.silent`;
- `.bag`, `.last-words`, `.sets-out`, `.stranger`, `.glance`, `.no-fire`, `.reunion`;
- `.next-day`, `.stone-1..3`, `.flower-1..3`, `.site-ready`, `.ready-OATH`, `.ready-EMBER`, `.burial`, `.flowers`, `.sword`, `.funeral`;
- `.clue-merchant` / `.clue-bertram` / `.clue-brynn` (any order), `.clues-done`, `.drawer-forced` / `.seal-undone`, `.journal`;
- `.shrine-quest`.

Each is recorded once. Every story event checks its flag before it plays or hands anything over, so nothing replays and no item is given twice.

## New art (PixelLab; sources in each `provenance.json`)

- **Characters (standard mode, 4 directions, high top-down, matching the villagers):**
  - `Village_NPCs/shopkeeper`, `Village_NPCs/baker`, `Village_NPCs/merchant` (the merchant joins in Phase 5).
  - `Story_NPCs/stranger`, the mysterious woman. `hooded/` shades her face into her hood (`scripts/stranger-hood-shadow.py`); she joins in Phase 3.
- **Alden's collapse:** `Story_NPCs/alden/collapse`. It is row 5 of `alden.png`: column 6 is lying wounded, column 7 lying still.
- **Props in `Story_Props`, style-matched to the scene they sit in:**
  - two market stalls;
  - the dropped shopping bag.
- **Funeral props:** a stone, a flower patch, a bouquet and the dug grave site (style-matched to the house's grass).
  - The wooden sword's item icon is PixelLab's steel practice sword recoloured to wood (`scripts/wooden-sword-recolour.py`): shape and outline unchanged.
  - At the grave the sword stands upright in the soil, drawn at 2x so it reads at a glance: `sword_planted.png`, hand-drawn in the icon's palette by `scripts/planted-sword.py`.
- **The old tree:** `old_tree.png`, a large ember-red tree over the grave (drawn at 2x). It replaces three ordinary yard trees (`oldTree.replaces` in `environmentSolids.ts`) so it stands alone. Around the grave the yard is cleared (a rock, a mushroom, a fern and some flowers: `graveClearing` in `EnvironmentView.ts`); their collision went with them.
- **Item icons:** `assets/ui/inventory/items` (see `provenance-chapter0.json`).
  - The journal, cloth and star drawing icons are PixelLab's. `scripts/chapter0-icon-touchups.py` stitches a small symbol on the cloth and inks the drawing's circle dark (both came out wrong); the originals are in `Images/Sprites/Story_Props/icon_sources`.
- **Shop clutter:** copied from the guild pack by `scripts/build-story-props.py` (three open books; a chair turned on its side).

## Tests and QA

- `apps/server/test/chapter0.test.ts` covers:
  - Sieg held offstage and put back after being moved;
  - Coco's solo road with the north road shut;
  - each item bought once, by Coco only;
  - no early homecoming;
  - the door and the silent shop;
  - clear ground for every placement;
  - the conversation over real sockets;
  - finding Papa only by going to him;
  - the bag and the still pose at their lines, and the last words playing once;
  - the shop shut to Sieg during his part;
  - the stranger's warning and vanishing;
  - the reunion with Sieg's private memory;
  - a disconnect mid-scene;
  - the next day;
  - each hero gathering only their own, once;
  - both needed to begin;
  - the flowers, sword and burial at their lines;
  - what stays after a reconnect, and in the regular campaign;
  - conversations started by either hero, with the partner walking over or brought from another map, and the party never moving;
  - each clue recorded once;
  - the condolences;
  - the compartment needing both, its finds handed over once;
  - the decision from either hero;
  - the quest unlocking once;
  - the road north leading on to the Transition Trail.
- `node --import tsx scripts/qa-chapter0.ts qa/<fresh>`: two browsers play from the last morning to the road north. Every line is read via E, every villager talked to via E, and Coco and Sieg walk the story beats with real keys. Latest run: `qa/chapter0-final` (the whole of Part 1, to the road north).
