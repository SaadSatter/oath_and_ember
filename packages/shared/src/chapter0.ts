import type { Role, SceneId, StoryState } from "./gameTypes.js";
import type { ItemId } from "./items.js";
import type {
  AldenPose,
  StoryCutscene,
  StoryStage,
} from "./prologue.js";

// Chapter 0, Part 1: "The Forgotten Oath", as data. It picks up straight
// after the prologue's last morning: Alden sends Coco shopping. The server
// (apps/server/src/prologue.ts) runs it with the same rules as the prologue.
//
// The two heroes keep separate perspectives. Explicit hand-offs keep them in
// step: while Coco runs the errand, Sieg is at home and watches her (he is
// "offstage"); each of Coco's shop visits is a scene only she plays.

const EAST = 0,
  SOUTH = Math.PI / 2,
  WEST = Math.PI,
  NORTH = -Math.PI / 2;

/** Where Alden lies when Coco comes home: on the floor below his desk. */
export const aldenFallen: AldenPose = {
  scene: "HOUSE_INTERIOR",
  x: 380,
  y: 392,
  facing: "south",
};

/** Coco kneels at Papa's side, east of him. */
export const cocoKneel = { scene: "HOUSE_INTERIOR" as SceneId, x: 436, y: 400 };
/** Coco finds him once she comes this close. */
export const DISCOVERY_REACH = 90;
/**
 * Where the stranger waits: at Emberbrook's west entrance, where the road
 * leaves the village for Alden's shop, facing the way Sieg comes.
 */
export const strangerOnRoad: AldenPose = {
  scene: "EMBERBROOK_VILLAGE",
  x: 120,
  y: 296,
  facing: "east",
};
/** Sieg notices her once he is this close. */
export const STRANGER_REACH = 90;
/**
 * Out of town on the road to the shop, Sieg passes this x and glances back
 * toward Emberbrook: only then does he wonder how she knew his name.
 */
export const GLANCE_X = 660;

/** Opening narration as Coco sets off (her errand; Sieg watches). */
const ERRAND_FLAG = "chapter0.errand";
/** One flag per stop on the list. */
export const errandStops = {
  moonleaf: "chapter0.moonleaf",
  store: "chapter0.store",
  bakery: "chapter0.bakery",
} as const;

