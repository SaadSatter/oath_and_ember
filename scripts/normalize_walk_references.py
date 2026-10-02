"""Normalize explicitly reviewed walk poses from approved RGBA artwork.
Never slice the whole reference into a grid. No regeneration or recoloring.
"""
from pathlib import Path
from PIL import Image
import hashlib, json
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'Images/Sprites/Walking Animation.png'
# Each row has separately reviewed pose bounds. Order is down, up, right, left.
BOUNDS={
'oath':[
[(95,123,204,302),(207,123,309,302),(312,127,415,302),(424,129,535,302),(535,127,642,302),(640,127,750,302)],
[(98,340,207,516),(210,340,324,516),(323,341,430,517),(433,341,537,517),(543,342,644,516),(652,342,759,516)],
[(96,560,215,720),(193,560,319,720),(311,561,422,721),(400,562,535,721),(517,562,642,721),(628,562,759,721)],
[(103,783,232,944),(223,780,345,944),(330,783,439,944),(432,782,559,944),(543,784,672,944),(652,785,768,944)]],
'ember':[
[(877,120,984,304),(985,120,1094,304),(1094,120,1196,304),(1194,120,1308,304),(1305,120,1415,304),(1415,120,1536,304)],
[(879,336,985,520),(986,336,1096,520),(1096,336,1200,520),(1201,336,1309,520),(1310,336,1419,520),(1420,336,1536,520)],
[(869,550,983,727),(983,550,1093,727),(1093,550,1202,727),(1202,550,1310,727),(1310,550,1419,727),(1419,550,1532,727)],
[(875,773,985,953),(985,773,1095,953),(1095,773,1205,953),(1205,773,1312,953),(1312,773,1420,953),(1420,773,1528,953)]]}
# Body/ground anchors, independent of the accessory bounding box.
X={'oath':[[160,260,360,480,580,700],[151,256,374,478,591,698],[149,259,369,479,589,699],[150,260,370,480,590,700]],
'ember':[[928,1035,1139,1251,1359,1470],[924,1036,1146,1254,1364,1474],[930,1040,1145,1255,1365,1475],[927,1034,1146,1256,1364,1470]]}
Y={'oath':[301,516,721,944],'ember':[303,519,726,952]}
# Common scale across every pose of a hero: reference figures are ~170 px high,
# versus ~225 px in the original idle reference. Target the same ~50 px height.
SCALE=.285
im=Image.open(SOURCE).convert('RGBA');assert im.size==(1536,1024)
preview=Image.new('RGBA',(288,512));meta={'source':str(SOURCE.relative_to(ROOT)),'sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'frame':[48,64],'foot':[24,60],'scale':SCALE,'directions':['down','up','right','left'],'heroes':{}}
for h,rows in BOUNDS.items():
 directory=ROOT/'apps/client/public/assets/characters'/h
 sheet=Image.new('RGBA',(48*28,64))
 idle=Image.open(directory/'top-down-idles.png');sheet.paste(idle,(0,0))
 meta['heroes'][h]=[]
 for row,bounds in enumerate(rows):
  for col,b in enumerate(bounds):
   anchor=(X[h][row][col],Y[h][row]);crop=im.crop(b);s=1/SCALE
   # The reference contains residual alpha=1 matte pixels; discard only this
   # effectively invisible matte and isolated fragments of neighboring poses.
   pixels=np.array(crop)
   if h=='oath' and row==2:
    # Neighbor capes sit beside this pose's extended sword. Exclude their
    # upper-right / lower-left wedges without trimming the weapon itself.
    for yy in range(pixels.shape[0]):
     source_y=yy+b[1]
     if col in (1,3,4) and source_y<675: pixels[yy,-20:,3]=0
     if col in (1,3,4,5) and source_y>675: pixels[yy,:18,3]=0
   mask=pixels[:,:,3]>10; seen=np.zeros(mask.shape,bool); groups=[]
   for yy,xx in zip(*np.where(mask)):
    if seen[yy,xx]: continue
    todo=[(int(xx),int(yy))];seen[yy,xx]=True;group=[]
    while todo:
     px,py=todo.pop();group.append((px,py))
     for nx,ny in [(px-1,py),(px+1,py),(px,py-1),(px,py+1)]:
      if 0<=nx<mask.shape[1] and 0<=ny<mask.shape[0] and mask[ny,nx] and not seen[ny,nx]: seen[ny,nx]=True;todo.append((nx,ny))
    groups.append(group)
   main=max(groups,key=len);keep=np.zeros(mask.shape,bool)
   for xx,yy in main: keep[yy,xx]=True
   pixels[~keep]=0;crop=Image.fromarray(pixels)
   frame=crop.transform((48,64),Image.Transform.AFFINE,(s,0,anchor[0]-b[0]-24*s,0,s,anchor[1]-b[1]-60*s),resample=Image.Resampling.NEAREST,fillcolor=(0,0,0,0))
   assert frame.getbbox()
   index=4+row*6+col;sheet.paste(frame,(48*index,0))
   frame.save(directory/f'walk_{meta["directions"][row]}_{col+1:02}.png')
   preview.paste(frame,(48*col,64*(row+(0 if h=='oath' else 4))))
   meta['heroes'][h].append({'index':index,'bounds':b,'anchor':anchor,'normalizedBounds':frame.getbbox()})
 sheet.save(directory/'top-down.png')
(ROOT/'docs/WALK_ASSET_PROVENANCE.json').write_text(json.dumps(meta,indent=2)+'\n')
preview.resize((864,1536),Image.Resampling.NEAREST).save(ROOT/'docs/normalized-walk-preview.png')
