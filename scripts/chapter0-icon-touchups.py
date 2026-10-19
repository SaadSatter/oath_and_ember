# Small hand touch-ups to two PixelLab item icons (provenance-chapter0.json):
#  - star-drawing: the drawing is of seven stars around a DARK circle; the
#    generated circle came out light, so its light pixels are inked over.
#  - strange-cloth: the generated emblem is a faint smudge; a small silver
#    symbol is stitched on in its place. It means nothing yet (by design).
#   python3 scripts/chapter0-icon-touchups.py <source dir> <out dir>
import sys, math
from PIL import Image
src, out = sys.argv[1], sys.argv[2]

im = Image.open(f"{src}/star-drawing.png").convert("RGBA")
px = im.load()
# The light disc sits inside the ring of stars: find its centre.
light = [(x, y) for y in range(im.height) for x in range(im.width)
         if px[x, y][3] and sum(px[x, y][:3]) > 660 and 14 < x < 34 and 14 < y < 36]
cx = sum(x for x, _ in light) / len(light)
cy = sum(y for _, y in light) / len(light)
r = math.sqrt(len(light) / math.pi)
for y in range(im.height):
    for x in range(im.width):
        d = math.hypot(x - cx, y - cy)
        if px[x, y][3] and d <= r + 0.5:
            px[x, y] = (34, 26, 22, 255) if d <= r - 1 else (70, 52, 38, 255)
im.save(f"{out}/star-drawing.png")

im = Image.open(f"{src}/strange-cloth.png").convert("RGBA")
px = im.load()
cloth = [(x, y) for y in range(im.height) for x in range(im.width) if px[x, y][3]]
ccx = round(sum(x for x, _ in cloth) / len(cloth))
ccy = round(sum(y for _, y in cloth) / len(cloth))
# Clear the old smudge (greys) back to the cloth's own colour.
base = max(((px[x, y][:3]), 1) for x, y in cloth)[0]
counts = {}
for x, y in cloth:
    counts[px[x, y][:3]] = counts.get(px[x, y][:3], 0) + 1
base = max(counts, key=counts.get)
for x, y in cloth:
    c = px[x, y]
    if abs(c[0] - c[2]) < 12 and sum(c[:3]) < 450:
        px[x, y] = (*base, 255)
# A small symbol: a ring crossed by a long stroke, with two little arcs.
SILVER, SHADE = (124, 134, 172, 255), (78, 86, 120, 255)
glyph = [
    "....#....",
    "...###...",
    "..#.#.#..",
    ".#..#..#.",
    "##..#..##",
    ".#..#..#.",
    "..#.#.#..",
    "...###...",
    "....#....",
]
for gy, row in enumerate(glyph):
    for gx, ch in enumerate(row):
        if ch == "#":
            x, y = ccx - 4 + gx, ccy - 4 + gy
            if px[x, y][3]:
                px[x, y] = SILVER if (gx + gy) % 3 else SHADE
im.save(f"{out}/strange-cloth.png")
