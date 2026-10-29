// Explicitly solution-informed experimental baseline, owner-approved 2026-10-29
// (full walkthrough, selected by --player model-guided on S3-local). Static
// knowledge only. Sources: route/fullQuest.ts: mirrorPond and its frozen
// constants in route/routeConstants.ts (TO_MIRROR, POND_PLAN, MIRROR_TARGET,
// MIRROR_REST, PAD, SHOT), shared/mirrorPond.ts (spike timing, push turning,
// 1.5 degrees per push tick) and the player manual. The values are copied, not
// imported: test/guidedPond.test.ts checks they equal the route's constants
// and that the route reaches the Vanity Mirror at seeds 0 and 1. Every timing
// number in the text is POND_MEASURED, measured in the real simulation by
// test/guidedPondValidation.test.ts and test/guidedPond.test.ts. No runtime
// engine, route, navigation or observation imports. Never add this to llm.ts.
import { createHash } from "node:crypto";

export const GUIDED_POND_VERSION = "mirror-pond-walkthrough-v1";

type Pt = readonly [number, number];
export interface PondMirrorStep {
  /** Push spot path (walk through these, ending at the push spot). */
  walk: readonly Pt[];
  /** Face this way with a 1-tick move, then hold Push for `push` ticks. */
  face: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
  push: number;
  /** Drawn angle the mirror shows afterwards. */
  to: number;
}
export interface PondMirrorGuide {
  mirror: Pt;
  /** Sieg's approach from where he left the previous mirror (or the spikes). */
  approach: readonly Pt[];
  solve: PondMirrorStep;
  rest: readonly [PondMirrorStep, PondMirrorStep];
  leave: readonly Pt[];
  /** Coco's floor marking (firing pad) and shot direction. */
  pad: Pt;
  shot: "n" | "s" | "e" | "w";
  brazier: Pt;
}

export const POND_GUIDE = Object.freeze({
  start: { sieg: [44.5, 33] as Pt, coco: [44.5, 36] as Pt },
  spikeMouth: [45, 26] as Pt,
  spikeClearX: 37.5,
  cocoCulvert: [[44, 31.6], [35, 31], [35, 27], [31, 20.5], [31, 16.5], [28, 12]] as readonly Pt[],
  /** (44,31.6) -> (35,31) split diagonal-first: due west at y=31.6 clips the culvert wall near x=42.4. */
  culvertDiagonal: [43.4, 31] as Pt,
  cocoA1toA2: [[27.5, 12.6], [26, 12.6], [26, 12]] as readonly Pt[],
  cocoA2toA3: [[23.4, 12], [19.2, 16.1], [16, 18]] as readonly Pt[],
  cocoA3toA4: [[20, 22.2], [20, 23.6], [22, 25]] as readonly Pt[],
  cocoA4toChest: [[22.7, 21.6], [24, 19.5]] as readonly Pt[],
  siegToSanctuary: [[27.5, 21.5], [24.5, 20.5]] as readonly Pt[],
  chest: [24, 18.5] as Pt,
  mirrors: [
    {
      mirror: [38, 12], approach: [[38.5, 25.5], [38.5, 15.5]],
      solve: { walk: [[38.125, 15.5], [37.25, 14.625], [37.25, 9.25], [37, 9]], face: "s", push: 45, to: 157.5 },
      rest: [
        { walk: [[37, 11], [36.5, 11.5]], face: "e", push: 29, to: 294 },
        { walk: [[36.5, 11.125], [38.125, 9.5], [39.5, 9.5]], face: "sw", push: 16, to: 270 },
      ],
      leave: [[38.875, 9.5], [38.75, 9.375], [38.375, 9.375], [36.5, 7.5]],
      pad: [28, 12], shot: "e", brazier: [44, 6],
    },
    {
      mirror: [26, 6], approach: [[29.5, 7.5]],
      solve: { walk: [[29.5, 5.5], [29, 5]], face: "w", push: 45, to: 67.5 },
      rest: [
        { walk: [[27, 5], [26.5, 4.5]], face: "s", push: 29, to: 24 },
        { walk: [[23.5, 4.5]], face: "se", push: 16, to: 360 },
      ],
      leave: [[23.5, 5.125], [23.375, 5.25], [23.375, 5.625], [22.5, 6.5]],
      pad: [26, 12], shot: "n", brazier: [21, 1],
    },
    {
      mirror: [6, 18], approach: [[5.5, 6.5], [5.5, 13.5]],
      solve: { walk: [[5.5, 14], [6.5, 15]], face: "s", push: 45, to: 22.5 },
      rest: [
        { walk: [[6.5, 16.5], [7.5, 17.5]], face: "w", push: 29, to: 66 },
        { walk: [[7.5, 17.125], [5.875, 15.5], [4.5, 15.5]], face: "se", push: 16, to: 90 },
      ],
      leave: [[4.5, 21.5], [5.5, 22.5]],
      pad: [16, 18], shot: "w", brazier: [1.5, 13.5],
    },
    {
      mirror: [22, 30], approach: [[5.5, 28.5], [18.5, 28.5]],
      solve: { walk: [[19, 29]], face: "e", push: 45, to: 292.5 },
      rest: [
        { walk: [[21, 29], [21.5, 28.5]], face: "s", push: 29, to: 156 },
        { walk: [[22.5, 28.5]], face: "s", push: 16, to: 180 },
      ],
      leave: [[26.5, 28.5], [27.5, 29.5]],
      pad: [22, 25], shot: "s", brazier: [17, 35],
    },
  ] as readonly PondMirrorGuide[],
});

