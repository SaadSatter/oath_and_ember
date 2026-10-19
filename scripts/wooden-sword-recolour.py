# Turn PixelLab's steel practice sword into the wooden one Alden gave Sieg:
# only the blade's steel greys and the brass guard are recoloured, tone for
# tone, to wood. Shape, outline and grip stay exactly as generated.
#   python3 scripts/wooden-sword-recolour.py Images/Sprites/Story_Props/wooden_sword_source.png Images/Sprites/Story_Props/wooden_sword.png
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
WOOD = {
    (201, 221, 229): (222, 180, 120),  # blade highlight
    (154, 189, 213): (204, 160, 102),
    (146, 160, 163): (184, 134, 82),  # blade mid tone
    (98, 138, 166): (170, 122, 74),
    (135, 130, 107): (150, 104, 62),
    (83, 110, 115): (128, 86, 50),  # blade shadow
    (88, 83, 90): (112, 74, 44),
    (226, 174, 53): (122, 80, 44),  # guard: darker wood
    (245, 206, 69): (150, 102, 58),
}
im = Image.open(src).convert("RGBA")
px = im.load()
for y in range(im.height):
    for x in range(im.width):
        c = px[x, y]
        if c[3] and c[:3] in WOOD:
            px[x, y] = (*WOOD[c[:3]], c[3])
im.save(out)
