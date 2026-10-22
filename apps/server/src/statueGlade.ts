import type { World } from "../../../packages/shared/src/gameTypes.js";
import { collisionRects } from "../../../packages/shared/src/maps.js";
import {
  pushableDefinitions,
  pushableRect,
} from "../../../packages/shared/src/pushables.js";
import {
  GLADE_PUZZLE,
  besideStatue,
  chairDelivered,
  gladeRocks,
  gladeBushFireRect,
  gladeBushRect,
  gladeBushes,
  gladeState,
  gladeStatueSolid,
  newGlade,
} from "../../../packages/shared/src/statueGlade.js";
import { contact } from "./golemBeam.js";
const chair = pushableDefinitions.find((d) => d.id === "puzzle-chair")!;
export function ensureGlade(w: World) {
  w.puzzles[GLADE_PUZZLE] ??= {
    id: GLADE_PUZZLE,
    physical: false,
    arcane: false,
    complete: false,
    progress: 0,
    glade: newGlade(),
  };
}
/** Coco's fire catches the dry thicket; one hit burns every bush. */
export function burnGladeBushes(
  w: World,
  owner: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const state = gladeState(w.puzzles);
  if (
    w.sceneId !== "PUZZLE_GLADE" ||
    !state ||
    state.bushesBurned ||
    w.players[owner]?.role !== "EMBER"
  )
    return false;
  const hit = Math.min(
    ...gladeBushes.map((b) => contact(from, to, gladeBushFireRect(b), 4)),
  );
  if (!Number.isFinite(hit)) return false;
  // A tree, rock, chair or other solid in front of the thicket shields it
  // (pushed objects count where they stand now).
  const bushes = new Set(gladeBushes.map((b) => JSON.stringify(gladeBushRect(b))));
  const blockers = collisionRects(
    "PUZZLE_GLADE",
    w.puzzles,
    w.pushableOffsets,
  ).filter((r) => !bushes.has(JSON.stringify(r)));
  if (blockers.some((r) => contact(from, to, r, 4) < hit - 1e-6)) return false;
  state.bushesBurned = true;
  state.burnedTick = w.serverTick;
  w.worldRevision++;
  return true;
}
/**
 * Rocks pushed up to her are refused (once per arrival, so she can be pestered
 * again); once the chair reaches her pedestal she sits and the way opens.
 */
export function tickGlade(w: World) {
  const state = gladeState(w.puzzles);
  if (w.sceneId !== "PUZZLE_GLADE" || !state) return;
  for (const [id, item] of Object.entries(gladeRocks)) {
    const rock = pushableDefinitions.find((d) => d.id === id);
    if (!rock) continue;
    const beside = besideStatue(pushableRect(rock, w.pushableOffsets));
    const presented = (state.presented ??= {});
    if (beside && !presented[item]) {
      state.rejected = { item, tick: w.serverTick };
      w.worldRevision++;
    }
    presented[item] = beside;
  }
  if (state.seatedTick !== null) return;
  if (!chairDelivered(pushableRect(chair, w.pushableOffsets))) return;
  state.seatedTick = w.serverTick;
  w.puzzles[GLADE_PUZZLE].complete = true;
  // The chair now belongs to the seated statue's artwork: tuck its footprint
  // inside her pedestal so nothing can push it away again.
  const s = gladeStatueSolid;
  (w.pushableOffsets ??= {})[chair.id] = {
    x: s.x + (s.w - chair.rect.w) / 2 - chair.rect.x,
    y: s.y + (s.h - chair.rect.h) / 2 - chair.rect.y,
  };
  w.worldRevision++;
}
