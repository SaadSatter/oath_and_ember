import { expect, it } from "vitest";
import {
  ChestRewardAnimation,
  REWARD_END_MS,
  REWARD_START_MS,
} from "../src/animation/chestReward.js";

it("waits for a confirmed claim, opens once across repeated snapshots, then lifts and fades the reward", () => {
  const animation = new ChestRewardAnimation();
  expect(animation.update(false, 0)).toMatchObject({
    chestFrame: 0,
    rewardVisible: false,
  });
  expect(animation.update(true, 100)).toMatchObject({
    chestFrame: 0,
    rewardVisible: false,
  });
  const rising = animation.update(true, 100 + REWARD_START_MS + 300);
  expect(rising.chestFrame).toBe(8);
  expect(rising.rewardVisible).toBe(true);
  const held = animation.update(true, 1400);
  expect(held.rewardY).toBeLessThan(rising.rewardY);
  expect(held.rewardAlpha).toBe(1);
  expect(animation.update(true, 100 + REWARD_END_MS)).toMatchObject({
    chestFrame: 8,
    rewardVisible: false,
    rewardAlpha: 0,
  });
  expect(animation.update(true, 10000).rewardVisible).toBe(false);
});

it("shows an already claimed chest open on entry without replaying a reward, and resets for a new unclaimed state", () => {
  const animation = new ChestRewardAnimation();
  expect(animation.update(true, 0)).toMatchObject({
    chestFrame: 8,
    rewardVisible: false,
  });
  expect(animation.update(true, 1000).rewardVisible).toBe(false);
  expect(animation.update(false, 2000).chestFrame).toBe(0);
  animation.update(true, 2500);
  expect(animation.update(true, 3500).rewardVisible).toBe(true);
});

it("lets both observers see the complete one-shot sequence despite different snapshot arrival times", () => {
  const clients = [new ChestRewardAnimation(), new ChestRewardAnimation()];
  for (const animation of clients) animation.update(false, 0);
  clients[0].update(true, 100);
  clients[1].update(true, 166);
  expect(clients[0].update(true, 1100)).toEqual(clients[1].update(true, 1166));
});
