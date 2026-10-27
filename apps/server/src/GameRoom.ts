import { settlementPortals } from "../../../packages/shared/src/settlements.js";
import { ensureGriffin, tickGriffin, damageGriffin } from "./griffin.js";
import {
  griffinState,
  griffinSpawn,
  griffinAirborne,
} from "../../../packages/shared/src/griffin.js";
import { ensureShrine } from "./shrine.js";
import { burnGladeBushes, ensureGlade, tickGlade } from "./statueGlade.js";
import { gladeSolved } from "../../../packages/shared/src/statueGlade.js";
import {
  npcs,
  npcPose,
  NPC_TALK_RANGE,
} from "../../../packages/shared/src/npcs.js";
import {
  isVillageInterior,
  villageDoorPoint,
  villageInteriorIds,
  villageInteriors,
} from "../../../packages/shared/src/villageInteriors.js";
import {
  shrineComplete,
  shrinePoints,
  shrineSpawn,
} from "../../../packages/shared/src/shrine.js";
import { tickGolemBeam, contact } from "./golemBeam.js";
import { shopStairsFoot } from "../../../packages/shared/src/magicShop.js";
import {
  AMBUSH_FLOOR,
  ambushProtects,
  beginPrologue,
  prologueBlocksExit,
  readLine,
  storyBlocksDoor,
  storyConversation,
  storyInteract,
  storyLocked,
  storyTravel,
  storyWalkInput,
  tickStory,
  type StoryHost,
} from "./prologue.js";
// A shot that struck a body this tick is placed where it first touched it, so
// its impact appears at the target rather than up to one step beyond it.
function settleAtContact(
  q: { x: number; y: number },
  ox: number,
  oy: number,
  body: { x: number; y: number; w: number; h: number },
) {
  const t = contact({ x: ox, y: oy }, q, body, 0);
  if (!Number.isFinite(t)) return;
  q.x = ox + (q.x - ox) * t;
  q.y = oy + (q.y - oy) * t;
}
import {
  ensureMirrorPond,
  updatePondChest,
  pushPondMirror,
  tickMirrorPond,
  tracePondFireball,
} from "./mirrorPond.js";
import {
  mirrorPondState,
  pondSpawn,
} from "../../../packages/shared/src/mirrorPond.js";
import {
  ensureHedgeMaze,
  spawnMazeEnemies,
  updateHedgeMazeTargets,
  tickMazeRunner,
  burnMazeBush,
} from "./hedgeMaze.js";
import { InventoryService } from "./inventory.js";
import {
  emptyInventory,
  type ItemIntent,
} from "../../../packages/shared/src/items.js";
import { tickBlackHoles } from "./blackHoles.js";
import { blackHoleTuning } from "../../../packages/shared/src/blackHole.js";
import {
  newBridgePuzzle,
  tickBridgePuzzle,
  hitBridgeLock,
  bridgeGateWalls,
  bridgeMovingTarget,
  bridgeEntryTargetVisible,
  pushBridgeBoulder,
  bridgePoints,
  hitBridgeEntryTarget,
} from "../../../packages/shared/src/bridgePuzzle.js";
import { SLOW_TIME_SCALE } from "../../../packages/shared/src/constants.js";
import { pushNearby } from "../../../packages/shared/src/pushables.js";
import {
  forestEncounter,
  spawnEnemy,
} from "../../../packages/shared/src/enemies.js";
import { damageEnemy, tickEnemies, segmentHits } from "./enemySimulation.js";
import { woodsProtects } from "./prologueWoods.js";
import { WOODS_HP_FLOOR } from "../../../packages/shared/src/prologueWoods.js";
import {
  defaultAppearance,
  validAppearance,
} from "../../../packages/shared/src/appearance.js";
import { randomUUID } from "node:crypto";
import { beginStoryCheckpoint } from "./storyCheckpoints.js";
import {
  chooseMotivation,
  finaleBlocksExit,
  finaleHoldsWorld,
} from "./chapter0Finale.js";
import {
  heavyTiming,
  swordContactTicks,
  inSwordArc,
} from "../../../packages/shared/src/combat.js";
import {
  DT,
  ticksFor,
  MAX_PREDICTION_LEAD,
  FIREBALL_SPEED,
  FIREBALL_RANGE,
} from "../../../packages/shared/src/constants.js";
import {
  neutral,
  type World,
  type Role,
  type InputFrame,
  type Player,
  type SceneId,
} from "../../../packages/shared/src/gameTypes.js";
import {
  maps,
  collisionRects,
  isPostTownScene,
  postTownRoute,
  previousMap,
} from "../../../packages/shared/src/maps.js";
import {
  constrainMotion,
  stepMovement,
  facingFor,
} from "../../../packages/shared/src/movement.js";
import {
  skills,
  startingSkills,
  fireballLevel,
  fireballDamage,
} from "../../../packages/shared/src/abilities.js";
type Aim = { x: number; y: number };
import { storyVersion } from "../../../packages/shared/src/storyVersion.js";
export interface RoomRuntime { now(): number; id(): string }
const productionRuntime: RoomRuntime = { now: () => Date.now(), id: () => randomUUID() };
export class GameRoom {
  state: World;
  readonly inventory = new InventoryService();
  useItem(id: string, intent: ItemIntent) {
    const player = this.state.players[id];
    if (!player || !this.sessions.has(id)) throw Error("Join a room first.");
    const result = this.inventory.use(this.state, player, intent);
    updateHedgeMazeTargets(this.state, this.inventory);
    return result;
  }
  private travelReadyTick = 0;
  /** The story moves heroes and the party through these. */
  private storyHost: StoryHost = {
    relocate: (p, scene, at) => this.relocate(p, scene, at),
    travel: (scene) => this.transition(scene),
  };
  private savedMaps = new Map<
    SceneId,
    {
      bridgePuzzle: World["bridgePuzzle"];
      enemies: World["enemies"];
      boss: World["boss"];
    }
  >();

