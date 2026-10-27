/** PRIVILEGED ENGINEERING REACHABILITY ORACLE. Never import into a player or fair baseline.
 * Reuses legacy source planners only to diagnose full-quest feasibility. All quest state
 * changes go through ordinary movement/input/item APIs; no rewards or positions are patched.
 */
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import assert from "node:assert/strict";
import { GameRoom } from "../../apps/server/src/GameRoom.js";
import {
  neutral,
  type Player,
  type InputFrame,
} from "../../packages/shared/src/gameTypes.js";
import { collisionRects, maps } from "../../packages/shared/src/maps.js";
import {
  shrinePoints,
  shrineComplete,
} from "../../packages/shared/src/shrine.js";
import { ticksFor } from "../../packages/shared/src/constants.js";

const root = resolve(".");
const output = resolve(
  process.argv[2] ?? "evaluation-runs/fresh-quest-engineering",
);
await mkdir(output, { recursive: true });
const require = createRequire(import.meta.url);
const temporary = await mkdtemp(resolve(tmpdir(), "oath-quest-oracle-"));
async function loadCurrentPondPlanner() {
  const location = resolve(
    root,
    "apps/server/test/mirrorPondWalkthrough.test.ts",
  );
  const original = await readFile(location, "utf8");
  const parsed = ts.createSourceFile(
    location,
    original,
    ts.ScriptTarget.Latest,
    true,
  );
  const call = (
    parsed.statements.find(
      (statement) =>
        ts.isExpressionStatement(statement) &&
        ts.isCallExpression(statement.expression) &&
        statement.expression.expression.getText(parsed) === "it",
    ) as ts.ExpressionStatement
  ).expression as ts.CallExpression;
  const callback = call.arguments[1] as ts.ArrowFunction;
  let body = (callback.body as ts.Block).getText(parsed).slice(1, -1);
  body = body.slice(body.indexOf("  const w = r.state"));
  body = body.replaceAll("r.tick();", "advance();");
  body = body.replace(
    /    \/\/ Overshooting either way can still be corrected\.[\s\S]*?    expect\(Math\.abs\(halfTurn\(pond\.mirrors\[i\] - p\.angle\)\)\)\.toBeLessThan\(1e-7\);/,
    "",
  );
  const shooting = `
    while(c.cooldowns.flight)tick();
    tick(c,{flightHeld:true});
    go(c,p.shot.x,p.shot.y);
    tick(c,{moveX:p.incoming.x,moveY:p.incoming.y});
    tick(c,{primaryHeld:true});
    for(let n=0;n<ticksFor(25)&&!pond.torches[i];n++)tick();
    assert(pond.torches[i], 'Current engineering pond shot '+i);
    turnTo(i,p.rest);
`;
  const loopEnd = "  while (c.cooldowns.flight) tick();";
  const end = body.indexOf(
    loopEnd,
    body.indexOf("  for (let i = 0; i < 4; i++)"),
  );
  const close = body.lastIndexOf("  }", end);
  body = body.slice(0, close) + shooting + body.slice(close);
  body += `\nwhile(c.cooldowns.flight)tick();tick(c,{flightHeld:true});go(c,24*32,19.5*32);r.useItem(c.id,{requestId:'fresh-pond-chest',targetId:'pond-vanity-mirror-chest'});assert(w.inventory!.counts.vanity_mirror===1);`;
  let imports = original
    .slice(0, original.indexOf("it("))
    .replace(/import \{ it, expect \} from "vitest";/, "");
  imports = imports.replace(
    /from\s+(["'])([^"']+)\1/g,
    (_all, q, spec) =>
      `from ${q}${spec.startsWith(".") ? resolve(dirname(location), spec) : spec}${q}`,
  );
  const checks = `const expect=(v:any)=>({toBe:(x:any)=>assert.equal(v,x),toBeGreaterThan:(x:number)=>assert(v>x),toBeLessThan:(x:number)=>assert(v<x),toBeCloseTo:(x:number,d=2)=>assert(Math.abs(v-x)<.5*10**(-d)),not:{toBeCloseTo:(x:number,d=2)=>assert(Math.abs(v-x)>=.5*10**(-d))}});`;
  const code =
    imports +
    `\nimport assert from 'node:assert/strict';\n` +
    checks +
    `\nexport function plan(r:GameRoom,advance:()=>void){const a={playerId:Object.values(r.state.players).find(p=>p.role==='OATH')!.id},b={playerId:Object.values(r.state.players).find(p=>p.role==='EMBER')!.id};` +
    body +
    "\n}";
  const target = resolve(temporary, "current-pond.mjs");
  await writeFile(
    target,
    ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText,
  );
  return (await import(pathToFileURL(target).href)).plan as (
    r: GameRoom,
    advance: () => void,
  ) => void;
}

async function loadPlanner(file: string) {
  const original = await readFile(resolve(root, "scripts", file), "utf8");
  const imports = original.slice(0, original.indexOf("const folder"));
  const body = original.slice(
    original.indexOf("type Step"),
    original.indexOf('if (process.argv.includes("--plan-only"))'),
  );
  let source =
    imports +
    (file.startsWith("maze")
      ? "const combatEvidence={beamSeen:false,punchSeen:false};\n"
      : "") +
    body.replace("function plan(", "export function plan(");
  source = source.replace(/from\s+(["'])([^"']+)\1/g, (_all, q, spec) => {
    const target = spec.startsWith(".")
      ? resolve(root, "scripts", spec)
      : spec.startsWith("node:")
        ? spec
        : require.resolve(spec);
    return `from ${q}${target}${q}`;
  });
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      verbatimModuleSyntax: false,
    },
  }).outputText;
  const target = resolve(temporary, file.replace(".ts", ".mjs"));
  await writeFile(target, compiled);
  return (await import(pathToFileURL(target).href)).plan as (
    r: GameRoom,
    advance: () => void,
  ) => unknown;
}
const room = new GameRoom("ABC234", false, "GODDESS_SHRINE", false);
const first = room.add("sieg"),
  second = room.add("coco");
