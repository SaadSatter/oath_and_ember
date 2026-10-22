import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  defaultReview,
  emptyReview,
  applyReviewUpdates,
  validateReview,
} from "../tools/sound-gallery/review-state.mjs";
const catalog = JSON.parse(
  await readFile("tools/sound-gallery/catalog.json", "utf8"),
);
const supplied = process.argv[2]
  ? validateReview(JSON.parse(await readFile(process.argv[2], "utf8")), catalog)
  : emptyReview(catalog);
const review = applyReviewUpdates(supplied, catalog);
const path = "apps/client/public/assets/audio";
await mkdir(path, { recursive: true });
for (const a of catalog.assets) {
  const data = await readFile(`tools/sound-gallery${a.url}`);
  if (createHash("sha256").update(data).digest("hex") !== a.sha256)
    throw Error(`Audio source changed: ${a.id}`);
  await writeFile(`${path}/${a.url.split("/").pop()}`, data);
}
for (const file of [
  "SOUND_ASSET_VERIFICATION.json",
  "interface-License.txt",
  "impact-License.txt",
  "rpg-License.txt",
])
  await copyFile(`tools/sound-gallery/reference/${file}`, `${path}/${file}`);
await writeFile(
  "apps/client/src/audio/sourceFiles.json",
  JSON.stringify(
    Object.fromEntries(
      catalog.assets.map((a) => [
        a.id,
        "/assets/audio/" + a.url.split("/").pop(),
      ]),
    ),
    null,
    2,
  ) + "\n",
);
const cues = Object.fromEntries(
  catalog.events.map((e) => {
    const r = review.events[e.id] ?? defaultReview(e);
    return [
      e.name,
      {
        id: e.id,
        tracks: r.status === "Approved" && !e.silent ? r.tracks : [],
        silent: e.silent,
      },
    ];
  }),
);
await writeFile(
  "apps/client/src/audio/approvedCues.json",
  JSON.stringify(cues, null, 2) + "\n",
);
await writeFile(
  `${path}/APPROVED_SELECTIONS.json`,
  JSON.stringify(
    {
      planSha256: catalog.planSha256,
      planCommit: catalog.planCommit,
      review,
      assets: catalog.assets,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Prepared ${catalog.assets.length} verified sources and ${Object.keys(cues).length} reviewed cues; intentional silence retained.`,
);
