"""Normalize supplied idle/walk PNGs to the existing hero frame and palette contract."""
from PIL import Image
from pathlib import Path
import json, shutil, hashlib
source=Path('Images/Sprites/Sieg/Sieg_a_knight-Idle/Idle')
root=Path('Images/Sprites/Sieg/integration-v1');root.mkdir(exist_ok=True)
out=Path('apps/client/public/assets/characters/oath')
for f in ['top-down.png','palette-mask.png']:
 if not (root/('previous-'+f)).exists():shutil.copy2(out/f,root/('previous-'+f))
frames=[];records=[]
for direction in ['south','north','west','east']:
 frames.append(source/'rotations'/f'{direction}.png')
for direction in ['south','north','east','west']:
 frames.extend(sorted((source/'animations/Walking'/direction).glob('frame_*.png')))
assert len(frames)==36
atlas=Image.new('RGBA',(48*36,64)); mask=Image.new('RGBA',atlas.size)
# Shared source canvas anchors per walk direction retain bobbing and limb motion.
anchors={}
for direction in ['south','north','east','west']:
 images=[Image.open(p).convert('RGBA') for p in sorted((source/'animations/Walking'/direction).glob('*.png'))]
 anchors[direction]=(images[0].width/2,max(i.getbbox()[3] for i in images))
for n,path in enumerate(frames):
 im=Image.open(path).convert('RGBA')
 anchor=(im.width/2,im.getbbox()[3]) if n<4 else anchors[path.parent.name]
 resized=im.resize((round(im.width*.9),round(im.height*.9)),Image.Resampling.NEAREST)
 dx=24-round(anchor[0]*resized.width/im.width);dy=60-round(anchor[1]*resized.height/im.height)
 cell=Image.new('RGBA',(48,64));cell.paste(resized,(dx,dy));atlas.paste(cell,(n*48,0))
 # The source's red cloak/tunic only; protect skin, hair, armor and weapons.
 p=cell.load();m=mask.load()
 for y in range(64):
  for x in range(48):
   r,g,b,a=p[x,y]
   if a and r>35 and r>g*1.35 and r>b*1.2 and abs(g-b)<25:m[n*48+x,y]=(255,0,0,a)
 records.append({'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'offset':[dx,dy],'source_anchor':anchor})
atlas.save(out/'top-down-user-v1.png');atlas.save(root/'atlas.png');mask.save(out/'palette-mask.png');mask.save(root/'palette-mask.png')
(root/'provenance.json').write_text(json.dumps({'authorization':'User requested replacement Sieg idle and walks with supplied sprite export and GIFs.','operations':['Nearest-neighbor normalization at 0.9 source scale','Stable ground anchor at (24,60); preserve walk bobbing','Red cloth palette mask; existing combat art retained because export contains idle and walk only'],'frames':records},indent=2))
