# Situation A cheap baseline: baseline-quest on S2-local (S2-A v2), seed 0

**Scripted baseline, not an LLM.** The unchanged deterministic `baseline-quest` player (hand-coded quest knowledge, one script per hero, in-game messages) through the same five-operation interface as the model players. Run offline on 2026-11-06 at clean commit `af0f19e`, whose player and game code are identical to `040685c`, with `node --import tsx scripts/midterm/evaluate.ts --player baseline-quest --situations S2-local --seeds 0`. Registered as Situation A's cheap baseline under declaration r5 ([record](../../../../../docs/midterm/evaluation-abc/A-baseline-quest.json)).

- **Outcome.** `success`: Enchanted Shears in the shared backpack. 3,128 ticks (52.1 game-s), 4.9 s wall clock, 395 decisions (Sieg 231, Coco 164), 0 invalid actions, 6 messages, 0 model calls, $0.
- **Deterministic.** A second run gave the same 395 actions and results and the same end hash `6644f2cac04b945444c3ec609d59d798cd767ecad80405d49ce8cd26314c7f56`, which is also the value pinned for S2-A v2. Configuration hash `51b861b9…` matches the earlier reference run (`baseline-quest-S2-local-seed0-v2`, at `198ef3a+dirty`).
- **Files.** Byte-for-byte copies of the run folder's files (`evaluation-runs/baseline-quest-tuning-1793991393800/`, gitignored). Trace chain verifies. No video: the run was offline.
- **Fairness.** The baseline knows the solution and uses two messaging scripts; the model player knows no solution and is one planner seeing both screens.
