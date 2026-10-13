"""Replace only spell opening poses with supplied directional wand artwork."""
from pathlib import Path
from PIL import Image
import json,hashlib,shutil
root=Path(__file__).resolve().parents[2]
source=root/'Images/Sprites/Coco/Coco_the_main_mage-She_points_her_wand/She_points_her_wand/rotations'
out=root/'apps/client/public/assets/characters/ember'
archive=root/'Images/Sprites/Coco/cast-start-integration-v1';archive.mkdir(exist_ok=True)
assets=['combat.png','combat-mask.png','combat-effects.png','combat-effects-mask.png']
for name in assets:
 if not (archive/('previous-'+name)).exists():shutil.copy2(out/name,archive/('previous-'+name))
images={name:Image.open(archive/('previous-'+name)).convert('RGBA') for name in assets}
records=[]
for row,direction in enumerate(['east','west','south','north']):
 path=source/f'{direction}.png';im=Image.open(path).convert('RGBA');anchor=(im.width/2,im.getbbox()[3])
 resized=im.resize((round(im.width*.9),round(im.height*.9)),Image.Resampling.NEAREST)
 offset=(64-round(anchor[0]*resized.width/im.width),96-round(anchor[1]*resized.height/im.height))
 cell=Image.new('RGBA',(128,128));cell.paste(resized,offset);mask=Image.new('RGBA',cell.size)
 for y in range(128):
  for x in range(128):
   r,g,b,a=cell.getpixel((x,y))
   if a and b>30 and b>r*1.08 and b>g*1.15 and r>=g:mask.putpixel((x,y),(255,0,0,a))
 images['combat.png'].paste(cell,(0,row*128));images['combat-mask.png'].paste(mask,(0,row*128))
 for name in ['combat-effects.png','combat-effects-mask.png']:images[name].paste(Image.new('RGBA',(128,128)),(0,row*128))
 records.append({'source':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'frame':row*8,'offset':offset,'source_anchor':anchor})
for name,im in images.items():im.save(out/name)
(archive/'provenance.json').write_text(json.dumps({'authorization':'User requested supplied wand-pointing stance as starting frame before Coco spells.','operations':['Replace only first frame of each cast direction; remaining animation preserved','Nearest-neighbor scale 0.9 and ground anchor (64,96)','Outfit mask; original wand, skin and gold pixels preserved','Opening frame has no VFX overlay; gameplay timing unchanged'],'frames':records},indent=2)+'\n')
