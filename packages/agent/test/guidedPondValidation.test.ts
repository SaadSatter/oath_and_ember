// Deterministic validation of the guided Mirror Pond walkthrough's paths and
// spike timing (docs/midterm/GUIDED_POND_BASELINE.md). Offline; S3-local tuning
// seeds 0/1 only. Evaluator-side test: it reads room state to build the real
// collision walls; no player ever sees any of this.
import { describe, expect, it } from "vitest";
import { environmentFor } from "../src/suite.js";
import { Director } from "../src/route/director.js";
import { mirrorPond } from "../src/route/fullQuest.js";
import { POND_GUIDE, POND_MEASURED } from "../src/policies/guidedPondInstructions.js";
import type { Observation, PlayerId } from "../src/types.js";
import { collisionRects, maps } from "../../shared/src/maps.js";
import { constrainMotion, flightWalls } from "../../shared/src/movement.js";
import { DT, SPEED } from "../../shared/src/constants.js";
import type { Rect, World } from "../../shared/src/gameTypes.js";

type Pt = readonly [number, number];
const TILE = 32;
const map = maps.MIRROR_POND;

/** The walls the server's movement step uses for this hero now (GameRoom.stepMovement). */
function wallsFor(w: World, role: "OATH" | "EMBER", flying: boolean): Rect[] {
  return flightWalls(collisionRects("MIRROR_POND", w.puzzles as never, w.pushableOffsets, w.bridgePuzzle, w.players, w.serverTick, role), flying);
}

/**
 * Walks the hero's box along straight segments at the real per-tick step
 * (SPEED * DT at normal speed) through the shared constrainMotion, the same
 * sweep the server's move() uses. Fails at the first tick the walls change
 * the intended motion.
 */
export function sweep(points: readonly Pt[], walls: Rect[]) {
  let pos = { x: points[0][0] * TILE, y: points[0][1] * TILE };
  let ticks = 0;
  for (const [tx, ty] of points.slice(1)) {
    const target = { x: tx * TILE, y: ty * TILE };
    for (;;) {
      const dx = target.x - pos.x, dy = target.y - pos.y, dist = Math.hypot(dx, dy);
      if (dist < 1e-9) break;
      const step = Math.min(dist, SPEED * DT);
      const delta = { x: (dx / dist) * step, y: (dy / dist) * step };
      const next = constrainMotion(pos, delta, map, walls);
      if (Math.abs(next.x - pos.x - delta.x) > 1e-6 || Math.abs(next.y - pos.y - delta.y) > 1e-6)
        return { ok: false as const, ticks, blockedAt: [pos.x / TILE, pos.y / TILE], toward: [tx, ty] };
      pos = next;
      ticks++;
    }
  }
  return { ok: true as const, ticks, blockedAt: null, toward: null };
}

/** Same, but only with the eight move directions: diagonal then straight, or straight then diagonal. */
function octantRoutes(points: readonly Pt[]) {
  const routes: Pt[][] = [[points[0]], [points[0]]];
  for (const [i, [tx, ty]] of points.slice(1).entries()) {
    const [fx, fy] = points[i];
    const dx = tx - fx, dy = ty - fy, d = Math.min(Math.abs(dx), Math.abs(dy));
    const diag: Pt = [fx + Math.sign(dx) * d, fy + Math.sign(dy) * d];
    const axisFirst: Pt = Math.abs(dx) > Math.abs(dy) ? [tx - Math.sign(dx) * d, fy] : [fx, ty - Math.sign(dy) * d];
    routes[0].push(diag, [tx, ty]);
    routes[1].push(axisFirst, [tx, ty]);
  }
  return routes;
}

const same = (a: Pt, b: { x: number; y: number }) => a[0] === b.x && a[1] === b.y;

