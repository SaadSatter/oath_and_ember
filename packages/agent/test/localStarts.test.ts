// Only approved S2-local/S3-local and historical S1-S3 tuning seeds.
// Suite revision 2 swapped S2 and S3: S2-local is now the Hedge Maze entrance
// and S3-local the Mirror Pond entrance. The revision 1 definitions are kept as
// S2-local-v1 (Mirror Pond) and S3-local-v1 (Hedge Maze) and tested the same way.
// Evaluator-only raw-state assertions never enter a policy's observation.
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GameRoom } from "../../../apps/server/src/GameRoom.js";
import { spawnMazeEnemies } from "../../../apps/server/src/hedgeMaze.js";
import { maps } from "../../shared/src/maps.js";
import { newMirrorPond, pondSpawn } from "../../shared/src/mirrorPond.js";
import { newHedgeMaze } from "../../shared/src/hedgeMaze.js";
import {
  AgentEnvironment,
  type EnvironmentOptions,
} from "../src/environment.js";
import { episodes, stateHash } from "../src/evaluator.js";
import { environmentFor, situation, type SituationId } from "../src/suite.js";
import { Director } from "../src/route/director.js";
import { SHRINE } from "../src/route/routeConstants.js";
import { enterLocalArea } from "../src/route/localStarts.js";
import {
  EPISODE_CAP_USD,
  runSuite,
  validatePlan,
  type ModelSetup,
} from "../src/harness.js";
import { SpendLedger } from "../src/ledger.js";
import type { Gateway } from "../src/budget.js";
import type { Observation } from "../src/types.js";
import { verifyTrace, type TraceLine } from "../src/trace.js";

