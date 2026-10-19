import type { Role, SceneId } from "./gameTypes.js";
import type { ItemId } from "./items.js";
import type { NpcFacing } from "./npcs.js";
import {
  BURIAL_FLAG,
  aldenErrandLines,
  chapter0Cutscenes,
} from "./chapter0.js";

// Chapter 0 prologue, "A Promise Kept", as data. The server walks this script
// (apps/server/src/prologue.ts) and owns every stage change. Clients only show
// the current line and send "I've read it" requests.

/** Story stages in play order. */
export const storyStages = [
  "ARRIVAL", // Sieg walks to Alden's shop; Coco is inside.
  "LEAVING", // Out of the shop, toward the road.
  "FOREST_BOUND", // Coco heads for the forest; Sieg follows.
  "TRAIL", // The forest trail and the abandoned cart.
  "AMBUSH", // The clearing: the monsters rise.
  "FIGHT", // A survival fight nobody is meant to win.
  "HOME", // Rescued, healed, scolded; Sieg's farewell; the next morning.
  // Chapter 0, Part 1: The Forgotten Oath (chapter0.ts).
  "ERRAND", // Coco shops in Emberbrook; Sieg watches from home.
  "HOMEWARD", // Everything on the list: back to Papa.
  "SILENT_SHOP", // The shop is quiet. Coco looks around, and finds him.
  "STRANGER", // Meanwhile: Sieg sets out for the shop; someone is waiting.
  "RUSHING", // "There's a fire at the shop." Sieg runs.
  "FINDING", // No fire. No answer. Sieg goes in.
  "MOURNING", // Sieg is with Coco.
  "FUNERAL_PREP", // The next day: stones, flowers, the grave beneath the old tree.
  "INVESTIGATION", // After the funeral: asking around Emberbrook.
  "JOURNAL", // Back to the shop: the locked compartment in Papa's desk.
  "DECISION", // The road ahead (Phase 6).
  "DONE", // Chapter 0 is over; the regular campaign continues.
] as const;
export type StoryStage = (typeof storyStages)[number];

export type StorySpeaker =
  | "ALDEN"
  | "COCO"
  | "SIEG"
  | "NARRATION"
  | "QUEST"
  | "BRYNN"
  | "SHOPKEEPER"
  | "BAKER"
  | "MOTHER"
  | "STRANGER"
  | "BERTRAM"
  | "MERCHANT"
  | "JOURNAL";
export const storySpeakerNames: Record<StorySpeaker, string> = {
  ALDEN: "Alden",
  COCO: "Coco",
  SIEG: "Sieg",
  NARRATION: "",
  QUEST: "Quest",
  BRYNN: "Brynn",
  SHOPKEEPER: "Shopkeeper",
  BAKER: "Baker",
  MOTHER: "Mother",
  STRANGER: "Mysterious Woman",
  BERTRAM: "Elder Bertram",
  MERCHANT: "Traveling Merchant",
  JOURNAL: "Alden's Journal",
};

/** Lying wounded and lying still are Alden's last poses (chapter0.ts). */
export type AldenAction = "idle" | "walk" | "cast" | "wounded" | "still";
export interface AldenPose {
  scene: SceneId;
  x: number;
  y: number;
  facing: NpcFacing;
}

/** Something that happens as a line appears (server-run, client-shown). */
export type StoryCue =
  | "alden-enter" // Alden walks to the scene's `aldenTarget`.
  | "alden-cast" // Alden raises his staff.
  | "flash" // The spell lands: every monster falls on this tick.
  | "drop-bag" // Coco drops the shopping bag (it stays where it fell).
  | "alden-still" // Alden's hand falls still.
  | "stranger-vanish"; // The stranger is gone.

export interface StoryLine {
  speaker: StorySpeaker;
  text: string;
  /** Inner narration only this hero reads; the partner sees `elsewhere`. */
  audience?: Role;
  elsewhere?: string;
  /** Alden turns this way for the line. */
  aldenFacing?: NpcFacing;
  cue?: StoryCue;
  /** The clearing glows with Alden's spell circle while this line shows. */
  glow?: boolean;
  /** Coco's healing light gathers on Alden, and fails (it always fails). */
  heal?: "attempt" | "fail";
  /** Shown under the line to the hero who moves it on, e.g. "E · Heal". */
  prompt?: string;
  /** A remembered line (Sieg recalling the prologue). */
  memory?: boolean;
  /** A permanent story flag recorded as the line appears (e.g. the burial). */
  setFlag?: string;
  /** Shared-backpack items used up as the line appears (laid on the grave). */
  take?: Partial<Record<ItemId, number>>;
  /** Shared-backpack items found as the line appears. */
  give?: Partial<Record<ItemId, number>>;
}

