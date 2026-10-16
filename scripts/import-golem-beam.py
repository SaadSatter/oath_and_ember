"""White/blue palette variant of the approved continuous-beam alpha mask."""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=Image.open(root/'apps/client/public/assets/enemies/griffin/beam-middle.png').convert('RGBA')
beam=Image.new('RGBA',source.size,(232,250,255,0))
beam.putalpha(source.getchannel('A'))
beam.save(root/'apps/client/public/assets/enemies/ironbound_sentinel/beam-middle.png')
