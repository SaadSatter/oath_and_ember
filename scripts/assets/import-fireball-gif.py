"""Pack the supplied GIF's four types; preserve timing and original sources."""
from PIL import Image
from pathlib import Path
from collections import deque
import json, shutil, sys, hashlib
source, icons = map(Path, sys.argv[1:3])
root = Path('Images/Sprites/coco_fireball/v2')
root.mkdir(parents=True, exist_ok=True)
shutil.copy2(source, root/'source.gif'); shutil.copy2(icons, root/'icon-source.png')
out = Path('apps/client/public/assets/effects/coco')
gif = Image.open(source)
assert gif.size == (174,51) and gif.n_frames == 9

def clear_background(im):
    im = im.convert('RGBA'); pixels = im.load(); w,h = im.size
    bg = pixels[0,0][:3]; seen = set(); q = deque()
    def visit(x,y):
        if not (0<=x<w and 0<=y<h) or (x,y) in seen: return
        seen.add((x,y)); r,g,b,a = pixels[x,y]
        if not a or max(abs(v-c) for v,c in zip((r,g,b),bg)) <= 8 or max(r,g,b)-min(r,g,b)<=3 or (max(r,g,b)<60 and b>=r and b>=g):
            pixels[x,y]=(r,g,b,0);q.append((x,y))
    for x in range(w):visit(x,0);visit(x,h-1)
    for y in range(h):visit(0,y);visit(w-1,y)
    while q:
        x,y=q.popleft()
        for dx,dy in ((-1,0),(1,0),(0,-1),(0,1)):visit(x+dx,y+dy)
    return im

atlas=Image.new('RGBA',(48*36,40)); edges=[0,45,88,132,174]; durations=[]
for frame in range(9):
    gif.seek(frame); durations.append(gif.info['duration']); image=gif.convert('RGBA')
    for level in range(4):
        cell=clear_background(image.crop((edges[level],3,edges[level+1],37)))
        atlas.paste(cell,((level*9+frame)*48+(48-cell.width)//2,3))
assert durations==[130]*9
atlas.save(out/'fireball.png');atlas.save(root/'atlas.png')
mask=Image.new('RGBA',atlas.size); p=atlas.load();m=mask.load()
for y in range(atlas.height):
    for x in range(atlas.width):
        r,g,b,a=p[x,y]
        if a and not(r>220 and g>200):m[x,y]=(0,0,255,a)
mask.save(out/'fireball-mask.png')
icon_source=Image.open(icons).convert('RGBA'); w,h=icon_source.size
# Four supplied level portraits, preserved at native resolution within equal icon cells.
icon_edges=[0,round(w*.27),round(w*.52),round(w*.76),w]
for level in range(4):
    cell=clear_background(icon_source.crop((icon_edges[level],0,icon_edges[level+1],h)))
    icon=Image.new('RGBA',(max(icon_edges[i+1]-icon_edges[i] for i in range(4)),h))
    icon.paste(cell,((icon.width-cell.width)//2,0));icon.save(out/f'fireball-level-{level+1}.png')
(root/'provenance.json').write_text(json.dumps({'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'icon_source_sha256':hashlib.sha256(icons.read_bytes()).hexdigest(),'frame_durations_ms':durations,'levels':4,'frames_per_level':9,'operations':['Decode composited GIF frames; crop each strength type and pad without rescaling','Remove edge-connected background, including opaque first-frame backdrop','Crop icons from user-supplied four-level portrait strip'],'previous_source':'../v1'},indent=2))
