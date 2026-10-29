// Shared player knowledge for model players: the complete public player
// manual (verbatim) and a tutorial-completion briefing. Both are general game
// knowledge, the same for Sieg and Coco. Neither names an area, puzzle, item,
// route or event of the Bald Goddess quest; scenario objectives stay in each
// scenario's own episode briefing (suite.ts).
//
// Sources of the tutorial briefing, all player-facing:
//   - the Mossling Woods tutorial as players see it: its GUIDE lines and HUD
//     lesson goals (packages/shared/src/prologueWoods.ts);
//   - manual/Oath_and_Ember_Player_Manual.md (controls, abilities, limits);
//   - the public action and observation format (types.ts, the screen legend
//     in policies/llm.ts), which says how a control reaches the game.
// Numbers match the code they describe (packages/shared/src/movement.ts,
// constants.ts, apps/server/src/GameRoom.ts); playerKnowledge.test.ts checks
// them. Nothing here comes from hidden state, puzzle code or walkthroughs.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The one manual file models receive, relative to the repository root. */
export const PLAYER_MANUAL_PATH = "manual/Oath_and_Ember_Player_Manual.md";

/**
 * Files under manual/ that models do not receive, and why. The player manual
 * itself is given whole and unedited.
 */
export const MANUAL_EXCLUSIONS: readonly { path: string; reason: string }[] = Object.freeze([
  {
    path: "manual/GAME_DESIGN_RATIONALE.md",
    reason:
      "Developer design document, not player-facing: verified puzzle progression conditions, the design of the quest areas, a rule/source map and evaluation scope.",
  },
  {
    path: "manual/README.md",
    reason: "Maintainers' notes: image provenance, fixture use and source files to verify against.",
  },
  {
    path: "manual/Oath_and_Ember_Player_Manual.pdf",
    reason: "Illustrated copy of the same text; models receive the Markdown text copy.",
  },
  {
    path: "manual/images/",
    reason: "Screenshots; models are text-only. Each image's caption is part of the Markdown text and is kept.",
  },
]);

/** The player manual exactly as committed, and its SHA-256. */
export function loadPlayerManual(root: string) {
  const text = readFileSync(join(root, PLAYER_MANUAL_PATH), "utf8");
  return { text, sha256: createHash("sha256").update(text).digest("hex") };
}

/**
 * What both heroes learned by completing the Mossling Woods tutorial, plus
 * the player-facing controls, written for the action interface. Shared text
 * first, then one section per hero; both heroes read all of it, so each
 * knows the partner's abilities too, but acts only as their own hero.
 */
