// Suite revision 2 (owner request 2026-10-28): the complete player manual and
// the tutorial-completion briefing for both model players in the revised S2
// (Hedge Maze) and S3 (Mirror Pond) and their local starts; the S2/S3 swap;
// and the preserved revision 1 definitions. Offline: recording gateways only,
// no provider request. No held-out start (S4, F) is built or run here.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { AgentEnvironment } from "../src/environment.js";
import { defaultBudgetLimits, ModelBudget, type Completion, type Gateway } from "../src/budget.js";
import { policiesFor, validatePlan, type ModelSetup } from "../src/harness.js";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { briefingBlock, briefingId, systemPrompt } from "../src/policies/llm.js";
import {
  HISTORICAL_SITUATIONS,
  historicalSituationId,
  S2_BRIEFING,
  S2_MAZE_BRIEFING,
  S3_BRIEFING,
  situation,
  SITUATIONS,
  SUITE_REVISION,
  type SituationId,
} from "../src/suite.js";
import { episodes } from "../src/evaluator.js";
import {
  loadPlayerManual,
  MANUAL_EXCLUSIONS,
  PLAYER_MANUAL_PATH,
  TUTORIAL_BRIEFING,
  tutorialBlock,
  tutorialId,
} from "../src/playerKnowledge.js";
import { abilityNames, actionTypes, type PlayerId } from "../src/types.js";
import { startingSkills } from "../../shared/src/abilities.js";
import { blackHoleTuning } from "../../shared/src/blackHole.js";
import { fireballDamage } from "../../shared/src/abilities.js";
import { SLOW_TIME_SCALE, SPRINT_MULTIPLIER } from "../../shared/src/constants.js";
import { woodsCutscenes, woodsSteps } from "../../shared/src/prologueWoods.js";
import type { World } from "../../shared/src/gameTypes.js";

const MANUAL = readFileSync(PLAYER_MANUAL_PATH, "utf8");
const read = (p: string) => readFileSync(p, "utf8");

class Recording implements Gateway {
  systems: string[] = [];
  constructor(readonly label: string) {}
  worstCaseUsd() {
    return 0.001;
  }
  async complete(system: string): Promise<Completion> {
    this.systems.push(system);
    return { text: '{"actions":[{"type":"wait","ticks":5}]}', tokens: { input: 1, output: 1 }, costUsd: 0 };
  }
}
const setup = (gateway: Gateway): ModelSetup => ({ gateway, manual: MANUAL, ledger: undefined as never, stage: "pilot", priceSource: "test", maxBatch: 4 });

/** Two turns per hero; returns every system text sent, per hero. */
async function systems(id: SituationId, label = "openai:test", kind: "model-history" | "model-obs-only" = "model-history") {
  const gateway = new Recording(label);
  const policies = policiesFor(kind, new ModelBudget(defaultBudgetLimits), setup(gateway), id);
  const env = new AgentEnvironment({ preset: "milestone" });
  await env.reset(0);
  const sent: Record<PlayerId, string[]> = { sieg: [], coco: [] };
  for (let turn = 0; turn < 2; turn++)
    for (const pid of ["sieg", "coco"] as PlayerId[]) {
      await policies[pid].decide({ observation: await env.observe(pid), legal: await env.legal_actions(pid) });
      sent[pid].push(gateway.systems.at(-1)!);
    }
  return { sent, policies };
}

const REVISED: SituationId[] = ["S2", "S3", "S2-local", "S3-local"];

