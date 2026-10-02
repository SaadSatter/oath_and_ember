"""Approved combat crops. Explicit pose bounds; no whole-sheet grid slicing.
RGBA matte is discarded, no painting/regeneration. Review masks with future art.
"""
from pathlib import Path
from PIL import Image
import colorsys,json,hashlib,sys,os
sys.path.insert(0,os.environ.get('COMBAT_VISION_PATH','/tmp/combat-vision'))
import cv2,numpy as np
cv2.setNumThreads(1)
cv2.setRNGSeed(0)
def remove_matte(crop,anchor,head=None):
 a=np.array(crop);h,w=a.shape[:2]
 corners=np.concatenate([a[:4,:8,:3].reshape(-1,3),a[:4,-8:,:3].reshape(-1,3),a[-4:,:8,:3].reshape(-1,3),a[-4:,-8:,:3].reshape(-1,3)])
 bg=np.median(corners,axis=0)
 near=np.max(np.abs(a[:,:,:3].astype(float)-bg),axis=2)<23
 mask=np.where(near,cv2.GC_PR_BGD,cv2.GC_PR_FGD).astype('uint8')
 mask[a[:,:,3]<=20]=cv2.GC_BGD
 edge=np.zeros((h,w),bool);edge[:2,:]=True;edge[-2:,:]=True;edge[:,:2]=True;edge[:,-2:]=True
 mask[edge & near]=cv2.GC_BGD
 ax,ay=anchor
 mask[max(0,ay-65):max(0,ay-15),max(0,ax-8):min(w,ax+8)]=cv2.GC_FGD
 # Reviewed anatomical seeds retain dark boots that resemble the matte.
 for dx in [-12,10]: cv2.ellipse(mask,(ax+dx,ay-8),(6,6),0,0,360,cv2.GC_FGD,-1)
 if head: cv2.ellipse(mask,head,(12,13),0,0,360,cv2.GC_FGD,-1)
 cv2.grabCut(a[:,:,:3],mask,None,np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),5,cv2.GC_INIT_WITH_MASK)
 keep=(mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD)
 a[~keep]=0;a[a[:,:,3]<=20]=0
 return Image.fromarray(a)

