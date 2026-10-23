import type { Rect, Role, SceneId, StoryState } from "./gameTypes.js";
import type { StoryCutscene } from "./prologue.js";
import postTownSolids from "./postTownSolids.json" with { type: "json" };

// Chapter 0 prologue: the Mossling Woods, a guided tutorial between the
// merchant's cart (PROLOGUE_TRAIL) and the ambush (PROLOGUE_CLEARING). The map
// is the Transition Trail's art and collision, with a pond and islet added
// for Flight. Each stretch of the path teaches one skill against mosslings;
// the server (apps/server/src/prologueWoods.ts) decides when each is learned.

export const WOODS: SceneId = "PROLOGUE_WOODS";
export const WOODS_NAME = "Mossling Woods";
export const WOODS_SIZE = { width: 1024, height: 768 } as const;
/** Transition Trail objects (by export index) left out: the pond is there. */
export const woodsOmittedObjects: readonly number[] = [2, 8];
export const woodsSpawn = { x: 100, y: 672 };
/** The trail leads on east, past the pond (bottom-right). */
export const woodsExit = { x: 948, y: 672 };

// --- The pond ----------------------------------------------------------------
/** Water lies on a 32-unit corner grid, drawn with the grass/water Wang tiles. */
export const WOODS_SHORE_TILE = 32;
const pond = { x: 880, y: 470, rx: 100, ry: 150 };
// Centred on a grid corner, so a 3×3 block of corners is dry ground.
const islet = { x: 864, y: 480, rx: 46, ry: 46 };
const inside = (
  e: { x: number; y: number; rx: number; ry: number },
  x: number,
  y: number,
) => ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 < 1;
/** Whether a corner of the water grid is water (the islet is dry). */
export const woodsWaterAt = (x: number, y: number) =>
  inside(pond, x, y) && !inside(islet, x, y);
const pondTiles = {
  left: Math.floor((pond.x - pond.rx) / WOODS_SHORE_TILE) * WOODS_SHORE_TILE,
  top: Math.floor((pond.y - pond.ry) / WOODS_SHORE_TILE) * WOODS_SHORE_TILE,
  right: Math.ceil((pond.x + pond.rx) / WOODS_SHORE_TILE) * WOODS_SHORE_TILE,
  bottom: Math.ceil((pond.y + pond.ry) / WOODS_SHORE_TILE) * WOODS_SHORE_TILE,
};
/** Each Wang tile of the pond: NW 1, NE 2, SW 4, SE 8 set where water. */
export function woodsWaterTiles() {
  const T = WOODS_SHORE_TILE,
    out: { x: number; y: number; mask: number }[] = [];
  for (let y = pondTiles.top - T; y < pondTiles.bottom + T; y += T)
    for (let x = pondTiles.left - T; x < pondTiles.right + T; x += T) {
      const mask =
        Number(woodsWaterAt(x, y)) |
        (Number(woodsWaterAt(x + T, y)) * 2) |
        (Number(woodsWaterAt(x, y + T)) * 4) |
        (Number(woodsWaterAt(x + T, y + T)) * 8);
      if (mask) out.push({ x, y, mask });
    }
  return out;
}
/** Solid water follows the same corner field as the drawn tiles. */
function woodsWaterSolidAt(x: number, y: number) {
  const T = WOODS_SHORE_TILE,
    left = Math.floor(x / T) * T,
    top = Math.floor(y / T) * T,
    fx = (x - left) / T,
    fy = (y - top) / T;
  return (
    Number(woodsWaterAt(left, top)) * (1 - fx) * (1 - fy) +
      Number(woodsWaterAt(left + T, top)) * fx * (1 - fy) +
      Number(woodsWaterAt(left, top + T)) * (1 - fx) * fy +
      Number(woodsWaterAt(left + T, top + T)) * fx * fy >
    0.5
  );
}
/** The pond's collision, in 8-unit strips (Flight passes over it). */
export const woodsWaterWalls: Rect[] = (() => {
  const out: Rect[] = [],
    step = 8,
    T = WOODS_SHORE_TILE;
  for (let y = pondTiles.top - T; y < pondTiles.bottom + T; y += step) {
    let start: number | undefined;
    for (let x = pondTiles.left - T; x <= pondTiles.right + T; x += step) {
      const wet =
        x < pondTiles.right + T && woodsWaterSolidAt(x + step / 2, y + step / 2);
      if (wet && start === undefined) start = x;
      if (!wet && start !== undefined) {
        out.push({ x: start, y, w: x - start, h: step, terrain: "water" });
        start = undefined;
      }
    }
  }
  return out;
})();

