"""Pack approved PixelLab ruin pillar artwork without resampling or recoloring."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'Images/Sprites/monster_sprites/sources/ruin-pillar/pixellab-export/A_tall_pillar_from_the_ruins'
base = Image.open(source / 'rotations/A_tall_pillar_from_the_ruins.png').convert('RGBA')
collapse = [Image.open(p).convert('RGBA') for p in sorted(source.glob('animations/*/unknown/frame_*.png'))]
assert base.size == (160, 160) and len(collapse) == 9
assert all(frame.size == base.size for frame in collapse)
# The supplied sequence ends with the shaft still in flight. Retain its lower
# debris as the settled state, keeping the original 160px cell and base anchor.
rubble = Image.new('RGBA', base.size)
rubble.paste(collapse[-1].crop((0, 106, 160, 160)), (0, 106))
frames = [base, *collapse, rubble]
sheet = Image.new('RGBA', (160 * len(frames), 160))
for i, frame in enumerate(frames):
    sheet.paste(frame, (160 * i, 0))
sheet.save(root / 'apps/client/public/assets/environment/griffin/pillar.png')
