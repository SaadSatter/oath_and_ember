# Responsive world and screen rendering

Responsiveness is exclusively client presentation. No screen size, device pixel ratio, camera position or zoom is transmitted to the server. Shared movement, authoritative positions, collision rectangles, combat distances and physics remain in their original world units. Each client's camera follows its own hero; partners can explore independently.

## Logical viewport and display scaling

`src/rendering/viewport.ts` targets **230,400 world units of visible area**, equivalent to **640 × 360**. The fitted box follows the device aspect ratio within **9:16 through 16:9**. Ultrawide and especially tall devices are letterboxed rather than revealing more world.

The canvas is rendered at **device resolution**: one canvas pixel is one physical pixel (the Scale Manager's CSS zoom is `1 / devicePixelRatio`). Art is enlarged by a **whole-number camera zoom** (`pixelZoom(scene)`), the integer closest to the ideal fit. Every art pixel is therefore the same size on screen, which removes the shimmer that fractional CSS stretching caused while scrolling. Because sprites and camera are snapped to physical pixels rather than whole art pixels, motion advances in sub-art-pixel steps.

A whole-number zoom cannot hit the target area exactly. The visible footprint may exceed the target by at most `MAX_REVEAL` (1.2×) per axis; beyond that the next zoom step is used, which shows somewhat less. Examples (CSS size @ device pixel ratio):

| Screen          | Camera zoom | Visible world |
| --------------- | ----------- | ------------- |
| 1920 × 1080 @1  | 3×          | 640 × 360     |
| 1440 × 900 @1   | 2×          | 720 × 450     |
| 1440 × 900 @2   | 5×          | 576 × 360     |
| 390 × 844 @1    | 1×          | 390 × 693     |
| 844 × 390 @1    | 1×          | 693 × 390     |

A ResizeObserver plus window/orientation/visual-viewport and device-pixel-ratio listeners coalesce updates using requestAnimationFrame. Resize updates the existing camera viewport and zoom; it never restarts scenes or creates a new game/socket.

Phaser `pixelArt` and `roundPixels` are enabled, and CSS uses `image-rendering: pixelated`. Phaser rounds vertices to physical pixels whenever the camera zoom is a whole number. Framed puzzle views that zoom out multiply the base zoom by a fraction; rounding is then skipped by Phaser for those frames. No per-device changes are made to PlayerView asset scale or collision dimensions.

## Camera follow

The camera trails the hero with a time-constant ease (`followCamera`, 0.15 per 60Hz frame, equivalent at any refresh rate) rather than locking to the hero every frame, so small per-frame unevenness in motion is absorbed instead of moving the whole screen. Jumps beyond 240 world units (teleports, respawns, scene changes) are taken at once. Framed areas still blend in and out on top of the eased position.

## Screen-space UI

HUD status, objectives, controls help and F3 diagnostics live in DOM overlays, independently of world/camera scaling. They wrap in screen pixels and anchor to edges with `env(safe-area-inset-*)`; the page enables `viewport-fit=cover`. Menus and skill trees have responsive padding, portrait role-card reflow and bounded scrolling based on dynamic viewport height. Text remains at least 14px for gameplay HUD and touch buttons. Debug diagnostics use a smaller 12px monospace face.

Touch controls appear only for a coarse-pointer device during active gameplay, disappear while a skill menu is open, and respond to capability changes. Directions sit at bottom left; actions form a two-column group at bottom right. Buttons are 44–56 CSS pixels and respect safe areas. Objective/HUD information stays at the top and notices rise above the controls. Lost pointer capture releases the corresponding held control. `?touch=1` forces the touch layout for desktop browser QA; it does not alter gameplay or network messages.

## Timing and resizing

Phaser animations retain their FPS/time-based playback through camera and canvas size changes. PlayerView chooses clips from player movement/action state; it does not receive screen size or restart a clip on resize. Hurt flashes use scene time. Rendered-player/camera smoothing now uses a delta-time convergence factor equivalent to the former 0.3 per frame at 60Hz. It has equivalent convergence at 120Hz and variable refresh rates.

The client advances its input sampler with the 60Hz simulation clock. Resize callbacks do not send input, reset prediction, change player positions, clear animations, reset puzzles, or reconnect sockets.

## Authoring future assets

Author heroes and environments at a consistent world-pixel density, not at the user's device resolution. A 32-world-unit object should occupy about 32 source pixels at asset scale 1, regardless of desktop or phone. Use transparent sprite cells, integer source dimensions, consistent pivots, and preferably integer visual scale in the centralized manifest. Keep tiled environment edges aligned to integer world coordinates to avoid seams. Export PNG assets without baked device scaling or screen-space HUD text; retain nearest-neighbor filtering.

The sprite-sheet grid and semantic animations remain as documented in `SPRITE_ASSETS.md`. Large padded weapon/cast frames are presentation only; never infer collision or damage areas from sprite bounds. Future environment views should follow the same rule. Keep UI icons and labels in screen space where their readable size can respond independently of the world.

## Verification

Automated layout tests cover 1920×1080, 1440×900, 390×844, 844×390, 4K, ultrawide and tiny windows at 1×, 2× and 3× device pixel ratios, checking whole-number zoom, containment and bounded visible world area. Tests also compare 60Hz and 120Hz camera-smoothing and camera-follow convergence. Existing multiplayer and animation tests remain required.

Manual browser QA should resize a connected playing client at all four required sizes, verify the same hero/session and world position persist, test sprite/geometric F4 toggling, inspect portrait/landscape touch controls and scrollable skills, and keep a second differently sized client in the same room. Device safe-area behavior and physical touch feel require real-device testing beyond desktop emulation.

### Latest validation results (approved hero integration)

`npm run typecheck`, `npm test` (30 tests), and `npm run build` pass. The connected Ember browser was resized through 1920×1080, 1440×900, 390×844 and 844×390 while Oath remained connected in a differently sized browser. Both heroes were visible on both clients. Player identity, room, connection and world position persisted across all four resizes. Recorded canvas dimensions confirm uniform scaling; see `hero-browser-validation.json` and `heroes-*.png`.

The visual pass exposed a Phaser Scale.NONE issue: changing logical dimensions at an unchanged zoom could retain old CSS dimensions and distort the canvas. ResponsiveRenderer now reapplies zoom after logical resize, including portrait-to-landscape transitions at scale 1. A regression test covers this path.

Independent keyboard/touch movement, remote facing updates and F4 geometric/sprite switching were verified in the shared room. No obvious remote pose flicker was observed. Static idle assets provide no multi-frame walking cycle to assess. Physical device safe areas and touch feel remain outside desktop viewport emulation.
