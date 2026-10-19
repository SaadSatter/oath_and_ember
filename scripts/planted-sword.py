"""Draw the wooden practice sword standing upright in the grave's soil.

Hand-drawn in the palette of wooden_sword.png (the item's own colours), so the
prop matches the inventory icon. Output: assets/environment/story/sword_planted.png
and a copy in Images/Sprites/Story_Props.
"""
from PIL import Image

O = (44, 34, 26, 255)        # outline
L = (222, 180, 120, 255)     # light wood
M = (184, 134, 82, 255)      # mid wood
D = (150, 104, 62, 255)      # dark wood
G = (106, 73, 46, 255)       # grip
g = (72, 48, 36, 255)        # grip shadow / wrap
C = (122, 80, 44, 255)       # crossguard
c = (150, 102, 58, 255)      # crossguard light
S = (92, 62, 40, 255)        # soil
s = (120, 84, 54, 255)       # soil light
_ = None
rows = [
    "....OOO....",
    "...OcCCO...",
    "...OCCCO...",
    "....OGO....",
    "....OgO....",
    "....OGO....",
    "....OgO....",
    "....OGO....",
    "OOOOOOOOOOO",
    "OccccccccCO",
    "OCCCCCCCCCO",
    "OOOOOOOOOOO",
    "...OLMDO...",
    "...OLMDO...",
    "...OLMDO...",
    "...OLMDO...",
    "...OLMDO...",
    "...OLMDO...",
    "...OLMDO...",
    "...OLMDO...",
    "...OLMDO...",
    "...OLMDO...",
    "...OLMDO...",
    "...OLMDO...",
    "..sOLMDOs..",
    ".sSSSSSSSs.",
    "..SSSSSSS..",
]
key = {"O": O, "L": L, "M": M, "D": D, "G": G, "g": g, "C": C, "c": c, "S": S, "s": s}
w, h = len(rows[0]), len(rows)
im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
for y, row in enumerate(rows):
    assert len(row) == w, (y, row)
    for x, ch in enumerate(row):
        if ch in key:
            im.putpixel((x, y), key[ch])
for out in (
    "apps/client/public/assets/environment/story/sword_planted.png",
    "Images/Sprites/Story_Props/sword_planted.png",
):
    im.save(out)
print(w, h)