for (const seed of [0, 1]) {
  it(`guide paths are traversable with the game's collision walls at the moment each leg starts (seed ${seed})`, async () => {
    const env = environmentFor("S3-local"); await env.reset(seed);
    const room = (env as any).room;
    const results: { leg: string; hero: PlayerId; flying: boolean; straight: ReturnType<typeof sweep>; octant: boolean[] }[] = [];
    const check = (leg: string, hero: PlayerId, points: readonly Pt[], flying: boolean) => {
      const w = room.state as World;
      const walls = wallsFor(w, hero === "sieg" ? "OATH" : "EMBER", flying);
      results.push({ leg, hero, flying, straight: sweep(points, walls), octant: octantRoutes(points).map((r) => sweep(r, walls).ok) });
    };
    const g = POND_GUIDE;
    // Legs whose first point is where the previous guide leg ended.
    const legs: { hero: PlayerId; when: Pt; leg: string; points: readonly Pt[]; flying: boolean }[] = [
      { hero: "coco", when: [44, 31.6], leg: "Coco culvert", points: [g.start.coco, ...g.cocoCulvert], flying: true },
      { hero: "sieg", when: g.spikeMouth, leg: "Sieg start -> spike mouth", points: [g.start.sieg, g.spikeMouth], flying: false },
      { hero: "coco", when: g.cocoA1toA2.at(-1)!, leg: "Coco A1 -> A2 (walk)", points: [g.mirrors[0].pad, ...g.cocoA1toA2], flying: false },
      { hero: "coco", when: g.cocoA2toA3.at(-1)!, leg: "Coco A2 -> A3", points: [g.mirrors[1].pad, ...g.cocoA2toA3], flying: true },
      { hero: "coco", when: g.cocoA3toA4.at(-1)!, leg: "Coco A3 -> A4", points: [g.mirrors[2].pad, ...g.cocoA3toA4], flying: true },
      { hero: "coco", when: g.cocoA4toChest.at(-1)!, leg: "Coco A4 -> chest", points: [g.mirrors[3].pad, ...g.cocoA4toChest], flying: true },
      { hero: "sieg", when: g.mirrors[1].approach[0], leg: "Sieg M1 leave -> M2 approach", points: [g.mirrors[0].leave.at(-1)!, ...g.mirrors[1].approach], flying: false },
      { hero: "sieg", when: g.mirrors[2].approach[0], leg: "Sieg M2 leave -> M3 approach", points: [g.mirrors[1].leave.at(-1)!, ...g.mirrors[2].approach], flying: false },
      { hero: "sieg", when: g.mirrors[3].approach[0], leg: "Sieg M3 leave -> M4 approach", points: [g.mirrors[2].leave.at(-1)!, ...g.mirrors[3].approach], flying: false },
      { hero: "sieg", when: g.siegToSanctuary[0], leg: "Sieg M4 leave -> sanctuary", points: [g.mirrors[3].leave.at(-1)!, ...g.siegToSanctuary], flying: false },
    ];
    const pending = new Set(legs);
    const done = Symbol("objective");
    class Probe extends Director {
      async go(...args: Parameters<Director["go"]>) {
        for (const l of [...pending]) {
          const t = args[0][l.hero]?.to;
          if (t && same(l.when, t)) {
            // Coco's flight state is the route's own at that moment.
            if (l.hero === "coco") {
              const coco = Object.values(room.state.players as World["players"]).find((p) => p.role === "EMBER")!;
              expect((coco.flightRemaining ?? 0) > 0, `${l.leg}: Coco flying`).toBe(l.flying);
              // "Pads are safe ground": after her earlier flight ran out on a pad, she is still on it.
              if (l.leg === "Coco A3 -> A4" || l.leg === "Coco A4 -> chest")
                expect(Math.hypot(coco.x / TILE - l.points[0][0], coco.y / TILE - l.points[0][1]), `${l.leg}: Coco still on her pad`).toBeLessThan(0.3);
            }
            check(l.leg, l.hero, l.points, l.flying);
            pending.delete(l);
          }
        }
        // The spike crossing ends west of the columns; its walk to M1 is checked from where Sieg stands.
        if (args[0].sieg?.to && same(g.mirrors[0].approach[0], args[0].sieg.to) && !results.some((r) => r.leg.startsWith("Sieg after spikes"))) {
          const me = (await this.env.observe("sieg")).self;
          check("Sieg after spikes -> M1 approach", "sieg", [[me.x, me.y], ...g.mirrors[0].approach], false);
        }
        return super.go(...args);
      }
      async both(...args: Parameters<Director["both"]>) {
        const r = await super.both(...args);
        if ((await this.env.outcome()).status === "success") throw done;
        return r;
      }
    }
    // The culvert and the walk to the spike mouth start at reset.
    check("Coco culvert", "coco", [g.start.coco, ...g.cocoCulvert], true);
    check("Sieg start -> spike mouth", "sieg", [g.start.sieg, g.spikeMouth], false);
    for (const l of [...pending]) if (l.leg === "Coco culvert" || l.leg.startsWith("Sieg start")) pending.delete(l);
    await expect(mirrorPond(new Probe({ env }))).rejects.toBe(done);
    expect([...pending].map((l) => l.leg)).toEqual([]);
    expect(results).toHaveLength(11);
    for (const r of results) {
      expect(r.straight, r.leg).toMatchObject({ ok: true });
      // A player moves in eight directions; at least one octant split must also be clear.
      expect(r.octant.some(Boolean), `${r.leg}: an eight-direction split`).toBe(true);
    }
    const culvert = results.find((r) => r.leg === "Coco culvert")!;
    expect(culvert.straight.ticks).toBe(POND_MEASURED.culvertFlightTicks);
    expect(culvert.straight.ticks * DT).toBeLessThan(20); // within the manual's 20 s Flight
    // (44,31.6) -> (35,31) flown due west first clips the culvert wall; the guide says diagonal first.
    expect(culvert.octant).toEqual([true, false]);
    const w = room.state as World, eWalls = wallsFor(w, "EMBER", true);
    expect(sweep([[44, 31.6], g.culvertDiagonal, [35, 31]], eWalls)).toMatchObject({ ok: true });
    expect(sweep([[44, 31.6], [35.6, 31.6], [35, 31]], eWalls)).toMatchObject({ ok: false });
    expect(g.culvertDiagonal).toEqual([44 - 0.6, 31]); // the exact diagonal (|dy| = 0.6) of that segment
    for (const r of results.filter((r) => r !== culvert)) expect(r.octant, r.leg).toEqual([true, true]);
  }, 120_000);
}

