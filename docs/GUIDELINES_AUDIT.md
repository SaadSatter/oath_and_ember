# Guidance audit — October 9, 2026

## Verdict and scope

The game already follows most of the documents' core movement, rendering and multiplayer principles. It needs targeted presentation, metadata and verification improvements rather than an engine rewrite. This review compares the current local source and existing tests with `deep-research-report.md` and `Game_Guidance.md`. The supplied documents are reference material, not operating instructions. No gameplay or artwork was changed for this audit.

Both documents explicitly acknowledge incomplete access to the repository. Their hypothetical bugs and sample dimensions are not observations about the current game. The research report's old JavaScript-only repository description does not describe this TypeScript workspace, which already uses Phaser. Repository visibility assertions also differ between the documents; neither is relevant to the local implementation audit.

## Compliance matrix

| Principle | Assessment | Local evidence |
| --- | --- | --- |
| Server owns gameplay; clients submit intent | Follows | `apps/server/src/app.ts` strictly validates sequences/buttons and rejects extra fields. `GameRoom.tick()` owns movement, combat and progression. |
| Fixed-step simulation with bounded catch-up | Follows | `app.ts` uses a monotonic-time accumulator, 30 Hz physics and a five-step elapsed-time clamp. Its 8 ms timer wakes the accumulator; it does not define physics dt. |
| Equal diagonal/cardinal speed; no top-down gravity | Follows | `packages/shared/src/movement.ts` normalizes the direction, applies SPEED × dt, and applies gravity only in PLATFORMER mode. `game.test.ts` tests normalization. |
| Separate-axis sweep, thin-wall safety, sliding | Follows for players | `movement.ts` sweeps to the nearest contact on X then Y. `blockedMovement.test.ts` covers thin walls, exact contacts, overlapping barriers, corners and sliding. |
| Collision independent of sprite pixels/camera | Follows | Shared collision uses a 26 × 26 box (`HALF = 13`), independent of 48 × 64 locomotion and 128 × 128 combat art. Cameras and textures exist only on the client. |
| Stable anatomical anchors | Partial | Hero locomotion and combat pivots are explicit and normalized. Physics position is the box center; hero feet render at y + 13. This is a workable conversion, but environment depth keys do not all use that same convention. |
| Pixel-art rendering without fractional simulation | Follows | Phaser `pixelArt`/`roundPixels`, camera pixel rounding, nearest-neighbor environment textures and uniform integer enlargement preserve the rendering grid. Physics keeps floating-point precision. |
| Artwork separated from map collision | Follows | Tiled JSON is visual; shared rectangles define authoritative collision. Collision is not inferred from decorative tile IDs. |
| Authorable collision, interaction and sorting metadata | Partial | Shared map rectangles/points are explicit, but source maps contain no collision/object layers. Furniture sorting still infers objects from atlas regions and coordinates. |
| State/facing selects animation; timers use elapsed time | Follows | `selectAnimation.ts`, `PlayerPresentation.ts`, Phaser clips and `siegAttack.ts` consume state and elapsed/server time rather than keyboard-selected frames. Facing persists on release. Held intent deliberately animates walking when pushing against a wall. |
| Nonuniform attack cadence | Partial/design choice | Sieg basic attack has per-frame durations. Other clips use uniform FPS. The guidance's exact anticipation/impact/recovery durations are tuning examples, not correctness requirements. |
| Modular equipment layers share pose and directional ordering | Not currently applicable in full | Current appearance is palette customization, not an equipable body/armor/hair/weapon system. Coco's combat effects use the body's displayed frame. Arbitrary equipment composition would be a new feature. |
| Cache generated appearance assets | Follows | `appearanceTextures.ts` caches recolored canvases/textures by role/palette/action family. OffscreenCanvas is not necessary for this finite cache. |
| Sampled network intent rather than key-repeat flooding | Follows for normal client | The client samples at 30 Hz and sends reliable primary-button edges only on transitions. Key repeats do not trigger extra primary packets. |
| Prediction, acknowledgement and interpolation | Follows, with measured limitations | Prediction replays future simulation ticks independently of packet acknowledgements; remote state interpolates. The sustained movement recoil regression covers timer skew and delayed input. Severe latency still allows valid corrections. |
| Hitboxes/triggers independent of artwork | Follows | Server combat, projectile segment tests and interaction proximity checks do not use sprite transparency. No client animation event grants damage. |
| Complete sprite catalogue and automatic contract validation | Partial | Hero/enemy/combat definitions and provenance contain metadata; selected image/mask/pivot properties have tests. No single exhaustive runtime-asset validator covers every sheet, direction, mask and clip. |
| All specified render rates/stalls independently verified | Partial | Smoothing has a 60-versus-120 Hz unit test and collision has large-step tests. This does not establish full game equivalence at 30, 60, 120 and 144 Hz under browser stalls. |

