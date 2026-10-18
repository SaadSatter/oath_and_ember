"""Build Alden's magic shop: the ground floor (HOUSE_INTERIOR) and upstairs
(HOUSE_UPPER).

Rooms are laid out with the main house's own wall/floor tiles (the same tile
ids its Tiled interior uses), so walls, trims and floor match the old house.
Furniture comes from the house atlas, the Craftpix magical guild atlas (same
publisher and style) and PixelLab story props. Source pixels are copied, never
repainted; the potion shelves are composites (bottles from the house atlas
stood on its empty shelf, some with hue-rotated liquid).

Outputs:
  apps/client/public/assets/environment/magic-shop/ground.png, upper.png
      1x room backdrops (floor, walls, windows, rugs and floor decals)
  apps/client/public/assets/environment/magic-shop/props.png
      1x atlas of every standing prop
  packages/shared/src/magicShop.json
      world layout (2 world units per source pixel): props, collision, points

Run: python3 scripts/build-magic-shop.py
"""
import colorsys
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
HOUSE = ROOT / "apps/client/public/assets/environment/main-house"
GUILD = ROOT / "Images/Sprites/Map Sprites, Top Down/Guild or magical building/Tiled_files"
PROPS = ROOT / "Images/Sprites/Story_Props"
OUT = ROOT / "apps/client/public/assets/environment/magic-shop"
SHARED = ROOT / "packages/shared/src/magicShop.json"
T = 16  # source tile
S = 2  # world units per source pixel

walls_floor = Image.open(HOUSE / "walls_floor.png").convert("RGBA")
doors = Image.open(HOUSE / "Doors_windows_animation.png").convert("RGBA")
house = Image.open(HOUSE / "Interior.png").convert("RGBA")
guild = Image.open(GUILD / "Interior_objects.png").convert("RGBA")
cauldron = Image.open(PROPS / "cauldron.png").convert("RGBA")


