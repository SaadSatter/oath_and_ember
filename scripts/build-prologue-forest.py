"""Build the prologue's forest maps: the trail (PROLOGUE_TRAIL) and the ambush
clearing (PROLOGUE_CLEARING).

Ground comes from the main house exterior's own tiles: its dirt base and the
grass blob tiles, chosen per tile from which of the four tile corners are
grass, so paths get the same soft grass borders as the road by the shop.
Trees are the house's tree sprites; rocks, bushes, stumps and flowers come
from the exterior atlas; the merchant cart is a PixelLab story prop. Pixels
are copied, never repainted.

Walkable ground is decided per tile (paths, the cart meadow and the clearing
oval); every other tile is dense forest and solid. Collision is the forest
tiles merged into rectangles plus a few prop footprints, so art and collision
come from the same layout.

Outputs:
  apps/client/public/assets/environment/prologue-forest/{trail,clearing}.png
  apps/client/public/assets/environment/prologue-forest/props.png
  packages/shared/src/prologueForest.json
Run: python3 scripts/build-prologue-forest.py
"""
import json
import math
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
HOUSE = ROOT / "apps/client/public/assets/environment/main-house"
TREES = ROOT / "apps/client/public/assets/environment/trees"
STORY = ROOT / "apps/client/public/assets/environment/story"
OUT = ROOT / "apps/client/public/assets/environment/prologue-forest"
SHARED = ROOT / "packages/shared/src/prologueForest.json"
T, S = 16, 2  # source tile px, world units per source px
WT = T * S  # 32 world units per tile

exterior = Image.open(HOUSE / "exterior.png").convert("RGBA")


def ext_tile(gid):
    n = gid - 757
    x, y = (n % 17) * T, (n // 17) * T
    return exterior.crop((x, y, x + T, y + T))


def crop(x, y, w, h):
    return exterior.crop((x, y, x + w, y + h))


DIRT = 1116
# Grass tile for each corner pattern (TL, TR, BL, BR grass?).
GRASS = {
    (1, 1, 1, 1): 1065,
    (0, 0, 1, 1): 1048, (1, 1, 0, 0): 1082,
    (1, 0, 1, 0): 1066, (0, 1, 0, 1): 1064,
    (1, 1, 1, 0): 1050, (1, 1, 0, 1): 1051,
    (1, 0, 1, 1): 1067, (0, 1, 1, 1): 1068,
    (0, 0, 0, 1): 1047, (0, 0, 1, 0): 1049,
    (0, 1, 0, 0): 1081, (1, 0, 0, 0): 1083,
}

TREE_ART = {}
for name, origin in [("Tree1", 99 / 128), ("Tree2", 62 / 64), ("Tree3", 51 / 64),
                     ("Moss_tree1", 97 / 128), ("Moss_tree2", 60 / 64),
                     ("Moss_tree3", 50 / 64)]:
    TREE_ART[name] = (Image.open(TREES / f"{name}.png").convert("RGBA"), origin)
BIG_TREES = ["Tree1", "Moss_tree1"]
SMALL_TREES = ["Tree2", "Tree3", "Moss_tree2", "Moss_tree3"]

DECOR = {
    "bush": crop(65, 449, 29, 29),
    "fern": crop(101, 454, 23, 21),
    "shrub": crop(132, 452, 27, 24),
    "big-fern": crop(213, 438, 38, 36),
    "pine-bush": crop(18, 657, 45, 45),
    "pine-bush-2": crop(64, 673, 31, 29),
    "round-bush": crop(203, 624, 43, 44),
    "rock": crop(22, 472, 36, 34),
    "rock-2": crop(166, 456, 36, 34),
    "rock-small": crop(133, 488, 24, 20),
    "pebbles": crop(84, 519, 21, 18),
    "boulder": crop(82, 703, 42, 49),
    "stump": crop(191, 757, 31, 24),
    "stump-2": crop(212, 794, 39, 30),
    "broken-trunk": crop(228, 752, 25, 32),
    "log": crop(103, 677, 38, 24),
    "mushroom": crop(135, 629, 18, 21),
    "mushrooms": crop(99, 642, 25, 27),
    "mushrooms-2": crop(164, 658, 26, 27),
    "flowers": crop(97, 865, 13, 14),
    "flowers-2": crop(144, 865, 16, 15),
    "flowers-3": crop(49, 869, 14, 20),
    "grass-tuft": crop(66, 865, 12, 14),
    "crate": crop(119, 595, 15, 19),
    "crates": crop(119, 543, 27, 39),
    "barrel": crop(170, 623, 18, 26),
    "merchant-cart": Image.open(STORY / "merchant_cart.png").convert("RGBA"),
}
GROUND_DECOR = ["flowers", "flowers-2", "flowers-3", "grass-tuft", "pebbles",
                "fern", "mushroom"]
EDGE_DECOR = ["bush", "shrub", "big-fern", "pine-bush-2", "mushrooms",
              "mushrooms-2", "rock-small", "stump", "fern"]
FOREST_DECOR = ["pine-bush", "round-bush", "rock", "rock-2", "boulder",
                "stump-2", "broken-trunk", "log"]


def seg_dist(p, a, b):
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy or 1)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def path_dist(p, path):
    return min(seg_dist(p, path[i], path[i + 1]) for i in range(len(path) - 1))


