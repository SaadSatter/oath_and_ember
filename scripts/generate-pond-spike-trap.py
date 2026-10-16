# Original pixel-art floor spike trap for the Mirror Pond east entrance.
# Drawn procedurally (no third-party art): a 32x32 iron floor plate with three
# spike holes, in four frames: retracted, tips peeking (harmless warning),
# half raised and fully raised. Rebuild with: python3 scripts/generate-pond-spike-trap.py
from PIL import Image, ImageDraw
import pathlib

OUT = pathlib.Path("apps/client/public/assets/environment/mirror-pond/spike-trap.png")
SIZE = 32
HEIGHTS = [0, 4, 9, 14]  # spike height in pixels for each frame

PLATE = (92, 96, 108, 255)
PLATE_DARK = (58, 61, 72, 255)
PLATE_LIGHT = (128, 133, 146, 255)
RIVET = (150, 154, 166, 255)
HOLE = (24, 25, 31, 255)
HOLE_RIM = (44, 46, 55, 255)
STEEL_LIGHT = (214, 218, 226, 255)
STEEL_MID = (150, 156, 168, 255)
STEEL_DARK = (78, 82, 94, 255)
OUTLINE = (32, 33, 40, 255)
TIP = (250, 250, 252, 255)

# Back hole first so front spikes overlap it.
HOLES = [(16, 15), (8, 26), (24, 26)]


def plate(d: ImageDraw.ImageDraw):
    d.rectangle([1, 3, 30, 30], fill=PLATE_DARK)
    d.rectangle([2, 4, 29, 29], fill=PLATE)
    d.line([2, 4, 29, 4], fill=PLATE_LIGHT)
    d.line([2, 4, 2, 29], fill=PLATE_LIGHT)
    d.line([3, 29, 29, 29], fill=PLATE_DARK)
    for x, y in [(4, 6), (27, 6), (4, 27), (27, 27)]:
        d.point((x, y), fill=RIVET)


def hole(d: ImageDraw.ImageDraw, cx: int, cy: int):
    d.ellipse([cx - 4, cy - 2, cx + 4, cy + 2], fill=HOLE_RIM)
    d.ellipse([cx - 3, cy - 1, cx + 3, cy + 1], fill=HOLE)


def spike(d: ImageDraw.ImageDraw, cx: int, cy: int, h: int):
    if h <= 0:
        return
    for row in range(h):
        y = cy - row
        half = max(0, round(3 * (1 - row / h)))
        for dx in range(-half - 1, half + 2):
            x = cx + dx
            if abs(dx) == half + 1:
                colour = OUTLINE
            elif dx < 0:
                colour = STEEL_LIGHT
            elif dx == 0:
                colour = STEEL_MID
            else:
                colour = STEEL_DARK
            d.point((x, y), fill=colour)
    d.point((cx, cy - h), fill=OUTLINE)
    d.point((cx, cy - h + 1), fill=TIP)


def frame(height: int) -> Image.Image:
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    plate(d)
    for cx, cy in HOLES:
        hole(d, cx, cy)
        spike(d, cx, cy, height)
    return im


sheet = Image.new("RGBA", (SIZE * len(HEIGHTS), SIZE), (0, 0, 0, 0))
for i, h in enumerate(HEIGHTS):
    sheet.paste(frame(h), (i * SIZE, 0))
OUT.parent.mkdir(parents=True, exist_ok=True)
sheet.save(OUT)
print(f"wrote {OUT} ({len(HEIGHTS)} frames of {SIZE}x{SIZE})")
