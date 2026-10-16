from PIL import Image
from pathlib import Path
import shutil,json
root=Path.cwd(); src=Path('/Users/saadsatter/Downloads/Forest_Wolf'); dest=root/'Images/Sprites/monster_sprites/sources/forest-wolf/pixellab-export'
if src.exists(): shutil.copytree(src,dest,dirs_exist_ok=True)
else: src=dest
out=root/'apps/client/public/assets/enemies/forest_wolf';out.mkdir(parents=True,exist_ok=True)
dirs=['south','east','north','west']; sheet=Image.new('RGBA',(96*5,96*4))
for row,d in enumerate(dirs):
 paths=[src/f'Idle/rotations/{d}.png']+[src/f'Idle/animations/Run/{d}/frame_{i:03}.png' for i in range(4)]
 for col,p in enumerate(paths):
  im=Image.open(p).convert('RGBA');sheet.alpha_composite(im, (col*96+(96-im.width)//2,row*96+(96-im.height)//2))
sheet.save(out/'wolf.png')
meta=dict(asset_id='forest_wolf_runner',url='/assets/enemies/forest_wolf/wolf.png',frame_dimensions=[96,96],anchor=[48,64],directions=dirs,x_edges=[0,96,192,288,384,480],animation_frames={d:[1,2,3,4] for d in dirs},standing_frames={d:0 for d in dirs},scale=1,fps=12,motion='run')
(out/'visual.json').write_text(json.dumps(meta,indent=2)+'\n')
