import type {
  World,
  Rect,
  Player,
  Role,
  InputFrame,
  Projectile,
} from "./gameTypes.js";
import { DT, SLOW_TIME_SCALE, SPEED } from "./constants.js";
export const BRIDGE_SIZE = { width: 960, height: 1536 };
export const BOULDER_HALF = 24;
export const bridgeRects: Rect[] = [1184, 800].map((y) => ({
  x: 384,
  y,
  w: 192,
  h: 64,
}));
export const bridgePoints = {
  boulderStart: { x: 288, y: 1408 },
  plateA: { x: 288, y: 1264 },
  plateB: { x: 288, y: 736 },
  goldSwitch: { x: 672, y: 1088 },
  trialStart: { x: 288, y: 1120 },
  target: { x: 480, y: 416 },
  firePad: { x: 480, y: 832 },
  switchWest: { x: 288, y: 208 },
  switchEast: { x: 672, y: 208 },
  exit: { x: 480, y: 144 },
};
export interface BridgePuzzleState {
  stage: 1 | 2 | 3 | 4;
  boulder: { id: "bridge-boulder"; x: number; y: number };
  targetHit: boolean;
  firstGateOpen: boolean;
  goldSwitchOpen: boolean;
  finalTargetHit: boolean;
  trapClock: number;
  spikeProgress: number;
  pendingSpike: boolean;
  bridgeClosedUntil: number[];
  holdTicks: number;
  complete: boolean;
  failures: number;
  message: string;
}
export const newBridgePuzzle = (): BridgePuzzleState => ({
  stage: 1,
  boulder: { id: "bridge-boulder", ...bridgePoints.boulderStart },
  targetHit: false,
  firstGateOpen: false,
  goldSwitchOpen: false,
  finalTargetHit: false,
  trapClock: 0,
  spikeProgress: 0,
  pendingSpike: false,
  bridgeClosedUntil: [0, 0],
  holdTicks: 0,
  complete: false,
  failures: 0,
  message:
    "Sieg: push the boulder onto plate A. Coco: shoot the moving target's front weak point.",
});
export const inside = (p: { x: number; y: number }, r: Rect) =>
  p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
export const onPlate = (
  p: Player | undefined,
  q: { x: number; y: number },
  radius = 24,
) => !!p && p.hp > 0 && Math.hypot(p.x - q.x, p.y - q.y) <= radius;
export const boulderRect = (s: BridgePuzzleState): Rect => ({
  x: s.boulder.x - 24,
  y: s.boulder.y - 24,
  w: 48,
  h: 48,
});
export const plateRect = (which: "A" | "B"): Rect => {
  const p = which === "A" ? bridgePoints.plateA : bridgePoints.plateB;
  return {
    x: p.x - (which === "A" ? 40 : 52),
    y: p.y - 40,
    w: which === "A" ? 80 : 104,
    h: 80,
  };
};
export function heavyOnPlate(s: BridgePuzzleState, which: "A" | "B") {
  const b = boulderRect(s),
    r = plateRect(which);
  return (
    b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h
  );
}
export const bridgeEntryTargetVisible = (s: BridgePuzzleState) =>
  heavyOnPlate(s, "A");
export const bridgeMovingTarget = (clock: number) => ({
  x: 672 + 56 * Math.sin((clock * Math.PI * 2) / 3),
  y: 1160,
});
// The sled fully withdraws from the stone lane into water, then returns.
export const bridgeTrap = (clock: number, index: number) => ({
  x: 368 - 112 * Math.cos((clock * Math.PI * 2) / 2.4 + index * 0.25),
  y: [1040, 960, 880][index],
});
export const spikeRect = (clock: number, index: number): Rect => {
  const t = bridgeTrap(clock, index);
  return { x: t.x - 64, y: t.y - 28, w: 128, h: 56 };
};
const touch = (a: Rect, b: Rect) =>
  a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
const swept = (a: Rect, b: Rect): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x),
  h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y),
});
export const bridgeRoleWalls = (role: Role | null | undefined): Rect[] =>
  role === "EMBER"
    ? [
        { x: 192, y: 288, w: 384, h: 512 },
        { x: 192, y: 800, w: 256, h: 64 },
        { x: 192, y: 864, w: 384, h: 480 },
      ]
    : role === "OATH"
      ? [{ x: 576, y: 288, w: 192, h: 1056 }]
      : [];
