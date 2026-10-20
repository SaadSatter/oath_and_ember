import type { Role, SceneId, StoryState } from "./gameTypes.js";
import type { AldenPose, StoryCutscene, StoryStage } from "./prologue.js";
import { gladeStatueSolid } from "./statueGlade.js";
import type { BridgePuzzleState } from "./bridgePuzzle.js";

// Chapter 0's last stretch, as data: the road to the Forgotten Shrine, the
// Weeping Angel (the glade's weeping statue), the Three Trials (Puzzle Map 2's
// own phases), the Bald Goddess, her wig, what she remembers, and the choice
// each hero makes. The server (apps/server/src/chapter0Finale.ts) decides when
// each scene plays; the puzzles themselves are unchanged.

const SOUTH = Math.PI / 2,
  NORTH = -Math.PI / 2,
  EAST = 0,
  WEST = Math.PI;

/** Story flags, each recorded once. */
export const FINALE = {
  angelMeet: "chapter0.angel-meet",
  /** The angel's blessing: the Three Trials objective. */
  blessing: "chapter0.angel-blessing",
  inscription: "chapter0.trials-inscription",
  trials: {
    cooperation: "chapter0.trial-cooperation",
    ingenuity: "chapter0.trial-ingenuity",
    courage: "chapter0.trial-courage",
  },
  trialsPassed: "chapter0.trials-passed",
  goddessMeet: "chapter0.goddess-meet",
  maze: "chapter0.maze-banter",
  mirror: "chapter0.mirror-banter",
  griffin: "chapter0.griffin-banter",
  wig: "chapter0.wig-banter",
  revelation: "chapter0.revelation",
  resolve: "chapter0.resolve",
  /** Chapter 0 is complete. */
  complete: "chapter0.complete",
} as const;
export type TrialId = keyof typeof FINALE.trials;
export const trialOrder: TrialId[] = ["cooperation", "ingenuity", "courage"];
export const trialNames: Record<TrialId, string> = {
  cooperation: "Trial of Cooperation",
  ingenuity: "Trial of Ingenuity",
  courage: "Trial of Courage",
};
/**
 * Which of Puzzle Map 2's existing latches passes each trial:
 * - Cooperation: Gate 1 (Sieg's boulder on plate A plus Coco's shot) and
 *   Coco's golden switch freeing Sieg's corridor.
 * - Ingenuity: the boulder pushed through the spikes onto plate B
 *   (Slow Time and Super Speed together).
 * - Courage: the fragile bridge, the long shot, and the switches held apart.
 */
export function trialsPassed(s: BridgePuzzleState, boulderOnB: boolean) {
  return {
    cooperation: s.goldSwitchOpen,
    ingenuity: s.goldSwitchOpen && (boulderOnB || s.finalTargetHit),
    courage: s.complete,
  } satisfies Record<TrialId, boolean>;
}

/** The stages of this stretch, in order (all before "DONE"). */
export const finaleStages = [
  "SHRINE_ROAD",
  "TRIALS",
  "GODDESS",
  "WIG",
] as const satisfies readonly StoryStage[];

/** Whether Chapter 0's roads are open (the decision has been made). */
export const roadsOpen = (story: StoryState | undefined) =>
  !!story &&
  (story.stage === "DONE" ||
    (finaleStages as readonly string[]).includes(story.stage));

/** The inscription stone in Puzzle Map 2's southern courtyard. */
export const trialInscription = { x: 400, y: 1440 };
export const INSCRIPTION_REACH = 48;
export const inscriptionLines = [
  "Three trials guard the forgotten path.",
  "Neither sword nor sorcery shall prevail alone.",
  "Only those who walk together may stand before the guardian.",
];

/** Where the heroes stand before the goddess's statue. */
const beforeGoddess: Partial<
  Record<Role, { x: number; y: number; facing: number }>
