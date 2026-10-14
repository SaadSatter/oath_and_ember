"""Decode supplied flight GIFs, remove their green matte, and anchor the atlas."""
from PIL import Image, ImageSequence
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[2]
source=root/'Images/Sprites/Coco'
sequences=[];records=[]
for direction in ['south','north','east','west']:
 path=source/f'Same_mage_but_with_d_custom-Flex_wings_outward_to_lift_off_{direction}.gif'
 gif=Image.open(path);frames=[];durations=[]
 for frame in ImageSequence.Iterator(gif):
  im=frame.convert('RGBA')
  for y in range(im.height):
   for x in range(im.width):
    r,g,b,a=im.getpixel((x,y))
    if g>150 and g>r*1.5 and g>b*1.5:im.putpixel((x,y),(0,0,0,0))
  frames.append(im);durations.append(frame.info.get('duration',100))
 sequences.append((frames,durations))
 records.append({'source':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'durations':durations})
columns=max(len(f) for f,d in sequences)
atlas=Image.new('RGBA',(columns*128,512));mask=Image.new('RGBA',atlas.size)
for row,(frames,durations) in enumerate(sequences):
 anchor=(frames[0].width/2,max(im.getbbox()[3] for im in frames))
 for col,im in enumerate(frames):
  scaled=im.resize((round(im.width*.9),round(im.height*.9)),Image.Resampling.NEAREST)
  cell=Image.new('RGBA',(128,128));cell.paste(scaled,(64-round(anchor[0]*scaled.width/im.width),96-round(anchor[1]*scaled.height/im.height)))
  atlas.paste(cell,(col*128,row*128))
  for y in range(128):
   for x in range(128):
    r,g,b,a=cell.getpixel((x,y))
    if a and b>30 and b>r*1.08 and b>g*1.15 and r>=g:mask.putpixel((col*128+x,row*128+y),(255,0,0,a))
out=root/'apps/client/public/assets/characters/ember';atlas.save(out/'flight.png');mask.save(out/'flight-mask.png')
(root/'apps/client/src/animation/cocoFlightFrames.json').write_text(json.dumps({'columns':columns,'directions':{d:{'start':i*columns,'durations':records[i]['durations']} for i,d in enumerate(['down','up','right','left'])}},indent=2)+'\n')
(source/'flight-provenance.json').write_text(json.dumps({'authorization':'User supplied four directional winged flight GIFs for Coco.','operations':['Green matte removed; original pixels otherwise retained','Nearest-neighbor scale 0.9; shared directional ground anchor (64,96)','Purple outfit palette mask'],'sources':records},indent=2)+'\n')