describe("1. both heroes receive the manual and the tutorial briefing", () => {
  it("in revised S2, S3, S2-local and S3-local: full manual, then tutorial block, then episode briefing, on every call, for both providers and memories", async () => {
    for (const id of REVISED)
      for (const label of ["openai:gpt-6-luna@medium", "anthropic:claude-haiku-5-5@medium"])
        for (const kind of ["model-history", "model-obs-only"] as const) {
          const { sent, policies } = await systems(id, label, kind);
          const memory = kind === "model-history" ? "history" : "none";
          for (const [pid, hero] of [["sieg", "Sieg"], ["coco", "Coco"]] as const) {
            const expected = systemPrompt(hero, MANUAL, 4, memory) + tutorialBlock(TUTORIAL_BRIEFING) + briefingBlock(situation(id).briefing!);
            // The same, stable system text on every call of the episode.
            for (const s of sent[pid]) expect(s, `${id} ${label} ${kind} ${pid}`).toBe(expected);
            const s = sent[pid][0];
            expect(s).toContain(MANUAL);
            const at = (t: string) => s.indexOf(t);
            expect(at(MANUAL)).toBeLessThan(at("=== Tutorial-completion knowledge"));
            expect(at("=== End of tutorial-completion knowledge ===")).toBeLessThan(at("=== Episode briefing ==="));
            expect(s.split("=== Tutorial-completion knowledge").length).toBe(2);
            expect(policies[pid].name).toContain(`·tutorial-${tutorialId()}`);
          }
          // Identical knowledge for both heroes: only the hero lines of the general prompt differ.
          const strip = (s: string) => s.slice(s.indexOf("The public player manual follows."));
          expect(strip(sent.sieg[0])).toBe(strip(sent.coco[0]));
        }
  });

  it("both heroes' tutorial text covers both heroes' abilities, so each knows the partner's", () => {
    for (const section of ["## Sieg (the Guardian)", "## Coco (the Arcanist)", "## Working together"]) expect(TUTORIAL_BRIEFING).toContain(section);
    for (const a of abilityNames) expect(TUTORIAL_BRIEFING, a).toContain(`ability ${a}`);
  });

  it("is not given to S1 or to the preserved revision 1 definitions, nor to scripted baselines", async () => {
    for (const id of ["S1", "S2-v1", "S3-v1", "S2-local-v1", "S3-local-v1"] as SituationId[]) {
      expect(situation(id).tutorial, id).toBeUndefined();
      const { sent, policies } = await systems(id);
      expect(sent.sieg[0], id).not.toContain("Tutorial-completion knowledge");
      expect(policies.sieg.name).not.toContain("tutorial");
    }
    for (const id of REVISED)
      for (const kind of ["baseline-quest", "baseline-explore"] as const)
        expect(policiesFor(kind, undefined, undefined, id).sieg.name).not.toContain("tutorial");
  });

  it("the manual given is the committed player manual, whole and unedited, and every launcher reads that file", () => {
    const m = loadPlayerManual(".");
    expect(m.text).toBe(MANUAL);
    expect(m.sha256).toBe(createHash("sha256").update(read(PLAYER_MANUAL_PATH)).digest("hex"));
    for (const script of ["scripts/midterm/live.ts", "scripts/midterm/evaluate.ts", "scripts/midterm/run-episode.ts"]) {
      expect(read(script), script).toContain(PLAYER_MANUAL_PATH);
      expect(read(script), script).not.toMatch(/GAME_DESIGN_RATIONALE|manual\/README/);
    }
    // Every controls section of the manual reaches the model.
    for (const h of ["## Controls at a glance", "## Movement and the screen", "## Sieg and close combat", "## Coco and magic", "## Items and conversations", "## Cooperation and progress"])
      expect(MANUAL).toContain(h);
  });

  it("excludes the non-player-facing files under manual/ and none of their text reaches the model", async () => {
    expect(MANUAL_EXCLUSIONS.map((e) => e.path)).toEqual(["manual/GAME_DESIGN_RATIONALE.md", "manual/README.md", "manual/Oath_and_Ember_Player_Manual.pdf", "manual/images/"]);
    const { sent } = await systems("S3");
    for (const marker of ["Puzzle progression conditions verified in source", "Rule and source map", "Maintenance references", "Image provenance"])
      expect(sent.sieg[0], marker).not.toContain(marker);
  });
});

