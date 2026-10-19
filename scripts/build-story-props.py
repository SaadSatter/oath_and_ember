# Copy the guild pack sprites the Chapter 0 story scatters around Alden's shop
# into apps/client/public/assets/environment/story. Pixels are copied, never
# repainted; the toppled chair is the pack's chair turned on its side
# (an exact 90-degree rotation).
#   python3 scripts/build-story-props.py
from PIL import Image
SRC = "Images/Sprites/Map Sprites, Top Down/Guild or magical building/PNG/Interior_objects.png"
OUT = "apps/client/public/assets/environment/story"
sheet = Image.open(SRC).convert("RGBA")
crops = {
    "book-open-1": (2, 2, 15, 14),
    "book-open-2": (33, 2, 46, 14),
    "book-open-3": (17, 19, 30, 30),
    "chair": (1, 355, 13, 377),
}
for name, box in crops.items():
    im = sheet.crop(box)
    if name == "chair":
        im = im.transpose(Image.Transpose.ROTATE_90)
        name = "chair-toppled"
    im.save(f"{OUT}/{name}.png")
    print(name, im.size)