const overlapsBody = (p: { x: number; y: number }, r: Rect, half = 13) =>
  p.x + half > r.x &&
  p.x - half < r.x + r.w &&
  p.y + half > r.y &&
  p.y - half < r.y + r.h;
/** A hero (flying) somewhere over the pond's water. */
export const overWoodsWater = (p: { x: number; y: number }) =>
  woodsWaterWalls.some((r) => overlapsBody(p, r, 1));
/** A hero standing on the islet (out of reach of the banks). */
export const onWoodsIslet = (p: { x: number; y: number }) =>
  inside({ ...islet, rx: islet.rx + 24, ry: islet.ry + 24 }, p.x, p.y);

export const woodsWalls: Rect[] = [
  { x: 0, y: 0, w: WOODS_SIZE.width, h: 32 },
  { x: 0, y: WOODS_SIZE.height - 32, w: WOODS_SIZE.width, h: 32 },
  { x: 0, y: 0, w: 32, h: WOODS_SIZE.height },
  { x: WOODS_SIZE.width - 32, y: 0, w: 32, h: WOODS_SIZE.height },
  // The Transition Trail's reviewed footprints, one per authored object.
  ...postTownSolids.TRANSITION_TRAIL.filter(
    (_, i) => !woodsOmittedObjects.includes(i),
  ),
  ...woodsWaterWalls,
];

// --- The crate on the islet --------------------------------------------------
/** A merchant's crate, left on the islet: Coco flies out to take it. */
export const woodsCrate = { x: 864, y: 474 };
export const WOODS_CRATE_REACH = 44;
export const WOODS_CRATE_FLAG = "prologue.woods-crate";
/** Back with Sieg: this close to him, on dry ground. */
export const WOODS_RETURN_REACH = 110;

// --- The lessons ------------------------------------------------------------
export const woodsSteps = [
  "attack",
  "defend",
  "time",
  "flight",
  "black_hole",
] as const;
export type WoodsStep = (typeof woodsSteps)[number];
/** Server-owned tutorial progress (World.story.woods). */
export interface WoodsState {
  /** Index into woodsSteps; woodsSteps.length once every lesson is done. */
  step: number;
  /** Tick the current lesson began (its mosslings appeared). */
  since?: number;
  /** Heroes who have done this lesson's part. */
  did: Partial<Record<Role, boolean>>;
  /** Mosslings raised for this lesson so far (also numbers their ids). */
  raised: number;
}
/** Heroes never fall below this much health in the woods. */
export const WOODS_HP_FLOOR = 30;
/** A hero guarding while a mossling this close winds up has defended. */
export const WOODS_GUARD_REACH = 160;
/** Where each lesson's mosslings appear, along the path ahead. */
export const woodsMosslings: Record<WoodsStep, { x: number; y: number }[]> = {
  // The west path, north of where the heroes come in.
  attack: [
    { x: 352, y: 470 },
    { x: 352, y: 400 },
  ],
  // The north-west bend.
  defend: [
    { x: 352, y: 284 },
    { x: 440, y: 284 },
  ],
  // The long north path.
  time: [
    { x: 540, y: 284 },
    { x: 620, y: 284 },
    { x: 700, y: 284 },
  ],
  flight: [],
  // Below the pond, near the way out.
  black_hole: [
    { x: 720, y: 610 },
    { x: 790, y: 650 },
    { x: 730, y: 690 },
    { x: 810, y: 700 },
  ],
};
/** The scene that opens each lesson, and the flag it leaves. */
export const woodsIntro = (step: WoodsStep) => `woods-${step}`;
export const woodsIntroFlag = (step: WoodsStep) => `prologue.woods-${step}`;
export const WOODS_ENTER_FLAG = "prologue.woods";
export const WOODS_DONE_FLAG = "prologue.woods-done";
export const woodsDone = (story: StoryState | undefined) =>
  !!story?.flags.includes(WOODS_DONE_FLAG);
