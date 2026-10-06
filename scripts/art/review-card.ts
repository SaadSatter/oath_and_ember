import { resolveContract } from "./contracts.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Asset, Finding } from "./model.js";
import { approvalEvidence } from "./human-decisions.js";
import { digest } from "./generation.js";
export function reviewDirectory(a: Asset) {
  return `art/qa/${a.asset_id}/iteration-${String(a.iteration).padStart(2, "0")}`;
}
export function buildReviewCard(root: string, a: Asset) {
  const dir = reviewDirectory(a);
  const safe = (p: string | undefined) =>
    p &&
    resolve(root, p).startsWith(resolve(root) + "/") &&
    existsSync(join(root, p))
      ? p
      : undefined;
  const indexFile = join(root, dir, "temporal/index.json");
  const recordings: { client: number; viewport: string; path: string }[] =
    existsSync(indexFile)
      ? JSON.parse(readFileSync(indexFile, "utf8")).recordings || []
      : [];
  const video = (client: number) =>
    safe(
      [...recordings]
        .filter((r) => r.client === client)
        .sort(
          (a, b) =>
            Number(b.viewport === "1920x1080") -
            Number(a.viewport === "1920x1080"),
        )
        .find((r) => safe(r.path))?.path,
    );
  const animated =
    ["ward", "projectile"].includes(a.animation) || recordings.length > 0;
  const contact = safe(`${dir}/contact-sheet.png`),
    atlas = safe(a.runtime_files[0]),
    mask = safe(a.runtime_files[1]);
  let localClient = 2;
  try {
    localClient = resolveContract(a, root).qa.role === "OATH" ? 1 : 2;
  } catch {}
  const remoteClient = localClient === 1 ? 2 : 1;
  const local = animated
    ? video(localClient)
    : safe(`${dir}/1920x1080-client-${localClient}-loop.png`);
  const remote = animated
    ? video(remoteClient)
    : safe(`${dir}/1920x1080-client-${remoteClient}-loop.png`);
  const checks = new Map<string, Finding>();
  const qa = join(root, dir, "qa-report.json");
  if (existsSync(qa))
    for (const c of JSON.parse(readFileSync(qa, "utf8")).checks || [])
      checks.set(c.id, c);
  const latest = [...a.reports]
    .reverse()
    .find((p) => p.startsWith(dir + "/") && existsSync(join(root, p)));
  if (latest)
    for (const c of JSON.parse(readFileSync(join(root, latest), "utf8"))
      .checks || [])
      if (checks.get(c.id)?.result !== "FAIL") checks.set(c.id, c);
  let approvalBlocked: string | undefined;
  try {
    approvalEvidence(root, a);
    if (
      a.runtime_files.some(
        (p, i) =>
          digest(join(root, p)) !== [a.source_hash, a.integration_hash][i],
      )
    )
      throw Error("Candidate changed after QA");
  } catch (e) {
    if (!["APPROVED", "REJECTED"].includes(a.status))
      approvalBlocked = String(e);
  }
  const findings = [...checks.values()];
  const previous =
    a.iteration > 1
      ? `art/qa/${a.asset_id}/iteration-${String(a.iteration - 1).padStart(2, "0")}`
      : undefined;
  return {
    assetId: a.asset_id,
    iteration: a.pending_revision?.to_iteration ?? a.iteration,
    evidenceIteration: a.iteration,
    pendingPreview: !!a.pending_revision,
    status: a.status,
    published:
      !!a.target &&
      (a.mask_target !== null || a.contract?.mask.strategy === "none") &&
      existsSync(join(root, `art/approved/${a.asset_id}/previous-runtime`)) &&
      existsSync(join(root, "apps/client/public", a.target)) &&
      (!a.mask_target ||
        existsSync(join(root, "apps/client/public", a.mask_target))) &&
      digest(join(root, "apps/client/public", a.target)) === a.source_hash &&
      (!a.mask_target ||
        digest(join(root, "apps/client/public", a.mask_target)) ===
          a.integration_hash),
    animated,
    best: local || remote || contact || atlas,
    local,
    remote,
    contact,
    atlas,
    mask,
    responsive: ["1440x900", "390x844", "844x390"]
      .map((size) => safe(`${dir}/${size}-client-2-loop.png`))
      .filter((p): p is string => !!p),
    previous: previous
      ? {
          contact: safe(`${previous}/contact-sheet.png`),
          video: safe(`${previous}/temporal/1920x1080-client-2.webm`),
        }
      : undefined,
    findings,
    unresolved: findings.filter((c) => c.result !== "PASS"),
    approvalBlocked,
    page: safe(`${dir}/review.html`),
  };
}
export type ReviewCard = ReturnType<typeof buildReviewCard>;
export function formatReviewCard(root: string, c: ReviewCard) {
  const path = (p: string | undefined) =>
    p ? resolve(root, p) : "Not available";
  const link = (label: string, p: string | undefined) =>
    p
      ? `\u001b]8;;${pathToFileURL(resolve(root, p)).href}\u0007${label}\u001b]8;;\u0007`
      : "Not available";
  const shellQuote = (value: string) =>
    "'" + value.replaceAll("'", "'\\''") + "'";
  const lines = [
    `Review Card: ${c.assetId} · iteration ${c.iteration} · ${c.status}`,
    ...(c.pendingPreview
      ? [
          `No new improvement preview yet: iteration ${c.iteration} is pending.`,
          `The links and QA findings below belong to PREVIOUS iteration ${c.evidenceIteration}.`,
        ]
      : []),
    `View ${c.pendingPreview ? "previous preview" : "improvement preview"}: ${link("Open review page", c.page)}`,
    ...(c.page && process.platform === "darwin"
      ? [`Open in browser: open ${shellQuote(resolve(root, c.page))}`]
      : []),
    `Best ${/\.webm$/i.test(c.best || "") ? "animation" : "available image"}: ${link(c.pendingPreview ? "Watch previous evidence" : "Open visual evidence", c.best)} — ${path(c.best)}`,
    `Local client: ${path(c.local)}`,
    `Remote client: ${path(c.remote)}`,
    `Contact sheet: ${path(c.contact)}`,
    `Review page: ${path(c.page)}`,
    c.pendingPreview
      ? `Previous iteration ${c.evidenceIteration} assessment (does not validate the requested improvement):`
      : "Automated assessment:",
  ];
  for (const check of c.findings)
    lines.push(
      `  ${check.result === "PASS" ? "✓" : check.result === "FAIL" ? "✗" : "△"} ${check.id}: ${check.result}${check.feedback ? ` — ${check.feedback}` : ""}`,
    );
  if (!c.findings.length)
    lines.push("  QA has not completed. No approval inferred.");
  if (c.approvalBlocked && !["APPROVED", "REJECTED"].includes(c.status))
    lines.push(`APPROVE blocked: ${c.approvalBlocked}`);
  if (["APPROVED", "REJECTED"].includes(c.status)) {
    lines.push(
      c.status === "APPROVED"
        ? c.published
          ? "Human approved and publication verified; machine findings preserved."
          : "Human approved; publication has not been verified."
        : "Candidate rejected; history retained. Workflow terminated.",
    );
    return lines.join("\n");
  }
  lines.push(
    c.pendingPreview
      ? "Engineering/art handoff pending. Complete it, then RESUME to produce the improvement preview."
      : "Choose APPROVE, IMPROVE: <feedback>, or REJECT: <reason>.",
    ...(c.pendingPreview
      ? [`npm run art:agent -- --asset ${c.assetId} "RESUME"`]
      : [
          `npm run art:agent -- --asset ${c.assetId} "APPROVE"`,
          `npm run art:agent -- --asset ${c.assetId} "IMPROVE: <feedback>"`,
          `npm run art:agent -- --asset ${c.assetId} "REJECT: <reason>"`,
        ]),
  );
  return lines.join("\n");
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function writeReviewPage(root: string, a: Asset) {
  const dir = join(root, reviewDirectory(a));
  if (!existsSync(join(dir, "qa-report.json"))) return buildReviewCard(root, a);
  const card = buildReviewCard(root, a),
    file = join(dir, "review.html");
  // UI is derived, replaceable output; original evidence/reports never overwritten.
  const media = (label: string, p: string | undefined) => {
    if (!p) return "";
    const src = relative(dir, resolve(root, p))
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    return `<section><h2>${escape(label)}</h2>${/\.webm$/i.test(p) ? `<video controls preload="metadata" src="${escape(src)}"></video>` : `<img loading="lazy" src="${escape(src)}" alt="${escape(label)}">`}<p>${escape(p)}</p></section>`;
  };
  const command = (text: string) =>
    `npm run art:agent -- --asset ${a.asset_id} "${text}"`;
  writeFileSync(
    file,
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(a.asset_id)} review</title><style>body{font:16px system-ui;background:#131a23;color:#eee;margin:2rem;max-width:1200px}video,img{max-width:100%;max-height:70vh;image-rendering:pixelated}section{padding:1rem;background:#202b38;margin:1rem 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#91ceff}</style><h1>${escape(card.assetId)} · evidence iteration ${card.evidenceIteration}</h1>${card.pendingPreview ? `<p><strong>No new improvement preview yet. Requested iteration ${card.iteration} is pending; all evidence below belongs to previous iteration ${card.evidenceIteration}.</strong></p>` : ""}<p>${escape(card.status)}. Human acceptance is separate from machine findings.</p>${media("Primary evidence / local client", card.best)}${card.remote !== card.best ? media("Remote client", card.remote) : ""}${media("Contact sheet", card.contact)}${media("Candidate atlas", card.atlas)}${media("Palette mask", card.mask)}${card.responsive.map((p) => media("Responsive comparison", p)).join("")}${media("Previous iteration video", card.previous?.video)}${media("Previous contact sheet", card.previous?.contact)}<h2>QA findings</h2><ul>${card.findings.map((c) => `<li>${escape(`${c.result} ${c.id}: ${c.feedback || ""}`)}</li>`).join("")}</ul><h2>Unresolved</h2><ul>${card.unresolved.map((c) => `<li>${escape(`${c.id}: ${c.feedback || c.result}`)}</li>`).join("")}</ul><h2>Human decision</h2><p>Copy one command into your terminal. No server or automatic publication from this page.</p>${card.approvalBlocked ? `<p>Approval blocked: ${escape(card.approvalBlocked)}</p>` : ""}<pre>${escape((card.pendingPreview ? [command("RESUME")] : [command("APPROVE"), command("IMPROVE: your feedback"), command("REJECT: your reason")]).join("\n"))}</pre></html>`,
  );
  return buildReviewCard(root, a);
}
