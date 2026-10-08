# Oath & Ember

A playable two-player cooperative browser prototype. Oath handles physical barriers and melee combat; Ember channels runes and casts ranged bolts. Both explore independently with their own cameras, open two forest gates, board a side-view airship, power its engine together, and defeat the Stormbound Warden.

## Run locally

Use Node 24 LTS and npm. Dependencies and the lockfile are included in the setup.

```sh
npm ci
npm run dev
```

Open http://localhost:5173 in two independent browser tabs or windows. Create a room in one, join its six-character code in the other, choose different heroes, and ready both. Session storage reserves each tab's hero across refresh. A third hero is rejected.

```sh
npm run typecheck
npm test
npm run build
npm start
```

Production serves the game and Socket.IO together at http://localhost:3000. `PORT` overrides 3000. `/healthz` returns JSON. Development uses Vite's Socket.IO proxy to the server on port 3000.

## Controls

- WASD or arrow keys: move.
- J: primary attack (Oath slash / Ember bolt).
- K or Shift: defense after unlocking Guard/Ward; later Dash/Blink.
- E: hold to interact, push, or channel.
- Space, W, or Up: jump in side view.
- Tab: skill tree. F3: networking diagnostics.
- Touch devices have directional, strike, defense, use, and jump buttons.

## Playthrough

1. Oath attacks the bramble with J; Ember holds E near the rune. Both conditions open the first gate.
2. Oath stays near the moving crate and holds E to push it east onto the plate. Ember uses the crystal. The second gate opens.
3. Reach the boarding marker at the eastern edge to move both heroes to the airship.
4. Jump across the deck gap. Oath holds E at the crank while Ember holds E at the core for three seconds.
5. Reach the eastern exit to enter the boss arena. Ember uses the anchor to strip the shield; Oath attacks the Warden. The shield returns once at half HP.
6. After victory, either hero can replay. Roles and room stay; progression resets.

Each hero starts with one skill point and gains points at gates and transitions. Skills form a three-node prerequisite chain. A defeated hero respawns at the scene entrance. This forgiving behavior keeps the technical prototype playable.

## Deploy

Push the repository to your Git host and create a Render Blueprint from `render.yaml`. It uses one Node 24 web service, `npm ci && npm run build`, `npm start`, and `/healthz`. Keep one instance; no database is required. Configuration follows https://render.com/docs/blueprint-spec.

For Docker:

```sh
docker build -t oath-and-ember .
docker run --rm -p 3000:3000 oath-and-ember
```

Docker configuration has been supplied but the image has not been built in this environment. Deployment has not been performed. Rooms are temporary in-process data: a server restart destroys them. Disconnected sessions reserve slots for 30 seconds; gameplay pauses while a partner is absent. Empty rooms are removed after session expiry.

## Architecture and current limits

`packages/shared` owns types, map geometry, skills and deterministic movement. `apps/server` owns simulation and sessions. `apps/client` owns Phaser presentation, DOM menus, touch input, prediction and remote interpolation. See `docs/NETWORKING.md` and `docs/GAMEPLAY.md`.

This is the first technical slice, not the finished 15–25 minute game. It uses one Phaser presentation scene to handle all three map modes, and DOM overlays for menu/lobby/skills. The environment uses geometric placeholders; heroes and monsters use approved sprites. No paid or proprietary assets are required. Mossling, Cinder Wisp and Ironbound Sentinel use server-authoritative enemy definitions. Additional puzzle types and full art/audio remain future work. Enemy seeking is deliberately simple; it does not pathfind around obstacles. Ember channels the gate rune instantly; engine channeling is timed. Interpolation holds the last remote state on stalls. Prediction uses latest-input server acknowledgement, so packet jitter can still cause correction; F3 exposes the error.

Validation on the host used Node 26.9.0, while Docker and Render target Node 24. Mobile input is implemented but has not been exercised on physical devices. The automated network test uses real Socket.IO connections; it does not substitute for a full two-person playtest.

## Sprite assets

See [docs/SPRITE_ASSETS.md](docs/SPRITE_ASSETS.md) for sprite-sheet layout and final-art replacement. F4 toggles sprites/geometric debug heroes; `?characters=geometric` starts in debug mode. Approved-reference directional idles are presentation-only; missing animations use directional idles, and side-view maps keep geometric rendering. See [docs/HERO_REFERENCE_INTEGRATION.md](docs/HERO_REFERENCE_INTEGRATION.md) for asset provenance and visual-scale configuration.

## Responsive display

World rendering uses a bounded logical pixel budget with integer enlargement and nearest-neighbor filtering. HUD and touch controls reflow independently in screen space. See [docs/RESPONSIVE_RENDERING.md](docs/RESPONSIVE_RENDERING.md) for camera strategy, supported screen sizes and asset-authoring guidance.

Sieg and Coco support synchronized lobby color swatches and partner previews. Runtime mask recoloring preserves one canonical art set and existing animation clocks. See [character appearance documentation](docs/CHARACTER_APPEARANCE.md) for palettes, masks, caching and protocol validation.

Directional sword attacks and projectile casts use approved reference artwork with server-accepted combat markers, locked facing and presentation recovery. See [combat presentation documentation](docs/COMBAT_PRESENTATION.md) for extraction, frame timing, palette/VFX layers, artwork fallbacks and two-client validation.

Heavy Break now charges on hold and strikes on release; Coco’s traveling blast uses approved effect art and authoritative collision bursts. See [charge/projectile behavior and validation](docs/COMBAT_CHARGE_AND_PROJECTILES.md).

Coco's projectile now loops normalized magical ribbons around a stable core at 14 FPS, with palette recoloring and a separate one-shot impact. See [twirling projectile assets and validation](docs/TWIRLING_MAGIC_PROJECTILES.md).

Monster designs and original source sheets are preserved in [Images/Sprites/monster_sprites](Images/Sprites/monster_sprites/README.md). The former multi-role art workflow has been retired. The existing multiplayer enemy encounter remains available with `npm run enemy:encounter`; see [enemy gameplay documentation](docs/ENEMY_GAMEPLAY.md).
