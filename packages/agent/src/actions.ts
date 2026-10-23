// Legal actions and their translation into the game's ordinary inputs.
// Nothing here decides an outcome: timed actions become keyboard frames the
// server validates, and panel actions call the same room methods the
// Socket.IO handlers call.

import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import type { InputFrame, Player, World } from "../../shared/src/gameTypes.js";
import { items, type ItemId } from "../../shared/src/items.js";
import { storyView } from "../../../apps/client/src/ui/storyDialogue.js";
import { nearbyTarget, vectorOf } from "./perception.js";
import {
  directions,
  MAX_ACTION_TICKS,
  MAX_MESSAGE_CHARS,
  type AbilityName,
  type ActionSpec,
  type Direction,
  type GameAction,
} from "./types.js";

export const MAX_MESSAGES_PER_PLAYER = 64;
const PUSH_DEFAULT_TICKS = 30;

type Frame = Partial<InputFrame>;

/** A validated action, ready to run. */
export type Plan =
  | { kind: "timed"; frames: Frame[] }
  | { kind: "instant"; run: () => { ok: boolean; feedback: string[] } };

const abilityOwners: Record<AbilityName, "OATH" | "EMBER"> = {
  push: "OATH",
  super_speed: "OATH",
  slow_time: "EMBER",
  flight: "EMBER",
  black_hole: "EMBER",
};

/** Abilities whose icon shows "ready" for this hero right now. */
function readyAbilities(w: World, p: Player): AbilityName[] {
  const cd = (k: string) => (p.cooldowns[k] ?? 0) > 0;
  if (p.role === "OATH")
    return [
      "push",
      ...(p.unlockedSkills.includes("dash") && !(p.sprintRemaining ?? 0) && !cd("sprint")
        ? (["super_speed"] as const)
        : []),
    ];
  return [
    ...(p.unlockedSkills.includes("slow_time") && !cd("slow_time") && !w.slowTime
      ? (["slow_time"] as const)
      : []),
    ...(p.unlockedSkills.includes("flight") && !cd("flight") ? (["flight"] as const) : []),
    ...(p.unlockedSkills.includes("black_hole") && !cd("black_hole") ? (["black_hole"] as const) : []),
  ];
}

/** What the backpack panel would let you use on the nearby object. */
function usableItems(w: World, p: Player): ItemId[] {
  const target = nearbyTarget(w, p);
  if (!target || target.kind === "chest") return [];
  const owned = (Object.keys(items) as ItemId[]).filter((id) => (w.inventory?.counts[id] ?? 0) > 0);
  // The panel's button is disabled for a gate unless its key is selected.
  return target.kind === "gate" ? owned.filter((id) => id === target.itemId) : owned;
}

export interface ActionContext {
  room: GameRoom;
  playerKey: string;
  messagesSent: number;
}

/** The actions this hero can attempt now, without saying which one helps. */
export function legalActions(ctx: ActionContext): ActionSpec[] {
  const w = ctx.room.state;
  const me = w.players[ctx.playerKey];
  const specs: ActionSpec[] = [];
  const ticks = { kind: "int" as const, min: 1, max: MAX_ACTION_TICKS };
  const dir = { kind: "enum" as const, values: directions };
  const story = storyView(w, me.role);
  const inScene = !!story && !story.watching;
  if (w.phase === "PLAYING" && !story) {
    specs.push({ type: "move", description: "Walk in a direction for some ticks (60 ticks = 1 s).", params: { direction: dir, ticks } });
    specs.push({
      type: "attack",
      description: me.role === "OATH" ? "Press J: sword swing (optionally turning to a direction first)." : "Press J: cast a fireball (optionally turning to a direction first).",
      params: { direction: { ...dir, optional: true } },
    });
    specs.push({ type: "defend", description: `Hold K (${me.role === "OATH" ? "Guard" : "Ward"}) for some ticks.`, params: { ticks } });
    const ready = readyAbilities(w, me);
    if (ready.length)
      specs.push({
        type: "ability",
        description:
          me.role === "OATH"
            ? "Use an ability: push (hold 1 while walking into something), super_speed (2)."
            : "Use an ability: slow_time (1), flight (2), black_hole (3, fired in direction).",
        params: {
          ability: { kind: "enum", values: ready },
          direction: { ...dir, optional: true },
          ticks: { ...ticks, optional: true },
        },
      });
    specs.push({ type: "interact", description: "Press E: use the nearby object, travel marker, or pick something up." });
    const near = nearbyTarget(w, me);
    if (near)
      specs.push({
        type: "use_item",
        description: "Open the backpack panel's action on the nearby object, optionally offering an item.",
        params: { item: { kind: "enum", values: usableItems(w, me), optional: true } },
      });
  }
  if (inScene && story!.reader && !story!.held && !story!.choices)
    specs.push({ type: "advance_dialogue", description: "Press E: you have read this line." });
  if (inScene && story!.choices)
    specs.push({
      type: "choose_dialogue",
      description: "Pick one of the numbered responses.",
      params: { option: { kind: "enum", values: story!.choices.map((_, i) => i + 1) } },
    });
  specs.push({ type: "wait", description: "Do nothing for some ticks.", params: { ticks } });
  if (ctx.messagesSent < MAX_MESSAGES_PER_PLAYER)
    specs.push({
      type: "message",
      description: `Say something to your partner (max ${MAX_MESSAGE_CHARS} characters; ${MAX_MESSAGES_PER_PLAYER - ctx.messagesSent} left).`,
      params: { text: { kind: "text", maxLength: MAX_MESSAGE_CHARS } },
    });
  return specs;
}

