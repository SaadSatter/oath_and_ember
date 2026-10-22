# Phase 1 core audio — human review packet

Prepared October 20, 2026. **Development gallery only; no live audio integration.** Overall plan approval authorizes development, not all 204 mappings. Every event and source begins Pending. The browser reviewer records individual decisions; this document does not approve them.

Start `npm run sound:gallery` and open [Sound Gallery](http://127.0.0.1:3022). Phase 1 is the default view. All 204 original event mappings and 63 sources remain available. The copied original plan, license records and asset manifest remain unchanged in `tools/sound-gallery/reference/`; immutable source links retain baseline main commit `4ca9350`.

## Proposed Phase 1 selection

Prioritize readable local UI feedback, starting player abilities and basic enemy attacks. Defer footsteps, broad ambience, optional unlocks, exact victim-contact sounds, most puzzle mechanisms, Griffin signature production edits and story audio until separately reviewed. The gallery still permits auditioning those later proposals, with explicit labels.

| Core event                                                  | Original source ID / member                      | Gain | Observation / review consideration                                                                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory open                                              | `open` / `Audio/open_001.ogg`                    | 0.18 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Inventory close / Escape                                    | `close` / `Audio/close_001.ogg`                  | 0.16 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Select inventory item                                       | `select` / `Audio/select_001.ogg`                | 0.13 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Inventory Use/Open/Speak button                             | `click` / `Audio/click_001.ogg`                  | 0.10 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Rejected item / out-of-range / blocked / unavailable action | `error` / `Audio/error_001.ogg`                  | 0.16 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Successful generic chest / quest pickup                     | `ok` / `Audio/confirmation_001.ogg`              | 0.22 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Sieg normal sword swing                                     | `swing` / `RPG Sound Pack/battle/swing.wav`      | 0.42 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Sieg Guard raised / lowered                                 | `cloth` / `Audio/cloth1.ogg`                     | 0.18 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Sieg Guard absorbs hit                                      | `metalLight` / `Audio/impactMetal_light_000.ogg` | 0.36 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Sieg Super Speed starts                                     | `blade` / `blade_01.ogg`                         | 0.30 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Sieg Super Speed expires / ready                            | `tick` / `Audio/tick_001.ogg`                    | 0.10 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Coco Fireball cast, level 1                                 | `fire` / `spell_fire_01.ogg`                     | 0.40 | Predicted casts and source identity                                                                                                                           |
| Coco Fireball impact                                        | `fire2` / `spell_fire_02.ogg`                    | 0.38 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Coco Ward raised / lowered                                  | `spell` / `spell_01.ogg`                         | 0.23 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Coco Ward struck                                            | `gem` / `item_gem_01.ogg`                        | 0.32 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Coco Flight takeoff                                         | `blade2` / `blade_02.ogg`                        | 0.25 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Coco Flight landing / expiry recovery                       | `soft` / `Audio/impactSoft_medium_000.ogg`       | 0.22 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Coco Slow Time begins                                       | `spell2` / `spell_02.ogg`                        | 0.30 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Coco Slow Time ends / recharge ready                        | `back` / `Audio/back_001.ogg`                    | 0.12 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Coco Black Hole launch                                      | `magic` / `RPG Sound Pack/battle/magic1.wav`     | 0.32 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Black Hole opens / pulls                                    | `spell2` / `spell_02.ogg`                        | 0.18 | Requires an edited loop before integration; gallery looping is a rough preview.                                                                               |
| Mossling attack windup                                      | `slime` / `creature_slime_01.ogg`                | 0.27 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Cinder Wisp windup                                          | `fire3` / `spell_fire_03.ogg`                    | 0.22 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Cinder Wisp projectile release                              | `fire4` / `spell_fire_04.ogg`                    | 0.32 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Cinder Wisp projectile impact                               | `fire5` / `spell_fire_05.ogg`                    | 0.30 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |
| Ironbound Sentinel beam charge                              | `spell` / `spell_01.ogg`                         | 0.30 | Use original accepted action/state edge; baseline and deduplicate. Signature charge/sustain needs listening/edit review; keep Sentinel distinct from Griffin. |
| Ironbound Sentinel palm beam active                         | `fire6` / `spell_fire_06.ogg`                    | 0.34 | Use original accepted action/state edge; baseline and deduplicate. Signature charge/sustain needs listening/edit review; keep Sentinel distinct from Griffin. |
| Ironbound Sentinel contact blast                            | `metalHit` / `Audio/impactMetal_heavy_000.ogg`   | 0.48 | Use original accepted action/state edge; baseline and deduplicate.                                                                                            |

The shortlist is a listening sequence, not a runtime implementation queue. Some rows group onset/end/recharge behavior: approve the clip and intended use separately in notes if the same source should not cover every edge. Signature presets are optional alternative audition mixes; the original proposed asset/gain/treatment stays visible. Approving a source clip does not approve every event using it. Changing a mix resets its event status to Pending.

## Events the current protocol cannot reliably expose as complete event history

### Exact sword victim contacts

resolveSword() changes enemy/Griffin HP without a stable per-victim sword-hit record. HP differences cannot identify every strike, source or sub-snapshot hit. Swing seq is usable; exact contact audio is deferred.

### Unguarded melee, nest-defense and headbutt contacts

damage() and Griffin attackHits mutate state, but there is no retained general damage-event stream. A HP delta can indicate hurt, not reliably identify each source/contact. Multiple hits or a full lethal reset may be lost between snapshots. defensiveHit.seq is a separate usable guarded-hit observation.

### Lethal damage versus other recovery

Lethal damage resets HP to 100 immediately and increments movementEpoch. The epoch also changes for movement recovery/corrections. It is not a reliable death/respawn event; do not derive a death cue from it.

### Mirror reflection before an immediate torch/wall hit

pondReflection can be set and the projectile removed in the same server tick. A client may only receive the final impact and torch latch, losing the intermediate reflection and its position. A disappeared projectile is also not necessarily an impact.

### Short phase/contact/occupancy edges between snapshots

Griffin phases/contactId+impactClock, gate/plate states and held inputs describe current state, not complete event history. Multiple transitions can be coalesced between snapshots. Use stable latches for completion, avoid promising every transient edge, and never replay baseline states after reconnect.

### Generic pickup acknowledgements and replayed requests

An inventory receipt or revision alone is not a new acquisition. Compare claimed/unlocked/completed and counts/tool delivery flags. Cached/repeated successes must stay silent. Story give/take and grooming consumption require their own state edges.

### Predicted casts and source identity

Predicted local presentation may precede accepted casts. Reconcile by accepted action/projectile IDs or wait; do not play twice. Black Hole also sets combat.kind=cast, so kind alone cannot identify Fireball.

These are limitations, not changes made by this task. Existing accepted combat sequences, `defensiveHit.seq`, `projectileImpacts` IDs, newly claimed inventory targets, permanent puzzle latches and new story flags offer usable observations with baseline/deduplication. They do not guarantee every short-lived transition in all network conditions. Exact sword contacts, transient reflections and full damage provenance would require retained server-owned presentation events in a separately approved protocol change, with integration tests.

## Preserved synchronization and silence rules

- Server truth remains authoritative. Audio never changes positions, HP, damage, cooldowns, abilities, puzzles or progression.
- First snapshots/reconnects establish baselines. Deduplicate action sequences and impact IDs; do not replay earned story/reward flags on revisit.
- Preserve cast prediction reconciliation, map/listener scope, private story cast/audience, and inventory receipt replay rules.
- Hold scenes pause mechanism/monster sound clocks. Stop/fade obsolete loops on phase exit, map travel, disconnect, death or room reset; use each effect's actual timing under Slow Time.
- Keep Alden's final stillness, funeral pauses, uncertain stranger disappearance and major revelation silences quiet. All 15 original zero-gain/no-asset rows are locked against layer assignments and validated on review import.
- No runtime audio manager, gameplay hooks, networking changes, animation changes, story edits, or new production assets are introduced.

## Review handoff

Audition Phase 1, compare candidates/layers, mark individual event decisions and export the review JSON. The gallery's Approved state records a human selection; it does not authorize automatic integration. Stop for review here. Future integration should use the exported approved selections only after an explicit follow-up instruction, preserve source provenance, add audio settings/unlocking, verify multiplayer behavior and run required project checks.

## Selection update — October 20, 2026

Human request: use `ok` (`Audio/confirmation_001.ogg`, Kenney Interface Sounds, CC0) for all cues originally assigned `select`: role/appearance selection, inventory item selection, motivation highlighting, and choosing why to continue. The gallery applies this candidate update once to new/existing browser reviews while preserving notes, gains, other decisions and the immutable original mapping. These edited mixes remain Pending; no live integration is authorized by this update. Subsequent manual candidate changes are retained.

## Provisional blanket review approval — October 20, 2026

Human request: “Just approve all for now I'll tweak them later as we go along.” All 204 event selections (including intentional silence) and all 63 source clips are now provisionally Approved in the gallery. The one-time update preserves saved mixes, volumes, notes, and the prior `select` → `ok` selection. Subsequent individual changes remain editable and are not overwritten by reloading. This records selection review only; live gameplay integration still requires a separate instruction.