## Recommended work, in order

1. **Make presentation depth use one ground-coordinate convention.** In `PlayerView.ts:173`, a hero sorts by center y while its anatomical feet are y + 13 (`characterVisuals.ts:12`). Trees sort by their actual ground y (`EnvironmentView.ts:179`); furniture subtracts 13 (`EnvironmentView.ts:145`). Thus the same ground point has different depth keys. This can switch hero/tree overlap about 13 world units late. Use a shared presentation ground/depth conversion and verify front/behind crossings. Keep authoritative positions, collider dimensions and approved pivots intact. `ProjectileView.ts:29,57,61` also uses fixed depths 30/31 rather than top-down ground depth; define a deliberate policy for projectiles/effects instead of inheriting that behavior accidentally.

2. **Add explicit map object metadata.** Keep the reviewed authoritative rectangles, but move or export collision, interaction and ground-sort anchors into shared authorable data. Replace furniture atlas-region heuristics (`EnvironmentView.ts:103–118`) and the couch's hard-coded y334 with declared object information. Validate it against spawn/door fixtures. This prevents an atlas rearrangement from changing object grouping or visual depth. Current hard-coded rectangles are already independent of artwork; adopting Tiled object layers improves editing, not basic simulation correctness.

3. **Complete validation and collision debugging.** Add hero/enemy body outlines alongside the existing F3 wall overlay (`main.ts:390`). Validate every runtime sheet's image dimensions, frame ranges, pivots and mask sizes, including variable-cell enemy metadata. Add actual 30/60/120/144 Hz browser movement/release/corner checks and forced-stall scenarios. Existing tests are substantial, but they do not cover the entire definition of done.

4. **Resolve the networking documentation/rate-limit mismatch.** `docs/NETWORKING.md:13` claims a 100-accepted-inputs/second cap. The current `app.ts` handler has no such rate cap; it retains the newest monotonic intent and bounds primary edges to eight. Normal clients are throttled, but arbitrary senders are not. Correct the documentation and assess a burst-tolerant server budget that preserves the newest held intent. Restoring the former per-packet 10 ms drop rule would reintroduce stale movement and is not an appropriate fix. The prediction paragraph also needs to describe future-tick replay rather than imply one physics step per remaining packet.

5. **Unify enemy collision when faster movement is introduced.** `enemySimulation.ts:54–82` uses separate-axis endpoint overlap checks rather than player-style sweeps. It is a weaker collision contract, although no high-speed enemy tunneling was established in this review. Test narrow walls and near-contact stopping before increasing enemy speeds. Player and projectile collision already have continuous checks.

## Examples that should not be copied directly

- `Game_Guidance.md`'s server loop applies a full physics step for every queued packet inside a tick. A sender could gain movement by sending more packets. Our server correctly applies held movement once per authoritative tick.
- Its client replay treats each unacknowledged packet as one elapsed step. Our server acknowledges intent, so this simplistic replay does not fit the protocol and can reintroduce recoil.
- Its corner-slip sample tests clearance at a four-unit offset but moves only one unit without validating that resulting position. It also introduces unsolicited axis movement. Any assist needs deterministic server simulation and collision coverage; the existing sweep should be retained.
- A 48 × 48 atlas, 60 Hz simulation, OffscreenCanvas, collision bit masks and a new engine are not prerequisites. Matching pose contracts are needed among layers composited together, not among every animation family or every species.
- Sorting by y + sprite height applies to top-left-positioned sprites. Our sprites have explicit pivots; sorting must use the anatomical ground coordinate instead.
- Animation-to-hitbox examples must be adapted to server-owned combat timing. Client-rendered frame events cannot determine damage.

## Validation

Audit validation passed: `npm run typecheck`, `npm test` (118 tests across 18 files), `npm run build`, and `git diff --check`. The build retains its existing large-bundle warning. This is a source and regression-coverage review; it does not claim a fresh exhaustive visual audit or a fresh full sprite inventory. Existing movement browser evidence and its latency limitations are documented in `COLLISION_JITTER.md`.