export interface StoryPlacement {
  /** Defaults to the cutscene's scene (a hero may be elsewhere). */
  scene?: SceneId;
  x: number;
  y: number;
  /** Radians, as Player.facing (0 east, PI/2 south). */
  facing: number;
}

export interface StoryCutscene {
  id: string;
  scene: SceneId;
  /**
   * Heroes in the scene (default both). Only they are held still and read its
   * lines; anyone else carries on (or watches, see `offstage`).
   */
  cast?: Role[];
  /**
   * Where the cast is brought for the scene; a hero left out stays put. When a
   * hero's own movement starts the scene, that hero simply stops where they
   * are and the others take their places around them, keeping the same
   * arrangement; unless the scene is `exact` (every mark matters).
   */
  placement: Partial<Record<Role, StoryPlacement>>;
  exact?: boolean;
  /** Shared-backpack items handed over when the scene ends (once). */
  gives?: Partial<Record<ItemId, number>>;
  /** Where Alden is for the scene (absent: he stays where he was). */
  alden?: AldenPose;
  /** What Alden is doing there (default: standing idle). */
  aldenAction?: AldenAction;
  /** The cloaked stranger appears here for the scene. */
  stranger?: AldenPose;
  /** Alden is no longer shown from this scene on (he has been laid to rest). */
  aldenGone?: boolean;
  /**
   * A conversation with this villager, started by either hero talking to
   * them: the villager stops and turns to them, the hero who spoke stays put,
   * and the partner comes to stand beside them.
   */
  talkTo?: string;
  /**
   * A villager this hero walks up to for the scene (they stop and face each
   * other), instead of a fixed placement.
   */
  meet?: { npc: string; role: Role };
  /** Where the "alden-enter" cue walks him. */
  aldenTarget?: { x: number; y: number };
  lines: StoryLine[];
  /** Stage that begins when the last line is read. */
  next: StoryStage;
  /** Permanent flag recorded when the scene ends (later chapters read it). */
  flag: string;
  /** The scene that plays straight after this one. */
  chain?: string;
}

const EAST = 0,
  SOUTH = Math.PI / 2,
  WEST = Math.PI,
  NORTH = -Math.PI / 2;

/** Alden at his magic table in the shop, beside the cauldron. */
export const aldenAtShop: AldenPose = {
  scene: "HOUSE_INTERIOR",
  x: 392,
  y: 398,
  facing: "south",
};

export const prologueStart: Record<
  Role,
  { scene: SceneId; x: number; y: number; facing: number }
> = {
  // Sieg comes up the road from Emberbrook.
  OATH: { scene: "MAIN_HOUSE", x: 760, y: 490, facing: WEST },
  // Coco is already home, rummaging through the shelves.
  EMBER: { scene: "HOUSE_INTERIOR", x: 590, y: 322, facing: NORTH },
};

/** Sieg's room above Hearthside Cottage, where he waits out Coco's errand. */
export const siegAtHome = {
  scene: "VILLAGE_COTTAGE_UPPER" as SceneId,
  x: 420,
  y: 330,
};

