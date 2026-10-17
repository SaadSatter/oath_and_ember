// Local presentation follows confirmed shared claims; it never grants items.
export const CHEST_OPEN_MS = 720;
export const REWARD_RISE_MS = 650;
export const REWARD_HOLD_MS = 750;
export const REWARD_FADE_MS = 400;
export const REWARD_START_MS = 480;
export const REWARD_END_MS =
  REWARD_START_MS + REWARD_RISE_MS + REWARD_HOLD_MS + REWARD_FADE_MS;

export class ChestRewardAnimation {
  private initialized = false;
  private claimed = false;
  private startedAt: number | undefined;

  update(claimed: boolean, now: number) {
    // A first snapshot after joining/re-entering shows the final chest state.
    if (this.initialized && claimed && !this.claimed) this.startedAt = now;
    if (!claimed) this.startedAt = undefined;
    this.initialized = true;
    this.claimed = claimed;
    const elapsed =
      this.startedAt === undefined
        ? undefined
        : Math.max(0, now - this.startedAt);
    const rewardTime = elapsed === undefined ? -1 : elapsed - REWARD_START_MS;
    const rise = Math.min(1, Math.max(0, rewardTime / REWARD_RISE_MS));
    const fade = Math.min(
      1,
      Math.max(
        0,
        (rewardTime - REWARD_RISE_MS - REWARD_HOLD_MS) / REWARD_FADE_MS,
      ),
    );
    return {
      chestFrame: !claimed
        ? 0
        : elapsed === undefined
          ? 8
          : Math.min(8, Math.floor(elapsed / (CHEST_OPEN_MS / 8))),
      rewardVisible: rewardTime >= 0 && fade < 1,
      rewardY: -12 - 76 * (1 - (1 - rise) ** 3),
      rewardAlpha: Math.min(1, Math.max(0, rewardTime / 140)) * (1 - fade),
      shineFrame: Math.floor(Math.max(0, rewardTime) / (1000 / 15)) % 16,
    };
  }
}
