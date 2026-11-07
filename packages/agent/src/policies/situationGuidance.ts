// Post-tuned prompt configurations (declaration oath-ember-abc-2026-11-06,
// "Pre-tuned / Post-tuned"). A guidance block is extra planner text for the
// post-tuned condition of named situations only. The pre-tuned condition sends
// no block, so its system prompt stays byte-identical to the generic policy.
//
// Each entry is versioned by id and pinned by the hash of its text. A
// "proposed" entry is the implementation agent's draft for the owner's review:
// it can be exercised with the mock gateway, and every paid run refuses it
// until the owner approves the text and the status is changed to "approved"
// (a reviewed code change). Guidance never names coordinates, routes or a
// step-by-step sequence, and never goes to scripted baselines.

import { createHash } from "node:crypto";
import type { SituationId } from "../suite.js";

export interface SituationGuidance {
  id: string;
  /** The only situations this guidance may be used on. */
  situations: readonly SituationId[];
  status: "proposed" | "approved";
  /**
   * SHA-256 of the exact text the owner approved (review finding 4). A paid run
   * needs status "approved" AND this hash equal to the text's hash, so editing
   * an approved text re-locks it.
   */
  approvedSha256?: string;
  /** Who wrote it and from what (disclosed in results). */
  provenance: string;
  text: string;
}

/**
 * PROPOSED, NOT APPROVED (2026-11-06). Griffin combat guidance for Situation B's
 * post-tuned condition, drafted from the game's source and the offline witness
 * (docs/midterm/SITUATION_B_GRIFFIN.md). For C it would be a transfer only if
 * the owner adds C here before any C model outcome.
 */
const GRIFFIN_B_POST_V1 = [
  "Griffin combat guidance:",
  "- The Griffin's floating label shows its health and what it is doing. While it flies, Sieg's sword cannot reach it; Coco's fireballs can.",
  "- BEAM CHARGE is a warning. A thin red line (listed as \"griffin beam warning line\") shows where the beam will stop. Before BEAM starts, hold defend or leave the line: a defended hit does a quarter of its damage. Walls, pillars and bodies stop the beam.",
  "- The Griffin aims at the nearer hero. Keep the hero who is not attacking farther away, holding defend, and keep the attacker defending through every charge and beam.",
  "- A fireball flies straight in the direction thrown. From the shore below the Griffin's flight path, follow it side to side and throw north just before it passes overhead.",
  "- Health does not come back during this episode. A hero who is low on health should stay back and defend rather than attack.",
  "- When its label shows it defeated, Coco can fly to its nest with Flight and press E there to collect the wig.",
].join("\n");

/**
 * APPROVED by the owner (2026-11-06), text unchanged since 6276656. General play heuristics taken from the
 * Situation A heuristic baseline (baseline-maze-heuristic-v2, mazeHeuristic.ts),
 * restated as advice for the planner. It names no particular place, enemy,
 * attack, item, ability, coordinate or sequence (it does use the generic words
 * "enemies", "a ranged attack" and "a recharging ability"). Written after Pilot-31 (B pre-tuned) had been run and
 * its trace read; see docs/midterm/B_POST_TUNING_TRANSFER.md for the source of
 * each line and that disclosure.
 */
