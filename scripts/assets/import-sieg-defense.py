"""Import user-supplied defensive poses and walks without altering gameplay."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
source = ROOT / 'Images/Sprites/Sieg/Sieg_a_knight-Defensive_pose_cove/Defensive_pose_cove'
archive = ROOT / 'Images/Sprites/Sieg/defense-integration-v1'
out = ROOT / 'apps/client/public/assets/characters/oath'
archive.mkdir(exist_ok=True)
atlas = Image.new('RGBA', (128 * 9, 128 * 4))
mask = Image.new('RGBA', atlas.size)
records = []
for row, direction in enumerate(['south', 'north', 'east', 'west']):
    paths = [source / 'rotations' / f'{direction}.png'] + sorted((source / 'animations/Walking' / direction).glob('frame_*.png'))
    assert len(paths) == 9
    images = [Image.open(p).convert('RGBA') for p in paths]
    # Shared canvas anchor retains authored walking bobbing, matching idle/walk scale.
    anchor = (images[0].width / 2, max(im.getbbox()[3] for im in images))
    for col, (path, im) in enumerate(zip(paths, images)):
        resized = im.resize((round(im.width * .9), round(im.height * .9)), Image.Resampling.NEAREST)
        frame_anchor = (im.width / 2, im.getbbox()[3]) if col == 0 else anchor
        dx = 64 - round(frame_anchor[0] * resized.width / im.width)
        dy = 96 - round(frame_anchor[1] * resized.height / im.height)
        cell = Image.new('RGBA', (128, 128))
        cell.paste(resized, (dx, dy))
        atlas.paste(cell, (col * 128, row * 128))
        for y in range(128):
            for x in range(128):
                r, g, b, a = cell.getpixel((x, y))
                if a and r > 35 and r > g * 1.35 and r > b * 1.2 and abs(g-b) < 25:
                    mask.putpixel((col * 128 + x, row * 128 + y), (255, 0, 0, a))
        records.append({'path': str(path.relative_to(ROOT)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'frame': row * 9 + col, 'source_anchor': frame_anchor, 'offset': [dx, dy]})
atlas.save(out / 'defense-user-v1.png')
mask.save(out / 'defense-mask.png')
(archive / 'provenance.json').write_text(json.dumps({'authorization': 'User supplied and requested Sieg defensive poses and walking animation replacement.', 'operations': ['Transparent source PNGs from supplied export; GIFs retained as reference', 'Nearest-neighbor scale 0.9, matching Sieg locomotion', 'Shared directional ground anchor at (64,96)', 'Red cloth palette mask; no gameplay changes'], 'frames': records}, indent=2) + '\n')
