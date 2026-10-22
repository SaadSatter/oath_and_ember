import { describe, it, expect } from "vitest";
import { SoundEvents } from "../src/audio/SoundEvents.js";
import { GameRoom } from "../../server/src/GameRoom.js";
import { cutscenes } from "../../../packages/shared/src/prologue.js";
import { newBridgePuzzle } from "../../../packages/shared/src/bridgePuzzle.js";
import { newGriffin } from "../../../packages/shared/src/griffin.js";
import { existsSync } from "node:fs";
import approved from "../src/audio/approvedCues.json" with { type: "json" };
import revised from "../src/audio/revisedCues.json" with { type: "json" };
import files from "../src/audio/sourceFiles.json" with { type: "json" };
type Cue = { tracks: { assetId: string }[]; variants?: string[] };
const cue = (name: string): Cue =>
  (revised.cues as Record<string, Cue>)[name] ??
  (approved as Record<string, Cue>)[name];
function pair() {
  const r = new GameRoom("ABC234", false, "FOREST_RUINS"),
    a = r.add("a"),
    b = r.add("b");
  r.select(a.playerId, "OATH");
  r.select(b.playerId, "EMBER");
  r.ready(a.playerId, true);
  r.ready(b.playerId, true);
  const w = r.state,
    s = w.players[a.playerId],
    c = w.players[b.playerId],
    audio = new SoundEvents();
  const next = (id = s.id) => {
    w.serverTick += 2;
    return audio.observe(structuredClone(w), id);
  };
  next();
  return { r, w, s, c, audio, next };
}
const names = (frame: ReturnType<SoundEvents["observe"]>) =>
  frame.shots.map((c) => c.name);
