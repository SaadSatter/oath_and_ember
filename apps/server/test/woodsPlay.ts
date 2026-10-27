import { expect } from "vitest";
import type { GameRoom } from "../src/GameRoom.js";
import {
  neutral,
  type InputFrame,
  type Player,
} from "../../../packages/shared/src/gameTypes.js";
import {
  WOODS,
  woodsCrate,
  woodsLesson,
  woodsSteps,
} from "../../../packages/shared/src/prologueWoods.js";

// Plays the Mossling Woods tutorial through the room's real input path.

/** One input frame through receiveInput (as a socket would), then a tick. */
export function send(r: GameRoom, p: Player, frame: Partial<InputFrame> = {}) {
  const s = r.sessions.get(p.id)!;
  const seq = Math.max(s.input.seq, p.lastProcessedInputSeq) + 1;
  r.receiveInput(p.id, { ...neutral(seq), ...frame });
  r.tick();
}
/** Both heroes read every line of whatever scene is playing. */
export function readOn(r: GameRoom, players: Player[]) {
  for (let guard = 0; r.state.story?.cutscene && guard < 500; guard++) {
    const run = r.state.story.cutscene;
    const read = players.map(
      (p) => r.readStoryLine(p.id, run.id, run.line).accepted,
    );
    if (!read.some(Boolean)) r.tick();
  }
}
/** The current lesson's living mosslings. */
export const lessonMosslings = (r: GameRoom) =>
  Object.values(r.state.enemies).filter(
    (e) => e.id.startsWith("woods-") && e.state !== "DEAD" && e.hp > 0,
  );
/** Beat every mossling there is (as if struck down), and let them fall. */
export function beatMosslings(r: GameRoom) {
  for (const e of lessonMosslings(r)) e.hp = 0;
  r.tick();
}
/** Play the lesson's opening scene; the lesson then begins. */
export function openLesson(r: GameRoom, players: Player[]) {
  r.tick();
  readOn(r, players);
  r.tick();
}

/** Play the whole tutorial from arriving in the woods to its last scene. */
export function clearWoods(r: GameRoom, sieg: Player, coco: Player) {
  const both = [sieg, coco];
  expect(r.state.sceneId).toBe(WOODS);
  r.tick();
  readOn(r, both);
  for (const step of woodsSteps) {
    openLesson(r, both);
    expect(woodsLesson(r.state.story)).toBe(step);
    if (step === "attack") {
      send(r, sieg, { primaryHeld: true });
      send(r, sieg);
      send(r, coco, { primaryHeld: true });
      send(r, coco);
    }
    if (step === "defend")
      for (const p of both) {
        send(r, p, { secondaryHeld: true });
        r.damage(p, 10);
        send(r, p, { secondaryHeld: true });
        send(r, p);
      }
    if (step === "time") {
      send(r, coco, { slowTimeHeld: true });
      send(r, coco);
      send(r, sieg, { sprintHeld: true });
      send(r, sieg);
    }
    if (step === "flight") {
      send(r, coco, { flightHeld: true });
      Object.assign(coco, woodsCrate);
      send(r, coco, { interactHeld: true });
      send(r, coco);
      Object.assign(coco, { x: sieg.x + 30, y: sieg.y });
      r.tick();
    }
    if (step === "black_hole") {
      // Coco stands above the pack and fires straight down into it.
      Object.assign(coco, { x: 760, y: 560 });
      Object.assign(sieg, { x: 600, y: 560 });
      send(r, coco, { moveY: 1, blackHoleHeld: true });
      for (let i = 0; i < 900 && !r.state.story!.woods!.did.EMBER; i++)
        send(r, coco);
    }
    beatMosslings(r);
    expect(r.state.story!.woods!.step).toBe(woodsSteps.indexOf(step) + 1);
  }
  r.tick();
  readOn(r, both);
}
