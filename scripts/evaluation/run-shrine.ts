/** Trusted coordinator; evaluated policies never import this file or receive its objects. */
import { mkdir, readFile, writeFile, mkdtemp } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { createApp } from "../../apps/server/src/app.js";
import { EvaluationEngine } from "../../packages/evaluation/src/engineHost.js";
import { BrowserPresentation } from "../../packages/evaluation/src/browserPresentation.js";
import { combineNormalSpeedVideo } from "../../packages/evaluation/src/video.js";
import {
  TraceWriter,
  hash,
  verifyTrace,
  type TraceEvent,
} from "../../packages/evaluation/src/trace.js";
import { ExplorationBaseline } from "../../packages/evaluation/src/baseline/heuristic.js";
import {
  SCENARIOS,
  SCENARIO_MANIFEST_HASH,
} from "../../packages/evaluation/src/scenarios.js";
import {
  roles,
  type EvaluationRole,
  type ActionEnvelope,
  type PresentationBoundary,
  type PlayerObservation,
} from "../../packages/evaluation/src/contract.js";
import {
  buildPlayerWorker,
  PlayerWorker,
} from "../../agents/players/workerLauncher.js";
import type { CostPolicy } from "../../packages/evaluation/src/costBudget.js";

const args = process.argv.slice(2);
const option = (name: string, fallback?: string) => {
  const at = args.indexOf(name);
  return at < 0 ? fallback : args[at + 1];
};
const mode = option("--mode", "baseline")!;
if (!["baseline", "model", "replay"].includes(mode))
  throw Error("Mode must be baseline, model or replay");
const replayPath = option("--replay");
const sourceEvents: TraceEvent[] = replayPath
  ? (await readFile(resolve(replayPath, "events.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((x) => JSON.parse(x))
  : [];
if (sourceEvents.length) verifyTrace(sourceEvents);
const replayManifest = replayPath
  ? JSON.parse(await readFile(resolve(replayPath, "manifest.json"), "utf8"))
  : undefined;
const seed = Number(option("--seed", String(replayManifest?.seed ?? 1101)));
const scenario = SCENARIOS.find(
  (s) => s.id === option("--scenario", replayManifest?.scenario ?? "A"),
);
if (!scenario) throw Error("Unknown scenario");
if (!scenario.developmentSeeds.includes(seed))
  throw Error(
    "Development runner refuses held-out and undeclared seeds; seal/freeze campaign separately",
  );
if (scenario.maxDelayTicks)
  throw Error(
    "Delay scenario is preregistered but not implemented: refusing misleading evaluation",
  );
const maxTicks =
  Number(option("--seconds", String(replayManifest?.maxTicks / 60 || 480))) *
  60;
if (!Number.isSafeInteger(maxTicks) || maxTicks < 1 || maxTicks > 28800)
  throw Error("Seconds must fit approved 480s cap");
const output = resolve(
  option("--output", `evaluation-runs/${mode}-${Date.now()}`)!,
);
await mkdir(output, { recursive: false });
await mkdir(join(output, "video"));
const trace = new TraceWriter(join(output, "events.jsonl"));
const sourceFingerprint = () => {
  const records: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(path);
      } else if (/\.(ts|json|html|css|mjs)$/.test(path))
        records[path] = hash(readFileSync(path, "utf8"));
    }
  };
  for (const dir of [
    "apps/client/src",
    "apps/server/src",
    "packages",
    "agents",
    "scripts/evaluation",
  ])
    walk(dir);
  return hash(records);
};
const dirtyHash = sourceFingerprint();
if (replayManifest && replayManifest.dirtyHash !== dirtyHash)
  throw Error("Source patch changed since source run; replay refused");