ROOT=Path(__file__).resolve().parents[1];source=ROOT/'Images/Sprites/Basic Fighting Sprites.png'
im=Image.open(source).convert('RGBA');assert im.size==(1536,1024)
SIZE=128;FOOT=(64,96);SCALE=.50
# Bounds include weapons/visible slash arcs. Ground anchors follow body, not VFX.
rows={
'oath':[
('right',[(25,128,139,236),(139,128,264,238),(256,128,406,238),(365,113,532,238),(528,128,658,239),(640,128,749,238)],[78,202,317,436,570,690],235),
('left',[(20,301,138,407),(118,301,254,407),(240,283,417,407),(377,300,539,408),(528,300,651,408),(633,301,746,409)],[80,192,317,469,589,691],405),
('down',[(35,469,130,590),(132,470,248,590),(252,451,381,590),(383,469,510,590),(511,469,637,590),(638,469,744,590)],[80,191,316,436,576,688],567),
('up',[(18,637,118,777),(129,639,229,778),(250,626,374,780),(377,641,506,780),(513,638,624,780),(639,644,751,780)],[74,187,315,435,578,696],768),
('heavy_right',[(18,849,140,962),(106,845,252,962),(202,829,380,968),(280,826,436,969),(358,851,492,968),(461,828,602,970),(538,804,702,976),(685,885,753,977)],[72,170,269,360,424,519,613,704],959)],
'ember':[
('right',[(789,133,890,237),(894,132,996,237),(997,131,1093,237),(1094,130,1191,239),(1182,130,1286,239),(1276,128,1370,240)],[830,933,1040,1136,1222,1320],234),
# The projectile-only first numbered cell is excluded from character playback.
('left',[(891,299,996,407),(996,299,1095,408),(1098,298,1195,409),(1200,296,1301,409),(1296,297,1403,409),(1407,298,1504,409)],[950,1043,1144,1253,1355,1462],402),
('down',[(788,463,890,588),(892,461,991,588),(991,461,1089,588),(1089,461,1192,588),(1181,461,1282,588),(1277,461,1371,598),(1369,461,1463,590),(1440,461,1521,588)],[831,934,1038,1141,1231,1323,1414,1482],569),
('up',[(785,666,888,781),(889,651,990,781),(991,638,1090,781),(1090,659,1190,782),(1189,624,1290,782),(1289,624,1383,782),(1390,624,1495,782)],[831,940,1045,1135,1245,1349,1454],777)]}
meta={'source':str(source.relative_to(ROOT)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'frame':[SIZE,SIZE],'foot':FOOT,'scale':SCALE,'matte':'seeded GrabCut, fixed RNG, anatomical core/boot seeds; original RGBA retained inside mask','heroes':{}}
HEADS={'right':[(90,151),(202,151),(312,151),(450,165),(580,154),(705,153)],'left':[(64,322),(188,322),(314,328),(481,325),(589,324),(684,325)],'down':[(79,489),(191,489),(320,490),(450,491),(580,488),(699,490)],'up':[(73,706),(186,704),(314,706),(435,707),(580,690),(698,698)]}
preview=Image.new('RGBA',(SIZE*8,SIZE*9))
for hero,groups in rows.items():
 groups=[g for g in groups if g[0]!='heavy_right']
 p=ROOT/'apps/client/public/assets/characters'/hero
 body=Image.new('RGBA',(SIZE*8,SIZE*len(groups)));effects=Image.new('RGBA',body.size);mask=Image.new('RGBA',body.size);effectmask=Image.new('RGBA',body.size);meta['heroes'][hero]=[]
 for row,(name,bounds,anchors,ground) in enumerate(groups):
  count=len(bounds)
  # Final heavy cell is debris only: retain recovery body from preceding pose;
  # do not turn debris into a disappearing character frame.
  if hero=='oath' and name=='heavy_right': count=7
  for col in range(count):
   b=bounds[col];anchor=(anchors[col],ground);head=HEADS[name][col] if hero=='oath' else None;crop=remove_matte(im.crop(b),(anchor[0]-b[0],anchor[1]-b[1]),(head[0]-b[0],head[1]-b[1]) if head else None)
   for y in range(crop.height):
    for x in range(crop.width):
     r,g,bb,a=crop.getpixel((x,y))
     if a<=20:crop.putpixel((x,y),(0,0,0,0))
   s=1/SCALE;frame=crop.transform((SIZE,SIZE),Image.Transform.AFFINE,(s,0,anchor[0]-b[0]-64*s,0,s,anchor[1]-b[1]-96*s),resample=Image.Resampling.NEAREST,fillcolor=(0,0,0,0))
   vfx=Image.new('RGBA',frame.size);regions=Image.new('RGBA',frame.size);vregions=Image.new('RGBA',frame.size)
   for y in range(SIZE):
    for x in range(SIZE):
     r,g,bb,a=frame.getpixel((x,y));h,sat,val=colorsys.rgb_to_hsv(r/255,g/255,bb/255)
     if not a:continue
     if hero=='ember':
      # Extract saturated orange magic outside protected body/head/staff stem.
      magic=.02<h<.17 and sat>.60 and val>.60 and (x<54 or x>77 or y<55) and y<92
      if magic:
       vfx.putpixel((x,y),(r,g,bb,a));vregions.putpixel((x,y),(0,255,0,255));frame.putpixel((x,y),(0,0,0,0))
      elif .66<h<.86 and sat>.22 and val>.15 and (y<66 or y>82):regions.putpixel((x,y),(255,0,0,255))
     else:
      cloth=(h<.035 or h>.93) and sat>.32 and val>.16 and r>g*1.65 and r>bb*1.12 and 35<x<88 and 64<y<96 and val<.75
      if cloth:regions.putpixel((x,y),(255,0,0,255))
   index=row*8+col;xy=(col*SIZE,row*SIZE);body.paste(frame,xy);effects.paste(vfx,xy);mask.paste(regions,xy);effectmask.paste(vregions,xy)
   combined=frame.copy();combined.alpha_composite(vfx);preview.paste(combined,(col*SIZE,(row+(5 if hero=='ember' else 0))*SIZE))
   meta['heroes'][hero].append({'state':name,'frame':index,'bounds':b,'anchor':anchor})
  # Pad a recovery cell with the last valid character pose, not invented art.
  if hero=='oath' and name=='heavy_right':
   for sheet in [body,effects,mask,effectmask]:sheet.paste(sheet.crop((6*SIZE,row*SIZE,7*SIZE,(row+1)*SIZE)),(7*SIZE,row*SIZE))
 for sheet,name in [(body,'combat.png'),(effects,'combat-effects.png'),(mask,'combat-mask.png'),(effectmask,'combat-effects-mask.png')]:sheet.save(p/name)
(ROOT/'docs/COMBAT_ASSET_PROVENANCE.json').write_text(json.dumps(meta,indent=2)+'\n')
preview.resize((768,864),Image.Resampling.NEAREST).save(ROOT/'docs/combat-normalized-preview.png')