describe("2. the tutorial briefing matches the implemented controls and abilities", () => {
  const gameRoom = read("apps/server/src/GameRoom.ts");
  const movement = read("packages/shared/src/movement.ts");

  it("states the code's numbers", () => {
    const t = TUTORIAL_BRIEFING;
    expect(gameRoom).toContain('p.cooldowns.attack = p.role === "OATH" ? 0.45 : 0.6;');
    expect(t).toMatch(/Sword[^\n]*25 damage, about 0\.45 seconds/);
    expect(gameRoom).toContain("this.resolveSword(p, sceneId, 25, pendingSword.facing)");
    expect(fireballDamage(1)).toBe(20);
    expect(t).toMatch(/Fireball[^\n]*20 damage[^\n]*About 0\.6 seconds/);
    expect(gameRoom).toContain("p.hp -= defended ? n * 0.25 : n;");
    expect(t).toContain("a quarter of its normal damage");
    expect(SPRINT_MULTIPLIER).toBe(2);
    expect(movement).toMatch(/p\.sprintRemaining = 10;\s*p\.cooldowns\.sprint = 15;/);
    expect(t).toContain("double walking speed for 10 seconds, then 5 seconds of recharge");
    expect(movement).toContain("p.cooldowns.dash = 2;");
    expect(t).toContain("at most once every 2 seconds");
    expect(SLOW_TIME_SCALE).toBe(0.2);
    expect(gameRoom).toMatch(/endsTick: w\.serverTick \+ ticksFor\(10\)[\s\S]{0,40}p\.cooldowns\.slow_time = 20;/);
    expect(t).toMatch(/for 10 seconds everyone affected moves at one fifth speed[^\n]*cooldown is 20 seconds from the cast/);
    expect(movement).toMatch(/p\.flightRemaining = 20;\s*p\.cooldowns\.flight = 27;/);
    // Owner decision 2026-10-28: state Flight's fixed duration and that it cannot be cancelled.
    expect(t).toContain("a flight lasts 20 seconds and cannot be cancelled: there is no way to land early");
    expect(t).toContain("ends sooner only if Coco is defeated or travels to another area");
    // The press only starts a flight; the only early ends are defeat and area changes (transition, relocate).
    expect(movement).toContain("if (p.hp <= 0) p.flightRemaining = 0;");
    expect(gameRoom.match(/flightRemaining: 0,/g)).toHaveLength(3); // room reset, transition, relocate
    const legal = read("packages/agent/src/actions.ts");
    expect(legal).toContain('p.unlockedSkills.includes("flight") && !cd("flight")');
    expect(t).toContain("Recharge takes 7 seconds after the flight ends");
    expect(blackHoleTuning).toMatchObject({ range: 6 * 32, pullRadius: 3 * 32, damage: 30, duration: 4, cooldown: 10 });
    expect(t).toMatch(/up to 6 tiles forward[^\n]*within 3 tiles for 4 seconds[^\n]*30 damage\. Recharge 10 seconds/);
  });

  it("lists exactly the starting skills, keys and action names the interface offers", async () => {
    expect(startingSkills("OATH")).toEqual(["guard", "dash"]);
    expect(startingSkills("EMBER")).toEqual(["ward", "slow_time", "flight", "black_hole"]);
    expect(TUTORIAL_BRIEFING).toContain("Heavy Break, described in the manual \"when available\", is not one of Sieg's starting skills");
    const env = new AgentEnvironment({ preset: "milestone" });
    await env.reset(0);
    const bar = async (pid: PlayerId) => (await env.observe(pid)).abilities.map((a) => `${a.key}:${a.name}`);
    expect(await bar("sieg")).toEqual(["J:Sword", "K:Guard", "1:Push", "2:Super Speed"]);
    expect(await bar("coco")).toEqual(["J:Fireball", "K:Ward", "1:Slow Time", "2:Flight", "3:Black Hole"]);
    for (const [ability, key] of [["push", "1"], ["super_speed", "2"], ["slow_time", "1"], ["flight", "2"], ["black_hole", "3"]])
      expect(TUTORIAL_BRIEFING, ability).toMatch(new RegExp(`ability ${ability}, (holding )?the ${key} key`));
    const named = [...TUTORIAL_BRIEFING.matchAll(/\b(move|wait|attack|defend|ability|interact|use_item|advance_dialogue|choose_dialogue|message)\b/g)].map((m) => m[1]);
    for (const n of named) expect(actionTypes).toContain(n);
  });

  it("teaches every lesson of the actual tutorial, in its words where it can", () => {
    expect(woodsSteps).toEqual(["attack", "defend", "time", "flight", "black_hole"]);
    const guide = Object.values(woodsCutscenes).flatMap((c) => c.lines.filter((l) => l.speaker === "GUIDE").map((l) => l.text)).join("\n");
    expect(guide).toContain("A guarded hit does only a quarter of the damage");
    expect(guide).toContain("While time is slowed, Sieg still moves at full speed");
    expect(guide).toContain("Fly to the islet, press E at the crate, then fly back to Sieg. Trees still block you.");
    expect(guide).toContain("It pulls every mossling within 3 tiles together and hurts each one once. Sieg: cut down the bunch with J.");
    for (const lesson of ["blocked one by holding K", "Slow Time slowed the mosslings while Sieg kept his full speed", "flew to an islet, pressed E at the crate", "Black Hole bunched four mosslings together so Sieg could cut them down"])
      expect(TUTORIAL_BRIEFING).toContain(lesson);
  });

  it("quotes the screen legend and feedback lines the interface really produces", () => {
    const env = read("packages/agent/src/environment.ts");
    expect(env).toContain('export const NOTHING_RESPONDED = "You pressed E; nothing responded.";');
    expect(TUTORIAL_BRIEFING).toContain('"You pressed E; nothing responded."');
    expect(env).toContain("interrupted = `You arrived at ${areaName(scene)}.`;");
    expect(TUTORIAL_BRIEFING).toContain('"You arrived at <area>."');
    const legend = systemPrompt("Sieg", "", 4);
    for (const mark of ['"#" blocked', '"~" water or gap', '"o" object', '">" exit', '"^" a raised hazard', '"P" partner'])
      expect(legend).toContain(mark);
    for (const outcome of ['"full"', '"partial"', '"none"', '"not_applied"']) expect(TUTORIAL_BRIEFING).toContain(outcome);
    for (const state of ['"recovering"', '"active (Ns)"', '"flying (Ns)"', '"recharging (Ns)"']) expect(TUTORIAL_BRIEFING).toContain(state);
    const perception = read("packages/agent/src/perception.ts");
    expect(perception).toMatch(/recharging \(\$\{Math\.ceil\(cooldown\)\}s\)/);
    expect(perception).toContain('"flying"');
  });
});

