"""Pack supplied PixelLab sleep rotations and south wake-up without resampling."""
from pathlib import Path
from PIL import Image
import json
root = Path(__file__).resolve().parents[1]
src = root / 'Images/Sprites/monster_sprites/sources/griffin-sleep/pixellab-export'
meta = json.loads((src/'metadata.json').read_text())['states'][0]['frames']
dirs = ['south','south-east','east','north-east','north','north-west','west','south-west']
paths = [meta['rotations'][d] for d in dirs] + meta['animations']['Standing']['south']
sheet = Image.new('RGBA',(176*len(paths),176))
for i,p in enumerate(paths):
    im = Image.open(src/p).convert('RGBA')
    assert im.size == ((128,128) if i < 8 else (176,176))
    # Stable base anchor: native sleep (64,106), wake-up (74,136).
    cell = Image.new('RGBA',(176,176))
    cell.alpha_composite(im, (24,24) if i < 8 else (14,-6))
    sheet.paste(cell,(176*i,0))
sheet.save(root/'apps/client/public/assets/enemies/griffin/sleep.png')
