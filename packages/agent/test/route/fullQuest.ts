// The scripted full-quest route: from the "goddess" checkpoint to
// chapter0.complete, through the five-operation interface only.
//
// What this route may use:
//   - AgentEnvironment's reset / observe / legal_actions / step / outcome
//     (through Director), and each hero's own observation;
//   - constants worked out offline from the development references
//     (scripts/*-playthrough.ts, apps/server/test/*Walkthrough.test.ts) and the
//     planning tools in scripts/midterm/route-dev/, which read engine state.
// What it never does: read or write GameRoom/World, use fixtures, teleport,
// inject items, or call a server method directly. It is a test fixture that
// proves the quest can be finished, not a player.
// Progress and failures: docs/midterm/ROUTE_LOG.md.

import { Director } from "./director.js";
import { directionTo, type Point } from "../../src/policies/navigate.js";
import type { Direction, Observation, PlayerId } from "../../src/types.js";

const SPEED = 190 / 32 / 60; // walking speed, tiles per tick

// ── Shared helpers ─────────────────────────────────────────────────────────
const has = (o: Observation, item: string) => o.inventory.items.some((i) => i.id === item);
const abilityReady = (o: Observation, name: string) => o.abilities.find((a) => a.name === name)?.state === "ready";
const flying = (o: Observation) => o.self.status.some((s) => s.startsWith("flying"));
const slowed = (o: Observation) => o.self.status.includes("time is slowed");

async function untilReady(d: Director, id: PlayerId, ability: string, maxTicks = 1800) {
  for (let t = 0; t < maxTicks; t += 10) {
    if (abilityReady(await d.obs(id), ability)) return;
    await d.wait(10);
  }
  throw Error(`${ability} never became ready for ${id}`);
}
async function use(d: Director, id: PlayerId, ability: "slow_time" | "super_speed" | "flight" | "black_hole", direction?: Direction) {
  const act = { type: "ability" as const, ability, ...(direction ? { direction } : {}) };
  return id === "sieg" ? d.both(act, { type: "wait", ticks: 2 }) : d.both({ type: "wait", ticks: 2 }, act);
}
async function press(d: Director, id: PlayerId) {
  return id === "sieg" ? d.both({ type: "interact" }, { type: "wait", ticks: 1 }) : d.both({ type: "wait", ticks: 1 }, { type: "interact" });
}
/** Walk one hero through points, steering from its own observed position. */
async function walkExact(d: Director, id: PlayerId, points: number[][], tolerance = 0.1) {
  for (const [x, y] of points)
    for (let k = 0; k < 40; k++) {
      const me = await d.self(id),
        dx = x - me.x,
        dy = y - me.y,
        dist = Math.hypot(dx, dy);
      if (dist <= tolerance) break;
      const ticks = Math.max(1, Math.min(60, Math.round(dist / SPEED)));
      const mv = { type: "move" as const, direction: directionTo(dx, dy), ticks };
      await (id === "sieg" ? d.both(mv, { type: "wait", ticks }) : d.both({ type: "wait", ticks }, mv));
    }
}
async function goVia(d: Director, id: PlayerId, points: Point[], flyingNav = false) {
  for (const p of points) await d.go({ [id]: { to: p, opts: { flying: flyingNav } } });
}

// ── Opening ────────────────────────────────────────────────────────────────
export async function opening(d: Director) {
  await d.untilDialogue();
  await d.dialogue();
  d.note("opening scene read");
}

