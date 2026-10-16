"""Losslessly pack user-provided golem attack poses and charge/impact effects."""
from pathlib import Path
from PIL import Image,ImageSequence
import shutil,json,hashlib
root=Path(__file__).resolve().parents[1];base=root/'Images/Sprites'
src=base/'A_forest_iron_Golem-He_puts_his_palm_out'
archive=base/'monster_sprites/sources/forest-iron-golem/attack';archive.mkdir(parents=True,exist_ok=True)
shutil.copytree(src,archive/'pixellab-export',dirs_exist_ok=True)
out=root/'apps/client/public/assets/enemies/ironbound_sentinel';directions=['south','north','west','east']
sheet=Image.new('RGBA',(128*9,128*4));sources=[]
for row,d in enumerate(directions):
 files=sorted((src/'He_puts_his_palm_out/animations/Flash_a_bright_white_light_across_the_raised_palm'/d).glob('*.png'));assert len(files)==9
 reference=Image.open(files[0]).convert('RGBA');dx=(128-reference.width)//2;dy=108-reference.getbbox()[3]
 for n,p in enumerate(files):
  im=Image.open(p).convert('RGBA');assert im.size==reference.size
  sheet.paste(im,(n*128+dx,row*128+dy));sources.append({'file':str(p.relative_to(src)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 gif=base/f'He_puts_his_palm_out_custom-Flash_a_sudden_intense_white_{d}.gif';shutil.copy2(gif,archive/gif.name)
sheet.save(out/'attack.png')
meta={'directions':directions,'frameWidth':128,'frameHeight':128,'columns':9,'anchor':[64,108],'sources':sources,'effects':{}}
for key,name in [('charge','pixellab-The-concentrated-sphere-of-cra-1792095254007.gif'),('blast','pixellab-The-initial-small-eruption-vio-1792098934914.gif')]:
 p=base/name;shutil.copy2(p,archive/name);im=Image.open(p);frames=[f.convert('RGBA').copy() for f in ImageSequence.Iterator(im)]
 atlas=Image.new('RGBA',(im.width*len(frames),im.height))
 for i,f in enumerate(frames):atlas.paste(f,(i*im.width,0))
 atlas.save(out/f'{key}.png');meta['effects'][key]={'frameWidth':im.width,'frameHeight':im.height,'durations':[f.info.get('duration',130) for f in ImageSequence.Iterator(im)],'source':name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(out/'attack.json').write_text(json.dumps(meta,indent=2)+'\n');(archive/'provenance.json').write_text(json.dumps(meta,indent=2)+'\n')
print('Packed 36 attack poses, 17 charge frames and 11 blast frames with original alpha.')