describe("3. S2 and S3 map to the right areas and success conditions", () => {
  const holding = (item: string) => ({ inventory: { counts: { [item]: 1 }, claimed: [] }, story: { flags: [] } }) as unknown as World;
  it("S2 is Hedge Maze (Enchanted Shears), S3 Mirror Pond (Vanity Mirror), likewise the local starts", () => {
    expect(SUITE_REVISION).toBe(2);
    const cases = [
      ["S2", "Hedge Maze", "enchanted_shears", "vanity_mirror"],
      ["S2-local", "Hedge Maze", "enchanted_shears", "vanity_mirror"],
      ["S3", "Mirror Pond", "vanity_mirror", "enchanted_shears"],
      ["S3-local", "Mirror Pond", "vanity_mirror", "enchanted_shears"],
    ] as const;
    for (const [id, area, item, other] of cases) {
      const s = situation(id);
      expect(s.title.startsWith(area), id).toBe(true);
      expect(s.revision).toBe(2);
      const e = episodes[s.preset];
      expect(e.success(holding(item)), id).toBe(true);
      expect(e.success(holding(other)), id).toBe(false);
      expect(e.goal).toContain(area);
      expect(s.briefing).toContain(area);
    }
    expect(situation("S2").briefing).toBe(S2_MAZE_BRIEFING);
    expect(S2_MAZE_BRIEFING).toContain("**Enchanted Shears**");
    expect(situation("S3").briefing).toBe(S3_BRIEFING);
    expect(S3_BRIEFING).toBe(S2_BRIEFING.replace("evaluation (S2)", "evaluation (S3)"));
    // Limits are those of the revision 1 definition for the same area (identical for both areas).
    expect(episodes["S2-v2"].limits).toBe(episodes.S3.limits);
    expect(episodes["S3-v2"].limits).toBe(episodes.S2.limits);
    // S1, S4 and F are unchanged; S4 and F stay held out.
    expect(SITUATIONS.map((s) => [s.id, s.preset, s.heldOut])).toEqual([
      ["S1", "S1", false], ["S2", "S2-v2", false], ["S3", "S3-v2", false], ["S4", "S4", true], ["F", "full", true], ["S2-local", "S2-local-v2", false], ["S3-local", "S3-local-v2", false],
    ]);
  });

  it("the revised episode briefings name the area and objective item, not a route or mechanism", () => {
    for (const b of [S2_MAZE_BRIEFING, S3_BRIEFING]) {
      expect(b).not.toMatch(/\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*\)/);
      expect(b).not.toMatch(/\b(north|south|east|west|left|right|up|down)\b/i);
      expect(b).not.toMatch(/mirror m\d|brazier|torch|flame|push|rotate|spike|sanctuary|culvert|flight|fireball|black hole|chest|key|cow|gate|guard|rune|lever/i);
    }
  });
});