export const chapter0Cutscenes: Record<string, StoryCutscene> = {
  errand: {
    id: "errand",
    scene: "MAIN_HOUSE",
    cast: ["EMBER"],
    placement: { EMBER: { x: 520, y: 490, facing: EAST } },
    flag: ERRAND_FLAG,
    next: "ERRAND",
    lines: [
      {
        speaker: "NARRATION",
        text: "It was supposed to be an ordinary day. Papa needed a few supplies, the sun was shining, and for once, Coco had promised not to wander into the forest.",
      },
      {
        speaker: "NARRATION",
        text: "She had every intention of keeping that promise. Probably.",
      },
    ],
  },
  "errand-brynn": {
    id: "errand-brynn",
    scene: "EMBERBROOK_VILLAGE",
    cast: ["EMBER"],
    placement: {},
    flag: errandStops.moonleaf,
    next: "ERRAND",
    gives: { moonleaf: 1 },
    lines: [
      { speaker: "BRYNN", text: "Well, if it isn't Alden's little firebrand." },
      { speaker: "COCO", text: "I'm not little." },
      {
        speaker: "BRYNN",
        text: "And yet somehow you still manage to set things on fire.",
      },
      { speaker: "COCO", text: "That happened once." },
      { speaker: "BRYNN", text: "The counter still has the scorch marks." },
      { speaker: "COCO", text: "They're decorative." },
      { speaker: "BRYNN", text: "What does Alden need today?" },
      {
        speaker: "COCO",
        text: "Moonleaf herbs. And before you ask, yes, I'm actually paying.",
      },
      { speaker: "BRYNN", text: "A miracle. Tell your papa I said hello." },
      { speaker: "COCO", text: "Will do!" },
    ],
  },
  "errand-store": {
    id: "errand-store",
    scene: "EMBERBROOK_VILLAGE",
    cast: ["EMBER"],
    placement: {},
    flag: errandStops.store,
    next: "ERRAND",
    gives: { crystal_vial: 2, candlewick: 1 },
    lines: [
      {
        speaker: "SHOPKEEPER",
        text: "Crystal vials and candlewick? That's an unusual combination.",
      },
      {
        speaker: "COCO",
        text: "Papa's working on something. He won't tell me what.",
      },
      {
        speaker: "SHOPKEEPER",
        text: "Knowing Alden, it's either something brilliant or something that'll blow the roof off.",
      },
      { speaker: "COCO", text: "Why not both?" },
      { speaker: "SHOPKEEPER", text: "That's what worries me." },
    ],
  },
  "errand-bakery": {
    id: "errand-bakery",
    scene: "EMBERBROOK_VILLAGE",
    cast: ["EMBER"],
    placement: {},
    flag: errandStops.bakery,
    next: "ERRAND",
    gives: { fresh_bread: 1, honey_pastry: 1 },
    lines: [
      { speaker: "BAKER", text: "The usual loaf for Alden?" },
      {
        speaker: "COCO",
        text: "Yes, please. And one of those honey pastries.",
      },
      { speaker: "BAKER", text: "Is that on his list?" },
      { speaker: "COCO", text: "It's a very important magical ingredient." },
      { speaker: "BAKER", text: "For what spell?" },
      { speaker: "COCO", text: "Happiness." },
      { speaker: "BAKER", text: "Tell Alden he still owes me a visit." },
      { speaker: "COCO", text: "I will!" },
    ],
  },
  // Everything on the list. Nothing ominous: the tragedy must surprise.
  "errand-done": {
    id: "errand-done",
    scene: "EMBERBROOK_VILLAGE",
    cast: ["EMBER"],
    placement: {},
    // Alden is attacked while Coco is away; nobody sees it happen.
    alden: aldenFallen,
    aldenAction: "wounded",
    flag: "chapter0.errand-done",
    next: "HOMEWARD",
    lines: [
      { speaker: "QUEST", text: "Quest completed: Alden's Shopping List." },
      { speaker: "QUEST", text: "New objective: Return home to Papa." },
    ],
  },
  homecoming: {
    id: "homecoming",
    scene: "MAIN_HOUSE",
    cast: ["EMBER"],
    placement: { EMBER: { x: 480, y: 362, facing: NORTH } },
    flag: "chapter0.homecoming",
    next: "SILENT_SHOP",
    lines: [
      { speaker: "COCO", text: "Papa! I'm back!" },
      {
        speaker: "COCO",
        text: "And before you ask, I didn't go anywhere near the forest!",
      },
      { speaker: "NARRATION", text: "No response." },
      { speaker: "NARRATION", text: "The shop door is slightly open." },
      { speaker: "COCO", text: "...Papa?" },
    ],
  },
  silent: {
    id: "silent",
    scene: "HOUSE_INTERIOR",
    cast: ["EMBER"],
    placement: {},
    flag: "chapter0.silent",
    next: "SILENT_SHOP",
    lines: [
      { speaker: "NARRATION", text: "Inside, the shop is unusually quiet." },
      { speaker: "NARRATION", text: "Something was wrong." },
      { speaker: "NARRATION", text: "Papa never left his books on the floor." },
      { speaker: "NARRATION", text: "He barely let Coco touch them." },
    ],
  },
  // Act II: Coco finds him. Only she plays it; Sieg is at home.
  discovery: {
    id: "discovery",
    scene: "HOUSE_INTERIOR",
    cast: ["EMBER"],
    // She goes to kneel at his side, wherever she spotted him from.
    exact: true,
    placement: { EMBER: { ...cocoKneel, facing: WEST } },
    flag: "chapter0.last-words",
    next: "STRANGER",
    chain: "sets-out",
    lines: [
      { speaker: "COCO", text: "Papa?" },
      { speaker: "COCO", text: "Papa!" },
      {
        speaker: "NARRATION",
        cue: "drop-bag",
        text: "Coco drops the shopping bag and rushes to him.",
      },
      { speaker: "COCO", text: "Hey. Hey, wake up." },
      { speaker: "COCO", text: "This isn't funny." },
      { speaker: "NARRATION", text: "Alden barely opens his eyes." },
      { speaker: "ALDEN", text: "...Coco." },
      { speaker: "COCO", text: "Papa! What happened? Who did this?" },
      { speaker: "ALDEN", text: "You... came back..." },
      {
        speaker: "COCO",
        text: "Of course I came back! I got everything you asked for.",
      },
      {
        speaker: "NARRATION",
        text: "Coco tries to see how badly he is hurt.",
      },
      { speaker: "COCO", text: "Don't move. I can fix this." },
      { speaker: "ALDEN", text: "Coco..." },
      { speaker: "COCO", text: "I know healing magic. You taught me." },
      { speaker: "ALDEN", text: "Listen..." },
      {
        speaker: "COCO",
        text: "No. You listen. You're going to be fine.",
      },
      {
        speaker: "NARRATION",
        heal: "attempt",
        prompt: "E · Cast healing magic",
        text: "Coco presses her hands over the wound and calls up her healing magic.",
      },
      { speaker: "COCO", heal: "fail", text: "...Why isn't it working?" },
      { speaker: "COCO", heal: "fail", text: "Come on. Come on!" },
      { speaker: "ALDEN", text: "My little... firebrand..." },
      { speaker: "COCO", text: "Don't call me that. Save your strength." },
      { speaker: "NARRATION", text: "Alden reaches toward Coco." },
      { speaker: "ALDEN", text: "Remember..." },
      { speaker: "COCO", text: "Remember what?" },
      { speaker: "ALDEN", text: "...your oath." },
      {
        speaker: "COCO",
        text: "What oath? Papa, what are you talking about?",
      },
      { speaker: "ALDEN", text: "I... am sorry..." },
      {
        speaker: "NARRATION",
        cue: "alden-still",
        text: "Alden's hand falls still.",
      },
      { speaker: "COCO", text: "Papa?" },
      { speaker: "COCO", text: "...Papa." },
      { speaker: "COCO", text: "No." },
      {
        speaker: "NARRATION",
        heal: "fail",
        prompt: "E · Cast healing magic",
        text: "Coco tries to heal him again. Nothing happens.",
      },
      { speaker: "COCO", text: "Please." },
      { speaker: "COCO", text: "Please, Papa..." },
      { speaker: "NARRATION", text: "The room becomes silent." },
      {
        speaker: "NARRATION",
        text: "The shopping bag lies on the floor beside the workbench.",
      },
    ],
  },
  // Act III: meanwhile, Sieg sets out as he does most afternoons.
  "sets-out": {
    id: "sets-out",
    scene: "EMBERBROOK_VILLAGE",
    cast: ["OATH"],
    // He steps out of Hearthside Cottage; his mother stops to see him off.
    placement: { OATH: { x: 190, y: 296, facing: SOUTH } },
    meet: { npc: "mother", role: "OATH" },
    // She is waiting on the road before he ever gets there.
    stranger: strangerOnRoad,
    flag: "chapter0.sets-out",
    next: "STRANGER",
    lines: [
      {
        speaker: "NARRATION",
        text: "Around the same time, Sieg leaves home for his usual visit to the shop.",
      },
      { speaker: "MOTHER", text: "Off to Alden's again?" },
      { speaker: "SIEG", text: "Same as always." },
      {
        speaker: "MOTHER",
        text: "Tell him I said hello. And bring Coco round for supper soon.",
      },
    ],
  },
  stranger: {
    id: "stranger",
    scene: "EMBERBROOK_VILLAGE",
    cast: ["OATH"],
    placement: { OATH: { x: 200, y: 320, facing: WEST } },
    flag: "chapter0.stranger",
    next: "RUSHING",
    lines: [
      {
        speaker: "NARRATION",
        text: "Sieg had visited Alden's shop more times than he could count.",
      },
      {
        speaker: "NARRATION",
        text: "Usually, Coco would already be outside, waiting to drag him into whatever trouble she'd discovered that day.",
      },
      { speaker: "NARRATION", text: "Today, someone else was waiting." },
      {
        speaker: "SIEG",
        text: "Hey! I haven't seen you around here before. Are you here to buy potions? Master Alden makes the best!",
      },
      {
        speaker: "STRANGER",
        text: "There's a fire at the shop, Sieg. You should hurry, knight.",
      },
      { speaker: "SIEG", text: "WHAT?! COCO!!" },
    ],
  },
  glance: {
    id: "glance",
    scene: "MAIN_HOUSE",
    cast: ["OATH"],
    placement: { OATH: { x: 624, y: 494, facing: EAST } },
    flag: "chapter0.glance",
    next: "RUSHING",
    lines: [
      { speaker: "SIEG", text: "Wait... how did she know my name?" },
      { speaker: "NARRATION", text: "He glances back." },
      {
        speaker: "NARRATION",
        cue: "stranger-vanish",
        text: "The woman has vanished.",
      },
      { speaker: "SIEG", text: "Never mind that. Coco could be in danger!" },
    ],
  },
  "no-fire": {
    id: "no-fire",
    scene: "MAIN_HOUSE",
    cast: ["OATH"],
    placement: { OATH: { x: 480, y: 362, facing: NORTH } },
    flag: "chapter0.no-fire",
    next: "FINDING",
    lines: [
      { speaker: "SIEG", text: "Huh? I don't see a fire..." },
      { speaker: "SIEG", text: "Maybe Master Alden already put it out?" },
      { speaker: "SIEG", text: "Coco? Master Alden?" },
      { speaker: "NARRATION", text: "No answer." },
    ],
  },
  // Act IV: both heroes again.
  reunion: {
    id: "reunion",
    scene: "HOUSE_INTERIOR",
    // Sieg comes to kneel beside Coco.
    exact: true,
    placement: {
      EMBER: { ...cocoKneel, facing: WEST },
      OATH: { x: 476, y: 436, facing: WEST },
    },
    flag: "chapter0.reunion",
    next: "MOURNING",
    chain: "next-day",
    lines: [
      { speaker: "SIEG", text: "Coco?" },
      { speaker: "COCO", text: "Sieg..." },
      { speaker: "SIEG", text: "What happened?" },
      { speaker: "NARRATION", text: "Then Sieg sees him." },
      { speaker: "SIEG", text: "...Master Alden?" },
      { speaker: "COCO", text: "I found him like this." },
      {
        speaker: "COCO",
        text: "I didn't do anything. I just went shopping.",
      },
      { speaker: "COCO", text: "I didn't—" },
      { speaker: "SIEG", text: "I know." },
      { speaker: "COCO", text: "You don't even know what happened." },
      { speaker: "SIEG", text: "Then tell me. I'm listening." },
      { speaker: "NARRATION", text: "Coco looks toward Alden." },
      { speaker: "COCO", text: "He was alive when I left." },
      {
        speaker: "COCO",
        text: "He was making fun of me. He told me not to go into the forest.",
      },
      { speaker: "COCO", text: "And now..." },
      { speaker: "SIEG", text: "Coco..." },
      {
        speaker: "NARRATION",
        text: "Coco gestures toward the shopping bag.",
      },
      { speaker: "COCO", text: "I got everything." },
      { speaker: "COCO", text: "Everything on his list." },
      { speaker: "NARRATION", text: "Sieg kneels beside her." },
      { speaker: "SIEG", text: "I know you did." },
      { speaker: "NARRATION", text: "..." },
      { speaker: "COCO", text: "I tried to heal him." },
      { speaker: "SIEG", text: "I know." },
      { speaker: "COCO", text: "It didn't work." },
      {
        speaker: "COCO",
        text: "He saved us yesterday. Eight monsters, Sieg. Eight.",
      },
      { speaker: "COCO", text: "How could someone do this to him?" },
      { speaker: "SIEG", text: "I don't know." },
      // Sieg remembers the evening after the forest (the prologue's home scene).
      {
        speaker: "ALDEN",
        memory: true,
        audience: "OATH",
        elsewhere: "Sieg is quiet for a long moment.",
        text: "Still... thank you, Sieg. You stayed with her.",
      },
      {
        speaker: "SIEG",
        memory: true,
        audience: "OATH",
        elsewhere: "Sieg is quiet for a long moment.",
        text: "I promised I would.",
      },
      {
        speaker: "ALDEN",
        memory: true,
        audience: "OATH",
        elsewhere: "Sieg is quiet for a long moment.",
        text: "Yes. You always do.",
      },
      { speaker: "SIEG", text: "I'm here, Coco." },
      { speaker: "SIEG", text: "I'm not going anywhere." },
    ],
  },
};