const B_POST_A_TRANSFER_V1 = [
  "General play heuristics (they apply anywhere; they are not facts about this place):",
  "Spatial reasoning",
  "- Plan movement over the combined map. Treat walls, water and the bodies of enemies and creatures (their listed extents) as blocking. A hero's body needs open ground all around it.",
  "- Something seen earlier but not on a screen now may have moved. Use seen_earlier as a hint, not as its current position.",
  "Systematic positioning",
  "- When an action depends on where the hero stands and which way it faces (a ranged attack, a pull, an interaction), list a few candidate tiles around the target. Each should be open ground, not touching any body, with the target clearly in reach rather than at the edge of range. Prefer the candidate with a clear straight line to the target, with the other hero out of that line, and short to reach.",
  "- Keep in known_obstacles which position-and-aim combinations were tried and what was observed. Do not repeat an identical combination unless something relevant changed.",
  "- Do not stand on top of a target or another body. If a hero overlaps one, first step out to open ground, then choose a position.",
  "- After acting, move the hero off any path or area the screen shows an effect is about to cross, before it lands, then return to a chosen position. Do not wait for damage to show that a place was unsafe.",
  "Search",
  "- When the next thing the objective needs is on neither screen, explore systematically: go to the nearest unexplored edge of the map (\"?\" next to seen open ground) that has not been visited, prefer new tiles over tiles already walked, and back off and go around when a way is blocked instead of repeating the same move.",
  "- Keep a short note in the plan of areas already searched, so the search does not loop.",
  "Feedback-based recovery",
  "- Treat each action as a test with an expected visible result: a target's shown health falls, a body moves, the hero arrives, the backpack, journal or dialogue changes. Allow a short, bounded time for the result, then compare the screens with what was expected.",
  "- If two tries of the same kind show no result, change one thing: position, aim, timing, or which hero does it. If several changes still show nothing, try a different approach or work on another part of the objective.",
  "- A recharging ability is not a reason to stand still. Give the hero useful work meanwhile (getting clear, repositioning, scouting) and come back when its shown state is ready.",
  "- When the world changes (a way opens, a body moves), forget earlier blocked results near it and test again.",
].join("\n");

/**
 * PROPOSED, NOT APPROVED (2026-11-06). Owner-authored combat heuristics,
 * pasted by the owner and stored byte for byte (not edited by the agent).
 * Written after Pilot-31 (B pre-tuned) was known. See
 * docs/midterm/B_POST_TUNING_TRANSFER.md, section 9.
 */
const B_POST_COMBAT_V2 = "# Combat Heuristics — Prompt-Only Tuning v2\n\nYou are controlling a character in a real-time cooperative game. Use only your current observations, remembered observations, and available actions. Do not assume hidden enemy mechanics or unseen map information.\n\n## Combat priorities\n\nAt every decision, evaluate the following in order:\n\n1. **Survival:** If a visible attack warning threatens your current position, prioritize moving outside the indicated danger area or defending. Do not deliberately remain in a known dangerous area to complete an attack.\n\n2. **Attack opportunity:** Before attacking, check whether the target is visible, whether the attack can plausibly reach it, whether the direction is correct, and whether terrain or another obstacle may interfere.\n\n3. **Effectiveness:** After an attack, inspect available feedback and target health. An accepted attack is not evidence of damage. Repeat a tactic when it is demonstrably effective and reasonably safe. If repeated attempts show no effect, change position, direction, timing, or attack type.\n\n4. **Positioning:** Prefer positions that permit effective attacks while minimizing exposure to visible danger. Do not occupy the target's position when attacks from that position are ineffective. Avoid moving far away from an effective position without a reason.\n\n5. **Objective:** Continue until the required objective is confirmed through observations. Do not confuse surviving or performing attacks with winning.\n\n## Systematic combat search\n\nWhen attacks are ineffective, use a deliberate search:\n\n- Identify one plausible cause: distance, direction, obstruction, timing, or target state.\n- Change one factor at a time.\n- Observe the result before repeating or making another major change.\n- Remember successful and unsuccessful attack positions.\n- Return to previously effective positions when conditions permit.\n\nAvoid wandering across the arena without a specific positioning objective.\n\n## Defensive behavior\n\n- Defending is useful when a threat is imminent, but repeated defending without advancing the objective is not a complete combat strategy.\n- Waiting is appropriate when there is a specific reason to expect a useful state change.\n- If no such reason exists, choose a productive attack, repositioning action, or information-gathering action instead.\n- When health is low, reduce unnecessary exposure. If either teammate being knocked out ends the episode, consider both heroes' survival.\n- Use shorter action commitments in dangerous or rapidly changing situations. Do not assume a long action will remain safe throughout its duration.\n\n## Cooperative behavior\n\n- Consider what your teammate is currently doing and whether your own actions complement it.\n- Avoid having both heroes remain exposed to the same visible threat unnecessarily.\n- If one hero is unable to attack effectively, that hero should reposition, defend against a concrete threat, or pursue another useful objective rather than wait indefinitely.\n- Coordinate through available observations and messages; do not assume your teammate knows your intentions.\n\n## Decision discipline\n\nBefore choosing an action, identify:\n\n- Immediate threat, if any.\n- Intended effect of the next action.\n- Observable evidence that would confirm success.\n- What to change if the action fails.\n\nDo not produce lengthy explanations unless needed. Execute the chosen action and update your plan from the resulting observations.\n\nThese are general-purpose combat heuristics. They do not specify any particular enemy's behavior, attack pattern, safe location, or solution.";

