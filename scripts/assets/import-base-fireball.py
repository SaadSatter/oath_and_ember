from pathlib import Path
from PIL import Image, ImageSequence
import json,hashlib
root=Path(__file__).resolve().parents[2]
source=root/'Images/Sprites/Coco/pixellab-Create-a-sprite-sheet-of-a-fir-1792014114546.gif'
gif=Image.open(source);frames=[f.convert('RGBA') for f in ImageSequence.Iterator(gif)]
atlas=Image.new('RGBA',(gif.width*len(frames),gif.height))
for n,frame in enumerate(frames):atlas.paste(frame,(n*gif.width,0))
atlas.save(root/'apps/client/public/assets/effects/coco/base-fireball.png')
meta={'durations':[f.info.get('duration',130) for f in ImageSequence.Iterator(gif)],'frameWidth':gif.width,'frameHeight':gif.height}
(root/'apps/client/src/animation/baseFireballFrames.json').write_text(json.dumps(meta,indent=2)+'\n')
(root/'Images/Sprites/Coco/base-fireball-provenance.json').write_text(json.dumps({'source':str(source.relative_to(root)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'operations':['Decode supplied transparent GIF and pack without resizing, recoloring or cropping','Preserve authored frame duration; replace only level-one presentation','Travel frames 0-6 loop in flight; explosion and smoke frames 7-15 play on impact; upgraded source atlases remain untouched'],**meta},indent=2)+'\n')
