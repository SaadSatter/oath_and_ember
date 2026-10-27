/** JSON-lines stdin/stdout player process. Launch as a separate process for each role.
 * Launch with workerLauncher for Node permission restrictions; not an OS sandbox.
 */
import { createInterface } from "node:readline";
import {
  IndependentPlayer,
  type PlayerRole,
  type PlayerView,
} from "./policy.js";
import { HttpTextGateway } from "./modelGateway.js";
export function runWorker(): void {
  let player: IndependentPlayer | undefined;
  let busy = false;
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const send = (value: unknown) =>
    process.stdout.write(`${JSON.stringify(value)}\n`);
  lines.on("line", (line) => {
    if (line.length > 1000000 || busy) {
      send({ error: "invalid_request" });
      return;
    }
    busy = true;
    let requestId: unknown;
    void (async () => {
      const request = JSON.parse(line) as {
        id: number;
        type: string;
        role: PlayerRole;
        manual: string;
        view: PlayerView;
      };
      requestId = request.id;
      if (request.type === "init" && !player) {
        if (
          !["SIEG", "COCO"].includes(request.role) ||
          typeof request.manual !== "string"
        )
          throw new Error("invalid_init");
        const {
          EVALUATION_MODEL_ENDPOINT: endpoint,
          EVALUATION_MODEL: model,
          EVALUATION_MODEL_API_KEY: apiKey,
        } = process.env;
        if (!endpoint || !model || !apiKey)
          throw new Error("provider_not_configured");
        player = new IndependentPlayer(
          request.role,
          request.manual,
          new HttpTextGateway({
            endpoint,
            model,
            apiKey,
            costPolicy: process.env.EVALUATION_COST_POLICY
              ? JSON.parse(process.env.EVALUATION_COST_POLICY)
              : undefined,
          }),
          (r) => send({ type: "model_record", record: r }),
        );
        send({ id: requestId, type: "ready" });
      } else if (request.type === "decide" && player) {
        send({
          id: requestId,
          type: "decision",
          action: await player.decide(request.view),
        });
      } else throw new Error("invalid_request");
    })()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "";
        const reason = message.includes("token reservation")
          ? "token_budget"
          : (message.includes("model budget") || message === "dollar_budget")
            ? "model_call_budget"
            : message === "provider_not_configured"
              ? message
              : "worker_request_failed";
        send({ id: requestId, type: "error", error: reason });
      })
      .finally(() => {
        busy = false;
      });
  });
}
if (
  process.argv[1]?.endsWith("/worker.ts") ||
  process.argv[1]?.endsWith("/worker.js")
)
  runWorker();