describe("5. no hidden solution or future state in the tutorial briefing", () => {
  it("names no quest area, item, character, mechanism or coordinate of the evaluated episode", () => {
    expect(TUTORIAL_BRIEFING).not.toMatch(
      /Mirror Pond|Hedge Maze|Griffin|Bridge Ruins|Goddess|Shrine|Vanity|Shears|\bWig\b|brazier|torch|culvert|sanctuary|\bcow\b|lever|rune|boulder|pressure plate|gate key|Puzzle Map|chapter|\bA[1-4]\b/i,
    );
    expect(TUTORIAL_BRIEFING).not.toMatch(/\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*\)/);
    expect(TUTORIAL_BRIEFING).not.toMatch(/\b(north|south|east|west)\b/i);
    // Nothing from the scripted baselines' hand-coded quest knowledge.
    const quest = read("packages/agent/src/policies/questKnowledge.ts");
    for (const phrase of [...quest.matchAll(/"([^"\n]{12,})"/g)].map((m) => m[1]))
      expect(TUTORIAL_BRIEFING, phrase).not.toContain(phrase);
  });

  it("the shared manual itself names no area, item or mechanism of the evaluated episode", () => {
    expect(MANUAL).not.toMatch(/Mirror Pond|Hedge Maze|Griffin|Bridge Ruins|Vanity|Shears|\bWig\b|brazier|culvert|Goddess/i);
  });
});