/** The burial: the grave beneath the old tree is there from now on. */
export const BURIAL_FLAG = "chapter0.burial";
/** Act V flags. */
export const FUNERAL = {
  siteReady: "chapter0.site-ready",
  flowers: "chapter0.flowers",
  sword: "chapter0.sword",
  done: "chapter0.funeral",
} as const;
/** The grave site, below the tree west of the garden fence. */
export const graveFront = { x: 100, y: 452 };

// Act V: the following day, and the funeral beneath the old tree.
chapter0Cutscenes["next-day"] = {
  id: "next-day",
  scene: "MAIN_HOUSE",
  placement: {
    EMBER: { x: 180, y: 440, facing: WEST },
    // On the open road east of the old oak, not hidden under its leaves.
    OATH: { x: 330, y: 500, facing: WEST },
  },
  aldenGone: true,
  // Sieg brought his old practice sword from home.
  gives: { wooden_sword: 1 },
  flag: "chapter0.next-day",
  next: "FUNERAL_PREP",
  lines: [
    {
      speaker: "NARRATION",
      text: "Night falls over the quiet shop. Neither of them sleeps much.",
    },
    {
      speaker: "NARRATION",
      text: "The following day, Coco and Sieg make ready to lay Alden to rest beneath the old tree beside the shop.",
    },
    { speaker: "SIEG", text: "I'll find some stones for the grave." },
    {
      speaker: "COCO",
      text: "...Papa would want flowers. From his garden.",
    },
    { speaker: "QUEST", text: "New objective: Prepare Alden's grave." },
  ],
};
chapter0Cutscenes.funeral = {
  id: "funeral",
  scene: "MAIN_HOUSE",
  exact: true,
  placement: {
    EMBER: { x: 72, y: 478, facing: NORTH },
    OATH: { x: 118, y: 478, facing: NORTH },
  },
  flag: FUNERAL.done,
  next: "INVESTIGATION",
  lines: [
    {
      speaker: "NARRATION",
      setFlag: BURIAL_FLAG,
      text: "The following day, beneath the old tree beside the shop, Coco and Sieg laid Alden to rest.",
    },
    {
      speaker: "NARRATION",
      text: "It was the same tree beneath which he had watched them play as children.",
    },
    {
      speaker: "NARRATION",
      setFlag: FUNERAL.flowers,
      take: { wildflowers: 3 },
      text: "Coco places flowers beside the grave.",
    },
    {
      speaker: "COCO",
      text: "Papa always said this tree was older than the village.",
    },
    { speaker: "SIEG", text: "He told me it was older than the kingdom." },
    { speaker: "COCO", text: "He told me he planted it himself." },
    { speaker: "SIEG", text: "..." },
    { speaker: "COCO", text: "He was a terrible liar." },
    {
      speaker: "NARRATION",
      text: "Sieg takes out a small wooden practice sword: the first sword Alden ever gave him, when he was seven years old.",
    },
    {
      speaker: "NARRATION",
      setFlag: FUNERAL.sword,
      take: { wooden_sword: 1 },
      text: "Sieg places it beside the grave.",
    },
    { speaker: "COCO", text: "Isn't that your first sword?" },
    { speaker: "SIEG", text: "He gave it to me when I was seven." },
    { speaker: "COCO", text: "You kept it all these years?" },
    {
      speaker: "SIEG",
      text: "He told me a sword wasn't meant to make me stronger than others.",
    },
    { speaker: "SIEG", text: "It was meant to help me protect them." },
    { speaker: "COCO", text: "That sounds like Papa." },
    {
      speaker: "SIEG",
      text: "He was the first person who believed I could become a knight.",
    },
    { speaker: "NARRATION", text: "..." },
    { speaker: "COCO", text: "He believed in you more than you know." },
    { speaker: "SIEG", text: "He believed in both of us." },
    { speaker: "COCO", text: "I wish I'd said goodbye." },
    { speaker: "NARRATION", text: "..." },
  ],
};

