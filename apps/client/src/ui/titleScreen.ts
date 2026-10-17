// Title scene shown before a room exists: Emberbrook Village fades in once its
// artwork has loaded, Sieg and Coco walk the plaza road, and a shadowed
// dialogue box types the opening narration above the room controls.
// Presentation only: it never touches world state or the network directly.
//
// The village is drawn exactly as in the game: its imported terrain tiles,
// then every object and both heroes in order of their ground lines, so the
// heroes pass behind lamp posts and trees and never over a house or the well.
import postTownMaps from "../environment/postTownMaps.json" with { type: "json" };
import { heroAssets, WALK_FPS } from "../animation/definitions.js";
const village = postTownMaps.EMBERBROOK_VILLAGE;
const VILLAGE_DIR = `/assets/environment/post-town/${village.folder}`;
export const TITLE_WORLD = { width: 1152, height: 832 };
// The heroes' feet run along the north edge of the plaza road: clear of every
// collision footprint (house fronts, lamp posts, statues, the well).
export const TITLE_LANE = { y: 316, from: -80, to: 1232 };
// The in-game hero sheets: 0-3 standing, then 8-frame walks in the order
// south, north, east, west. Feet sit 60px down each 48x64 frame.
export const TITLE_HERO = {
  width: 48,
  height: 64,
  feet: 60,
  frames: 8,
  walkEast: 4 + 2 * 8,
};
// Pace and cadence keep the game's stride length (SPEED per WALK_FPS), so
// the feet don't skate at the slower title walk.
export const TITLE_WALK_SPEED = 120; // world units per second
export const TITLE_WALK_FPS = (WALK_FPS * TITLE_WALK_SPEED) / 190;
export const TITLE_LINES = [
  "Dawn breaks over Emberbrook Village.",
  "Sieg, a knight sworn to steel. Coco, a mage who burns with starlight.",
  "Two heroes. One shared fate. Gather your party to begin.",
];
export const TITLE_TYPE_CPS = 40,
  TITLE_HOLD_MS = 2600;
