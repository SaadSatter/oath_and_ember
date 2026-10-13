import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Rect } from "../packages/shared/src/gameTypes.js";
import { exteriorTreeSolids } from "../packages/shared/src/environmentSolids.js";
const dir = resolve(process.argv[2]);
const qa = JSON.parse(readFileSync(`${dir}/qa.json`, "utf8"));
type Point = { x: number; y: number };
type Sample = {
  intent?: Point;
  serverMovementInput?: { moveX: number; moveY: number };
  time: number;
  sceneId: string;
  keys: string[];
  predictionLead: number;
  correction: number;
  authoritative: Point;
  predicted: Point;
  rendered: Point;
};
const overlap = (p: Point, r: Rect) =>
  p.x + 13 > r.x + 1e-7 &&
  p.x - 13 < r.x + r.w - 1e-7 &&
  p.y + 13 > r.y + 1e-7 &&
  p.y - 13 < r.y + r.h - 1e-7;
const results = [];
for (const stage of qa.stages) {
  if (stage.name === "scene-transitions") continue; // Teleports are intentional.
  for (let client = 1; client <= 2; client++) {
    const samples: Sample[] = JSON.parse(
      readFileSync(`${dir}/${stage.name}-${client}.json`, "utf8"),
    );
    const paths = Object.fromEntries(
      ["authoritative", "predicted", "rendered"].map((k) => [
        k,
        { reversals: 0, maxBackwardStep: 0, penetrations: 0 },
      ]),
    );
    let direction = { x: 0, y: 0 };
    let directionChanged = -Infinity;
    for (let n = 0; n < samples.length; n++) {
      const q = samples[n],
        p = samples[n - 1];
      // Use simulated intent: the driver's key-label update can lag delivery.
      const x =
        q.intent?.x ??
        Number(q.keys.includes("d")) - Number(q.keys.includes("a"));
      const y =
        q.intent?.y ??
        Number(q.keys.includes("s")) - Number(q.keys.includes("w"));
      if ((x || y) && (direction.x !== x || direction.y !== y))
        directionChanged = q.time;
      if (x || y) direction = { x, y }; // Include recoil after releasing a key.
      for (const k of ["authoritative", "predicted", "rendered"] as const) {
        if (
          [
            ...stage.walls,
            ...(stage.name === "tree-contact" ? exteriorTreeSolids : []),
          ].some((r: Rect) => overlap(q[k], r))
        )
          paths[k].penetrations++;
        // Rapid alternation intentionally reverses direction; use correction and
        // penetration metrics there instead of mislabeling delayed intent.
        if (
          !p ||
          p.sceneId !== q.sceneId ||
          stage.name === "rapid-directions" ||
          (stage.name === "continuous-loop-release" &&
            q.time - directionChanged < 150)
        )
          continue;
        const intent =
          k === "authoritative" &&
          q.serverMovementInput &&
          (q.serverMovementInput.moveX || q.serverMovementInput.moveY)
            ? { x: q.serverMovementInput.moveX, y: q.serverMovementInput.moveY }
            : direction;
        const length = Math.hypot(intent.x, intent.y);
        const delta = length
          ? ((q[k].x - p[k].x) * intent.x + (q[k].y - p[k].y) * intent.y) /
            length
          : 0;
        if (delta < -0.01) {
          paths[k].reversals++;
          paths[k].maxBackwardStep = Math.max(paths[k].maxBackwardStep, -delta);
        }
      }
    }
    results.push({
      stage: stage.name,
      client,
      samples: samples.length,
      durationMs: samples.at(-1)!.time - samples[0].time,
      maxCorrection: Math.max(...samples.map((q) => q.correction)),
      maxLead: Math.max(...samples.map((q) => q.predictionLead)),
      paths,
    });
  }
}
const result = {
  errors: qa.errors,
  transport: qa.transport,
  reversalEpsilon: 0.01,
  penetrationEpsilon: 1e-7,
  results,
};
writeFileSync(`${dir}/VERIFICATION.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