> = {
  OATH: { x: 600, y: 604, facing: NORTH },
  EMBER: { x: 680, y: 604, facing: NORTH },
};
/** The goddess's statue (camera focus). */
export const goddessFocus = { x: 640, y: 430 };
/** The weeping statue at the heart of the glade (camera focus). */
export const angelFocus = {
  x: gladeStatueSolid.x + gladeStatueSolid.w / 2,
  y: gladeStatueSolid.y - 20,
};
/** Where the cloaked woman watches the heroes leave the shrine. */
export const watcherPose: AldenPose = {
  scene: "GODDESS_SHRINE",
  x: 214,
  y: 352,
  facing: "east",
};

/** Each hero's reasons to go on (Act VII). Ids are saved in story state. */
export const motivations: Record<Role, { id: string; text: string }[]> = {
  EMBER: [
    { id: "truth", text: "I won't stop until I learn the truth." },
    { id: "answer", text: "Whoever killed Papa will answer to me." },
    { id: "scared", text: "I'm scared. But I can't walk away." },
  ],
  OATH: [
    { id: "promise", text: "I promised Alden I'd look after her." },
    {
      id: "duty",
      text: "If these relics threaten everyone, someone has to act.",
    },
    { id: "together", text: "We've always gotten into trouble together." },
  ],
};
/** The flag recording a hero's choice (later dialogue can read it). */
export const motivationFlag = (role: Role, id: string) =>
  `chapter0.motivation-${role}-${id}`;
/** The words a hero chose, if they have chosen. */
export const motivationText = (story: StoryState | undefined, role: Role) => {
  const id = story?.motivations?.[role];
  return motivations[role].find((m) => m.id === id)?.text;
};

