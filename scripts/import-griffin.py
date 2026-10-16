"""Pack original PixelLab Griffin frames without recoloring, resampling or cropping."""
from pathlib import Path
from PIL import Image
import json,shutil
root=Path.cwd();src=root/'Images/Sprites/Griffin';preserved=root/'Images/Sprites/monster_sprites/sources/griffin/pixellab-export'
shutil.copytree(src,preserved,dirs_exist_ok=True)
out=root/'apps/client/public/assets/enemies/griffin';out.mkdir(parents=True,exist_ok=True)
meta=json.loads((src/'metadata.json').read_text());dirs=['south','east','north','west'];size=164
for kind, state, anim in [('flight',1,'Flex_wings_downward_and_inward_in_a_powerful_strok'),('takeoff',0,'Tuck_the_hind_legs_inward_and_compress_the_body_in'),('run',0,'Running')]:
 frames=meta['states'][state]['frames'];count=8 if kind=='run' else 9
 sheet=Image.new('RGBA',(size*(count+1),size*4))
 for row,d in enumerate(dirs):
  paths=[frames['rotations'][d]]
  # North running was not supplied. Its native north standing view is retained.
  paths+=frames['animations'][anim].get(d,[frames['rotations'][d]]*count)
  for col,p in enumerate(paths):
   im=Image.open(src/p).convert('RGBA')
   sheet.alpha_composite(im,(col*size+(size-im.width)//2,row*size+(size-im.height)//2))
 sheet.save(out/f'{kind}.png')
(out/'provenance.json').write_text(json.dumps({'source':'Images/Sprites/Griffin','metadata':'Images/Sprites/Griffin/metadata.json','frameSize':164,'anchor':[82,106],'directions':dirs,'northRun':'Native north idle rotation: no north run animation supplied.'},indent=2)+'\n')
