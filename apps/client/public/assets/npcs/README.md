# Village NPC sheets

User-authored PixelLab characters, packed by `node scripts/import-village-npcs.mjs`
from the source frames in `Images/Sprites/Village_NPCs/<slug>/` (each folder
has a `provenance.json` with the PixelLab character id and source URLs).

Each sheet is a grid of 96px cells, frames centred. Rows: south, east, north,
west. Column 0 is the standing rotation; columns 1–8 are the 8-frame walk.

| Sheet | PixelLab character | Walk |
| --- | --- | --- |
| old_man.png | An old man village character (88bc4fa7…) | 4 dir |
| mother.png | Mother of main characters (2d5afcaa…) | 4 dir (north/west generated 2026-10-16; the sheet's west walk is the east walk mirrored, because the generated west frames turn toward the camera) |
| wizard.png | A Wizard NPC (11ddf472…) | 4 dir |
| townsfolk.png | Common townfolk woman (5232997b…) | 4 dir (generated 2026-10-16) |
| healer.png | Shop Owner for health (53aeccfd…) | standing only |

`alden.png` (story NPC) is packed separately by `node scripts/import-alden.mjs`
from `Images/Sprites/Story_NPCs/alden/` (PixelLab character fce323ef…): 112px
cells; rows south/east/north/west (standing + 8 walk, west = east mirrored);
row 4 is the 9-frame south spellcast. See `docs/PROLOGUE.md`.