// Act VI: whispers of Ember. Either hero may start each conversation; both
// take part, in any order, and each is recorded once.
export const CLUES = {
  bertram: "chapter0.clue-bertram",
  brynn: "chapter0.clue-brynn",
  merchant: "chapter0.clue-merchant",
} as const;
chapter0Cutscenes["ask-bertram"] = {
  id: "ask-bertram",
  scene: "EMBERBROOK_VILLAGE",
  talkTo: "elder",
  placement: {},
  flag: CLUES.bertram,
  next: "INVESTIGATION",
  lines: [
    { speaker: "BERTRAM", text: "Alden... dead? That cannot be." },
    { speaker: "SIEG", text: "We're trying to find out who did this." },
    { speaker: "BERTRAM", text: "Your master was no ordinary mage, Sieg." },
    { speaker: "COCO", text: "I know." },
    { speaker: "BERTRAM", text: "No, child. I don't believe you do." },
    { speaker: "COCO", text: "Then tell me." },
    {
      speaker: "BERTRAM",
      text: "He arrived in Emberbrook many years ago. A baby in his arms and a past he refused to speak of.",
    },
    { speaker: "COCO", text: "Me." },
    {
      speaker: "BERTRAM",
      text: "Yes. He asked for a quiet place where the two of you could live in peace.",
    },
    { speaker: "SIEG", text: "Was he hiding from someone?" },
    { speaker: "BERTRAM", text: "I never asked. Perhaps I should have." },
  ],
};
chapter0Cutscenes["ask-brynn"] = {
  id: "ask-brynn",
  scene: "EMBERBROOK_VILLAGE",
  talkTo: "healer",
  placement: {},
  flag: CLUES.brynn,
  next: "INVESTIGATION",
  lines: [
    { speaker: "BRYNN", text: "I heard about Alden. I'm so sorry, Coco." },
    {
      speaker: "COCO",
      text: "Did he ever tell you what he was working on?",
    },
    { speaker: "BRYNN", text: "Not directly. But there were rumors." },
    { speaker: "SIEG", text: "What kind of rumors?" },
    { speaker: "BRYNN", text: "That he kept something called the Ember." },
    {
      speaker: "COCO",
      text: "An ember? Papa worked with fire magic all the time.",
    },
    { speaker: "BRYNN", text: "Not an ember. The Ember. That's how people said it." },
    { speaker: "SIEG", text: "What is it?" },
    {
      speaker: "BRYNN",
      text: "I couldn't tell you. It was only ever a name, whispered over drinks. I never met anyone who'd seen it.",
    },
    { speaker: "COCO", text: "And you think someone killed him for it?" },
    { speaker: "BRYNN", text: "I don't know. And I won't pretend I do." },
  ],
};
chapter0Cutscenes["ask-merchant"] = {
  id: "ask-merchant",
  scene: "EMBERBROOK_VILLAGE",
  talkTo: "merchant",
  placement: {},
  flag: CLUES.merchant,
  next: "INVESTIGATION",
  lines: [
    {
      speaker: "SIEG",
      text: "Excuse me. Have you seen a woman in a dark hooded cloak around here?",
    },
    {
      speaker: "MERCHANT",
      text: "A cloaked woman? Yes, I saw someone matching that description near the old road.",
    },
    { speaker: "SIEG", text: "Did you see where she went?" },
    { speaker: "MERCHANT", text: "Toward the abandoned shrine, I think." },
    { speaker: "COCO", text: "What shrine?" },
    {
      speaker: "MERCHANT",
      text: "The one beyond the monster-infested woods. People used to travel there to ask the guardian goddess for protection.",
    },
    { speaker: "SIEG", text: "Used to?" },
    {
      speaker: "MERCHANT",
      text: "She stopped answering prayers years ago. Villages emptied, monsters moved in. Nobody goes there anymore.",
    },
    { speaker: "COCO", text: "Then that's where we go." },
    {
      speaker: "SIEG",
      text: "We don't even know whether the woman was involved.",
    },
    { speaker: "COCO", text: "She's the only lead we've got." },
  ],
};
/** Everyone who knows something has told it. */
export const cluesGathered = (story: StoryState) =>
  Object.values(CLUES).every((f) => story.flags.includes(f));
