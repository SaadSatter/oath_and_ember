// Where this checkout lives, resolved from this file's location, never from
// the process's working directory (review H1). Every worktree of the
// repository shares one git common directory; the spend ledger and the final
// evaluation register live there, so all worktrees share one budget.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

/** The name in this project's package.json. */
const PROJECT_NAME = "oath-and-ember";

/**
 * The project folder that contains `from`: the nearest directory, at or below
 * the git top level, whose package.json is this project's. In this repository
 * that is the top level itself; in the course repository it is
 * midterms/saadsatter/, whose git top level is the course repository.
 * Without such a package.json (a test's scratch repository) it is the top level.
 */
function projectRoot(from: string, top: string): string {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    const manifest = join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        if (JSON.parse(readFileSync(manifest, "utf8")).name === PROJECT_NAME) return dir;
      } catch {
        // Not a readable manifest: keep looking.
      }
    }
    if (dir === resolve(top) || dir === dirname(dir)) return top;
  }
}

export function repoInfo(from: string = MODULE_DIR): RepoInfo {
  const top = git(from, "rev-parse", "--show-toplevel");
  const root = projectRoot(from, top);
  const commonDir = resolve(root, git(root, "rev-parse", "--path-format=absolute", "--git-common-dir"));
  return {
    root,
    commonDir,
    head: git(root, "rev-parse", "HEAD"),
    // Only this project's files: in the course repository, other folders do not count.
    dirty: git(root, "status", "--porcelain", "--untracked-files=normal", "--", ".") !== "",
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

/** Written once when the canonical ledger is initialized; never removed (re-review M1). */
export function ledgerMarkerPath(info: Pick<RepoInfo, "commonDir"> = repoInfo()) {
  return join(evalStateDir(info), "spend-ledger.init.json");
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

/**
 * Other worktrees whose checked-out code can make paid model calls without
 * the canonical ledger (re-review H1-a): a `scripts/midterm/run-episode.ts`
 * that builds a paid gateway and lacks the guard that refuses paid policies.
 * Read-only: it only reads files on disk and never changes the worktree.
 */
export function unmeteredWorktrees(info: Pick<RepoInfo, "root"> = repoInfo()): { worktree: string; file: string }[] {
  const out: { worktree: string; file: string }[] = [];
  for (const w of worktrees(info)) {
    if (resolve(w) === resolve(info.root)) continue;
    const file = join(w, "scripts", "midterm", "run-episode.ts");
    if (!existsSync(file)) continue;
    const src = readFileSync(file, "utf8");
    if (/new (AnthropicGateway|OpenAIGateway)\(/.test(src) && !/requireLedgerEntrypoint\(/.test(src)) out.push({ worktree: w, file });
  }
  return out;
}