describe("accepted sound observations", () => {
  it("baselines joins, deduplicates impacts and never mutates authoritative gameplay", () => {
    const { w, s, audio, next } = pair();
    w.projectileImpacts = [
      {
        id: "old",
        x: 10,
        y: 10,
        owner: s.id,
        tick: w.serverTick,
        sceneId: w.sceneId,
      },
    ];
    audio.reset();
    expect(next().shots).toEqual([]);
    w.projectileImpacts.push({
      id: "new",
      x: 15,
      y: 10,
      owner: s.id,
      tick: w.serverTick,
      sceneId: w.sceneId,
    });
    const saved = structuredClone(w);
    expect(names(next())).toContain("Coco Fireball impact");
    expect(names(next())).not.toContain("Coco Fireball impact");
    const unchanged = { ...w, serverTick: saved.serverTick };
    expect(unchanged).toEqual(saved);
    audio.reset();
    expect(next().shots).toEqual([]);
  });
  it("plays one accepted swing and identifies Black Hole independently of generic cast", () => {
    const { w, s, c, next } = pair();
    s.combat = { kind: "sword", seq: 10, startedTick: w.serverTick, facing: 0 };
    expect(names(next())).toContain("Sieg normal sword swing");
    expect(names(next())).not.toContain("Sieg normal sword swing");
    c.combat = { kind: "cast", seq: 20, startedTick: w.serverTick, facing: 0 };
    w.blackHoles = {
      h: {
        id: "h",
        owner: c.id,
        sceneId: w.sceneId,
        x: c.x,
        y: c.y,
        vx: 0,
        vy: 0,
        remainingRange: 100,
        phase: "travel",
        startedTick: w.serverTick,
        life: 4,
        damaged: [],
      },
    };
    const n = names(next());
    expect(n).toContain("Coco Black Hole launch");
    expect(n).not.toContain("Coco Fireball cast, level 1");
    w.blackHoles.h.phase = "vortex";
    expect(next().loops.map((x) => x.name)).toContain(
      "Black Hole opens / pulls",
    );
    delete w.blackHoles.h;
    expect(next().loops).toEqual([]);
  });
  it("uses defensive sequences; HP recovery is never interpreted as a death or sword contact", () => {
    const { s, next } = pair();
    s.defensiveHit = { seq: 1, tick: 2 };
    s.hp = 90;
    expect(names(next())).toContain("Sieg Guard absorbs hit");
    s.hp = 100;
    s.movementEpoch = (s.movementEpoch ?? 0) + 1;
    expect(names(next())).toEqual([]);
  });
  it("keeps remote maps quiet and respects private discovery and funeral silence", () => {
    const { w, s, c, audio, next } = pair();
    c.sceneId = "HOUSE_INTERIOR";
    c.combat = { kind: "sword", seq: 20, startedTick: w.serverTick, facing: 0 };
    expect(names(next())).not.toContain("Sieg normal sword swing");
    s.sceneId = "HOUSE_INTERIOR";
    w.story = {
      stage: "SILENT_SHOP",
      flags: [],
      cutscene: { id: "discovery", line: 0, acks: [], since: 0 },
    };
    audio.reset();
    next(c.id);
    w.story.cutscene!.line = cutscenes.discovery.lines.findIndex(
      (l) => l.cue === "drop-bag",
    );
    expect(names(next(c.id))).toContain(
      "Coco discovers wounded Alden / drops bag",
    );
    const siegAudio = new SoundEvents();
    siegAudio.observe(structuredClone(w), s.id);
    w.story.cutscene!.line = 16;
    w.serverTick += 2;
    expect(siegAudio.observe(structuredClone(w), s.id).shots).toEqual([]);
    w.story.cutscene = { id: "funeral", line: 0, acks: [], since: 0 };
    s.combat = { kind: "sword", seq: 44, startedTick: w.serverTick, facing: 0 };
    const f = next(c.id);
    expect(f.quiet).toBe(true);
    expect(f.shots).toEqual([]);
    expect(f.loops).toEqual([]);
  });
  it("distinguishes Griffin mouth beam from Sentinel palm beam and stops on a held story scene", () => {
    const { w, s, c, audio, next } = pair();
    w.sceneId = "GRIFFIN_ENCLOSURE";
    s.sceneId = c.sceneId = w.sceneId;
    w.puzzles.griffin = {
      id: "griffin",
      physical: false,
      arcane: false,
      complete: false,
      progress: 0,
      griffin: newGriffin(),
    };
    audio.reset();
    next();
    w.puzzles.griffin.griffin!.phase = "BEAM";
    const beam = next();
    expect(beam.loops.map((c) => c.name)).toContain(
      "Griffin mouth beam active",
    );
    expect(beam.loops.map((c) => c.name)).not.toContain(
      "Ironbound Sentinel palm beam active",
    );
    w.story = {
      stage: "WIG",
      flags: [],
      cutscene: { id: "griffin-banter", line: 0, acks: [], since: 0 },
    };
    expect(next().loops).toEqual([]);
  });
  it("records puzzle and inventory edges once but not replayed receipts/revisits", () => {
    const { w, s, c, audio, next } = pair();
    w.sceneId = s.sceneId = c.sceneId = "BRIDGE_RUINS";
    w.bridgePuzzle = newBridgePuzzle();
    audio.reset();
    next();
    w.bridgePuzzle.firstGateOpen = true;
    expect(names(next())).toContain("Gate 1 opens");
    expect(names(next())).not.toContain("Gate 1 opens");
    w.inventory!.claimed.push("hedge-shears-chest");
    w.inventory!.counts.enchanted_shears = 1;
    expect(names(next())).toContain("Enchanted Shears acquired");
    w.inventory!.revision++;
    expect(names(next())).not.toContain("Enchanted Shears acquired");
  });
  it("retains all silence decisions and gives selection its own soft cue", () => {
    const silent = Object.values(approved).filter((c) => c.silent);
    expect(silent).toHaveLength(15);
    expect(silent.every((c) => c.tracks.length === 0)).toBe(true);
    // The revision never gives a protected silence a sound.
    for (const [name, cue] of Object.entries(approved))
      if (cue.silent) expect(revised.cues).not.toHaveProperty(name);
    for (const name of [
      "Role / appearance selection",
      "Select inventory item",
      "Motivation option highlight",
      "Each hero chooses why to continue",
    ] as const)
      expect(cue(name).tracks[0].assetId).toBe("uiSelect");
  });
  it("resolves every revised cue to a shipped source clip", () => {
    const known = new Set([
      ...Object.keys(files),
      ...Object.keys(revised.sources),
    ]);
    for (const [name, c] of Object.entries(revised.cues) as [
      string,
      { tracks: { assetId: string }[]; variants?: string[] },
    ][]) {
      expect(c.tracks.length, name).toBeGreaterThan(0);
      for (const id of [...c.tracks.map((t) => t.assetId), ...(c.variants ?? [])])
        expect(known.has(id), `${name}: ${id}`).toBe(true);
    }
    for (const src of Object.values(revised.sources))
      expect(
        existsSync(new URL(`../public${src.url}`, import.meta.url)),
        src.url,
      ).toBe(true);
  });
  it("plays the door only for homes and rooms, not travel between maps", () => {
    const { s, next } = pair();
    const door = "Door / stairs / map travel";
    s.sceneId = "MAIN_HOUSE";
    expect(names(next())).not.toContain(door);
    s.sceneId = "HOUSE_INTERIOR";
    expect(names(next())).toContain(door);
    s.sceneId = "HOUSE_UPPER";
    expect(names(next())).toContain(door);
    s.sceneId = "HOUSE_INTERIOR";
    next();
    s.sceneId = "MAIN_HOUSE";
    expect(names(next())).toContain(door);
    s.sceneId = "EMBERBROOK_VILLAGE";
    expect(names(next())).not.toContain(door);
  });
  it("gives each hero their own hurt voice", () => {
    const { s, c, next } = pair();
    s.hp -= 10;
    c.hp -= 10;
    const n = names(next());
    expect(n).toContain("Sieg hurt");
    expect(n).toContain("Coco hurt");
    expect(cue("Sieg hurt").variants).toContain("siegHurt1");
    expect(cue("Coco hurt").variants).toContain("cocoHurt1");
  });
  it("roars, gulps each monster and bursts with Alden's water dragon", () => {
    const { w, s, audio, next } = pair();
    w.story = {
      stage: "AMBUSH",
      flags: [],
      cutscene: { id: "rescue", line: 0, acks: [], since: 0 },
    } as unknown as typeof w.story;
    audio.reset();
    next();
    const start = w.serverTick + 2;
    w.story!.dragon = {
      start,
      end: start + 300,
      centre: { x: s.x, y: s.y },
      prey: [{ id: "m", x: s.x + 50, y: s.y, at: start + 120 }],
    };
    const rise = next();
    expect(names(rise)).toContain("Water dragon rises / roars");
    expect(rise.loops.map((l) => l.name)).toContain("Water dragon rushes");
    while (w.serverTick < start + 118) next();
    expect(names(next())).toContain("Water dragon swallows a monster");
    while (w.serverTick < start + 238) next();
    expect(names(next())).toContain("Water dragon bursts into rain");
    expect(next().loops).toEqual([]);
  });
});