chapter0Cutscenes["clues-done"] = {
  id: "clues-done",
  scene: "EMBERBROOK_VILLAGE",
  placement: {},
  cast: ["OATH", "EMBER"],
  flag: "chapter0.clues-done",
  next: "JOURNAL",
  lines: [
    {
      speaker: "QUEST",
      text: "Investigation: Emberbrook has told them all it knows.",
    },
    {
      speaker: "QUEST",
      text: "New objective: Search Papa's belongings at the shop.",
    },
  ],
};

// Act VII: Alden's secret, in the locked compartment of his desk.
export const JOURNAL_FLAGS = {
  drawer: "chapter0.drawer-forced",
  seal: "chapter0.seal-undone",
  found: "chapter0.journal",
} as const;
chapter0Cutscenes.journal = {
  id: "journal",
  scene: "HOUSE_INTERIOR",
  exact: true,
  placement: {
    EMBER: { x: 372, y: 384, facing: NORTH },
    OATH: { x: 420, y: 388, facing: NORTH },
  },
  flag: JOURNAL_FLAGS.found,
  next: "DECISION",
  lines: [
    {
      speaker: "NARRATION",
      give: { alden_journal: 1, strange_cloth: 1, star_drawing: 1 },
      text: "Inside the compartment: a worn journal, a scrap of cloth bearing a strange symbol, and a drawing of seven stars around a dark circle.",
    },
    { speaker: "COCO", text: "I never knew this was here." },
    { speaker: "SIEG", text: "He kept it locked?" },
    {
      speaker: "COCO",
      text: "Papa barely locked anything. He always said I'd find a way in eventually.",
    },
    { speaker: "SIEG", text: "He wasn't wrong." },
    { speaker: "NARRATION", text: "Coco opens the journal." },
    {
      speaker: "JOURNAL",
      text: "\"If the Ember has been found, the others will not remain hidden for long.\"",
    },
    {
      speaker: "JOURNAL",
      text: "\"I can only hope the old guardian remembers what she promised.\"",
    },
    { speaker: "SIEG", text: "The Ember again." },
    { speaker: "COCO", text: "And the guardian..." },
    { speaker: "SIEG", text: "The goddess at the abandoned shrine?" },
    { speaker: "COCO", text: "It has to be." },
    { speaker: "NARRATION", text: "Coco notices the cloth." },
    { speaker: "COCO", text: "I've seen this before." },
    { speaker: "SIEG", text: "Where?" },
    {
      speaker: "COCO",
      text: "Papa kept it with my things when I was little.",
    },
    { speaker: "SIEG", text: "Do you know what the symbol means?" },
    { speaker: "COCO", text: "No. He never told me." },
    { speaker: "NARRATION", text: "Sieg studies the journal." },
    {
      speaker: "SIEG",
      text: "Coco, we should be careful. Whoever attacked Alden might still be looking for something.",
    },
    { speaker: "COCO", text: "Then we should find it first." },
    {
      speaker: "SIEG",
      text: "That's exactly what I was afraid you'd say.",
    },
  ],
};

