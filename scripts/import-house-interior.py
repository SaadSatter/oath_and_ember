"""Flatten supplied Interior1 TMX, preserving source pixels, layers and flip flags."""
from pathlib import Path
import xml.etree.ElementTree as E
import json, shutil, hashlib
src=Path('Images/Sprites/Map Sprites, Top Down/Main House/Tiled_files')
dest=Path('apps/client/public/assets/environment/main-house');dest.mkdir(parents=True,exist_ok=True)
r=E.parse(src/'Interior1.tmx').getroot();layers=[];all=[]
for l in r.findall('layer'):
 cells=[]
 for c in l.find('data').findall('chunk'):
  w=int(c.get('width'));ox=int(c.get('x'));oy=int(c.get('y'))
  cells.extend((ox+i%w,oy+i//w,g) for i,g in enumerate(int(v) for v in c.text.replace('\n','').split(',') if v.strip()) if g)
 layers.append((l,cells));all+=cells
left=min(x for x,y,g in all);top=min(y for x,y,g in all)
width=max(x for x,y,g in all)-left+1;height=max(y for x,y,g in all)-top+1
out=[]
for l,cells in layers:
 data=[0]*(width*height)
 for x,y,g in cells:data[(y-top)*width+x-left]=g
 out.append(dict(id=int(l.get('id')),name=l.get('name'),type='tilelayer',visible=True,opacity=1,x=0,y=0,width=width,height=height,data=data))
sets=[];sources=[]
for t in r.findall('tileset'):
 im=t.find('image');p=src/im.get('source');shutil.copy2(p,dest/p.name)
 sets.append(dict(firstgid=int(t.get('firstgid')),name=t.get('name')+':'+t.get('firstgid'),tilewidth=16,tileheight=16,tilecount=int(t.get('tilecount')),columns=int(t.get('columns')),image=p.name,imagewidth=int(im.get('width')),imageheight=int(im.get('height')),margin=0,spacing=0))
 sources.append(dict(source=str(p),runtime=str(dest/p.name),sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
output=dest/'interior-map.json'
output.write_text(json.dumps(dict(version=1.10,type='map',orientation='orthogonal',renderorder='right-down',infinite=False,width=width,height=height,tilewidth=16,tileheight=16,layers=out,tilesets=sets)))
Path('docs/HOUSE_INTERIOR_PROVENANCE.json').write_text(json.dumps(dict(source=str(src/'Interior1.tmx'),sha256=hashlib.sha256((src/'Interior1.tmx').read_bytes()).hexdigest(),source_tile_origin=[left,top],tile_grid=[width,height],tile_size=16,world_scale=2,operations=['Flatten authored chunks; preserve GIDs/flip flags/layer order; no pixel edits','No viewport-dependent environment scaling; static initial animation poses'],runtime_sha256=hashlib.sha256(output.read_bytes()).hexdigest(),sources=sources),indent=2)+'\n')
print(width,height,[t['name'] for t in sets])