describe("6. historical evaluations remain identifiable and reproducible", () => {
  it("keeps the revision 1 definitions byte for byte under -v1 ids", () => {
    const v1 = Object.fromEntries(HISTORICAL_SITUATIONS.map((s) => [s.id, s]));
    expect(Object.keys(v1)).toEqual(["S2-v1", "S3-v1", "S2-local-v1", "S3-local-v1"]);
    expect(v1["S2-v1"]).toMatchObject({ preset: "S2", heldOut: false, revision: 1, supersededBy: "S3", briefing: S2_BRIEFING });
    expect(v1["S3-v1"]).toMatchObject({ preset: "S3", heldOut: false, revision: 1, supersededBy: "S2" });
    expect(v1["S3-v1"].briefing).toBeUndefined();
    // The briefing id recorded in pilot-6/7 policy names (EVALUATION_SUITE.md change log).
    expect(briefingId(S2_BRIEFING)).toBe("1051906a");
    expect(v1["S2-local-v1"].briefing).toBe(
      "Episode briefing (S2-local), the same for both players: you start at the Mirror Pond entrance. Your objective is to obtain the Vanity Mirror in the shared inventory. Normal movement, travel, interaction and messages remain available; you may leave this area and return. Use your own observations and coordinate with your partner.",
    );
    expect(v1["S3-local-v1"].briefing).toBe(
      "Episode briefing (S3-local), the same for both players: you start at the Hedge Maze entrance. Your objective is to obtain the Enchanted Shears in the shared inventory. Normal movement, travel, interaction and messages remain available; you may leave this area and return. Use your own observations and coordinate with your partner.",
    );
    expect(episodes.S2.goal).toBe("S2: from the shrine after the opening scene, obtain the Vanity Mirror (Mirror Pond).");
    expect(episodes.S3.goal).toBe("S3: from the shrine after the opening scene, obtain the Enchanted Shears (Hedge Maze).");
    expect(episodes["S2-local"].goal).toBe("S2-local: from the Mirror Pond entrance, obtain the Vanity Mirror.");
    expect(episodes["S3-local"].goal).toBe("S3-local: from the Hedge Maze entrance, obtain the Enchanted Shears.");
    for (const s of HISTORICAL_SITUATIONS) expect(s.tutorial, s.id).toBeUndefined();
  });

  it("reads old records (no suiteRevision) with revision 1 ids, and new records with current ids", () => {
    expect(historicalSituationId("S2")).toBe("S2-v1");
    expect(historicalSituationId("S3")).toBe("S3-v1");
    expect(historicalSituationId("S2-local")).toBe("S2-local-v1");
    expect(historicalSituationId("S3-local")).toBe("S3-local-v1");
    expect(historicalSituationId("S1")).toBe("S1");
    expect(historicalSituationId("S2", 2)).toBe("S2");
    expect(historicalSituationId("S3-local", 2)).toBe("S3-local");
  });

  it("a revision 1 S2 episode has the same episode id and start hash as before; revision 2 ids cannot be confused with it", async () => {
    const old = await new AgentEnvironment({ preset: "S2", prefix: situation("S2-v1").prefix }).reset(0);
    const now = await new AgentEnvironment({ preset: "S2-v2", prefix: situation("S2").prefix }).reset(0);
    expect(old.startHash).toBe("5397eba5c68d4770bf41e742e5ae9474a256a30f9ddd4149a6bf35592bc2c9ab");
    expect(now.startHash).toBe(old.startHash);
    expect(old.episode).toMatch(/^S2-0-5397eba5$/);
    expect(now.episode).toMatch(/^S2-v2-0-5397eba5$/);
  }, 60_000);

  it("restricts the -v1 ids to scripted reproduction: model runs are refused, even through the live launcher with the free mock gateway", async () => {
    for (const id of ["S2-v1", "S3-v1", "S2-local-v1", "S3-local-v1"] as SituationId[]) {
      for (const player of ["model-history", "model-obs-only"] as const)
        expect(() => validatePlan({ player, situations: [id], seeds: [0], model: { stage: "pilot" } as ModelSetup }), id).toThrow(/scripted baselines only/);
      for (const player of ["baseline-quest", "baseline-explore"] as const) expect(() => validatePlan({ player, situations: [id], seeds: [0] })).not.toThrow();
    }
    const out = mkdtempSync(join(tmpdir(), "v1-refusal-"));
    try {
      const r = await new Promise<{ code: number | null; text: string }>((done) =>
        execFile(process.execPath, ["--import", "tsx", "scripts/midterm/live.ts", "--scenario", "s2-v1", "--seed", "0", "--player", "model-history", "--gateway", "mock", "--no-viewer", "--out", join(out, "run")], { timeout: 60_000 }, (e, so, se) =>
          done({ code: e ? ((e as { code?: number }).code ?? 1) : 0, text: so + se })),
      );
      expect(r.code).not.toBe(0);
      expect(r.text).toMatch(/S2-v1 is a historical revision 1 definition: scripted baselines only/);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);
});