/** The lesson being taught now (once its opening scene has played). */
export function woodsLesson(story: StoryState | undefined) {
  const woods = story?.woods;
  if (!story || story.stage !== "WOODS" || !woods) return undefined;
  const step = woodsSteps[woods.step];
  if (!step || !story.flags.includes(woodsIntroFlag(step))) return undefined;
  return step;
}

/** Which ability button each lesson is about, per hero (the HUD highlights it). */
export const woodsAbility: Record<WoodsStep, Partial<Record<Role, string>>> = {
  attack: {},
  defend: {},
  time: { OATH: "super-speed", EMBER: "time-stop" },
  flight: { EMBER: "flight" },
  black_hole: { EMBER: "black-hole" },
};

const objectives: Record<
  WoodsStep,
  Record<Role, { todo: string; done: string }>
> = {
  attack: {
    OATH: {
      todo: "Tutorial · Attack: press J to swing your sword at a mossling.",
      done: "Tutorial · Attack ✓ Finish off the mosslings (J).",
    },
    EMBER: {
      todo: "Tutorial · Attack: press J to throw a fireball the way you are facing.",
      done: "Tutorial · Attack ✓ Finish off the mosslings (J).",
    },
  },
  defend: {
    OATH: {
      todo: "Tutorial · Defend: hold K as a mossling's spike shoots out. A guarded hit does a quarter of the damage.",
      done: "Tutorial · Defend ✓ Now defeat the mosslings (J).",
    },
    EMBER: {
      todo: "Tutorial · Defend: hold K to ward as a mossling's spike shoots out. A warded hit does a quarter of the damage.",
      done: "Tutorial · Defend ✓ Now defeat the mosslings (J).",
    },
  },
  time: {
    OATH: {
      todo: "Tutorial · Super Speed: press Shift (or 2) to run at double speed for 10 seconds. In Coco's slowed time you still move at full speed.",
      done: "Tutorial · Super Speed ✓ Defeat the mosslings (J).",
    },
    EMBER: {
      todo: "Tutorial · Slow Time: press T (or 1). Everyone slows for 10 seconds, mosslings too; Sieg's Super Speed beats it.",
      done: "Tutorial · Slow Time ✓ Defeat the mosslings (J).",
    },
  },
  flight: {
    OATH: {
      todo: "Tutorial · Flight: Coco flies to the islet. Wait for her on the pond's bank.",
      done: "Tutorial · Flight: Coco flies to the islet. Wait for her on the pond's bank.",
    },
    EMBER: {
      todo: "Tutorial · Flight: press F (or 2) to fly for 20 seconds, over water. Fly to the islet and press E at the crate.",
      done: "Tutorial · Flight ✓",
    },
  },
  black_hole: {
    OATH: {
      todo: "Tutorial · Black Hole: once Coco's black hole bunches the mosslings up, cut them down with J.",
      done: "Tutorial · Black Hole: once Coco's black hole bunches the mosslings up, cut them down with J.",
    },
    EMBER: {
      todo: "Tutorial · Black Hole: press G (or 3) to fire it up to 6 tiles. It pulls in mosslings within 3 tiles and hurts each one once.",
      done: "Tutorial · Black Hole ✓ Finish off the mosslings (J).",
    },
  },
};
/** Each hero's goal in the woods (the HUD line). */
export function woodsObjective(story: StoryState | undefined, role: Role) {
  if (!story || story.stage !== "WOODS") return undefined;
  if (woodsDone(story))
    return "Prologue · The tracks lead on. Press E at the trail's east end, past the pond.";
  const step = woodsLesson(story);
  if (!step) return "Prologue · Follow the tracks through the woods.";
  if (
    step === "flight" &&
    role === "EMBER" &&
    story.flags.includes(WOODS_CRATE_FLAG)
  )
    return "Tutorial · Flight: got it! Fly back to Sieg. If Flight runs out on the islet, wait for it to recharge.";
  const text = objectives[step][role];
  return story.woods?.did[role] ? text.done : text.todo;
}

