import approved from "./approvedCues.json" with { type: "json" };
import files from "./sourceFiles.json" with { type: "json" };
import revised from "./revisedCues.json" with { type: "json" };
import type { World } from "../../../../packages/shared/src/gameTypes.js";
import { offstageFor } from "../../../../packages/shared/src/chapter0.js";
import { SoundEvents, type SoundCue } from "./SoundEvents.js";
type Track = {
  assetId: string;
  gain: number;
  delay: number;
  rate: number;
  loop: boolean;
  /** One-shots only: glide the pitch to this rate over `rampMs`. */
  rateEnd?: number;
  rampMs?: number;
};
type Cue = {
  tracks: Track[];
  /** Alternate takes for the first track, picked at random per play. */
  variants?: string[];
  /** Random pitch spread (±) per play so repeats don't sound identical. */
  jitter?: number;
};
type Source = { url: string; offset?: number; duration?: number };
type Voice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  pan: StereoPannerNode;
};
// The 2026-10-21 revision overrides and extends the original reviewed table.
const cues: Record<string, Cue> = { ...approved, ...revised.cues };
const sources: Record<string, Source> = {
  ...Object.fromEntries(
    Object.entries(files as Record<string, string>).map(([id, url]) => [
      id,
      { url },
    ]),
  ),
  ...revised.sources,
};
/** Every clip is levelled to this loudness before its cue gain applies. */
const TARGET_DB = -16;
/** Browser-only presentation. No gameplay or protocol writes. */
export class GameAudio {
  private observer = new SoundEvents();
  private context?: AudioContext;
  private master?: GainNode;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private levels = new Map<string, number>();
  private lastVariant = new Map<string, string>();
  private loopBuffers = new Map<string, AudioBuffer>();
  private loops = new Map<string, Voice[]>();
  private desired = new Set<string>();
  private voices = new Set<Voice>();
  private recent = new Map<string, number>();
  private epoch = 0;
  private lastSnapshot = 0;
  private quiet = false;
  private choosing = false;
  private hidden = document.hidden;
  private listener = { x: 0, y: 0 };
  private volume = 0.65;
  private muted = false;
  private debug: { name: string; kind: string }[] = [];
  private failures: string[] = [];
  private observed = 0;
  private requested: string[] = [];
  constructor(clearControls: () => void = () => {}) {
    try {
      const saved = JSON.parse(
        localStorage.getItem("oath-audio-settings") ?? "null",
      );
      if (
        saved &&
        typeof saved.muted === "boolean" &&
        Number.isFinite(saved.volume)
      ) {
        this.muted = saved.muted;
        this.volume = Math.max(0, Math.min(1, saved.volume));
      }
    } catch {
      /* Storage is optional. */
    }
    const unlock = () => void this.unlock();
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    window.addEventListener(
      "keydown",
      (e) => {
        if (
          this.choosing &&
          !e.repeat &&
          ["1", "2", "3", "ArrowUp", "ArrowDown"].includes(e.key)
        )
          this.ui("Motivation option highlight");
      },
      { capture: true },
    );
    document.addEventListener("visibilitychange", () => {
      this.hidden = document.hidden;
      if (this.hidden) this.reset();
    });
    window.addEventListener("pagehide", () => this.reset());
    // A frozen/disconnected tab cannot leave a beam or vortex running.
    setInterval(() => {
      if (this.loops.size && performance.now() - this.lastSnapshot > 750)
        this.stopLoops();
    }, 250);
    const panel = document.createElement("details");
    panel.id = "audio-settings";
    panel.innerHTML =
      '<summary aria-label="Sound settings">♪ Sound</summary><div class="audio-controls"><label><input type="checkbox" data-audio-mute> Mute effects</label><label>Effects volume <input type="range" min="0" max="1" step="0.01" data-audio-volume><output></output></label><p>Selection and gameplay effects · settings saved on this device</p></div>';
    const mute = panel.querySelector<HTMLInputElement>("[data-audio-mute]")!,
      slider = panel.querySelector<HTMLInputElement>("[data-audio-volume]")!,
      output = panel.querySelector("output")!;
    mute.checked = this.muted;
    slider.value = String(this.volume);
    output.textContent = `${Math.round(this.volume * 100)}%`;
    const settings = () => {
      this.muted = mute.checked;
      this.volume = Number(slider.value);
      output.textContent = `${Math.round(this.volume * 100)}%`;
      if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
      if (this.muted) this.stopAll();
      try {
        localStorage.setItem(
          "oath-audio-settings",
          JSON.stringify({ volume: this.volume, muted: this.muted }),
        );
      } catch {}
    };
    mute.addEventListener("change", settings);
    slider.addEventListener("input", settings);
    panel.addEventListener("toggle", () => {
      if (panel.open) clearControls();
    });
    panel.addEventListener("keydown", (e) => e.stopPropagation());
    document.body.append(panel);
    document.addEventListener(
      "click",
      (e) => {
        const target = (e.target as Element)?.closest?.("button");
        if (!target || target.closest("#audio-settings,.inventory-panel"))
          return;
        if (target.closest(".story-choices"))
          this.ui("Motivation option highlight");
        else if (
          target.closest(".appearance-grid") ||
          ["oath", "ember"].includes(target.id)
        )
          this.ui("Role / appearance selection");
        else if (target.id === "ready") this.ui("Ready / cancel-ready / start");
        else if (target.id === "copy") this.ui("Copy room code");
        else if (target.id === "again") this.ui("Restart after completed game");
        else if (
          ["leave", "create", "join"].includes(target.id) ||
          target.closest(".title-screen")
        )
          this.ui("Title/checkpoint selection, create/join/back");
      },
      true,
    );
    if (new URLSearchParams(location.search).has("audioQA"))
      Object.assign(window, {
        __audioQA: {
          inspect: () => ({
            unlocked: this.context?.state === "running",
            muted: this.muted,
            volume: this.volume,
            voices: this.voices.size,
            loops: this.loops.size,
            observed: this.observed,
            requested: [...this.requested],
            events: [...this.debug],
            failures: [...this.failures],
            hidden: this.hidden,
            quiet: this.quiet,
          }),
          clear: () => {
            this.debug = [];
          },
        },
      });
  }
  async unlock() {
    if (this.hidden) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -10;
        limiter.ratio.value = 8;
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(limiter);
        limiter.connect(this.context.destination);
        // Warm the core clips after the first gesture, without playing or delaying input.
        for (const id of [
          "swing",
          "swing2",
          "swing3",
          "fire6",
          "fire7",
          "whoosh",
          "uiSelect",
          "uiConfirm",
          "bagOpen",
          "bagClose",
          "punchMed",
          "siegHurt1",
          "cocoHurt1",
          "wingFlap",
          "spell2",
          "magic",
          "hum",
        ])
          void this.buffer(id).catch(() => {});
      }
      if (this.context.state === "suspended") await this.context.resume();
    } catch {
      /* Unsupported/blocked audio never interrupts the game. */
    }
  }
  ui(name: string) {
    if (
      !this.quiet ||
      (this.choosing && name === "Motivation option highlight")
    )
      this.play({ name });
  }
  /** Dev sound-check page only: play any cue by name, outside gameplay. */
  preview(name: string) {
    void this.unlock().then(() => this.play({ name }));
  }
  reset() {
    this.observer.reset();
    this.stopAll();
    this.quiet = false;
  }
  observe(w: World, id: string) {
    this.observed++;
    if (this.hidden) {
      this.reset();
      return;
    }
    const p = w.players[id];
    if (!p?.connected) {
      this.reset();
      return;
    }
    const away = offstageFor(w.story, p.role),
      listener = away?.watch
        ? (Object.values(w.players).find((q) => q.id !== id) ?? p)
        : p;
    this.listener = { x: listener.x, y: listener.y };
    this.choosing =
      w.story?.cutscene?.id === "resolve" &&
      w.story.cutscene.line === 0 &&
      !!p.role &&
      !w.story.motivations?.[p.role];
    const frame = this.observer.observe(w, id);
    this.lastSnapshot = performance.now();
    if (frame.reset || frame.silence || (frame.quiet && !this.quiet))
      this.stopAll();
    this.quiet = frame.quiet;
    for (const cue of frame.shots) this.play(cue);
    this.desired = new Set(frame.loops.map((c) => c.key!));
    for (const [key, voices] of this.loops)
      if (!this.desired.has(key)) {
        voices.forEach((v) => this.stop(v));
        this.loops.delete(key);
      }
    for (const cue of frame.loops) {
      const voices = this.loops.get(cue.key!);
      if (voices) {
        const tracks = cues[cue.name]?.tracks ?? [];
        voices.forEach((v, i) => {
          if (!tracks[i]) return;
          v.source.playbackRate.setTargetAtTime(
            tracks[i].rate * (cue.rate ?? 1),
            this.context!.currentTime,
            0.05,
          );
          v.gain.gain.setTargetAtTime(
            this.level(tracks[i], tracks, cue),
            this.context!.currentTime,
            0.05,
          );
        });
      } else void this.start(cue, true);
    }
  }
  private attenuation(cue: SoundCue) {
    return cue.x === undefined || cue.y === undefined
      ? 1
      : Math.max(
          0,
          1 -
            Math.hypot(cue.x - this.listener.x, cue.y - this.listener.y) / 1000,
        );
  }
  /** Final voice gain: cue gain × clip levelling × distance, with layer headroom. */
  private level(track: Track, tracks: Track[], cue: SoundCue) {
    const headroom = Math.max(
      1,
      tracks.reduce((sum, t) => sum + t.gain, 0),
    );
    return (
      (track.gain * (this.levels.get(track.assetId) ?? 1) * this.attenuation(cue)) /
      headroom
    );
  }
  // Downloaded packs vary by 25 dB; measure each clip once so cue gains compare.
  private measure(id: string, buffer: AudioBuffer) {
    const src = sources[id],
      rate = buffer.sampleRate,
      from = Math.floor((src?.offset ?? 0) * rate),
      to = Math.min(
        buffer.length,
        src?.duration ? from + Math.floor(src.duration * rate) : buffer.length,
      ),
      window = Math.max(1, Math.floor(rate * 0.01)),
      blocks: number[] = [];
    const data = buffer.getChannelData(0);
    for (let i = from; i + window <= to; i += window) {
      let sum = 0;
      for (let j = i; j < i + window; j++) sum += data[j] * data[j];
      blocks.push(sum / window);
    }
    const loudest = Math.max(0, ...blocks),
      active = blocks.filter((b) => b > loudest / 1000);
    if (!active.length) return;
    const db =
      10 * Math.log10(active.reduce((a, b) => a + b, 0) / active.length);
    this.levels.set(
      id,
      Math.max(0.25, Math.min(8, 10 ** ((TARGET_DB - db) / 20))),
    );
  }
  private async buffer(id: string) {
    if (!this.buffers.has(id))
      this.buffers.set(
        id,
        fetch(sources[id].url)
          .then((r) => {
            if (!r.ok) throw Error("Missing source");
            return r.arrayBuffer();
          })
          .then((b) => this.context!.decodeAudioData(b))
          .then((decoded) => {
            this.measure(id, decoded);
            return decoded;
          })
          .catch((e) => {
            this.buffers.delete(id);
            throw e;
          }),
      );
    return this.buffers.get(id)!;
  }
  // Crossfade short raw sources for sustained effects; original downloads remain untouched.
  private seamless(id: string, input: AudioBuffer) {
    let result = this.loopBuffers.get(id);
    if (result) return result;
    const overlap = Math.min(
        Math.floor(input.sampleRate * 0.04),
        Math.floor(input.length / 4),
      ),
      length = input.length - overlap;
    result = this.context!.createBuffer(
      input.numberOfChannels,
      length,
      input.sampleRate,
    );
    for (let channel = 0; channel < input.numberOfChannels; channel++) {
      const src = input.getChannelData(channel),
        dest = result.getChannelData(channel);
      dest.set(src.subarray(overlap));
      for (let i = 0; i < overlap; i++) {
        const t = i / overlap;
        dest[length - overlap + i] =
          dest[length - overlap + i] * (1 - t) + src[i] * t;
      }
    }
    this.loopBuffers.set(id, result);
    return result;
  }
  private play(cue: SoundCue) {
    this.requested.push(cue.name);
    if (this.requested.length > 100) this.requested.shift();
    const now = performance.now(),
      key = cue.name;
    if (now - (this.recent.get(key) ?? -Infinity) < 75) return;
    this.recent.set(key, now);
    void this.start(cue, false);
  }
  private async start(cue: SoundCue, loop: boolean) {
    const original = cues[cue.name];
    const first = cue.source && sources[cue.source] ? cue.source : this.variant(cue.name, original);
    const entry = original && first
      ? {
          ...original,
          tracks: original.tracks.map((t, i) =>
            i === 0 ? { ...t, assetId: first } : t,
          ),
        }
      : original;
    if (
      !entry?.tracks.length ||
      this.muted ||
      this.hidden ||
      this.context?.state !== "running" ||
      this.voices.size >= 20 ||
      this.attenuation(cue) <= 0
    )
      return;
    if (loop && this.loops.has(cue.key!)) return;
    const epoch = this.epoch,
      asked = performance.now();
    // Reserve before fetching so repeated snapshots cannot start concurrent copies.
    if (loop) this.loops.set(cue.key!, []);
    try {
      const buffers = await Promise.all(
        entry.tracks.map((t) => this.buffer(t.assetId)),
      );
      if (
        epoch !== this.epoch ||
        this.muted ||
        this.hidden ||
        this.context.state !== "running" ||
        (loop ? !this.desired.has(cue.key!) : performance.now() - asked > 500)
      ) {
        if (loop && epoch === this.epoch) this.loops.delete(cue.key!);
        return;
      }
      const spread =
        !loop && entry.jitter ? 1 + (Math.random() * 2 - 1) * entry.jitter : 1;
      const voices = entry.tracks.map((track, i) => {
        const source = this.context!.createBufferSource(),
          gain = this.context!.createGain(),
          pan = this.context!.createStereoPanner();
        source.buffer = loop
          ? this.seamless(track.assetId, buffers[i])
          : buffers[i];
        source.loop = loop;
        const rate = track.rate * (cue.rate ?? 1) * spread;
        const time = this.context!.currentTime + track.delay / 1000;
        source.playbackRate.value = rate;
        if (!loop && track.rateEnd) {
          source.playbackRate.setValueAtTime(rate, time);
          source.playbackRate.linearRampToValueAtTime(
            track.rateEnd * (cue.rate ?? 1) * spread,
            time + (track.rampMs ?? 500) / 1000,
          );
        }
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(
          this.level(track, entry.tracks, cue),
          time + 0.015,
        );
        pan.pan.value =
          cue.x === undefined
            ? 0
            : Math.max(-0.8, Math.min(0.8, (cue.x - this.listener.x) / 700));
        source.connect(gain);
        gain.connect(pan);
        pan.connect(this.master!);
        const voice = { source, gain, pan };
        this.voices.add(voice);
        source.onended = () => {
          source.disconnect();
          gain.disconnect();
          pan.disconnect();
          this.voices.delete(voice);
        };
        const clip = sources[track.assetId];
        if (loop) source.start(time);
        else if (clip?.duration) {
          // Fade the end of a trimmed slice so it never clicks.
          const end = time + clip.duration / rate;
          gain.gain.setValueAtTime(this.level(track, entry.tracks, cue), end - 0.06);
          gain.gain.linearRampToValueAtTime(0, end);
          source.start(time, clip.offset ?? 0, clip.duration);
        } else source.start(time, clip?.offset ?? 0);
        return voice;
      });
      if (loop) this.loops.set(cue.key!, voices);
      this.debug.push({ name: cue.name, kind: loop ? "loop" : "shot" });
      if (this.debug.length > 100) this.debug.shift();
    } catch (error) {
      this.failures.push(`${cue.name}: ${String(error)}`);
      if (this.failures.length > 20) this.failures.shift();
      if (loop) this.loops.delete(cue.key!);
    } // Failed media is optional presentation.
  }
  /** A random alternate take, never the same one twice in a row. */
  private variant(name: string, cue?: Cue) {
    const takes = cue?.variants;
    if (!takes?.length) return undefined;
    const last = this.lastVariant.get(name),
      pool = takes.length > 1 ? takes.filter((t) => t !== last) : takes,
      pick = pool[Math.floor(Math.random() * pool.length)];
    this.lastVariant.set(name, pick);
    return pick;
  }
  private stop(voice: Voice) {
    try {
      voice.gain.gain.setTargetAtTime(0, this.context!.currentTime, 0.02);
      voice.source.stop(this.context!.currentTime + 0.08);
    } catch {}
  }
  private stopLoops() {
    this.desired.clear();
    for (const voices of this.loops.values())
      voices.forEach((v) => this.stop(v));
    this.loops.clear();
  }
  private stopAll() {
    this.epoch++;
    this.stopLoops();
    this.voices.forEach((v) => this.stop(v));
    this.recent.clear();
  }
}