/**
 * PROPOSED, NOT APPROVED (2026-11-06). Owner-directed consolidation of
 * b-post-a-transfer-v1 (spatial/search heuristics) and b-post-combat-v2
 * (owner-authored combat heuristics) into one decision hierarchy for the
 * centralized planner, drafted by the implementation agent to the owner's
 * eight-step outline. Post-hoc Situation B tuning (after Pilot-31 and
 * Pilot-32). See docs/midterm/B_POST_TUNING_TRANSFER.md, section 10.
 */
const B_POST_COMBINED_V3 = "Planner guidance for both heroes (general heuristics; not facts about any particular place, enemy or solution):\nYou plan for Sieg and Coco together. At each reply, go through these steps in order for each hero, and give each hero an order for the first step that applies to it.\n\n1. Survive visible threats. If a hero's screen shows a warning of an effect about to reach that hero's position (a marked line, area or charging attack), move that hero off it or have it defend before it lands. Do not keep a hero in a warned area to finish an attack. While threats are close, prefer short actions over long walks or long waits.\n\n2. Find a reachable, effective attack position. Plan over the combined map: walls, water and the listed extents of enemies and creatures block movement, and a hero's body needs open ground around it. Consider a few open tiles from which the hero's attack can plausibly reach the target in a straight line, not at the edge of its range, not overlapping any body, and with the other hero out of that line. Prefer one that is safe and short to reach. Do not stay on top of the target unless attacks from there visibly work.\n\n3. Attack when there is a plausible chance to connect: the target is visible, in reach, in the right direction and not blocked. Otherwise move toward the chosen position instead of attacking.\n\n4. Verify damage from what is shown, such as the target's health or label, allowing a short time for a projectile or effect to arrive before judging.\n\n5. Repeat what works and adjust what does not. Keep in known_obstacles which position, direction and timing combinations showed damage and which showed none, and return to a position that worked when it is safe. When attacks keep showing no effect, name one likely cause (distance, direction, obstruction, timing or the target's state), change only that, and check again. If several changes fail, try a different attack or another part of the objective.\n\n6. Avoid unproductive time. Wait only for a specific expected change; defend only against a concrete, imminent threat. A hero that cannot attack usefully now (for example while its ability recharges) should reposition, get clear or scout. Do not move without a positioning purpose. When what the objective needs next is on neither screen, explore systematically: head for the nearest unvisited edge of the map (\"?\" next to seen open ground), note searched areas in the plan, and back off and go around when a way is blocked. When the world changes (a way opens, a body moves), drop earlier blocked results near it and test again.\n\n7. Coordinate both heroes and protect their health. Give the two heroes complementary orders, and do not leave both exposed to the same visible threat. When a hero's health is low, give it a safer role and let the healthier hero take the riskier task; keep both heroes alive when the task requires it.\n\n8. Verify every required success condition from observations before treating the objective as done. Surviving, attacking or reaching one milestone is not the whole objective; follow the task to its end.";

/**
 * APPROVED by the owner (2026-11-06), text unchanged since af81ccc. Owner-directed revision of
 * b-post-combined-v3 (owner decisions: orders only when a plan must change,
 * health in step 1, header, "visible attack warning"); drafted by the
 * implementation agent. Owner-written, post-hoc Situation B tuning; a
 * supplementary trial, not a replacement for Pilot-32 (B/post-tuned/1).
 * See docs/midterm/B_POST_TUNING_TRANSFER.md, section 12.
 */
