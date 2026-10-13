"""Import the four supplied fighting GIFs, retaining all nine authored poses."""
from PIL import Image,ImageSequence
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[2];source=root/'Images/Sprites/Sieg';archive=source/'fighting-integration-v3';archive.mkdir(exist_ok=True)
old=root/'apps/client/src/animation/siegAttackFrames.json'
if not (archive/'previous-frame-metadata.json').exists():(archive/'previous-frame-metadata.json').write_bytes(old.read_bytes())
atlas=Image.new('RGBA',(1536,512));mask=Image.new('RGBA',atlas.size)
meta={'canvas':[128,128],'pivot':[64,96],'scale':.9,'scaleReason':'Matches approved Sieg locomotion scale with shared directional ground anchors.','directions':{}}
records=[]
for row,(direction,name,total) in enumerate([('right','east',765),('up','north',655),('down','south',710),('left','west',765)]):
 path=source/f'Fighting_stance_hol_custom-Wind_up_the_blade_by_pulling_i_{name}.gif';gif=Image.open(path);frames=[]
 for f in ImageSequence.Iterator(gif):
  im=f.convert('RGBA')
  for y in range(im.height):
   for x in range(im.width):
    r,g,b,a=im.getpixel((x,y))
    if g>150 and g>r*1.5 and g>b*1.5:im.putpixel((x,y),(0,0,0,0))
  frames.append(im)
 assert len(frames)==9
 w,h=frames[0].size;strip=Image.new('RGBA',(w*len(frames),h));ax=w/2;ay=max(f.getbbox()[3] for f in frames)
 data=[]
 for i,im in enumerate(frames):
  strip.paste(im,(i*w,0));rect=[i*w,0,(i+1)*w,h]
  cell=im.transform((128,128),Image.Transform.AFFINE,(1/.9,0,ax-64/.9,0,1/.9,ay-96/.9),resample=Image.Resampling.NEAREST)
  atlas.paste(cell,(i*128,row*128))
  for y in range(128):
   for x in range(128):
    r,g,b,a=cell.getpixel((x,y))
    if a and r>35 and r>g*1.35 and r>b*1.2 and abs(g-b)<25:mask.putpixel((i*128+x,row*128+y),(255,0,0,a))
  data.append({'frame':row*12+i,'rect':rect,'pivot':[i*w+ax,ay],'durationMs':total//9+(total%9 if i==8 else 0)})
 stripPath=archive/f'{name}-decoded.png';strip.save(stripPath)
 meta['directions'][direction]={'source':str(stripPath.relative_to(root)),'frames':data}
 records.append({'source':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'frames':len(frames)})
out=root/'apps/client/public/assets/characters/oath';atlas.save(out/'basic.png');mask.save(out/'basic-mask.png');old.write_text(json.dumps(meta,indent=2)+'\n')
(root/'docs/SIEG_ATTACK_PROVENANCE.json').write_text(json.dumps({'authorization':'User requested replacement fighting animations with four supplied GIFs and stance export.','sources':records,'operations':['Decoded every frame; green matte removed','Independent west artwork, no east mirroring','Nearest-neighbor normalization at 0.9 scale, anchor (64,96)','Red cloth palette mask','Existing directional attack presentation durations retained']},indent=2)+'\n')

# Heavy release uses the same authored sequence at the existing 500 ms envelope.
heavy=Image.new('RGBA',atlas.size);heavyMask=Image.new('RGBA',atlas.size)
for row in range(4):
 for col,original in enumerate([0,1,*range(9)]):
  box=(original*128,row*128,(original+1)*128,(row+1)*128)
  heavy.paste(atlas.crop(box),(col*128,row*128));heavyMask.paste(mask.crop(box),(col*128,row*128))
heavy.save(out/'heavy.png');heavyMask.save(out/'heavy-mask.png')