const heroes = [
  { role: "OATH", name: "Sieg", lead: 0 },
  { role: "EMBER", name: "Coco", lead: -64 },
] as const;
export function titleAssets() {
  return [
    ...village.textures.map((t) => `${VILLAGE_DIR}/${t.filename}`),
    ...village.objects.map((o) => `${VILLAGE_DIR}/${o.filename}`),
    ...heroes.map((h) => heroAssets[h.role].url),
  ];
}
// Which narration line is showing and how much of it is typed, for a given
// time since the scene appeared. Lines loop after the last one has held.
export function typewriter(elapsedMs: number, lines = TITLE_LINES) {
  const durations = lines.map(
    (line) => (line.length / TITLE_TYPE_CPS) * 1000 + TITLE_HOLD_MS,
  );
  const cycle = durations.reduce((a, b) => a + b, 0);
  let t = Math.max(0, elapsedMs) % cycle;
  let index = 0;
  while (t >= durations[index]) t -= durations[index++];
  const line = lines[index],
    shown = Math.min(line.length, Math.floor((t / 1000) * TITLE_TYPE_CPS));
  return { index, line, text: line.slice(0, shown), done: shown >= line.length };
}
// Where a hero stands on the road and which walk frame shows. Both heroes
// share one loop so they stay in step; `lead` offsets the follower. `road` is
// the stretch actually on screen, so narrow screens don't walk them off-view.
export function heroStride(
  elapsedMs: number,
  lead = 0,
  road: { from: number; to: number } = TITLE_LANE,
) {
  const span = road.to - road.from,
    travelled = (Math.max(0, elapsedMs) / 1000) * TITLE_WALK_SPEED;
  const x = road.from + ((((travelled + lead) % span) + span) % span);
  const frame =
    Math.floor((Math.max(0, elapsedMs) / 1000) * TITLE_WALK_FPS) %
    TITLE_HERO.frames;
  return { x, frame };
}
// The part of the lane (world units) inside the viewport, with room for the
// heroes to enter and leave just off-screen.
function visibleRoad(canvas: HTMLCanvasElement) {
  const box = canvas.getBoundingClientRect();
  if (!box.width) return TITLE_LANE;
  const scale = box.width / TITLE_WORLD.width,
    margin = TITLE_HERO.width + 24;
  return {
    from: Math.max(TITLE_LANE.from, -box.left / scale - margin),
    to: Math.min(TITLE_LANE.to, (innerWidth - box.left) / scale + margin),
  };
}
let running: { stop(): void } | null = null;
export function stopTitleScreen(panel: HTMLElement) {
  running?.stop();
  running = null;
  if (panel.dataset.screen === "title") {
    delete panel.dataset.screen;
    panel.classList.remove("title-screen");
  }
}
export function renderTitleScreen(
  panel: HTMLElement,
  actions: { create(): void; join(code: string): void },
) {
  // Re-renders for unrelated reasons (e.g. the socket connecting) keep the
  // scene that is already playing instead of restarting the load-in.
  if (panel.dataset.screen === "title" && running) return;
  running?.stop();
  panel.dataset.screen = "title";
  panel.className = "title-screen";
  panel.innerHTML = `
    <div class="title-stage" aria-hidden="true">
      <canvas class="title-canvas" width="${TITLE_WORLD.width}" height="${TITLE_WORLD.height}"></canvas>
    </div>
    <div class="title-vignette" aria-hidden="true"></div>
    <header class="title-logo">
      <div class="eyebrow">A COOPERATIVE ADVENTURE</div>
      <h1>Oath <span>&amp;</span> Ember</h1>
    </header>
    <section class="title-dialog" aria-label="Start a game">
      <div class="title-speaker">Emberbrook Village</div>
      <p class="title-line" aria-live="off"><span class="title-typed"></span><span class="title-caret" aria-hidden="true">▾</span></p>
      <div class="title-actions">
        <button id="create">Create room</button>
        <div class="join"><input id="code" aria-label="Room code" maxlength="6" placeholder="ROOM CODE" autocomplete="off"><button id="join">Join</button></div>
      </div>
      <small>Two browser sessions required • Working prototype</small>
    </section>
    <div class="title-loader" role="status">
      <div class="title-loader-label">Loading Emberbrook…</div>
      <div class="title-loader-bar"><span></span></div>
    </div>`;
  panel.querySelector("#create")!.addEventListener("click", () => actions.create());
  const code = panel.querySelector<HTMLInputElement>("#code")!;
  panel.querySelector("#join")!.addEventListener("click", () =>
    actions.join(code.value.trim()),
  );
  code.addEventListener("keydown", (e) => {
    if (e.key === "Enter") actions.join(code.value.trim());
  });
  const reduced = matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const typed = panel.querySelector<HTMLElement>(".title-typed")!,
    line = panel.querySelector<HTMLElement>(".title-line")!,
    bar = panel.querySelector<HTMLElement>(".title-loader-bar span")!,
    canvas = panel.querySelector<HTMLCanvasElement>(".title-canvas")!,
    ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const images = new Map<string, HTMLImageElement>();
  // Terrain never changes: draw its 64px tiles once into a backing canvas.
  let terrain: HTMLCanvasElement | null = null;
  const drawTerrain = () => {
    terrain = document.createElement("canvas");
    terrain.width = TITLE_WORLD.width;
    terrain.height = TITLE_WORLD.height;
    const g = terrain.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    for (const tile of village.tiles) {
      const t = village.textures[tile.texture],
        img = images.get(`${VILLAGE_DIR}/${t.filename}`);
      if (!img?.naturalWidth) continue;
      const cols = Math.max(1, Math.floor(img.naturalWidth / 64)),
        sx = t.sheet ? (tile.frame % cols) * 64 : 0,
        sy = t.sheet ? Math.floor(tile.frame / cols) * 64 : 0;
      g.drawImage(img, sx, sy, 64, 64, tile.x, tile.y, 64, 64);
    }
  };
  // Painter's order by ground line, the same rule the game uses for depth.
  const objects = village.objects.map((o) => ({
    ...o,
    url: `${VILLAGE_DIR}/${o.filename}`,
  }));
  const draw = (strides: { x: number; frame: number }[]) => {
    if (!terrain) drawTerrain();
    ctx.drawImage(terrain!, 0, 0);
    const actors: { ground: number; paint(): void }[] = objects.map((o) => ({
      ground: o.groundY,
      paint: () => {
        const img = images.get(o.url);
        if (img?.naturalWidth) ctx.drawImage(img, Math.round(o.x), Math.round(o.y));
      },
    }));
    heroes.forEach((hero, n) => {
      const { x, frame } = strides[n],
        sheet = images.get(heroAssets[hero.role].url),
        left = Math.round(x - TITLE_HERO.width / 2),
        top = TITLE_LANE.y - TITLE_HERO.feet;
      actors.push({
        ground: TITLE_LANE.y,
        paint: () => {
          ctx.fillStyle = "#00000040";
          ctx.beginPath();
          ctx.ellipse(Math.round(x), TITLE_LANE.y - 1, 12, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          if (sheet?.naturalWidth)
            ctx.drawImage(
              sheet,
              (reduced ? 2 : TITLE_HERO.walkEast + frame) * TITLE_HERO.width,
              0,
              TITLE_HERO.width,
              TITLE_HERO.height,
              left,
              top,
              TITLE_HERO.width,
              TITLE_HERO.height,
            );
        },
      });
    });
    actors.sort((a, b) => a.ground - b.ground);
    for (const actor of actors) actor.paint();
  };
  let stopped = false,
    frame = 0,
    start = 0,
    // Clicking the dialogue finishes the line being typed.
    skipTo = -1;
  line.addEventListener("click", () => {
    skipTo = typewriter(performance.now() - start).index;
  });
  const tick = (now: number) => {
    if (stopped || !panel.isConnected) return;
    const elapsed = now - start,
      words = typewriter(elapsed);
    const full = reduced || skipTo === words.index || words.done;
    typed.textContent = full ? words.line : words.text;
    line.setAttribute("aria-label", words.line);
    line.dataset.done = String(full);
    const road = visibleRoad(canvas);
    draw(
      heroes.map((hero) =>
        reduced
          ? { x: (road.from + road.to) / 2 + hero.lead, frame: 0 }
          : heroStride(elapsed, hero.lead, road),
      ),
    );
    frame = requestAnimationFrame(tick);
  };
  // Load in: wait for the artwork (progress shown), then fade the scene up.
  const assets = titleAssets();
  let loaded = 0;
  Promise.all(
    assets.map(
      (url) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          images.set(url, image);
          image.onload = image.onerror = () => {
            loaded++;
            bar.style.width = `${(loaded / assets.length) * 100}%`;
            resolve();
          };
          image.src = url;
        }),
    ),
  ).then(() => {
    if (stopped) return;
    start = performance.now();
    panel.dataset.loaded = "true";
    frame = requestAnimationFrame(tick);
  });
  running = {
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
    },
  };
}
