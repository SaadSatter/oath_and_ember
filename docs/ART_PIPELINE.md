# Hero sprite asset pipeline

Hero artwork is a client presentation layer. PlayerView reads authoritative status and predicted local movement, while the scene supplies the existing smoothed or interpolated position. No sprite has a physics body. Sprite dimensions, origins, scale, frame counts, animations and effects never change authoritative state, collision boxes, attacks, or room behavior.

## Files and ownership

- `apps/client/public/assets/characters/oath/`: final Oath PNG assets.
- `apps/client/public/assets/characters/ember/`: final Ember PNG assets.
- Sibling `enemies`, `environments`, `effects`, and `ui` directories reserve space for later art pipelines.
- `apps/client/src/animation/definitions.ts`: the central hero manifest, semantic states, frame ranges, FPS, looping, origin and visual scale.
- `apps/client/src/assets/heroLoader.ts`: preload and animation registration; original runtime-generated test sheets.
- `apps/client/src/animation/selectAnimation.ts`: pure, read-only visual-state selection.
- `apps/client/src/entities/PlayerView.ts`: sprite/geometric rendering, animation transitions, platformer flipping, hurt tint, defense/channel rings and HP bar.

The default uses one deliberately simple test sheet per hero generated in memory. These are geometric shapes with a small bob and facing marker, not character designs. No external downloads or committed raster files are required.

## PNG contract

Use a transparent, untrimmed PNG grid. Default filename is `oath.png` or `ember.png` in its hero directory. Default cell dimensions are **64 × 64 pixels**, without margins or spacing. Each row contains four frames, left to right; the complete sheet is **256 × 1088 pixels** (4 columns × 17 rows). Phaser indexes frames in row-major order starting at zero.

Keep the registration point consistent in every frame. Default origin is `(0.5, 0.5)`: the cell center aligns with the existing simulation center `(x, y)`. For foot-based art, choose an explicit origin in the manifest so the desired point aligns with the simulation center. This is a visual offset only; do not reposition gameplay bodies. Include enough transparent padding for weapons and effects. Default visual scale is 1; changing scale does not change collision. HP and effect rings remain centered on the gameplay position.

Different cell sizes and frame counts are supported by editing each hero's manifest. Update frame ranges as well as dimensions. Export north-up for top-down, right-facing for platformer. Never trim individual cells or assume sprite bounds represent hitboxes.

## Animation rows and semantic names

| Row | Mode       | Name              | Frames | Recommended FPS | Repeat |
| --- | ---------- | ----------------- | ------ | --------------- | ------ |
| 0   | TOP_DOWN   | idle              | 0–3    | 6               | loop   |
| 1   | TOP_DOWN   | walk_north        | 4–7    | 10              | loop   |
| 2   | TOP_DOWN   | walk_south        | 8–11   | 10              | loop   |
| 3   | TOP_DOWN   | walk_east         | 12–15  | 10              | loop   |
| 4   | TOP_DOWN   | walk_west         | 16–19  | 10              | loop   |
| 5   | TOP_DOWN   | primary_attack    | 20–23  | 10              | once   |
| 6   | TOP_DOWN   | secondary_ability | 24–27  | 10              | loop   |
| 7   | TOP_DOWN   | interact_channel  | 28–31  | 10              | loop   |
| 8   | TOP_DOWN   | hurt              | 32–35  | 12              | once   |
| 9   | PLATFORMER | idle              | 36–39  | 6               | loop   |
| 10  | PLATFORMER | run               | 40–43  | 10              | loop   |
| 11  | PLATFORMER | jump              | 44–47  | 10              | loop   |
| 12  | PLATFORMER | fall              | 48–51  | 10              | loop   |
| 13  | PLATFORMER | primary_attack    | 52–55  | 10              | once   |
| 14  | PLATFORMER | secondary_ability | 56–59  | 10              | loop   |
| 15  | PLATFORMER | interact_channel  | 60–63  | 10              | loop   |
| 16  | PLATFORMER | hurt              | 64–67  | 12              | once   |

Runtime keys are `hero:OATH:TOP_DOWN:walk_north`, etc. Scenes never name frame numbers. The manifest can map multiple semantic animations to the same frames while art is incomplete. Top-down walking requires four separately authored directions; west is not auto-mirrored. Current idle and action clips are direction-neutral. Directional idle/attack variants would be a presentation-only manifest/selector extension. Platformer art faces right and PlayerView flips it horizontally when facing left. Jump and fall are selected from predicted/local or authoritative/remote grounded and vertical velocity.

## Replace test artwork with final art

1. Export the agreed sheet into `apps/client/public/assets/characters/oath/oath.png` or `.../ember/ember.png`.
2. In `heroAssets` in `definitions.ts`, change that hero's `source` from `generated` to `file`. The configured URL already points to the expected location. Roles can be replaced independently.
3. If the artist uses another layout, edit only that hero's `frameWidth`, `frameHeight`, `clips`, `origin` and `scale`. FPS is a presentation choice, never an attack-timing source.
4. Reload the client to preload the new sheet and register its clips. Vite serves public assets in development and copies them into the production build.
5. Press **F4** to toggle sprite/geometric rendering. Use `?characters=geometric` for a direct debug launch; sprite mode is the default. F3 shows the current rendering mode.
6. Check both heroes in all three maps, both facing directions in side view, actions, health changes, refresh/resume and role changes. Run `npm run typecheck`, `npm test`, and `npm run build`.

Missing PNGs or unavailable frame ranges leave the corresponding semantic animation in geometric fallback. The loader only registers clips whose frames exist. The game remains playable; browser load errors are expected if a configured file is missing. No replacement texture is treated as gameplay truth.

## State and transition limits

Action selection priority is hurt, primary attack, secondary ability, interact/channel, then locomotion. HP decreases trigger a 250ms presentation-only hurt flash. Repeated rendering does not restart the same clip. One-shot clips hold their last frame while that semantic state persists and restart on re-entry. Completion never invokes damage, cooldowns or gameplay transitions.

The existing server publishes `attack`, `guard`, and `idle`, not attack event IDs or an interaction-held field. Local channel presentation uses the existing E key as a harmless visual hint; remote channel cannot currently be identified reliably. The selector accepts `interact`/`channel` action states for future presentation input, but this task does not change the protocol. Held primary attacks therefore animate on action-state transitions rather than every repeated server cooldown. A brief hurt transition can interrupt an action. These are deliberate limits of the existing state contract, not reasons to modify game mechanics for art.

Player views are removed on despawn, lobby return, map change and scene shutdown. Authoritative HP/status and world positions remain owned by the existing state and networking layers.

## Responsive presentation

Camera/display scaling is centralized in the responsive renderer; keep hero manifest scale consistent across devices. See `RESPONSIVE_RENDERING.md` for the bounded logical viewport, pixel-art filtering and world-space asset density. Resizing never restarts a hero animation or changes gameplay dimensions.
