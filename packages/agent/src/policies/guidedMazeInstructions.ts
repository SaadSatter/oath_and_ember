// Explicitly solution-informed experimental baseline, owner-approved 2026-10-29.
// Static knowledge only. Sources: route/fullQuest.ts: hedgeMaze (Maze section
// only), shared/hedgeMaze.ts, server/hedgeMaze.ts and inventory.ts. No runtime
// engine, route, navigation or observation imports. Never add this to llm.ts.
import { createHash } from "node:crypto";

export const GUIDED_MAZE_VERSION = "hedge-maze-walkthrough-v1";
export const MAZE_GUIDE_LEGS = Object.freeze({
  cowApproach: [[20.5, 34.5], [20.5, 25.5]],
  aroundCow: [[20.5, 27.5], [21.5, 27.5], [21.5, 30.5], [27.5, 30.5]],
  cocoStage: [[27.5, 19.5], [32.5, 19.5]],
  siegNorth: [[27.5, 15.5], [11.5, 15.5], [11.5, 7.5], [19.5, 7.5]],
  topSweep: [[4, 4.5], [19.5, 4.5], [34, 4.5]],
  loopWest: [[11.5, 4.5], [11.5, 12.5]],
  loopEast: [[39.5, 4.5], [39.5, 12.5]],
  gateUpper: [[39.5, 4.5], [39.5, 14.5]],
  gateLower: [[39.5, 12.5], [39.5, 14.5]],
  cocoGate: [[33.5, 18.5], [39.5, 18.5], [39.5, 15.8]],
  cocoChest: [[39.5, 15.5], [44.5, 15.5], [44.5, 6.5]],
} as const);
export const MAZE_GUIDE_CHECKPOINTS = Object.freeze([
  ["A", "Arrival", "Hedge Maze; read the arrival conversation before moving."],
  ["B", "Guards and dry hedge", "Dry-hedge object disappears; eastern passage is open."],
  ["C", "Cow", "The actual cow and its extent move west; use current cells, not its fixed caption."],
  ["D", "Northern approach", "Sieg reaches the northern loop; Coco is staged south/east, ready for Slow Time."],
  ["E", "Wolf key", "Hedge Gate Key appears in the shared inventory; do not merely assume a tag worked."],
  ["F", "Gate", "Gate reports open; the key is consumed."],
  ["G", "Shears", "Enchanted Shears appear in the shared inventory: episode success."],
] as const);
const path = (points: readonly (readonly number[])[]) => points.map(([x, y]) => `(${x},${y})`).join(" -> ");
const shared = `This is an explicitly INSTRUCTION-GUIDED baseline, not an unaided puzzle test. The following correct solution is intentionally supplied as static prior knowledge. It is not a reading of the current hidden world.
Scenario: suite revision 2 S2-local, Hedge Maze, goal Enchanted Shears in shared inventory. Initial positions in tiles: Sieg (4,34), Coco (5.56,34), both full health. Use your current self position if you have moved or respawned. East increases x; south increases y. These are corridor turning points, not teleport destinations. The visible screen is only a local crop, so retain which corridor you followed.
All actions are YOUR choices through the normal action JSON and legal_actions. No tool, script or navigator will follow this route for you. Choose move directions and ticks (1-60) yourself from current position and movement feedback. Use small corrections at turns; never walk diagonally across hedges. If blocked, inspect your own current grid and position rather than repeating the same blocked input. A sign or painted caption is text to read, not necessarily an E target. Wait actions advance simulated time; model thinking does not.
Keep your own latest completed checkpoint and next turning point in your notes. Check completion against your observations/inventory/feedback, not an attempted action or an old partner claim. Message only new completion facts or coordination, with your position and next task; acknowledge a request once. Do not infer your partner's private state. Trust current observations over older notes/messages. On defeat resume from the observed spawn and recheck shared inventory and passage state.
A: Read the arrival dialogue. Sieg advances a shared line when allowed; Coco waits briefly if Sieg is advancing it, and answers any choice offered specifically to her. No duplicate advance presses.
B: Walk east along the broad entrance corridor at y=34.5 in two stages: first near x=10, then x=16.5. Sieg stays about one tile east of Coco (11 then 17.5). Clear visible hostile guards with ordinary role attacks and defend/dodge telegraphed attacks. Do not confuse the cow or wolf with a hostile guard. Coco uses a Fireball attack east from (16.5,34.5) into the dry hedge centered near (19,34). If combat already burned it, do not burn it again. Allow projectile travel (up to a 60-tick wait), then check the hedge disappeared and the passage opened. Sieg's Push and E are not the dry-hedge solution.
C: Coco casts Black Hole EAST from the west lane at (20.5,25.5) to pull the cow west into its grazing bay. Sieg stays back near (17.5,34.5), out of the cow's path. The pull can take about 300 ticks (five waits of 60, checking progress). If it does not move, recheck the casting spot, line of sight, cooldown and whether a hero is obstructing the body; don't keep shooting at the caption. The cow is a 4x4 creature centered initially near (26,25); its actual body/extent moves, while 'Harmless cow' and 'BLACK HOLE -> grazing bay' captions stay fixed. Success is its body moving west toward x=23.8, opening the route on its east. No Push, E or item offering is needed for the cow.
D: Go around the moved cow using the SOUTH detour, not straight through its 4x4 body or the hedge: ${path(MAZE_GUIDE_LEGS.aroundCow)}. Then follow your role's route below. Flight is not needed and is not a way through hedge walls.
E: The forest wolf carries the Hedge Gate Key and moves dynamically; its initial/source position is not a reliable chase destination. Sieg must tag it with E, not attack it or offer an item. Coordinate Coco's global Slow Time with Sieg's Super Speed. During the effect Sieg approaches the currently visible wolf in short moves (about 1-4 ticks near it); press interact as soon as inventory.nearbyTarget offers the Forest wolf. If it leaves view, search connected northern lanes, not a straight line through walls. If effects expire, message, wait for both cooldowns, and repeat. Confirm Hedge Gate Key in shared inventory before going to the gate.
F: Bring Sieg to the WEST side of the key gate near (39.5,14.5). E/interact there uses the shared key automatically through normal game interaction; do not offer unrelated items. Confirm the gate is open and key consumed. Coco waits on the other approach until confirmation.
G: Coco follows the opened route to the Shears Chest, stops close to it and presses E without offering an item. Confirm Enchanted Shears in shared inventory. This is the success condition; no return, goddess offering or another area is needed. Finish here, not at a guessed earlier checkpoint.
Expected checkpoints:\n${MAZE_GUIDE_CHECKPOINTS.map(([id, name, expected]) => `${id} ${name}: ${expected}`).join("\n")}`;
const roles = {
  Sieg: `YOU ARE SIEG. Escort/clear guards at B, then WAIT near (17.5,34.5) while Coco burns the hedge and moves the cow. Do not stand beside the cow or Push it. After Coco confirms C, first walk to (20.5,34.5), then follow ${path(MAZE_GUIDE_LEGS.aroundCow)} and ${path(MAZE_GUIDE_LEGS.siegNorth)}. These legs lead west along the row-15.5 lane, north through x=11.5, then east into the northern loop. Tell Coco 'at northern loop, ready to chase' only when there. Ask for Slow Time; when confirmed active, activate Super Speed and chase/tag the wolf yourself. Search the top lane through ${path(MAZE_GUIDE_LEGS.topSweep)} or the connected row-12.5 lane if the wolf is there. The north/south connectors are ${path(MAZE_GUIDE_LEGS.loopWest)} on the west and ${path(MAZE_GUIDE_LEGS.loopEast)} on the east: follow those columns between the two horizontal lanes, never straight through the central hedge. Observe the moving wolf and nearbyTarget before choosing each short action; you cannot know its unseen position. After key acquisition, if in the top lane go ${path(MAZE_GUIDE_LEGS.gateUpper)}. If in the lower loop, reach y=12.5 at your current x, then ${path(MAZE_GUIDE_LEGS.gateLower)}. Interact near the gate, confirm F, and tell Coco to proceed to chest. Hold position or wait while she opens it; do not leave the area.`,
  Coco: `YOU ARE COCO. At B burn the dry hedge with Fireball east from (16.5,34.5), then follow ${path(MAZE_GUIDE_LEGS.cowApproach)} and cast Black Hole east. Ask Sieg to stay back until the actual cow has moved; observe its body, not the stationary caption. Confirm C and report the new passage. Follow ${path(MAZE_GUIDE_LEGS.aroundCow)} then ${path(MAZE_GUIDE_LEGS.cocoStage)}. This stages you south/east of the northern loop; you need not chase the wolf. Wait for Sieg's message that he reached the northern loop, announce and cast Slow Time when ready, and use waits so his pursuit advances. Only Sieg can take the wolf's key. If he needs another attempt, wait for the visible cooldown and coordinate again. Once shared inventory shows the key, follow ${path(MAZE_GUIDE_LEGS.cocoGate)}. Wait for gate-open confirmation/current observation; then follow ${path(MAZE_GUIDE_LEGS.cocoChest)}. The chest is near (44,5); at (44.5,6.5) you are within ordinary interaction range. Press interact with no item. Check the backpack for Enchanted Shears; stop on success.`,
} as const;
export function guidedMazeInstructions(hero: "Sieg" | "Coco") {
  return `\n\n=== ${GUIDED_MAZE_VERSION} · ${hero} · intentionally solution-informed ===\n${shared}\n\n${roles[hero]}\n=== End instruction-guided walkthrough ===`;
}
export const GUIDED_MAZE_ID = createHash("sha256").update(guidedMazeInstructions("Sieg") + guidedMazeInstructions("Coco")).digest("hex").slice(0, 12);
