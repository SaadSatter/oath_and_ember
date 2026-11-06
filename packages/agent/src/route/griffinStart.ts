// Evaluator preparation only (Griffin Trials, docs/midterm/SITUATION_B_GRIFFIN.md).
// From the shrine, Sieg walks to the north exit ("NORTH · GRIFFIN TRAIL") and
// presses E, which moves the whole party to the Griffin Enclosure. Preparation
// stops on that transition, before the arrival scene and before either hero
// moves inside: no combat, nest or item action. It uses only the
// five-operation interface, like the existing local starts (localStarts.ts),
// which stay unchanged.
import type { AgentEnvironment } from "../environment.js";
import { Director } from "./director.js";
import { SHRINE } from "./routeConstants.js";

export async function enterGriffinEnclosure(env: AgentEnvironment) {
  const d = new Director({ env });
  const point = SHRINE.north;
  // From the opening's end, west of the statue's wall and up to the same
  // approach point as the scripted route's north travel (fullQuest.ts travelFromShrine).
  for (const to of [{ x: 16, y: 18.5 }, { x: 16, y: 10.5 }])
    await d.go({ sieg: { to, opts: { tolerance: 0.4 } } });
  await d.go({ sieg: { to: { x: point.x, y: point.y + 0.5 }, opts: { tolerance: 0.6 } } });
  await d.both({ type: "interact" }, { type: "wait", ticks: 1 });
  for (const id of ["sieg", "coco"] as const)
    if ((await env.observe(id)).area.name !== "Griffin Enclosure")
      throw Error("Griffin preparation did not enter the Griffin Enclosure with both heroes.");
}