room.select(first.playerId, "OATH");
room.select(second.playerId, "EMBER");
room.ready(first.playerId, true);
room.ready(second.playerId, true);
const heroes = [
  room.state.players[first.playerId],
  room.state.players[second.playerId],
];
const trace: unknown[] = [];
function advance() {
  room.tick();
  if (room.state.serverTick > ticksFor(1200))
    throw Error("Engineering oracle 1200s safety limit");
}
function tick(actor?: Player, patch: Partial<InputFrame> = {}) {
  for (const p of heroes)
    room.receiveInput(p.id, {
      ...neutral(room.sessions.get(p.id)!.input.seq + 1),
      ...(p === actor ? patch : {}),
    });
  advance();
}
function move(p: Player, goal: { x: number; y: number }) {
  const map = maps[p.sceneId ?? room.state.sceneId];
  const walls = collisionRects(
    map.id,
    room.state.puzzles,
    room.state.pushableOffsets,
    room.state.bridgePuzzle,
    room.state.players,
    room.state.serverTick,
    p.role,
  ).filter((r) => !p.flightRemaining || !r.terrain);
  const width = Math.ceil(map.width / 32),
    height = Math.ceil(map.height / 32);
  const key = (x: number, y: number) => y * width + x;
  const open = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < width &&
    y < height &&
    !walls.some(
      (r) =>
        (x + 0.5) * 32 + 13 > r.x &&
        (x + 0.5) * 32 - 13 < r.x + r.w &&
        (y + 0.5) * 32 + 13 > r.y &&
        (y + 0.5) * 32 - 13 < r.y + r.h,
    );
  const start = key(Math.floor(p.x / 32), Math.floor(p.y / 32)),
    end = key(Math.floor(goal.x / 32), Math.floor(goal.y / 32));
  const previous = new Map<number, number>([[start, -1]]),
    q = [start];
  for (let i = 0; i < q.length && !previous.has(end); i++) {
    const x = q[i] % width,
      y = Math.floor(q[i] / width);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      const k = key(nx, ny);
      if (open(nx, ny) && !previous.has(k)) {
        previous.set(k, q[i]);
        q.push(k);
      }
    }
  }
  assert(
    previous.has(end),
    `No engineering path in ${map.id} to ${goal.x},${goal.y}`,
  );
  const route: number[] = [];
  for (let k = end; k !== start; k = previous.get(k)!) route.unshift(k);
  const points = route.map((k) => ({
    x: ((k % width) + 0.5) * 32,
    y: (Math.floor(k / width) + 0.5) * 32,
  }));
  points.push(goal);
  for (const point of points) {
    let count = 0;
    while (
      Math.hypot(p.x - point.x, p.y - point.y) > 5 &&
      count++ < ticksFor(8)
    )
      tick(p, {
        moveX: Math.abs(p.x - point.x) > 3 ? Math.sign(point.x - p.x) : 0,
        moveY: Math.abs(p.y - point.y) > 3 ? Math.sign(point.y - p.y) : 0,
      });
    assert(count < ticksFor(8), `Blocked ${map.id} ${p.x},${p.y}`);
  }
}
function travel(p: Player, point: { x: number; y: number }, expected: string) {
  move(p, point);
  for (let n = 0; n < ticksFor(1.1); n++) tick();
  tick(p, { interactHeld: true });
  tick();
  assert.equal(room.state.sceneId, expected);
  trace.push({
    event: "travel",
    scene: expected,
    tick: room.state.serverTick,
    inventory: structuredClone(room.state.inventory?.counts),
  });
}
const initial = structuredClone(room.state.inventory);
assert.deepEqual(initial?.counts, {});
let error: string | undefined;
try {
  travel(heroes[0], shrinePoints.west, "MIRROR_POND");
  (await loadCurrentPondPlanner())(room, advance);
  for (let n = 0; n < ticksFor(28); n++) tick();
  travel(heroes[1], maps.MIRROR_POND.points.back, "GODDESS_SHRINE");
  travel(heroes[0], shrinePoints.east, "HEDGE_MAZE");
  (await loadPlanner("maze-playthrough.ts"))(room, advance);
  travel(heroes[0], maps.HEDGE_MAZE.points.back, "GODDESS_SHRINE");
  travel(heroes[0], shrinePoints.north, "GRIFFIN_ENCLOSURE");
  (await loadPlanner("griffin-playthrough.ts"))(room, advance);
  assert(shrineComplete(room.state));
} catch (e) {
  error = e instanceof Error ? e.stack : String(e);
  console.error(error);
}
const report = {
  classification: "privileged-engineering-oracle-NOT-fair-baseline",
  initialInventory: initial,
  postResetStateMutations: false,
  success: shrineComplete(room.state),
  simulatedSeconds: room.state.serverTick / 60,
  events: trace,
  finalScene: room.state.sceneId,
  finalInventory: room.state.inventory,
  error,
};
await writeFile(
  resolve(output, "report.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    success: report.success,
    simulatedSeconds: report.simulatedSeconds,
    error,
  }),
);
if (error) process.exitCode = 1;