/**
 * Timing measured in the real simulation at S3-local seeds 0 and 1 (identical
 * on both), in game ticks (60 per second). Pinned by the validation tests;
 * the walkthrough states only these numbers.
 */
export const POND_MEASURED = Object.freeze({
  /** Ticks the east column (x=43.5) shows 'retracting' under Slow Time. */
  cueVisibleTicks: 48,
  /** Super Speed under Slow Time, started at that cue, to x < 37.5 unharmed. */
  crossTicks: 79,
  /** From that cue until any column next shows 'warning' or 'raised'. */
  safeTicks: 153,
  /** Walking west from the same cue without Slow Time or Super Speed: hit after. */
  walkingHitTicks: 45,
  /** HP lost to one spike hit, and where Sieg reappears. */
  spikeDamage: 8,
  /** Coco's culvert flight along the listed straight path, at flying speed. */
  culvertFlightTicks: 352,
  /** Fireball shot to brazier lit, braziers 1-4, from the route's pad positions. */
  shotToLitTicks: [89, 60, 77, 56] as readonly number[],
});

export const POND_GUIDE_CHECKPOINTS = Object.freeze([
  ["A", "Arrival", "Mirror Pond court; no arrival conversation is expected (read one if it appears)."],
  ["B", "Coco on island A1", "Coco stands on floor marking A1 (28,12), across the water."],
  ["C", "Spikes crossed", "Sieg is west of x=37.5 on the dry walkway, past all four spike columns."],
  ["D1", "Brazier 1", "Mirror M1 shows 157.5 deg, Coco fires east from A1, brazier 1 shows lit; M1 back at 90 deg."],
  ["D2", "Brazier 2", "Mirror M2 shows 67.5 deg, Coco fires north from A2, brazier 2 shows lit; M2 back at 0 deg."],
  ["D3", "Brazier 3", "Mirror M3 shows 22.5 deg, Coco fires west from A3, brazier 3 shows lit; M3 back at 90 deg."],
  ["D4", "Brazier 4", "Mirror M4 shows 292.5 deg (same line as 112.5), Coco fires south from A4, brazier 4 shows lit; M4 back at 0 deg (180)."],
  ["E", "Vanity Mirror", "The sanctuary has risen; Coco opens the Vanity Mirror Chest and the Vanity Mirror is in the shared backpack: episode success."],
] as const);

const p = ([x, y]: Pt) => `(${x},${y})`;
const path = (points: readonly Pt[]) => points.map(p).join(" -> ");
const step = (s: PondMirrorStep) => `walk ${path(s.walk)}, face ${s.face} (one 1-tick move), Push ${s.push} ticks -> mirror shows ${s.to} deg`;
const mirrorLine = (m: PondMirrorGuide, i: number) =>
  `M${i + 1} at ${p(m.mirror)} (brazier ${i + 1} at ${p(m.brazier)}, Coco's pad A${i + 1} at ${p(m.pad)}, shot ${m.shot}): approach ${path(m.approach)}; SOLVE: ${step(m.solve)}; after brazier ${i + 1} is lit, REST: ${step(m.rest[0])}; then ${step(m.rest[1])}; LEAVE: ${path(m.leave)}.`;

