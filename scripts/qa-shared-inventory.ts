import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app.js";
import { io } from "socket.io-client";
import { mkdir } from "node:fs/promises";
const app = createApp();
await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
const sockets = [io(url), io(url)];
const request = (i: number, event: string, data: unknown) =>
  new Promise<any>((resolve, reject) =>
    sockets[i]
      .timeout(3000)
      .emit(event, data, (err: Error, result: any) =>
        err
          ? reject(err)
          : result.ok
            ? resolve(result.data)
            : reject(Error(result.error)),
      ),
  );
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await Promise.all(
    sockets.map((s) => new Promise<void>((r) => s.on("connect", r))),
  );
  const sessions = [await request(0, "room:create", {})];
  sessions.push(
    await request(1, "room:join", { roomCode: sessions[0].roomCode }),
  );
  await request(0, "role:select", { role: "OATH" });
  await request(1, "role:select", { role: "EMBER" });
  await request(0, "lobby:ready", { ready: true });
  await request(1, "lobby:ready", { ready: true });
  const room = app.manager.get(sessions[0].roomCode);
  for (const player of Object.values(room.state.players))
    Object.assign(player, { x: 480, y: 380, sceneId: "MAIN_HOUSE" });
  sockets.forEach((s) => s.disconnect());
  browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const pages = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
      viewport: i ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    });
    await context.addInitScript(
      (session) =>
        sessionStorage.setItem("oath-session", JSON.stringify(session)),
      sessions[i],
    );
    // LAN HTTP can lack crypto.randomUUID; exercise the non-secret request-ID fallback.
    await context.addInitScript(() => {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        value: undefined,
        configurable: true,
      });
    });
    const page = await context.newPage();
    await page.goto(url);
    pages.push(page);
  }
  for (const page of pages)
    await page.locator("#inventory-toggle").waitFor({ state: "visible" });
  await pages[0].keyboard.press("i");
  await pages[0]
    .getByText("Your shared backpack is empty.", { exact: false })
    .waitFor();
  if (await pages[1].locator("dialog[open]").count())
    throw Error("Partner dialog opened unexpectedly");
  for (const itemId of [
    "hedge_gate_key",
    "enchanted_shears",
    "vanity_mirror",
    "griffin_wig",
  ] as const) {
    room.inventory.register(room.state, {
      id: `qa-${itemId}`,
      name: "QA chest",
      kind: "chest",
      sceneId: "MAIN_HOUSE",
      x: 480,
      y: 390,
      reward: itemId,
    });
    room.useItem(sessions[0].playerId, {
      requestId: `qa-${itemId}`,
      targetId: `qa-${itemId}`,
    });
    // Fixtures are server-only and removed after use; they never ship into maps.
    room.inventory.targets.delete(`qa-${itemId}`);
    delete room.state.inventoryTargets![`qa-${itemId}`];
  }
  room.inventory.register(room.state, {
    id: "qa-gate",
    name: "Hedge Gate",
    kind: "gate",
    sceneId: "MAIN_HOUSE",
    x: 480,
    y: 390,
    itemId: "hedge_gate_key",
  });
  await pages[0].locator('[data-item="griffin_wig"]').waitFor();
  await pages[1].locator("#inventory-toggle").click();
  await pages[1].locator('[data-item="vanity_mirror"]').click();
  if (
    (await pages[0]
      .locator('[data-item="hedge_gate_key"]')
      .getAttribute("aria-pressed")) !== "true"
  )
    throw Error("Selection leaked between clients");
  const start = room.state.players[sessions[0].playerId].x;
  await pages[0].keyboard.down("d");
  await pages[0].waitForTimeout(200);
  await pages[0].keyboard.up("d");
  if (room.state.players[sessions[0].playerId].x !== start)
    throw Error("Movement while modal open");
  await mkdir("docs/quests/bald-goddess/qa", { recursive: true });
  await pages[0].screenshot({
    path: "docs/quests/bald-goddess/qa/inventory-desktop.png",
  });
  await pages[1].screenshot({
    path: "docs/quests/bald-goddess/qa/inventory-mobile.png",
  });
  await pages[0]
    .getByRole("button", { name: "Use on Hedge Gate", exact: true })
    .click();
  await pages[0]
    .locator('[data-item="hedge_gate_key"]')
    .waitFor({ state: "detached" });
  await pages[1]
    .locator('[data-item="hedge_gate_key"]')
    .waitFor({ state: "detached" });
  if (
    room.state.inventory!.counts.hedge_gate_key !== 0 ||
    !room.state.inventory!.unlocked.includes("qa-gate")
  )
    throw Error("Gate transaction failed");
  await pages[0].keyboard.press("Escape");
  if (await pages[0].locator("dialog[open]").count())
    throw Error("Escape did not close dialog");
  console.log(
    "Inventory browser QA passed: empty state, icons, independent selection, modal input suppression, shared gate transaction, desktop/mobile, Escape.",
  );
} finally {
  sockets.forEach((s) => s.disconnect());
  await browser?.close();
  await app.close();
}
