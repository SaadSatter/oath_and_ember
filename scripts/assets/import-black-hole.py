from pathlib import Path
from PIL import Image, ImageSequence
import json,hashlib
root=Path(__file__).resolve().parents[2]
source=root/'Images/Sprites/Coco/pixellab-Create-a-sprite-sheet-of-a-bla-1792013456958.gif'
gif=Image.open(source);frames=[f.convert('RGBA') for f in ImageSequence.Iterator(gif)]
atlas=Image.new('RGBA',(gif.width*len(frames),gif.height))
for n,frame in enumerate(frames):atlas.paste(frame,(n*gif.width,0))
out=root/'apps/client/public/assets/effects/coco';atlas.save(out/'black-hole.png')
meta={'durations':[f.info.get('duration',130) for f in ImageSequence.Iterator(gif)],'frameWidth':gif.width,'frameHeight':gif.height}
(root/'apps/client/src/animation/blackHoleFrames.json').write_text(json.dumps(meta,indent=2)+'\n')
(root/'Images/Sprites/Coco/black-hole-provenance.json').write_text(json.dumps({'source':str(source.relative_to(root)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'operations':['Decode supplied transparent GIF into lossless unscaled atlas','Preserve authored frame durations and purple colors'],**meta},indent=2)+'\n')
