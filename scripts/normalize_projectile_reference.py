"""Extract the approved isolated right-traveling blast; no generated art."""
from pathlib import Path
from PIL import Image
import colorsys
root=Path(__file__).resolve().parents[1]
source=Image.open(root/'Images/Sprites/Basic Fighting Sprites.png').convert('RGBA')
crop=source.crop((1368,118,1524,244))
for y in range(crop.height):
 for x in range(crop.width):
  r,g,b,a=crop.getpixel((x,y));h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
  # Background is dark purple; retain bright warm effect pixels and pale core.
  warm=(h<.18 or h>.96) and v>.35 and r>g*1.08
  core=min(r,g,b)>180
  if not (warm or core): crop.putpixel((x,y),(0,0,0,0));continue
  alpha=min(a,int(max(0,(v-.30)/.45)*255))
  intensity=max(r,g,b)
  crop.putpixel((x,y),(intensity,intensity,intensity,alpha))
canvas=Image.new('RGBA',(96,64))
# Half-size, nearest-neighbor; core maps to (76,32).
small=crop.resize((78,63),Image.Resampling.NEAREST)
canvas.paste(small,(15,6))
p=root/'apps/client/public/assets/effects';p.mkdir(parents=True,exist_ok=True)
canvas.save(p/'coco-blast.png')