export const TUTORIAL_BRIEFING = `You and your partner have both completed the Mossling Woods tutorial. This is what it taught you, together with the player controls in the manual, written for your actions. It is general knowledge about how the game works. It says nothing about the places, puzzles or events ahead: discover those yourselves.

## Shared: moving and interacting
- move walks in one of eight directions for 1 to 60 ticks (60 ticks = 1 second). You face the way you last moved; attacks, Push and many interactions go the way you face.
- Walls, trees, furniture and other solid things block walking ("#" on your screen). Water and gaps ("~") block walking too; only Coco's Flight crosses them.
- interact is the E key. Stand close to a door, sign, character, chest, object or travel marker and press it. In the tutorial Coco pressed E beside a crate to take it. Travel markers (exits, ">") take you to another area when you press E next to them; some travel moves the whole party at once.
- Story scenes can take movement control for a while. Use advance_dialogue when a line is yours to move on and choose_dialogue for numbered responses.
- The backpack is shared: an item either of you obtains belongs to both of you. When you stand next to something that accepts items, the backpack panel names it (inventory.nearbyTarget) and use_item appears.
- The tutorial's guide pointed to the goal line at the top of the screen. In this evaluation that line is not part of your observation. Use dialogue, your quest journal, the text you can read in the world and your partner's messages.

## Shared: combat, defending and hazards
- attack is the J key. Sieg swings his sword at the area in front of him. Coco throws a fireball the way she faces. While abilities shows J as "recovering", pressing J does nothing.
- defend is holding K: Sieg's Guard, Coco's Ward. A hit taken while defending does a quarter of its normal damage. In the tutorial the mosslings wound up and shot a wooden spike straight out in a line; each of you blocked one by holding K as it came.
- Enemies signal attacks before they land. Step out of a windup's line, keep your distance from ranged attacks, or defend when a hit is likely. A swing or a visible effect does not guarantee a hit.
- Heroes start with 100 HP; health bars show what remains. At 0 HP a hero returns to the current area's spawn point with full health. There is no revive command.
- Damage stops your current action, and a feedback line says how much you took. A raised hazard is drawn "^" on your screen.

## Sieg (the Guardian)
- Sword (attack): 25 damage, about 0.45 seconds between swings. Position and facing decide what it reaches.
- Guard (defend): a quarter of the damage. Sieg's Guard also gives him a short forward burst in the direction he faces, at most once every 2 seconds, so starting a defend can move him a little.
- Super Speed (ability super_speed, the 2 key): double walking speed for 10 seconds, then 5 seconds of recharge. While Coco's Slow Time is on, Super Speed lets Sieg move at his ordinary, unslowed speed.
- Push (ability push, holding the 1 key while walking, with a direction and ticks): stand next to a movable object, face it and push. Walls and other obstacles can stop it. Some mechanisms respond to Push as a special interaction. The tutorial did not practise Push; this is from the controls.
- Heavy Break, described in the manual "when available", is not one of Sieg's starting skills and is not among your actions.

## Coco (the Arcanist)
- Fireball (attack): 20 damage. It flies the way Coco faces until it hits blocking terrain or a target, or reaches its range. About 0.6 seconds between casts.
- Ward (defend): a quarter of the damage.
- Slow Time (ability slow_time, the 1 key): for 10 seconds everyone affected moves at one fifth speed, heroes and enemies alike, Coco included; projectile and combat timing slow too. Its cooldown is 20 seconds from the cast, about 10 seconds after the effect ends.
- Flight (ability flight, the 2 key): fly over water and gaps. Walls, trees and solid objects still block her. Once started, a flight lasts 20 seconds and cannot be cancelled: there is no way to land early, and Flight is not offered again until it has recharged. A flight ends sooner only if Coco is defeated or travels to another area. Recharge takes 7 seconds after the flight ends. Be over safe ground when it ends: ending over water or a gap returns her to her most recent safe ground. In the tutorial Coco flew to an islet, pressed E at the crate there and flew back to Sieg, who waited on the bank; if Flight runs out somewhere she cannot walk back from, she waits for it to recharge.
- Black Hole (ability black_hole, the 3 key, fired in a direction): flies up to 6 tiles forward. Where it lands, or at its full range, it pulls in enemies within 3 tiles for 4 seconds and hurts each one once, for 30 damage. Recharge 10 seconds. Some puzzle objects react to the pull in their own way.

## Working together
- In the tutorial, Coco's Slow Time slowed the mosslings while Sieg kept his full speed with Super Speed. Coco's Black Hole bunched four mosslings together so Sieg could cut them down. Coco's Flight reached a crate across water while Sieg waited on the bank, and what she took went into the shared backpack.
- A mechanism can need both heroes, one hero's particular ability, or a sustained action, such as both of you holding E at separate stations at the same time. Progress can drain if one contribution stops. Watch its visible feedback rather than assuming one press completes it.
- Each of you has your own screen and camera. Your partner may be somewhere else, even in another area, and sees only their own screen.

## Reading your screen
- Kind "label" is text painted or floating in the world: names, signs and painted instructions. Read it. It has no screen character and is not itself something to press E on.
- Things you might use are listed as objects ("o"), exits (">"), creatures ("C") or characters. "#" is blocked, "~" is water or a gap, "^" a raised hazard, "E" an enemy, "*" a projectile or effect, "P" your partner.
- When you press E and nothing responds, the result says so: "You pressed E; nothing responded."

## Confirming what happened
- Movement: a move's result reports how far you went compared with open ground ("full", "partial", "none" or "not_applied"), with where you started and ended. Check your x and y rather than assuming you arrived.
- Abilities: the abilities list shows each one as "ready", "active (Ns)" or "flying (Ns)" while it runs, and "recharging (Ns)" afterwards. An attack's result says whether a swing or cast happened.
- Areas: when you change area, a feedback line says "You arrived at <area>.", area.name changes, and the area joins your discovered areas.
- Damage, items and progress: feedback reports damage; the backpack lists items; the quest journal lists the current objective and completed quests.

## Talking to your partner
- message is your only channel. Your partner cannot see your screen or your notes.
- Say where you are (area and position), what you see (read labels word for word) and what you are about to do. Ask for a specific ability at a specific moment ("cast Slow Time now"), then say when you have done it and what happened.
- Report only what your own observation shows. Mark guesses as guesses. Answer your partner's questions, and agree who moves shared dialogue lines on.`;

/** Short id of the tutorial briefing for policy names and records. */
export const tutorialId = (text: string = TUTORIAL_BRIEFING) => createHash("sha256").update(text).digest("hex").slice(0, 8);

/**
 * The tutorial briefing as its own block in the system prompt: after the
 * general prompt and the manual, before any episode briefing.
 */
export function tutorialBlock(text: string = TUTORIAL_BRIEFING) {
  return `\n\n=== Tutorial-completion knowledge (shared by both players) ===\n${text.trim()}\n=== End of tutorial-completion knowledge ===`;
}
