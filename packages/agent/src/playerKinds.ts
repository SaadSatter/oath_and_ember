// The suite's player kinds (docs/midterm/EVALUATION_SUITE.md). Dependency-free
// so the held-out gate can name them without importing any policy (review H3:
// the suite's import closure never reaches the quest-aware baseline).

export type PlayerKind = "baseline-quest" | "baseline-explore" | "model-history" | "model-obs-only" | "model-guided" | "model-memory";
export const PLAYER_KINDS: readonly PlayerKind[] = Object.freeze(["baseline-quest", "baseline-explore", "model-history", "model-obs-only", "model-guided", "model-memory"]);