const B_POST_COMBINED_V4 = "Planner guidance for both heroes (general-purpose combat and planning guidance, based on what the heroes' screens show):\nAt each reply, check both heroes against these steps in order. Give a new order only to a hero whose current plan needs to change; a hero whose plan still fits its situation carries on without one.\n\n1. Protect both heroes first. Before any offensive order, check each hero's health and exposure. If a hero's screen shows a visible attack warning for that hero's position (such as a marked line or area), move that hero off it or have it defend before it lands. Do not keep a hero in a warned area to finish an attack. When a hero's health is low, give it a safer role and let the healthier hero take the riskier task, but keep it doing useful work rather than defending without a threat. While threats are close, prefer short actions over long walks or long waits.\n\n2. Find a reachable, effective attack position. Plan over the combined map: walls, water and the listed extents of enemies and creatures block movement, and a hero's body needs open ground around it. Consider a few open tiles from which the hero's attack can plausibly reach the target in a straight line, not at the edge of its range, not overlapping any body, and with the other hero out of that line. Prefer one that is safe and short to reach. Do not stay on top of the target unless attacks from there visibly work.\n\n3. Attack when there is a plausible chance to connect: the target is visible, in reach, in the right direction and not blocked. Otherwise move toward the chosen position instead of attacking.\n\n4. Verify damage from what is shown, such as the target's health or label, allowing a short time for a projectile or effect to arrive before judging.\n\n5. Repeat what works and adjust what does not. Keep in known_obstacles which position, direction and timing combinations showed damage and which showed none, and return to a position that worked when it is safe. When attacks keep showing no effect, name one likely cause (distance, direction, obstruction, timing or the target's state), change only that, and check again. If several changes fail, try a different attack or another part of the objective.\n\n6. Avoid unproductive time. Wait only for a specific expected change; defend only against a concrete, imminent threat. A hero that cannot attack usefully now (for example while its ability recharges) should reposition, get clear or scout. Do not move without a positioning purpose. When what the objective needs next is on neither screen, explore systematically: head for the nearest unvisited edge of the map (\"?\" next to seen open ground), note searched areas in the plan, and back off and go around when a way is blocked. When the world changes (a way opens, a body moves), drop earlier blocked results near it and test again.\n\n7. Coordinate both heroes. Give the two heroes complementary orders, and do not leave both exposed to the same visible threat; keep both heroes alive when the task requires it.\n\n8. Verify every required success condition from observations before treating the objective as done. Surviving, attacking or reaching one milestone is not the whole objective; follow the task to its end.";

/**
 * APPROVED by the owner (2026-11-06, declaration r11). Owner-requested C-specific hint for the
 * official C3, classified as outcome-informed, C-specific supplementary tuning: check the inventory and read what is
 * written at the Griffin's nest, without giving the solution. Drafted by the
 * implementation agent; the owner asked for it after C1 (Pilot-34) had run.
 * Appended after the unchanged v4 text, so C3 = C1 + v4 + this paragraph.
 */
export const C_INVENTORY_NEST_HINT = "Additional guidance for this task:\nBefore choosing how to reach the objective, check the shared inventory and read each item's description. Read the labels and messages on objects near the objective, such as the Griffin's nest: they can describe what an item is for. Consider whether an item offers a way to reach the objective besides combat.";

/**
 * PROVISIONALLY APPROVED by the owner (2026-11-07), revision 2 with the owner's
 * health-aware refinement and knockout recovery; frozen by hash in
 * showcase.test.ts. Status stays "proposed" (paid runs refuse it) until the
 * owner's separate final authorization flips it with SHOWCASE_PAID_APPROVED.
 * Showcase-only guidance for the
 * prompt-tuned continuous demonstration showcase-maze-griffin-complete-v1
 * (docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md), excluded from the A/B/C
 * evaluation. The owner allowed explicit guidance because this is a
 * demonstration, not a generalization experiment. It still names no
 * coordinate, waypoint, puzzle answer or hidden state: it orders the phases,
 * says how to tell from the screens that a phase is over, assigns roles, and
 * forbids the peaceful nest route. The approved v4 combat text follows it
 * unchanged. Drafted by the implementation agent; the owner may tune it.
 */
