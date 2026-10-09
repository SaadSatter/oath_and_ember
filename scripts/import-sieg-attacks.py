"""Slice supplied RGBA art without matte removal/recoloring. Fixed nearest scale.
Bounds and anatomical ground anchors are reviewed explicitly, never inferred
from sword/VFX bounds. Source images are retained unchanged.
"""
from pathlib import Path
from PIL import Image
import json, hashlib, colorsys
ROOT=Path(__file__).resolve().parents[1]
DEFINITIONS=ROOT/'apps/client/src/animation/siegAttackFrames.json'
metadata=json.loads(DEFINITIONS.read_text())
SIZE=metadata['canvas'][0]
SCALE=metadata['scale']
frames={direction:(data['source'], [(*frame['rect'],*frame['pivot']) for frame in data['frames']])
        for direction,data in metadata['directions'].items()}
meta={'canvas':[SIZE,SIZE],'groundAnchor':[64,96],'scale':SCALE,'metadata':str(DEFINITIONS.relative_to(ROOT)),'sampling':'nearest','alpha':'original RGBA unchanged; no background removal','directions':{}}
out=Image.new('RGBA',(SIZE*12,SIZE*3))
clothMask=Image.new('RGBA',out.size)
for row,(direction,(name,poses)) in enumerate(frames.items()):
 path=ROOT/name
 im=Image.open(path).convert('RGBA'); assert im.size==(1536,1024)
 assert im.getchannel('A').getextrema()[0]==0
 meta['directions'][direction]={'source':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'frames':[]}
 for col,(*rect,ax,ay) in enumerate(poses):
  x0,y0,x1,y1=rect
  assert 0<=x0<x1<=im.width and 0<=y0<y1<=im.height
  # The entire source rectangle must fit on the logical canvas. Reject clipping.
  assert 0<=64+(x0-ax)*SCALE and 64+(x1-ax)*SCALE<=SIZE
  assert 0<=96+(y0-ay)*SCALE and 96+(y1-ay)*SCALE<=SIZE
  crop=im.crop(rect)
  # Fixed destination anchor, identical scale for every direction and frame.
  tx=ax-rect[0]-64/SCALE; ty=ay-rect[1]-96/SCALE
  frame=crop.transform((SIZE,SIZE),Image.Transform.AFFINE,(1/SCALE,0,tx,0,1/SCALE,ty),resample=Image.Resampling.NEAREST)
  out.paste(frame,(col*SIZE,row*SIZE))
  # Auxiliary palette mask: preserve canonical artwork, recolor only reviewed
  # opaque crimson material inside the cape/scarf envelope. Protected head,
  # bright sword/slash pixels, and diffuse glow never enter this mask.
  region=metadata['directions'][direction]['frames'][col]['clothRegion']
  cx0,cy0,cx1,cy1=region['bounds']; hx,hy,hrx,hry=region['protectedHeadEllipse']
  for y in range(SIZE):
   for x in range(SIZE):
    sx=int((x+.5-64)/SCALE+ax); sy=int((y+.5-96)/SCALE+ay)
    r,g,b,a=frame.getpixel((x,y)); h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
    inHead=((sx-hx)/hrx)**2+((sy-hy)/hry)**2<=1
    inVfx=any(vx0<=sx<vx1 and vy0<=sy<vy1 for vx0,vy0,vx1,vy1 in region.get('protectedVfxRects',[]))
    cloth=cx0<=sx<cx1 and cy0<=sy<cy1 and not inHead and not inVfx and a>=180 and r>40 and (h<.035 or h>.93) and s>.32 and r>g*1.65 and r>b*1.12
    if cloth:clothMask.putpixel((col*SIZE+x,row*SIZE+y),(255,0,0,255))
  meta['directions'][direction]['frames'].append({'frame':row*12+col,'bounds':rect,'groundAnchor':[ax,ay],'durationMs':metadata['directions'][direction]['frames'][col]['durationMs']})
asset=ROOT/'apps/client/public/assets/characters/oath/basic.png'
out.save(asset)
clothMask.save(asset.with_name("basic-mask.png"))
(ROOT/'docs/SIEG_ATTACK_PROVENANCE.json').write_text(json.dumps(meta,indent=2)+'\n')