/** Shrine exits (tiles), from maps.GODDESS_SHRINE.points. */
const SHRINE = { west: { x: 3, y: 18 }, east: { x: 37, y: 18 }, north: { x: 20, y: 2.5 }, offering: { x: 20, y: 17 } };
export async function travelFromShrine(d: Director, exit: "west" | "east" | "north", area: string) {
  const p = SHRINE[exit];
  await d.go({ sieg: { to: { x: p.x + (exit === "west" ? 0.5 : exit === "east" ? -0.4 : 0), y: p.y + (exit === "north" ? 0.5 : 0) }, opts: { tolerance: 0.6 } } });
  await press(d, "sieg");
  await d.dialogue();
  const o = await d.obs("sieg");
  if (o.area.name !== area) throw Error(`expected ${area}, at ${o.area.name}`);
  d.note(`entered ${area}`);
}
async function leaveBy(d: Director, id: PlayerId) {
  await press(d, id);
  await d.dialogue();
  const o = await d.obs(id);
  if (o.area.name !== "Goddess Shrine") throw Error(`expected the shrine, at ${o.area.name}`);
  d.note("back at the shrine");
}

// ── Hedge Maze: shears ─────────────────────────────────────────────────────
// Turning points from scripts/midterm/route-dev/legs.ts on HEDGE_MAZE, with the
// bush burned and the cow parked where Black Hole leaves it (about 23.8, 25).
export async function hedgeMaze(d: Director) {
  // Clear the guards on the way in (policies/combat.ts, observation only).
  for (const wp of [{ x: 10, y: 34.5 }, { x: 16.5, y: 34.5 }]) {
    await d.go({ sieg: { to: { x: wp.x + 1, y: wp.y } }, coco: { to: wp } });
    await d.fight({ sieg: { radius: 10 }, coco: { radius: 10 } }, 400);
  }
  // Burn the dry hedge east of (16.5, 34.5) if the fight has not already.
  await d.go({ coco: { to: { x: 16.5, y: 34.5 } } });
  if ((await d.obs("coco")).visible.some((v) => v.name.startsWith("FIREBALL · dry hedge"))) {
    await d.both({ type: "wait", ticks: 2 }, { type: "attack", direction: "e" });
    await d.wait(60);
  }
  await d.fight({ sieg: { radius: 10 }, coco: { radius: 10 } }, 400);
  // Black Hole pulls the cow into its bay.
  await d.go({ coco: { to: { x: 20.5, y: 34.5 } }, sieg: { to: { x: 17.5, y: 34.5 } } });
  await d.go({ coco: { to: { x: 20.5, y: 25.5 } } });
  await use(d, "coco", "black_hole", "e");
  await d.wait(300);
  d.note("cow pulled into the bay");
  // Wolf chase: Sieg enters the wolf's corridor; Slow Time + Super Speed; E when the panel offers the wolf.
  const aroundCow = [{ x: 20.5, y: 27.5 }, { x: 21.5, y: 27.5 }, { x: 21.5, y: 30.5 }, { x: 27.5, y: 30.5 }];
  await goVia(d, "coco", [...aroundCow, { x: 27.5, y: 19.5 }, { x: 32.5, y: 19.5 }]);
  await goVia(d, "sieg", [{ x: 20.5, y: 34.5 }, { x: 20.5, y: 27.5 }, ...aroundCow.slice(1), { x: 27.5, y: 15.5 }, { x: 11.5, y: 15.5 }, { x: 11.5, y: 7.5 }, { x: 19.5, y: 7.5 }]);
  const corridor = [{ x: 4, y: 4.5 }, { x: 19.5, y: 4.5 }, { x: 34, y: 4.5 }];
  for (let attempt = 0; attempt < 4 && !has(await d.obs("sieg"), "hedge_gate_key"); attempt++) {
    await untilReady(d, "coco", "Slow Time");
    await untilReady(d, "sieg", "Super Speed");
    await use(d, "coco", "slow_time");
    await use(d, "sieg", "super_speed");
    let last: Point = corridor[1],
      sweep = 0;
    for (let i = 0; i < 240; i++) {
      const s = await d.obs("sieg");
      if (has(s, "hedge_gate_key")) break;
      if (!s.self.status.some((x) => x.startsWith("super speed"))) break;
      if (s.inventory.nearbyTarget && /wolf/i.test(s.inventory.nearbyTarget.name)) {
        await press(d, "sieg");
        continue;
      }
      const wolf = s.visible.find((v) => v.name.startsWith("FOREST WOLF"));
      if (wolf) last = { x: wolf.x, y: wolf.y };
      else if (Math.hypot(last.x - s.self.x, last.y - s.self.y) < 0.6) last = corridor[(sweep += 2) % 3];
      const { planStep } = await import("../../src/policies/navigate.js");
      const st = planStep(s, last, { tolerance: 0.4, maxTicks: 4 });
      if (st.kind === "move") await d.both({ type: "move", direction: st.direction, ticks: st.ticks }, { type: "wait", ticks: st.ticks });
      else await d.wait(2);
    }
  }
  if (!has(await d.obs("sieg"), "hedge_gate_key")) throw Error("no hedge gate key");
  d.note("Sieg took the key from the wolf");
  // Gate (Sieg, E uses the key) and chest (Coco).
  // The wolf can be caught in its top corridor (row 4.5) or the row-12.5 lane;
  // both run east to the gate column (legs.ts).
  const caughtAt = await d.self("sieg");
  await goVia(d, "sieg", caughtAt.y < 8.5 ? [{ x: 39.5, y: 4.5 }, { x: 39.5, y: 14.5 }] : [{ x: caughtAt.x, y: 12.5 }, { x: 39.5, y: 12.5 }, { x: 39.5, y: 14.5 }]);
  await goVia(d, "coco", [{ x: 33.5, y: 18.5 }, { x: 39.5, y: 18.5 }, { x: 39.5, y: 15.8 }]);
  await press(d, "sieg");
  await goVia(d, "coco", [{ x: 39.5, y: 15.5 }, { x: 44.5, y: 15.5 }, { x: 44.5, y: 6.5 }]);
  await press(d, "coco");
  await d.wait(60);
  await d.dialogue();
  if (!has(await d.obs("coco"), "enchanted_shears")) throw Error("no shears");
  d.note("Coco took the Enchanted Shears");
  // Coco walks out; travel moves the whole party.
  await goVia(d, "coco", [{ x: 42.5, y: 6.5 }, { x: 42.5, y: 12.5 }, { x: 26.5, y: 12.5 }, { x: 26.5, y: 27.5 }, { x: 24.5, y: 27.5 }, { x: 24.5, y: 30.5 }, { x: 20.5, y: 30.5 }, { x: 20.5, y: 32.5 }, { x: 4.5, y: 32.5 }, { x: 4.2, y: 34 }]);
  await leaveBy(d, "coco");
}

