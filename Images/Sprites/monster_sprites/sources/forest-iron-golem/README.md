# User-approved Forest Iron Golem replacement

Supplied by the user on 2026-10-15 to replace the forest Ironbound Sentinel appearance. Original PixelLab export and the four GIF references are preserved here; previous approved sentinel artwork remains untouched in its original source/archive folders.

Runtime: `apps/client/public/assets/enemies/ironbound_sentinel/forest-golem.png` and `visual.json`. Eight native idle directions and eight-frame walking clips. Idle uses atlas column 0; walking uses columns 1–8. No generated attack/death artwork, recoloring, resizing or horizontal aliases.

Mixed source canvas sizes (80px idle, 96px south walk, 112px other walks) are padded losslessly into 112px cells. Each direction/clip uses a fixed translation to the common center and boot baseline (56,92). All gait offsets remain unchanged within that clip. Nearest-neighbor filtering and native pixel scale are explicit.

`provenance.json` records each original PNG's SHA-256. `scripts/import-forest-golem.py` reproducibly packs the atlas and can use this preserved export if the Downloads originals move.

Only rendering metadata and direction selection changed. Existing enemy identity, stats, collision, AI and maze passive-sentinel behavior remain authoritative and unchanged.

Presentation QA: `scripts/qa-forest-golem.ts` exercises all eight walking directions and idle in two browser clients using isolated server-side visual fixtures. Screenshots in `docs/quests/bald-goddess/qa/golem-*.png`.