export const SHOWCASE_PHASE_PLAN = [
  "Showcase plan for both heroes (a demonstration of the whole remaining quest in one run). Work through these four phases in order. Decide which phase you are in only from what the screens, the area name, the shared backpack, the labels and the dialogue show, never from elapsed time or from an order having been accepted. Keep the current phase and the evidence for it in the plan.",
  "Health, in every phase: treat both heroes' health as scarce and do not expect it to come back on its own. Avoid damage that does not advance the objective: deal with enemies from a safe angle, defend or step aside when a visible attack is coming, and do not walk through hazards that can be avoided. Keep each hero's current health in the plan. If a hero is knocked out, read where that hero is now and its health, bring the two heroes back together, and continue the current phase; do not redo phases already completed.",
  "Phase 1, Hedge Maze: the two heroes cooperate to get through the maze and obtain the Enchanted Shears. Give Coco the environmental obstacles her fire, pull or flight can affect; give Sieg the enemies, gates and anything that must be chased, struck, pushed or reached quickly. When one hero clears a way, send the other through it. Preserve health here: the Griffin fight comes later with whatever health the heroes still have. Phase 1 ends only when the shared backpack lists the Enchanted Shears.",
  "Phase 2, travel: leave the maze through its RETURN exit. At the Goddess Shrine, take the exit marked for the Griffin. Travel only through ordinary exits; do not visit other areas. Keep both heroes together and avoid damage on the way. Before entering the Griffin Enclosure, note both heroes' health in the plan and decide each hero's role from it: the healthier hero takes the more exposed role.",
  "Phase 3, Griffin combat: defeat the Griffin in combat until its label shows it defeated. Coco attacks from range; Sieg protects himself, keeps clear of the beam line Coco is using, and strikes when the Griffin is in his reach. Fight defensively: before each attack, check whether a visible warning covers either hero and move or defend first; keep the two heroes apart so one attack cannot hit both; give a hero with low health a safer role. Follow the combat guidance below. While the Griffin is alive, do not go to its nest or use any backpack item there: this demonstration requires the combat route.",
  "Phase 4, wig and Goddess: only after the Griffin's label shows it defeated, Coco claims the wig at its nest (only she can reach it, by flight). Confirm that the shared backpack lists the wig. Then return through the RETURN exit to the Goddess Shrine, offer the wig at the offering, and read and answer every following dialogue until the story shows that Chapter 0 is complete. Holding the wig is not the end.",
].join("\n\n");

