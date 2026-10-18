# Erase the staff from Alden's south and north PixelLab rotations, giving the
# staff-less standing poses in Images/Sprites/Story_NPCs/alden/stand. Only
# staff pixels are cleared; where the staff doubled as the robe or boot
# outline, that edge is closed with the sprite's outline colour.
#   python3 scripts/alden-unstaff.py Images/Sprites/Story_NPCs/alden/rotations Images/Sprites/Story_NPCs/alden/stand
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
MASKS = {
  "south": lambda x,y: (y<=52 and x>=57) or (53<=y<=59 and x>=61) or (y>=60 and x>=56),
  "north": lambda x,y: (y<=48 and x>=58) or (49<=y<=53 and x>=59) or (54<=y<=61 and x>=62) or (y>=62 and x>=57),
}
OUTLINE=(13,10,11,255)
dark=lambda c: c[3] and sum(c[:3])<110
for n,m in MASKS.items():
    im=Image.open(f"{src}/{n}.png").convert("RGBA"); px=im.load(); W,H=im.size
    cut=[(x,y) for y in range(H) for x in range(W) if m(x,y) and px[x,y][3]]
    for p in cut: px[p]=(0,0,0,0)
    # Close the edge the staff used to outline.
    for x,y in cut:
        nb=[px[x+dx,y+dy] for dx,dy in((-1,0),(0,-1),(0,1)) if 0<=x+dx<W and 0<=y+dy<H]
        if any(c[3] and not dark(c) for c in nb) and not m(x-1,y): px[x,y]=OUTLINE
    im.save(f"{out}/{n}.png")
