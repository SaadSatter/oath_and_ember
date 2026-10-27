import { it, expect } from "vitest";
import { createServer } from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildPlayerWorker,
  PlayerWorker,
} from "../../../agents/players/workerLauncher.js";
(process.env.EVALUATION_SOCKET_TESTS === "1" ? it : it.skip)(
  "runs separate restricted workers with local-only transcripts and no unrelated filesystem read",
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "oe-workers-"));
    const bundle = join(directory, "bundle.mjs");
    const calls: string[] = [];
    const server = createServer(async (req, res) => {
      let data = "";
      for await (const chunk of req) data += chunk;
      calls.push(data);
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '{"observation_id":"obs","action_id":"test","plan":[{"type":"wait","ticks":1}]}',
              },
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 20 },
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string") throw Error("server address");
    const workers: PlayerWorker[] = [];
    try {
      await buildPlayerWorker(bundle);
      const config = {
        endpoint: `http://127.0.0.1:${address.port}`,
        model: "fake",
        apiKey: "local-test-only",
      };
      const sieg = new PlayerWorker(bundle, config);
      const coco = new PlayerWorker(bundle, config);
      workers.push(sieg, coco);


      expect(sieg.process.pid).not.toBe(coco.process.pid);
      await Promise.all([
        sieg.initialize("SIEG", "mechanics"),
        coco.initialize("COCO", "mechanics"),
      ]);
      await sieg.decide({
        observation_id: "obs",
        observation: { text: "SIEG_PRIVATE_MARKER" },
        legal_actions: [],
      });
      await coco.decide({
        observation_id: "obs",
        observation: {},
        legal_actions: [],
      });
      expect(calls).toHaveLength(2);
      expect(calls[1]).not.toContain("SIEG_PRIVATE_MARKER");
      const canary = join(directory, "canary.txt");
      await writeFile(canary, "secret");
      const probe = spawnSync(
        process.execPath,
        [
          "--permission",
          `--allow-fs-read=${bundle}`,
          "--input-type=module",
          "-e",
          `import {readFileSync} from 'node:fs';readFileSync(${JSON.stringify(canary)});`,
        ],
        { encoding: "utf8", env: {} },
      );
      expect(probe.status).not.toBe(0);
      expect(probe.stderr).toContain("ERR_ACCESS_DENIED");
      expect(probe.stdout).not.toContain("secret");
    } finally {
      for (const worker of workers) worker.stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    }
  },
  20000,
);
