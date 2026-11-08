// Real persistent authorizations in scratch ledgers; transports remain mocked.
import { execFileSync } from "node:child_process";
import { afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SpendLedger } from "../../src/ledger.js";
import {
  ModelBudget,
  MeteredGateway,
  defaultBudgetLimits,
  type CompletionOptions,
  type Gateway,
} from "../../src/budget.js";
const fixtures: { dir: string; ledger: SpendLedger }[] = [];
afterEach(() => {
  for (const { dir, ledger } of fixtures.splice(0)) {
    ledger.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
export function authorizeBudget(budget: ModelBudget) {
  const dir = mkdtempSync(join(tmpdir(), "provider-auth-"));
  execFileSync("git", ["init", "-q", dir], { stdio: "pipe" });
  const ledger = SpendLedger.initCanonical({
    root: dir,
    commonDir: join(dir, ".git"),
    head: "offline",
    dirty: false,
  }).ledger;
  fixtures.push({ dir, ledger });
  const entry = ledger.reserve(
    "pilot",
    "offline-provider-test",
    budget.limits.maxSpendUsd,
  );
  budget.bindLedger(ledger, entry);
  return { ledger, entry, dir };
}
export function authorizedCall(
  g: Gateway,
  system: string,
  user: string,
  options?: CompletionOptions,
) {
  const budget = new ModelBudget(defaultBudgetLimits);
  authorizeBudget(budget);
  return new MeteredGateway(g, budget, "sieg").complete(system, user, options);
}
