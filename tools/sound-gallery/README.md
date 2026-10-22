# Sound Gallery — development review only

Run `npm run sound:gallery`, then open **http://127.0.0.1:3022**. Override the port with `SOUND_GALLERY_PORT=3023 npm run sound:gallery`. This standalone, loopback-only server requires no running game server. Stop it with Ctrl+C.

The gallery contains all **63 original source clips** and **204 unchanged event rows** from the approved-for-development plan. Eight categories cover UI, Sieg, Coco, monsters, puzzles, Griffin, shrine and story. The default view is the **28-cue Phase 1 proposal**, not an approval to integrate them. Optional/later events are labeled. Fifteen deliberate silence rows cannot acquire a sound or editable mix.

## Review workflow

1. Start with Phase 1, then select a category or search. Each event shows its original treatment, source filename, gain, playback behavior, source/license and pinned code references.
2. Play the original with its audio controls, or play the selected mix. Source clips lists all 63 files, including reserve/companion candidates without a primary assignment.
3. Signature sounds have A/B and layered sketches. Audition a sketch without changing the selection; **Use** chooses it. Any event can compare source candidates, add up to four layers, solo tracks, set gain, delay, pitch/speed and rough preview looping. Mix previews stop within eight seconds. Nothing is auto-played.
4. Set **Pending**, **Approved**, or **Needs Revision**, and leave notes. The default for every event and clip is Pending. Changing a layer resets that event to Pending. An event approval applies to the current mix. Clip approval does not automatically approve all events using that source.
5. Decisions persist in localStorage for this browser/origin and this exact plan hash. They are not synced to the game, a server, another browser, or another port. Export JSON to share/retain decisions. Import replaces the browser review; keep an export before replacing it. Invalid imports and cross-plan reviews are rejected atomically. If storage is blocked, export before closing the tab.
6. Stop all playback with **Stop all** or Escape. Switching views/events, hiding the page, or leaving also stops playback. No gameplay event can start playback.

## Isolation and provenance

`tools/sound-gallery` is outside Vite's `apps/client` root and public directory. Production builds do not copy it. Its server has an explicit read-only URL allowlist and imports no gameplay, animation, story engine or Socket.IO modules. The only package change is the `sound:gallery` development command. Review statuses live in the browser; there is no write API.

`reference/SOUND_DESIGN_PLAN.md` and `reference/SOUND_ASSET_VERIFICATION.json` are byte-for-byte copies of the original review artifacts, including historical preparation text. Their baseline is `4ca93507c152752c9de34a8300dd02f683004c42`; source links intentionally stay pinned there. Concurrent uncommitted game work is excluded. `catalog.json` preserves every row and adds review-only grouping, stable IDs, Phase 1 labels, observation cautions and candidate recipes. It is not a gameplay audio configuration.

`assets/` contains only the 63 selected clips, with convenient local IDs; catalog member paths and SHA-256 hashes preserve the original identity. Kenney licenses are retained in `reference/`; the two OpenGameArt CC0 declarations and creator links remain in the original manifest/catalog. Original pack download links are visible on every event/source. No audio was edited, normalized or resampled. Loop/pitch/layer settings are temporary audition sketches, not rendered production assets. Layer gain sums above 1 are attenuated for preview headroom; use actual listening review before mastering.

Run `node scripts/verify-sound-gallery.mjs` to recheck all source hashes, licenses and unchanged mapping rows. `npm test` includes import validation, approval invalidation, silence protection and isolated-server tests. `node scripts/qa-sound-gallery.mjs` exercises the gallery in real Chromium and decodes all 63 sources. See `docs/audio/PHASE_1_AUDIO_REVIEW.md` for the shortlist and protocol gaps.

**Review boundary:** the overall plan is approved for development. No individual selection is preapproved here. Stop after human audition/review; do not wire the catalog or review export into live gameplay without explicit selection approval and a separate implementation task.

### Current review decision

On October 20, 2026, the user provisionally approved all 204 events and 63 source clips for later refinement. The gallery applies that status once to existing/new browser reviews, preserving mixes and notes. Reload the page to receive the update. Later individual changes persist; editing a mix still returns that event to Pending. The four original `select` cues use `ok` as previously requested. This approval does not enable live-game sound.