// --- Scenes ------------------------------------------------------------------
const lesson = (
  step: WoodsStep,
  lines: StoryCutscene["lines"],
): StoryCutscene => ({
  id: woodsIntro(step),
  scene: WOODS,
  placement: {},
  hold: true,
  flag: woodsIntroFlag(step),
  next: "WOODS",
  lines,
});
export const woodsCutscenes: Record<string, StoryCutscene> = {
  woods: {
    id: "woods",
    scene: WOODS,
    placement: {},
    flag: WOODS_ENTER_FLAG,
    next: "WOODS",
    lines: [
      {
        speaker: "NARRATION",
        text: "Past the cart, the tracks wind on into a mossy wood. Small green shapes stir between the trees.",
      },
      {
        speaker: "SIEG",
        text: "Mosslings. They're slow, but that spike arm of theirs hurts.",
      },
      {
        speaker: "COCO",
        text: "Then they're a perfect warm-up. Papa says practice is just losing on purpose.",
      },
      { speaker: "SIEG", text: "I don't think that's what he means." },
      {
        speaker: "GUIDE",
        text: "Each stretch of these woods teaches one skill. The goal at the top of the screen says what to do next; a glowing button below is the one to use.",
      },
    ],
  },
  "woods-attack": lesson("attack", [
    {
      speaker: "NARRATION",
      text: "Two mosslings shuffle onto the path ahead, spike arms twitching.",
    },
    { speaker: "COCO", text: "Watch and learn." },
    {
      speaker: "GUIDE",
      text: "Attack · Sieg: press J to swing your sword. Coco: press J to throw a fireball the way you're facing. WASD or the arrow keys turn you.",
    },
  ]),
  "woods-defend": lesson("defend", [
    {
      speaker: "NARRATION",
      text: "More mosslings drop from the branches. Their arms snap out into wooden spikes.",
    },
    {
      speaker: "SIEG",
      text: "Careful. That spike shoots straight out, in a line.",
    },
    {
      speaker: "GUIDE",
      text: "Defend · Hold K as a spike comes: Sieg raises his guard, Coco her ward. A guarded hit does only a quarter of the damage. Each of you, block one strike.",
    },
  ]),
  "woods-time": lesson("time", [
    {
      speaker: "NARRATION",
      text: "The north path is crawling with them. Too many to dodge.",
    },
    { speaker: "COCO", text: "Sieg, how fast can you run?" },
    { speaker: "SIEG", text: "Faster than you'd think." },
    { speaker: "COCO", text: "Let's find out. I'll slow everything else down." },
    {
      speaker: "GUIDE",
      text: "Slow Time · Coco: press T (or 1) to slow everyone for 10 seconds. Super Speed · Sieg: press Shift (or 2) to run at double speed. While time is slowed, Sieg still moves at full speed.",
    },
  ]),
  "woods-flight": lesson("flight", [
    {
      speaker: "NARRATION",
      text: "Beside the path lies a still pond. On its islet sits a crate stamped with the merchants' mark.",
    },
    {
      speaker: "COCO",
      text: "That's from the cart! Someone must have dropped it running this way.",
    },
    { speaker: "SIEG", text: "We're not swimming for it." },
    { speaker: "COCO", text: "Who said anything about swimming?" },
    {
      speaker: "GUIDE",
      text: "Flight · Coco: press F (or 2) to fly for 20 seconds, over water. Fly to the islet, press E at the crate, then fly back to Sieg. Trees still block you.",
    },
  ]),
  "woods-black_hole": lesson("black_hole", [
    {
      speaker: "NARRATION",
      text: "The mosslings regroup below the pond, and this time there are four.",
    },
    { speaker: "SIEG", text: "I can't hit them all at once." },
    { speaker: "COCO", text: "You don't have to. I'll bring them to you." },
    {
      speaker: "GUIDE",
      text: "Black Hole · Coco: press G (or 3) to fire a black hole up to 6 tiles. It pulls every mossling within 3 tiles together and hurts each one once. Sieg: cut down the bunch with J.",
    },
  ]),
  "woods-done": {
    id: "woods-done",
    scene: WOODS,
    placement: {},
    flag: WOODS_DONE_FLAG,
    next: "WOODS",
    lines: [
      {
        speaker: "NARRATION",
        text: "The last mossling crumbles into moss. The woods go quiet.",
      },
      { speaker: "SIEG", text: "Not bad. For losing on purpose." },
      { speaker: "COCO", text: "I wasn't losing." },
      {
        speaker: "COCO",
        text: "The tracks keep going east, past the pond. Come on, we're close!",
      },
      {
        speaker: "GUIDE",
        text: "Tutorial complete. Abilities recharge on their own; the buttons at the bottom of the screen show when each is ready.",
      },
    ],
  },
};
