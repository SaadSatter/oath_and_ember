import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { digest } from "./generation.js";
import { idSchema, type Asset } from "./model.js";

/** Remove superseded QA media only after immutable approved provenance exists. */
export function cleanupApprovedIterations(root: string, a: Asset) {
  idSchema.parse(a.asset_id);
  if (a.status !== "APPROVED")
    throw Error("Cleanup requires an approved asset");
  const approved = join(root, "art/approved", a.asset_id);
  for (const file of [
    "provenance.json",
    "human-approval.json",
    "accepted-review.json",
  ])
    if (!existsSync(join(approved, file)))
      throw Error("Approved provenance is incomplete; cleanup blocked");
  if (
    digest(join(approved, "atlas.png")) !== a.source_hash ||
    digest(join(approved, "mask.png")) !== a.integration_hash
  )
    throw Error("Approved source changed; cleanup blocked");
  const qa = join(root, "art/qa", a.asset_id);
  if (!existsSync(qa)) return [];
  const removed: string[] = [];
  for (const entry of readdirSync(qa, { withFileTypes: true })) {
    const match = /^iteration-([0-9]+)$/.exec(entry.name);
    if (!entry.isDirectory() || !match || Number(match[1]) >= a.iteration)
      continue;
    const source = join(qa, entry.name);
    const history = join(approved, "history", entry.name);
    mkdirSync(history, { recursive: true });
    // Retain decisions/reports, not bulky candidates or captured media.
    for (const file of readdirSync(source, { withFileTypes: true }))
      if (file.isFile() && file.name.endsWith(".json"))
        copyFileSync(join(source, file.name), join(history, file.name));
    const record = join(history, "cleanup.json");
    if (!existsSync(record))
      writeFileSync(
        record,
        JSON.stringify(
          {
            source: `art/qa/${a.asset_id}/${entry.name}`,
            reports: readdirSync(history).filter((f) => f.endsWith(".json")),
            approvedIteration: a.iteration,
            deleted_at: new Date().toISOString(),
            note: "Superseded media removed after approval; historical evidence paths describe deleted captures.",
          },
          null,
          2,
        ) + "\n",
      );
    // Read back the record before destructive cleanup.
    JSON.parse(readFileSync(record, "utf8"));
    rmSync(source, { recursive: true });
    removed.push(entry.name);
  }
  return removed;
}
