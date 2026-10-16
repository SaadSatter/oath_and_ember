from pathlib import Path
from PIL import Image
import shutil,json,hashlib
root=Path(__file__).resolve().parents[1];src=Path('/Users/saadsatter/Downloads/A_forest_iron_Golem-Winding_one_arm_back')
archive=root/'Images/Sprites/monster_sprites/sources/forest-iron-golem/melee';shutil.copytree(src,archive/'pixellab-export',dirs_exist_ok=True)
directions=['south','north','west','east'];sheet=Image.new('RGBA',(128*6,128*4));sources=[]
for row,d in enumerate(directions):
 files=sorted((src/'Winding_one_arm_back/animations/Cross_Punch'/d).glob('*.png'));assert len(files)==6
 ref=Image.open(files[0]).convert('RGBA');dx=(128-ref.width)//2;dy=108-ref.getbbox()[3]
 for n,p in enumerate(files):
  im=Image.open(p).convert('RGBA');assert im.size==ref.size
  sheet.paste(im,(n*128+dx,row*128+dy));sources.append({'file':str(p.relative_to(src)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 gif=Path('/Users/saadsatter/Downloads')/f'Winding_one_arm_back_cross-punch_{d}.gif';shutil.copy2(gif,archive/gif.name)
out=root/'apps/client/public/assets/enemies/ironbound_sentinel';sheet.save(out/'melee.png')
meta={'directions':directions,'columns':6,'frameWidth':128,'frameHeight':128,'anchor':[64,108],'sources':sources,'processing':'Lossless original RGBA pixels, one fixed translation per direction/clip. No resampling/recoloring.'}
(out/'melee.json').write_text(json.dumps(meta,indent=2)+'\n');(archive/'provenance.json').write_text(json.dumps(meta,indent=2)+'\n')
