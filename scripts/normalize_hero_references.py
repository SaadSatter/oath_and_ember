"""Extract approved poses; no regeneration, paint-over, alpha removal or grid slicing.
Run with the bundled Pillow Python. Explicit bounds/foot anchors are reviewed
against the ORIGINAL 2172x724 sheet, not the resized chat preview.
"""
from pathlib import Path
from PIL import Image
import json
import hashlib

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Images/Sprites/Sprites2.png'
FRAME = (48, 64)
FOOT = (24, 60)
SOURCE_SCALE = 0.22
# Explicit nonuniform bounding boxes and anatomical ground anchors, in source pixels.
POSES = {
    'oath': {
        'down': ((198, 23, 367, 251), (306, 251), False),
        'up': ((400, 24, 571, 243), (466, 243), False),
        'left': ((579, 24, 720, 250), (628, 250), False),
        'right': ((736, 24, 914, 250), (811, 250), False),
    },
    'ember': {
        'down': ((1268, 17, 1447, 248), (1362, 248), False),
        'up': ((1467, 17, 1626, 248), (1540, 248), False),
        # There is no clearly distinct left-facing idle in the clean top row.
        'left': ((1852, 17, 2025, 250), (1950, 250), True),
        'right': ((1852, 17, 2025, 250), (1950, 250), False),
    },
}

def normalize(image, bounds, anchor, mirror):
    crop = image.crop(bounds)
    dx, dy = anchor[0] - bounds[0], anchor[1] - bounds[1]
    sx = (-1 if mirror else 1) / SOURCE_SCALE
    sy = 1 / SOURCE_SCALE
    # One common transform scale, with the explicit foot origin fixed per pose.
    # Reflect about FOOT.x, rather than around the canvas's half-pixel center.
    return crop.transform(FRAME, Image.Transform.AFFINE,
        (sx, 0, dx - FOOT[0] * sx, 0, sy, dy - FOOT[1] * sy),
        resample=Image.Resampling.NEAREST, fillcolor=(0, 0, 0, 0))

def main():
    image = Image.open(SOURCE).convert('RGBA')
    assert image.size == (2172, 724), 'Reference changed: review bounds before extraction.'
    provenance = {'source': str(SOURCE.relative_to(ROOT)),
        'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'frameSize': FRAME, 'footAnchor': FOOT, 'sourceScale': SOURCE_SCALE,
        'resampling': 'nearest', 'walking': 'directional-idle fallback; no walk cycle inferred', 'heroes': {}}
    preview = Image.new('RGBA', (FRAME[0] * 4, FRAME[1] * 2))
    for row, (hero, poses) in enumerate(POSES.items()):
        directory = ROOT / 'apps/client/public/assets/characters' / hero
        directory.mkdir(parents=True, exist_ok=True)
        sheet = Image.new('RGBA', (FRAME[0] * 4, FRAME[1]))
        provenance['heroes'][hero] = {}
        for col, (direction, (bounds, anchor, mirror)) in enumerate(poses.items()):
            frame = normalize(image, bounds, anchor, mirror)
            assert frame.getbbox() is not None
            assert frame.getpixel((0, 0))[3] == 0
            frame.save(directory / f'idle_{direction}.png')
            sheet.paste(frame, (col * FRAME[0], 0))
            preview.paste(frame, (col * FRAME[0], row * FRAME[1]))
            provenance['heroes'][hero][f'idle_{direction}'] = {
                'bounds': bounds, 'sourceFootAnchor': anchor, 'mirrored': mirror,
                'frameIndex': col, 'normalizedBounds': frame.getbbox()}
        sheet.save(directory / 'top-down-idles.png')
    (ROOT / 'docs/HERO_ASSET_PROVENANCE.json').write_text(json.dumps(provenance, indent=2) + '\n')
    preview.resize((768, 512), Image.Resampling.NEAREST).save(ROOT / 'docs/normalized-heroes-preview.png')
    print('Created eight transparent 48x64 poses, two 192x64 sheets, and provenance.')

if __name__ == '__main__':
    main()