const g = POND_GUIDE;
const t = POND_MEASURED;
const litMin = Math.min(...t.shotToLitTicks), litMax = Math.max(...t.shotToLitTicks);
const shared = `This is an explicitly INSTRUCTION-GUIDED baseline, not an unaided puzzle test. The following correct solution is intentionally supplied as static prior knowledge. It is not a reading of the current hidden world.
Scenario: suite revision 2 S3-local, Mirror Pond, goal Vanity Mirror in shared inventory. Initial positions in tiles: Sieg ${p(g.start.sieg)}, Coco ${p(g.start.coco)}, both full health, in the walled court east of the pond. East increases x; south increases y. Points below are turning points, not teleport destinations. The visible screen is only a local crop, so retain where you are on the route.
All actions are YOUR choices through the normal action JSON and legal_actions. No tool, script or navigator will follow this route for you. Choose move directions and ticks (1-60) yourself from current position and movement feedback. Use small corrections near push spots and pads. If blocked, inspect your own current grid and position rather than repeating the same blocked input. Painted floor text ('floor marking A1 ->', area captions) is text to read, not an E target. Wait actions advance simulated time; model thinking does not.
Keep your own latest completed checkpoint and next turning point in your notes. Check completion against your observations/inventory/feedback, not an attempted action or an old partner claim. Message only new completion facts or coordination, with your position and next task; acknowledge a request once. Do not infer your partner's private state. Trust current observations over older notes/messages.
How the pond works (verified): four mirrors M1-M4 each turn on a center pivot; each is listed with its drawn angle, e.g. 'mirror M1 ... [157.5 deg · Push one end · other end reverses]'. Angles are lines, so X and X+180 are the same orientation (292.5 = 112.5, 360 = 0). Only Sieg turns mirrors: stand within 3.25 tiles of the pivot, face the mirror, and hold Push; each push tick turns it 1.5 deg. Which way it turns depends on which half of which face you push; pushing straight at the pivot or square onto an end does nothing. Only Coco's Fireball reflects: from a firing pad (floor markings A1-A4, the arrow shows the shot direction), a Fireball that strikes a correctly angled mirror reflects onto that mirror's brazier and lights it. A direct hit does not count. When all four braziers are lit the sanctuary rises from the water at ${p(g.chest)} with the Vanity Mirror Chest. Coco's Slow Time also slows her Fireball (the manual: projectile timing is slowed): never fire while your status contains 'time is slowed'; wait until it is gone.
Spikes (east entrance, columns at x=40.5-43.5, y 24-28): each column shows warning -> raised -> retracting -> down; only 'raised' hurts. A hit costs ${t.spikeDamage} HP and puts Sieg back at ${p(g.start.sieg)}. Measured in the game (game time, 60 ticks per second): under Slow Time the easternmost column (x=43.5) shows 'retracting' for ${t.cueVisibleTicks} ticks; Sieg activating Super Speed at that cue and moving west reached x < ${g.spikeClearX} after ${t.crossTicks} ticks, unharmed, and no column showed 'warning' again until ${t.safeTicks} ticks after the cue. Walking west from the same cue without Slow Time or Super Speed was hit after ${t.walkingHitTicks} ticks.
A Arrival: no conversation is expected. Do not use the Return exit.
B Coco: use Flight (Coco ability 2) at once and fly the water culvert ${path(g.cocoCulvert)}. Flight lasts up to 20 s; flying this path in straight lines measured ${t.culvertFlightTicks} ticks. Between (44,31.6) and (35,31), move northwest first, to ${p(g.culvertDiagonal)}, then due west to (35,31): flying due west first along y=31.6 clips the culvert wall near x=42.4. On the other legs, if a straight line is blocked, also try the diagonal part first. Stand exactly on floor marking A1 ${p(g.mirrors[0].pad)}. Message Sieg when you are on A1.
C Spikes: Sieg walks north to the spike mouth ${p(g.spikeMouth)} (east of the columns) and waits there. When Coco is on A1 and Sieg is at the mouth with Super Speed ready, Sieg asks for Slow Time; Coco casts Slow Time (ability 1) once and replies. With 'time is slowed' in his status, Sieg watches the four spike columns using waits shorter than ${t.cueVisibleTicks} ticks, so the cue cannot be skipped. As soon as the x=43.5 column shows 'retracting', he activates Super Speed (ability 2) and moves west along y=25.9 (the verified route's line) in short moves until x < ${g.spikeClearX}. If 'time is slowed' ends before the cue, or he is hit, he waits for Slow Time and Super Speed to recharge (Slow Time 20 s cooldown from cast, Super Speed 15 s, per the manual) and repeats.
D Mirrors, in order M1, M2, M3, M4. For each mirror: Sieg walks the approach and push-spot path, faces as stated and pushes the stated ticks, then checks the drawn angle. If it is off, correct it: push a few more ticks (1.5 deg each), and if a push changes nothing, step sideways away from the mirror's line (the verified route stepped 0.4 tile) and push again; if it turned the wrong way, the side you push from reverses the direction. Aim for the exact listed angle: each push tick is 1.5 deg, every listed angle is a whole number of ticks from where the mirror starts, and the verified route always ended exactly on it. Sieg messages 'M<n> set to <angle>'. Coco, standing on the pad's marked point (the verified route stood within 0.12 tile of it), checks the mirror angle if she can see it, waits until 'time is slowed' is gone, then fires one Fireball (attack) in the pad's arrow direction and waits. Measured from the route's pad positions, each brazier showed lit ${litMin}-${litMax} ticks after the shot. Sieg confirms 'brazier <n> lit' from his view (Coco may not see it). If it has not lit well after that, recheck the angle and Coco's position and fire again. Only after the brazier is lit does Sieg turn the mirror to its REST angle (this reopens the walkway for the next leg) and walk the LEAVE path.
${g.mirrors.map(mirrorLine).join("\n")}
Coco's moves between pads: A1 -> A2 is a short walk on the same island: ${path(g.cocoA1toA2)}. A2 -> A3 needs Flight: ${path(g.cocoA2toA3)}. A3 -> A4 needs Flight (wait for its recharge if needed): ${path(g.cocoA3toA4)}. Pads are safe ground; Flight may end there.
E Chest: after brazier 4 is lit and M4 is at rest, Coco (Flight ready, flying) flies ${path(g.cocoA4toChest)} onto the risen sanctuary; when inventory.nearbyTarget offers the Vanity Mirror Chest she presses E (interact) with no item. Sieg may walk ${path(g.siegToSanctuary)} to watch; he is not needed for the chest. Confirm the Vanity Mirror in the shared backpack. This is the success condition; no return to the shrine is needed.
Expected checkpoints:\n${POND_GUIDE_CHECKPOINTS.map(([id, name, expected]) => `${id} ${name}: ${expected}`).join("\n")}`;

