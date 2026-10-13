The repository at `[https://github.com/SaadSatter/oath_and_ember](https://github.com/SaadSatter/oath_and_ember)` is currently inaccessible (returning a 404 or private repository status). Because the repository is not publicly readable, external automated tools cannot directly parse or clone your source files.

However, top-down 2D pixel adventure games built in Node.js and HTML5 Canvas almost universally run into the exact same five architectural bottlenecks. Below is an audit blueprint detailing where your code likely breaks standard practices across kinematics, map collision, tile layering, sprite animation, and multiplayer networking—along with the exact "Before vs. After" code implementations to fix them.

---

### 1. Movement Kinematics and Subpixel Rendering

#### Where the Code Typically Breaks Standards

1. **The Diagonal Speed Boost:** When horizontal and vertical input flags are applied independently (e.g., `x += vx` and `y += vy`), diagonal movement produces a vector of length $\sqrt{1^2 + 1^2} = \sqrt{2} \approx 1.4142$. The player travels roughly $41.4\%$ faster when moving diagonally than when moving straight.
2. **Subpixel Jitter:** Storing positions as floating-point numbers and passing them directly into `ctx.drawImage()` forces the browser to interpolate fractional pixels. In pixel art, this causes visual shimmering, blurriness, and tile vibration during movement.



#### The Anti-Pattern (Before)

```javascript
// BUG: Diagonal velocity is 1.41x cardinal speed, and float rendering causes jitter
function updatePlayer(player) {
  if (keys['ArrowUp']) player.y -= player.speed;
  if (keys['ArrowDown']) player.y += player.speed;
  if (keys['ArrowLeft']) player.x -= player.speed;
  if (keys['ArrowRight']) player.x += player.speed;

  // Passing raw floats causes blurry anti-aliased pixels
  ctx.drawImage(player.sprite, player.x - camera.x, player.y - camera.y);
}

```

#### The Production Fix (After)

Normalize the direction vector whenever its length exceeds 1.0, and round world-to-screen coordinates using `Math.floor()`.

```javascript
function updatePlayer(player, deltaTime) {
  let moveX = 0;
  let moveY = 0;

  if (keys['KeyW'] || keys['ArrowUp']) moveY -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) moveY += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

  // 1. Vector Normalization
  const magnitude = Math.hypot(moveX, moveY);
  if (magnitude > 0) {
    moveX /= magnitude;
    moveY /= magnitude;
  }

  player.x += moveX * player.speed * deltaTime;
  player.y += moveY * player.speed * deltaTime;

  // 2. Integer screen-space snapping
  const screenX = Math.floor(player.x - camera.x);
  const screenY = Math.floor(player.y - camera.y);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(player.sprite, screenX, screenY);
}

```

---

### 2. Map Physics and Collision Geometry

#### Where the Code Typically Breaks Standards

1. **Oversized Collision Hulls:** Using the full sprite bounds ($32 \times 32$ or $32 \times 48$ pixels) for tile collisions causes the character's head to collide with walls, cliffs, and trees. The player cannot walk behind low fences or through 1-tile gaps.
2. **Sticky Corners:** Checking both X and Y axes in a single collision pass causes all movement to stop if either axis hits an obstacle, locking the player in place when grazing a wall corner.



#### The Anti-Pattern (Before)

```javascript
// BUG: Entire sprite box collides, and simultaneous X/Y check freezes character on corners
function moveWithCollision(player, dx, dy, map) {
  const nextX = player.x + dx;
  const nextY = player.y + dy;

  // Checks entire 32x48 sprite box
  if (!isSolid(map, nextX, nextY, 32, 48)) {
    player.x = nextX;
    player.y = nextY;
  }
}

```

#### The Production Fix (After)

* Restrict solid physical collisions to the character's footprint (the bottom $25\%$ to $35\%$ of the sprite).
* Check the X and Y axes separately so horizontal movement continues when blocked vertically.


* Add corner-slip nudging so players slide past obstacle edges.



