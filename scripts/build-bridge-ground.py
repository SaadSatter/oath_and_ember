from PIL import Image
import json, pathlib
base=pathlib.Path('apps/client/public/assets/environment/bridge-ruins')
meta={n:json.load(open(base/f'{n}-tiles.json')) for n in ['water','stone']}
images={n:Image.open(base/f'{n}-tiles.png').convert('RGBA') for n in meta}
grid={}
for y in range(48):
 for x in range(30):
  t='grass'
  if 12<=x<18 and 10<=y<40:t='water'
  if (6<=x<12 or 18<=x<24) and 8<=y<42 or 6<=x<24 and (42<=y<46 or 3<=y<9):t='stone'
  grid[x,y]=t
out=Image.new('RGBA',(960,1536))
for (x,y),t in grid.items():
 n='water' if t=='water' or any(grid.get(q)=='water' for q in [(x-1,y-1),(x,y-1),(x-1,y)]) else 'stone'
 lower='water' if n=='water' else 'grass'
 corners={k:('lower' if grid.get(q,'grass')==lower else 'upper') for k,q in [('NW',(x-1,y-1)),('NE',(x,y-1)),('SW',(x-1,y)),('SE',(x,y))]}
 tiles=meta[n]['tileset_data']['tiles'];tile=next(a for a in tiles if a['corners']==corners);b=tile['bounding_box'];out.paste(images[n].crop((b['x'],b['y'],b['x']+32,b['y']+32)),(x*32,y*32))
# Full stone aprons under both bridge ends, independent of Wang shoreline rounding.
full=next(t for t in meta['stone']['tileset_data']['tiles'] if all(c=='upper' for c in t['corners'].values()))['bounding_box']
tile=images['stone'].crop((full['x'],full['y'],full['x']+32,full['y']+32))
for y in [1184,800]:
 for dx in [352,384,576,608]:
  for dy in [y,y+32]:out.paste(tile,(dx,dy))
out.save(base/'ground.png')