export const cutscenes: Record<string, StoryCutscene> = {
  visit: {
    id: "visit",
    scene: "HOUSE_INTERIOR",
    placement: {
      OATH: { x: 600, y: 520, facing: WEST },
      EMBER: { x: 486, y: 470, facing: WEST },
    },
    flag: "prologue.visit",
    next: "LEAVING",
    lines: [
      {
        speaker: "ALDEN",
        aldenFacing: "east",
        text: "Ah, Sieg! Excellent timing. Perhaps you can convince my daughter that explosives do not belong next to the healing potions.",
      },
      {
        speaker: "COCO",
        text: "They're not explosives. They're experimental fire catalysts.",
      },
      { speaker: "SIEG", text: "What's the difference?" },
      { speaker: "COCO", text: "Marketing." },
      {
        speaker: "COCO",
        aldenFacing: "west",
        text: "Papa, Sieg and I are going shopping in Emberbrook.",
      },
      { speaker: "SIEG", text: "We are?" },
      { speaker: "COCO", text: "Yes. Try to keep up." },
      {
        speaker: "ALDEN",
        aldenFacing: "east",
        text: "Wonderful! Sieg, do keep an eye on her, would you?",
      },
      { speaker: "SIEG", text: "Of course, Master Alden." },
      { speaker: "COCO", text: "I'm standing right here." },
      {
        speaker: "NARRATION",
        text: "Coco is already halfway to the door. As Sieg turns to follow, Alden catches his sleeve.",
      },
      {
        speaker: "ALDEN",
        aldenFacing: "east",
        text: "Look after her, Sieg. You know how she gets.",
      },
      { speaker: "SIEG", text: "You tell me every time I visit." },
      {
        speaker: "ALDEN",
        text: "And yet I still worry every time you leave.",
      },
    ],
  },
  fork: {
    id: "fork",
    scene: "MAIN_HOUSE",
    placement: {
      OATH: { x: 540, y: 492, facing: EAST },
      EMBER: { x: 440, y: 492, facing: WEST },
    },
    flag: "prologue.detour",
    next: "FOREST_BOUND",
    lines: [
      { speaker: "SIEG", text: "Coco. The village is that way." },
      { speaker: "COCO", text: "Excellent observation." },
      { speaker: "SIEG", text: "Where are you going?" },
      {
        speaker: "COCO",
        text: "I heard some merchants lost a shipment in the forest. Rare ingredients. Maybe even enchanted stones.",
      },
      { speaker: "SIEG", text: "The forest with the monsters?" },
      { speaker: "COCO", text: "That's the one." },
      { speaker: "SIEG", text: "Absolutely not." },
      { speaker: "COCO", text: "Then I'll see you later!" },
      {
        speaker: "NARRATION",
        text: "Sieg hesitates, and looks back toward Alden's shop.",
      },
      { speaker: "SIEG", text: "He's going to kill me." },
      {
        speaker: "NARRATION",
        audience: "OATH",
        elsewhere: "Sieg is still standing at the fork, lost in thought.",
        text: "Ever since they were children, Alden had asked Sieg to look after Coco. Sieg had always found that strange. Coco was braver than most knights he knew, himself included.",
      },
      {
        speaker: "NARRATION",
        audience: "OATH",
        elsewhere: "Sieg is still standing at the fork, lost in thought.",
        text: "But courage had a way of carrying her into danger.",
      },
      {
        speaker: "NARRATION",
        audience: "OATH",
        elsewhere: "Sieg is still standing at the fork, lost in thought.",
        text: "And if Sieg was ever going to become the knight he hoped to be, he would have to learn to follow where her courage led.",
      },
    ],
  },
};

// --- The forest ------------------------------------------------------------
const TILE = 32;
const at = (tx: number, ty: number) => ({ x: tx * TILE, y: ty * TILE });

/** The ambush: four golems and four cinder wisps, in clearing tiles. */
export const ambushEnemies = [
  { id: "ambush-golem-1", type: "ironbound_sentinel", ...at(9, 8) },
  { id: "ambush-golem-2", type: "ironbound_sentinel", ...at(23, 8) },
  { id: "ambush-golem-3", type: "ironbound_sentinel", ...at(9, 15.5) },
  { id: "ambush-golem-4", type: "ironbound_sentinel", ...at(23, 15.5) },
  { id: "ambush-wisp-1", type: "cinder_wisp", ...at(12.5, 5.5) },
  { id: "ambush-wisp-2", type: "cinder_wisp", ...at(19.5, 5.5) },
  { id: "ambush-wisp-3", type: "cinder_wisp", ...at(11.5, 17) },
  { id: "ambush-wisp-4", type: "cinder_wisp", ...at(20.5, 17) },
] as const;
/** In the fight, heroes never fall below this much health. */
export const AMBUSH_HP_FLOOR = 15;
/** Alden steps in once either hero is this hurt... */
export const AMBUSH_RESCUE_HP = 25;
/** ...or after this long, so the fight never drags. */
export const AMBUSH_SECONDS = 45;
/** Monsters rise one at a time, this far apart, up to this many at once. */
export const AMBUSH_RISE_SECONDS = 3;
export const AMBUSH_MAX = ambushEnemies.length;
/** Rising with the ambush scene, before the fight begins. */
export const AMBUSH_OPENING = 2;
/** A hero this close to the cart finds it. */
export const CART_REACH = 96;