const isInt = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Checks shape and legality. Returns an error string, or undefined if fine. */
export function validate(action: unknown, legal: ActionSpec[]): string | undefined {
  if (!action || typeof action !== "object" || Array.isArray(action)) return "Action must be an object.";
  const a = action as Record<string, unknown>;
  const spec = legal.find((s) => s.type === a.type);
  if (!spec) return `Action "${String(a.type)}" is not available right now.`;
  const allowed = new Set(["type", ...Object.keys(spec.params ?? {})]);
  const extra = Object.keys(a).find((k) => !allowed.has(k));
  if (extra) return `Unexpected field "${extra}".`;
  for (const [name, p] of Object.entries(spec.params ?? {})) {
    const v = a[name];
    if (v === undefined) {
      if ("optional" in p && p.optional) continue;
      return `Missing "${name}".`;
    }
    if (p.kind === "int" && !isInt(v, p.min, p.max)) return `"${name}" must be an integer from ${p.min} to ${p.max}.`;
    if (p.kind === "enum" && !p.values.includes(v as string | number))
      return `"${name}" must be one of: ${p.values.join(", ") || "(none available)"}.`;
    if (p.kind === "text" && (typeof v !== "string" || !v.trim() || v.length > p.maxLength))
      return `"${name}" must be non-empty text of at most ${p.maxLength} characters.`;
  }
  return undefined;
}

const move = (d?: Direction): Frame => (d ? { moveX: vectorOf[d].x, moveY: vectorOf[d].y } : {});
const tap = (frame: Frame): Frame[] => [frame, {}];
const repeat = (n: number, frame: Frame) => Array.from({ length: n }, () => ({ ...frame }));

/**
 * Builds the plan for a validated action. Panel actions call the same room
 * methods as the socket handlers in app.ts; their messages are what the
 * client shows in its dialogue box.
 */
export function planFor(
  action: GameAction,
  ctx: ActionContext & {
    requestId: () => string;
    deliver: (text: string) => void;
    /** The line this hero was looking at when they chose (as the client sends it). */
    seenLine?: { cutscene: string; line: number };
  },
): Plan {
  const { room, playerKey } = ctx;
  switch (action.type) {
    case "move":
      return { kind: "timed", frames: repeat(action.ticks, move(action.direction)) };
    case "wait":
      return { kind: "timed", frames: repeat(action.ticks, {}) };
    case "defend":
      return { kind: "timed", frames: repeat(action.ticks, { secondaryHeld: true }) };
    case "attack":
      return { kind: "timed", frames: tap({ primaryHeld: true, ...move(action.direction) }) };
    case "ability": {
      if (abilityOwners[action.ability] !== room.state.players[playerKey].role)
        throw Error("That ability belongs to the other hero.");
      if (action.ability === "push")
        return {
          kind: "timed",
          frames: repeat(action.ticks ?? PUSH_DEFAULT_TICKS, { pushHeld: true, ...move(action.direction) }),
        };
      const key = {
        super_speed: "sprintHeld",
        slow_time: "slowTimeHeld",
        flight: "flightHeld",
        black_hole: "blackHoleHeld",
      }[action.ability] as keyof InputFrame;
      return { kind: "timed", frames: tap({ [key]: true, ...move(action.direction) }) };
    }
    case "interact": {
      // The client's E: with an object in the panel's reach, E uses it
      // (InventoryPanel keydown); otherwise E goes to the world.
      const w = room.state,
        me = w.players[playerKey],
        target = nearbyTarget(w, me);
      if (!target) return { kind: "timed", frames: tap({ interactHeld: true }) };
      const gateKey =
        target.kind === "gate" && target.itemId && (w.inventory?.counts[target.itemId] ?? 0) > 0
          ? target.itemId
          : undefined;
      return { kind: "instant", run: () => useItem(room, playerKey, target.id, gateKey, ctx.requestId()) };
    }
    case "use_item": {
      const w = room.state,
        target = nearbyTarget(w, w.players[playerKey]);
      if (!target) throw Error("Nothing is near enough to use an item on.");
      const item = action.item as ItemId | undefined;
      return {
        kind: "instant",
        run: () =>
          useItem(room, playerKey, target.id, target.kind === "chest" ? undefined : item, ctx.requestId()),
      };
    }
    case "advance_dialogue":
    case "choose_dialogue":
      return {
        kind: "instant",
        run: () => {
          const w = room.state,
            view = storyView(w, w.players[playerKey].role);
          const seen = ctx.seenLine;
          // The server ignores reads of a line that already moved on, exactly
          // as it does for a late keypress from the browser client.
          if (!view || !seen || view.cutscene !== seen.cutscene || view.line !== seen.line)
            return { ok: false, feedback: ["That line had already moved on."] };
          if (action.type === "advance_dialogue") {
            const { accepted } = room.readStoryLine(playerKey, seen.cutscene, seen.line);
            return { ok: accepted, feedback: accepted ? [] : ["The line could not be moved on yet."] };
          }
          const choice = view.choices?.[action.option - 1];
          if (!choice) return { ok: false, feedback: ["That response is not available."] };
          const { accepted } = room.chooseStoryLine(playerKey, view.cutscene, view.line, choice.id);
          return { ok: accepted, feedback: accepted ? [`You chose: "${choice.text}"`] : ["Your choice was not taken."] };
        },
      };
    case "message":
      return {
        kind: "instant",
        run: () => {
          ctx.deliver(action.text.trim());
          return { ok: true, feedback: ["Message sent."] };
        },
      };
  }
}

function useItem(
  room: GameRoom,
  playerKey: string,
  targetId: string,
  itemId: ItemId | undefined,
  requestId: string,
) {
  try {
    const result = room.useItem(playerKey, { requestId, targetId, ...(itemId ? { itemId } : {}) });
    return { ok: true, feedback: [result.message] };
  } catch (e) {
    return { ok: false, feedback: [(e as Error).message] };
  }
}