const roles = {
  Sieg: `YOU ARE SIEG. You turn all four mirrors and cross the spikes; you never fire. Start: walk north from ${p(g.start.sieg)} to the spike mouth ${p(g.spikeMouth)} and wait there until Coco reports she is on A1. Make sure Super Speed is ready, then message Coco to cast Slow Time. Cross as in C. Then, for M1 to M4 in order: approach, solve, report 'M<n> set to <angle>', wait (waits of 30-60 ticks) until the brazier shows lit, report it, rest the mirror, leave. Keep turning only the mirror you are at; never stand on Coco's pad or in the line between her pad and the mirror. After M4 is at rest, tell Coco 'all four braziers lit, sanctuary up' when you see it, and wait.`,
  Coco: `YOU ARE COCO. You fly, cast Slow Time once for the spike crossing, and fire all four reflected shots; you never push mirrors. Start: Flight at once, fly ${path(g.cocoCulvert)} (northwest to ${p(g.culvertDiagonal)} before going west, as in B) and stand exactly on A1 ${p(g.mirrors[0].pad)}; message Sieg. When Sieg asks for Slow Time, cast it once and reply 'Slow Time on'. Then wait on A1 for 'M1 set'; when your status no longer shows 'time is slowed', fire east and wait for Sieg's brazier report. After Sieg confirms brazier 1, walk to A2 (${path(g.cocoA1toA2)}) and fire north when he reports 'M2 set'. Then fly to A3 (${path(g.cocoA2toA3)}) and fire west at 'M3 set'; then fly to A4 (${path(g.cocoA3toA4)}) and fire south at 'M4 set'. Use waits of 30-60 ticks while Sieg works so game time advances. After brazier 4, fly to the sanctuary (${path(g.cocoA4toChest)}), press E at the Vanity Mirror Chest, check the backpack for the Vanity Mirror, and stop on success.`,
} as const;

export function guidedPondInstructions(hero: "Sieg" | "Coco") {
  return `\n\n=== ${GUIDED_POND_VERSION} · ${hero} · intentionally solution-informed ===\n${shared}\n\n${roles[hero]}\n=== End instruction-guided walkthrough ===`;
}
export const GUIDED_POND_ID = createHash("sha256").update(guidedPondInstructions("Sieg") + guidedPondInstructions("Coco")).digest("hex").slice(0, 12);
