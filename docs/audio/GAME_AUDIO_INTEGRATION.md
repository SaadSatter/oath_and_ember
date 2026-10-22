# Game sound integration — October 20, 2026

The user approved all selections provisionally, requested `ok` (`Audio/confirmation_001.ogg`) for selection feedback, then explicitly authorized applying sounds to the game. The approved effects are now connected to live client presentation. Combat, story progression, animations, shared kinematics and the wire protocol are unchanged by this integration.

## Run and controls

Use the normal `npm run dev`, or `npm run build` followed by `npm start`. The review instance was launched at http://127.0.0.1:3030. Audio unlocks after a click or keypress, as required by browsers. **♪ Sound** beneath the inventory button contains an effects-volume slider and mute checkbox. Settings persist locally. No sound is played automatically before a browser gesture, and no missed events are queued for later playback.

All four original selection cues use `ok`. Story stillness and funeral pauses stay silent. UI clicks/typing and world combat/movement effects are suppressed while a scripted scene holds the story; only specifically mapped, audience-visible beats (bag drop, healing attempt/failure, Alden's cast, journal, limited transitions/revelation accents) are allowed. A visible motivation choice can play its selected confirmation without leaking the partner's private reasoning.

## Files and review provenance

- `apps/client/src/audio/approvedCues.json`: the complete 204-event reviewed source/mix table, with all 15 intentional silence entries retained as empty tracks.
- `apps/client/src/audio/sourceFiles.json`: fixed local source IDs; runtime audio cannot invent download URLs or select gameplay outcomes.
- `apps/client/public/assets/audio/`: all 63 exact source clips plus licenses, the original verification manifest and `APPROVED_SELECTIONS.json`. Source hashes match the gallery records. Kenney, rubberduck and artisticdude CC0 source/creator/download records are preserved.
- `SoundEvents.ts`: observes accepted server snapshots and produces presentation cues. It never reads predicted hit results or changes world state. `NetworkClient.onworld` is a local observer after accepted-state reconciliation; exceptions are isolated from the networking/client simulation.
- `GameAudio.ts`: browser gesture unlocking, decoded-buffer caching, distance attenuation, left/right panning, gain limiting, bounded voices and cue rate limits. Sustained beams/vortices use in-memory crossfaded loops without altering the downloaded originals. Slow Time scales sustained playback rates; held scenes stop their loops. Travel, disconnect, hidden tabs, mute and stalled snapshot delivery stop stale effects.

The gallery remains available for future tweaks. To apply an exported gallery review later, run `node scripts/prepare-game-audio.mjs /absolute/path/to/oath-ember-sound-review.json`, then rebuild. Without an export, the preparation script uses the recorded blanket approval and `select` → `ok` update. Browser-only gallery edits on port 3022 do not silently change a running game's configuration. Pending/Needs Revision entries in an imported review do not produce runtime tracks.

The original `tools/sound-gallery/reference/SOUND_DESIGN_PLAN.md` and `SOUND_ASSET_VERIFICATION.json` remain unchanged, including their pinned baseline references. New concurrent water-dragon story work is preserved; no separate unreviewed dragon asset or final Griffin explosion was invented.

## Coverage and deliberate consolidation

The observer connects accepted swings/charges, Fireball and Black Hole identity, defensive-hit sequences, Guard/Ward, Flight, Super Speed, Slow Time, recharge edges, ordinary hurt, enemy windups/projectiles/deaths, Sentinel beam charge/sustain/contact blast, movement and object pushing. It also covers the glade thicket/chair/refusals, bridge boulder/plates/gates/collapses/switch completion, maze bush/cow/runner/rewards, pond rotation/reflections/torches/platform/spike resets, shrine inventory transactions, Griffin sleeping/waking/flight/charge/beam/contact/headbutt/pillars/grooming/rewards, and existing story flags/visible script beats. Optional skills are only sounded when accepted actions actually occur.

The 204 rows include intentional silence, alternative descriptions of the same action, local UI events, optional/later content, and observations with known protocol limits. They are a design catalog, not 204 independent sounds to fire. Equivalent rows are consolidated: reward acquisition/chest/banter does not trigger several fanfares; a valid puzzle hit shares the projectile's impact; completed gate chains share an unlock cue; generic hurt also covers existing Warden proximity damage. Invalid shots use an actual ordinary impact, not a false puzzle-success cue. Sentinel melee windup uses the approved blade companion, not a fabricated punch-contact sound. Ambient fire and short raw loops are an initial mix, subject to later sound-design refinements.

## Protocol limitations retained

No protocol fields or server gameplay code were changed. Consequently:

- Exact sword-victim contacts have no retained server contact record; the confirmed swing plays, while observed HP decreases provide generic hurt only.
- Unguarded melee, Griffin nest-defense/headbutt hit attribution and complete sub-snapshot damage histories cannot be reconstructed. The client never guesses attacker, successful hit or critical damage from prediction.
- HP is reset immediately on lethal recovery, and movement epochs also represent safe recovery/correction. No death/respawn scream is inferred.
- A pond reflection can occur and be consumed within one server tick. If its intermediate projectile state is not received, only the actual retained impact/torch latch sounds; no phantom reflection is inferred.
- Very short phase/contact/occupancy transitions can be coalesced by snapshots. Current phases, persistent latches and retained impact IDs are observed, not represented as a complete event history.
- Inventory receipts alone do not trigger success. Newly claimed/unlocked/completed IDs and delivery flags do; duplicate receipts/revisions remain quiet.

Reliable exact per-hit and every-reflection audio would require a separately designed, retained server-owned presentation-event stream and protocol integration tests. Existing snapshot behavior remains unchanged here.

## Verification

- Production assets: all 63 clips match original SHA-256 records.
- `npm run typecheck` and `npm run build` passed; build retains the existing large-bundle advisory.
- Sound observer/unit and real two-socket-client tests passed. They check join/reconnect baselines, no gameplay mutation, accepted attack identity, Fireball/Black Hole distinction, impact deduplication, defensive hit sequences, remote-map exclusion, private discovery, funeral silence, distinct beam types and reward/puzzle edge handling.
- `node --import tsx scripts/qa-game-audio.ts` passed in two actual Chrome game clients: browser unlocking, one swing per client, Black Hole launch/sustain, persistent mute, suppressed funeral combat/loops, no browser errors and no missing audio assets. The normal title starts a story checkpoint; the script explicitly transitions to normal gameplay as a documented audio-only fixture. Screenshots/report default to `/tmp/oath-game-audio-qa`.
- An initial heavily loaded full suite passed 504/506; the two failures were timeouts. Both affected suites plus the sound suites passed on a one-worker retry (36/36). The final bounded full suite passed **511/511 tests across 72 files**.

## Revision — October 21, 2026: remapped sounds

The original 63 clips were chosen by filename and never auditioned. In play, several were mismatched or tiring, so the user asked for a remap. The original review table, gallery and its frozen verification are untouched. The revision is a separate layer:

- `apps/client/src/audio/revisedCues.json`: 53 new source clips (with optional `offset`/`duration` trims applied at playback) and 99 cue overrides/additions. `GameAudio` merges it over `approvedCues.json`, so re-running `prepare-game-audio.mjs` cannot wipe it.
- `apps/client/public/assets/audio/REVISION_2026-10-21.json`: creator, CC0 license, source page, download URL, archive member, byte size and SHA-256 for every added clip. The files are unedited downloads. Added packs: Kenney Sci-fi Sounds, rubberduck water/splash, AntumDeluge wings + fire crackle, Almitory air whoosh, SketchMan3 wind loop, HaelDB male grunts (CC0 option), EZduzziteh hurt sounds, plus more takes from the original Kenney/rubberduck/artisticdude packs.
- **Loudness levelling.** Each clip is measured once after decoding and levelled to −16 dB (active RMS; correction clamped ×0.25–×8). The packs varied by about 25 dB, so the fire clips had been nearly inaudible next to UI clicks. Cue gains are now relative to that common level.
- **Variety.** A cue can list `variants` (alternate takes, never the same twice in a row) and a `jitter` pitch spread. Footsteps, swings and hurt voices use both. One-shot tracks can glide pitch (`rateEnd`/`rampMs`); Slow Time sags downward and speeds back up when it ends.

Main mapping changes:

- **Selection** now uses a soft drop. Committing uses a warmer chime. Story beats that reused the selection chime now use a softer confirmation. The backpack sounds like leather.
- **Combat.** Sword swings rotate three takes. Sieg and Coco each have a hurt voice plus impact (`Sieg hurt`, `Coco hurt`). Speed, dash and Griffin rush use an air whoosh instead of a metal blade. Heavy Break charges with a hum instead of a looping blade.
- **Coco.** Fireball is a fire whoosh with an impact thump and crackle. Flight is bat-wing flaps (a single flap is sliced from a three-flap recording). Black Hole is a deep rumble under in-drawn wind. Skill-ready edges share one quiet chime.
- **Golem.** The contact blast is a low boom plus crunch. The palm beam is a sustained energy roar. Charging rises in pitch. Melee is stone grinding with a growl, not a blade.
- **Fire.** Burning, torches and braziers use a crackle loop.
- **New beats.** Alden's water dragon roars as it rises, gulps each monster when the server-cast route reaches it, rushes while moving and bursts into rain (`story.dragon` timings). The finale's mist gathers and the stranger takes shape. The stale `"flash"` check was removed. The stranger *vanishing* stays an intentional silence.
- Slowed time lowers sustained loops to 0.6× instead of 0.2×.

**Audition:** with `npm run dev` running, open `/sound-check.html` on the Vite port to play every cue through the real engine. It is a dev-only page and is not included in `npm run build`. Voice picks were chosen by analysis, not by ear, so confirm them there first.
