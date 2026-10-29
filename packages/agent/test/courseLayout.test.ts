// The project must also run from the course repository, where it is the
// folder midterms/saadsatter/ and git's top level is the course repository
// (rubric 3a). Found by the clean-clone rehearsal on 2026-10-29: repoInfo()
// returned the git top level, so the launchers looked for the manual and the
// built client outside the folder. Offline; scratch git repositories only.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repoInfo } from "../src/repo.js";

function courseRepo() {
  const top = realpathSync(mkdtempSync(join(tmpdir(), "course-")));
  const git = (...a: string[]) => execFileSync("git", ["-C", top, ...a], { stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  const folder = join(top, "midterms", "saadsatter");
  mkdirSync(join(folder, "packages", "agent", "src"), { recursive: true });
  writeFileSync(join(folder, "package.json"), JSON.stringify({ name: "oath-and-ember" }));
  writeFileSync(join(top, "README.md"), "course\n");
  git("add", "-A");
  git("commit", "-qm", "init");
  return { top, folder, git };
}

describe("running from the course repository's folder", () => {
  it("treats midterms/saadsatter/ as the project root, not the course repository", () => {
    const { top, folder } = courseRepo();
    const info = repoInfo(join(folder, "packages", "agent", "src"));
    expect(info.root).toBe(folder);
    // The spend ledger and final register still live in the one git common directory.
    expect(info.commonDir).toBe(join(top, ".git"));
  });

  it("counts only this folder's changes as dirty", () => {
    const { top, folder } = courseRepo();
    writeFileSync(join(top, "other-student.txt"), "not ours\n");
    expect(repoInfo(folder).dirty).toBe(false);
    writeFileSync(join(folder, "ours.txt"), "ours\n");
    expect(repoInfo(folder).dirty).toBe(true);
  });

  it("keeps the git top level as the root when no project package.json is found (scratch repositories)", () => {
    const { top } = courseRepo();
    expect(repoInfo(top).root).toBe(top);
  });
});