cutscenes.cart = {
  id: "cart",
  scene: "PROLOGUE_TRAIL",
  placement: {
    OATH: { ...at(27.2, 10.3), facing: WEST },
    EMBER: { ...at(23, 9.2), facing: NORTH },
  },
  flag: "prologue.cart",
  next: "TRAIL",
  lines: [
    {
      speaker: "NARRATION",
      text: "A merchant's cart lies tipped on its side. Crates have split open across the grass.",
    },
    {
      speaker: "COCO",
      text: "Look at this! Moonpetal, ember salts, starglass... They left everything!",
    },
    {
      speaker: "SIEG",
      text: "Coco. The wheel's snapped, and the harness was cut. Not untied. Cut.",
    },
    {
      speaker: "SIEG",
      text: "Whoever owned this didn't stop to pack. They ran.",
    },
    {
      speaker: "COCO",
      text: "Then they won't mind if we borrow a few things.",
    },
    {
      speaker: "COCO",
      text: "The tracks keep going. North-west, into the trees. Come on!",
    },
  ],
};
cutscenes.ambush = {
  id: "ambush",
  scene: "PROLOGUE_CLEARING",
  placement: {
    OATH: { ...at(15, 12.5), facing: NORTH },
    EMBER: { ...at(17, 12.8), facing: NORTH },
  },
  flag: "prologue.ambush",
  next: "FIGHT",
  lines: [
    {
      speaker: "NARRATION",
      text: "The trees close in around a quiet clearing. Something heavy shifts beneath the moss.",
    },
    {
      speaker: "NARRATION",
      text: "A stone golem tears free of the earth. A cinder wisp flickers to life between the trunks. More stir beneath the moss.",
    },
    { speaker: "SIEG", text: "Coco. Please tell me you have a plan." },
    { speaker: "COCO", text: "Obviously." },
    { speaker: "SIEG", text: "What is it?" },
    { speaker: "COCO", text: "I'm working on it!" },
  ],
};
cutscenes.rescue = {
  id: "rescue",
  scene: "PROLOGUE_CLEARING",
  placement: {
    OATH: { ...at(15.2, 13.1), facing: NORTH },
    EMBER: { ...at(16.8, 13.3), facing: NORTH },
  },
  alden: { scene: "PROLOGUE_CLEARING", ...at(16, 1), facing: "south" },
  aldenTarget: at(16, 10.6),
  flag: "prologue.rescue",
  next: "HOME",
  chain: "home",
  lines: [
    {
      speaker: "NARRATION",
      cue: "alden-enter",
      glow: true,
      text: "A golem raises its fist over Sieg. Then the whole clearing begins to glow.",
    },
    {
      speaker: "NARRATION",
      glow: true,
      text: "A vast magic circle burns open beneath the monsters' feet.",
    },
    {
      speaker: "ALDEN",
      cue: "alden-cast",
      glow: true,
      text: "I believe that's quite enough.",
    },
    {
      speaker: "NARRATION",
      cue: "flash",
      text: "Light swallows the clearing.",
    },
    {
      speaker: "NARRATION",
      text: "When it fades, Alden stands between the children and the smoking remains of eight monsters.",
    },
    { speaker: "COCO", text: "You could've left one for us." },
    { speaker: "ALDEN", text: "Coco." },
    { speaker: "COCO", text: "...Hello, Papa." },
  ],
};

