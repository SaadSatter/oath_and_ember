"""Import the supplied Tiled exterior as finite presentation data; originals are untouched."""
from pathlib import Path
import json,xml.etree.ElementTree as E,shutil,hashlib
src=Path('Images/Sprites/Main House/Tiled_files');dest=Path('apps/client/public/assets/environment/main-house');r=E.parse(src/'Exterior.tmx').getroot()
layers=[];cells_all=[]
for l in r.findall('layer'):
 cells=[]
 for c in l.find('data').findall('chunk'):
  w=int(c.get('width'));ox=int(c.get('x'));oy=int(c.get('y'));data=[int(v) for v in c.text.replace('\n','').split(',') if v.strip()]
  cells.extend((ox+i%w,oy+i//w,v) for i,v in enumerate(data) if v)
 layers.append((l,cells));cells_all+=cells
left=min(x for x,y,v in cells_all);top=min(y for x,y,v in cells_all);width=max(x for x,y,v in cells_all)-left+1;height=max(y for x,y,v in cells_all)-top+1
# Verified tree regions in the authored exterior atlas, aligned to its 16px tile grid.
rects=[(192,224,64,160),(16,368,128,80),(144,384,48,64),(176,544,80,80),(192,688,64,64)]
def tree(g):
 gid=g&0xfffffff
 if 4122<=gid<6462:return True
 if not 757<=gid<1726:return False
 n=gid-757;x=n%17*16;y=n//17*16
 return any(a<=x<a+w and b<=y<b+h for a,b,w,h in rects)
treecells=set();outlayers=[]
for l,cells in layers:
 data=[0]*(width*height)
 for x,y,g in cells:
  if tree(g):treecells.add((x-left,y-top));continue
  data[(y-top)*width+x-left]=g
 outlayers.append({'id':int(l.get('id')),'name':l.get('name'),'type':'tilelayer','visible':True,'opacity':1,'x':0,'y':0,'width':width,'height':height,'data':data})
placements=[]
while treecells:
 q=[treecells.pop()];comp=set(q)
 while q:
  x,y=q.pop()
  for n in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
   if n in treecells:treecells.remove(n);comp.add(n);q.append(n)
 placements.append({'x':(min(x for x,y in comp)+max(x for x,y in comp)+1)*16,'y':(max(y for x,y in comp)+1)*32,'source_tile_bounds':[min(x for x,y in comp),min(y for x,y in comp),max(x for x,y in comp)+1,max(y for x,y in comp)+1]})
tilesets=[];sources=[]
for t in r.findall('tileset'):
 im=t.find('image');p=src/im.get('source');shutil.copy2(p,dest/p.name)
 tilesets.append({'firstgid':int(t.get('firstgid')),'name':t.get('name')+':'+t.get('firstgid'),'tilewidth':16,'tileheight':16,'tilecount':int(t.get('tilecount')),'columns':int(t.get('columns')),'image':p.name,'imagewidth':int(im.get('width')),'imageheight':int(im.get('height')),'margin':0,'spacing':0})
 sources.append({'source':str(p),'runtime':str(dest/p.name),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'exterior-map.json').write_text(json.dumps({'version':1.10,'type':'map','orientation':'orthogonal','renderorder':'right-down','infinite':False,'width':width,'height':height,'tilewidth':16,'tileheight':16,'layers':outlayers,'tilesets':tilesets}))
placements.sort(key=lambda p:(p['y'],p['x']))
(dest/'trees.json').write_text(json.dumps(placements,indent=2)+'\n')
for name in ['Tree1','Tree2','Tree3','Moss_tree1','Moss_tree2','Moss_tree3']:
 p=Path('Images/Sprites/forest tree art/PNG/Assets_separately/Trees')/(name+'.png');target=Path('apps/client/public/assets/environment/trees')/p.name;shutil.copy2(p,target);sources.append({'source':str(p),'runtime':str(target),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
Path('docs/ENVIRONMENT_ASSET_PROVENANCE.json').write_text(json.dumps({'map_source':str(src/'Exterior.tmx'),'map_sha256':hashlib.sha256((src/'Exterior.tmx').read_bytes()).hexdigest(),'operations':['Flatten infinite TMX chunks to finite27x20 grid at original tile size16; preserve layer order and Tiled flip flags','Remove verified tree tiles; replace at declared ground positions using supplied forest tree sprites','Runtime map uses integer2x scale; collision is independently authored in shared/maps.ts, not inferred from rendered art'],'tree_atlas_regions':rects,'sources':sources},indent=2)+'\n')
print(width,height,'tree placements',len(placements))