export const SITUATION_GUIDANCE: Readonly<Record<string, SituationGuidance>> = Object.freeze({
  "showcase-maze-griffin-v1": Object.freeze({
    id: "showcase-maze-griffin-v1",
    situations: Object.freeze(["showcase-maze-griffin-complete-v1"] as SituationId[]),
    // Owner final authorization 2026-11-07, session 01a1b479: one exact showcase attempt.
    status: "approved",
    approvedSha256: "7f3203b954001d9e302b154cc77423cdb8fe36f63e4434c7a9ac7fc4a33d2166",
    provenance: "Showcase-only phase plan drafted by the implementation agent (2026-11-07) at the owner's request, followed by the unchanged, owner-approved b-post-combined-v4 text. Prompt-tuned demonstration; excluded from the A/B/C evaluation.",
    text: `${SHOWCASE_PHASE_PLAN}\n\n${B_POST_COMBINED_V4}`,
  }),
  "c-post-v4-inventory-hint-v1": Object.freeze({
    id: "c-post-v4-inventory-hint-v1",
    situations: Object.freeze(["griffin-prepared-return-v1"] as SituationId[]),
    // Owner approval 2026-11-06: this exact text (declaration r11). Paid C3 still needs separate run authorization.
    status: "approved",
    approvedSha256: "d750861ba30255fd10e139532c8394e2e7dd44237e1ba50dc3ee4e0d311afa83",
    provenance: "b-post-combined-v4 (unchanged) + an owner-requested C-specific inventory/nest hint drafted by the implementation agent (2026-11-06), requested after C1 (Pilot-34) was run; C-specific tuning, not a B-to-C transfer.",
    text: `${B_POST_COMBINED_V4}\n\n${C_INVENTORY_NEST_HINT}`,
  }),
  "b-post-combined-v4": Object.freeze({
    id: "b-post-combined-v4",
    // Owner instruction 2026-11-06: C3 (post-tuned C) uses this exact frozen text as a B-to-C transfer.
    // Text and approval hash unchanged; paid C runs stay locked by SITUATION_C_PAID_APPROVED.
    situations: Object.freeze(["griffin-unprepared-v1", "griffin-unprepared-return-v1", "griffin-prepared-return-v1"] as SituationId[]),
    // Owner approval 2026-11-06 ("Unlock V4"): this exact text; supplementary B trial, not a replacement for Pilot-32.
    status: "approved",
    approvedSha256: "1287454219c46dbce31bc5ea0beaee68cdb7addb55b957f2ca57d899ef1bdf34",
    provenance: "Owner-directed revision of b-post-combined-v3, drafted by the implementation agent (2026-11-06); owner-written post-hoc B tuning; supplementary trial; pending review and owner approval.",
    text: B_POST_COMBINED_V4,
  }),
  "b-post-combined-v3": Object.freeze({
    id: "b-post-combined-v3",
    situations: Object.freeze(["griffin-unprepared-v1", "griffin-unprepared-return-v1"] as SituationId[]),
    status: "proposed",
    provenance: "Owner-directed consolidation of b-post-a-transfer-v1 and b-post-combat-v2, drafted by the implementation agent to the owner's outline (2026-11-06); post-hoc B tuning; pending review and owner approval.",
    text: B_POST_COMBINED_V3,
  }),
  "b-post-combat-v2": Object.freeze({
    id: "b-post-combat-v2",
    situations: Object.freeze(["griffin-unprepared-v1", "griffin-unprepared-return-v1"] as SituationId[]),
    status: "proposed",
    provenance: "Owner-authored text pasted 2026-11-06, stored verbatim; written after Pilot-31 was known; pending owner approval.",
    text: B_POST_COMBAT_V2,
  }),
  "b-post-a-transfer-v1": Object.freeze({
    id: "b-post-a-transfer-v1",
    // Owner approval 2026-11-06: this exact text, on both B scenarios (declaration r8 runs it on the return scenario).
    situations: Object.freeze(["griffin-unprepared-v1", "griffin-unprepared-return-v1"] as SituationId[]),
    status: "approved",
    approvedSha256: "60a0a01357e68e2f44f0ecd9d0d0ebb41bfaab04c5c3ec78cae62c760c265263",
    provenance: "Drafted by the Claude Code implementation agent from the Situation A heuristic baseline (baseline-maze-heuristic-v2) after Pilot-31 was run and read; pending owner review.",
    text: B_POST_A_TRANSFER_V1,
  }),
  "griffin-b-post-v1": Object.freeze({
    id: "griffin-b-post-v1",
    situations: Object.freeze(["griffin-unprepared-v1"] as SituationId[]),
    status: "proposed",
    provenance: "Draft by the Claude Code implementation agent from game source and the offline witness; pending owner review.",
    text: GRIFFIN_B_POST_V1,
  }),
});

export function guidance(id: string): SituationGuidance {
  const g = SITUATION_GUIDANCE[id];
  if (!g) throw Error(`Unknown guidance ${id} (known: ${Object.keys(SITUATION_GUIDANCE).join(", ")}).`);
  return g;
}

export { guidanceBlock, guidanceId } from "./llm.js";

/** Approved for paid runs: status approved and the text unchanged since approval. */
export function guidanceApproved(g: SituationGuidance): boolean {
  return g.status === "approved" && g.approvedSha256 === guidanceHash(g.text);
}

export const guidanceHash = (text: string) => createHash("sha256").update(text).digest("hex");