export const finaleCutscenes: Record<string, StoryCutscene> = {
  // Act II: the Weeping Angel. Plays as the party first enters the glade.
  "angel-meet": {
    id: "angel-meet",
    scene: "PUZZLE_GLADE",
    placement: {},
    hold: true,
    focus: angelFocus,
    flag: FINALE.angelMeet,
    next: "SHRINE_ROAD",
    lines: [
      { speaker: "COCO", text: "Sieg, is that statue... crying?" },
      { speaker: "SIEG", text: "It's stone. Statues don't cry." },
      {
        speaker: "ANGEL",
        text: "Then perhaps you should tell my tears that.",
      },
      { speaker: "SIEG", text: "IT TALKS?!" },
      { speaker: "COCO", text: "You were saying?" },
      {
        speaker: "ANGEL",
        text: "Travelers... it has been so long since anyone stopped to listen.",
      },
      {
        speaker: "COCO",
        text: "We're looking for the shrine. Can you help us?",
      },
      {
        speaker: "ANGEL",
        text: "Perhaps. But first, I beg you... ease my sorrow.",
      },
    ],
  },
  // Act II, after her puzzle: the blessing and the Three Trials.
  "angel-blessing": {
    id: "angel-blessing",
    scene: "PUZZLE_GLADE",
    placement: {},
    hold: true,
    focus: angelFocus,
    flag: FINALE.blessing,
    next: "TRIALS",
    lines: [
      {
        speaker: "ANGEL",
        text: "At last... I can feel the warmth of kindness again.",
      },
      {
        speaker: "COCO",
        text: "Does that mean you'll tell us where the shrine is?",
      },
      {
        speaker: "ANGEL",
        text: "Yes, little flame. But the path is not freely given.",
      },
      { speaker: "SIEG", text: "Of course it isn't." },
      {
        speaker: "ANGEL",
        text: "Before you may stand before the ancient guardian, you must prove yourselves worthy.",
      },
      { speaker: "COCO", text: "How?" },
      { speaker: "ANGEL", text: "Three trials await you beyond this path." },
      { speaker: "SIEG", text: "Three?" },
      {
        speaker: "ANGEL",
        text: "Three trials of worthiness. Only those who overcome them may reach the shrine.",
      },
      { speaker: "COCO", text: "And what happens if we fail?" },
      { speaker: "ANGEL", text: "Then the path shall remain closed." },
      { speaker: "SIEG", text: "That sounds reassuring." },
      { speaker: "COCO", text: "Come on! Three trials can't be that bad." },
      { speaker: "SIEG", text: "You said that about the forest." },
      {
        speaker: "ANGEL",
        text: "Remember this, travelers: strength alone will not carry you forward. Neither of you can complete this journey alone.",
      },
      { speaker: "COCO", text: "Good thing I brought a knight." },
      { speaker: "SIEG", text: "I'm not a knight yet." },
      { speaker: "ANGEL", text: "Not yet, perhaps." },
      { speaker: "NARRATION", text: "The angel becomes still again." },
      { speaker: "QUEST", text: "New objective: Pass the Three Trials." },
    ],
  },
  // Act III: the inscription at the entrance of Puzzle Map 2.
  "trials-inscription": {
    id: "trials-inscription",
    scene: "BRIDGE_RUINS",
    placement: {},
    hold: true,
    focus: trialInscription,
    flag: FINALE.inscription,
    next: "TRIALS",
    lines: [
      {
        speaker: "NARRATION",
        text: "Words are carved into a stone at the entrance.",
      },
      ...inscriptionLines.map((text) => ({
        speaker: "INSCRIPTION" as const,
        text,
      })),
      { speaker: "COCO", text: "That sounds unnecessarily dramatic." },
      {
        speaker: "SIEG",
        text: "It's an ancient shrine. I think dramatic is required.",
      },
      { speaker: "COCO", text: "You should try being dramatic sometime." },
      { speaker: "SIEG", text: "I travel with you. That's dramatic enough." },
    ],
  },
  // Act III: the final trial passed, the sealed gate opens.
  "trials-done": {
    id: "trials-done",
    scene: "BRIDGE_RUINS",
    placement: {
      // Either side of the castle exit, close enough for E there.
      OATH: { x: 448, y: 172, facing: EAST },
      EMBER: { x: 512, y: 172, facing: WEST },
    },
    exact: true,
    hold: true,
    flag: FINALE.trialsPassed,
    next: "GODDESS",
    lines: [
      {
        speaker: "NARRATION",
        text: "A sealed gate opens, revealing the path to the Goddess Shrine.",
      },
      { speaker: "COCO", text: "We did it!" },
      { speaker: "SIEG", text: "Somehow." },
      { speaker: "COCO", text: "You could sound a little more impressed." },
      { speaker: "SIEG", text: "I'm impressed we're alive." },
      { speaker: "COCO", text: "That's the spirit!" },
      {
        speaker: "QUEST",
        text: "New objective: Speak to the Guardian Goddess.",
      },
    ],
  },
  // Act IV: the Bald Goddess.
  "goddess-meet": {
    id: "goddess-meet",
    scene: "GODDESS_SHRINE",
    placement: beforeGoddess,
    exact: true,
    hold: true,
    focus: goddessFocus,
    flag: FINALE.goddessMeet,
    next: "WIG",
    lines: [
      {
        speaker: "GODDESS",
        text: "MORTALS! You stand before the radiant guardian of this sacred land!",
      },
      { speaker: "GODDESS", text: "Kneel before my magnificent—" },
      { speaker: "COCO", text: "...Is she supposed to be bald?" },
      { speaker: "SIEG", text: "Coco!" },
      { speaker: "GODDESS", text: "WHAT DID YOU SAY?!" },
      { speaker: "COCO", text: "Nothing." },
      { speaker: "GODDESS", text: "YOU SAID BALD!" },
      { speaker: "SIEG", text: "Great. We offended a deity." },
      { speaker: "COCO", text: "I was just asking!" },
      {
        speaker: "GODDESS",
        text: "My glorious hair has been stolen by that wretched griffin!",
      },
      {
        speaker: "COCO",
        text: "Wait. We passed three trials to meet a goddess who lost her wig?",
      },
      { speaker: "GODDESS", text: "A DIVINE WIG!" },
      { speaker: "SIEG", text: "Is there a difference?" },
      { speaker: "GODDESS", text: "A CONSIDERABLE DIFFERENCE!" },
      {
        speaker: "COCO",
        text: "Look, we're not here about your hair. My papa—",
      },
      {
        speaker: "GODDESS",
        text: "NO QUESTIONS UNTIL MY CROWN OF BEAUTY IS RESTORED!",
      },
      { speaker: "COCO", text: "You're impossible." },
      { speaker: "GODDESS", text: "AND YOU ARE IMPUDENT!" },
      { speaker: "SIEG", text: "Coco, maybe we should just help her." },
      { speaker: "COCO", text: "Fine. We'll get your wig." },
      {
        speaker: "GODDESS",
        text: "At last! Mortals with proper reverence!",
      },
      { speaker: "COCO", text: "I wouldn't go that far." },
      {
        speaker: "QUEST",
        text: "New objective: Recover the Divine Wig. East: the Hedge Maze. West: the Mirror Pond. North: the Griffin Enclosure.",
      },
    ],
  },
  // Act V: brief words along the three branches.
  "maze-banter": {
    id: "maze-banter",
    scene: "HEDGE_MAZE",
    placement: {},
    hold: true,
    flag: FINALE.maze,
    next: "WIG",
    lines: [
      { speaker: "SIEG", text: "A hedge maze. How bad could it be?" },
      { speaker: "COCO", text: "Don't say that." },
      { speaker: "SIEG", text: "What?" },
      {
        speaker: "COCO",
        text: "Every time you say that, something terrible happens.",
      },
    ],
  },
  "mirror-banter": {
    id: "mirror-banter",
    scene: "MIRROR_POND",
    placement: {},
    hold: true,
    flag: FINALE.mirror,
    next: "WIG",
    lines: [
      {
        speaker: "COCO",
        text: "A magical mirror. Think the goddess will like it?",
      },
      {
        speaker: "SIEG",
        text: "She does seem rather fond of her appearance.",
      },
      { speaker: "COCO", text: "Maybe we should keep it." },
      { speaker: "SIEG", text: "We're not stealing from a goddess." },
    ],
  },
  "griffin-banter": {
    id: "griffin-banter",
    scene: "GRIFFIN_ENCLOSURE",
    placement: {},
    hold: true,
    flag: FINALE.griffin,
    next: "WIG",
    lines: [
      { speaker: "SIEG", text: "That's a very large bird." },
      { speaker: "COCO", text: "That's a griffin." },
      { speaker: "SIEG", text: "I know what it is." },
      { speaker: "COCO", text: "Then why did you call it a bird?" },
      {
        speaker: "SIEG",
        text: "I was hoping it would sound less dangerous.",
      },
    ],
  },
  "wig-banter": {
    id: "wig-banter",
    scene: "GRIFFIN_ENCLOSURE",
    placement: {},
    hold: true,
    flag: FINALE.wig,
    next: "WIG",
    lines: [
      { speaker: "COCO", text: "All of this... for a wig." },
      {
        speaker: "SIEG",
        text: "Let's hope she actually answers our questions.",
      },
    ],
  },
  // Act VI: the goddess remembers. Plays once the wig has been offered.
  revelation: {
    id: "revelation",
    scene: "GODDESS_SHRINE",
    placement: beforeGoddess,
    exact: true,
    hold: true,
    focus: goddessFocus,
    flag: FINALE.revelation,
    next: "WIG",
    chain: "resolve",
    lines: [
      { speaker: "GODDESS", text: "MY GLORIOUS BEAUTY HAS RETURNED!" },
      { speaker: "COCO", text: "You're welcome." },
      {
        speaker: "GODDESS",
        text: "Yes, yes, you have performed an adequate service.",
      },
      { speaker: "SIEG", text: "Adequate?" },
      { speaker: "GODDESS", text: "Very well. An exceptional service." },
      { speaker: "COCO", text: "Now, about my papa—" },
      { speaker: "NARRATION", text: "The goddess looks closely at Coco." },
      { speaker: "NARRATION", text: "Her expression changes." },
      { speaker: "GODDESS", text: "...Coco?" },
      { speaker: "COCO", text: "How do you know my name?" },
      { speaker: "GODDESS", text: "No... that cannot be." },
      { speaker: "SIEG", text: "What's wrong?" },
      { speaker: "NARRATION", text: "The goddess turns toward Sieg." },
      { speaker: "GODDESS", text: "And you... Sieg." },
      { speaker: "SIEG", text: "You know me too?" },
      {
        speaker: "GODDESS",
        text: "I remember that name. Or perhaps... someone who carried it.",
      },
      { speaker: "COCO", text: "Enough riddles. Did you know Papa?" },
      { speaker: "GODDESS", text: "Alden..." },
      { speaker: "NARRATION", text: "The goddess becomes quiet." },
      { speaker: "GODDESS", text: "Yes. I remember him." },
      { speaker: "COCO", text: "Then tell me who killed him." },
      { speaker: "GODDESS", text: "I do not know, child." },
      { speaker: "COCO", text: "But you knew him!" },
      {
        speaker: "GODDESS",
        text: "Knowing someone does not grant me knowledge of their fate.",
      },
      { speaker: "NARRATION", text: "..." },
      {
        speaker: "GODDESS",
        text: "He was a good man. And he carried a burden that was never meant for one mortal alone.",
      },
      {
        speaker: "SIEG",
        text: "People in Emberbrook said Alden possessed something called the Ember.",
      },
      { speaker: "GODDESS", text: "The Ember..." },
      { speaker: "COCO", text: "What is it?" },
      {
        speaker: "GODDESS",
        text: "One of seven divine relics scattered across the mortal world long ago.",
      },
      { speaker: "SIEG", text: "Seven?" },
      {
        speaker: "GODDESS",
        text: "Each relic carries power beyond ordinary magic. Together, they may accomplish things that mortals should hesitate even to imagine.",
      },
      {
        speaker: "COCO",
        text: "They say the Ember can summon a god and grant a wish.",
      },
      { speaker: "GODDESS", text: "The Ember does not grant wishes." },
      { speaker: "GODDESS", text: "It opens a door." },
      { speaker: "SIEG", text: "A door to what?" },
      {
        speaker: "GODDESS",
        text: "To beings beyond your world. Some may answer your prayers. Others may see humanity as little more than an inconvenience.",
      },
      {
        speaker: "COCO",
        text: "So whoever has it could bring a god here?",
      },
      {
        speaker: "GODDESS",
        text: "Under the right circumstances, perhaps. But opening a door cannot promise that what enters through it will be kind.",
      },
      { speaker: "SIEG", text: "Did Alden have the Ember?" },
      { speaker: "GODDESS", text: "I cannot tell you." },
      { speaker: "COCO", text: "Cannot, or will not?" },
      {
        speaker: "GODDESS",
        text: "My memories are fractured, child. My strength has faded, and much of what I once knew is lost.",
      },
      { speaker: "NARRATION", text: "The goddess pauses, studying Coco." },
      { speaker: "GODDESS", text: "But I remember something else." },
      { speaker: "COCO", text: "What?" },
      {
        speaker: "GODDESS",
        text: "Many years ago, Alden came to this shrine carrying a baby.",
      },
      { speaker: "COCO", text: "...Me?" },
      { speaker: "GODDESS", text: "Yes." },
      {
        speaker: "GODDESS",
        text: "He was not alone. Someone accompanied him, though their face escapes me.",
      },
      { speaker: "SIEG", text: "What did he want?" },
      { speaker: "GODDESS", text: "He asked me for a promise." },
      { speaker: "COCO", text: "What promise?" },
      {
        speaker: "GODDESS",
        text: "He said, 'If anyone comes asking for the child, tell them she was never here.'",
      },
      { speaker: "NARRATION", text: "Silence." },
      { speaker: "COCO", text: "Papa was hiding me?" },
      { speaker: "GODDESS", text: "Protecting you, perhaps." },
      { speaker: "COCO", text: "From who?" },
      { speaker: "GODDESS", text: "I wish I remembered." },
      {
        speaker: "COCO",
        text: "Then what was the oath he wanted me to remember?",
      },
      { speaker: "GODDESS", text: "An oath..." },
      { speaker: "NARRATION", text: "She looks troubled." },
      { speaker: "GODDESS", text: "I cannot answer that yet." },
      { speaker: "COCO", text: "You keep saying you don't remember!" },
      {
        speaker: "GODDESS",
        text: "And every forgotten memory is another reminder of how far I have fallen.",
      },
      { speaker: "NARRATION", text: "Sieg steps forward." },
      { speaker: "SIEG", text: "Is there anything you can tell us?" },
      {
        speaker: "GODDESS",
        text: "Only this: whoever sought Alden may not have been seeking the Ember alone.",
      },
      {
        speaker: "GODDESS",
        text: "And the path of heroism is often stained with despair.",
      },
    ],
  },
  // Act VII: each hero decides, on their own, why they go on.
  resolve: {
    id: "resolve",
    scene: "GODDESS_SHRINE",
    placement: {},
    hold: true,
    focus: goddessFocus,
    flag: FINALE.resolve,
    next: "WIG",
    chain: "watcher",
    lines: [
      {
        speaker: "NARRATION",
        text: "Each of you decides, in your own heart, why you will go on.",
        choose: true,
      },
      { speaker: "COCO", text: "", motivation: "EMBER" },
      { speaker: "SIEG", text: "", motivation: "OATH" },
      { speaker: "SIEG", text: "Well, I suppose we're doing this." },
      { speaker: "COCO", text: "You could sound more excited." },
      {
        speaker: "SIEG",
        text: "Someone has to keep you from burning down the world.",
      },
      { speaker: "COCO", text: "No promises." },
      { speaker: "NARRATION", text: "The goddess watches them." },
      { speaker: "GODDESS", text: "Then go, children." },
      {
        speaker: "GODDESS",
        text: "And remember: not every truth brings comfort.",
      },
    ],
  },
  // The final cinematic: the heroes leave; someone watches them go.
  watcher: {
    id: "watcher",
    scene: "GODDESS_SHRINE",
    placement: {
      OATH: { x: 600, y: 908, facing: SOUTH },
      EMBER: { x: 680, y: 908, facing: SOUTH },
    },
    exact: true,
    hold: true,
    stranger: watcherPose,
    strangerLeaves: true,
    focus: { x: watcherPose.x, y: watcherPose.y - 24 },
    flag: FINALE.complete,
    next: "DONE",
    lines: [
      {
        speaker: "NARRATION",
        text: "Some distance away, the mysterious cloaked woman watches the two heroes depart.",
      },
      { speaker: "NARRATION", text: "Her face remains hidden." },
      { speaker: "STRANGER", text: "So... the oath survives." },
    ],
  },
};

