import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const dir = resolve(process.argv[2] ?? "qa/enemy-gameplay-v1");
if (existsSync(dir))
  throw Error("Evidence directory exists; use a new version");
mkdirSync(dir, { recursive: true });
const app = createApp({ encounter: true });
await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
const port = (app.http.address() as { port: number }).port;
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const contexts = [],
  pages = [],
  histories: Map<number, any>[] = [new Map(), new Map()];
const errors: string[] = [];
const renders: any[][] = [[], []];
let room: any;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: `${dir}/raw-videos`,
        size: { width: 1280, height: 720 },
      },
    });
    contexts.push(context);
    const page = await context.newPage();
    pages.push(page);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.exposeFunction("recordEnemySnapshot", (w: any) =>
      histories[i].set(w.serverTick, w),
    );
    await page.exposeFunction("recordEnemyRender", (sample: any) =>
      renders[i].push(sample),
    );
    await page.addInitScript(() => {
      let lastRender = 0;
      (window as any).__enemyRendered = (sample: any) => {
        if (performance.now() - lastRender < 100) return;
        lastRender = performance.now();
        (window as any).recordEnemyRender(sample);
      };
      (window as any).__enemySnapshot = (w: any) =>
        (window as any).recordEnemySnapshot(w);
    });
    await page.goto(`http://127.0.0.1:${port}/?enemyQA=1`);
  }
  await pages[0].locator("#create").click();
  await pages[0].locator("#oath").waitFor();
  const code = (await pages[0].locator("h1").textContent())!.split(" ")[1];
  await pages[1].locator("#code").fill(code);
  await pages[1].locator("#join").click();
  await pages[0].locator("#oath").click();
  await pages[1].locator("#ember").click();
  await sleep(250);
  await pages[0].locator("#ready").click();
  await pages[1].locator("#ready").click();
  room = app.manager.get(code);
  await pages[0].waitForFunction(
    () => document.body.dataset.playing === "true",
  );
  await Promise.all(pages.map((p) => p.keyboard.press("F3")));
  const phases: any[] = [];
  const phase = (name: string) =>
    phases.push({ name, serverTick: room.state.serverTick });
  phase("Approach — browser input only");
  await Promise.all(pages.map((p) => p.keyboard.down("d")));
  await sleep(650);
  await Promise.all(pages.map((p) => p.keyboard.up("d")));
  await sleep(2000);
  for (let i = 0; i < 2; i++)
    await pages[i].screenshot({ path: `${dir}/client-${i + 1}-all-types.png` });
  phase("Separate and observe target selection");
  await pages[0].keyboard.down("w");
  await pages[1].keyboard.down("s");
  await sleep(700);
  await pages[0].keyboard.up("w");
  await pages[1].keyboard.up("s");
  await sleep(2500);
  phase("Cooperative combat — intent-only deterministic QA controller");
  // Browser key intent drives existing controls. The controller reads authority for navigation,
  // but never sends positions, health, damage, target, death or spawn outcomes.
  const pressed = [new Set<string>(), new Set<string>()];
  for (let n = 0; n < 120; n++) {
    for (let i = 0; i < 2; i++) {
      const p = Object.values(room.state.players).find(
        (p: any) => p.role === (i === 0 ? "OATH" : "EMBER"),
      ) as any;
      const targets = Object.values(room.state.enemies)
        .filter((e: any) => e.state !== "DEAD")
        .sort(
          (a: any, b: any) =>
            Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
        ) as any[];
      const e = targets[0],
        wanted = new Set<string>();
      if (e) {
        const dx = e.x - p.x,
          dy = e.y - p.y,
          d = Math.hypot(dx, dy);
        if (Math.abs(dx) > 12) wanted.add(dx > 0 ? "d" : "a");
        if (Math.abs(dy) > 12) wanted.add(dy > 0 ? "s" : "w");
        if (d < 75) wanted.add("j");
      }
      for (const k of pressed[i])
        if (!wanted.has(k)) await pages[i].keyboard.up(k);
      for (const k of wanted)
        if (!pressed[i].has(k)) await pages[i].keyboard.down(k);
      pressed[i] = wanted;
    }
    if (!Object.keys(room.state.enemies).length) break;
    await sleep(150);
  }
  for (let i = 0; i < 2; i++)
    for (const k of pressed[i]) await pages[i].keyboard.up(k);
  await sleep(1500);
  phase("End of cooperative combat");
  for (let i = 0; i < 2; i++)
    await pages[i].screenshot({
      path: `${dir}/client-${i + 1}-combat-end.png`,
    });
  const common = [...histories[0].keys()].filter((t) => histories[1].has(t));
  const mismatch = common.filter(
    (t) =>
      JSON.stringify(histories[0].get(t)) !==
      JSON.stringify(histories[1].get(t)),
  );
  if (mismatch.length) errors.push("Authoritative same-tick mismatch");
  if (common.length < 60) errors.push("Insufficient matched tick coverage");
  const states = common.map((t) => histories[0].get(t));
  const observations = Object.fromEntries(
    ["moss", "moss-2", "wisp", "sentinel"].map((id) => [
      id,
      {
        spawn: states.some((w) => w.enemies[id]),
        chase: states.some((w) => w.enemies[id]?.state === "CHASE"),
        attack: states.some((w) => w.enemies[id]?.state === "ATTACK"),
        health_change: states.some(
          (w) => w.enemies[id] && w.enemies[id].hp < w.enemies[id].maxHp,
        ),
        death: states.some((w) => w.enemies[id]?.state === "DEAD"),
        despawn: states.some((w) => !w.enemies[id]),
      },
    ]),
  );
  for (const [id, obs] of Object.entries(observations))
    for (const [key, value] of Object.entries(obs))
      if (!value) errors.push(`${id}: ${key} not observed`);
  if (
    !states.some((w) =>
      Object.values(w.projectiles).some((p: any) => p.faction === "enemies"),
    )
  )
    errors.push("No Wisp projectile observed");
  if (
    !states.some((w) => Object.values(w.players).some((p: any) => p.hp < 100))
  )
    errors.push("No player damage observed");
  const animationChecks: any[] = [];
  for (let i = 0; i < 2; i++) {
    const seen = new Map<string, Set<number>>();
    for (const sample of renders[i])
      for (const [id, e] of Object.entries(sample.enemies) as [string, any][]) {
        const v = sample.visuals[id];
        if (!v) {
          errors.push(`Client ${i + 1} missing ${id} view`);
          continue;
        }
        if (e.state === "DEAD" && v.visible)
          errors.push("Dead sprite still visible");
        if (Math.hypot(e.vx, e.vy) > 0.1 && e.state !== "DEAD") {
          if (!v.playing) errors.push("Moving enemy animation stopped");
          const frames = seen.get(e.type) ?? new Set<number>();
          frames.add(v.frame);
          seen.set(e.type, frames);
          if (
            ["mossling", "ironbound_sentinel"].includes(e.type) &&
            Math.abs(Math.cos(e.facing)) >= Math.abs(Math.sin(e.facing))
          ) {
            if (
              v.flipX !== Math.cos(e.facing) < 0 ||
              !v.animation?.endsWith("walk_east") ||
              v.frame < 12 ||
              v.frame > 15
            )
              errors.push("Canonical side animation/mirroring mismatch");
          }
        }
      }
    for (const type of ["mossling", "cinder_wisp", "ironbound_sentinel"]) {
      const frames = [...(seen.get(type) ?? [])];
      animationChecks.push({ client: i + 1, type, moving_frames: frames });
      if (frames.length < 2)
        errors.push(
          `Insufficient moving-frame evidence: ${type} client ${i + 1}`,
        );
    }
    writeFileSync(
      `${dir}/client-${i + 1}-presentation.json`,
      JSON.stringify(renders[i], null, 2),
    );
  }
  // Responsive evidence uses a fresh server-owned reset after combat, preserving earlier tick history.
  room.reset();
  room.state.phase = "PLAYING";
  for (const p of Object.values(room.state.players) as any[]) p.x = 680;
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [390, 844],
    [844, 390],
  ]) {
    for (let i = 0; i < 2; i++) {
      await pages[i].setViewportSize({ width, height });
      await sleep(250);
      await pages[i].screenshot({
        path: `${dir}/responsive-${width}x${height}-client-${i + 1}.png`,
      });
    }
  }
  for (let i = 0; i < 2; i++)
    writeFileSync(
      `${dir}/client-${i + 1}-authority.json`,
      JSON.stringify([...histories[i].values()], null, 2),
    );
  writeFileSync(
    `${dir}/qa.json`,
    JSON.stringify(
      {
        scope:
          "Two real browser sessions, actual server gameplay, matched authoritative snapshot ticks; WebM PTS not used for synchronization.",
        phases,
        matched_ticks: common.length,
        mismatch_ticks: mismatch,
        observations,
        animation_checks: animationChecks,
        enemy_projectiles: states
          .filter((w) =>
            Object.values(w.projectiles).some(
              (p: any) => p.faction === "enemies",
            ),
          )
          .map((w) => w.serverTick),
        player_damage: states.some((w) =>
          Object.values(w.players).some((p: any) => p.hp < 100),
        ),
        errors,
      },
      null,
      2,
    ),
  );
  for (let i = 0; i < 2; i++) {
    await contexts[i].close();
    await pages[i].video()!.saveAs(`${dir}/client-${i + 1}.webm`);
  }
  console.log(
    JSON.stringify({ dir, matched_ticks: common.length, observations, errors }),
  );
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
  await app.close();
}
