// Where this checkout lives, resolved from this file's location, never from
// the process's working directory (review H1). Every worktree of the
// repository shares one git common directory; the spend ledger and the final
// evaluation register live there, so all worktrees share one budget.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface RepoInfo {
  /** Top of the worktree that contains `from`. */
  root: string;
  /** The git common directory shared by every worktree (absolute). */
  commonDir: string;
  /** Full commit hash of HEAD in this worktree. */
  head: string;
  /** Uncommitted or untracked (non-ignored) changes in this worktree. */
  dirty: boolean;
}

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** The directory of this module: packages/agent/src. */
export const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

export function repoInfo(from: string = MODULE_DIR): RepoInfo {
  const root = git(from, "rev-parse", "--show-toplevel");
  const commonDir = resolve(root, git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"));
  return {
    root,
    commonDir,
    head: git(root, "rev-parse", "HEAD"),
    dirty: git(root, "status", "--porcelain", "--untracked-files=normal") !== "",
  };
}

/** Shared state for evaluation runs, inside the git common directory. */
export function evalStateDir(info: Pick<RepoInfo, "commonDir"> = repoInfo()) {
  return join(info.commonDir, "oath-eval");
}

/** The one spend ledger for every worktree and every paid entrypoint. */
export function canonicalLedgerPath(info: Pick<RepoInfo, "commonDir"> = repoInfo()) {
  return join(evalStateDir(info), "spend-ledger.json");
}

/** Every worktree of this repository (absolute paths), from `git worktree list`. */
export function worktrees(info: Pick<RepoInfo, "root"> = repoInfo()): string[] {
  return git(info.root, "worktree", "list", "--porcelain")
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.slice("worktree ".length));
}

export interface LedgerInventoryItem {
  path: string;
  kind: "canonical" | "legacy";
  exists: boolean;
  locked: boolean;
}

/**
 * Every ledger that could hold spend: the canonical one and the old
 * per-worktree `evaluation-runs/spend-ledger.json` files from before H1.
 */
export function ledgerInventory(info: RepoInfo = repoInfo()): LedgerInventoryItem[] {
  const item = (path: string, kind: LedgerInventoryItem["kind"]) => ({ path, kind, exists: existsSync(path), locked: existsSync(`${path}.lock`) });
  return [
    item(canonicalLedgerPath(info), "canonical"),
    ...worktrees(info).map((w) => item(join(w, "evaluation-runs", "spend-ledger.json"), "legacy")),
  ];
}