// --- Home, that evening, and the next morning --------------------------------
cutscenes.home = {
  id: "home",
  scene: "HOUSE_UPPER",
  placement: {
    OATH: { x: 400, y: 500, facing: NORTH },
    EMBER: { x: 332, y: 392, facing: EAST },
  },
  alden: { scene: "HOUSE_UPPER", x: 452, y: 372, facing: "west" },
  flag: "prologue.home",
  next: "HOME",
  chain: "farewell",
  lines: [
    {
      speaker: "NARRATION",
      text: "That evening, at the shop. Alden's magic has closed every wound, if not every argument.",
    },
    { speaker: "ALDEN", text: "The forest is forbidden for a reason." },
    { speaker: "COCO", text: "We were perfectly fine." },
    { speaker: "ALDEN", text: "You were unconscious." },
    { speaker: "COCO", text: "Temporarily." },
    { speaker: "ALDEN", text: "And surrounded by eight monsters." },
    { speaker: "COCO", text: "Details." },
    {
      speaker: "ALDEN",
      aldenFacing: "south",
      text: "And you, young man. You knew better.",
    },
    { speaker: "SIEG", text: "I tried to stop her." },
    { speaker: "COCO", text: "He did. Very loudly." },
    { speaker: "SIEG", text: "She wouldn't listen." },
    { speaker: "ALDEN", text: "Naturally." },
    {
      speaker: "NARRATION",
      text: "Alden sighs. Then his expression softens.",
    },
    {
      speaker: "ALDEN",
      text: "Still... thank you, Sieg. You stayed with her.",
    },
    { speaker: "SIEG", text: "I promised I would." },
    { speaker: "ALDEN", text: "Yes. You always do." },
    {
      speaker: "ALDEN",
      text: "Sieg, have I ever told you what an excellent son-in-law you'd make?",
    },
    { speaker: "SIEG", text: "Master Alden, please—" },
    { speaker: "COCO", text: "NO." },
    {
      speaker: "ALDEN",
      text: "Reliable, courteous, willing to risk his life for my daughter...",
    },
    { speaker: "COCO", text: "Papa!" },
    {
      speaker: "ALDEN",
      text: "And most importantly, perhaps she'd become your responsibility.",
    },
    { speaker: "SIEG", text: "I don't think marriage works that way." },
    { speaker: "ALDEN", text: "You haven't met my daughter." },
    { speaker: "COCO", text: "I CAN HEAR YOU!" },
    {
      speaker: "NARRATION",
      text: "While Coco and Alden argue about weddings, Sieg quietly gathers his things.",
    },
    { speaker: "SIEG", text: "I should probably go." },
    { speaker: "ALDEN", text: "Wise decision." },
    { speaker: "COCO", text: "Don't encourage him!" },
    { speaker: "SIEG", text: "Goodnight, Coco." },
    { speaker: "COCO", text: "Tomorrow. Same time." },
    { speaker: "SIEG", text: "We're not going back to the forest." },
    { speaker: "COCO", text: "I didn't say anything about the forest." },
    { speaker: "SIEG", text: "...Goodnight." },
  ],
};
const COCO_INDOORS = "Downstairs, Coco is still grumbling about sons-in-law.";
cutscenes.farewell = {
  id: "farewell",
  scene: "MAIN_HOUSE",
  placement: {
    OATH: { x: 480, y: 476, facing: NORTH },
    EMBER: { scene: "HOUSE_INTERIOR", x: 492, y: 404, facing: NORTH },
  },
  alden: { scene: "MAIN_HOUSE", x: 480, y: 404, facing: "south" },
  flag: "prologue.farewell",
  next: "HOME",
  chain: "morning",
  lines: [
    {
      speaker: "NARRATION",
      audience: "OATH",
      elsewhere: COCO_INDOORS,
      text: "Outside, the evening air is cool. Alden follows Sieg to the gate.",
    },
    {
      speaker: "ALDEN",
      audience: "OATH",
      elsewhere: COCO_INDOORS,
      text: "Sieg.",
    },
    {
      speaker: "SIEG",
      audience: "OATH",
      elsewhere: COCO_INDOORS,
      text: "Yes, sir?",
    },
    {
      speaker: "ALDEN",
      audience: "OATH",
      elsewhere: COCO_INDOORS,
      text: "You don't have to follow her into every danger.",
    },
    {
      speaker: "SIEG",
      audience: "OATH",
      elsewhere: COCO_INDOORS,
      text: "I know.",
    },
    {
      speaker: "ALDEN",
      audience: "OATH",
      elsewhere: COCO_INDOORS,
      text: "Then why do you?",
    },
    {
      speaker: "SIEG",
      audience: "OATH",
      elsewhere: COCO_INDOORS,
      text: "Because someone should be there when she finds it.",
    },
    {
      speaker: "NARRATION",
      audience: "OATH",
      elsewhere: COCO_INDOORS,
      text: "Alden smiles.",
    },
    {
      speaker: "ALDEN",
      audience: "OATH",
      elsewhere: COCO_INDOORS,
      text: "You'll make a fine knight someday.",
    },
  ],
};
const SIEG_AWAY =
  "The next morning, Sieg is at home, polishing an old wooden practice sword.";