/** The free-roam quest line for this stretch of the story, if any. */
export function finaleObjective(
  story: StoryState,
  bag: Partial<Record<string, number>> = {},
  offered = false,
): string | undefined {
  const has = (f: string) => story.flags.includes(f);
  const tick = (done: boolean) => (done ? "✓" : "·");
  switch (story.stage) {
    case "SHRINE_ROAD":
      return has(FINALE.angelMeet)
        ? "Quest · Find the Forgotten Shrine: ease the Weeping Angel's sorrow."
        : "Quest · Find the Forgotten Shrine: the road north out of Emberbrook leads beyond the forest.";
    case "TRIALS":
      return `Quest · Pass the Three Trials  ${trialOrder
        .map((t) => `${tick(has(FINALE.trials[t]))} ${trialNames[t].replace("Trial of ", "")}`)
        .join("  ")}`;
    case "GODDESS":
      return "Quest · Speak to the Guardian Goddess at her shrine, beyond the castle exit.";
    case "WIG":
      if (offered) return "Quest · The goddess remembers.";
      return `Quest · Recover the Divine Wig  ${tick((bag.enchanted_shears ?? 0) > 0)} Shears (east maze)  ${tick((bag.vanity_mirror ?? 0) > 0)} Mirror (west pond)  ${tick((bag.griffin_wig ?? 0) > 0)} Wig (north griffin), then offer it at the bowl`;
    case "DONE":
      return has(FINALE.complete)
        ? "Chapter 0 complete. The south-east path from the shrine leads on to the Forest Ruins."
        : undefined;
    default:
      return undefined;
  }
}

/** Maps where the quest line replaces the local hint (home ground). */
export const questHomeScenes: SceneId[] = [
  "MAIN_HOUSE",
  "EMBERBROOK_VILLAGE",
  "HOUSE_INTERIOR",
  "HOUSE_UPPER",
];