const pond = { area: "Mirror Pond", scene: "MIRROR_POND", item: "vanity_mirror", direction: "west" } as const;
const maze = { area: "Hedge Maze", scene: "HEDGE_MAZE", item: "enchanted_shears", direction: "east" } as const;
const variants = [
  { id: "S2-local", parent: "S2", ...maze },
  { id: "S3-local", parent: "S3", ...pond },
  { id: "S2-local-v1", parent: "S2-v1", ...pond },
  { id: "S3-local-v1", parent: "S3-v1", ...maze },
] as const;
const presetOf = (id: SituationId) => situation(id).preset;
const dirs: string[] = [];
const scratch = () => {
  const d = mkdtempSync(join(tmpdir(), "local-starts-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function start(id: SituationId, options: EnvironmentOptions = {}) {
  let room!: GameRoom;
  const env = environmentFor(id, {
    ...options,
    room: (r) => {
      room = r;
      options.room?.(r);
    },
  });
  return { env, room: () => room };
}

for (const v of variants)
  describe(v.id, () => {
    for (const seed of [0, 1])
      it(`has a deterministic pristine start and fresh agent memories at tuning seed ${seed}`, async () => {
        const { env, room } = start(v.id);
        const first = await env.reset(seed);
        const world = structuredClone(room().state);
        const obs = {
          sieg: await env.observe("sieg"),
          coco: await env.observe("coco"),
        };
        expect(stateHash(world)).toBe(first.startHash);
        expect(world.sceneId).toBe(v.scene);
        expect(first.episode).toMatch(new RegExp(`^${presetOf(v.id)}-${seed}-`));
        expect(first.tick).toBeGreaterThan(221);
        expect(episodes[presetOf(v.id)].success(world)).toBe(false);
        expect(world.inventory!.counts[v.item] ?? 0).toBe(0);
        expect(world.story!.stage).toBe("WIG");
        expect(world.story!.flags).toContain("chapter0.goddess-meet");
        const heroes = Object.values(world.players);
        for (const [i, p] of heroes.entries()) {
          const at =
            v.scene === "MIRROR_POND"
              ? pondSpawn(p.role)
              : {
                  x: maps.HEDGE_MAZE.spawn.x + i * 50,
                  y: maps.HEDGE_MAZE.spawn.y,
                };
          expect({ x: p.x, y: p.y }).toEqual(at);
          expect(p.hp).toBe(100);
          expect(p.sceneId).toBe(v.scene);
        }
        if (v.scene === "MIRROR_POND") {
          expect(world.puzzles.mirrorPond.pond).toEqual(newMirrorPond());
          expect(Object.keys(world.enemies)).toHaveLength(0);
        } else {
          expect(world.puzzles.hedgeMaze.maze).toEqual(newHedgeMaze());
          expect(world.puzzles.hedgeGate.complete).toBe(false);
          expect(world.enemies).toEqual(spawnMazeEnemies());
          expect(world.story!.flags).not.toContain("chapter0.maze-banter");
        }
        for (const o of Object.values(obs)) {
          expect(o.area.name).toBe(v.area);
          expect(o.feedback).toEqual([]);
          expect(o.messages).toEqual([]);
          expect(o.dialogueLog).toEqual([]);
          expect(o.discovered.areas).toEqual([v.area]);
          expect(o.inventory.items.some((i) => i.id === v.item)).toBe(false);
        }
        expect(await env.outcome()).toMatchObject({
          status: "ongoing",
          ticks: 0,
          seconds: 0,
          decisions: { sieg: 0, coco: 0 },
          invalidActions: { sieg: 0, coco: 0 },
          modelCalls: { sieg: 0, coco: 0 },
        });
        const slots = (
          env as unknown as {
            slots: Record<
              string,
              {
                running?: unknown;
                submitted?: unknown;
                decisions: number;
                memory: { messagesSent: number };
              }
            >;
          }
        ).slots;
        for (const slot of Object.values(slots)) {
          expect(slot.running).toBeUndefined();
          expect(slot.submitted).toBeUndefined();
          expect(slot.decisions).toBe(0);
          expect(slot.memory.messagesSent).toBe(0);
        }
        expect(await env.reset(seed)).toEqual(first);
        expect(room().state).toEqual(world);
        expect(await env.observe("sieg")).toEqual(obs.sieg);
        expect(await env.observe("coco")).toEqual(obs.coco);
      });

    it("preserves exactly the authoritative result of opening plus ordinary travel", async () => {
      const actual = start(v.id);
      const reset = await actual.env.reset(0);
      let atEnd!: string;
      const env = new AgentEnvironment({
        preset: presetOf(v.parent),
        room: (r) => {
          referenceRoom = r;
        },
        prefix: {
          name: "independent tuning-only entry reference",
          run: async (e) => {
            await situation(v.parent).prefix!.run(e);
            const d = new Director({ env: e });
            const exit = SHRINE[v.direction];
            await d.go({
              sieg: {
                to: {
                  x: exit.x + (v.direction === "west" ? 0.5 : -0.4),
                  y: exit.y,
                },
                opts: { tolerance: 0.6 },
              },
            });
            await d.both({ type: "interact" }, { type: "wait", ticks: 1 });
            atEnd = stateHash(referenceRoom.state);
          },
        },
      });
      let referenceRoom!: GameRoom;
      await env.reset(0);
      expect(stateHash(referenceRoom.state)).toBe(atEnd);
      expect(referenceRoom.state).toEqual(actual.room().state);
      expect(atEnd).toBe(reset.startHash);
      expect(episodes[presetOf(v.id)].success).toBe(episodes[presetOf(v.parent)].success);
      expect(episodes[presetOf(v.id)].limits).toBe(episodes[presetOf(v.parent)].limits);
      expect(EPISODE_CAP_USD[v.id]).toBe(EPISODE_CAP_USD[v.parent]);
    });

    it("clears deliberately sent preparation messages and uses no actions after entry", async () => {
      let room!: GameRoom;
      const afterEntry: string[] = [];
      const env = new AgentEnvironment({
        preset: presetOf(v.id),
        room: (r) => {
          room = r;
        },
        prefix: {
          name: "local entry with disposable preparation messages",
          run: async (e) => {
            await Promise.all([
              e.step("sieg", {
                type: "message",
                text: "PREPARATION-ONLY-SIEG",
              }),
              e.step("coco", {
                type: "message",
                text: "PREPARATION-ONLY-COCO",
              }),
            ]);
            const step = e.step.bind(e);
            e.step = async (hero, action) => {
              if (room.state.sceneId === v.scene) afterEntry.push(action.type);
              return step(hero, action);
            };
            await situation(v.id).prefix!.run(e);
          },
        },
      });
      await env.reset(1);
      expect(afterEntry).toEqual([]);
      for (const hero of ["sieg", "coco"] as const) {
        const o = await env.observe(hero);
        expect(o.messages).toEqual([]);
        expect(o.feedback).toEqual([]);
        expect(JSON.stringify(o)).not.toContain("PREPARATION-ONLY");
      }
    });

    it("leaves ordinary exits and cross-area travel available", async () => {
      const { env } = start(v.id);
      await env.reset(0);
      const d = new Director({ env });
      // The ordinary server has a one-second travel cooldown; do not bypass it.
      await d.wait(65);
      if ((await env.observe("sieg")).dialogue) await d.dialogue();
      // Arrival dialogue interrupts a wait; wait again after it finishes.
      await d.wait(65);
      const exit = (await env.observe("sieg")).visible.find(
        (x) => x.kind === "exit" && /return/i.test(x.name),
      );
      expect(exit).toBeDefined();
      await d.go({
        sieg: { to: { x: maps[v.scene].points.back.x / 32, y: maps[v.scene].points.back.y / 32 }, opts: { tolerance: 0.4 } },
        coco: { to: { x: maps[v.scene].points.back.x / 32, y: maps[v.scene].points.back.y / 32 }, opts: { tolerance: 0.4 } },
      });
      await d.both({ type: "interact" }, { type: "wait", ticks: 1 });
      expect((await env.observe("sieg")).area.name).toBe("Goddess Shrine");
      expect((await env.observe("coco")).area.name).toBe("Goddess Shrine");
      await d.wait(65);
      const other = v.area === "Mirror Pond" ? "Hedge Maze" : "Mirror Pond";
      await enterLocalArea(env, other);
      expect((await env.observe("sieg")).area.name).toBe(other);
      expect((await env.observe("coco")).area.name).toBe(other);
      expect((await env.outcome()).status).toBe("ongoing");
    }, 30000);

    it("isolates manifests, paths, measured time and provider-labelled mock contexts", async () => {
      const root = scratch();
      const ledger = SpendLedger.open(join(root, "mock-ledger.json"));
      const hashes: string[] = [];
      const initialObservations: Observation[] = [];
      try {
        for (const provider of ["anthropic", "openai"]) {
          const users: Record<string, any>[] = [];
          const gateway: Gateway = {
            label: `offline-fixture:${provider}`,
            worstCaseUsd: () => 0,
            complete: async (_system, user) => {
              users.push(JSON.parse(user));
              return {
                text: '{"notes":"private new note","actions":[{"type":"wait","ticks":1}]}',
                tokens: { input: 0, output: 0 },
                costUsd: 0,
              };
            },
          };
          const outDir = join(root, provider);
          const controller = new AbortController();
          let steps = 0;
          const [s] = await runSuite({
            player: "model-history",
            situations: [v.id],
            seeds: [0],
            gitHash: "offline-local-test",
            outDir,
            model: {
              gateway,
              manual: "PUBLIC MANUAL",
              ledger,
              stage: "pilot",
              priceSource: "offline fixture",
            },
            signal: controller.signal,
            onTrace: (line) => {
              if (line.type === "step" && ++steps === 2) controller.abort();
            },
            wallSeconds: 30,
          });
          hashes.push(s.startHash);
          expect(s.situation).toBe(v.id);
          expect(s.prefix).toBe(situation(v.id).prefix!.name);
          expect(s.gameTicks).toBeGreaterThan(0);
          const manifest = JSON.parse(
            readFileSync(join(outDir, "run.json"), "utf8"),
          );
          expect(manifest.situations).toEqual([v.id]);
          // Every record names the suite revision and the definition it played.
          expect(manifest.suiteRevision).toBe(2);
          expect(s.suiteRevision).toBe(2);
          expect(s.scenario).toMatchObject({ preset: presetOf(v.id), title: situation(v.id).title, revision: situation(v.id).revision, briefing: true });
          expect(s.scenario.tutorialId).toEqual(situation(v.id).tutorial ? expect.any(String) : null);
          expect(manifest.model.gateway).toBe(`offline-fixture:${provider}`);
          expect(readdirSync(outDir)).toContain(`${v.id}-seed0`);
          const trace = readFileSync(s.trace, "utf8")
            .trim()
            .split("\n")
            .map((l) => JSON.parse(l) as TraceLine);
          verifyTrace(trace);
          const reset = trace.find((l) => l.type === "reset")!;
          const outcome = trace.find((l) => l.type === "outcome")!;
          expect(s.startTick).toBe(reset.tick);
          expect((reset.data as any).tick).toBe(reset.tick);
          expect((outcome.data as any).outcome.ticks).toBe(s.gameTicks);
          const first = users[0];
          expect(first.your_notes).toBe("");
          expect(first.completed_actions).toEqual([]);
          expect(first.recent_rejected_actions).toEqual([]);
          expect(first.last_turn).toBeNull();
          expect(first.observation.messages).toEqual([]);
          expect(first.observation.dialogueLog).toEqual([]);
          expect(first).not.toHaveProperty("world");
          initialObservations.push(first.observation);
          const byHero = new Map(users.map((u) => [u.observation.hero, u]));
          expect([...byHero.keys()].sort()).toEqual(["Coco", "Sieg"]);
          expect(JSON.stringify(first)).not.toContain("PREPARATION-ONLY");
        }
        expect(hashes[0]).toBe(hashes[1]);
        expect(initialObservations[0]).toEqual(initialObservations[1]);
      } finally {
        ledger.close();
      }
    }, 30000);
  });

it("keeps the maze arrival's first meaningful line unread until agents act", async () => {
  const { env, room } = start("S2-local");
  await env.reset(0);
  expect(room().state.story!.flags).not.toContain("chapter0.maze-banter");
  const d = new Director({ env });
  expect(await d.untilDialogue(30)).toBe(true);
  expect((await env.observe("sieg")).dialogue?.text).toMatch(/A hedge maze/);
  expect((await env.observe("coco")).dialogue?.text).toMatch(/A hedge maze/);
  expect(room().state.story!.flags).not.toContain("chapter0.maze-banter");
});

it("keeps parent tuning start hashes and limits unchanged and distinct from local starts", async () => {
  const parents = {
    S1: "d9b2359a956db64d0a489c4367bc313523da7e617e3d8cc68e02b5ffbbac95a2",
    S2: "5397eba5c68d4770bf41e742e5ae9474a256a30f9ddd4149a6bf35592bc2c9ab",
    S3: "5397eba5c68d4770bf41e742e5ae9474a256a30f9ddd4149a6bf35592bc2c9ab",
  };
  for (const id of ["S1", "S2", "S3"] as const)
    expect((await environmentFor(id).reset(0)).startHash).toBe(parents[id]);
  // The preserved revision 1 parents start at the same (shared) state.
  for (const id of ["S2-v1", "S3-v1"] as const)
    expect((await environmentFor(id).reset(0)).startHash).toBe(parents.S2);
  for (const v of variants) {
    expect((await environmentFor(v.id).reset(0)).startHash).not.toBe(
      parents.S2,
    );
    expect(situation(v.id).heldOut).toBe(false);
    expect(() =>
      validatePlan({
        player: "baseline-quest",
        situations: [v.id],
        seeds: [0, 1],
      }),
    ).not.toThrow();
    expect(() =>
      validatePlan({
        player: "baseline-quest",
        situations: [v.id],
        seeds: [100],
      }),
    ).toThrow(/Tuning/);
  }
});