// ── Mirror Pond: vanity mirror ─────────────────────────────────────────────
// POND_PLAN: per mirror, Sieg's walks and push lengths from
// scripts/midterm/route-dev/pond-plan.ts (exact 4 px paths with the hero's
// ±13 px box, the mirror at the angle it has at that point; one push tick turns
// a mirror 1.5°). Phases: solve, rest, leave.
const POND_PLAN: { phase: string; walk?: number[][]; push?: number; to?: number }[][] = [[{"phase":"solve","walk":[[38.125,15.5],[37.25,14.625],[37.25,9.25],[37,9]],"push":45,"to":157.5},{"phase":"rest","walk":[[37,11],[36.5,11.5]],"push":29,"to":294},{"phase":"rest","walk":[[36.5,11.125],[38.125,9.5],[39.5,9.5]],"push":16,"to":270},{"phase":"leave","walk":[[38.875,9.5],[38.75,9.375],[38.375,9.375],[36.5,7.5]]}],[{"phase":"solve","walk":[[29.5,5.5],[29,5]],"push":45,"to":67.5},{"phase":"rest","walk":[[27,5],[26.5,4.5]],"push":29,"to":24},{"phase":"rest","walk":[[23.5,4.5]],"push":16,"to":360},{"phase":"leave","walk":[[23.5,5.125],[23.375,5.25],[23.375,5.625],[22.5,6.5]]}],[{"phase":"solve","walk":[[5.5,14],[6.5,15]],"push":45,"to":22.5},{"phase":"rest","walk":[[6.5,16.5],[7.5,17.5]],"push":29,"to":66},{"phase":"rest","walk":[[7.5,17.125],[5.875,15.5],[4.5,15.5]],"push":16,"to":90},{"phase":"leave","walk":[[4.5,21.5],[5.5,22.5]]}],[{"phase":"solve","walk":[[19,29]],"push":45,"to":292.5},{"phase":"rest","walk":[[21,29],[21.5,28.5]],"push":29,"to":156},{"phase":"rest","walk":[[22.5,28.5]],"push":16,"to":180},{"phase":"leave","walk":[[26.5,28.5],[27.5,29.5]]}]];
const MIRROR = [{ x: 38, y: 12 }, { x: 26, y: 6 }, { x: 6, y: 18 }, { x: 22, y: 30 }];
const TARGET = [157.5, 67.5, 22.5, 112.5],
  REST = [90, 0, 90, 0];
