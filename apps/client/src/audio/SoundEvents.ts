import type {
  World,
  SceneId,
  Player,
} from "../../../../packages/shared/src/gameTypes.js";
import { cutscenes, castOf } from "../../../../packages/shared/src/prologue.js";
import { offstageFor } from "../../../../packages/shared/src/chapter0.js";
import {
  heavyOnPlate,
  bridgeOpen,
} from "../../../../packages/shared/src/bridgePuzzle.js";
import {
  pondStations,
  pondSpikes,
} from "../../../../packages/shared/src/mirrorPond.js";
import { griffinAirborne } from "../../../../packages/shared/src/griffin.js";
import { DRAGON_BURST_SECONDS } from "../../../../packages/shared/src/waterDragon.js";
import { SERVER_HZ } from "../../../../packages/shared/src/constants.js";
import { isVillageInterior } from "../../../../packages/shared/src/villageInteriors.js";

/** Homes, shops and their upper floors: places with doors and stairs. */
export const indoors = (id?: SceneId) =>
  !!id &&
  (id === "HOUSE_INTERIOR" || id === "HOUSE_UPPER" || isVillageInterior(id));
export interface SoundCue {
  name: string;
  key?: string;
  x?: number;
  y?: number;
  rate?: number;
  source?: string;
}
export interface SoundFrame {
  shots: SoundCue[];
  loops: SoundCue[];
  quiet: boolean;
  reset?: boolean;
  silence?: boolean;
}
const atScene = (p: Player, w: World) => p.sceneId ?? w.sceneId;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const storyStartCues: Record<string, string> = {
  visit: "Prologue arrival and visit to Alden",
  "sets-out": "Sieg leaves home / Mother speaks",
  "next-day": "Following day / wooden sword in backpack",
  "ask-bertram": "Ask Bertram / Brynn / traveling merchant",
  "ask-brynn": "Ask Bertram / Brynn / traveling merchant",
  "ask-merchant": "Ask Bertram / Brynn / traveling merchant",
  "trials-done": "Trials departure / Speak to Goddess objective",
  fork: "Road fork / Coco detour",
  cart: "Lost cart discovered",
  home: "Home that evening / argument",
  farewell: "Private farewell / Sieg promise",
  morning: "Next morning lesson / cauldron",
  errand: "Coco starts errand",
  homecoming: "Homecoming on garden path",
  stranger: "Stranger encounter at west entrance",
  "clues-done": "Investigation complete / search desk",
  "angel-meet": "Weeping Angel first meeting",
  "trials-inscription": "Trials inscription / reread",
  "goddess-meet": "First shrine audience / recover wig objective",
  "maze-banter": "Enter maze / maze banter",
  "mirror-banter": "Vanity Mirror acquired / mirror banter",
  "wig-banter": "Wig acquired banter",
  watcher: "Watcher camera reveal",
};
const flagCues: Record<string, string> = {
  "chapter0.moonleaf": "Brynn hands over moonleaf",
  "chapter0.store": "Store hands over two vials and candlewick",
  "chapter0.bakery": "Bakery hands over bread and honey pastry",
  "chapter0.errand-done": "Shopping list complete / return objective",
  "chapter0.site-ready": "Sieg lays grave stones",
  "chapter0.drawer-forced": "Sieg forces stuck drawer",
  "chapter0.seal-undone": "Coco undoes Alden seal",
  "chapter0.shrine-quest": "Decision by grave / shrine quest unlock",
  "chapter0.angel-blessing": "Angel blessing / next route opens",
  "chapter0.trial-cooperation":
    "Trial Cooperation / Ingenuity / Courage passed",
  "chapter0.trial-ingenuity": "Trial Cooperation / Ingenuity / Courage passed",
  "chapter0.trial-courage": "Trial Cooperation / Ingenuity / Courage passed",
};
/** Consumes accepted snapshots only. Never reads prediction or changes gameplay. */
export class SoundEvents {
  private previous?: World;
  private scene?: SceneId;
  private seenImpacts = new Set<string>();
  private cadence = new Map<string, number>();
  reset() {
    this.previous = undefined;
    this.scene = undefined;
    this.seenImpacts.clear();
    this.cadence.clear();
  }
  observe(w: World, playerId: string): SoundFrame {
    const shots: SoundCue[] = [],
      loops: SoundCue[] = [];
    const me = w.players[playerId];
    if (!me?.connected || !me.role || w.phase === "LOBBY") {
      this.reset();
      return { shots, loops, quiet: false };
    }
    const away = offstageFor(w.story, me.role);
    const listener = away?.watch
      ? (Object.values(w.players).find((p) => p.id !== me.id) ?? me)
      : me;
    const scene = atScene(listener, w),
      old = this.previous,
      quiet = !!w.story?.cutscene;
    const emit = (
      name: string,
      p?: { x: number; y: number },
      source?: string,
    ) => shots.push({ name, source, ...(p ? { x: p.x, y: p.y } : {}) });
    const sustain = (
      name: string,
      key: string,
      p: { x: number; y: number },
      rate = 1,
    ) =>
      loops.push({
        name,
        key,
        x: p.x,
        y: p.y,
        // Slowed time lowers sustained sounds, but not so far they turn to rumble.
        rate: rate * (w.slowTime ? 0.6 : 1),
      });
    const cadence = (key: string, seconds: number) => {
      if (w.serverTick - (this.cadence.get(key) ?? -Infinity) < seconds * 60)
        return false;
      this.cadence.set(key, w.serverTick);
      return true;
    };
    if (
      !old ||
      old.roomCode !== w.roomCode ||
      w.serverTick < old.serverTick ||
      this.scene !== scene ||
      old.phase === "LOBBY"
    ) {
      const travel = old && old.roomCode === w.roomCode && this.scene !== scene;
      const from = this.scene;
      this.previous = w;
      this.scene = scene;
      this.cadence.clear();
      this.seenImpacts = new Set(w.projectileImpacts?.map((q) => q.id));
      // Doors and stairs belong to rooms; walking between maps stays quiet.
      if (travel && !quiet && (indoors(from) || indoors(scene)))
        emit("Door / stairs / map travel");
      const incoming = w.story?.cutscene;
      if (travel && incoming && incoming.id !== old?.story?.cutscene?.id) {
        const def = cutscenes[incoming.id],
          line = def?.lines[incoming.line];
        if (
          def &&
          castOf(def).includes(me.role) &&
          (!line?.audience || line.audience === me.role) &&
          storyStartCues[incoming.id]
        )
          emit(storyStartCues[incoming.id]);
      }
      return { shots, loops, quiet, reset: true };
    }
    if (old === w) return { shots, loops, quiet };
    // Quiet scenes suppress generic UI, combat, movement and reward cues. Only authored visible story beats remain.
    if (quiet) {
      const run = w.story!.cutscene!,
        before = old.story?.cutscene;
      const definition = cutscenes[run.id],
        line = definition?.lines[run.line];
      const cast = definition ? castOf(definition) : [],
        viewer = away?.watch ? cast[0] : me.role;
      const sees = !!definition && (cast.includes(me.role) || !!away?.watch);
      const visible = sees && (!line?.audience || line.audience === viewer);
      // Alden's water dragon: it roars as it rises, gulps each monster as its
      // jaws reach it, and bursts into rain. Timings come from the server cast.
      const dragon = w.story?.dragon;
      if (dragon && sees) {
        const crossed = (tick: number) =>
          tick > old.serverTick && tick <= w.serverTick;
        const burst = dragon.end - Math.ceil(DRAGON_BURST_SECONDS * SERVER_HZ);
        if (old.story?.dragon?.start !== dragon.start)
          emit("Water dragon rises / roars", dragon.centre);
        for (const bite of dragon.prey)
          if (crossed(bite.at)) emit("Water dragon swallows a monster", bite);
        if (crossed(burst))
          emit("Water dragon bursts into rain", dragon.centre);
        if (w.serverTick < burst)
          sustain("Water dragon rushes", "dragon", dragon.centre);
      }
      if (visible && (run.id !== before?.id || run.line !== before?.line)) {
        if (run.id !== before?.id && storyStartCues[run.id])
          emit(storyStartCues[run.id]);
        if (run.id === "revelation" && line?.text === "...Coco?")
          emit("Goddess recognizes Coco and Sieg / remembers Alden");
        if (run.id === "revelation" && line?.text === "It opens a door.")
          emit("Ember described as one of seven relics / opens a door");
        if (
          run.id === "reunion" &&
          line?.memory &&
          !cutscenes[run.id].lines[run.line - 1]?.memory
        )
          emit("Reunion / Sieg remembers evening");
        if (line?.cue === "drop-bag")
          emit("Coco discovers wounded Alden / drops bag");
        if (line?.heal === "attempt") emit("Coco tries healing");
        if (
          line?.heal === "fail" &&
          cutscenes[run.id].lines[run.line - 1]?.heal !== "fail"
        )
          emit("Healing fails");
        if (line?.cue === "alden-cast")
          emit("Alden enters / magic circle gathers");
        if (line?.cue === "mist-gather") emit("Mist gathers");
        if (line?.cue === "stranger-appear") emit("Stranger takes shape");
        if (run.id === "journal" && line?.give)
          emit("Compartment opens / three finds enter backpack");
        if (run.id === "journal" && line?.text === "Coco opens the journal.")
          emit("Coco opens journal / reads Alden words");
      }
    } else {
      for (const p of Object.values(w.players)) {
        const prev = old.players[p.id];
        if (
          !prev ||
          !p.connected ||
          atScene(p, w) !== scene ||
          atScene(prev, old) !== scene
        )
          continue;
        const coco = p.role === "EMBER";
        if (
          p.combat &&
          p.combat.seq !== prev.combat?.seq &&
          w.serverTick - p.combat.startedTick < 90
        ) {
          if (p.combat.kind === "sword") emit("Sieg normal sword swing", p);
          if (p.combat.kind === "heavy")
            emit("Heavy Break release / early normal release", p);
          // Fireball is observed by its projectile, never generic cast (also used by Black Hole).
        }
        if (
          ["AIRSHIP", "AIRSHIP_BOSS"].includes(scene) &&
          !p.flightRemaining &&
          ((!p.grounded && prev.grounded && p.vy < 0) ||
            (p.grounded && !prev.grounded))
        )
          emit("Later Airship / arena jumping", p);
        if (p.heavyCharge) sustain("Heavy Break charge", `heavy:${p.id}`, p);
        if (p.actionState === "guard" && prev.actionState !== "guard")
          emit(
            coco ? "Coco Ward raised / lowered" : "Sieg Guard raised / lowered",
            p,
          );
        const blocked =
          p.defensiveHit?.seq !== prev.defensiveHit?.seq && p.defensiveHit;
        if (blocked)
          emit(coco ? "Coco Ward struck" : "Sieg Guard absorbs hit", p);
        else if (p.hp < prev.hp)
          // Generic hurt only, never infer attacker/death. Each hero has a voice.
          emit(
            p.role === "OATH"
              ? "Sieg hurt"
              : coco
                ? "Coco hurt"
                : "Player takes unguarded damage / safe respawn",
            p,
          );
        if ((p.sprintRemaining ?? 0) > 0 && !(prev.sprintRemaining! > 0))
          emit("Sieg Super Speed starts", p);
        if ((prev.sprintRemaining ?? 0) > 0 && !p.sprintRemaining)
          emit("Sieg Super Speed expires / ready", p);
        if ((p.flightRemaining ?? 0) > 0 && !(prev.flightRemaining! > 0))
          emit("Coco Flight takeoff", p);
        if ((prev.flightRemaining ?? 0) > 0 && !p.flightRemaining)
          emit("Coco Flight landing / expiry recovery", p);
        if ((p.cooldowns.dash ?? 0) > (prev.cooldowns.dash ?? 0) + 0.5)
          emit(
            coco
              ? "Optional Coco Blink short K burst"
              : "Sieg short K movement burst",
            p,
          );
        if (p.id === playerId) {
          for (const key of ["flight", "slow_time", "black_hole", "sprint"])
            if ((prev.cooldowns[key] ?? 0) > 0 && !p.cooldowns[key])
              emit("Skill recharge ready");
          if (p.unlockedSkills.length > prev.unlockedSkills.length)
            emit("Optional skill unlock accepted");
        }
        const moved = distance(p, prev);
        if (
          moved > 0.2 &&
          moved < 100 &&
          !p.flightRemaining &&
          cadence(`step:${p.id}`, (p.sprintRemaining ?? 0) > 0 ? 0.23 : 0.38)
        ) {
          emit(
            indoors(scene)
              ? "Footsteps indoors / wood"
              : scene === "BRIDGE_RUINS" ||
                  scene === "GODDESS_SHRINE" ||
                  scene === "MIRROR_POND" ||
                  scene === "EMBERBROOK_VILLAGE"
                ? "Footsteps on paved ruins / shrine / village"
                : "Footsteps on grass / garden / maze",
            p,
          );
        }
        if (
          p.flightRemaining &&
          moved > 0.2 &&
          moved < 100 &&
          cadence(`flutter:${p.id}`, 0.7)
        )
          emit("Coco Flight movement", p);
      }
      if (w.slowTime && w.slowTime.startedTick !== old.slowTime?.startedTick)
        emit("Coco Slow Time begins", w.players[w.slowTime.owner]);
      if (!w.slowTime && old.slowTime)
        emit("Coco Slow Time ends / recharge ready");
      if (w.slowTime && cadence("clock", 1))
        emit("Coco Slow Time active clock", w.players[w.slowTime.owner]);
      for (const hole of Object.values(w.blackHoles ?? {}))
        if (hole.sceneId === scene) {
          if (!old.blackHoles?.[hole.id]) emit("Coco Black Hole launch", hole);
          if (hole.phase === "vortex")
            sustain("Black Hole opens / pulls", `hole:${hole.id}`, hole, 0.8);
          if (
            hole.damaged.length >
            (old.blackHoles?.[hole.id]?.damaged.length ?? 0)
          )
            emit("Black Hole affects an enemy", hole);
        }
      for (const q of Object.values(w.projectiles)) {
        if ((q.sceneId ?? w.sceneId) !== scene) continue;
        const prev = old.projectiles[q.id];
        if (q.effect === "golem_beam")
          sustain(
            "Ironbound Sentinel palm beam active",
            `sentinel:${q.id}`,
            q,
            1.15,
          );
        else if (!prev)
          emit(
            q.faction === "enemies"
              ? "Cinder Wisp projectile release"
              : "Coco Fireball cast, level 1",
            q,
          );
        if (
          q.pondReflection !== undefined &&
          prev &&
          prev.pondReflection === undefined
        )
          emit("Coco fireball reflected from mirror", q);
      }
      for (const hit of w.projectileImpacts ?? []) {
        if (this.seenImpacts.has(hit.id)) continue;
        this.seenImpacts.add(hit.id);
        if (
          (hit.sceneId ?? w.sceneId) !== scene ||
          w.serverTick - hit.tick > 60
        )
          continue;
        const enemy = w.enemies[hit.owner] ?? old.enemies[hit.owner];
        emit(
          hit.effect === "golem_blast"
            ? "Ironbound Sentinel contact blast"
            : enemy
              ? "Cinder Wisp projectile impact"
              : "Coco Fireball impact",
          hit,
        );
      }
      for (const e of Object.values(w.enemies)) {
        const prev = old.enemies[e.id];
        if (w.sceneId !== scene) continue;
        if (!prev) {
          if (w.story?.stage === "FIGHT")
            emit("Golem and Wisp rise; later reinforcements", e);
          continue;
        }
        if (e.state === "ATTACK" && e.attackSeq !== prev.attackSeq)
          emit(
            e.type === "mossling"
              ? "Mossling attack windup"
              : e.type === "cinder_wisp"
                ? "Cinder Wisp windup"
                : e.attackKind === "melee"
                  ? "Ironbound Sentinel melee windup / punch"
                  : "Ironbound Sentinel beam charge",
            e,
          );
        if (
          e.type === "ironbound_sentinel" &&
          e.state === "ATTACK" &&
          e.attackKind === "beam" &&
          !Object.values(w.projectiles).some(
            (q) => q.owner === e.id && q.effect === "golem_beam",
          )
        )
          sustain(
            "Ironbound Sentinel beam charge",
            `sentinel-charge:${e.id}`,
            e,
          );
        if (e.hp < prev.hp && e.state !== "DEAD")
          emit(
            e.type === "ironbound_sentinel"
              ? "Sentinel hurt / defeat"
              : "Enemy hurt",
            e,
          );
        if (e.state === "DEAD" && prev.state !== "DEAD")
          emit(
            e.type === "ironbound_sentinel"
              ? "Sentinel defeated"
              : "Mossling / Wisp defeated",
            e,
          );
      }
      if (
        scene === "MONSTER_CLEARING" &&
        Object.values(old.enemies).some((e) => e.hp > 0) &&
        !Object.values(w.enemies).some((e) => e.hp > 0)
      )
        emit("Monster Clearing wave completed");
      this.puzzles(w, old, scene, emit, sustain, cadence);
      const flags = w.story?.flags ?? [],
        oldFlags = old.story?.flags ?? [];
      for (const flag of flags)
        if (!oldFlags.includes(flag)) {
          if (flagCues[flag]) emit(flagCues[flag]);
          else if (/chapter0\.stone-/.test(flag))
            emit("Sieg gathers three smooth stones");
          else if (/chapter0\.flower-/.test(flag))
            emit("Coco gathers three bunches of flowers");
        }
      if (w.phase === "COMPLETE" && old.phase !== "COMPLETE")
        emit("Later Warden victory / game complete");
    }
    if (w.story?.motivations?.[me.role] && !old.story?.motivations?.[me.role])
      emit("Motivation accepted");
    // Shared reward/latch observations; mute story transitions to prevent item jingles over grief.
    if (!quiet) this.inventory(w, old, emit);
    if (
      w.story?.flags.includes("chapter0.complete") &&
      !old.story?.flags.includes("chapter0.complete")
    )
      emit("Chapter 0 complete / fade and title");
    // Seen impact IDs are retained only while IDs exist in the 1-second server history.
    this.seenImpacts = new Set((w.projectileImpacts ?? []).map((q) => q.id));
    this.previous = w;
    this.scene = scene;
    const unique = shots.filter(
      (cue, i) =>
        shots.findIndex(
          (c) => c.name === cue.name && c.x === cue.x && c.y === cue.y,
        ) === i,
    );
    const currentRun = w.story?.cutscene;
    const currentLine =
      currentRun && cutscenes[currentRun.id]?.lines[currentRun.line];
    const silence =
      currentRun?.id === "funeral" ||
      currentLine?.cue === "alden-still" ||
      currentLine?.text === "Silence.";
    return { shots: unique, loops, quiet, silence };
  }
  private inventory(
    w: World,
    old: World,
    emit: (name: string, p?: { x: number; y: number }) => void,
  ) {
    const bag = w.inventory,
      before = old.inventory;
    if (!bag || !before) return;
    const claimed: Record<string, string> = {
      "hedge-runner-key": "Sieg tags key carrier / obtains key",
      "hedge-shears-chest": "Enchanted Shears acquired",
      "pond-vanity-mirror-chest": "Vanity Mirror acquired / mirror banter",
      "griffin-nest": "Coco collects wig after peaceful route or defeat",
    };
    for (const id of bag.claimed)
      if (!before.claimed.includes(id))
        emit(claimed[id] ?? "Successful generic chest / quest pickup");
    for (const id of bag.unlocked)
      if (!before.unlocked.includes(id))
        emit("Key consumed / chest gate opened");
    for (const id of bag.completed)
      if (!before.completed.includes(id))
        emit("Goddess accepts owned Griffin Wig");
  }
  private puzzles(
    w: World,
    o: World,
    scene: SceneId,
    emit: (name: string, p?: { x: number; y: number }) => void,
    sustain: (
      name: string,
      key: string,
      p: { x: number; y: number },
      rate?: number,
    ) => void,
    cadence: (key: string, seconds: number) => boolean,
  ) {
    if (scene === "PUZZLE_GLADE") {
      const a = w.puzzles.statueChair?.glade,
        b = o.puzzles.statueChair?.glade;
      if (a && b) {
        if (a.bushesBurned && !b.bushesBurned)
          emit("Burn thicket blocking chair");
        if (a.seatedTick !== null && b.seatedTick === null)
          emit("Chair delivered / Angel sits");
        if (a.rejected && a.rejected.tick !== b.rejected?.tick)
          emit("Angel refuses offered rock");
      }
    }
    if (scene === "HEDGE_MAZE") {
      const a = w.puzzles.hedgeMaze?.maze,
        b = o.puzzles.hedgeMaze?.maze;
      if (a && b) {
        if (a.burned && !b.burned) emit("Burn amber maze bush");
        if (a.cow.parked && !b.cow.parked) emit("Cow parked / lane cleared");
        if (distance(a.cow, b.cow) > 0.1 && cadence("cow", 0.65))
          emit("Black Hole pulls harmless cow", a.cow);
        if (
          !a.runner.caught &&
          distance(a.runner, b.runner) > 0.1 &&
          cadence("runner", 0.3)
        )
          emit("Forest wolf key carrier roaming / fleeing", a.runner);
      }
    }
    if (scene === "MIRROR_POND") {
      const a = w.puzzles.mirrorPond?.pond,
        b = o.puzzles.mirrorPond?.pond;
      if (a && b) {
        a.mirrors.forEach((angle, i) => {
          if (angle !== b.mirrors[i] && cadence(`mirror:${i}`, 0.3))
            emit("Sieg rotates mirror M1–M4", pondStations[i]);
        });
        a.torches.forEach((lit, i) => {
          if (lit)
            sustain(
              "Lit braziers sustain",
              `brazier:${i}`,
              pondStations[i].torch,
            );
          if (lit && !b.torches[i])
            emit(
              "Torch 1–4 ignites from valid reflected contact",
              pondStations[i].torch,
            );
        });
        if (a.raised && !b.raised)
          emit("Fourth torch / central platform and bridge rise");
        if (a.failures > b.failures)
          emit("Sieg spike contact resets to courtyard");
        if (
          pondSpikes(a.clock).length !== pondSpikes(b.clock).length &&
          cadence("pond-spike", 0.4)
        )
          emit("East corridor spikes warn / rise / retract");
      }
    }
    if (scene === "BRIDGE_RUINS") {
      const a = w.bridgePuzzle,
        b = o.bridgePuzzle;
      if (a && b) {
        const changes: Array<[keyof typeof a, string]> = [
          ["targetHit", "Coco hits first moving target front"],
          ["firstGateOpen", "Gate 1 opens"],
          ["goldSwitchOpen", "Coco activates golden switch"],
          ["finalTargetHit", "Final long-range frontal shot succeeds"],
          ["complete", "Both final switches held / divider opens"],
        ];
        for (const [key, name] of changes) if (a[key] && !b[key]) emit(name);
        if (a.goldSwitchOpen && !a.finalTargetHit && a.trapClock > b.trapClock)
          sustain("Three moving spike sleds", "bridge-sleds", {
            x: 288,
            y: 960,
          });
        for (const plate of ["A", "B"] as const)
          if (heavyOnPlate(a, plate) !== heavyOnPlate(b, plate))
            emit(
              heavyOnPlate(a, plate)
                ? "Boulder weights plate A / B"
                : "Boulder leaves plate B before stabilization",
            );
        if (
          distance(a.boulder, b.boulder) > 0.1 &&
          distance(a.boulder, b.boulder) < 100 &&
          cadence("boulder", 0.35)
        )
          emit("Sieg pushes persistent boulder", a.boulder);
        if (a.failures > b.failures)
          emit(
            a.bridgeClosedUntil.some((v, i) => v > b.bridgeClosedUntil[i])
              ? "Fragile bridge collapses / safe-bank recovery"
              : distance(a.boulder, b.boulder) > 100
                ? "Boulder hits spikes / resets with Sieg"
                : "Sieg alone hits spikes / resets",
          );
        for (let i = 0; i < 2; i++)
          if (bridgeOpen(a, w, i) && !bridgeOpen(b, o, i))
            emit("Bridge supports / restores");
        if (a.holdTicks > 0 && !b.holdTicks)
          emit("Each final bank switch occupied / released");
      }
    }
    if (scene === "GRIFFIN_ENCLOSURE") {
      const a = w.puzzles.griffin?.griffin,
        b = o.puzzles.griffin?.griffin;
      if (a && b) {
        const phases: Record<string, string> = {
          WAKING: "Griffin wakes",
          TAKEOFF: "Griffin ordinary takeoff after grounded timer",

          HEADBUTT_CHARGE: "Griffin headbutt warning",
          HEADBUTT: "Griffin headbutt rush",
          DEFEATED: "Griffin hurt / defeated",
        };
        if (a.phase === "PULLED" && b.phase !== "PULLED")
          emit("Black Hole pulls Griffin ashore", a);
        if (a.phase === "LAND" && b.phase === "STUNNED")
          emit("Griffin stunned / recovers", a);
        if (
          a.beam &&
          a.beam.contactId !== "range" &&
          a.clock - a.beam.impactClock < 3
        )
          sustain(
            "Griffin beam contact tail after beam ends",
            "griffin-contact",
            a.beam,
          );
        if (a.phase !== b.phase && phases[a.phase]) emit(phases[a.phase], a);
        if (a.phase === "BEAM_CHARGE")
          sustain("Griffin mouth beam charge", "griffin-charge", a);
        if (a.phase === "BEAM")
          sustain("Griffin mouth beam active", "griffin-beam", a, 0.75);
        if (
          griffinAirborne(a) &&
          !["BEAM", "BEAM_CHARGE"].includes(a.phase) &&
          cadence("wings", 0.65)
        )
          emit("Griffin patrol flight / nest defense pursuit", a);
        if (a.phase === "NEST" && cadence("sleep", 5))
          emit("Sleeping Griffin at nest / griffin banter", a);
        if (a.phase === "LAND" && griffinAirborne(b))
          emit("Griffin lands / grounded window", a);
        if (a.hp < b.hp && a.hp > 0) emit("Griffin hurt / defeated", a);
        if (
          a.beam &&
          a.beam.contactId !== "range" &&
          a.beam.impactClock !== b.beam?.impactClock
        )
          emit("Griffin beam first/contact change", a.beam);
        a.pillars.forEach((v, i) => {
          if (v && !b.pillars[i]) emit("Headbutt collapses one pillar");
        });
        if (
          (a.mirrorDelivered && !b.mirrorDelivered) ||
          (a.shearsDelivered && !b.shearsDelivered)
        )
          emit("Coco delivers mirror / shears at nest", a);
        if (a.groomingStage !== b.groomingStage) {
          if (a.groomingStage === "CUT")
            emit("Griffin haircut / tools taken", a);
          if (a.groomingStage === "DEPART")
            emit("Griffin departs / wig drops", a);
          if (["STAND", "SOUTH", "NORTH"].includes(a.groomingStage ?? ""))
            emit("Grooming stands / admires south and north", a);
        }
      }
    }
    for (const [id, p] of Object.entries(w.pushableOffsets ?? {})) {
      const prev = o.pushableOffsets?.[id];
      if (prev && distance(p, prev) > 0.1 && cadence(`push:${id}`, 0.35))
        emit("Sieg physically pushes chair/rock/crate or teammate");
    }
    if (
      scene === "FOREST_RUINS" &&
      w.interactables.crate &&
      o.interactables.crate &&
      distance(w.interactables.crate, o.interactables.crate) > 0.1 &&
      cadence("crate", 0.35)
    )
      emit(
        "Sieg physically pushes chair/rock/crate or teammate",
        w.interactables.crate,
      );
    if (scene === "FOREST_RUINS")
      for (const id of ["gate", "bridge"])
        if (w.puzzles[id]?.complete && !o.puzzles[id]?.complete)
          emit(
            id === "gate"
              ? "Later Forest Ruins bramble/rune gate"
              : "Later Forest Ruins crate/plate and crystal bridge",
          );
    if (
      scene === "AIRSHIP" &&
      w.puzzles.engine?.progress > o.puzzles.engine?.progress
    )
      sustain("Later Airship crank/core", "engine", { x: 900, y: 300 });
    if (w.boss?.phase !== o.boss?.phase && w.boss)
      emit("Later Stormbound Warden shield / anchor / hits");
  }
}
