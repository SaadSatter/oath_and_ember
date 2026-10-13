"""Pack the user-supplied attack sheet: east, north, south; omit row four."""
from pathlib import Path
from PIL import Image
import json, hashlib
ROOT = Path(__file__).resolve().parents[2]
source = ROOT / 'Images/Sprites/Sieg/attack-sheet-integration-v2/source.png'
im = Image.open(source).convert('RGBA')
assert im.size == (336, 336)
metadata = {'canvas': [128,128], 'pivot': [64,96], 'scale': .85,
 'scaleReason': 'Nearest-neighbor sampling matches Sieg locomotion body height; anatomical boot anchors exclude sword and slash bounds.', 'directions': {}}
sheet = Image.new('RGBA', (1536,384))
mask = Image.new('RGBA', sheet.size)
# Four authored poses use existing directional clip durations; west mirrors east in PlayerView.
for row, (direction, durations, anchors) in enumerate([
 ('right', [180,180,200,205], [(43,73),(42,73),(40,72),(42,72)]),
 ('up', [155,155,170,175], [(43,72),(43,72),(43,72),(43,72)]),
 ('down', [165,165,185,195], [(42,73),(42,73),(42,73),(42,73)]),
]):
 frames = []
 for col in range(4):
  rect = [col*84,row*84,(col+1)*84,(row+1)*84]
  ax,ay = col*84+anchors[col][0],row*84+anchors[col][1]
  crop = im.crop(rect)
  frame = crop.transform((128,128), Image.Transform.AFFINE,
    (1/.85,0,ax-rect[0]-64/.85,0,1/.85,ay-rect[1]-96/.85), resample=Image.Resampling.NEAREST)
  sheet.paste(frame,(col*128,row*128))
  for y in range(128):
   for x in range(128):
    r,g,b,a = frame.getpixel((x,y))
    if a >= 180 and r>35 and r>g*1.65 and r>b*1.2 and abs(g-b)<25:
     mask.putpixel((col*128+x,row*128+y),(255,0,0,255))
  frames.append({'frame':row*12+col,'rect':rect,'pivot':[ax,ay],'durationMs':durations[col]})
 metadata['directions'][direction] = {'source':str(source.relative_to(ROOT)), 'frames':frames}
out = ROOT/'apps/client/public/assets/characters/oath'
sheet.save(out/'basic.png'); mask.save(out/'basic-mask.png')
(ROOT/'apps/client/src/animation/siegAttackFrames.json').write_text(json.dumps(metadata,indent=2)+'\n')
(ROOT/'docs/SIEG_ATTACK_PROVENANCE.json').write_text(json.dumps({
 'authorization':'User requested first row east, mirrored west, second row north, third row south; last row ignored.',
 'source':str(source.relative_to(ROOT)), 'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
 'sampling':'nearest', 'alpha':'Original source RGBA; transparent canvas',
 'metadata':'apps/client/src/animation/siegAttackFrames.json',
 'operations':['First three rows only, four frames per row','Anatomical boot anchors at (64,96)','Red cloth mask excludes neutral skin, metal and pale slash','Preserve prior directional presentation durations: 765/655/710 ms'],
},indent=2)+'\n')
