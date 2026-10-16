import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { io } from "socket.io-client";
import { mkdir } from "node:fs/promises";
import { spawnEnemy } from "../packages/shared/src/enemies.js";
const app = createApp({ startingScene: "FOREST_RUINS" });
await new Promise<void>((resolve) => app.http.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`,
  sockets = [io(url), io(url)];
const req = (i: number, event: string, p: unknown) =>
  new Promise<any>((resolve, reject) =>
    sockets[i]
      .timeout(3000)
      .emit(event, p, (error: Error, result: any) =>
        error
          ? reject(error)
          : result.ok
            ? resolve(result.data)
            : reject(Error(result.error)),
      ),
  );
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await Promise.all(
    sockets.map(
      (s) => new Promise<void>((resolve) => s.on("connect", resolve)),
    ),
  );
  const sessions = [await req(0, "room:create", {})];
  sessions.push(await req(1, "room:join", { roomCode: sessions[0].roomCode }));
  await req(0, "role:select", { role: "OATH" });
  await req(1, "role:select", { role: "EMBER" });
  await req(0, "lobby:ready", { ready: true });
  await req(1, "lobby:ready", { ready: true });
  const room = app.manager.get(sessions[0].roomCode),
    initialTick = room.state.serverTick;
  sockets.forEach((s) => s.disconnect());
  browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
    ],
  });
  const pages = [];
  const errors: string[] = [];
  for (const session of sessions) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    await context.addInitScript(
      (s) => sessionStorage.setItem("oath-session", JSON.stringify(s)),
      session,
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("Browser:", e.message);
    });
    await page.goto(`${url}/?enemyQA=1`);
    pages.push(page);
  }
  for (const page of pages)
    await page.locator("#inventory-toggle").waitFor({ state: "visible" });
  await pages[0].waitForTimeout(1500);
  await mkdir("docs/quests/bald-goddess/qa", { recursive: true });
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/golem-attack-entry.png",
  });
  // Server-side camera fixtures only. Puzzle states below are changed by real keyboard casts.
  const s = room.state.players[sessions[0].playerId],
    c = room.state.players[sessions[1].playerId];
  function place(player: typeof s, x: number, y: number, facing = 0) {
    Object.assign(player, {
      x,
      y,
      facing,
      movementEpoch: (player.movementEpoch ?? 0) + 1,
    });
    room.state.worldRevision++;
  }
  const advance = room.tick.bind(room);
  room.tick = () => {};
  async function present(name: string) {
    app.io.to(room.state.roomCode).emit("game:snapshot", room.state);
    await pages[0].waitForTimeout(150);
    if (name.startsWith("blast"))
      await Promise.all(
        pages.map((p) =>
          p.waitForFunction(
            () =>
              JSON.parse(
                document.querySelector<HTMLElement>("#game")?.dataset
                  .projectileVisuals || "{}",
              ).golemBlasts?.length > 0,
            undefined,
            { timeout: 2000 },
          ),
        ),
      );
    await pages[0].screenshot({
      path: `docs/quests/bald-goddess/qa/golem-${name}.png`,
    });
  }
  for (const [direction, angle, row] of [
    ["west", Math.PI, 2],
    ["east", 0, 3],
    ["north", -Math.PI / 2, 1],
    ["south", Math.PI / 2, 0],
  ] as const) {
    const e = spawnEnemy(`golem-${direction}`, "ironbound_sentinel", 800, 450);
    room.state.enemies = { [e.id]: e };
    room.state.projectiles = {};
    room.state.projectileImpacts = [];
    place(s, 800 + Math.cos(angle) * 40, 450 + Math.sin(angle) * 40);
    place(c, 600, 600);
    s.hp = c.hp = 100;
    for (let n = 0; n < 7; n++) advance();
    if (e.attackKind !== "melee") throw Error("No melee switch");
    await present(`melee-windup-${direction}`);
    for (const page of pages) {
      const v = JSON.parse(
        (await page.locator("#game").getAttribute("data-enemy-visuals")) ||
          "{}",
      )[e.id];
      if (
        v.texture !== "golem:melee" ||
        v.charging ||
        v.frame < row * 6 ||
        v.frame >= row * 6 + 6
      )
        throw Error(`Wrong punch pose: ${JSON.stringify(v)}`);
    }
    for (let n = 0; n < 6; n++) advance();
    if (s.hp !== 72 || c.hp !== 100)
      throw Error(`Incorrect melee damage: ${s.hp}/${c.hp}`);
    if (Object.keys(room.state.projectiles).length)
      throw Error("Beam fired during punch");
    await present(`melee-contact-${direction}`);
    for (let n = 0; n < 12; n++) advance();
    if (e.state === "ATTACK") throw Error("Melee animation did not finish");
    await present(`melee-recover-${direction}`);
  }

  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "Golem melee browser QA passed: four native punch directions, no beam/charge effect, single close-range hit, full recovery in both clients.",
  );
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  await app.close();
}