// Act VIII: the road ahead, by the grave beneath the old tree.
/** Either hero coming this close to the grave starts the decision. */
export const DECISION_REACH = 130;
export const SHRINE_QUEST = "chapter0.shrine-quest";
chapter0Cutscenes.decision = {
  id: "decision",
  scene: "MAIN_HOUSE",
  placement: {
    // Sieg by the old tree; Coco ready to go.
    OATH: { x: 180, y: 420, facing: WEST },
    EMBER: { x: 110, y: 486, facing: NORTH },
  },
  flag: SHRINE_QUEST,
  // The finale (chapter0Finale.ts) picks up on the road north.
  next: "SHRINE_ROAD",
  lines: [
    {
      speaker: "SIEG",
      text: "The shrine is beyond the forest. There'll be monsters, traps, probably worse.",
    },
    { speaker: "COCO", text: "We've handled monsters before." },
    { speaker: "SIEG", text: "We nearly died." },
    { speaker: "COCO", text: "And Papa saved us." },
    { speaker: "NARRATION", text: "Coco pauses." },
    { speaker: "COCO", text: "...Papa isn't here this time." },
    { speaker: "SIEG", text: "I know." },
    { speaker: "NARRATION", text: "Coco turns toward Sieg." },
    { speaker: "COCO", text: "You don't have to come." },
    { speaker: "SIEG", text: "We've had this conversation before." },
    { speaker: "COCO", text: "I'm serious." },
    { speaker: "SIEG", text: "So am I." },
    { speaker: "NARRATION", text: "Sieg rests a hand on his sword." },
    { speaker: "SIEG", text: "I couldn't protect him." },
    { speaker: "COCO", text: "Sieg..." },
    { speaker: "SIEG", text: "But I can still keep my promise." },
    { speaker: "NARRATION", text: "Coco smiles slightly." },
    {
      speaker: "COCO",
      text: "You know I'm probably going to do something stupid.",
    },
    { speaker: "SIEG", text: "I'm counting on it." },
    { speaker: "COCO", text: "And you're still coming?" },
    {
      speaker: "SIEG",
      text: "Someone should be there when you find trouble.",
    },
    { speaker: "NARRATION", text: "Coco smiles." },
    { speaker: "COCO", text: "Then let's go find a goddess." },
    { speaker: "QUEST", text: "Quest unlocked: The Forgotten Shrine." },
    {
      speaker: "QUEST",
      text: "Objective: Find the Forgotten Shrine.",
    },
  ],
};

/**
 * Things a hero does with E at a spot during the story (Act V's quiet work).
 * Each is done once, by the hero it belongs to, when what it needs is done.
 */
export interface StorySpot {
  id: string;
  scene: SceneId;
  x: number;
  y: number;
  stage: StoryStage;
  role: Role;
  /** Recorded when it is done. */
  flag: string;
  label: string;
  /** Flags it waits on. */
  needs?: string[];
  gives?: Partial<Record<ItemId, number>>;
  take?: Partial<Record<ItemId, number>>;
}
const stoneAt = [
  { x: 330, y: 560 },
  // Both on the open road, clear of the two trees' canopies.
  { x: 590, y: 522 },
  { x: 410, y: 495 },
];
const flowerAt = [
  { x: 256, y: 392 },
  { x: 452, y: 410 },
  { x: 590, y: 380 },
];
export const stoneSpots = stoneAt.map((at, i) => ({
  id: `stone-${i + 1}`,
  ...at,
}));
export const flowerSpots = flowerAt.map((at, i) => ({
  id: `flower-${i + 1}`,
  ...at,
}));
const stoneFlags = stoneSpots.map((s) => `chapter0.${s.id}`),
  flowerFlags = flowerSpots.map((s) => `chapter0.${s.id}`);
export const storySpots: StorySpot[] = [
  ...stoneSpots.map((s, i) => ({
    id: s.id,
    scene: "MAIN_HOUSE" as SceneId,
    x: s.x,
    y: s.y,
    stage: "FUNERAL_PREP" as StoryStage,
    role: "OATH" as Role,
    flag: stoneFlags[i],
    label: "E · Pick up the stone",
    gives: { river_stone: 1 },
  })),
  ...flowerSpots.map((s, i) => ({
    id: s.id,
    scene: "MAIN_HOUSE" as SceneId,
    x: s.x,
    y: s.y,
    stage: "FUNERAL_PREP" as StoryStage,
    role: "EMBER" as Role,
    flag: flowerFlags[i],
    label: "E · Pick flowers",
    gives: { wildflowers: 1 },
  })),
  {
    id: "lay-stones",
    scene: "MAIN_HOUSE",
    ...graveFront,
    stage: "FUNERAL_PREP",
    role: "OATH",
    flag: FUNERAL.siteReady,
    label: "E · Lay the stones around the grave",
    needs: stoneFlags,
    take: { river_stone: 3 },
  },
  {
    id: "ready-OATH",
    scene: "MAIN_HOUSE",
    ...graveFront,
    stage: "FUNERAL_PREP",
    role: "OATH",
    flag: "chapter0.ready-OATH",
    label: "E · Begin the funeral",
    needs: [FUNERAL.siteReady],
  },
  {
    id: "ready-EMBER",
    scene: "MAIN_HOUSE",
    ...graveFront,
    stage: "FUNERAL_PREP",
    role: "EMBER",
    flag: "chapter0.ready-EMBER",
    label: "E · Begin the funeral",
    needs: [FUNERAL.siteReady, ...flowerFlags],
  },
  // The locked compartment in Papa's desk: Sieg forces the stuck drawer,
  // Coco undoes the seal Papa put on it. Either order; both are needed.
  {
    id: "force-drawer",
    scene: "HOUSE_INTERIOR",
    x: 420,
    y: 384,
    stage: "JOURNAL",
    role: "OATH",
    flag: JOURNAL_FLAGS.drawer,
    label: "E · Force the stuck drawer",
  },
  {
    id: "undo-seal",
    scene: "HOUSE_INTERIOR",
    x: 360,
    y: 384,
    stage: "JOURNAL",
    role: "EMBER",
    flag: JOURNAL_FLAGS.seal,
    label: "E · Undo Papa's seal",
  },
];
export const compartmentOpen = (story: StoryState) =>
  story.flags.includes(JOURNAL_FLAGS.drawer) &&
  story.flags.includes(JOURNAL_FLAGS.seal);