const manual = await readFile("manual/Oath_and_Ember_Player_Manual.md", "utf8");
const workers: Partial<Record<EvaluationRole, PlayerWorker>> = {};
const accounts = {
  SIEG: { calls: 0, input: 0, output: 0, cost: 0 },
  COCO: { calls: 0, input: 0, output: 0, cost: 0 },
};
let costPolicy: CostPolicy | undefined;
if (mode === "model") {
  if (!process.env.OPENAI_API_KEY)
    throw Error(
      "OPENAI_API_KEY is not available to this process. Set it locally; do not paste it into chat.",
    );
  const maximumUsd = Number(option("--max-spend-usd"));
  const inputUsdPerMillion = Number(option("--input-usd-per-million"));
  const outputUsdPerMillion = Number(option("--output-usd-per-million"));
  const source = option("--pricing-source", "")!;
  if (
    ![maximumUsd, inputUsdPerMillion, outputUsdPerMillion].every(
      (n) => Number.isFinite(n) && n > 0,
    ) ||
    !source
  )
    throw Error(
      "Paid runs require explicit maximum spend, positive token prices and pricing provenance",
    );
  costPolicy = {
    maximumUsd: maximumUsd / 2,
    inputUsdPerMillion,
    outputUsdPerMillion,
    source,
  };
}
const manifest = {
  schema: 1,
  mode,
  classification:
    mode === "model"
      ? "live-independent-models"
      : mode === "replay"
        ? "faithful-action-replay"
        : "weak-observation-only-baseline",
  seed,
  scenario: scenario.id,
  maxTicks,
  revision: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  dirtyHash,
  manualHash: hash(manual),
  scenarioManifestHash: SCENARIO_MANIFEST_HASH,
  model:
    mode === "model" ? (process.env.EVALUATION_MODEL ?? "gpt-5.6-sol") : null,
  costPolicy,
  capturedAt: new Date().toISOString(),
  screenshots: false,
  normalSpeed: true,
  sourceRun: replayPath ?? null,
  limits: {
    wallMs: 90 * 60 * 1000,
    maxCallsPerRole: 600,
    maxInputPerRole: 4000000,
    maxOutputPerRole: 500000,
  },
};
await writeFile(
  join(output, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
trace.append("reset", manifest);
const app = createApp({
  manualDriver: true,
  startingScene: "GODDESS_SHRINE",
  prologue: false,
});
const contexts: BrowserContext[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let adapter: BrowserPresentation | undefined;
let chunkStart = 0,
  chunkTick = 0,
  initialized = false;
const boundary: PresentationBoundary = {
  observe: (...a) => adapter!.observe(...a),
  legalActions: (...a) => adapter!.legalActions(...a),
  activate: (...a) => adapter!.activate(...a),
  afterTick: async (room) => {
    app.io.to(room.state.roomCode).emit("state:sync", room.state);
    chunkTick++;
    const wait = chunkStart + (chunkTick * 1000) / 60 - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  },
};
const expectedStates = sourceEvents
  .filter((e) => e.kind === "effective" && (e.payload as any).type === "state")
  .map((e) => (e.payload as any).data.hash);
let stateIndex = 0;
const engine = new EvaluationEngine(boundary, {
  maxTicks,
  trace: (e) => {
    if (
      mode === "replay" &&
      e.type === "state" &&
      expectedStates[stateIndex++] !== (e.data as any).hash
    )
      throw Error(`Replay state mismatch at tick ${e.tick}`);
    trace.append("effective", e);
  },
});
const abort = new AbortController();
const start = performance.now();
const cancel = () => {
  abort.abort();
  if (initialized) engine.cancel();
};
process.once("SIGINT", cancel);
process.once("SIGTERM", cancel);
let watchdog: ReturnType<typeof setTimeout> | undefined;
const rawVideos: Partial<Record<EvaluationRole, string>> = {};
let problem: string | undefined;
const baseline = {
  SIEG: new ExplorationBaseline(),
  COCO: new ExplorationBaseline(),
};
const sourceSteps = sourceEvents
  .filter((e) => e.kind === "step")
  .map(
    (e) =>
      e.payload as {
        role: EvaluationRole;
        action: ActionEnvelope;
        legal: { token: string; label: string }[];
      },
  );
let stepIndex = 0;
try {
  await new Promise<void>((resolve, reject) => {
    app.http.once("error", reject);
    app.http.listen(0, "127.0.0.1", () => resolve());
  });
  const port = (app.http.address() as { port: number }).port;
  browser = await chromium.launch({
    executablePath:
      process.env.EVALUATION_CHROME ??
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  await engine.reset(seed, async (room, ids) => {
    app.manager.rooms.set(room.state.roomCode, room);
    const pages = {} as Record<
      EvaluationRole,
      { page: Page; playerId: string }
    >;
    for (const role of roles) {
      const context = await browser!.newContext({
        viewport: { width: scenario.width, height: scenario.height },
        recordVideo: {
          dir: join(output, "video"),
          size: { width: scenario.width, height: scenario.height },
        },
      });
      contexts.push(context);
      const session = {
        roomCode: room.state.roomCode,
        playerId: ids[role],
        reconnectToken: room.sessions.get(ids[role])!.token,
      };
      await context.addInitScript(
        (s) => sessionStorage.setItem("oath-session", JSON.stringify(s)),
        session,
      );
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${port}/?evaluationPresentation=1`);
      await page.waitForFunction(
        () => !!(window as any).__evaluationPresentation,
      );
      await page.locator("#inventory-toggle").waitFor({ state: "visible" });
      pages[role] = { page, playerId: ids[role] };
      rawVideos[role] = await page.video()!.path();
    }
    adapter = new BrowserPresentation(pages, 0);
    app.io.to(room.state.roomCode).emit("state:sync", room.state);
    await new Promise((r) => setTimeout(r, 150));
  });
  initialized = true;
  watchdog = setTimeout(() => {
    abort.abort();
    engine.stop("wall_clock_limit");
  }, manifest.limits.wallMs);
  if (mode === "model") {
    const bundle = join(
      await mkdtemp(join(tmpdir(), "oath-player-")),
      "worker.mjs",
    );
    await buildPlayerWorker(bundle);
    for (const role of roles) {
      workers[role] = new PlayerWorker(
        bundle,
        {
          endpoint:
            process.env.EVALUATION_MODEL_ENDPOINT ??
            "https://api.openai.com/v1/responses",
          model: manifest.model!,
          apiKey: process.env.OPENAI_API_KEY!,
          costPolicy,
        },
        (record) => {
          trace.append("model", record);
          const a = accounts[role];
          a.calls++;
          if (record.usage.inputTokens !== "unknown")
            a.input += record.usage.inputTokens;
          if (record.usage.outputTokens !== "unknown")
            a.output += record.usage.outputTokens;
          if (record.usage.cost !== "unknown") a.cost += record.usage.cost;
        },
      );
      await workers[role]!.initialize(role, manual, abort.signal);
    }
  }
  while (!engine.outcome().terminal) {
    const obs = await Promise.all(roles.map((role) => engine.observe(role)));
    const legal = await Promise.all(
      roles.map((role) => engine.legal_actions(role)),
    );
    for (let i = 0; i < 2; i++) {
      trace.append("observe", { role: roles[i], observation: obs[i] });
      trace.append("legal", { role: roles[i], actions: legal[i] });
    }
    const selected: ActionEnvelope[] = await Promise.all(
      roles.map(async (role, i) => {
        const view = {
          observation_id: obs[i].observation_id,
          observation: obs[i],
          legal_actions: {
            ui: legal[i],
            controls:
              role === "SIEG"
                ? [
                    "left",
                    "right",
                    "up",
                    "down",
                    "primary",
                    "secondary",
                    "push",
                    "sprint",
                    "interact",
                  ]
                : [
                    "left",
                    "right",
                    "up",
                    "down",
                    "primary",
                    "secondary",
                    "slowTime",
                    "flight",
                    "blackHole",
                    "interact",
                  ],
          },
        };
        if (mode === "replay") {
          const prior = sourceSteps[stepIndex++];
          if (!prior || prior.role !== role)
            throw Error("Replay decision order mismatch");
          return {
            ...prior.action,
            observation_id: obs[i].observation_id,
            plan: prior.action.plan.map((segment) => {
              if (segment.type !== "ui") return segment;
              const oldIndex = prior.legal.findIndex(
                (x) => x.token === segment.token,
              );
              const label = prior.legal[oldIndex]?.label;
              const sameLabel = legal[i].filter((x) => x.label === label),
                which = prior.legal
                  .slice(0, oldIndex)
                  .filter((x) => x.label === label).length;
              if (!sameLabel[which])
                throw Error("Replay UI affordance mismatch");
              return { ...segment, token: sameLabel[which].token };
            }),
          };
        }
        return (
          mode === "model"
            ? await workers[role]!.decide(view, abort.signal)
            : baseline[role].decide(view)
        ) as ActionEnvelope;
      }),
    );
    selected.forEach((action, i) => {
      trace.append("step", { role: roles[i], action, legal: legal[i] });
      if (action.message)
        trace.append("message", { role: roles[i], text: action.message });
    });
    chunkStart = performance.now();
    chunkTick = 0;
    const results = await Promise.allSettled(
      roles.map((role, i) => engine.step(role, selected[i])),
    );
    results.forEach((result, i) =>
      trace.append("validation", {
        role: roles[i],
        accepted: result.status === "fulfilled",
        ...(result.status === "rejected"
          ? { error: String(result.reason) }
          : {}),
      }),
    );
    if (
      results.some((r) => r.status === "rejected") &&
      !engine.outcome().terminal
    ) {
      // No solver repair. A policy can retry from its own current feedback next round.
      trace.append("error", { reason: "joint_submission_rejected" });
    }
  }
  if (mode === "replay" && stateIndex !== expectedStates.length)
    throw Error("Replay ended before all recorded ticks");
} catch (e) {
  problem = e instanceof Error ? e.message : String(e);
  trace.append("error", { reason: problem });
  if (initialized && /budget/i.test(problem))
    engine.stop(/token/i.test(problem) ? "token_budget" : "model_call_budget");
  else if (initialized) engine.stop("unrecoverable_error");
} finally {
  if (watchdog) clearTimeout(watchdog);
  for (const worker of Object.values(workers)) worker?.stop();
  const outcome = {
    ...(initialized
      ? engine.outcome()
      : {
          terminal: true,
          reason: "unrecoverable_error",
          ticks: 0,
          submissions: { SIEG: 0, COCO: 0 },
        }),
    wallMs: performance.now() - start,
    accounts,
    error: problem,
    classification: manifest.classification,
  };
  await writeFile(
    join(output, "outcome.json"),
    JSON.stringify(outcome, null, 2),
  );
  trace.append("terminal", outcome);
  await Promise.all(contexts.map((c) => c.close()));
  await browser?.close();
  await app.close();
  process.removeListener("SIGINT", cancel);
  process.removeListener("SIGTERM", cancel);
  if (rawVideos.SIEG && rawVideos.COCO) {
    try {
      await combineNormalSpeedVideo(
        rawVideos.SIEG,
        rawVideos.COCO,
        join(
          output,
          "video",
          mode === "replay" ? "normal-speed-replay.mp4" : "uncut-live.mp4",
        ),
        process.env.EVALUATION_FFMPEG ?? "ffmpeg",
      );
    } catch (e) {
      await writeFile(join(output, "video", "assembly-error.txt"), String(e));
    }
  }
  console.log(JSON.stringify({ output, ...outcome }));
  if (problem) process.exitCode = 1;
}
