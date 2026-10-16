import { expect, it } from "vitest";
import { spikeTrapFrame } from "../src/animation/pondSpikes.js";
import {
  pondSpikeColumns,
  pondSpikeState,
  pondSpikeTiming,
  pondSpikes,
} from "../../../packages/shared/src/mirrorPond.js";
it("shows fully raised spikes exactly while a column is dangerous", () => {
  for (let clock = 0; clock < pondSpikeTiming.period * 2; clock += 1 / 120)
    pondSpikeColumns.forEach((column, i) => {
      const dangerous = pondSpikes(clock).includes(column);
      expect(spikeTrapFrame(pondSpikeState(clock, i)) === 3).toBe(dangerous);
    });
});
it("rises out of the ground through warning tips and retracts back down", () => {
  const frames: number[] = [];
  for (let clock = 0; clock < pondSpikeTiming.period; clock += 1 / 60) {
    const frame = spikeTrapFrame(pondSpikeState(clock, 0));
    if (frames.at(-1) !== frame) frames.push(frame);
  }
  expect(frames).toEqual([1, 2, 3, 2, 1, 0]);
});