/** Reach of a story spot (world units). */
export const SPOT_REACH = 44;
/** The spots this hero can use right now. */
export function spotsFor(story: StoryState | undefined, role: Role | null) {
  if (!story || !role || story.cutscene) return [];
  return storySpots.filter(
    (s) =>
      s.stage === story.stage &&
      s.role === role &&
      !story.flags.includes(s.flag) &&
      (s.needs ?? []).every((f) => story.flags.includes(f)),
  );
}
export const funeralReady = (story: StoryState) =>
  story.flags.includes("chapter0.ready-OATH") &&
  story.flags.includes("chapter0.ready-EMBER");

/** Villager conversations the story takes over: who, when, for whom. */
export const storyTalks: {
  npc: string;
  stage: StoryStage;
  /** Who can start it ("ANY": either hero). */
  role: Role | "ANY";
  cutscene: string;
}[] = [
  { npc: "elder", stage: "INVESTIGATION", role: "ANY", cutscene: "ask-bertram" },
  { npc: "healer", stage: "INVESTIGATION", role: "ANY", cutscene: "ask-brynn" },
  {
    npc: "merchant",
    stage: "INVESTIGATION",
    role: "ANY",
    cutscene: "ask-merchant",
  },
  { npc: "healer", stage: "ERRAND", role: "EMBER", cutscene: "errand-brynn" },
  {
    npc: "shopkeeper",
    stage: "ERRAND",
    role: "EMBER",
    cutscene: "errand-store",
  },
  { npc: "baker", stage: "ERRAND", role: "EMBER", cutscene: "errand-bakery" },
];

/** The story scene a villager plays for this hero now, if any. */
export function storyTalk(
  story: StoryState | undefined,
  role: Role | null,
  npcId: string,
  cutscenes: Record<string, StoryCutscene>,
) {
  if (!story || !role || story.cutscene) return null;
  const talk = storyTalks.find(
    (t) =>
      t.npc === npcId &&
      t.stage === story.stage &&
      (t.role === role || t.role === "ANY") &&
      !story.flags.includes(cutscenes[t.cutscene].flag),
  );
  return talk?.cutscene ?? null;
}

/** The errand is done once every stop has been made. */
export const errandComplete = (story: StoryState) =>
  Object.values(errandStops).every((f) => story.flags.includes(f));

/** A hero kept out of play for a stretch of the story, and what they see. */
export interface Offstage {
  scene: SceneId;
  x: number;
  y: number;
  /** Their screen follows the partner and shows the partner's scenes. */
  watch: boolean;
  /** The card shown while they wait. */
  text: string;
}
const SIEG_WATCHES: Offstage = {
  scene: "VILLAGE_COTTAGE_UPPER",
  x: 304,
  y: 412,
  watch: true,
  text: "Meanwhile, Sieg is at home, polishing an old wooden practice sword.",
};
/**
 * Once Coco steps inside, Sieg stops watching: he must not see Papa's last
 * moments as though he had been there.
 */
const SIEG_AWAY: Offstage = {
  ...SIEG_WATCHES,
  watch: false,
  text: "Meanwhile, Sieg sets the old practice sword aside. It is nearly time for his usual visit to the shop.",
};
/** While Sieg's part plays, Coco stays where she is. */
const COCO_STAYS: Offstage = {
  ...cocoKneel,
  watch: false,
  text: "Coco stays beside Papa.",
};
export const offstageByStage: Partial<
  Record<StoryStage, Partial<Record<Role, Offstage>>>
> = {
  ERRAND: { OATH: SIEG_WATCHES },
  HOMEWARD: { OATH: SIEG_WATCHES },
  SILENT_SHOP: { OATH: SIEG_AWAY },
  STRANGER: { EMBER: COCO_STAYS },
  RUSHING: { EMBER: COCO_STAYS },
  FINDING: { EMBER: COCO_STAYS },
};
/**
 * Whether (and how) this hero is offstage right now. A hero in the scene that
 * is playing (Coco in the reunion) is on stage for it.
 */
export function offstageFor(story: StoryState | undefined, role: Role | null) {
  if (!story || !role) return undefined;
  const run = story.cutscene && chapter0Cutscenes[story.cutscene.id];
  if (run && (run.cast ?? ["OATH", "EMBER"]).includes(role)) return undefined;
  return offstageByStage[story.stage]?.[role];
}