```javascript
// Decouple physical footprint from rendering dimensions
const FOOTPRINT = { offsetX: 6, offsetY: 34, width: 20, height: 14 };

function getFootBox(x, y) {
  return {
    left: x + FOOTPRINT.offsetX,
    right: x + FOOTPRINT.offsetX + FOOTPRINT.width,
    top: y + FOOTPRINT.offsetY,
    bottom: y + FOOTPRINT.offsetY + FOOTPRINT.height
  };
}

function moveEntity(entity, vx, vy, map) {
  // 1. Resolve X-Axis independently
  const targetX = entity.x + vx;
  const boxX = getFootBox(targetX, entity.y);
  if (!checkMapCollision(map, boxX)) {
    entity.x = targetX;
  } else {
    // Corner slip assist on vertical axis
    const slipThreshold = 4;
    if (!checkMapCollision(map, getFootBox(targetX, entity.y - slipThreshold))) entity.y -= 1;
    else if (!checkMapCollision(map, getFootBox(targetX, entity.y + slipThreshold))) entity.y += 1;
  }

  // 2. Resolve Y-Axis independently
  const targetY = entity.y + vy;
  const boxY = getFootBox(entity.x, targetY);
  if (!checkMapCollision(map, boxY)) {
    entity.y = targetY;
  } else {
    // Corner slip assist on horizontal axis
    const slipThreshold = 4;
    if (!checkMapCollision(map, getFootBox(entity.x - slipThreshold, targetY))) entity.x -= 1;
    else if (!checkMapCollision(map, getFootBox(entity.x + slipThreshold, targetY))) entity.x += 1;
  }
}

```

---

### 3. World Layering and Dynamic Depth Sorting (Y-Sorting)

#### Where the Code Typically Breaks Standards

Drawing entities directly onto a static background layer causes visual clipping. Characters will either always render behind scenery (disappearing under tree trunks) or always render in front (stepping on top of tree canopies and building roofs).

#### The Anti-Pattern (Before)

```javascript
// BUG: Single rendering pass causes dynamic entities to incorrectly clip through scenery
function render(map, players, enemies) {
  map.drawBackground(ctx);
  players.forEach(p => p.draw(ctx));
  enemies.forEach(e => e.draw(ctx));
  map.drawForeground(ctx); // Player is permanently behind all foreground tiles
}

```

#### The Production Fix (After)

Split the tilemap into four distinct passes and sort all dynamic entities by their foot anchor coordinate ($y_{\text{sort}} = y + \text{height}$):

$$\text{Depth Value } (y_{\text{sort}}) = \text{World } y + \text{Sprite Height}$$

```javascript
function renderWorld(ctx, camera, map, entities) {
  // Pass 1 & 2: Static Ground and Terrain Fringe (grass, dirt, floorboards)
  map.renderTerrainLayers(ctx, camera);

  // Pass 3: Y-Sorted Dynamic Entities (Players, Enemies, Tree Trunks, Crates)
  // Sort entities by their ground contact point (feet)
  entities.sort((a, b) => {
    const footA = a.y + a.height;
    const footB = b.y + b.height;
    return footA - footB;
  });

  for (const entity of entities) {
    entity.draw(ctx, camera);
  }

  // Pass 4: Overhead Canopies and Roofs (always renders in front of characters)
  map.renderCanopyLayers(ctx, camera);
}

```

---

### 4. Modular Sprite Paper-Doll Systems and Frame Cadence

#### Where the Code Typically Breaks Standards

1. **Combinatorial Asset Overhead:** Creating single, pre-merged sprite sheets for every combination of character, armor, and weapon quickly becomes unsustainable.


2. **Fixed Layer Ordering:** Using a static layer order breaks when the character turns. A weapon drawn on top of the character works when facing South, but appears attached to their chest when facing North.


3. **Repeated Canvas Drawing:** Drawing four to six individual layers for every character on every frame strains canvas performance.


4. **Uniform Animation Timings:** Running attacks on a uniform timer (e.g., 100 ms per frame) makes combat feel floaty and weightless.



#### The Production Fix (After)

* Standardize all asset frames to a uniform $48 \times 48$ pixel grid with matching anchor points.


* Vary attack timing: use a quick anticipation phase ($60\text{ ms} - 80\text{ ms}$), a fast active strike ($40\text{ ms} - 50\text{ ms}$), an impact hold ($150\text{ ms} - 180\text{ ms}$), and a recovery settle ($100\text{ ms}$).


* Reorder layers dynamically based on character orientation.


* Cache composite frames using an `OffscreenCanvas` to avoid redundant draw calls.



| Character Orientation | Layer 1 (Furthest Back) | Layer 2 | Layer 3 | Layer 4 (Foremost) |
| --- | --- | --- | --- | --- |
| **South (Facing Camera)** | Base Body | Armor Pants | Torso Armor | Hand Weapon

 |
| **North (Back to Camera)** | Hand Weapon | Base Body | Armor Pants | Torso Armor

 |
| **East / West (Side Profiles)** | Off-hand Item | Base Body | Armor/Clothes | Main Weapon |

