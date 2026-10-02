"""Normalize approved magic reference: stable core, looping ribbons, one-shot impact.
Explicit nonuniform pose bounds; remove opaque reference matte, no regenerated art.
"""
from pathlib import Path
from PIL import Image
import colorsys,json,hashlib,math
root=Path(__file__).resolve().parents[1]
source=root/'Images/Sprites/Magic Basic Spell.png'
im=Image.open(source).convert('RGBA');assert im.size==(1536,1024)
out=root/'apps/client/public/assets/effects/coco';out.mkdir(parents=True,exist_ok=True)
def clean(crop):
 for y in range(crop.height):
  for x in range(crop.width):
   r,g,b,a=crop.getpixel((x,y));h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
   warm=(h<.19 or h>.96) and r>g*1.03 and r>b*1.2 and v>.25
   white=min(r,g,b)>175
   if not(warm or white):crop.putpixel((x,y),(0,0,0,0));continue
   alpha=min(a,round(255*min(1,max(0,(v-.25)/.4))))
   crop.putpixel((x,y),(r,g,b,alpha))
 return crop
def frame(bounds,center,size,scale=.5):
 b=bounds;crop=clean(im.crop(b));inv=1/scale
 return crop.transform((size,size),Image.Transform.AFFINE,(inv,0,center[0]-b[0]-size/2*inv,0,inv,center[1]-b[1]-size/2*inv),resample=Image.Resampling.NEAREST,fillcolor=(0,0,0,0))
def mask_for(image):
 mask=Image.new('RGBA',image.size)
 for y in range(image.height):
  for x in range(image.width):
   r,g,b,a=image.getpixel((x,y))
   if a and min(r,g,b)<210:mask.putpixel((x,y),(0,255,0,255))
 return mask
# Right-facing source poses 2–5 contain the usable internal vortex phases.
# Startup pose 1, stretched trails 6/8 and label-only gap 7 are not flight phases.
poses=[((205,123,296,222),(250,172)),((295,123,393,223),(344,172)),((392,119,488,226),(441,171)),((491,126,592,227),(547,177))]
flight=Image.new('RGBA',(64*4,64))
for i,(b,c) in enumerate(poses):
 f=frame(b,c,64)
 for y in range(64):
  for x in range(64):
   r,g,bb,a=f.getpixel((x,y));d=math.hypot(x-32,y-32)
   # Remove the source cores; the separately extracted static core fills this hole.
   if d<7:a=0
   elif d<9:a=round(a*(d-7)/2)
   if d>26:a=0 # Exclude neighboring/elongated travel trails outside this ball.
   f.putpixel((x,y),(r,g,bb,a))
 flight.paste(f,(i*64,0))
core=frame((326,154,362,190),(344,172),32)
for y in range(32):
 for x in range(32):
  r,g,b,a=core.getpixel((x,y));d=math.hypot(x-16,y-16)
  if d>9:a=0
  elif d>7:a=round(a*(9-d)/2)
  core.putpixel((x,y),(r,g,b,a))
impacts=[((911,708,948,761),(929,737)),((960,694,1022,769),(991,733)),((1011,680,1103,777),(1058,732)),((1070,666,1205,794),(1135,732)),((1153,658,1295,795),(1224,732)),((1247,653,1403,799),(1325,732)),((1399,663,1524,798),(1445,731))]
impact=Image.new('RGBA',(96*len(impacts),96))
for i,(b,c) in enumerate(impacts):
 f=frame(b,c,96)
 # Adjacent expanding reference bursts overlap. Fade ownership boundaries
 # halfway between reviewed centers to discard neighboring clipped spokes.
 left=(c[0]-impacts[i-1][1][0])/4-1 if i else 30
 right=(impacts[i+1][1][0]-c[0])/4-1 if i+1<len(impacts) else 40
 for y in range(96):
  for x in range(96):
   r,g,bb,a=f.getpixel((x,y));d=x-48;limit=right if d>=0 else left
   fade=min(1,max(0,(limit-abs(d))/3))
   f.putpixel((x,y),(r,g,bb,round(a*fade)))
 impact.paste(f,(i*96,0))
for image,name in [(flight,'flight'),(core,'core'),(impact,'impact')]:
 image.save(out/(name+'.png'));mask_for(image).save(out/(name+'-mask.png'))
preview=Image.new('RGBA',(672,192),(22,44,43,255))
for i in range(4):
 f=flight.crop((i*64,0,(i+1)*64,64));f.alpha_composite(core,(16,16));preview.alpha_composite(f,(i*96,0))
preview.alpha_composite(impact,(0,96));preview.save(root/'docs/magic-projectile-normalized.png')
meta={'source':str(source.relative_to(root)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'flight':{'bounds_and_core_anchors':poses,'frame':[64,64],'anchor':[32,32],'fps':14,'loop':True,'source_poses':[2,3,4,5]},'core':{'bounds':[326,154,362,190],'frame':[32,32],'anchor':[16,16],'animated':False},'impact':{'bounds_and_anchors':impacts,'frame':[96,96],'anchor':[48,48],'fps':14,'loop':False,'count':7},'notes':'Opaque matte removed using warm/bright foreground. Final numbered 7/8 impact shares one dispersing cloud; seven distinct usable impact phases retained. No palette-variant rows copied.'}
(root/'docs/MAGIC_PROJECTILE_PROVENANCE.json').write_text(json.dumps(meta,indent=2)+'\n')
