"""Pack original transparent PixelLab grooming frames at native resolution."""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=root/'Images/Sprites/monster_sprites/sources/griffin-grooming'
mirror=source/'mirror-export/Pretending_to_check'
cut=source/'shears-export/Holding_shears_to_hi'
groups=[sorted(mirror.glob('animations/*/south/*.png')), sorted(mirror.glob('animations/*/north/*.png')), sorted(cut.glob('animations/*/north/*.png'))]
assert [len(g) for g in groups]==[9,9,9]
sheet=Image.new('RGBA',(176*27,176))
for row,frames in enumerate(groups):
 for i,p in enumerate(frames):
  im=Image.open(p).convert('RGBA')
  assert im.width<=176 and im.height<=176
  cell=Image.new('RGBA',(176,176))
  cell.alpha_composite(im,((176-im.width)//2,(176-im.height)//2))
  sheet.paste(cell,((row*9+i)*176,0))
sheet.save(root/'apps/client/public/assets/enemies/griffin/grooming.png')