class Area:
    """One forest map. `walk(x, y)` and `dirt(x, y)` are in tile units."""

    def __init__(self, name, cols, rows, walk, dirt, seed):
        self.name, self.cols, self.rows = name, cols, rows
        self.walk_at, self.dirt_at = walk, dirt
        self.rng = random.Random(seed)
        self.walkable = [[walk(c + 0.5, r + 0.5) for c in range(cols)] for r in range(rows)]
        self.props, self.solids, self.points = [], [], {}

    def is_walk(self, c, r):
        return 0 <= c < self.cols and 0 <= r < self.rows and self.walkable[r][c]

    def near_walk(self, c, r, d):
        return any(self.is_walk(c + dc, r + dr) for dc in range(-d, d + 1)
                   for dr in range(-d, d + 1))

    def backdrop(self):
        img = Image.new("RGBA", (self.cols * T, self.rows * T))
        grass = [[not self.dirt_at(c, r) for c in range(self.cols + 1)]
                 for r in range(self.rows + 1)]
        for r in range(self.rows):
            for c in range(self.cols):
                img.alpha_composite(ext_tile(DIRT), (c * T, r * T))
                key = (grass[r][c], grass[r][c + 1], grass[r + 1][c], grass[r + 1][c + 1])
                key = tuple(int(k) for k in key)
                gid = GRASS.get(key)
                if gid is None and any(key):
                    gid = 1065  # diagonal corners: keep it grass
                if gid:
                    img.alpha_composite(ext_tile(gid), (c * T, r * T))
        return img

    def prop(self, art, x, ground, foot=0, inset=4, origin=None, image=None):
        """Place art with its base at world (x centre, ground)."""
        img = image or DECOR[art]
        w, h = img.width * S, img.height * S
        top = ground - (origin * h if origin is not None else h)
        self.props.append({"art": art, "x": round(x - w / 2), "y": round(top),
                           "w": w, "h": h, "groundY": round(ground)})
        if foot:
            self.solids.append({"x": round(x - w / 2 + inset), "y": round(ground - foot),
                                "w": w - 2 * inset, "h": foot})

    def canopy_over_walk(self, c, r, half, up):
        return any(self.is_walk(c + dc, r - dr) for dc in range(-half, half + 1)
                   for dr in range(0, up + 1))

    def forest(self):
        """Trees and undergrowth over every non-walkable tile."""
        step = 2
        for r in range(-1, self.rows + 1, step):
            for c in range(-1, self.cols + 1, step):
                cc = c + self.rng.uniform(-0.6, 0.6)
                rr = r + self.rng.uniform(-0.4, 0.6)
                tc, tr = int(cc), int(rr)
                if self.is_walk(tc, tr) or self.is_walk(tc, tr + 1):
                    continue
                # A hero behind a trunk is drawn under its canopy, so no
                # canopy may hang over walkable ground.
                big = not self.canopy_over_walk(tc, tr, 2, 7)
                if big:
                    name = self.rng.choice(BIG_TREES)
                elif not self.canopy_over_walk(tc, tr, 1, 4):
                    name = self.rng.choice(SMALL_TREES)
                else:
                    self.prop(self.rng.choice(["pine-bush", "round-bush"]), cc * WT, rr * WT + 8)
                    continue
                art, origin = TREE_ART[name]
                self.prop(f"tree-{name}", cc * WT, rr * WT + 8, origin=origin, image=art)
        # Undergrowth along the forest edge, so trunks never float on grass.
        for r in range(self.rows):
            for c in range(self.cols):
                if self.is_walk(c, r) or not self.near_walk(c, r, 1):
                    continue
                if self.rng.random() < 0.45:
                    art = self.rng.choice(FOREST_DECOR if self.rng.random() < 0.3 else EDGE_DECOR)
                    self.prop(art, (c + 0.5) * WT + self.rng.uniform(-8, 8),
                              (r + 0.9) * WT)

    def ground_decor(self, density=0.08):
        for r in range(self.rows):
            for c in range(self.cols):
                if not self.is_walk(c, r) or self.dirt_at(c + 0.5, r + 0.5):
                    continue
                if self.rng.random() < density:
                    self.prop(self.rng.choice(GROUND_DECOR),
                              (c + 0.5) * WT + self.rng.uniform(-10, 10),
                              (r + 0.8) * WT)

    def forest_solids(self):
        """Merge non-walkable tiles into rectangles (row runs, then stacked)."""
        runs = {}
        for r in range(self.rows):
            c = 0
            while c < self.cols:
                if self.walkable[r][c]:
                    c += 1
                    continue
                start = c
                while c < self.cols and not self.walkable[r][c]:
                    c += 1
                runs.setdefault((start, c), []).append(r)
        rects = []
        for (c0, c1), rows in runs.items():
            rows.sort()
            top = prev = rows[0]
            for r in rows[1:] + [None]:
                if r is not None and r == prev + 1:
                    prev = r
                    continue
                rects.append({"x": c0 * WT, "y": top * WT,
                              "w": (c1 - c0) * WT, "h": (prev - top + 1) * WT})
                if r is not None:
                    top = prev = r
        return rects


