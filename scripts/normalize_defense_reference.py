"""Extract isolated, anchored Guard poses and ONE character-free Ward rim.
The review sheet is not an atlas. Reject low-alpha bridges/labels, retain the
connected hero silhouette, and anchor each Guard pose to its head/boot anatomy.
No character is generated or painted. Ward keeps Coco's existing clean body.
"""
from pathlib import Path
from PIL import Image, ImageFilter
from collections import deque
import colorsys, hashlib, json, math
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'Images/Sprites/Defense Basic Sprites.png'
im=Image.open(source).convert('RGBA');f=im.width/2048
SIZE=128;FOOT=(64,96);SCALE=.58/f
rows=[('start',[61,143,226,307,389,471,554,634],453,532),
      ('loop',[736,819,902,985,1066,1147,1230,1311],453,532),
      ('end',[1429,1511,1593,1676,1758,1840,1922,2005],453,532),
      ('down',[554,609,664,718,773,828,883,939],586,664),
      ('up',[1024,1080,1134,1187,1240,1293,1345,1399],582,664),
      ('impact',[1510,1587,1665,1742,1819,1897,1975],581,664)]
meta={'source':str(source.relative_to(ROOT)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
      'frame':[SIZE,SIZE],'foot':FOOT,'scale':SCALE,'groups':{'oath':[],'ember':[]},
      'cleanup':'Seeded connected alpha silhouette, no neighboring islands/labels; per-pose head center and foot anchor.',
      'ward':'One bright outer rim only, separate from existing idle/walk body; no interior character pixels.'}
sheet=Image.new('RGBA',(SIZE*8,SIZE*len(rows)));mask=Image.new('RGBA',sheet.size)
preview=Image.new('RGBA',(SIZE*8,SIZE*7))
for row,(name,centers,top,ground) in enumerate(rows):
 for col,cx in enumerate(centers):
  half=36 if name in ['up','down'] else 43
  bounds=tuple(round(v*f) for v in [max(0,cx-half),top,min(2048,cx+half),ground+2])
  crop=im.crop(bounds);w,h=crop.size
  opaque={(x,y) for y in range(h) for x in range(w) if crop.getpixel((x,y))[3]>=100}
  # The upper third contains the intended head, not the scarf or neighboring sword.
  head=[p for p in opaque if p[1]<h*.36 and w*.25<p[0]<w*.95]
  if not head:raise ValueError((name,col,'missing head'))
  meanx=sum(p[0] for p in head)/len(head);meany=sum(p[1] for p in head)/len(head)
  seed=min(head,key=lambda p:(p[0]-meanx)**2+(p[1]-meany)**2)
  keep={seed};queue=deque([seed])
  while queue:
   x,y=queue.popleft()
   for dy in [-1,0,1]:
    for dx in [-1,0,1]:
     q=(x+dx,y+dy)
     if q in opaque and q not in keep:keep.add(q);queue.append(q)
  # Preserve the original antialiasing immediately around the selected body.
  region=Image.new('L',crop.size)
  for p in keep:region.putpixel(p,255)
  region=region.filter(ImageFilter.MaxFilter(3))
  for y in range(h):
   for x in range(w):
    if not region.getpixel((x,y)):crop.putpixel((x,y),(0,0,0,0))
  topy=min(y for x,y in keep);booty=max(y for x,y in keep)
  hair=[(x,y) for x,y in keep if y<topy+(booty-topy)*.30]
  # Align anatomical head center horizontally and actual boots vertically,
  # rather than assuming evenly spaced source cells have equal body anchors.
  anchor=(sum(x for x,y in hair)/len(hair),booty+1)
  frame=crop.transform((SIZE,SIZE),Image.Transform.AFFINE,
   (1/SCALE,0,anchor[0]-FOOT[0]/SCALE,0,1/SCALE,anchor[1]-FOOT[1]/SCALE),
   resample=Image.Resampling.NEAREST,fillcolor=(0,0,0,0))
  regions=Image.new('RGBA',frame.size)
  for y in range(SIZE):
   for x in range(SIZE):
    r,g,b,a=frame.getpixel((x,y));hue,sat,val=colorsys.rgb_to_hsv(r/255,g/255,b/255)
    if a and (hue<.035 or hue>.93) and sat>.32 and val>.16 and r>g*1.65 and r>b*1.12 and 35<x<86 and 57<y<96:
     regions.putpixel((x,y),(255,0,0,255))
  xy=(col*SIZE,row*SIZE);sheet.paste(frame,xy);mask.paste(regions,xy);preview.paste(frame,xy)
  meta['groups']['oath'].append({'state':name,'frame':row*8+col,'bounds':bounds,
    'anchor':[round(bounds[0]+anchor[0],2),bounds[1]+anchor[1]],'normalizedBounds':frame.getbbox()})
p=ROOT/'apps/client/public/assets/characters/oath';sheet.save(p/'defense.png');mask.save(p/'defense-mask.png')
# Reviewed first right-loop sphere. A thin outer annulus excludes hat, face,
# hair, staff and cloak entirely; bright violet rim is normalized to ember.
center=(815*f,139*f);radii=(44*f,49*f)
ward=Image.new('RGBA',(SIZE,SIZE));wardmask=Image.new('RGBA',ward.size)
for y in range(SIZE):
 for x in range(SIZE):
  nx=(x-64)/29;ny=(y-70)/31.32;radius=math.hypot(nx,ny)
  if not .86<radius<1.015:continue
  sx=round(center[0]+nx*radii[0]);sy=round(center[1]+ny*radii[1])
  r,g,b,a=im.getpixel((sx,sy));hue,sat,val=colorsys.rgb_to_hsv(r/255,g/255,b/255)
  if a<80 or val<.38 or not .64<hue<.87 or (g<45 and sat>.85):continue
  edge=min(1,(radius-.86)/.045,(1.015-radius)/.045)
  lum=(.2126*r+.7152*g+.0722*b)/220
  ward.putpixel((x,y),tuple(min(255,round(c*lum)) for c in (255,155,50))+(round(a*edge),))
  wardmask.putpixel((x,y),(0,255,0,255))
p=ROOT/'apps/client/public/assets/characters/ember';ward.save(p/'defense.png');wardmask.save(p/'defense-mask.png')
preview.paste(ward,(0,6*SIZE))
meta['groups']['ember'].append({'state':'ward-rim','frame':0,'sourceCenter':center,'sourceRadii':radii,'annulus':[.86,1.015]})
(ROOT/'docs/DEFENSE_ASSET_PROVENANCE.json').write_text(json.dumps(meta,indent=2)+'\n')
preview.save(ROOT/'docs/defense-normalized-preview.png')
