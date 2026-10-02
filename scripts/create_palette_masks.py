"""Create reviewed region masks from canonical art, not palette-specific art.
Hue-family selection is constrained by anatomical exclusion zones.
Red=cloth, green=magic. Never changes source artwork.
"""
from pathlib import Path
from PIL import Image
import colorsys
ROOT=Path(__file__).resolve().parents[1]
for hero in ['oath','ember']:
 p=ROOT/'apps/client/public/assets/characters'/hero
 im=Image.open(p/'top-down.png').convert('RGBA'); mask=Image.new('RGBA',im.size)
 for y in range(im.height):
  for x in range(im.width):
   r,g,b,a=im.getpixel((x,y)); h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255); fx=x%48
   if a<20:continue
   cloth=False; magic=False
   if hero=='oath':
    # Crimson material; omit head/face and low-saturation metal/hair.
    cloth=(h<.035 or h>.93) and s>.32 and v>.16 and y>20 and r>g*1.65 and r>b*1.12
   else:
    # Hat above face and cloth below torso; face/hair band is protected.
    cloth=.66<h<.86 and s>.22 and v>.15 and (y<26 or y>40)
    # Staff/crystal glow and hat gem; protect eyes and skin at face center.
    magic=.035<h<.16 and s>.6 and v>.5 and (fx<17 or fx>32 or y<23)
   if cloth:mask.putpixel((x,y),(255,0,0,255))
   elif magic:mask.putpixel((x,y),(0,255,0,255))
 mask.save(p/'palette-mask.png')