def gid_tile(gid):
    """A tile by its id in the house interior map (firstgid 1 / 555)."""
    if gid >= 555:
        n, sheet = gid - 555, doors
    else:
        n, sheet = gid - 1, walls_floor
    cols = sheet.width // T
    x, y = (n % cols) * T, (n // cols) * T
    return sheet.crop((x, y, x + T, y + T))


# --- Room shell -------------------------------------------------------------
# The tile ids the house interior map uses for a plain rectangular room.
TOP_PAD = (134, 135, 136)
CREAM = (18, 24, 16)
STONE_A = (20, (35, 102, 69, 35), 27)
STONE_B = (31, (46, 113, 80, 46), 38)
SIDE = (14, 12)  # left / right trim beside the floor
BOTTOM = (48, 2, 49)
DOOR = (140, 141, 142)
DOOR_PAD = (151, 152, 153)
BOTTOM_PAD = 157
FLOOR = 104
FLOOR_VARIANTS = (105, 106, 107, 117)
WINDOW = ((570, 571), (587, 588))


def room(cols, floor_rows, left, door_col=None, windows=()):
    """Paint a room shell. `left` is the first wall column in tiles; the top
    padding row is tile row 4, the cream band row 5, stone rows 6-7, the floor
    starts at row 8. Returns the backdrop image (26 x 22 tiles)."""
    img = Image.new("RGBA", (26 * T, 22 * T), (0, 0, 0, 0))
    put = lambda gid, c, r: img.alpha_composite(gid_tile(gid), (c * T, r * T))
    right = left + cols - 1
    bottom = 8 + floor_rows
    for c in range(left, right + 1):
        # Floor runs under the wall face too, as in the house's own map.
        for r in range(5, bottom + 1):
            seed = (c * 7 + r * 13) % 23
            put(FLOOR_VARIANTS[seed % 4] if seed < 3 else FLOOR, c, r)
    for c in range(left - 1, right + 2):
        put(TOP_PAD[0 if c < left else 2 if c > right else 1], c, 4)
        put(BOTTOM_PAD, c, bottom + 1)
    for i, c in enumerate(range(left, right + 1)):
        edge = 0 if c == left else 2 if c == right else 1
        put(CREAM[edge], c, 5)
        put(STONE_A[edge] if edge != 1 else STONE_A[1][i % 4], c, 6)
        put(STONE_B[edge] if edge != 1 else STONE_B[1][i % 4], c, 7)
        put(BOTTOM[edge], c, bottom)
    for r in range(8, bottom):
        put(SIDE[0], left, r)
        put(SIDE[1], right, r)
    for r in range(5, bottom + 1):
        put(147, left - 1, r)
        img.alpha_composite(
            gid_tile(147).transpose(Image.FLIP_LEFT_RIGHT),
            ((right + 1) * T, r * T),
        )
        put(147, right + 1, r)
    # Left padding column: the mirrored right one.
    for r in range(5, bottom + 1):
        tile = gid_tile(147).transpose(Image.FLIP_LEFT_RIGHT)
        img.paste(Image.new("RGBA", (T, T)), ((left - 1) * T, r * T))
        img.alpha_composite(tile, ((left - 1) * T, r * T))
    if door_col is not None:
        for i, gid in enumerate(DOOR):
            put(gid, door_col - 1 + i, bottom)
        for i, gid in enumerate(DOOR_PAD):
            put(gid, door_col - 1 + i, bottom + 1)
    for c in windows:
        for dy, row in enumerate(WINDOW):
            for dx, gid in enumerate(row):
                put(gid, c + dx, 6 + dy)
    return img


# --- Prop art ---------------------------------------------------------------
def crop(sheet, x, y, w, h):
    return sheet.crop((x, y, x + w, y + h))


def trim(img):
    return img.crop(img.getbbox())


def hue(img, shift):
    """Rotate the hue of saturated pixels (the potion liquid)."""
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > 0.45 and v > 0.3:
                r2, g2, b2 = colorsys.hsv_to_rgb((h + shift) % 1, s, v)
                px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
    return out


green = trim(crop(house, 176, 382, 16, 18))
red = trim(crop(house, 191, 381, 16, 18))
small = trim(crop(house, 191, 399, 16, 17))
book_a, book_b = trim(crop(guild, 1, 1, 15, 14)), trim(crop(guild, 17, 2, 13, 12))
bottles = [
    green, red, small, hue(green, 0.55), hue(red, 0.75), hue(small, 0.5),
    hue(green, 0.35), hue(red, 0.12),
]


def potion_shelf(variant):
    """The house's empty shelf, stocked with bottles on both boards."""
    shelf = crop(house, 80, 100, 48, 54).copy()
    boards = (25, 43)  # y of each board's top surface in the shelf frame
    order = bottles[variant:] + bottles[:variant]
    k = 0
    for board in boards:
        x = 4 + (variant % 2) * 2
        while x < 42:
            b = order[k % len(order)]
            if x + b.width > 45:
                break
            shelf.alpha_composite(b, (x, board - b.height + 1))
            x += b.width + 1
            k += 1
    shelf.alpha_composite(book_a if variant % 2 else book_b, (14, 7 - 12 + 2))
    return shelf


def round_rug():
    """The round rug without the separate corner tiles that touch it."""
    rug = crop(house, 27, 263, 93, 82).copy()
    clear = Image.new("RGBA", (16, 12))
    for x in (0, 77):
        for y in (0, 74):
            rug.paste(clear, (x, y))
    return trim(rug)


ART = {
    # house atlas
    "stairs-up": crop(house, 17, 24, 45, 61),
    "bed": crop(house, 66, 15, 25, 41),
    "cabinet": crop(house, 101, 17, 21, 29),
    "nightstand": crop(house, 138, 22, 15, 21),
    "barrel": crop(house, 172, 17, 18, 26),
    "potion-table": crop(house, 99, 51, 28, 40),
    "pantry": crop(house, 21, 100, 53, 57),
    "bookshelf": crop(house, 178, 96, 28, 46),
    "dining": crop(house, 136, 145, 65, 57),
    "armchair": crop(house, 26, 164, 20, 38),
    "herbs": crop(house, 146, 217, 24, 33),
    "garlic": crop(house, 188, 203, 16, 42),
    "rug-round": round_rug(),
    "rug-red": crop(house, 141, 264, 54, 64),
    "plant-house": crop(house, 86, 376, 18, 19),
    # guild atlas
    "magic-circle": crop(guild, 57, 11, 64, 47),
    "stairs-down": crop(guild, 10, 89, 43, 22),
    "guild-cabinet": crop(guild, 74, 99, 49, 60),
    "guild-books": crop(guild, 267, 99, 48, 60),
    "guild-books-2": crop(guild, 331, 99, 48, 60),
    "research-board": crop(guild, 98, 168, 43, 51),
    "research-board-2": crop(guild, 197, 171, 43, 51),
    "rug-guild": crop(guild, 6, 227, 67, 71),
    "magic-desk": crop(guild, 219, 226, 58, 35),
    "writing-desk": crop(guild, 299, 225, 58, 36),
    "counter": crop(guild, 276, 273, 58, 30),
    "display-table": crop(guild, 155, 269, 49, 27),
    "banner": crop(guild, 177, 308, 47, 44),
    "plant-blue": crop(guild, 227, 307, 20, 35),
    "plant-purple": crop(guild, 266, 307, 19, 36),
    "chest": crop(guild, 244, 356, 25, 22),
    "chest-2": crop(guild, 275, 358, 25, 22),
    "stool": crop(guild, 160, 356, 14, 23),
    # PixelLab story prop
    "cauldron": trim(cauldron),
    # composites
    "potion-shelf-1": potion_shelf(0),
    "potion-shelf-2": potion_shelf(3),
    "potion-shelf-3": potion_shelf(5),
}
# Floor decals and wall hangings sit under the heroes; the rest depth-sort.
BACKDROP = {"rug-round", "rug-red", "rug-guild", "magic-circle", "stairs-down"}

# --- Layouts ----------------------------------------------------------------
# Each prop: (art, world x of left edge, world y of its ground line, collision
# footprint height in world units (0 = walkable), optional inset).
# World units: 2 per source pixel; floor tile = 32.
LEFT_GROUND, COLS_GROUND, ROWS_GROUND = 3, 20, 10
LEFT_UPPER, COLS_UPPER, ROWS_UPPER = 5, 16, 8


def wx(col):
    return col * T * S


FLOOR_TOP = 8 * T * S  # 256

GROUND = [
    # Back wall, west to east: stairs, pantry, window, Alden's books and
    # research board, then the shop's potion shelves.
    ("stairs-up", wx(3), 290, 34),
    ("pantry", wx(6) - 4, 290, 30),
    ("garlic", wx(9) + 6, 226, 0),
    ("guild-books", wx(12), 290, 30),
    ("research-board", wx(15) + 2, 284, 26),
    ("potion-shelf-1", wx(17), 290, 30),
    ("potion-shelf-2", wx(20), 290, 30),
    # Living area (west)
    ("rug-round", wx(4), 540, 0),
    ("dining", wx(4) + 12, 516, 60),
    ("armchair", wx(9) - 20, 420, 36),
    ("plant-house", wx(3) + 8, 568, 20),
    # Alden's workshop (middle): magic table, cauldron, the healing circle
    ("magic-desk", wx(10) + 4, 362, 40),
    ("herbs", wx(14) + 2, 222, 0),
    ("cauldron", wx(14) + 2, 374, 40, 12),
    ("magic-circle", wx(10) + 14, 528, 0),
    # The shop (east): counter facing the front door, potions behind it
    ("counter", wx(17) + 16, 430, 44),
    ("potion-table", wx(21) - 6, 434, 44, 6),
    ("chest", wx(16) - 6, 566, 26),
    ("plant-blue", wx(22) - 12, 576, 22),
]
UPPER = [
    ("stairs-down", wx(5) + 8, 312, 0),
    ("rug-red", wx(7), 480, 0),
    ("rug-guild", wx(10) + 16, 500, 0),
    # Coco's corner (west)
    ("bed", wx(8) + 8, 372, 70),
    ("nightstand", wx(10), 300, 26),
    ("writing-desk", wx(11), 312, 36),
    ("stool", wx(12) + 14, 346, 20),
    ("cabinet", wx(5) + 8, 500, 30),
    # Sieg's guest bed (middle)
    ("bed", wx(13), 470, 70),
    ("chest", wx(14) + 22, 470, 26),
    # Alden's study (east)
    ("research-board-2", wx(15) + 2, 296, 26),
    ("guild-books", wx(18), 300, 30),
    ("bed", wx(19) + 8, 420, 70),
    ("chest-2", wx(17) + 10, 440, 26),
    ("plant-purple", wx(20) - 2, 506, 22),
]


def bake(props, backdrop, scene):
    atlas_items, out_props, solids = [], [], []
    for i, (art, x, ground, foot, *rest) in enumerate(props):
        img = ART[art]
        w, h = img.width * S, img.height * S
        top = ground - h
        if art in BACKDROP:
            backdrop.alpha_composite(img, (x // S, top // S))
        else:
            atlas_items.append(art)
            out_props.append({"id": f"{art}-{i}", "art": art, "x": x, "y": top,
                              "w": w, "h": h, "groundY": ground})
        if foot:
            inset = rest[0] if rest else 4
            solids.append({"x": x + inset, "y": ground - foot,
                           "w": w - 2 * inset, "h": foot})
    return out_props, solids


def shell_solids(left, cols, rows):
    x0, x1 = left * T * S, (left + cols) * T * S
    y1 = (8 + rows) * T * S
    return [
        {"x": 0, "y": 0, "w": 832, "h": FLOOR_TOP},
        {"x": 0, "y": 0, "w": x0, "h": 704},
        {"x": x1, "y": 0, "w": 832 - x1, "h": 704},
        # The bottom trim tile is mostly floor; heroes may step onto it.
        {"x": 0, "y": y1 + 16, "w": 832, "h": 704 - y1 - 16},
    ]


OUT.mkdir(parents=True, exist_ok=True)
ground_img = room(COLS_GROUND, ROWS_GROUND, LEFT_GROUND, door_col=19,
                  windows=(9,))
upper_img = room(COLS_UPPER, ROWS_UPPER, LEFT_UPPER, windows=(8, 13))
ground_props, ground_solids = bake(GROUND, ground_img, "HOUSE_INTERIOR")
upper_props, upper_solids = bake(UPPER, upper_img, "HOUSE_UPPER")
ground_img.save(OUT / "ground.png")
upper_img.save(OUT / "upper.png")

# Pack the atlas: one frame per art, in a single row-wrapped sheet.
used = sorted({p["art"] for p in ground_props + upper_props})
frames, x, y, row_h, W = {}, 0, 0, 0, 512
for art in used:
    img = ART[art]
    if x + img.width > W:
        x, y, row_h = 0, y + row_h + 1, 0
    frames[art] = [x, y, img.width, img.height]
    x += img.width + 1
    row_h = max(row_h, img.height)
atlas = Image.new("RGBA", (W, y + row_h))
for art, (fx, fy, _, _) in frames.items():
    atlas.alpha_composite(ART[art], (fx, fy))
atlas.save(OUT / "props.png")

floor_bottom_ground = (8 + ROWS_GROUND) * T * S
door_x = 19 * T * S + T  # centre of the door tile
layout = {
    "frames": frames,
    "scenes": {
        "HOUSE_INTERIOR": {
            "name": "Alden's Magic Shop",
            "backdrop": "ground",
            "width": 832, "height": 704,
            "cameraBounds": {"x": wx(LEFT_GROUND) - 32, "y": 128,
                             "w": COLS_GROUND * 32 + 64,
                             "h": floor_bottom_ground - 128 + 64},
            "spawn": {"x": door_x, "y": floor_bottom_ground - 30},
            "points": {
                "leave": {"x": door_x, "y": floor_bottom_ground - 18},
                "upstairs": {"x": wx(3) + 46, "y": 310},
            },
            "doorInteractionBounds": {"x": door_x - 40, "y": floor_bottom_ground - 64,
                                      "w": 80, "h": 80},
            "solids": shell_solids(LEFT_GROUND, COLS_GROUND, ROWS_GROUND) + ground_solids,
            "props": ground_props,
        },
        "HOUSE_UPPER": {
            "name": "Alden's Magic Shop · Upstairs",
            "backdrop": "upper",
            "width": 832, "height": 704,
            "cameraBounds": {"x": wx(LEFT_UPPER) - 32, "y": 128,
                             "w": COLS_UPPER * 32 + 64,
                             "h": (8 + ROWS_UPPER) * 32 - 128 + 64},
            "spawn": {"x": wx(5) + 50, "y": 340},
            "points": {"downstairs": {"x": wx(5) + 50, "y": 300}},
            "solids": shell_solids(LEFT_UPPER, COLS_UPPER, ROWS_UPPER) + upper_solids,
            "props": upper_props,
        },
    },
}
SHARED.write_text(json.dumps(layout, indent=1) + "\n")
print("ground", len(ground_props), "props;", "upper", len(upper_props), "props;",
      "atlas", atlas.size)
