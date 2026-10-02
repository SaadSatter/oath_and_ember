"""Explicit horizontal heavy poses from approved sheet; no debris-only final cell."""
from pathlib import Path
import runpy,colorsys,json
from PIL import Image
# Reuse reviewed matte cleanup; executing this also refreshes basic combat atlases.
base=runpy.run_path(str(Path(__file__).with_name('normalize_combat_references.py')))
root=base['ROOT'];im=base['im'];remove=base['remove_matte']
# Seven display cells, using four approved source poses; final debris-only cell omitted.
# Two clean wind-up poses, two usable swing poses, then source recovery.
# Omit crowded intermediate poses; hold the large arc for two display frames.
bounds=[(18,849,140,962),(106,845,252,962),(222,829,402,968),(565,804,753,977),(565,804,753,977),(18,849,140,962),(18,849,140,962)]
anchors=[72,170,269,613,613,72,72]
heads=[(82,874),(154,875),(272,880),(617,888),(617,888),(82,874),(82,874)]
atlas=Image.new('RGBA',(1024,128));mask=Image.new('RGBA',atlas.size)
for col,(b,ax,head) in enumerate(zip(bounds,anchors,heads)):
 crop=remove(im.crop(b),(ax-b[0],959-b[1]),(head[0]-b[0],head[1]-b[1]))
 frame=crop.transform((128,128),Image.Transform.AFFINE,(2,0,ax-b[0]-128,0,2,959-b[1]-192),resample=Image.Resampling.NEAREST,fillcolor=(0,0,0,0))
 regions=Image.new('RGBA',frame.size)
 for y in range(128):
  for x in range(128):
   r,g,bb,a=frame.getpixel((x,y));h,s,v=colorsys.rgb_to_hsv(r/255,g/255,bb/255)
   sx=ax+(x-64)*2;sy=959+(y-96)*2
   # Explicit overlap cleanup: neighboring scarf sliver / prior sword tip,
   # outside this pose's reviewed body and weapon silhouette.
   unrelated=(col==1 and ((sx>213 and sy>885 and (h<.07 or h>.93) and s>.3) or (sx<130 and sy>924))) or (col in [0,5,6] and sx>110 and sy>900 and (h<.07 or h>.93) and s>.3)
   if unrelated:frame.putpixel((x,y),(0,0,0,0));continue
   if a and (h<.035 or h>.93) and s>.32 and .16<v<.75 and r>g*1.65 and r>bb*1.12 and 35<x<88 and 64<y<96:regions.putpixel((x,y),(255,0,0,255))
 atlas.paste(frame,(col*128,0));mask.paste(regions,(col*128,0))
p=root/'apps/client/public/assets/characters/oath';atlas.save(p/'heavy.png');mask.save(p/'heavy-mask.png')
(root/'docs/HEAVY_ASSET_PROVENANCE.json').write_text(json.dumps({'source':'Images/Sprites/Basic Fighting Sprites.png','bounds':bounds,'anchors':anchors,'ground':959,'frame':[128,128],'foot':[64,96],'unused':'crowded intermediate poses and final debris-only cell; repeated source poses hold arc/recovery','mirror':'left; up/down basic fallback'},indent=2)+'\n')
atlas.resize((1024,128),Image.Resampling.NEAREST).save(root/'docs/heavy-normalized-preview.png')