const spikes = (o: Observation) =>
  Object.fromEntries(o.visible.filter((v) => v.name === "spike trap").map((v) => [v.x, v.details ?? ""])) as Record<number, string>;

/** Sieg walks to the spike mouth through the route's own navigation; Coco stays at the court. */
async function atMouth(seed: number) {
  const env = environmentFor("S3-local"); await env.reset(seed);
  const d = new Director({ env });
  await d.go({ sieg: { to: { x: POND_GUIDE.spikeMouth[0], y: POND_GUIDE.spikeMouth[1] } } });
  return { env, d };
}
async function untilEastRetracting(d: Director, max: number) {
  for (let k = 0; k < max; k++) {
    if (spikes(await d.obs("sieg"))[43.5] === "retracting") return k;
    await d.wait(1);
  }
  throw Error("east column never showed retracting");
}

for (const seed of [0, 1]) {
  it(`spike crossing: Slow Time, then Super Speed at the east column's 'retracting' crosses unharmed (seed ${seed})`, async () => {
    const { env, d } = await atMouth(seed);
    const cast = env.currentTick();
    await d.both({ type: "wait", ticks: 2 }, { type: "ability", ability: "slow_time" });
    expect((await d.obs("sieg")).self.status).toContain("time is slowed");
    const waited = await untilEastRetracting(d, 600);
    const cue = env.currentTick();
    await d.both({ type: "ability", ability: "super_speed" }, { type: "wait", ticks: 1 });
    let crossed: number | null = null, window: number | null = null, slowedThroughout = true, retracting = 0, stillRetracting = true;
    for (let k = 0; k < 600 && window === null; k++) {
      const o = await d.obs("sieg");
      expect(o.self.hp).toBe(100);
      if (!o.self.status.includes("time is slowed")) slowedThroughout = false;
      if (crossed === null && o.self.x < POND_GUIDE.spikeClearX) crossed = env.currentTick() - cue;
      // How long the cue stays visible: consecutive ticks the east column shows 'retracting'.
      if (stillRetracting && spikes(o)[43.5] === "retracting") retracting = env.currentTick() - cue + 1;
      else stillRetracting = false;
      const s = Object.values(spikes(o));
      if (s.some((p) => p === "warning" || p === "raised")) window = env.currentTick() - cue;
      if (crossed === null) await d.both({ type: "move", direction: "w", ticks: 1 }, { type: "wait", ticks: 1 });
      else await d.wait(1);
    }
    expect({ crossed, window, retracting, slowedThroughout }).toEqual({
      crossed: POND_MEASURED.crossTicks, window: POND_MEASURED.safeTicks, retracting: POND_MEASURED.cueVisibleTicks, slowedThroughout: true,
    });
    expect(crossed!).toBeLessThan(window!);
    // Slow Time (600 ticks, manual) outlasted the wait for the cue plus the crossing.
    expect(cue - cast + crossed!).toBeLessThan(600);
    expect(waited).toBeGreaterThan(0);
  }, 120_000);

  it(`spike hit: walking west at the same cue without abilities is hit; HP -8 and back at the court start (seed ${seed})`, async () => {
    const { env, d } = await atMouth(seed);
    await untilEastRetracting(d, 200);
    const cue = env.currentTick();
    let hitAt: number | null = null;
    for (let k = 0; k < 200 && hitAt === null; k++) {
      await d.both({ type: "move", direction: "w", ticks: 1 }, { type: "wait", ticks: 1 });
      const me = (await d.obs("sieg")).self;
      if (me.hp < 100) { hitAt = env.currentTick() - cue; expect(me.hp).toBe(100 - POND_MEASURED.spikeDamage); expect([me.x, me.y]).toEqual([...POND_GUIDE.start.sieg]); }
      if (me.x < POND_GUIDE.spikeClearX) break;
    }
    expect(hitAt).toBe(POND_MEASURED.walkingHitTicks);
  }, 120_000);
}
