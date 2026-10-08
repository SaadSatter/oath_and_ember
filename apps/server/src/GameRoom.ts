import {
  forestEncounter,
  spawnEnemy,
} from "../../../packages/shared/src/enemies.js";
import { damageEnemy, tickEnemies, segmentHits } from "./enemySimulation.js";
import {
  defaultAppearance,
  validAppearance,
} from "../../../packages/shared/src/appearance.js";
import { randomUUID } from "node:crypto";
import {
  heavyTiming,
  swordContactTicks,
} from "../../../packages/shared/src/combat.js";
import { DT } from "../../../packages/shared/src/constants.js";
import {
  neutral,
  type World,
  type Role,
  type InputFrame,
  type Player,
  type SceneId,
} from "../../../packages/shared/src/gameTypes.js";
import { maps, collisionRects } from "../../../packages/shared/src/maps.js";
import { move } from "../../../packages/shared/src/movement.js";
import { skills } from "../../../packages/shared/src/abilities.js";
export class GameRoom {
  state: World;
  private interactWasHeld = new Map<string, boolean>();
  private pendingSwords = new Map<string, { due: number; scene: SceneId }>();
  private primaryWasHeld = new Map<string, boolean>();
  sessions = new Map<
    string,
    {
      token: string;
      socketId: string | null;
      expires: number;
      input: InputFrame;
      received: number;
      primaryEdges?: boolean[];
    }
  >();
  constructor(
    code: string,
    readonly encounter = false,
    readonly startingScene: SceneId = "MAIN_HOUSE",
  ) {
    this.state = {
      roomCode: code,
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
    const id = randomUUID(),
      token = randomUUID();
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
      skillPoints: 1,
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
    if (p.unlockedSkills.includes(nodeId)) throw Error("Already unlocked.");
    if (s.prerequisites.some((n) => !p.unlockedSkills.includes(n)))
      throw Error("Unlock the previous skill first.");
    if (p.skillPoints < s.cost) throw Error("Not enough skill points.");
    p.skillPoints -= s.cost;
    p.unlockedSkills.push(nodeId);
  }
  resume(id: string, token: string, socketId: string) {
    const s = this.sessions.get(id);
    if (!s || s.token !== token || s.expires < Date.now())
      throw Error("Reconnect failed. Create or join a new room.");
    if (s.socketId) throw Error("This session is already connected.");
    s.socketId = socketId;
    s.expires = Infinity;
    s.input = neutral();
    s.primaryEdges = [];
    delete this.state.players[id].heavyCharge;
    this.primaryWasHeld.delete(id);
    this.state.players[id].connected = true;
    return {
      roomCode: this.state.roomCode,
      playerId: id,
      reconnectToken: token,
    };
  }
  disconnect(id: string) {
    const s = this.sessions.get(id);
    if (s) {
      s.socketId = null;
      s.expires = Date.now() + 30000;
      s.input = neutral();
      s.primaryEdges = [];
      delete this.state.players[id].heavyCharge;
      this.primaryWasHeld.delete(id);
      this.state.players[id].connected = false;
    }
  }
  reset() {
    this.pendingSwords.clear();
    const w = this.state;
    w.sceneId = this.encounter ? "FOREST_RUINS" : this.startingScene;
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
    w.interactables = { crate: { x: 790, y: 430 } };
    w.boss = null;
    w.projectiles = {};
    w.projectileImpacts = [];
    this.primaryWasHeld.clear();
    this.interactWasHeld.clear();
    w.enemies = Object.fromEntries(
      forestEncounter.map((e) => [e.id, spawnEnemy(e.id, e.type, e.x, e.y)]),
    );
    if (w.sceneId === "MAIN_HOUSE") w.enemies = {};
    if (this.encounter) {
      for (const key of ["gate", "bridge"]) w.puzzles[key].complete = true;
      w.checkpoint = "Enemy validation encounter";
    }
    w.checkpoint = this.encounter
      ? "Enemy validation encounter"
      : w.sceneId === "MAIN_HOUSE"
        ? "Main house"
        : "Clearing";
    Object.values(w.players).forEach((p, i) => {
      delete p.combat;
      delete p.heavyCharge;
      Object.assign(p, {
        movementIntent: { x: 0, y: 0 },
        sceneId: w.sceneId,
        x: this.encounter
          ? 550
          : maps[w.sceneId].spawn.x + (w.sceneId === "MAIN_HOUSE" ? i * 50 : 0),
        y: w.sceneId === "MAIN_HOUSE" ? maps.MAIN_HOUSE.spawn.y : 430 + i * 50,
        vx: 0,
        vy: 0,
        hp: 100,
        skillPoints: 1,
        unlockedSkills: [],
        cooldowns: {},
        lastProcessedInputSeq: 0,
      });
      const s = this.sessions.get(p.id);
      if (s) {
        s.input = neutral();
        s.primaryEdges = [];
      }
    });
  }
  transition(scene: World["sceneId"]) {
    this.pendingSwords.clear();
    const w = this.state;
    const previous = w.sceneId;
    w.sceneId = scene;
    w.worldRevision++;
    w.checkpoint =
      scene === "FOREST_RUINS"
        ? "Clearing"
        : scene === "AIRSHIP"
          ? "Airship deck"
          : "Stormbound Warden";
    w.projectiles = {};
    w.projectileImpacts = [];
    this.primaryWasHeld.clear();
    this.interactWasHeld.clear();
    w.enemies =
      scene === "FOREST_RUINS"
        ? Object.fromEntries(
            forestEncounter.map((e) => [
              e.id,
              spawnEnemy(e.id, e.type, e.x, e.y),
            ]),
          )
        : {};
    if (scene === "AIRSHIP_BOSS")
      w.boss = { hp: 220, phase: "SHIELDED", shieldReturned: false };
    Object.values(w.players).forEach((p, i) => {
      delete p.combat;
      delete p.heavyCharge;
      const session = this.sessions.get(p.id);
      if (session) {
        session.input = neutral(session.input.seq);
        session.primaryEdges = [];
      }
      Object.assign(p, {
        movementIntent: { x: 0, y: 0 },
        sceneId: scene,
        ...maps[scene].spawn,
        x: maps[scene].spawn.x + i * 50,
        vx: 0,
        vy: 0,
        hp: 100,
      });
      if (previous !== "MAIN_HOUSE" && previous !== "HOUSE_INTERIOR")
        p.skillPoints++;
    });
  }
  private relocate(
    p: Player,
    sceneId: SceneId,
    spawn: { x: number; y: number },
  ) {
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
            !collisionRects(sceneId, this.state.puzzles).some(
              (r) =>
                point.x + 13 > r.x &&
                point.x - 13 < r.x + r.w &&
                point.y + 13 > r.y &&
                point.y - 13 < r.y + r.h,
            ),
        ) ?? spawn;
    Object.assign(p, arrival, {
      sceneId,
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
    // Retain the interaction latch until E is released: no held-key door loops.
    for (const [id, q] of Object.entries(this.state.projectiles))
      if (q.owner === p.id) delete this.state.projectiles[id];
  }
  tick() {
    const w = this.state;
    w.serverTick++;
    if (
      w.phase !== "PLAYING" ||
      Object.values(w.players).some((p) => !p.connected)
    )
      return;
    w.projectileImpacts = (w.projectileImpacts || []).filter(
      (e) => w.serverTick - e.tick <= 30,
    );
    const near = (
      p: { x: number; y: number },
      q: { x: number; y: number },
      d = 75,
    ) => Math.hypot(p.x - q.x, p.y - q.y) < d;
    for (const p of Object.values(w.players)) {
      const s = this.sessions.get(p.id)!;
      const fresh = Date.now() - s.received < 250;
      const i = fresh
        ? {
            ...s.input,
            primaryHeld: s.primaryEdges?.shift() ?? s.input.primaryHeld,
          }
        : neutral(s.input.seq);
      if (!fresh) s.primaryEdges = [];
      const sceneId = p.sceneId ?? w.sceneId;
      const map = maps[sceneId];
      const interactEdge = i.interactHeld && !this.interactWasHeld.get(p.id);
      this.interactWasHeld.set(p.id, i.interactHeld);
      p.lastProcessedInputSeq = i.seq;
      move(p, i, map, collisionRects(sceneId, w.puzzles), DT);
      for (const k in p.cooldowns)
        p.cooldowns[k] = Math.max(0, p.cooldowns[k] - DT);
      p.actionState = i.secondaryHeld
        ? "guard"
        : i.primaryHeld
          ? "attack"
          : "idle";
      if (
        i.secondaryHeld &&
        (p.unlockedSkills.includes("dash") ||
          p.unlockedSkills.includes("blink")) &&
        !p.cooldowns.dash
      ) {
        move(
          p,
          { ...i, moveX: Math.cos(p.facing), moveY: Math.sin(p.facing) },
          map,
          collisionRects(sceneId, w.puzzles),
          DT * 3,
        );
        p.cooldowns.dash = 2;
      }
      let strike: "sword" | "heavy" | "cast" | null = null;
      let strikeFacing = p.facing;
      const heavyEnabled =
        p.role === "OATH" && p.unlockedSkills.includes("heavy");
      const wasHeld = this.primaryWasHeld.get(p.id) || false;
      if (!fresh || p.hp <= 0) delete p.heavyCharge;
      if (heavyEnabled && fresh && p.hp > 0) {
        if (i.primaryHeld && !wasHeld && !p.cooldowns.attack) {
          p.heavyCharge = {
            startedTick: w.serverTick,
            facing: p.facing,
            ticks: 0,
            progress: 0,
          };
        }
        if (p.heavyCharge) {
          const charge = p.heavyCharge;
          if (i.primaryHeld) {
            charge.ticks = Math.min(heavyTiming.capTicks, charge.ticks + 1);
            charge.progress = Math.min(1, charge.ticks / heavyTiming.fullTicks);
            p.actionState = "heavyCharge";
          } else {
            strike =
              charge.ticks >= heavyTiming.minimumTicks ? "heavy" : "sword";
            strikeFacing = charge.facing;
            delete p.heavyCharge;
          }
        }
      } else if (i.primaryHeld && !p.cooldowns.attack && p.hp > 0) {
        strike = p.role === "OATH" ? "sword" : "cast";
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
              scene: sceneId,
            });
          else this.resolveSword(p, sceneId, 40);
        } else {
          const id = randomUUID();
          w.projectiles[id] = {
            id,
            sceneId,
            x: p.x,
            y: p.y,
            vx: Math.cos(strikeFacing) * 420,
            vy: Math.sin(strikeFacing) * 420,
            life: 1.6,
            owner: p.id,
          };
        }
      }
      const pendingSword = this.pendingSwords.get(p.id);
      if (pendingSword && w.serverTick >= pendingSword.due) {
        this.pendingSwords.delete(p.id);
        if (p.hp > 0 && sceneId === pendingSword.scene)
          this.resolveSword(p, sceneId, 25);
      }
      if (
        interactEdge &&
        sceneId === "MAIN_HOUSE" &&
        near(p, map.points.door, 42)
      ) {
        this.relocate(p, "HOUSE_INTERIOR", maps.HOUSE_INTERIOR.spawn);
        continue;
      }
      if (
        interactEdge &&
        sceneId === "HOUSE_INTERIOR" &&
        near(p, map.points.door, 42)
      ) {
        this.relocate(p, "MAIN_HOUSE", { x: 480, y: 344 });
        continue;
      }
      if (i.interactHeld) {
        if (sceneId === "MAIN_HOUSE" && near(p, map.points.exit, 50)) {
          this.transition("FOREST_RUINS");
          return;
        }
        if (sceneId === "FOREST_RUINS") {
          if (p.role === "EMBER" && near(p, map.points.rune))
            w.puzzles.gate.arcane = true;
          if (
            (p.role === "OATH" || p.unlockedSkills.includes("telekinesis")) &&
            near(p, w.interactables.crate)
          ) {
            w.interactables.crate.x = Math.min(
              map.points.plate.x,
              w.interactables.crate.x + DT * 90,
            );
          }
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
    for (const q of Object.values(w.projectiles)) {
      const ox = q.x,
        oy = q.y;
      q.x += q.vx * DT;
      q.y += q.vy * DT;
      q.life -= DT;
      let collided = collisionRects(q.sceneId ?? w.sceneId, w.puzzles).some(
        (r) => segmentHits(ox, oy, q.x, q.y, r, q.radius ?? 4),
      );
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
          if (
            segmentHits(ox, oy, q.x, q.y, {
              x: target.x - radius,
              y: target.y - radius,
              w: radius * 2,
              h: radius * 2,
            })
          ) {
            collided = true;
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
        w.boss.hp -= 10;
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
    tickEnemies(w, (p, n) => this.damage(p, n));
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
          Object.values(w.players).forEach((p) => p.skillPoints++);
        }
      }
      if (
        w.puzzles.bridge.complete &&
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
      if (w.serverTick % 45 === 0)
        for (const p of Object.values(w.players))
          if (near(p, maps[w.sceneId].points.boss, 160)) this.damage(p, 12);
      if (b.hp <= 0) {
        b.hp = 0;
        b.phase = "DEFEATED";
        w.phase = "COMPLETE";
      }
    }
  }
  private resolveSword(p: Player, sceneId: SceneId, damage: number) {
    const w = this.state,
      map = maps[sceneId];
    const near = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      d = 75,
    ) => Math.hypot(a.x - b.x, a.y - b.y) < d;
    for (const e of Object.values(sceneId === w.sceneId ? w.enemies : {}))
      if (
        e.state !== "DEAD" &&
        near(p, e, 85) &&
        !collisionRects(sceneId, w.puzzles).some((r) =>
          segmentHits(p.x, p.y, e.x, e.y, r),
        )
      )
        damageEnemy(e, damage, w.serverTick);
    if (
      sceneId === w.sceneId &&
      w.boss &&
      near(p, map.points.boss, 95) &&
      w.boss.phase === "VULNERABLE"
    )
      w.boss.hp -= damage;
    if (sceneId === "FOREST_RUINS" && near(p, map.points.bramble))
      w.puzzles.gate.physical = true;
  }
  damage(p: Player, n: number) {
    if (n > 0) this.pendingSwords.delete(p.id);
    const defended =
      p.actionState === "guard" &&
      (p.unlockedSkills.includes("guard") || p.unlockedSkills.includes("ward"));
    if (defended && n > 0)
      p.defensiveHit = {
        seq: (p.defensiveHit?.seq ?? 0) + 1,
        tick: this.state.serverTick,
      };
    p.hp -= defended ? n * 0.25 : n;
    delete p.heavyCharge;
    if (p.hp <= 0) {
      p.hp = 100;
      Object.assign(p, maps[p.sceneId ?? this.state.sceneId].spawn);
      if (this.encounter && this.state.sceneId === "FOREST_RUINS") {
        p.x = 550;
        p.y = 450;
      }
      p.vx = p.vy = 0;
    }
  }
}
