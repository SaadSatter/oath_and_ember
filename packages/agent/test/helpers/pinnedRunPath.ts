// Run-path pins for the B guidance tests (owner approval 2026-11-06, Situation C).
// The pinned hashes are the files as they were at a recorded commit (the code
// Pilot-32/33 ran). They are checked against git history, so they stay true
// after later additive changes; files that Situation C's registration did not
// touch must also still be byte-identical in the working tree. B's behaviour at
// HEAD is pinned separately (start hash, prompt hashes, definition hash).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

const root = fileURLToPath(new URL("../../../..", import.meta.url));
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

/** Files edited (additively) to register Situation C, griffin-prepared-return-v1. */
export const C_REGISTRATION_FILES: ReadonlySet<string> = new Set([
  "packages/agent/src/environment.ts",
  "packages/agent/src/evaluator.ts",
  "packages/agent/src/suite.ts",
  "packages/agent/src/harness.ts",
  "scripts/midterm/live.ts",
]);

export function expectRunPathPinned(commit: string, pins: Record<string, string>) {
  for (const [f, h] of Object.entries(pins)) {
    const historical = execFileSync("git", ["show", `${commit}:${f}`], { cwd: root, maxBuffer: 64 << 20 });
    expect(sha(historical), `${f} at ${commit}`).toBe(h);
    if (!C_REGISTRATION_FILES.has(f)) expect(sha(readFileSync(join(root, f))), `${f} in the working tree`).toBe(h);
  }
}
