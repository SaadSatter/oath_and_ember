"""Preserve supplied Griffin mouth pose, charge GIF and beam/explosion sheets."""
from pathlib import Path
from PIL import Image
import shutil,json
root=Path.cwd();src=Path('/Users/saadsatter/Downloads');out=root/'apps/client/public/assets/enemies/griffin';save=root/'Images/Sprites/monster_sprites/sources/griffin/mouth-beam';save.mkdir(parents=True,exist_ok=True)
shutil.copytree(src/'Griffin-Open_mouth_wide',save/'pose',dirs_exist_ok=True)
dirs=['south','south-east','east','north-east','north','north-west','west','south-west'];sheet=Image.new('RGBA',(164*8,164))
for i,d in enumerate(dirs):sheet.alpha_composite(Image.open(src/f'Griffin-Open_mouth_wide/Open_mouth_wide/rotations/{d}.png').convert('RGBA'),(i*164+24,24))
sheet.save(out/'mouth.png')
files={'charge':'pixellab-The-core-of-the-sphere-begins--1792111142054.gif','beam':'pixellab-The-dense-red-and-white-energy-1792114706829.png','explosion':'pixellab-A-radiating-dome-of-an-explosi-1792114690543.png'}
for kind,name in files.items():
 shutil.copy2(src/name,save/name)
 im=Image.open(src/name)
 if kind=='charge':
  sheet=Image.new('RGBA',(128*im.n_frames,128));durations=[]
  for i in range(im.n_frames):im.seek(i);sheet.alpha_composite(im.convert('RGBA'),(128*i,0));durations.append(im.info.get('duration',130))
  sheet.save(out/'charge.png');(out/'charge.json').write_text(json.dumps({'durations':durations})+'\n')
 else:shutil.copy2(src/name,out/f'{kind}.png')
# Crop only the central repeatable beam span, avoiding caps at both ends.
beam=Image.open(out/'beam.png');body=Image.new('RGBA',(64*10,128))
for col,frame in enumerate(range(3,13)):
 x=frame%5*128;y=frame//5*128;body.alpha_composite(beam.crop((x+32,y,x+96,y+128)),(col*64,0))
body.save(out/'beam-middle.png')
(save/'README.md').write_text('Supplied PixelLab mouth pose, nine-frame transparent charge GIF, 5×4 beam sheet (17 occupied cells), and 2×2 impact sheet. Runtime assets are packed without resampling/recoloring. Beam-middle.png extracts only x=32..96 of frames 3..12 for repeating segments; beam frames 14..16 form terminal contact. Source metadata is preserved in pose/metadata.json.\n')