cutscenes.morning = {
  id: "morning",
  scene: "HOUSE_INTERIOR",
  placement: {
    // Sieg is at home: his screen shows his own room while Alden and Coco talk.
    OATH: { ...siegAtHome, facing: NORTH },
    EMBER: { x: 492, y: 404, facing: NORTH },
  },
  alden: { scene: "HOUSE_INTERIOR", x: 392, y: 398, facing: "east" },
  flag: "prologue.complete",
  next: "ERRAND",
  chain: "errand",
  lines: [
    {
      speaker: "NARRATION",
      audience: "EMBER",
      elsewhere: SIEG_AWAY,
      text: "The next morning. Coco measures powders into the cauldron while Alden supervises.",
    },
    {
      speaker: "ALDEN",
      audience: "EMBER",
      elsewhere: SIEG_AWAY,
      text: "Coco, what is the first rule of magic?",
    },
    {
      speaker: "COCO",
      audience: "EMBER",
      elsewhere: SIEG_AWAY,
      text: "Never set fire to anything you can't afford to replace.",
    },
    {
      speaker: "ALDEN",
      audience: "EMBER",
      elsewhere: SIEG_AWAY,
      text: "That's the third rule.",
    },
    {
      speaker: "COCO",
      audience: "EMBER",
      elsewhere: SIEG_AWAY,
      text: "Then the first two clearly weren't important.",
    },
    {
      speaker: "NARRATION",
      audience: "EMBER",
      elsewhere: SIEG_AWAY,
      text: "Alden only hums, and goes back to his notes.",
    },
    {
      speaker: "ALDEN",
      audience: "EMBER",
      elsewhere: SIEG_AWAY,
      text: "I need a few things from Emberbrook. Moonleaf from Brynn, two crystal vials and some candlewick from the general store, and a fresh loaf from the bakery. Bread, Coco. Not cake.",
    },
    {
      speaker: "COCO",
      audience: "EMBER",
      elsewhere: SIEG_AWAY,
      text: "That was one time.",
    },
    {
      speaker: "ALDEN",
      audience: "EMBER",
      elsewhere: SIEG_AWAY,
      text: "And Coco? No detours into the forest.",
    },
    {
      speaker: "COCO",
      audience: "EMBER",
      elsewhere: SIEG_AWAY,
      text: "You take all the fun out of life, Papa.",
    },
    {
      speaker: "ALDEN",
      audience: "EMBER",
      elsewhere: SIEG_AWAY,
      text: "Someone has to.",
    },
    {
      speaker: "NARRATION",
      text: "Coco grabs her hat and heads out the door, down the road to Emberbrook.",
    },
  ],
};
// Chapter 0, Part 1 continues the same script.
Object.assign(cutscenes, chapter0Cutscenes);

/**
 * Where everyone stands once the prologue is over: Coco on the road to
 * Emberbrook, Sieg at home (his room above Hearthside Cottage).
 */
export const prologueEnd: Record<Role, StoryPlacement & { scene: SceneId }> = {
  OATH: { ...siegAtHome, facing: SOUTH },
  EMBER: { scene: "MAIN_HOUSE", x: 520, y: 490, facing: EAST },
};

/** Heroes in a cutscene (everyone unless it names its cast). */
export const castOf = (scene: StoryCutscene): Role[] =>
  scene.cast ?? ["OATH", "EMBER"];

/** Players who must confirm a line before it moves on. */
export function lineReaders(
  line: StoryLine,
  roles: (Role | null)[],
  cast: Role[] = ["OATH", "EMBER"],
) {
  return roles.filter(
    (r) => !!r && cast.includes(r) && (!line.audience || r === line.audience),
  );
}

