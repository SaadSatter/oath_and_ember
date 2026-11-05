// Verifies a recorded WebM: decodes the whole file, reads its length and
// saves frames at chosen points, each checked for real image content.
// Evidence tooling only; it never touches the game or a trace.
//
//   node --import tsx scripts/evidence/verify-video.ts <video.webm> <outDir> [fractions...]
//
// Uses ffmpeg from PATH, or the one Playwright installs with its browsers
// (~/Library/Caches/ms-playwright/ffmpeg-*/ or ~/.cache/ms-playwright/...).
// A browser-based check was tried first and rejected: on this machine,
// Chromium's canvas readback of these VP8 files returned blank white frames
// for videos that decode correctly (2026-11-05).

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { PNG } from "pngjs";

const [video, outDir, ...rest] = process.argv.slice(2);
if (!video || !outDir) {
  console.error("usage: verify-video.ts <video.webm> <outDir> [fractions...]");
  process.exit(2);
}
const fractions = rest.length ? rest.map(Number) : [0.05, 0.5, 0.97];
mkdirSync(outDir, { recursive: true });

function findFfmpeg(): string {
  if (spawnSync("ffmpeg", ["-version"]).status === 0) return "ffmpeg";
  for (const base of [join(homedir(), "Library/Caches/ms-playwright"), join(homedir(), ".cache/ms-playwright")]) {
    if (!existsSync(base)) continue;
    for (const d of readdirSync(base).filter((n) => n.startsWith("ffmpeg")).sort().reverse())
      for (const exe of ["ffmpeg-mac", "ffmpeg-linux", "ffmpeg"]) if (existsSync(join(base, d, exe))) return join(base, d, exe);
  }
  throw Error("No ffmpeg found (PATH or Playwright's cache).");
}
const ff = findFfmpeg();

// Full decode: proves every frame decodes, and gives the real length (the
// recorder's WebM has no duration in its header).
// Playwright's ffmpeg build has no null muxer: decode every frame into one
// overwritten PNG instead.
const full = spawnSync(ff, ["-hide_banner", "-y", "-i", resolve(video), "-c:v", "png", "-f", "image2", "-update", "1", join(outDir, "full-decode-last.png")], { encoding: "utf8" });
const times = [...full.stderr.matchAll(/time=(\d+):(\d+):([\d.]+)/g)];
const lastTime = times.at(-1);
const duration = lastTime ? Number(lastTime[1]) * 3600 + Number(lastTime[2]) * 60 + Number(lastTime[3]) : NaN;
const decodeErrors = full.stderr.split("\n").filter((l) => /error|invalid|corrupt/i.test(l)).slice(0, 5);

const frames: { fraction: number; time: number; distinctColors: number; meanLuma: number; content: boolean; png: string }[] = [];
for (const f of fractions) {
  const time = Math.max(0, Math.min(duration - 0.1, duration * f));
  const png = join(outDir, `frame-${String(Math.round(f * 1000)).padStart(4, "0")}.png`);
  execFileSync(ff, ["-v", "error", "-y", "-ss", time.toFixed(2), "-i", resolve(video), "-frames:v", "1", "-c:v", "png", "-f", "image2", png]);
  const img = PNG.sync.read(readFileSync(png));
  const colors = new Set<number>();
  let sum = 0, n = 0;
  for (let i = 0; i < img.data.length; i += 4 * 53) {
    sum += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
    colors.add((img.data[i] >> 4) * 256 + (img.data[i + 1] >> 4) * 16 + (img.data[i + 2] >> 4));
    n++;
  }
  frames.push({ fraction: f, time: Math.round(time * 100) / 100, distinctColors: colors.size, meanLuma: Math.round(sum / n), content: colors.size > 16, png });
}
const report = {
  video: resolve(video),
  bytes: statSync(video).size,
  ffmpeg: ff,
  fullDecodeExit: full.status,
  decodeErrors,
  durationSeconds: Math.round(duration * 100) / 100,
  frames,
  ok: full.status === 0 && Number.isFinite(duration) && duration > 0 && frames.every((x) => x.content),
};
writeFileSync(join(outDir, "video-check.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