def ellipse(cx, cy, rx, ry):
    return lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


# --- Trail: from the shop road (east) winding west and north to the clearing.
TRAIL_PATH = [(41, 12.5), (35, 12.5), (31, 9.5), (25, 10.5), (20, 15), (14, 15),
              (10, 10.5), (6, 7), (3.5, 3.5), (3.5, -1)]
CART = (24.5, 6.2)
in_meadow = ellipse(24.5, 7.4, 4.4, 3.0)
trail = Area(
    "PROLOGUE_TRAIL", 40, 24,
    walk=lambda x, y: path_dist((x, y), TRAIL_PATH) <= 2.2 or in_meadow(x, y),
    dirt=lambda x, y: path_dist((x, y), TRAIL_PATH) <= 1.15
    or ellipse(24.3, 8.4, 2.6, 1.3)(x, y),
    seed=7,
)
trail_img = trail.backdrop()
trail.forest()
trail.ground_decor(0.07)
# The abandoned cart, tipped over in its meadow, and the cargo it spilled.
trail.prop("merchant-cart", CART[0] * WT, CART[1] * WT + 50, foot=40, inset=22)
for art, x, y, foot in [("crates", 21.6, 8.3, 30), ("barrel", 27.4, 8.6, 22),
                        ("crate", 26.2, 9.4, 18)]:
    trail.prop(art, x * WT, y * WT, foot=foot)