/** Whether the story has reached `stage` (stages only move forward). */
export const stageReached = (
  story: { stage: StoryStage } | undefined,
  stage: StoryStage,
) => !!story && storyStages.indexOf(story.stage) >= storyStages.indexOf(stage);

/** Free-roam objective for each hero at each stage. */
export const storyObjectives: Partial<
  Record<StoryStage, Record<Role, string>>
> = {
  ARRIVAL: {
    OATH: "Prologue · Visit Alden's magic shop. E at the front door to go inside.",
    EMBER:
      "Prologue · Sieg is on his way. Papa is busy brewing; E to bother him while you wait.",
  },
  LEAVING: {
    OATH: "Prologue · Press E at the shop's front door to head out with Coco. Emberbrook is east of the gate.",
    EMBER:
      "Prologue · Press E at the shop's front door to go outside, then leave through the front gate. Emberbrook is east; the forest is west.",
  },
  FOREST_BOUND: {
    OATH: "Prologue · Coco is heading west into the forest. Catch up with her. E at the FOREST sign.",
    EMBER:
      "Prologue · Follow the road west and press E at the FOREST sign to find the lost shipment.",
  },
  TRAIL: {
    OATH: "Prologue · Stay with Coco. Look for the lost shipment along the trail.",
    EMBER: "Prologue · Follow the trail and find the merchants' lost shipment.",
  },
  AMBUSH: {
    OATH: "Prologue · Something is moving in the clearing...",
    EMBER: "Prologue · Something is moving in the clearing...",
  },
  HOME: {
    OATH: "Prologue · Back at Alden's shop.",
    EMBER: "Prologue · Back home at the shop.",
  },
  FIGHT: {
    OATH: "Prologue · Survive! J to strike, K to guard. Keep the golems off Coco.",
    EMBER:
      "Prologue · Survive! J for fireballs, K to ward. Keep the wisps off Sieg.",
  },
};
/** Once the cart is found, the trail leads on to the clearing. */
export const TRAIL_ONWARD: Record<Role, string> = {
  OATH: "Prologue · Coco is set on following the tracks. E at the north-west trail.",
  EMBER: "Prologue · Follow the tracks: E at the north-west end of the trail.",
};

/** What each hero says when inspecting cargo on the trail (E). */
export const trailInspections: Record<string, Record<Role, string[]>> = {
  crates: {
    OATH: ["Split crates. Something heavy landed on them. From above."],
    EMBER: ["Dried moonpetal, still fragrant! Papa would pay double for this."],
  },
  barrel: {
    OATH: ["The barrel's full. Nobody stops to drink when they're running."],
    EMBER: ["Ember salts. Don't shake it. Definitely don't shake it."],
  },
};

/** What Alden says when a hero talks to him outside a cutscene. */
export const aldenIdleLines: Partial<
  Record<StoryStage, Record<Role, string[]>>
> = {
  ARRIVAL: {
    EMBER: [
      "Coco, if you are going to hover, hover somewhere away from the catalysts.",
      "Sieg should be along any minute. Do try not to drag him anywhere dangerous.",
    ],
    OATH: ["Sieg! Come in, come in."],
  },
  LEAVING: {
    EMBER: ["Emberbrook, Coco. The market. Not anywhere else."],
    OATH: ["Go on, she won't wait for you. She never has."],
  },
  ERRAND: { EMBER: aldenErrandLines, OATH: aldenErrandLines },
};

/** The road west out of the shop, toward the forest. */
export const forestTrailhead = { x: 130, y: 500 };
/** A hero south of the garden fence has reached the road fork. */
export const reachedRoadFork = (p: { x: number; y: number }) => p.y >= 456;

/**
 * Alden's grave at the foot of the small tree west of the garden fence, by the
 * big oak (world units). It sorts in front of that tree's trunk (y416).
 * Chapter 0's burial reveals it; the regular campaign happens after it, so it
 * shows whenever no prologue is running.
 */
export const aldenGrave = { x: 60, y: 352, w: 80, h: 76, groundY: 440 };
export { BURIAL_FLAG };
export const graveVisible = (story: { flags: string[] } | undefined) =>
  !story || story.flags.includes(BURIAL_FLAG);
