import type { World } from "../../../packages/shared/src/gameTypes.js";
import type { ItemId } from "../../../packages/shared/src/items.js";
import type { StoryCheckpointId } from "../../../packages/shared/src/storyCheckpoints.js";
import { storyCheckpoints } from "../../../packages/shared/src/storyCheckpoints.js";
import {
  cutscenes,
  prologueEnd,
} from "../../../packages/shared/src/prologue.js";
import { storySpots } from "../../../packages/shared/src/chapter0.js";
import { maps } from "../../../packages/shared/src/maps.js";
import { BAG_FLAG } from "../../../packages/shared/src/storyProps.js";
import { beginPrologue, startCutscene, type StoryHost } from "./prologue.js";

const beforeShopping = [
  "visit",
  "fork",
  "cart",
  "ambush",
  "rescue",
  "home",
  "farewell",
  "morning",
];
const beforeFuneral = [
  ...beforeShopping,
  "errand",
  "errand-brynn",
  "errand-store",
  "errand-bakery",
  "errand-done",
  "homecoming",
  "silent",
  "discovery",
  "sets-out",
  "stranger",
  "glance",
  "no-fire",
  "reunion",
];

const afterInvestigation = [
  "ask-bertram",
  "ask-brynn",
  "ask-merchant",
  "clues-done",
  "journal",
  "decision",
];

export function beginStoryCheckpoint(
  w: World,
  host: StoryHost,
  checkpoint: StoryCheckpointId,
) {
  beginPrologue(w, host);
  w.checkpoint = storyCheckpoints[checkpoint].title;
  if (
    checkpoint === "prologue" ||
    !Object.values(w.players).some((player) => player.role)
  )
    return;
  const flag = (value: string) => {
    if (!w.story!.flags.includes(value)) w.story!.flags.push(value);
  };
  const transfer = (
    items: Partial<Record<ItemId, number>> | undefined,
    direction = 1,
  ) => {
    if (!items || !w.inventory) return;
    for (const [id, count] of Object.entries(items) as [ItemId, number][])
      w.inventory.counts[id] = Math.max(
        0,
        (w.inventory.counts[id] ?? 0) + count * direction,
      );
    w.inventory.revision++;
  };
  const complete = (id: string) => {
    const scene = cutscenes[id];
    transfer(scene.gives);
    for (const line of scene.lines) {
      if (line.cue === "drop-bag") flag(BAG_FLAG);
      if (line.setFlag) flag(line.setFlag);
      transfer(line.give);
      transfer(line.take, -1);
    }
    flag(scene.flag);
  };
  for (const id of checkpoint === "shopping" ? beforeShopping : beforeFuneral)
    complete(id);
  if (checkpoint === "shopping") {
    w.story!.stage = "ERRAND";
    for (const player of Object.values(w.players)) {
      if (!player.role) continue;
      const at = prologueEnd[player.role];
      host.relocate(player, at.scene, at);
      player.facing = at.facing;
    }
    startCutscene(w, "errand", host);
  } else if (checkpoint === "funeral") {
    w.story!.stage = "MOURNING";
    for (const player of Object.values(w.players)) {
      const at = player.role && cutscenes["next-day"].placement[player.role];
      if (!at) continue;
      host.relocate(player, at.scene ?? "MAIN_HOUSE", at);
      player.facing = at.facing;
    }
    startCutscene(w, "next-day", host);
  } else {
    complete("next-day");
    for (const spot of storySpots.filter(
      (spot) => spot.stage === "FUNERAL_PREP",
    )) {
      transfer(spot.gives);
      transfer(spot.take, -1);
      flag(spot.flag);
    }
    complete("funeral");
    delete w.story!.alden;
    w.story!.stage = "INVESTIGATION";
    // The Forgotten Shrine: the questions asked, the journal found, the
    // decision made; the road north out of Emberbrook is open.
    if (checkpoint === "shrine") {
      for (const id of afterInvestigation) complete(id);
      for (const spot of storySpots.filter((s) => s.stage === "JOURNAL"))
        flag(spot.flag);
      w.story!.stage = "SHRINE_ROAD";
    }
    host.travel("EMBERBROOK_VILLAGE");
    const north = maps.EMBERBROOK_VILLAGE.points.exit;
    Object.values(w.players).forEach((player, index) => {
      host.relocate(
        player,
        "EMBERBROOK_VILLAGE",
        checkpoint === "shrine"
          ? { x: north.x - 20 + index * 40, y: north.y + 72 }
          : {
              x: maps.EMBERBROOK_VILLAGE.spawn.x + index * 40,
              y: maps.EMBERBROOK_VILLAGE.spawn.y,
            },
      );
      player.facing = checkpoint === "shrine" ? -Math.PI / 2 : 0;
    });
  }
  w.checkpoint = storyCheckpoints[checkpoint].title;
}