  private interactWasHeld = new Map<string, boolean>();
  private blackHoleRequests = new Set<string>();
  private flightRequests = new Set<string>();
  private sprintRequests = new Set<string>();
  private slowTimeRequests = new Set<string>();
  private carried = new Map<
    string,
    { dx: number; dy: number; targets: Set<string> }
  >();
  private pendingSwords = new Map<
    string,
    { due: number; scene: SceneId; facing: number }
  >();
  private primaryWasHeld = new Map<string, boolean>();
  sessions = new Map<
    string,
    {
      token: string;
      socketId: string | null;
      expires: number;
      input: InputFrame;
      received: number;
      receivedTick?: number;
      // Each edge keeps the movement intent held when it was pressed: actions
      // fire on receipt, while movement (and so facing) plays back ticks later.
      primaryEdges?: { held: boolean; aim: Aim | null }[];
      aim?: Aim | null;
      blackHoleAim?: Aim | null;
      // Coco's casts join the scheduled movement timeline, firing on the tick
      // her movement reaches, from the position and facing prediction shows.
      scheduledCasts?: number[];
      pushEdges?: boolean[];
      movementQueue?: Map<number, InputFrame>;
      movementInput?: InputFrame;
    }
  >();
  constructor(
    code: string,
    readonly encounter = false,
    readonly startingScene: SceneId = "MAIN_HOUSE",
    /** Open with the Chapter 0 prologue (only from the main house). */
    readonly prologue = false,
    readonly storyStart?: import("../../../packages/shared/src/storyCheckpoints.js").StoryCheckpointId,
    readonly runtime: RoomRuntime = productionRuntime,
  ) {
    this.state = {
      roomCode: code,
      storyStart,
      storyVersion,
      phase: "LOBBY",
      sceneId: "FOREST_RUINS",
      serverTick: 0,
      worldRevision: 0,
      players: {},
      enemies: {},
      projectiles: {},
      puzzles: {},
      interactables: {},
      boss: null,
      checkpoint: "Clearing",
    };
    this.reset();
  }
  add(socketId: string) {
    if (this.sessions.size >= 2)
      throw Error("Room is full. Exactly two heroes can join.");
    const id = this.runtime.id(),
      token = this.runtime.id();
    this.sessions.set(id, {
      token,
      socketId,
      expires: Infinity,
      input: neutral(),
      received: 0,
    });
    this.state.players[id] = {
      id,
      sceneId: this.state.sceneId,
      role: null,
      ready: false,
      connected: true,
      x: 120,
      y: 450,
      vx: 0,
      vy: 0,
      grounded: false,
      hp: 100,
      maxHp: 100,
      facing: 0,
      actionState: "idle",
      cooldowns: {},
      skillPoints: 0,
      unlockedSkills: [],
      lastProcessedInputSeq: 0,
    };
    return {
      roomCode: this.state.roomCode,
      playerId: id,
      reconnectToken: token,
    };
  }
  select(id: string, role: Role) {
    if (this.state.phase !== "LOBBY")
      throw Error("Roles can only change in the lobby.");
    if (
      Object.values(this.state.players).some(
        (p) => p.id !== id && p.role === role,
      )
    )
      throw Error("That role is already taken.");
    if (
      this.state.players[id].role !== role ||
      !this.state.players[id].appearance
    )
      this.state.players[id].appearance = defaultAppearance(role);
    this.state.players[id].role = role;
    this.state.players[id].unlockedSkills = startingSkills(role);
    this.state.players[id].ready = false;
  }
  setAppearance(id: string, appearance: unknown) {
    const p = this.state.players[id];
    if (this.state.phase !== "LOBBY" || !p.role)
      throw Error("Choose a hero in the lobby first.");
    if (!validAppearance(p.role, appearance))
      throw Error("Invalid appearance palette.");
    p.appearance = { ...appearance };
    p.ready = false;
  }
  ready(id: string, ready: boolean) {
    const p = this.state.players[id];
    if (!p.role) throw Error("Choose a role first.");
    p.ready = ready;
    const players = Object.values(this.state.players);
    if (
      players.length === 2 &&
      players.every((p) => p.ready && p.connected) &&
      players[0].role !== players[1].role
    ) {
      this.reset();
      this.state.phase = "PLAYING";
    }
  }
  unlock(id: string, nodeId: string) {
    const p = this.state.players[id],
      s = skills.find((s) => s.id === nodeId);
    if (!s || s.role !== p.role)
      throw Error("Skill is unavailable for this hero.");
    if (p.unlockedSkills.includes(nodeId)) {
      if (s.cost === 0) return;
      throw Error("Already unlocked.");
    }
    if (s.prerequisites.some((n) => !p.unlockedSkills.includes(n)))
      throw Error("Unlock the previous skill first.");
    if (p.skillPoints < s.cost) throw Error("Not enough skill points.");
    p.skillPoints -= s.cost;
    p.unlockedSkills.push(nodeId);
  }
  resume(id: string, token: string, socketId: string) {
    const s = this.sessions.get(id);
    if (!s || s.token !== token || s.expires < this.runtime.now())
      throw Error("Reconnect failed. Create or join a new room.");
    // A client that reconnects before the server has noticed its old socket
    // drop takes the session over (the app closes the old socket); refusing
    // it sent the player back to the title screen mid-game.
    s.socketId = socketId;
    s.expires = Infinity;
    s.input = neutral();
    s.movementQueue?.clear();
    s.movementInput = neutral(this.state.players[id].lastProcessedInputSeq);
    this.state.players[id].movementEpoch =
      (this.state.players[id].movementEpoch ?? 0) + 1;
    this.state.players[id].movementInput = neutral(
      this.state.players[id].lastProcessedInputSeq,
    );
    s.primaryEdges = [];
    s.aim = null;
    s.scheduledCasts = [];
    s.pushEdges = [];
    delete this.state.players[id].heavyCharge;
    this.primaryWasHeld.delete(id);
    this.state.players[id].connected = true;
    return {
      roomCode: this.state.roomCode,
      playerId: id,
      reconnectToken: token,
    };
  }
  /**
   * A player's socket closed. `socketId` names which one: a socket the
   * session has already moved on from (a reconnect took over) changes nothing.
   */
  disconnect(id: string, socketId?: string) {
    const session = this.sessions.get(id);
    if (socketId && session && session.socketId !== socketId) return;
    this.blackHoleRequests.delete(id);
    this.releaseTalk(id);
    for (const [key, hole] of Object.entries(this.state.blackHoles ?? {}))
      if (hole.owner === id) delete this.state.blackHoles![key];
    const s = this.sessions.get(id);
    if (s) {
      s.socketId = null;
      s.expires = this.runtime.now() + 30000;
      s.input = neutral();
      s.movementQueue?.clear();
      s.movementInput = neutral(this.state.players[id].lastProcessedInputSeq);
      s.primaryEdges = [];
      s.aim = null;
      s.scheduledCasts = [];
      s.pushEdges = [];
      delete this.state.players[id].heavyCharge;
      this.primaryWasHeld.delete(id);
      this.state.players[id].connected = false;
    }
  }
  reset() {
    this.inventory.clear();
    this.state.inventory = emptyInventory();
    this.state.inventoryTargets = {};
    this.savedMaps.clear();
    this.travelReadyTick = 0;
    this.pendingSwords.clear();
    const w = this.state;
    w.sceneId = this.encounter ? "FOREST_RUINS" : this.startingScene;
    w.bridgePuzzle =
      w.sceneId === "BRIDGE_RUINS" ? newBridgePuzzle() : undefined;
    w.phase = "LOBBY";
    w.worldRevision++;
    w.puzzles = {
      gate: {
        id: "gate",
        physical: false,
        arcane: false,
        complete: false,
        progress: 0,
      },
      bridge: {
        id: "bridge",
        physical: false,
        arcane: false,
        complete: false,
        progress: 0,
      },
      engine: {
        id: "engine",
        physical: false,
        arcane: false,
        complete: false,
        progress: 0,
      },
    };
    delete w.slowTime;
    w.pushableOffsets = {};
    w.interactables = { crate: { x: 790, y: 430 } };
    w.boss = null;
    w.blackHoles = {};
    w.projectiles = {};
    w.projectileImpacts = [];
    this.primaryWasHeld.clear();
    this.interactWasHeld.clear();
    this.blackHoleRequests.clear();
    this.flightRequests.clear();
    this.sprintRequests.clear();
    this.carried.clear();
    this.slowTimeRequests.clear();
    w.enemies = Object.fromEntries(
      forestEncounter.map((e) => [e.id, spawnEnemy(e.id, e.type, e.x, e.y)]),
    );
    if (w.sceneId === "MAIN_HOUSE" || w.sceneId === "BRIDGE_RUINS")
      w.enemies = {};
    if (w.sceneId === "GRIFFIN_ENCLOSURE") {
      ensureGriffin(w, this.inventory);
      w.enemies = {};
      w.checkpoint = "Griffin Enclosure";
    }
    if (w.sceneId === "GODDESS_SHRINE") {
      ensureShrine(w, this.inventory);
      w.enemies = {};
      w.checkpoint = "Goddess Shrine";
    }
    if (w.sceneId === "MIRROR_POND") {
      ensureMirrorPond(w, this.inventory);
      w.enemies = {};
    }
    if (w.sceneId === "HEDGE_MAZE") {
      ensureHedgeMaze(w, this.inventory);
      w.enemies = spawnMazeEnemies();
    }
    if (this.encounter) {
      for (const key of ["gate", "bridge"]) w.puzzles[key].complete = true;
      w.checkpoint = "Enemy validation encounter";
    }
    w.checkpoint = this.encounter
      ? "Enemy validation encounter"
      : w.sceneId === "BRIDGE_RUINS"
        ? "The Bridge That Hates Cooperation"
        : w.sceneId === "MAIN_HOUSE"
          ? "Main house"
          : "Clearing";
    Object.values(w.players).forEach((p, i) => {
      if ((p.flightRemaining ?? 0) > 0) p.cooldowns.flight = 7;
      delete p.combat;
      delete p.heavyCharge;
      Object.assign(p, {
        flightRemaining: 0,
        flightWasHeld: false,
        flightGround: undefined,
        sprintRemaining: 0,
        sprintWasHeld: false,
        movementIntent: { x: 0, y: 0 },
        movementEpoch: (p.movementEpoch ?? 0) + 1,
        movementInput: neutral(),
        sceneId: w.sceneId,
        x: this.encounter
          ? 550
          : maps[w.sceneId].spawn.x +
            (["MAIN_HOUSE", "BRIDGE_RUINS", "HEDGE_MAZE"].includes(w.sceneId)
              ? i * 50
              : 0),
        y:
          w.sceneId === "HEDGE_MAZE"
            ? maps.HEDGE_MAZE.spawn.y
            : w.sceneId === "BRIDGE_RUINS"
              ? maps.BRIDGE_RUINS.spawn.y
              : w.sceneId === "MAIN_HOUSE"
                ? maps.MAIN_HOUSE.spawn.y
                : 430 + i * 50,
        vx: 0,
        vy: 0,
        hp: 100,
        skillPoints: 0,
        unlockedSkills: startingSkills(p.role),
        cooldowns: {},
        lastProcessedInputSeq: 0,
      });
      if (w.sceneId === "GRIFFIN_ENCLOSURE")
        Object.assign(p, griffinSpawn(p.role));
      if (w.sceneId === "MIRROR_POND") Object.assign(p, pondSpawn(p.role));
      if (w.sceneId === "GODDESS_SHRINE") {
        Object.assign(p, shrineSpawn(p.role));
        w.checkpoint = "Goddess Shrine";
      }
      const s = this.sessions.get(p.id);
      if (s) {
        s.input = neutral();
        s.movementQueue?.clear();
        s.movementInput = neutral();
        s.primaryEdges = [];
        s.aim = null;
        s.scheduledCasts = [];
        s.pushEdges = [];
      }
    });
    delete w.story;
    if (this.storyStart && w.sceneId === "MAIN_HOUSE")
      beginStoryCheckpoint(w, this.storyHost, this.storyStart);
    else if (this.prologue && w.sceneId === "MAIN_HOUSE")
      beginPrologue(w, this.storyHost);
  }
  /** A hero has read the current story line (see prologue.ts). */
  readStoryLine(playerId: string, cutscene: string, line: number) {
    if (!this.state.players[playerId]) throw Error("Join a room first.");
    return {
      accepted: readLine(this.state, this.storyHost, playerId, cutscene, line),
    };
  }
  /** A hero picks their reason to go on (Chapter 0's last choice). */
  chooseStoryLine(
    playerId: string,
    cutscene: string,
    line: number,
    choice: string,
  ) {
    if (!this.state.players[playerId]) throw Error("Join a room first.");
    return {
      accepted: chooseMotivation(this.state, playerId, cutscene, line, choice),
    };
  }
  transition(scene: World["sceneId"], backwards = false) {
    this.pendingSwords.clear();
    for (const id of Object.keys(this.state.players)) this.releaseTalk(id);
    const w = this.state;
    const previous = w.sceneId;
    const questTravel =
      previous === "GODDESS_SHRINE" || scene === "GODDESS_SHRINE";
    this.savedMaps.set(previous, {
      bridgePuzzle: w.bridgePuzzle,
      enemies: w.enemies,
      boss: w.boss,
    });
    const saved = this.savedMaps.get(scene);
    if (scene === "GRIFFIN_ENCLOSURE") ensureGriffin(w, this.inventory);
    if (scene === "GODDESS_SHRINE") ensureShrine(w, this.inventory);
    if (scene === "HEDGE_MAZE") ensureHedgeMaze(w, this.inventory);
    if (scene === "PUZZLE_GLADE") ensureGlade(w);
    if (scene === "MIRROR_POND") {
      ensureMirrorPond(w, this.inventory);
      mirrorPondState(w.puzzles)!.entryPassed = false;
    }
    this.travelReadyTick = w.serverTick + ticksFor(1);
    delete w.slowTime;
    w.sceneId = scene;
    w.bridgePuzzle = scene === "BRIDGE_RUINS" ? newBridgePuzzle() : undefined;
    w.worldRevision++;
    w.checkpoint =
      scene === "BRIDGE_RUINS"
        ? "The Bridge That Hates Cooperation"
        : isPostTownScene(scene)
          ? postTownRoute[scene].name
          : scene === "FOREST_RUINS"
            ? "Clearing"
            : scene === "AIRSHIP"
              ? "Airship deck"
              : "Stormbound Warden";
    w.blackHoles = {};
    w.projectiles = {};
    w.projectileImpacts = [];
    this.primaryWasHeld.clear();
    this.interactWasHeld.clear();
    this.blackHoleRequests.clear();
    this.flightRequests.clear();
    this.sprintRequests.clear();
    this.carried.clear();
    this.slowTimeRequests.clear();
    w.enemies =
      scene === "FOREST_RUINS"
        ? Object.fromEntries(
            forestEncounter.map((e) => [
              e.id,
              spawnEnemy(e.id, e.type, e.x, e.y),
            ]),
          )
        : {};
    if (scene === "GRIFFIN_ENCLOSURE") w.checkpoint = "Griffin Enclosure";
    if (scene === "MIRROR_POND") {
      w.checkpoint = "Mirror Pond";
      w.enemies = {};
    }
    if (scene === "HEDGE_MAZE") {
      w.checkpoint = "Hedge Maze";
      w.enemies = spawnMazeEnemies();
    }
    if (scene === "MONSTER_CLEARING")
      w.enemies = Object.fromEntries([
        ["clearing-moss", spawnEnemy("clearing-moss", "mossling", 560, 340)],
        [
          "clearing-moss-2",
          spawnEnemy("clearing-moss-2", "mossling", 700, 480),
        ],
        ["clearing-wisp", spawnEnemy("clearing-wisp", "cinder_wisp", 820, 360)],
      ]);
    if (scene === "AIRSHIP_BOSS")
      w.boss = { hp: 220, phase: "SHIELDED", shieldReturned: false };
    if (saved) {
      w.bridgePuzzle = saved.bridgePuzzle;
      w.enemies = saved.enemies;
      w.boss = saved.boss;
    } else if (scene !== "AIRSHIP_BOSS") {
      w.boss = null;
    }

    Object.values(w.players).forEach((p, i) => {
      if ((p.flightRemaining ?? 0) > 0) p.cooldowns.flight = 7;
      delete p.combat;
      delete p.heavyCharge;
      const session = this.sessions.get(p.id);
      if (session) {
        session.input = neutral(session.input.seq);
        session.movementQueue?.clear();
        session.movementInput = neutral(p.lastProcessedInputSeq);
        session.primaryEdges = [];
        session.aim = null;
        session.scheduledCasts = [];
        session.pushEdges = [];
      }
      Object.assign(p, {
        flightRemaining: 0,
        flightWasHeld: false,
        flightGround: undefined,
        movementIntent: { x: 0, y: 0 },
        sceneId: scene,
        movementEpoch: (p.movementEpoch ?? 0) + 1,
        movementInput: neutral(p.lastProcessedInputSeq),
        ...maps[scene].spawn,
        x: maps[scene].spawn.x + i * 50,
        vx: 0,
        vy: 0,
        hp: questTravel ? p.hp : 100,
      });
    });
    if (scene === "GODDESS_SHRINE") {
      w.checkpoint = "Goddess Shrine";
      const arrival =
        previous === "GRIFFIN_ENCLOSURE"
          ? { x: 640, y: 160 }
          : previous === "MIRROR_POND"
            ? { x: 160, y: 576 }
            : previous === "HEDGE_MAZE"
              ? { x: 1120, y: 576 }
              : null;
      for (const p of Object.values(w.players))
        this.relocate(p, scene, arrival ?? shrineSpawn(p.role));
    }
    if (scene === "GRIFFIN_ENCLOSURE")
      for (const p of Object.values(w.players))
        Object.assign(p, griffinSpawn(p.role));
    if (scene === "MIRROR_POND")
      for (const p of Object.values(w.players))
        Object.assign(p, pondSpawn(p.role));
    if (scene === "MAIN_HOUSE") w.checkpoint = "Main house";
    if (previous === "GODDESS_SHRINE" && scene === "FOREST_RUINS") {
      for (const p of Object.values(w.players))
        this.relocate(p, scene, maps.FOREST_RUINS.spawn);
    } else if (previous === "MIRROR_POND" && scene === "FOREST_RUINS") {
      for (const p of Object.values(w.players))
        this.relocate(p, scene, maps.FOREST_RUINS.points.shrine);
    } else if (previous === "HEDGE_MAZE" && scene === "FOREST_RUINS") {
      for (const p of Object.values(w.players))
        this.relocate(p, scene, maps.FOREST_RUINS.points.shrine);
    } else if (
      backwards &&
      scene !== "GODDESS_SHRINE" &&
      saved &&
      maps[scene].points.exit
    ) {
      const exit = maps[scene].points.exit;
      Object.values(w.players).forEach((p) =>
        this.relocate(p, scene, { x: exit.x - 96, y: exit.y }),
      );
    }
  }
  /**
   * A hero opens or closes a conversation with a villager. While anyone is
   * talking to it, the villager stands still for every client and faces them;
   * afterwards it resumes its walk from the same spot.
   */
  talkToNpc(playerId: string, npcId: string, talking: boolean) {
    const w = this.state,
      p = w.players[playerId];
    if (!p) throw Error("Join a room first.");
    if (!talking) {
      this.releaseTalk(playerId, npcId);
      return { talking: false };
    }
    const npc = npcs.find((n) => n.id === npcId);
    if (!npc) throw Error("There is nobody like that here.");
    if (w.phase !== "PLAYING" || !p.connected || p.hp <= 0)
      throw Error("You can't talk right now.");
    if ((p.sceneId ?? w.sceneId) !== npc.scene)
      throw Error("They aren't here.");
    const pose = npcPose(npc, w.serverTick, w);
    // Slack covers the villager's walk while the request was in flight.
    if (Math.hypot(pose.x - p.x, pose.y - p.y) > NPC_TALK_RANGE + 32)
      throw Error("Move closer to talk.");
    // Some conversations are story scenes (the errand, later the questions).
    if (!storyLocked(w, p) && storyConversation(w, this.storyHost, p, npcId))
      return { talking: false, story: true };
    this.releaseTalk(playerId);
    const talk = ((w.npcTalks ??= {})[npcId] ??= {
      since: w.serverTick,
      listeners: [],
    });
    if (!talk.listeners.includes(playerId)) talk.listeners.push(playerId);
    return { talking: true };
  }
  /** End a hero's conversation(s); a villager nobody talks to walks on. */
  private releaseTalk(playerId: string, only?: string) {
    const w = this.state;
    for (const [id, talk] of Object.entries(w.npcTalks ?? {})) {
      if (only && id !== only) continue;
      talk.listeners = talk.listeners.filter((l) => l !== playerId);
      if (talk.listeners.length) continue;
      (w.npcOffsets ??= {})[id] =
        (w.npcOffsets[id] ?? 0) + Math.max(0, w.serverTick - talk.since);
      delete w.npcTalks![id];
    }
  }
  private relocate(
    p: Player,
    sceneId: SceneId,
    spawn: { x: number; y: number },
  ) {
    this.releaseTalk(p.id);
    // Pick a nearby walkable arrival when the partner occupies the door spawn.
    const arrival =
      [0, 32, -32, 64, -64]
        .map((dx) => ({ x: spawn.x + dx, y: spawn.y }))
        .find(
          (point) =>
            !Object.values(this.state.players).some(
              (other) =>
                other.id !== p.id &&
                (other.sceneId ?? this.state.sceneId) === sceneId &&
                Math.hypot(other.x - point.x, other.y - point.y) < 30,
            ) &&
            !collisionRects(
              sceneId,
              this.state.puzzles,
              this.state.pushableOffsets,
            ).some(
              (r) =>
                point.x + 13 > r.x &&
                point.x - 13 < r.x + r.w &&
                point.y + 13 > r.y &&
                point.y - 13 < r.y + r.h,
            ),
        ) ?? spawn;
    if ((p.flightRemaining ?? 0) > 0) p.cooldowns.flight = 7;
    Object.assign(p, arrival, {
      flightRemaining: 0,
      flightWasHeld: false,
      flightGround: undefined,
      sceneId,
      movementEpoch: (p.movementEpoch ?? 0) + 1,
      movementInput: neutral(p.lastProcessedInputSeq),
      vx: 0,
      vy: 0,
      movementIntent: { x: 0, y: 0 },
      actionState: "idle",
    });
    delete p.combat;
    delete p.heavyCharge;
    this.primaryWasHeld.delete(p.id);
    const session = this.sessions.get(p.id)!;
    session.input = {
      ...neutral(session.input.seq),
      interactHeld: session.input.interactHeld,
    };
    session.primaryEdges = [];
    session.aim = null;
    session.scheduledCasts = [];
    session.pushEdges = [];
    session.movementQueue?.clear();
    session.movementInput = neutral(p.lastProcessedInputSeq);
    // Retain the interaction latch until E is released: no held-key door loops.
    for (const [id, hole] of Object.entries(this.state.blackHoles ?? {}))
      if (hole.owner === p.id) delete this.state.blackHoles![id];
    for (const [id, q] of Object.entries(this.state.projectiles))
      if (q.owner === p.id) delete this.state.projectiles[id];
  }
  // Input tick is a scheduling request, never permission for additional movement.
  receiveInput(id: string, input: InputFrame) {
    const s = this.sessions.get(id),
      p = this.state.players[id];
    if (!s || !p || input.seq <= Math.max(s.input.seq, p.lastProcessedInputSeq))
      return false;
    if (
      (input.movementEpoch !== undefined || input.targetTick !== undefined) &&
      input.movementEpoch !== (p.movementEpoch ?? 0)
    )
      return false;
    if (
      input.targetTick !== undefined &&
      input.targetTick > this.state.serverTick + MAX_PREDICTION_LEAD
    )
      return false;
    if (input.moveX || input.moveY) s.aim = { x: input.moveX, y: input.moveY };
    if (input.primaryHeld !== s.input.primaryHeld) {
      s.primaryEdges ||= [];
      if (s.primaryEdges.length < 8)
        s.primaryEdges.push({ held: input.primaryHeld, aim: s.aim ?? null });
    }
    if (
      p.role === "EMBER" &&
      input.targetTick !== undefined &&
      input.primaryHeld &&
      !s.input.primaryHeld
    ) {
      s.scheduledCasts ||= [];
      if (s.scheduledCasts.length < 4)
        s.scheduledCasts.push(
          Math.max(this.state.serverTick + 1, input.targetTick),
        );
    }
    if (!!input.pushHeld !== !!s.input.pushHeld) {
      s.pushEdges ||= [];
      if (s.pushEdges.length < 8) s.pushEdges.push(!!input.pushHeld);
    }
    if (input.blackHoleHeld && !s.input.blackHoleHeld) {
      this.blackHoleRequests.add(id);
      s.blackHoleAim = s.aim ?? null;
    }
    if (input.flightHeld && !s.input.flightHeld) this.flightRequests.add(id);
    if (input.sprintHeld && !s.input.sprintHeld) this.sprintRequests.add(id);
    if (input.slowTimeHeld && !s.input.slowTimeHeld)
      this.slowTimeRequests.add(id);
    s.input = { ...input };
    s.received = this.runtime.now();
    s.receivedTick = Math.max(
      this.state.serverTick,
      input.targetTick ?? this.state.serverTick,
    );
    if (input.targetTick !== undefined) {
      s.movementQueue ||= new Map();
      const tick = Math.max(this.state.serverTick + 1, input.targetTick);
      s.movementQueue.set(tick, { ...input, targetTick: tick });
    } else {
      // Legacy intent senders still receive exactly one movement step per tick.
      s.movementQueue = undefined;
    }
    return true;
  }
  tick() {
    const w = this.state;
    w.serverTick++;
    if (
      w.phase !== "PLAYING" ||
      Object.values(w.players).some((p) => !p.connected)
    )
      return;
    if (w.slowTime && w.serverTick >= w.slowTime.endsTick) delete w.slowTime;
    tickStory(w, this.storyHost);
    if (w.sceneId === "PUZZLE_GLADE") {
      ensureGlade(w);
      tickGlade(w);
    }
    for (const id of this.slowTimeRequests) {
      const p = w.players[id],
        session = this.sessions.get(id);
      if (
        p?.role === "EMBER" &&
        p.hp > 0 &&
        p.unlockedSkills.includes("slow_time") &&
        !p.cooldowns.slow_time &&
        session &&
        this.runtime.now() - session.received < 250 &&
        !w.slowTime
      ) {
        w.slowTime = {
          owner: id,
          startedTick: w.serverTick,
          endsTick: w.serverTick + ticksFor(10),
        };
        p.cooldowns.slow_time = 20;
      }
    }
    this.slowTimeRequests.clear();
    if (w.slowTime)
      for (const p of Object.values(w.players)) {
        if (p.role === "OATH" && (p.sprintRemaining ?? 0) > 0) continue;
        const sword = this.pendingSwords.get(p.id);
        if (sword) sword.due += 1 - SLOW_TIME_SCALE;
        if (p.combat) p.combat.startedTick += 1 - SLOW_TIME_SCALE;
      }
    const beforeMovement = new Map(
      Object.values(w.players).map((p) => [p.id, { x: p.x, y: p.y }]),
    );
    w.projectileImpacts = (w.projectileImpacts || []).filter(
      (e) => w.serverTick - e.tick <= ticksFor(1),
    );
    const near = (
      p: { x: number; y: number },
      q: { x: number; y: number },
      d = 75,
    ) => Math.hypot(p.x - q.x, p.y - q.y) < d;
    for (const p of Object.values(w.players)) {
      const s = this.sessions.get(p.id)!;
      // Story scenes hold only the heroes in them (and anyone offstage).
      const locked = storyLocked(w, p);
      // Announced but not yet begun, a story walk lets the hero's own movement
      // play out (their screen already predicted it): no snap back.
      const mark = w.story?.walks?.[p.id];
      const lockMove = locked && !(mark && w.serverTick < mark.start);
      const fresh =
        s.receivedTick === undefined
          ? this.runtime.now() - s.received < 250
          : w.serverTick <= s.receivedTick + Math.ceil(0.25 / DT);
      const edge = fresh && !locked ? s.primaryEdges?.shift() : undefined;
      const i =
        fresh && !locked
          ? {
              ...s.input,
              primaryHeld: edge?.held ?? s.input.primaryHeld,
              pushHeld: s.pushEdges?.shift() ?? s.input.pushHeld,
            }
          : neutral(s.input.seq);
      if (!fresh || locked) {
        s.primaryEdges = [];
        s.pushEdges = [];
        s.scheduledCasts = [];
        this.blackHoleRequests.delete(p.id);
        this.slowTimeRequests.delete(p.id);
      }
      const sceneId = p.sceneId ?? w.sceneId;
      const map = maps[sceneId];
      // A key still held when a story scene ends must be released first.
      const heldE = locked ? fresh && s.input.interactHeld : i.interactHeld;
      const interactEdge = !locked && heldE && !this.interactWasHeld.get(p.id);
      this.interactWasHeld.set(p.id, heldE);
      if (i.pushHeld && !i.primaryHeld && !i.secondaryHeld)
        pushPondMirror(w, p);
      let movement = i;
      if (s.movementQueue && lockMove) {
        s.movementQueue.clear();
        s.movementInput = neutral(s.input.seq);
        movement = neutral(s.input.seq);
      } else if (s.movementQueue) {
        if (!fresh) s.movementQueue.clear();
        for (const [tick, command] of [...s.movementQueue].sort(
          (a, b) => a[0] - b[0],
        )) {
          if (tick > w.serverTick) continue;
          if (command.seq > (s.movementInput?.seq ?? -1))
            s.movementInput = command;
          s.movementQueue.delete(tick);
        }
        movement = fresh
          ? (s.movementInput ?? neutral(p.lastProcessedInputSeq))
          : neutral(p.lastProcessedInputSeq);
      }
      if (fresh && !locked && this.flightRequests.delete(p.id))
        movement = { ...movement, flightHeld: true };
      if (!fresh) this.flightRequests.delete(p.id);
      if (fresh && !locked && this.sprintRequests.delete(p.id))
        movement = { ...movement, sprintHeld: true };
      if (!fresh) this.sprintRequests.delete(p.id);
      // A hero the story is walking into place moves on the story's input.
      const walk = storyWalkInput(w, p, w.serverTick);
      if (walk) movement = { ...neutral(movement.seq), ...walk };
      p.lastProcessedInputSeq = movement.seq;
      p.movementInput = { ...movement };
      pushBridgeBoulder(w, p, movement);
      const beforeFlightEpoch = p.movementEpoch;
      stepMovement(
        p,
        movement,
        map,
        collisionRects(
          sceneId,
          w.puzzles,
          w.pushableOffsets,
          w.bridgePuzzle,
          w.players,
          w.serverTick,
          p.role,
        ),
        DT,
        !!w.slowTime,
      );
      if (p.movementEpoch !== beforeFlightEpoch) {
        s.movementQueue?.clear();
        s.movementInput = neutral(p.lastProcessedInputSeq);
        s.input = neutral(s.input.seq);
        p.movementInput = neutral(p.lastProcessedInputSeq);
      }
      for (const k in p.cooldowns)
        if (k !== "dash" && k !== "sprint" && k !== "flight")
          p.cooldowns[k] = Math.max(
            0,
            p.cooldowns[k] -
              DT *
                (k === "attack" &&
                w.slowTime &&
                !(p.role === "OATH" && (p.sprintRemaining ?? 0) > 0)
                  ? SLOW_TIME_SCALE
                  : 1),
          );
      p.actionState = i.secondaryHeld
        ? "guard"
        : i.primaryHeld
          ? "attack"
          : "idle";
      let strike: "sword" | "heavy" | "cast" | null = null;
      const aimMode = p.flightRemaining ? "TOP_DOWN" : map.mode;
      const aimFrom = (aim: Aim | null | undefined) =>
        aim ? facingFor(aimMode, aim.x, aim.y, p.facing) : p.facing;
      let strikeFacing = aimFrom(edge ? edge.aim : s.aim);
      const heavyEnabled =
        p.role === "OATH" && p.unlockedSkills.includes("heavy");
      const wasHeld = this.primaryWasHeld.get(p.id) || false;
      if (!fresh || p.hp <= 0) delete p.heavyCharge;
      if (heavyEnabled && fresh && p.hp > 0) {
        if (i.primaryHeld && !wasHeld && !p.cooldowns.attack) {
          p.heavyCharge = {
            startedTick: w.serverTick,
            facing: strikeFacing,
            ticks: 0,
            progress: 0,
          };
        }
        if (p.heavyCharge) {
          const charge = p.heavyCharge;
          if (i.primaryHeld) {
            charge.ticks = Math.min(
              heavyTiming.capTicks,
              charge.ticks +
                (w.slowTime && !(p.sprintRemaining && p.sprintRemaining > 0)
                  ? SLOW_TIME_SCALE
                  : 1),
            );
            charge.progress = Math.min(1, charge.ticks / heavyTiming.fullTicks);
            p.actionState = "heavyCharge";
          } else {
            strike =
              charge.ticks >= heavyTiming.minimumTicks ? "heavy" : "sword";
            strikeFacing = charge.facing;
            delete p.heavyCharge;
          }
        }
      } else if (
        i.primaryHeld &&
        (p.role !== "EMBER" || !wasHeld) &&
        !(p.role === "EMBER" && s.movementQueue) &&
        !p.cooldowns.attack &&
        p.hp > 0
      ) {
        strike = p.role === "OATH" ? "sword" : "cast";
      }
      if (p.role === "EMBER" && s.movementQueue && s.scheduledCasts?.length) {
        const due = s.scheduledCasts.some((tick) => tick <= w.serverTick);
        s.scheduledCasts = s.scheduledCasts.filter(
          (tick) => tick > w.serverTick,
        );
        // Movement already stepped this tick, so position and facing equal the
        // predicted state the player saw when pressing.
        if (due && fresh && !p.cooldowns.attack && p.hp > 0) {
          strike = "cast";
          strikeFacing = p.facing;
        }
      }
      this.primaryWasHeld.set(p.id, i.primaryHeld);
      if (strike) {
        p.combat = {
          seq: w.serverTick,
          startedTick: w.serverTick,
          facing: strikeFacing,
          kind: strike,
        };
        p.cooldowns.attack = p.role === "OATH" ? 0.45 : 0.6;
        if (p.role === "OATH") {
          if (strike === "sword")
            this.pendingSwords.set(p.id, {
              due: w.serverTick + swordContactTicks(strikeFacing),
              facing: strikeFacing,
              scene: sceneId,
            });
          else this.resolveSword(p, sceneId, 40, strikeFacing);
        } else {
          const id = this.runtime.id();
          w.projectiles[id] = {
            castTick: w.serverTick,
            castOrigin: { x: p.x, y: p.y },
            fireballLevel: fireballLevel(p.unlockedSkills),
            damage: fireballDamage(fireballLevel(p.unlockedSkills)),
            id,
            sceneId,
            x: p.x,
            y: p.y,
            vx: Math.cos(strikeFacing) * FIREBALL_SPEED,
            vy: Math.sin(strikeFacing) * FIREBALL_SPEED,
            life: FIREBALL_RANGE / FIREBALL_SPEED,
            owner: p.id,
          };
        }
      }
      if (
        this.blackHoleRequests.delete(p.id) &&
        fresh &&
        p.role === "EMBER" &&
        p.hp > 0 &&
        p.unlockedSkills.includes("black_hole") &&
        !p.cooldowns.black_hole
      ) {
        const id = this.runtime.id();
        const holeFacing = aimFrom(s.blackHoleAim);
        w.blackHoles ??= {};
        w.blackHoles[id] = {
          id,
          owner: p.id,
          sceneId,
          x: p.x,
          y: p.y,
          vx: Math.cos(holeFacing) * blackHoleTuning.speed,
          vy: Math.sin(holeFacing) * blackHoleTuning.speed,
          remainingRange: blackHoleTuning.range,
          phase: "travel",
          startedTick: w.serverTick,
          life: blackHoleTuning.duration,
          damaged: [],
        };
        p.cooldowns.black_hole = blackHoleTuning.cooldown;
        p.combat = {
          seq: w.serverTick,
          startedTick: w.serverTick,
          kind: "cast",
          facing: holeFacing,
        };
      }
      const pendingSword = this.pendingSwords.get(p.id);
      if (pendingSword && w.serverTick >= pendingSword.due) {
        this.pendingSwords.delete(p.id);
        if (p.hp > 0 && sceneId === pendingSword.scene)
          this.resolveSword(p, sceneId, 25, pendingSword.facing);
      }
      // The story's own E spots (gathering for the funeral, and so on).
      if (interactEdge && storyInteract(w, p)) continue;
      if (
        interactEdge &&
        sceneId === "MAIN_HOUSE" &&
        near(p, map.points.door, 42)
      ) {
        if (!storyBlocksDoor(w, p, "HOUSE_INTERIOR"))
          this.relocate(p, "HOUSE_INTERIOR", maps.HOUSE_INTERIOR.spawn);
        continue;
      }
      // The shop's stairs: each hero climbs on their own, like the door.
      if (
        interactEdge &&
        sceneId === "HOUSE_INTERIOR" &&
        near(p, map.points.upstairs, 42)
      ) {
        this.relocate(p, "HOUSE_UPPER", maps.HOUSE_UPPER.spawn);
        continue;
      }
      if (
        interactEdge &&
        sceneId === "HOUSE_UPPER" &&
        near(p, map.points.downstairs, 42)
      ) {
        this.relocate(p, "HOUSE_INTERIOR", shopStairsFoot);
        continue;
      }
      if (interactEdge && p.hp > 0) {
        const portal = settlementPortals.find(
          (t) => t.from === sceneId && near(p, t.at, 36),
        );
        if (portal) {
          this.relocate(p, portal.to, portal.arrival);
          continue;
        }
      }
      // Village houses: each hero steps inside on their own, as at the main house.
      if (interactEdge && sceneId === "EMBERBROOK_VILLAGE") {
        const house = villageInteriorIds.find(
          (id) =>
            !villageInteriors[id].outsideScene &&
            near(p, map.points[villageDoorPoint(id)], 42),
        );
        if (house) {
          if (!storyBlocksDoor(w, p, house))
            this.relocate(p, house, maps[house].spawn);
          continue;
        }
      }
      if (interactEdge && p.hp > 0 && w.serverTick >= this.travelReadyTick) {
        // Roads the prologue controls (the forest trail, the clearing).
        const point = Object.entries(map.points).find(([, q]) =>
          near(p, q, 50),
        )?.[0];
        if (point && storyTravel(w, this.storyHost, sceneId, point, p)) {
          if (w.sceneId !== sceneId && p.sceneId !== sceneId) return;
          continue;
        }
        if (
          sceneId === "FOREST_RUINS" &&
          near(p, maps.FOREST_RUINS.points.shrine, 48)
        ) {
          this.transition("GODDESS_SHRINE");
          return;
        }
        if (sceneId === "GODDESS_SHRINE") {
          if (near(p, shrinePoints.north, 48)) {
            this.transition("GRIFFIN_ENCLOSURE");
            return;
          }
          if (near(p, shrinePoints.west, 48)) {
            this.transition("MIRROR_POND");
            return;
          }
          if (near(p, shrinePoints.east, 48)) {
            this.transition("HEDGE_MAZE");
            return;
          }
        }
      }
      if (
        interactEdge &&
        (sceneId === "HOUSE_INTERIOR" || isVillageInterior(sceneId)) &&
        map.doorInteractionBounds &&
        p.x >= map.doorInteractionBounds.x &&
        p.x <= map.doorInteractionBounds.x + map.doorInteractionBounds.w &&
        p.y >= map.doorInteractionBounds.y &&
        p.y <= map.doorInteractionBounds.y + map.doorInteractionBounds.h
      ) {
        if (isVillageInterior(sceneId))
          this.relocate(
            p,
            villageInteriors[sceneId].outsideScene ?? "EMBERBROOK_VILLAGE",
            villageInteriors[sceneId].outside,
          );
        else if (!storyBlocksDoor(w, p, "MAIN_HOUSE"))
          this.relocate(p, "MAIN_HOUSE", { x: 480, y: 344 });
        continue;
      }
      if (
        interactEdge &&
        p.hp > 0 &&
        w.serverTick >= this.travelReadyTick &&
        previousMap[sceneId] &&
        map.points.back &&
        near(p, map.points.back, 42)
      ) {
        this.transition(previousMap[sceneId]!, true);
        return;
      }
      if (
        i.pushHeld &&
        p.role === "OATH" &&
        p.hp > 0 &&
        !i.primaryHeld &&
        !i.secondaryHeld
      ) {
        p.actionState = "push";
        if (sceneId === "FOREST_RUINS" && near(p, w.interactables.crate))
          w.interactables.crate.x = Math.min(
            map.points.plate.x,
            w.interactables.crate.x + DT * 90,
          );
        pushNearby(
          p,
          sceneId,
          w,
          collisionRects(
            sceneId,
            w.puzzles,
            w.pushableOffsets,
            w.bridgePuzzle,
            w.players,
            w.serverTick,
            p.role,
          ),
          DT,
        );
      }
      if (i.interactHeld) {
        if (
          sceneId === "BRIDGE_RUINS" &&
          w.bridgePuzzle?.complete &&
          !finaleBlocksExit(w, sceneId) &&
          near(p, map.points.exit, 50)
        ) {
          this.transition("GODDESS_SHRINE");
          return;
        }
        if (
          sceneId === "MAIN_HOUSE" &&
          near(p, map.points.exit, 50) &&
          !prologueBlocksExit(w, sceneId, "exit")
        ) {
          this.transition("EMBERBROOK_VILLAGE");
          return;
        }
        // Playtest shortcut from the starting map to the Goddess Shrine hub.
        if (
          sceneId === "MAIN_HOUSE" &&
          near(p, map.points.shrine, 50) &&
          !prologueBlocksExit(w, sceneId, "shrine")
        ) {
          this.transition("GODDESS_SHRINE");
          return;
        }
        if (isPostTownScene(sceneId) && near(p, map.points.exit, 50)) {
          // The glade's way onward stays sealed until the statue is seated.
          if (
            (sceneId !== "MONSTER_CLEARING" ||
              Object.values(w.enemies).every((e) => e.hp <= 0)) &&
            (sceneId !== "PUZZLE_GLADE" ||
              (gladeSolved(w.puzzles) && !finaleBlocksExit(w, sceneId)))
          ) {
            this.transition(postTownRoute[sceneId].next);
            return;
          }
        }
        if (sceneId === "FOREST_RUINS") {
          if (p.role === "EMBER" && near(p, map.points.rune))
            w.puzzles.gate.arcane = true;
          if (p.role === "EMBER" && near(p, map.points.crystal))
            w.puzzles.bridge.arcane = true;
        } else if (
          sceneId === "AIRSHIP_BOSS" &&
          p.role === "EMBER" &&
          near(p, map.points.anchor) &&
          w.boss
        ) {
          w.boss.phase = "VULNERABLE";
        }
      }
    }
    if (!w.slowTime) this.carried.clear();
    if (w.slowTime) {
      for (const p of Object.values(w.players)) {
        if (p.role !== "OATH" || p.hp <= 0) continue;
        const old = beforeMovement.get(p.id)!;
        const delta = { x: p.x - old.x, y: p.y - old.y },
          length = Math.hypot(delta.x, delta.y);
        let carry = this.carried.get(p.id);
        const directionChanged =
          !!carry &&
          length > 0 &&
          (delta.x / length) * carry.dx + (delta.y / length) * carry.dy < 0.99;
        if (!length || directionChanged) {
          this.carried.delete(p.id);
          carry = undefined;
        }
        if (!length || directionChanged) continue;
        const boosted = (p.sprintRemaining ?? 0) > 0;
        if (!boosted && !carry) continue;
        if (!carry) {
          carry = {
            dx: delta.x / length,
            dy: delta.y / length,
            targets: new Set(),
          };
          this.carried.set(p.id, carry);
        }
        const scene = p.sceneId ?? w.sceneId;
        const targets = [
          ...Object.values(w.players).filter(
            (q) =>
              q.id !== p.id && q.hp > 0 && (q.sceneId ?? w.sceneId) === scene,
          ),
          ...(scene === w.sceneId
            ? Object.values(w.enemies).filter((e) => e.hp > 0)
            : []),
        ];
        for (const target of targets) {
          const t = Math.max(
            0,
            Math.min(
              1,
              ((target.x - old.x) * delta.x + (target.y - old.y) * delta.y) /
                (length * length),
            ),
          );
          if (
            !carry.targets.has(target.id) &&
            (!boosted ||
              (target.x - old.x) * delta.x + (target.y - old.y) * delta.y <=
                0 ||
              Math.hypot(
                target.x - old.x - t * delta.x,
                target.y - old.y - t * delta.y,
              ) > 26)
          )
            continue;
          carry.targets.add(target.id);
          // Undo the passenger's independent step so it travels with Sieg, not away from him.
          const start = beforeMovement.get(target.id) ?? target;
          const n = constrainMotion(
            start,
            delta,
            maps[scene],
            collisionRects(
              scene,
              w.puzzles,
              w.pushableOffsets,
              w.bridgePuzzle,
              w.players,
              w.serverTick,
              w.players[target.id]?.role,
            ),
          );
          target.x = n.x;
          target.y = n.y;
          target.vx = (n.x - start.x) / DT;
          target.vy = (n.y - start.y) / DT;
          if (
            Math.abs(n.x - start.x - delta.x) > 1e-6 ||
            Math.abs(n.y - start.y - delta.y) > 1e-6
          )
            carry.targets.delete(target.id);
        }
      }
    }
    for (const q of Object.values(w.projectiles)) {
      if (q.effect === "golem_beam") {
        tickGolemBeam(w, q, (p, n) => this.damage(p, n));
        continue;
      }
      const ox = q.x,
        oy = q.y;
      q.x += q.vx * DT * (w.slowTime ? SLOW_TIME_SCALE : 1);
      q.y += q.vy * DT * (w.slowTime ? SLOW_TIME_SCALE : 1);
      q.life -= DT * (w.slowTime ? SLOW_TIME_SCALE : 1);
      // Magic can cross the river, but still respects machinery and stone gates.
      const projectileWalls = collisionRects(
        q.sceneId ?? w.sceneId,
        w.puzzles,
        w.pushableOffsets,
        w.bridgePuzzle,
        w.players,
        w.serverTick,
      );
      const burnedBush =
        q.faction !== "enemies" &&
        ((q.sceneId ?? w.sceneId) === "HEDGE_MAZE"
          ? burnMazeBush(w, q.owner, { x: ox, y: oy }, q)
          : (q.sceneId ?? w.sceneId) === "PUZZLE_GLADE" &&
            burnGladeBushes(w, q.owner, { x: ox, y: oy }, q));
      let collided =
        burnedBush ||
        ((q.sceneId ?? w.sceneId) === "MIRROR_POND"
          ? tracePondFireball(w, q, { x: ox, y: oy }, { x: q.x, y: q.y })
          : (q.sceneId ?? w.sceneId) === "BRIDGE_RUINS"
            ? bridgeGateWalls(w.bridgePuzzle, w.players).some((r) =>
                segmentHits(ox, oy, q.x, q.y, r, q.radius ?? 4),
              )
            : projectileWalls
                // Magic flies over the griffin's moat and the woods' pond.
                .filter(
                  (r) =>
                    ((q.sceneId ?? w.sceneId) !== "GRIFFIN_ENCLOSURE" &&
                      (q.sceneId ?? w.sceneId) !== "PROLOGUE_WOODS") ||
                    !r.terrain,
                )
                .some((r) => segmentHits(ox, oy, q.x, q.y, r, q.radius ?? 4)));
      if (
        !collided &&
        (q.sceneId ?? w.sceneId) === "BRIDGE_RUINS" &&
        w.bridgePuzzle &&
        !w.bridgePuzzle.firstGateOpen &&
        bridgeEntryTargetVisible(w.bridgePuzzle) &&
        q.faction !== "enemies"
      ) {
        const target = bridgeMovingTarget(w.bridgePuzzle.trapClock);
        if (
          segmentHits(
            ox,
            oy,
            q.x,
            q.y,
            { x: target.x - 20, y: target.y - 24, w: 40, h: 48 },
            q.radius ?? 4,
          )
        ) {
          hitBridgeEntryTarget(w, q.owner, q);
          collided = true;
        }
      }
      if (
        !collided &&
        (q.sceneId ?? w.sceneId) === "BRIDGE_RUINS" &&
        q.faction !== "enemies" &&
        segmentHits(
          ox,
          oy,
          q.x,
          q.y,
          {
            x: bridgePoints.target.x - 24,
            y: bridgePoints.target.y - 24,
            w: 48,
            h: 48,
          },
          q.radius ?? 4,
        )
      ) {
        hitBridgeLock(w, q.owner, q);
        collided = true;
      }
      const griffin = griffinState(w.puzzles);
      if (
        !collided &&
        (q.sceneId ?? w.sceneId) === "GRIFFIN_ENCLOSURE" &&
        q.faction !== "enemies" &&
        griffin &&
        griffin.hp > 0 &&
        segmentHits(ox, oy, q.x, q.y, {
          x: griffin.x - 30,
          y: griffin.y - 30,
          w: 60,
          h: 60,
        })
      ) {
        damageGriffin(w, q.damage ?? 20);
        collided = true;
      }
      if (!collided) {
        const targets =
          q.faction === "enemies"
            ? Object.values(w.players).filter(
                (p) =>
                  p.connected &&
                  p.hp > 0 &&
                  (p.sceneId ?? w.sceneId) === (q.sceneId ?? w.sceneId),
              )
            : Object.values(w.enemies).filter(
                (e) =>
                  e.state !== "DEAD" && (q.sceneId ?? w.sceneId) === w.sceneId,
              );
        for (const target of targets) {
          const radius = q.faction === "enemies" ? 17 : 28;
          const body = {
            x: target.x - radius,
            y: target.y - radius,
            w: radius * 2,
            h: radius * 2,
          };
          if (segmentHits(ox, oy, q.x, q.y, body)) {
            collided = true;
            settleAtContact(q, ox, oy, body);
            if (q.faction === "enemies")
              this.damage(target as Player, q.damage ?? 12);
            else
              damageEnemy(
                target as import("../../../packages/shared/src/gameTypes.js").Enemy,
                q.damage ?? 20,
                w.serverTick,
              );
            break;
          }
        }
      }
      if (
        !collided &&
        q.faction !== "enemies" &&
        (q.sceneId ?? w.sceneId) === w.sceneId &&
        w.boss &&
        w.boss.phase === "VULNERABLE" &&
        near(q, maps[w.sceneId].points.boss, 45)
      ) {
        collided = true;
        w.boss.hp -= (q.damage ?? 20) / 2;
      }
      if (collided) {
        w.projectileImpacts!.push({
          id: q.id,
          x: q.x,
          y: q.y,
          owner: q.owner,
          tick: w.serverTick,
          sceneId: q.sceneId ?? w.sceneId,
        });
        q.life = 0;
      }
      if (q.life <= 0) delete w.projectiles[q.id];
    }
    const recoveryEpochs = new Map(
      Object.values(w.players).map((p) => [p.id, p.movementEpoch]),
    );
    // A story scene that holds the world: monsters and traps wait for it.
    const held = finaleHoldsWorld(w);
    if (!held) {
      tickBridgePuzzle(w);
      tickMirrorPond(w, beforeMovement);
    }
    updatePondChest(w, this.inventory);
    for (const p of Object.values(w.players))
      if (p.movementEpoch !== recoveryEpochs.get(p.id)) {
        const session = this.sessions.get(p.id);
        if (session) {
          session.input = neutral(session.input.seq);
          session.movementQueue?.clear();
          session.movementInput = neutral(p.lastProcessedInputSeq);
          session.primaryEdges = [];
          session.aim = null;
          session.scheduledCasts = [];
          session.pushEdges = [];
        }
        p.movementInput = neutral(p.lastProcessedInputSeq);
        p.movementIntent = { x: 0, y: 0 };
      }
    if (!held) {
      tickEnemies(w, (p, n) => this.damage(p, n));
      tickBlackHoles(w);
      tickGriffin(w, (p, n) => this.damage(p, n));
      tickMazeRunner(w);
    }
    updateHedgeMazeTargets(w, this.inventory);
    if (w.sceneId === "FOREST_RUINS") {
      w.puzzles.bridge.physical = near(
        w.interactables.crate,
        maps[w.sceneId].points.plate,
        30,
      );
      for (const key of ["gate", "bridge"]) {
        const q = w.puzzles[key];
        if (q.physical && q.arcane && !q.complete) {
          q.complete = true;
          w.worldRevision++;
        }
      }
      if (
        w.puzzles.bridge.complete &&
        shrineComplete(w) &&
        Object.values(w.players).some((p) =>
          near(p, maps[w.sceneId].points.exit),
        )
      )
        this.transition("AIRSHIP");
    } else if (w.sceneId === "AIRSHIP") {
      const q = w.puzzles.engine,
        ps = Object.values(w.players);
      q.physical = ps.some(
        (p) =>
          p.role === "OATH" &&
          this.sessions.get(p.id)!.input.interactHeld &&
          near(p, maps[w.sceneId].points.crank),
      );
      q.arcane = ps.some(
        (p) =>
          p.role === "EMBER" &&
          this.sessions.get(p.id)!.input.interactHeld &&
          near(p, maps[w.sceneId].points.core),
      );
      q.progress =
        q.physical && q.arcane ? q.progress + DT : Math.max(0, q.progress - DT);
      if (q.progress >= 3) q.complete = true;
      if (q.complete && ps.some((p) => near(p, maps[w.sceneId].points.exit)))
        this.transition("AIRSHIP_BOSS");
    } else if (w.boss) {
      const b = w.boss;
      if (b.hp <= 110 && !b.shieldReturned) {
        b.shieldReturned = true;
        b.phase = "SHIELDED";
      }
      if (w.serverTick % ticksFor(1.5) === 0)
        for (const p of Object.values(w.players))
          if (near(p, maps[w.sceneId].points.boss, 160)) this.damage(p, 12);
      if (b.hp <= 0) {
        b.hp = 0;
        b.phase = "DEFEATED";
        w.phase = "COMPLETE";
      }
    }
  }
  private resolveSword(
    p: Player,
    sceneId: SceneId,
    damage: number,
    facing: number,
  ) {
    const w = this.state,
      map = maps[sceneId];
    const griffin = griffinState(w.puzzles);
    if (
      sceneId === "GRIFFIN_ENCLOSURE" &&
      griffin &&
      !griffinAirborne(griffin) &&
      inSwordArc(p, griffin, facing, 100) &&
      !collisionRects(sceneId, w.puzzles)
        .filter((r) => !r.terrain)
        .some((r) => segmentHits(p.x, p.y, griffin.x, griffin.y, r))
    )
      damageGriffin(w, damage);
    for (const e of Object.values(sceneId === w.sceneId ? w.enemies : {}))
      if (
        e.state !== "DEAD" &&
        inSwordArc(p, e, facing, 85) &&
        !collisionRects(
          sceneId,
          w.puzzles,
          w.pushableOffsets,
          w.bridgePuzzle,
          w.players,
          w.serverTick,
        ).some((r) => segmentHits(p.x, p.y, e.x, e.y, r))
      )
        damageEnemy(e, damage, w.serverTick);
    if (
      sceneId === w.sceneId &&
      w.boss &&
      inSwordArc(p, map.points.boss, facing, 95) &&
      w.boss.phase === "VULNERABLE"
    )
      w.boss.hp -= damage;
    if (
      sceneId === "FOREST_RUINS" &&
      inSwordArc(p, map.points.bramble, facing, 75)
    )
      w.puzzles.gate.physical = true;
  }
  damage(p: Player, n: number) {
    if (n > 0) this.pendingSwords.delete(p.id);
    const defended =
      p.actionState === "guard" && (p.role === "OATH" || p.role === "EMBER");
    if (defended && n > 0)
      p.defensiveHit = {
        seq: (p.defensiveHit?.seq ?? 0) + 1,
        tick: this.state.serverTick,
      };
    p.hp -= defended ? n * 0.25 : n;
    // The prologue ambush is unwinnable but never fatal.
    if (ambushProtects(this.state, p)) p.hp = Math.max(AMBUSH_FLOOR, p.hp);
    // The Mossling Woods are only practice.
    if (woodsProtects(this.state, p)) p.hp = Math.max(WOODS_HP_FLOOR, p.hp);
    delete p.heavyCharge;
    if (p.hp <= 0) {
      p.hp = 100;
      Object.assign(p, maps[p.sceneId ?? this.state.sceneId].spawn);
      if (this.encounter && this.state.sceneId === "FOREST_RUINS") {
        p.x = 550;
        p.y = 450;
      }
      p.vx = p.vy = 0;
      p.movementEpoch = (p.movementEpoch ?? 0) + 1;
      p.movementInput = neutral(p.lastProcessedInputSeq);
      const session = this.sessions.get(p.id)!;
      session.movementQueue?.clear();
      session.movementInput = neutral(p.lastProcessedInputSeq);
    }
  }
}
