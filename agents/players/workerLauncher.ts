import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { realpathSync } from "node:fs";
import type { DecisionRecord, PlayerRole, PlayerView } from "./policy.js";
import type { GatewayConfig } from "./modelGateway.js";
/** Build once before starting workers. Only this standalone code bundle is readable. */
export async function buildPlayerWorker(outputFile: string): Promise<void> {
  const { build } = await import("esbuild");
  await build({
    stdin: {
      contents: `import {runWorker} from './agents/players/worker.ts'; runWorker();`,
      resolveDir: process.cwd(),
      sourcefile: "player-entry.ts",
    },
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    sourcemap: false,
  });
}
export class WorkerPolicyError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}
/** Node permission model protects accidental tool/file access. It is not an OS sandbox
 * against arbitrary hostile native code. Models only return JSON; no code executes.
 * Network is enabled for the configured gateway, but Node currently grants all network
 * destinations; no URL supplied by a model is fetched and redirects are forbidden.
 */
export class PlayerWorker {
  readonly process: ChildProcessWithoutNullStreams;
  private pending?: {
    id: number;
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    cleanup: () => void;
  };
  private counter = 0;
  constructor(
    bundle: string,
    config: GatewayConfig,
    private readonly onRecord: (record: DecisionRecord) => void = () => {},
    nodeExecutable = process.execPath,
  ) {
    this.process = spawn(
      nodeExecutable,
      [
        "--permission",
        `--allow-fs-read=${realpathSync(bundle)}`,
        "--allow-net",
        realpathSync(bundle),
      ],
      {
        env: {
          EVALUATION_MODEL_ENDPOINT: config.endpoint,
          EVALUATION_MODEL: config.model,
          EVALUATION_MODEL_API_KEY: config.apiKey,
          ...(config.costPolicy
            ? { EVALUATION_COST_POLICY: JSON.stringify(config.costPolicy) }
            : {}),
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const lines = createInterface({
      input: this.process.stdout,
      crlfDelay: Infinity,
    });
    lines.on("line", (line) => {
      if (line.length > 2000000) {
        this.stop("oversized_worker_response");
        return;
      }
      try {
        const response = JSON.parse(line) as {
          id: number;
          type: string;
          record: DecisionRecord;
          error: string;
          action: unknown;
        };
        if (response.type === "model_record") {
          this.onRecord(response.record);
          return;
        }
        const pending = this.pending;
        if (!pending || response.id !== pending.id) return;
        this.pending = undefined;
        clearTimeout(pending.timer);
        pending.cleanup();
        if (response.type === "error")
          pending.reject(new WorkerPolicyError(response.error));
        else pending.resolve(response.action);
      } catch {
        this.stop("invalid_worker_response");
      }
    });
    this.process.on("error", () => this.stop("worker_process_error"));
    this.process.on("exit", () => this.stop("worker_exited"));
    // Consume diagnostics without forwarding environment or provider details.
    this.process.stderr.resume();
  }
  private request(
    request: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (this.pending)
      return Promise.reject(new WorkerPolicyError("concurrent_worker_request"));
    if (signal?.aborted)
      return Promise.reject(new WorkerPolicyError("manual_cancel"));
    const id = ++this.counter;
    return new Promise((resolve, reject) => {
      const abort = () => this.stop("manual_cancel");
      signal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(() => this.stop("worker_timeout"), 125000);
      this.pending = {
        id,
        resolve,
        reject,
        timer,
        cleanup: () => signal?.removeEventListener("abort", abort),
      };
      this.process.stdin.write(`${JSON.stringify({ ...request, id })}\n`);
    });
  }
  async initialize(
    role: PlayerRole,
    manual: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.request({ type: "init", role, manual }, signal);
  }
  decide(view: PlayerView, signal?: AbortSignal): Promise<unknown> {
    return this.request({ type: "decide", view }, signal);
  }
  stop(reason = "worker_stopped"): void {
    const pending = this.pending;
    this.pending = undefined;
    if (pending) {
      clearTimeout(pending.timer);
      pending.cleanup();
      pending.reject(new WorkerPolicyError(reason));
    }
    if (!this.process.killed) this.process.kill();
  }
}