const PAD = [{ x: 28, y: 12 }, { x: 26, y: 12 }, { x: 16, y: 18 }, { x: 22, y: 25 }];
const SHOT: Direction[] = ["e", "n", "w", "s"];
const TO_ARRIVAL: Point[][] = [
  [{ x: 38.5, y: 25.5 }, { x: 38.5, y: 15.5 }],
  [{ x: 29.5, y: 7.5 }],
  [{ x: 5.5, y: 6.5 }, { x: 5.5, y: 13.5 }],
  [{ x: 5.5, y: 28.5 }, { x: 18.5, y: 28.5 }],
];
const mod180 = (a: number) => ((a % 180) + 180) % 180;
async function mirrorDeg(d: Director, i: number) {
  for (const id of ["sieg", "coco"] as PlayerId[]) {
    const m = (await d.obs(id)).visible.find((v) => v.name === `mirror M${i + 1}`);
    if (m?.details) return Number(m.details.split("°")[0]);
  }
  return NaN;
}
async function mirrorOff(d: Director, i: number, target: number) {
  const e = Math.abs(mod180(await mirrorDeg(d, i)) - mod180(target));
  return Math.min(e, 180 - e);
}
async function pushHere(d: Director, i: number, ticks: number) {
  const me = await d.self("sieg");
  await d.both({ type: "move", direction: directionTo(MIRROR[i].x - me.x, MIRROR[i].y - me.y), ticks: 1 }, { type: "wait", ticks: 1 });
  for (let left = ticks; left > 0; left -= 60) {
    const t = Math.min(60, left);
    await d.both({ type: "ability", ability: "push", ticks: t }, { type: "wait", ticks: t });
  }
}
async function turnMirror(d: Director, i: number, phase: "solve" | "rest", target: number) {
  let dir = 0;
  for (const step of POND_PLAN[i].filter((s) => s.phase === phase)) {
    await walkExact(d, "sieg", step.walk!);
    const before = await mirrorDeg(d, i);
    await pushHere(d, i, step.push!);
    const change = ((((await mirrorDeg(d, i)) - before) % 360) + 540) % 360 - 180;
    if (Math.abs(change) > 0.5) dir = Math.sign(change);
  }
  // Closed-loop correction from the drawn angle.
  for (let k = 0; k < 3 && dir && (await mirrorOff(d, i, target)) > 0.05; k++) {
    const a = mod180(await mirrorDeg(d, i)),
      t = mod180(target);
    await pushHere(d, i, Math.max(1, Math.round((dir > 0 ? mod180(t - a) : mod180(a - t)) / 1.5)));
  }
  d.note(`M${i + 1} ${phase}: ${await mirrorDeg(d, i)}° (off ${await mirrorOff(d, i, target)}°)`);
}
export async function mirrorPond(d: Director) {
  // Coco flies through the culvert to the first island.
  await use(d, "coco", "flight");
  await goVia(d, "coco", [{ x: 44, y: 31.6 }, { x: 35, y: 31 }, { x: 35, y: 27 }, { x: 28, y: 12 }], true);
  // Sieg crosses the spikes: wait at the mouth for the east column to retract,
  // then Slow Time (spikes at 20%) and Super Speed.
  let crossed = false;
  for (let attempt = 0; attempt < 6 && !crossed; attempt++) {
    await untilReady(d, "coco", "Slow Time");
    await untilReady(d, "sieg", "Super Speed");
    await d.go({ sieg: { to: { x: 45, y: 26 } } });
    for (let k = 0; k < 120; k++) {
      const spikes = (await d.obs("sieg")).visible.filter((v) => v.name === "spike trap").sort((a, b) => a.x - b.x);
      if (spikes.length === 4 && spikes[3].details === "retracting") break;
      await d.wait(2);
    }
    await use(d, "coco", "slow_time");
    await use(d, "sieg", "super_speed");
    for (let k = 0; k < 12 && (await d.self("sieg")).x >= 37; k++) await d.both({ type: "move", direction: "w", ticks: 8 }, { type: "wait", ticks: 8 });
    crossed = (await d.self("sieg")).x < 37.5;
    d.note(`spike crossing attempt ${attempt + 1}: ${crossed ? "crossed" : "reset"}`);
  }
  if (!crossed) throw Error("Sieg could not cross the spikes");
  for (let i = 0; i < 4; i++) {
    for (const wp of TO_ARRIVAL[i]) await d.go({ sieg: { to: wp } });
    await turnMirror(d, i, "solve", TARGET[i]);
    if (i >= 2) {
      await untilReady(d, "coco", "Flight");
      await use(d, "coco", "flight");
    }
    await d.go({ coco: { to: PAD[i], opts: { tolerance: 0.12, flying: true } } });
    // Slow Time slows fireballs to 20%: let it end before firing.
    for (let k = 0; k < 90 && slowed(await d.obs("coco")); k++) await d.wait(10);
    await d.both({ type: "wait", ticks: 2 }, { type: "attack", direction: SHOT[i] });
    await d.wait(150);
    d.note(`fired from pad A${i + 1}`);
    await turnMirror(d, i, "rest", REST[i]);
    await walkExact(d, "sieg", POND_PLAN[i].find((s) => s.phase === "leave")!.walk!);
  }
  // The sanctuary rises only when all four flames are lit; its chest is the check.
  await goVia(d, "sieg", [{ x: 27.5, y: 21.5 }, { x: 24.5, y: 20.5 }]);
  const c = await d.obs("coco");
  if (!flying(c)) {
    await untilReady(d, "coco", "Flight");
    await use(d, "coco", "flight");
  }
  await d.go({ coco: { to: { x: 24, y: 19.5 }, opts: { flying: true, tolerance: 0.3 } } });
  const near = (await d.obs("coco")).inventory.nearbyTarget;
  if (!near || !/Vanity Mirror/i.test(near.name)) throw Error(`no Vanity Mirror chest in reach: ${JSON.stringify(near)}`);
  await press(d, "coco");
  await d.wait(60);
  await d.dialogue();
  if (!has(await d.obs("coco"), "vanity_mirror")) throw Error("no Vanity Mirror");
  d.note("Coco took the Vanity Mirror");
  // Coco flies back through the culvert to the court exit.
  if (!flying(await d.obs("coco"))) {
    await untilReady(d, "coco", "Flight");
    await use(d, "coco", "flight");
  }
  await goVia(d, "coco", [{ x: 35, y: 27 }, { x: 35, y: 31 }, { x: 44, y: 31.6 }, { x: 46.3, y: 33.5 }], true);
  await leaveBy(d, "coco");
}
