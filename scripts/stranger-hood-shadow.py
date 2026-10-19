# Hide the stranger's face in the shadow of her hood (the brief keeps her
# identity concealed). Only skin and eye pixels above the chin change, to the
# hood's own darkest violet; everything else is PixelLab's pixels.
#   python3 scripts/stranger-hood-shadow.py Images/Sprites/Story_NPCs/stranger/rotations Images/Sprites/Story_NPCs/stranger/hooded
import sys, os
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
FACE = {(205, 147, 127), (211, 165, 156), (232, 230, 227), (63, 29, 137)}
SHADOW, DEEP = (27, 18, 51, 255), (17, 14, 28, 255)
CHIN = 28  # rows from here down stay lit: a pale chin under the hood
os.makedirs(out, exist_ok=True)
for name in ("south", "east", "north", "west"):
    im = Image.open(f"{src}/{name}.png").convert("RGBA")
    px = im.load()
    for y in range(CHIN):
        for x in range(im.width):
            if px[x, y][3] and px[x, y][:3] in FACE:
                px[x, y] = DEEP if y < 22 else SHADOW
    im.save(f"{out}/{name}.png")