trail.points = {
    "cart": {"x": round(CART[0] * WT), "y": round(CART[1] * WT + 70)},
    "crates": {"x": round(21.6 * WT), "y": round(8.3 * WT + 26)},
    "barrel": {"x": round(27.4 * WT), "y": round(8.6 * WT + 26)},
    "exit": {"x": round(3.5 * WT), "y": round(1.6 * WT)},
}
trail.spawn = {"x": round(38.5 * WT), "y": round(12.5 * WT)}

# --- Clearing: an open oval with one entrance (south-east) for the heroes and
# a northern deer path, shut by brambles, for Alden.
OVAL = ellipse(16, 11.6, 10.6, 7.2)
ENTRY = [(33, 19.5), (27.5, 16.5), (24, 15)]
NORTH = [(16, -1), (16, 4.6)]
clearing = Area(
    "PROLOGUE_CLEARING", 32, 24,
    walk=lambda x, y: OVAL(x, y) or path_dist((x, y), ENTRY) <= 2.0,
    dirt=lambda x, y: path_dist((x, y), ENTRY) <= 1.1
    or path_dist((x, y), NORTH) <= 1.0
    or ellipse(16, 12, 5.2, 3.2)(x, y),
    seed=11,
)
# The north path is drawn (dirt) but not walkable; brambles close it.
clearing_img = clearing.backdrop()
clearing.forest()
clearing.ground_decor(0.05)
for i, x in enumerate((14.6, 16, 17.4)):
    clearing.prop("pine-bush-2" if i % 2 else "round-bush", x * WT, 5.0 * WT)
clearing.points = {
    "north": {"x": 16 * WT, "y": round(3 * WT)},
    "centre": {"x": 16 * WT, "y": round(12 * WT)},
}
clearing.spawn = {"x": round(28.6 * WT), "y": round(17.4 * WT)}

OUT.mkdir(parents=True, exist_ok=True)
trail_img.save(OUT / "trail.png")
clearing_img.save(OUT / "clearing.png")

# Atlas of every art used.
arts = {}
for area in (trail, clearing):
    for p in area.props:
        if p["art"] not in arts:
            name = p["art"]
            arts[name] = TREE_ART[name[5:]][0] if name.startswith("tree-") else DECOR[name]
frames, x, y, row_h, W = {}, 0, 0, 0, 512
for name, img in sorted(arts.items(), key=lambda kv: -kv[1].height):
    if x + img.width > W:
        x, y, row_h = 0, y + row_h + 1, 0
    frames[name] = [x, y, img.width, img.height]
    x += img.width + 1
    row_h = max(row_h, img.height)
atlas = Image.new("RGBA", (W, y + row_h))
for name, (fx, fy, _, _) in frames.items():
    atlas.alpha_composite(arts[name], (fx, fy))
atlas.save(OUT / "props.png")


def scene(area, backdrop, name):
    w, h = area.cols * WT, area.rows * WT
    props = sorted(area.props, key=lambda p: p["groundY"])
    for i, p in enumerate(props):
        p["id"] = f"{p['art']}-{i}"
    return {
        "name": name, "backdrop": backdrop, "width": w, "height": h,
        "cameraBounds": {"x": 0, "y": 0, "w": w, "h": h},
        "spawn": area.spawn, "points": area.points,
        "solids": area.forest_solids() + area.solids,
        "props": props,
    }


SHARED.write_text(json.dumps({
    "frames": frames,
    "scenes": {
        "PROLOGUE_TRAIL": scene(trail, "trail", "Forest Trail"),
        "PROLOGUE_CLEARING": scene(clearing, "clearing", "Forest Clearing"),
    },
}, indent=1) + "\n")
print("trail", len(trail.props), "clearing", len(clearing.props), "atlas", atlas.size)
