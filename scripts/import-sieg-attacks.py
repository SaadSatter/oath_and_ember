"""Slice supplied RGBA art without matte removal/recoloring. Fixed nearest scale.
Bounds and anatomical ground anchors are reviewed explicitly, never inferred
from sword/VFX bounds. Source images are retained unchanged.
"""
from pathlib import Path
from PIL import Image
import json, hashlib
ROOT=Path(__file__).resolve().parents[1]
SIZE=128
SCALE=.20
# x0,y0,x1,y1, ground x,ground y. Order: left-to-right, top-to-bottom.
frames={
 'right':('Sieg Right attack.png',[
 (20,20,380,390,196,358),(395,10,760,390,581,358),(775,15,1135,390,957,358),(1140,15,1520,390,1324,358),
 (30,400,375,715,207,684),(395,405,750,715,533,684),(750,405,1150,715,895,684),(1155,410,1510,715,1298,684),
 (15,725,400,1024,206,971),(402,725,765,1024,579,971),(775,725,1135,1024,968,971),(1150,725,1525,1024,1342,971)]),
 'up':('Sieg up swing.png',[
 (35,25,400,355,167,320),(440,20,775,355,570,330),
 (15,355,400,695,172,660),(410,355,795,695,605,660),(800,355,1145,695,974,660),(1160,355,1536,695,1360,660),
 (20,695,405,1024,208,919),(435,695,795,1024,606,919),(805,695,1150,1024,977,919),(1170,695,1536,1024,1338,919)]),
 'down':('Sieg down swing.png',[
 (15,45,395,365,174,300),(420,45,775,365,590,300),(800,45,1140,365,966,300),(1160,45,1536,365,1331,300),
 (10,365,395,680,205,586),(405,365,785,680,598,586),(790,365,1145,680,960,586),(1150,365,1536,680,1335,586),
 (20,680,405,1024,205,885),(410,680,795,1024,599,885),(800,680,1145,1024,974,885),(1160,680,1536,1024,1364,885)])}
meta={'canvas':[SIZE,SIZE],'groundAnchor':[64,96],'scale':SCALE,'sampling':'nearest','alpha':'original RGBA unchanged; no background removal','directions':{}}
out=Image.new('RGBA',(SIZE*12,SIZE*3))
for row,(direction,(name,poses)) in enumerate(frames.items()):
 path=ROOT/'Images/Sprites/Sieg'/name
 im=Image.open(path).convert('RGBA'); assert im.size==(1536,1024)
 assert im.getchannel('A').getextrema()[0]==0
 meta['directions'][direction]={'source':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'frames':[]}
 for col,(*rect,ax,ay) in enumerate(poses):
  crop=im.crop(rect)
  # Fixed destination anchor, identical scale for every direction and frame.
  tx=ax-rect[0]-64/SCALE; ty=ay-rect[1]-96/SCALE
  frame=crop.transform((SIZE,SIZE),Image.Transform.AFFINE,(1/SCALE,0,tx,0,1/SCALE,ty),resample=Image.Resampling.NEAREST)
  out.paste(frame,(col*SIZE,row*SIZE))
  meta['directions'][direction]['frames'].append({'frame':row*12+col,'bounds':rect,'groundAnchor':[ax,ay]})
asset=ROOT/'apps/client/public/assets/characters/oath/basic.png'
out.save(asset)
(ROOT/'docs/SIEG_ATTACK_PROVENANCE.json').write_text(json.dumps(meta,indent=2)+'\n')
