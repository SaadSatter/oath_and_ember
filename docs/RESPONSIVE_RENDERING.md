# Responsive world and screen rendering

Responsiveness is exclusively client presentation. No screen size, device pixel ratio, camera position or zoom is transmitted to the server. Shared movement, authoritative positions, collision rectangles, combat distances and physics remain in their original world units. Each client's camera follows its own hero; partners can explore independently.

## Logical viewport and display scaling

`src/rendering/viewport.ts` defines a target area of **230,400 logical pixels**, equivalent to **640 × 360**. The viewport follows the device aspect ratio within **9:16 through 16:9**, keeping approximately equal visible world area. Landscape normally uses 640 × 360; portrait uses 360 × 640. Dimensions are rounded to whole logical pixels, with a negligible area difference for intermediate ratios. Neither axis exceeds 640 world units. Ultrawide and especially tall devices show letterboxing rather than exceeding these bounds. Different orientations reveal differently shaped areas, not an increasing total world budget.

The Phaser Scale Manager uses `NONE` with explicit logical `resize()` and uniform display `setZoom()`. This Scale Manager zoom enlarges the canvas in CSS; it is separate from camera zoom. The camera stays at **1 logical pixel per world unit**. A ResizeObserver plus window/orientation/visual-viewport listeners coalesces updates using requestAnimationFrame. Only a change in logical dimensions resizes the renderer; display-only changes preserve its internal dimensions. Resize updates the existing camera viewport, never restarts scenes or creates a new game/socket.

Display enlargement uses the largest integer scale that fits. Examples:

| Screen      | Logical viewport | CSS enlargement | Rendered world canvas |
| ----------- | ---------------- | --------------- | --------------------- |
| 1920 × 1080 | 640 × 360        | 3×              | 1920 × 1080           |
| 1440 × 900  | 607 × 379        | 2×              | 1214 × 758            |
| 390 × 844   | 360 × 640        | 1×              | 360 × 640             |
| 844 × 390   | 640 × 360        | 1×              | 640 × 360             |
| 3840 × 2160 | 640 × 360        | 6×              | 3840 × 2160           |
| 5120 × 1440 | 640 × 360        | 4×              | 2560 × 1440           |

The canvas is centered in the remaining screen area. Letterboxing intentionally trades some screen usage for crisp pixels and bounded visibility. When a window is smaller than its logical viewport, uniform fractional reduction with nearest-neighbor filtering keeps the whole image visible. Fractional operating-system/browser zoom or device pixel ratios may still produce uneven physical pixel spacing; the code never stretches one axis independently to compensate.

Phaser `pixelArt` and `roundPixels` are enabled, and CSS uses `image-rendering: pixelated`. Camera transforms round rendered pixels. No per-device changes are made to PlayerView asset scale or collision dimensions. Viewport sizing needs no DPR multiplier: high-DPI screens do not reveal more world or inflate GPU buffers.

## Screen-space UI

HUD status, objectives, controls help and F3 diagnostics live in DOM overlays, independently of world/camera scaling. They wrap in screen pixels and anchor to edges with `env(safe-area-inset-*)`; the page enables `viewport-fit=cover`. Menus and skill trees have responsive padding, portrait role-card reflow and bounded scrolling based on dynamic viewport height. Text remains at least 14px for gameplay HUD and touch buttons. Debug diagnostics use a smaller 12px monospace face.

Touch controls appear only for a coarse-pointer device during active gameplay, disappear while a skill menu is open, and respond to capability changes. Directions sit at bottom left; actions form a two-column group at bottom right. Buttons are 44–56 CSS pixels and respect safe areas. Objective/HUD information stays at the top and notices rise above the controls. Lost pointer capture releases the corresponding held control. `?touch=1` forces the touch layout for desktop browser QA; it does not alter gameplay or network messages.

## Timing and resizing

Phaser animations retain their FPS/time-based playback through camera and canvas size changes. PlayerView chooses clips from player movement/action state; it does not receive screen size or restart a clip on resize. Hurt flashes use scene time. Rendered-player/camera smoothing now uses a delta-time convergence factor equivalent to the former 0.3 per frame at 60Hz. It has equivalent convergence at 120Hz and variable refresh rates.

The client input sampler remains 30Hz, and server simulation/snapshot frequencies are unchanged. Resize callbacks do not send input, reset prediction, change player positions, clear animations, reset puzzles, or reconnect sockets.

## Authoring future assets

Author heroes and environments at a consistent world-pixel density, not at the user's device resolution. A 32-world-unit object should occupy about 32 source pixels at asset scale 1, regardless of desktop or phone. Use transparent sprite cells, integer source dimensions, consistent pivots, and preferably integer visual scale in the centralized manifest. Keep tiled environment edges aligned to integer world coordinates to avoid seams. Export PNG assets without baked device scaling or screen-space HUD text; retain nearest-neighbor filtering.

The sprite-sheet grid and semantic animations remain as documented in `ART_PIPELINE.md`. Large padded weapon/cast frames are presentation only; never infer collision or damage areas from sprite bounds. Future environment views should follow the same rule. Keep UI icons and labels in screen space where their readable size can respond independently of the world.

## Verification

Automated layout tests cover 1920×1080, 1440×900, 390×844, 844×390, 4K, ultrawide and tiny windows, checking uniform scaling, containment and bounded visible world area. Tests also compare 60Hz and 120Hz camera-smoothing convergence. Existing multiplayer and animation tests remain required.

Manual browser QA should resize a connected playing client at all four required sizes, verify the same hero/session and world position persist, test sprite/geometric F4 toggling, inspect portrait/landscape touch controls and scrollable skills, and keep a second differently sized client in the same room. Device safe-area behavior and physical touch feel require real-device testing beyond desktop emulation.

### This implementation's validation results

`npm run typecheck`, `npm test` (25 tests), and `npm run build` pass. ResponsiveRenderer regression tests exercise all four required sizes on a retained presentation instance and simulate concurrent desktop/phone renderers with equal player coordinates. The existing Socket.IO integration test separately verifies shared authoritative snapshots across real connected clients.

A visual browser pass was attempted but could not be completed: the in-app browser's viewport override and debugger connection timed out, and native-browser fallback was interrupted by user interaction. Therefore real simultaneous browsers at different physical viewport sizes, screenshot-based layout review, device safe-area behavior and physical touch controls remain unverified. The simulated renderer tests are not claimed as a completed visual browser playtest. Temporary viewport-override reset was attempted but also timed out; if the in-app browser appears unusually sized, clear its viewport override or reopen the browser panel.