```javascript
class PaperDollCompositor {
  constructor(width = 48, height = 48) {
    this.width = width;
    this.height = height;
    this.buffer = new OffscreenCanvas(width, height);
    this.bufferCtx = this.buffer.getContext('2d', { alpha: true });
    this.bufferCtx.imageSmoothingEnabled = false;
  }

  bake(direction, equipment, frameCol, row) {
    this.bufferCtx.clearRect(0, 0, this.width, this.height);

    // Dynamic layer ordering based on orientation
    let drawOrder = [equipment.body, equipment.legs, equipment.torso, equipment.weapon];
    if (direction === 'north') {
      // Weapon renders behind character when facing up
      drawOrder = [equipment.weapon, equipment.body, equipment.legs, equipment.torso];
    }

    const srcX = frameCol * this.width;
    const srcY = row * this.height;

    for (const sheet of drawOrder) {
      if (sheet) {
        this.bufferCtx.drawImage(
          sheet,
          srcX, srcY, this.width, this.height,
          0, 0, this.width, this.height
        );
      }
    }
    return this.buffer;
  }
}

```

---

### 5. Node.js Real-Time Multiplayer Networking

#### Where the Code Typically Breaks Standards

1. **Network Packet Flooding:** Emitting WebSocket events directly inside `window.addEventListener('keydown')` sends duplicate packets at the operating system's key-repeat rate, overloading the Node.js event loop.


2. **Client-Authoritative Movement:** Letting clients dictate their own position coordinates (`socket.emit('playerMoved', { x, y })`) leads to desynchronization between players.


3. **Timer Drift on the Server:** Using a plain `setInterval(update, 16)` causes physical calculations to drift when the Node.js event loop experiences I/O delays.



#### The Anti-Pattern (Before)

```javascript
// BUG: DOM event flooding, client-authoritative state, unthrottled networking
window.addEventListener('keydown', (e) => {
  player.x += 5; // Client decides its own position
  socket.emit('move', { x: player.x, y: player.y }); // Floods server with hundreds of packets
});

```

#### The Production Fix (After)

##### Client-Side Input Throttling with Local Prediction

Sample inputs into an active state map and transmit them at a steady $60\text{ Hz}$ tick rate:

```javascript
const inputMap = { up: false, down: false, left: false, right: false };
let sequenceNumber = 0;
const pendingInputs = [];

window.addEventListener('keydown', (e) => setKey(e.code, true));
window.addEventListener('keyup', (e) => setKey(e.code, false));

function setKey(code, state) {
  if (code === 'KeyW') inputMap.up = state;
  if (code === 'KeyS') inputMap.down = state;
  if (code === 'KeyA') inputMap.left = state;
  if (code === 'KeyD') inputMap.right = state;
}

// Fixed-rate client network dispatch (60Hz)
setInterval(() => {
  sequenceNumber++;
  const payload = {
    seq: sequenceNumber,
    axes: {
      x: (inputMap.right ? 1 : 0) - (inputMap.left ? 1 : 0),
      y: (inputMap.down ? 1 : 0) - (inputMap.up ? 1 : 0)
    }
  };

  // Predict local movement immediately
  applyMovement(localPlayer, payload.axes, 1 / 60);
  pendingInputs.push(payload);

  socket.emit('input:tick', payload);
}, 1000 / 60);

// Server reconciliation
socket.on('server:state', (state) => {
  localPlayer.x = state.authoritativeX;
  localPlayer.y = state.authoritativeY;

  // Discard processed inputs and replay unacknowledged actions
  const remaining = pendingInputs.filter(item => item.seq > state.lastAckSequence);
  for (const input of remaining) {
    applyMovement(localPlayer, input.axes, 1 / 60);
  }
});

```

##### Server-Authoritative Simulation Loop (`server.js`)

Use a high-resolution time accumulator on the Node.js server rather than relying on `setInterval` directly:

```javascript
const TICK_RATE = 60;
const FIXED_STEP_MS = 1000 / TICK_RATE;
let lastTick = performance.now();
let accumulator = 0;

function serverLoop() {
  const now = performance.now();
  const delta = now - lastTick;
  lastTick = now;
  accumulator += delta;

  // Run simulation on a fixed timestep
  while (accumulator >= FIXED_STEP_MS) {
    for (const [id, player] of world.players.entries()) {
      while (player.inputQueue.length > 0) {
        const input = player.inputQueue.shift();
        resolveAuthoritativeMovement(player, input.axes, FIXED_STEP_MS / 1000);
        player.lastProcessedSeq = input.seq;
      }
    }
    accumulator -= FIXED_STEP_MS;
  }

  // Broadcast world snapshots to clients
  broadcastSnapshot(world);
  setImmediate(serverLoop);
}
serverLoop();

```

---

### How to Inspect and Debug Your Codebase Directly

If you would like a line-by-line review of your actual project code, you can:

1. Make `[https://github.com/SaadSatter/oath_and_ember](https://github.com/SaadSatter/oath_and_ember)` temporarily public on GitHub; or
2. Paste your primary game loop, movement script, or server file (`server.js`, `player.js`, or map rendering code) directly here for immediate line-by-line debugging.