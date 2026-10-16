"""Pack supplied transparent PixelLab originals without scaling or repainting."""
from pathlib import Path
from PIL import Image
import shutil,json,hashlib
root=Path(__file__).resolve().parents[1]
src=Path('/Users/saadsatter/Downloads/A_forest_iron_Golem-Idle')
archive=root/'Images/Sprites/monster_sprites/sources/forest-iron-golem'
if src.exists(): shutil.copytree(src,archive/'pixellab-export',dirs_exist_ok=True)
else: src=archive/'pixellab-export'
for d in ['north','west','east','south']:
    gif=Path('/Users/saadsatter/Downloads')/f'Idle_walking-8-frames_{d}.gif'
    if gif.exists(): shutil.copy2(gif,archive/f'walking-{d}.gif')
directions=['south','south-east','east','north-east','north','north-west','west','south-west']
sheet=Image.new('RGBA',(112*9,112*8));sources=[]
for row,d in enumerate(directions):
    files=[src/'Idle/rotations'/f'{d}.png']+[src/'Idle/animations/Walking'/d/f'frame_{n:03}.png' for n in range(8)]
    for col,p in enumerate(files):
        im=Image.open(p).convert('RGBA')
        # One translation per direction/animation preserves the original gait and pixels.
        reference=im if col==0 else Image.open(files[1]).convert('RGBA')
        dx=(112-im.width)//2;dy=92-reference.getbbox()[3]
        sheet.paste(im,(col*112+dx,row*112+dy));sources.append({'path':str(p.relative_to(src)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
out=root/'apps/client/public/assets/enemies/ironbound_sentinel';sheet.save(out/'forest-golem.png')
visual={'asset_id':'ironbound_sentinel_sprites_v2','url':'/assets/enemies/ironbound_sentinel/forest-golem.png','frame_dimensions':[112,112],'anchor':[56,92],'directions':directions,'x_edges':[n*112 for n in range(10)],'animation_frames':{d:list(range(1,9)) for d in directions},'standing_frames':{d:0 for d in directions},'scale':1,'fps':8,'motion':'walk'}
(out/'visual.json').write_text(json.dumps(visual,indent=2)+'\n')
(archive/'provenance.json').write_text(json.dumps({'source':'User-supplied PixelLab export, 2026-10-15','character_id':'978a376f-9b44-4891-a3df-d6c7068ad79b','processing':'Lossless RGBA packing, idle column 0 + 8 walking frames, 112px padded cells, native source pixels with one translation per direction/animation to center x56 and boot baseline y92. No background keying, resampling, recoloring, mirroring or frame-specific anchor changes. Original GIF references preserved separately.','runtime':str((out/'forest-golem.png').relative_to(root)),'sources':sources},indent=2)+'\n')
print('Packed 8 idle views and 64 walking frames, native resolution and alpha preserved.')