/** Coco comes within this many units of the shop door: the homecoming. */
export const HOMECOMING_REACH = 110;
export const shopDoor = { x: 480, y: 326 };

/** Free-roam objective for each hero in Part 1, if the story sets one. */
export function chapter0Objective(story: StoryState, role: Role) {
  const away = offstageFor(story, role);
  if (away)
    return role === "EMBER"
      ? "Coco stays beside Papa."
      : away.watch
        ? "Meanwhile… Sieg is at home. Watching Coco's errand."
        : "Meanwhile… Sieg is at home.";
  if (story.stage === "ERRAND") {
    const tick = (flag: string) => (story.flags.includes(flag) ? "✓" : "·");
    return `Alden's Shopping List  ${tick(errandStops.moonleaf)} Moonleaf herbs (Brynn's Apothecary)  ${tick(errandStops.store)} Two crystal vials, candlewick (General Store stall)  ${tick(errandStops.bakery)} Fresh bread (Bakery stall)`;
  }
  if (story.stage === "HOMEWARD")
    return "Return home to Papa. The shop is back along the west road (E at RETURN).";
  if (story.stage === "SILENT_SHOP") return "Something is wrong. Look around the shop.";
  // Sieg's part: Coco's objective stays with Papa, even in the reunion.
  if (
    role === "EMBER" &&
    ["STRANGER", "RUSHING", "FINDING"].includes(story.stage)
  )
    return "Coco stays beside Papa.";
  if (story.stage === "STRANGER")
    return "Visit Alden's shop: take the west road out of Emberbrook.";
  if (story.stage === "RUSHING")
    return "Hurry to the shop! (E at RETURN takes the west road out of town.)";
  if (story.stage === "FINDING") return "Go inside (E at the door).";
  if (story.stage === "MOURNING") return "Stay together.";
  if (story.stage === "FUNERAL_PREP") {
    const has = (f: string) => story.flags.includes(f);
    const count = (flags: string[]) => flags.filter(has).length;
    const site = has(FUNERAL.siteReady);
    if (role === "OATH") {
      if (count(stoneFlags) < 3)
        return `Gather smooth stones for Papa's grave (${count(stoneFlags)}/3): look along the road.`;
      if (!site)
        return "Lay the stones around the grave: E beneath the old tree, west of the garden fence.";
      return has("chapter0.ready-OATH")
        ? "Waiting for Coco at the grave."
        : "When you're ready, E at the grave to begin the funeral.";
    }
    if (count(flowerFlags) < 3)
      return `Pick flowers from Papa's garden (${count(flowerFlags)}/3).`;
    if (!site) return "Sieg is laying stones around the grave beneath the old tree.";
    return has("chapter0.ready-EMBER")
      ? "Waiting for Sieg at the grave."
      : "When you're ready, E at the grave to begin the funeral.";
  }
  if (story.stage === "INVESTIGATION") {
    const tick = (flag: string) => (story.flags.includes(flag) ? "✓" : "·");
    return `Ask around Emberbrook about Papa  ${tick(CLUES.bertram)} Elder Bertram  ${tick(CLUES.brynn)} Brynn  ${tick(CLUES.merchant)} the traveling merchant (east lawn)`;
  }
  if (story.stage === "JOURNAL") {
    const has = (f: string) => story.flags.includes(f);
    const mine = role === "OATH" ? JOURNAL_FLAGS.drawer : JOURNAL_FLAGS.seal;
    if (has(mine))
      return role === "OATH"
        ? "The drawer gives. Coco's turn: Papa's seal."
        : "The seal is undone. Sieg's turn: the stuck drawer.";
    return role === "OATH"
      ? "Search Papa's belongings: his desk in the shop has a stuck, locked drawer (E)."
      : "Search Papa's belongings: his desk in the shop carries one of his seals (E).";
  }
  if (story.stage === "DECISION")
    return "Papa's journal points to the guardian at the abandoned shrine. Meet beneath the old tree beside the shop.";
  return undefined;
}

/** Alden's lines if Coco pops home in the middle of the errand. */
export const aldenErrandLines = [
  "Back already? The list, Coco. The list.",
  "Bread. Not cake. I will know.",
];

/**
 * What villagers say once Alden has died (ordinary chats, not story scenes).
 * Emberbrook is quieter now; everyone has heard.
 */
const condolences: Record<string, string[]> = {
  mother: [
    "Oh, Sieg... and Coco, dear. I'm so sorry about Alden.",
    "You two look after each other. And come by for supper, both of you. Please.",
  ],
  elder: [
    "Be careful, you two. Whatever Alden was hiding from, it found him.",
  ],
  wizard: [
    "Alden was a finer mage than I will ever be. I am sorry, child.",
  ],
  mira: ["I heard about Alden. The whole village is quiet today."],
  healer: ["Come by any time, Coco. You don't have to buy anything."],
  shopkeeper: ["No charge today, Coco. Anything you need."],
  baker: ["Take a loaf, love. On the house. For Alden."],
  merchant: [
    "The shrine lies beyond the woods, north of the village. Mind that road.",
  ],
};
/** A villager's ordinary lines at this point in the story. */
export function villagerLines(
  npcId: string,
  lines: string[],
  story: StoryState | undefined,
) {
  const mourning =
    !!story &&
    (story.flags.includes(BURIAL_FLAG) ||
      story.flags.includes("chapter0.last-words"));
  return (mourning && condolences[npcId]) || lines;
}
