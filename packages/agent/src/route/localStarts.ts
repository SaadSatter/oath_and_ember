// Evaluator preparation only. Enter an approved tuning area through ordinary
// actions and stop at the transition: no arrival-dialogue reader or puzzle play.
// The existing fullQuest travel helper and its frozen callers stay unchanged.
import type { AgentEnvironment } from "../environment.js";
import { Director } from "./director.js";
import { SHRINE } from "./routeConstants.js";

export type LocalArea = "Mirror Pond" | "Hedge Maze";
export async function enterLocalArea(env: AgentEnvironment, area: LocalArea) {
  const d = new Director({ env });
  const west = area === "Mirror Pond";
  const point = SHRINE[west ? "west" : "east"];
  await d.go({
    sieg: {
      to: { x: point.x + (west ? 0.5 : -0.4), y: point.y },
      opts: { tolerance: 0.6 },
    },
  });
  await d.both({ type: "interact" }, { type: "wait", ticks: 1 });
  // observe() does not run time or read a story line. Validate both heroes,
  // without reaching the room, private state, or server transition directly.
  for (const id of ["sieg", "coco"] as const)
    if ((await env.observe(id)).area.name !== area)
      throw Error(`Local preparation did not enter ${area} with both heroes.`);
}
