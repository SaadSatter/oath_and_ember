// Owner only: record approval of one final (held-out) evaluation run (review H2).
//
//   node --import tsx scripts/midterm/final-approve.ts --player baseline-quest \
//     --situations S1,S2,S3,S4,F --seeds 100,101 [--stage final] --by "<name>" [--note "..."]
//
// The approval is tied to the current HEAD, which must be committed and clean.
// It is appended to the hash-chained final register in the git common
// directory after a typed confirmation on an interactive terminal. It does not
// run anything; evaluate.ts --final then checks it before every episode.

import { recordApproval, registerPath, type FinalApproval } from "../../packages/agent/src/finalAccess.js";
import { repoInfo } from "../../packages/agent/src/repo.js";
import type { SituationId } from "../../packages/agent/src/suite.js";
import { confirmTyped } from "./tty.js";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const repo = repoInfo();
if (repo.dirty) throw Error("Commit or remove local changes first: an approval names one clean commit.");
const approval: FinalApproval = {
  revision: repo.head,
  player: arg("--player") as FinalApproval["player"],
  stage: (arg("--stage") ?? "final") as FinalApproval["stage"],
  situations: (arg("--situations") ?? "").split(",").filter(Boolean) as SituationId[],
  seeds: (arg("--seeds") ?? "").split(",").filter(Boolean).map(Number),
  approvedBy: arg("--by") ?? "",
  ...(arg("--note") ? { note: arg("--note")! } : {}),
};
console.log(JSON.stringify({ register: registerPath(repo), approval }, null, 2));
await confirmTyped("This authorizes the final evaluation above for this commit only.", `APPROVE FINAL ${repo.head.slice(0, 12)}`);
const line = recordApproval(repo, approval);
console.log(`Recorded approval ${line.hash} at register line ${line.seq + 1}.`);
