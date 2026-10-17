import type { Puzzle, Rect } from "./gameTypes.js";
import solids from "./postTownSolids.json" with { type: "json" };
// Puzzle Glade: the weeping statue at the heart of the spiral asks for what
// was lost — her chair, walled into the north-east corner by dry bushes.
// Coco burns the bushes, Sieg pushes the chair to her, she sits, and the
// path onward opens. Shared so server rules and client presentation agree.
export interface GladeState {
  bushesBurned: boolean;
  burnedTick: number | null;
  /** Server tick the statue took her seat; null until the chair arrives. */
  seatedTick: number | null;
  /** The last wrong offering pushed up to her, and when — she says so. */
  rejected?: { item: GladeRock; tick: number } | null;
  /** Rocks currently beside her, so each arrival is answered only once. */
  presented?: Partial<Record<GladeRock, boolean>>;
}
export type GladeRock = "gold" | "obsidian";
/** Pushable rocks she will refuse, by their pushable id. */
export const gladeRocks: Record<string, GladeRock> = {
  "puzzle-gold-rock": "gold",
  "puzzle-purple-rock": "obsidian",
};
export const newGlade = (): GladeState => ({
  bushesBurned: false,
  burnedTick: null,
  seatedTick: null,
});
export const GLADE_PUZZLE = "statueChair";
export const gladeState = (puzzles: Record<string, Pick<Puzzle, "glade">>) =>
  puzzles[GLADE_PUZZLE]?.glade;
/** The statue's reviewed ground footprint (object 2 of the glade export). */
export const gladeStatueSolid: Rect = solids.PUZZLE_GLADE[2];
/** Where a hero stands to speak with her: just in front of the pedestal. */
export const gladeStatueTalk = {
  x: gladeStatueSolid.x + gladeStatueSolid.w / 2,
  y: gladeStatueSolid.y + gladeStatueSolid.h + 16,
};
/** How far from the edge of her pedestal a hero can be and still speak. */
export const GLADE_TALK_RANGE = 40;
// Her pedestal's footprint is solid, and her figure rises north of it, so a
// hero on her north side stands that much further from the footprint.
const STATUE_FIGURE = 40;
/** Whether a hero can speak with her — from any side of the statue. */
export function nearGladeStatue(at: { x: number; y: number }) {
  const s = gladeStatueSolid,
    top = s.y - STATUE_FIGURE;
  const dx = Math.max(s.x - at.x, at.x - (s.x + s.w), 0),
    dy = Math.max(top - at.y, at.y - (s.y + s.h), 0);
  return Math.hypot(dx, dy) <= GLADE_TALK_RANGE;
}
// Dry bushes (ground centres) in an L that, with the map's north and east
// walls, encloses the chair. Gaps between them are narrower than a hero.
export const gladeBushes = [
  { x: 880, y: 64 },
  { x: 880, y: 112 },
  { x: 880, y: 160 },
  { x: 880, y: 208 },
  { x: 928, y: 208 },
  { x: 976, y: 208 },
];
export const gladeBushRect = (b: { x: number; y: number }): Rect => ({
  x: b.x - 26,
  y: b.y - 14,
  w: 52,
  h: 28,
});
export function gladeDynamicWalls(
  puzzles: Record<string, Pick<Puzzle, "glade">>,
): Rect[] {
  const state = gladeState(puzzles);
  return state && !state.bushesBurned ? gladeBushes.map(gladeBushRect) : [];
}
/** How close the chair must be pushed to the pedestal for her to sit. */
export const GLADE_SEAT_GAP = 24;
/** Whether something has been pushed up beside her pedestal. */
export function besideStatue(chair: Rect) {
  const s = gladeStatueSolid;
  const dx = Math.max(s.x - (chair.x + chair.w), chair.x - (s.x + s.w), 0),
    dy = Math.max(s.y - (chair.y + chair.h), chair.y - (s.y + s.h), 0);
  return Math.hypot(dx, dy) <= GLADE_SEAT_GAP;
}
export const gladeSolved = (puzzles: Record<string, Pick<Puzzle, "glade">>) =>
  gladeState(puzzles)?.seatedTick != null;
export const chairDelivered = besideStatue;
export const GLADE_STATUE_NAME = "Weeping Statue";
// Her opinion of the wrong offerings. She is a statue of refined taste.
export const gladeRejectLines: Record<GladeRock, string[]> = {
  gold: [
    "Gold? GOLD? Do I look like a dragon to you?",
    "I have been weeping for centuries and you bring me a shiny lump. Take it away before it reflects my face.",
  ],
  obsidian: [
    "A black, mysterious rock. How original. Is it brooding? It looks like it's brooding.",
    "I asked for what I lost, not something that lost a fight with a volcano.",
  ],
};
export function gladeStatueLines(state: GladeState | undefined): string[] {
  if (state?.seatedTick != null)
    return [
      "Ahh... At last, I can rest.",
      "Thank you, travellers. The path ahead is open to you.",
    ];
  return [
    "I've been standing here so long, waiting for someone to return to me what was lost.",
    state?.bushesBurned
      ? "It is free of the thorns now... Will you not bring it to me?"
      : "It lies where the dry thorns have grown thick. Nothing grows soft there anymore.",
  ];
}