const walkable: Rect[] = [
  { x: 192, y: 256, w: 192, h: 1088 },
  { x: 576, y: 256, w: 192, h: 1088 },
  { x: 192, y: 1344, w: 576, h: 128 },
  { x: 192, y: 96, w: 576, h: 192 },
  ...bridgeRects,
];
export const bridgeFixedWalls: Rect[] = [];
for (let y = 0; y < 1536; y += 32) {
  let start: number | null = null;
  for (let x = 0; x <= 960; x += 32) {
    const blocked =
      x < 960 && !walkable.some((r) => inside({ x: x + 16, y: y + 16 }, r));
    if (blocked && start === null) start = x;
    if (!blocked && start !== null) {
      bridgeFixedWalls.push({
        x: start,
        y,
        w: x - start,
        h: 32,
        ...(start >= 384 && x <= 576 && y >= 320 && y < 1280
          ? { terrain: "water" as const }
          : {}),
      });
      start = null;
    }
  }
}
export function bridgeOpen(
  s: BridgePuzzleState,
  w: Pick<World, "serverTick">,
  index: number,
) {
  if (s.finalTargetHit) return true;
  return (
    index === 1 &&
    heavyOnPlate(s, "B") &&
    w.serverTick >= s.bridgeClosedUntil[index]
  );
}
export function bridgeGateWalls(
  s: BridgePuzzleState | undefined,
  _players: Record<string, Player> = {},
): Rect[] {
  if (!s) return [];
  return [
    ...(!s.firstGateOpen ? [{ x: 576, y: 1120, w: 192, h: 16 }] : []),
    ...(!s.goldSwitchOpen ? [{ x: 192, y: 1088, w: 192, h: 16 }] : []),
    ...(!s.finalTargetHit
      ? [
          { x: 192, y: 288, w: 192, h: 16 },
          { x: 576, y: 288, w: 192, h: 16 },
        ]
      : []),
    ...(!s.complete ? [{ x: 448, y: 96, w: 64, h: 192 }] : []),
  ];
}
export function bridgeDynamicWalls(
  s: BridgePuzzleState | undefined,
  players: Record<string, Player> = {},
  tick = 0,
): Rect[] {
  if (!s) return bridgeRects;
  return [
    ...bridgeRects
      .filter((_, i) => !bridgeOpen(s, { serverTick: tick }, i))
      .map((r) => ({ ...r, terrain: "water" as const })),
    ...bridgeGateWalls(s, players),
    boulderRect(s),
    ...(s.goldSwitchOpen
      ? [0, 1, 2].map((i) => spikeRect(s.trapClock, i))
      : []),
  ];
}
// Rectangular sweep picks the nearest contact, even at boosted movement speeds.
function sweepObject(b: Rect, dx: number, dy: number, walls: Rect[]): Rect {
  const next = { ...b };
  for (const axis of ["x", "y"] as const) {
    const delta = axis === "x" ? dx : dy;
    if (!delta) continue;
    const other = axis === "x" ? "y" : "x",
      size = axis === "x" ? "w" : "h",
      otherSize = axis === "x" ? "h" : "w";
    let end = next[axis] + delta;
    for (const r of walls) {
      if (
        next[other] + next[otherSize] <= r[other] ||
        next[other] >= r[other] + r[otherSize]
      )
        continue;
      if (
        delta > 0 &&
        next[axis] + next[size] <= r[axis] &&
        end + next[size] > r[axis]
      )
        end = Math.min(end, r[axis] - next[size]);
      else if (
        delta < 0 &&
        next[axis] >= r[axis] + r[size] &&
        end < r[axis] + r[size]
      )
        end = Math.max(end, r[axis] + r[size]);
      else if (
        next[axis] < r[axis] + r[size] &&
        next[axis] + next[size] > r[axis]
      )
        end = next[axis];
    }
    next[axis] = end;
  }
  return next;
}
export function pushBridgeBoulder(w: World, p: Player, input: InputFrame) {
  const s = w.bridgePuzzle;
  if (
    !s ||
    (p.sceneId ?? w.sceneId) !== "BRIDGE_RUINS" ||
    p.role !== "OATH" ||
    p.hp <= 0 ||
    !input.pushHeld ||
    input.primaryHeld ||
    input.secondaryHeld
  )
    return;
  const length = Math.hypot(input.moveX, input.moveY);
  if (!length) return;
  const dx = input.moveX / length,
    dy = input.moveY / length,
    b = boulderRect(s),
    cx = Math.max(b.x, Math.min(b.x + b.w, p.x)),
    cy = Math.max(b.y, Math.min(b.y + b.h, p.y));
  if (
    Math.hypot(cx - p.x, cy - p.y) > 18 ||
    (s.boulder.x - p.x) * dx + (s.boulder.y - p.y) * dy <= 0 ||
    Math.abs((s.boulder.x - p.x) * dy - (s.boulder.y - p.y) * dx) > 24
  )
    return;
  const boosted =
    (p.sprintRemaining ?? 0) > DT ||
    (input.sprintHeld &&
      !p.sprintWasHeld &&
      p.unlockedSkills.includes("dash") &&
      !(p.cooldowns.sprint > 0));
  const distance =
    SPEED *
    DT *
    (w.slowTime ? (boosted ? 1 : SLOW_TIME_SCALE) : boosted ? 2 : 1);
  const obstacles = [
    // Object-only retaining rail: prevents stranding the stone beyond plate A
    // before Coco satisfies the first gate. It never moves the stone itself.
    ...(!s.firstGateOpen ? [{ x: 192, y: 1224, w: 192, h: 16 }] : []),
    ...bridgeFixedWalls,
    ...bridgeGateWalls(s, w.players),
    ...bridgeRoleWalls(p.role),
    ...bridgeRects.filter((_, i) => !bridgeOpen(s, w, i)),
    ...Object.values(w.players)
      .filter(
        (q) =>
          q.id !== p.id &&
          q.hp > 0 &&
          (q.sceneId ?? w.sceneId) === "BRIDGE_RUINS",
      )
      .map((q) => ({ x: q.x - 13, y: q.y - 13, w: 26, h: 26 })),
  ];
  const next = sweepObject(b, dx * distance, dy * distance, obstacles);
  if (
    s.goldSwitchOpen &&
    [0, 1, 2].some((i) =>
      touch(
        swept(b, next),
        swept(
          spikeRect(s.trapClock, i),
          spikeRect(s.trapClock + DT * (w.slowTime ? SLOW_TIME_SCALE : 1), i),
        ),
      ),
    )
  ) {
    s.pendingSpike = true;
    return;
  }
  s.boulder.x = next.x + 24;
  s.boulder.y = next.y + 24;
}
function recover(p: Player, x: number, y: number) {
  p.x = x;
  p.y = y;
  p.vx = p.vy = 0;
  p.movementEpoch = (p.movementEpoch ?? 0) + 1;
}
export function tickBridgePuzzle(w: World) {
  const s = w.bridgePuzzle;
  if (!s || w.sceneId !== "BRIDGE_RUINS") return;
  const players = Object.values(w.players).filter(
      (p) => (p.sceneId ?? w.sceneId) === "BRIDGE_RUINS",
    ),
    sieg = players.find((p) => p.role === "OATH"),
    coco = players.find((p) => p.role === "EMBER");
  const before = s.trapClock;
  s.trapClock += DT * (w.slowTime ? SLOW_TIME_SCALE : 1);
  if (!s.firstGateOpen && s.targetHit && heavyOnPlate(s, "A")) {
    s.firstGateOpen = true;
    s.stage = 2;
    s.message =
      "Coco: pass Gate 1 and hold E at the golden switch. Sieg: retrieve the same boulder.";
  }
  if (
    s.firstGateOpen &&
    !s.goldSwitchOpen &&
    onPlate(coco, bridgePoints.goldSwitch) &&
    coco?.movementInput?.interactHeld
  ) {
    s.goldSwitchOpen = true;
    s.stage = 3;
    s.message =
      "Push the boulder through all three sideways spikes. Combine Slow Time and Super Speed.";
  }
  if (s.goldSwitchOpen && sieg) {
    const stoneHit =
      s.pendingSpike ||
      [0, 1, 2].some((i) =>
        touch(
          boulderRect(s),
          swept(spikeRect(before, i), spikeRect(s.trapClock, i)),
        ),
      );
    const playerHit = [0, 1, 2].some((i) =>
      touch(
        { x: sieg.x - 13, y: sieg.y - 13, w: 26, h: 26 },
        swept(spikeRect(before, i), spikeRect(s.trapClock, i)),
      ),
    );
    if (stoneHit) {
      s.boulder.x = bridgePoints.trialStart.x;
      s.boulder.y = bridgePoints.trialStart.y;
      recover(sieg, 288, 1160);
      s.spikeProgress = 0;
      s.pendingSpike = false;
      s.failures++;
      s.message =
        "Spike hit: Sieg and the same boulder return to trial start. Earlier unlocks remain.";
    } else if (playerHit) {
      // Character contact cannot teleport a stone left elsewhere in the trial.
      const x = [288, 240, 336].find(
        (x) => !touch({ x: x - 13, y: 1147, w: 26, h: 26 }, boulderRect(s)),
      )!;
      recover(sieg, x, 1160);
      s.failures++;
      s.message =
        "Sieg hit a spike: return to the entry. The boulder remains where it was physically left.";
    } else
      s.spikeProgress = [1040, 960, 880].filter(
        (y) => s.boulder.y + 24 < y - 28,
      ).length;
  }
  for (let i = 0; i < bridgeRects.length; i++) {
    const occupants = players.filter(
      (p) =>
        !(p.flightRemaining && p.flightRemaining > 0) &&
        inside(p, bridgeRects[i]),
    );
    const unstable =
      !bridgeOpen(s, w, i) || (!s.finalTargetHit && occupants.length > 1);
    if (unstable && occupants.length) {
      s.bridgeClosedUntil[i] = w.serverTick + 60;
      s.failures++;
      for (const p of occupants) {
        recover(p, p.role === "EMBER" ? 640 : 288, bridgeRects[i].y + 32);
        for (const [id, q] of Object.entries(w.projectiles))
          if (q.owner === p.id) delete w.projectiles[id];
      }
      s.message =
        "Bridge collapsed: return to the landing, restore the boulder weight, and retry. Earlier trials stay complete.";
    }
  }
  if (s.goldSwitchOpen && !s.finalTargetHit && heavyOnPlate(s, "B"))
    s.message =
      "Leave the boulder on golden plate B. Coco: stand on the bridge center pad and shoot the distant target's front.";
  if (s.finalTargetHit) {
    s.stage = 4;
    s.message = s.complete
      ? "Congratulations on your healthy boundaries. Reunite at the castle exit."
      : "Final gates permanently open. Hold both final switches together.";
  }
  if (s.finalTargetHit && !s.complete) {
    s.holdTicks =
      onPlate(sieg, bridgePoints.switchWest) &&
      onPlate(coco, bridgePoints.switchEast)
        ? s.holdTicks + 1
        : 0;
    if (s.holdTicks >= 23) s.complete = true;
  }
}
function frontShot(q: Projectile, target: { x: number; y: number }) {
  return (
    q.vy < 0 &&
    Math.abs(q.vx) <= -q.vy * 0.35 &&
    !!q.castOrigin &&
    q.castOrigin.y > target.y + 24
  );
}
export function hitBridgeEntryTarget(w: World, owner: string, q?: Projectile) {
  const s = w.bridgePuzzle,
    p = w.players[owner];
  if (
    !s ||
    s.firstGateOpen ||
    !bridgeEntryTargetVisible(s) ||
    p?.role !== "EMBER" ||
    (p.sceneId ?? w.sceneId) !== "BRIDGE_RUINS" ||
    !q ||
    !frontShot(q, bridgeMovingTarget(s.trapClock)) ||
    !q.castOrigin ||
    q.castOrigin.x < 576 ||
    q.castOrigin.x > 768 ||
    q.castOrigin.y < 1188 ||
    q.castOrigin.y >= 1344
  )
    return false;
  s.targetHit = true;
  return true;
}
export function hitBridgeLock(w: World, owner: string, q?: Projectile) {
  const s = w.bridgePuzzle,
    p = w.players[owner];
  if (
    !s ||
    !s.goldSwitchOpen ||
    p?.role !== "EMBER" ||
    !q ||
    !q.castOrigin ||
    Math.abs(q.castOrigin.x - 480) > 20 ||
    Math.abs(q.castOrigin.y - bridgePoints.firePad.y) > 20 ||
    !frontShot(q, bridgePoints.target) ||
    !heavyOnPlate(s, "B") ||
    !bridgeOpen(s, w, 1)
  )
    return false;
  s.finalTargetHit = true;
  s.stage = 4;
  return true;
}
