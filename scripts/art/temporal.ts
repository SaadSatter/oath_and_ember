import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import type { Asset } from "./model.js";

const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
export interface TemporalFrame {
  path: string; sha256: string; ptsMs: number; sequence: string;
  phaseHint: string; phaseAlignment: "approximate"; client: number; viewport: string;
}
export interface TemporalPacket {
  schema_version: 1; candidateHashes: string[];
  recordings: { path: string; sha256: string }[];
  frames: TemporalFrame[]; limitations: string; tool: string;
}
// Select actual decoded frames, never interpolate or duplicate to manufacture FPS.
export function selectFrames(timestamps: number[], intervalMs = 80): number[] {
  if (!timestamps.length || timestamps.some((t, i) => !Number.isFinite(t) || t < 0 || (i > 0 && t <= timestamps[i - 1])))
    throw Error("Missing or non-monotonic presentation timestamps");
  const selected = [timestamps[0]];
  for (const t of timestamps.slice(1)) if (t - selected.at(-1)! >= intervalMs) selected.push(t);
  return selected;
}
export function cadence(timestamps: number[]) {
  const deltas = timestamps.slice(1).map((t, i) => t - timestamps[i]);
  if (deltas.some(d => !Number.isFinite(d) || d <= 0)) throw Error("Invalid browser callback timestamps");
  const ordered = [...deltas].sort((a, b) => a - b);
  return { samples: timestamps.length, medianIntervalMs: ordered.length ? ordered[Math.floor(ordered.length / 2)] : null,
    maximumIntervalMs: ordered.at(-1) ?? null, intervalsOver50Ms: deltas.filter(d => d > 50).length,
    scope: "requestAnimationFrame callback cadence, not game render completion, display FPS or video cadence; capture overhead can cause stalls" };
}
export function extractTemporal(root: string, a: Asset): TemporalPacket {
  const dir = join(root, `art/qa/${a.asset_id}/iteration-${String(a.iteration).padStart(2, "0")}`);
  if (!existsSync(join(dir, "qa-report.json"))) throw Error("Capture QA before extracting temporal evidence");
  if ([a.source_hash, a.integration_hash].some((h, i) => !h || hash(join(root, a.runtime_files[i])) !== h)) throw Error("Candidate changed after capture");
  const output = join(dir, "temporal", "frames-v1");
  if (existsSync(output)) throw Error("Temporal evidence already exists; preserved without overwrite");
  const tool = process.env.ART_FFMPEG_EXECUTABLE || "/private/tmp/oath-ember-playwright/ffmpeg-1011/ffmpeg-mac";
  const index = JSON.parse(readFileSync(join(dir, "temporal", "index.json"), "utf8"));
  const recordings = index.recordings.filter((r: {viewport: string}) => r.viewport === "1920x1080");
  if (recordings.length !== 2) throw Error("Expected both desktop client recordings");
  const timelinePath = join(dir, "temporal", "1920x1080-timeline.json");
  const timeline = JSON.parse(readFileSync(timelinePath, "utf8"));
  const events: {phase: string; atMs: number}[] = timeline.phaseEvents;
  if (events.length !== 3 || events.some(e => !Number.isFinite(e.atMs))) throw Error("Missing phase-request timeline");
  const windows = [
    {phase: "START_REQUEST", start: events[1].atMs - 200},
    {phase: "HELD_REQUEST", start: (events[1].atMs + events[2].atMs) / 2},
    {phase: "END_REQUEST", start: events[2].atMs - 200},
  ];
  const packet: TemporalPacket = { schema_version: 1, candidateHashes: a.runtime_files.map(p => hash(join(root, p))), recordings: [], frames: [], tool,
    limitations: "Real decoded native frames, sampled every >=80ms in three 800ms windows for BOTH desktop clients. Video PTS are in milliseconds (encoder time base 1/1000); no interpolated frames. Phase hints use approximate Node request timing with unknown video-start offset, NOT confirmed WARD_START/LOOP/END. Laptop/mobile have still evidence only. Gaps and uncertain phase alignment cannot establish uninterrupted holds, exact transition timing, true FPS or global absence of flicker/restarts. Unsupported animation judgments remain REVIEW. Existing videos have no browser cadence telemetry." };
  const staging = mkdtempSync(join(tmpdir(), "art-temporal-"));
  try {
    for (const r of recordings) {
      const video = resolve(root, r.path);
      if (!video.startsWith(resolve(dir) + "/")) throw Error("Recording outside current iteration");
      packet.recordings.push({ path: r.path, sha256: hash(video) });
      for (const w of windows) {
        const sequence = `${r.viewport}-client-${r.client}-${w.phase}`;
        const scratch = join(staging, sequence); mkdirSync(scratch);
        const seconds = Math.max(0, Math.round(w.start)) / 1000;
        const result = spawnSync(tool, ["-hide_banner", "-loglevel", "error", "-copyts", "-i", video,
          "-ss", String(seconds), "-t", "0.8", "-vsync", "0", "-enc_time_base", "1:1000", "-output_ts_offset", String(seconds), "-frame_pts", "1", join(scratch, "frame-%d.png")], {encoding: "utf8", timeout: 60000});
        if (result.error || result.status !== 0) throw Error(`Frame extraction failed: ${result.error || result.stderr}`);
        const times = readdirSync(scratch).map(f => /^frame-(\d+)\.png$/.exec(f)).filter(m => m !== null).map(m => Number(m[1])).sort((x, y) => x - y);
        if (times.length < 2) throw Error("Insufficient decoded temporal frames");
        for (const ptsMs of selectFrames(times)) {
          const path = join(output, sequence, `frame-${ptsMs}.png`);
          const staged = join(staging, "selected", sequence, `frame-${ptsMs}.png`);
          mkdirSync(join(staging, "selected", sequence), {recursive: true});
          copyFileSync(join(scratch, `frame-${ptsMs}.png`), staged);
          packet.frames.push({ path: relative(root, path), sha256: hash(staged), ptsMs, sequence, phaseHint: w.phase, phaseAlignment: "approximate", client: r.client, viewport: r.viewport });
        }
      }
    }
    // Commit only a complete extraction; existing capture/report history remains intact.
    for (const f of packet.frames) {
      const destination = join(root, f.path); mkdirSync(resolve(destination, ".."), {recursive: true});
      copyFileSync(join(staging, "selected", f.sequence, `frame-${f.ptsMs}.png`), destination);
    }
    writeFileSync(join(output, "manifest.json"), JSON.stringify(packet, null, 2) + "\n");
    return packet;
  } finally { rmSync(staging, {recursive: true, force: true}); }
}
export function loadTemporal(root: string, directory: string, a: Asset): TemporalPacket | null {
  const file = join(root, directory, "temporal", "frames-v1", "manifest.json");
  if (!existsSync(file)) return null;
  const packet: TemporalPacket = JSON.parse(readFileSync(file, "utf8"));
  if (packet.schema_version !== 1 || !packet.frames.length || packet.candidateHashes.length !== 2 || packet.candidateHashes.some((h, i) => h !== hash(join(root, a.runtime_files[i])))) throw Error("Temporal candidate provenance mismatch");
  for (const f of [...packet.recordings, ...packet.frames]) {
    if (!resolve(root, f.path).startsWith(resolve(root, directory) + "/") || hash(join(root, f.path)) !== f.sha256) throw Error("Temporal evidence changed after extraction");
  }
  for (const sequence of new Set(packet.frames.map(f => f.sequence))) selectFrames(packet.frames.filter(f => f.sequence === sequence).map(f => f.ptsMs));
  return packet;
}
