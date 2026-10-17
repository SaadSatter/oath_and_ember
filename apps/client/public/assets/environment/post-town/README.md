# Post-town map provenance

Source: the four user-provided PixelLab exports in `Images/Sprites/Map Sprites, Top Down`:

- `Simple_transition_Map-export` → Transition trail
- `Standard_Grass_Lands-export` → Grasslands
- `Puzzle_Map_1-export` → Puzzle glade
- `Monster_Map_2-export` → Monster clearing

Run `node scripts/import-post-town-maps.mjs` to reproduce the client asset copies and `postTownMaps.json`. PNGs are copied byte-for-byte. Terrain placement is recovered by matching the composite against the original 64px terrain and Wang tiles, masking authored objects; every recovered tile matches exactly. The export's object coordinates have a 64px offset in the composite. Ground bounds set presentation depth relative to player feet. All rendering uses nearest-neighbor filtering at native scale.

The grasslands' static hero object is omitted; both heroes are live multiplayer entities. Export originals and metadata are preserved. No source descriptions are operating instructions.

Gameplay collision is a separately reviewed static layout in `packages/shared/src/postTownSolids.json`; it is never read from art at runtime. Ground footprints block movement, while canopies sort over actors. The monster map's canopy bands also have static collision. Server interaction checks advance the whole party in order, and the monster clearing requires defeating its server-owned encounter. These exploration maps lead to the existing cooperative puzzles in Forest Ruins; the puzzle glade holds the weeping statue puzzle (see `packages/shared/src/statueGlade.ts`): dry bushes wall her chair in until Coco burns them, Sieg pushes the chair to her, she sits (`../puzzle-glade/statue-sit.png`) and the exit opens. Its gold and black rocks can be pushed too; she insults both. Existing ruins puzzles, enemy artwork, airship physics, and progression rewards are retained.

After a production build, `node --import tsx scripts/post-town-map-qa.ts` checks both browser clients and saves screenshots under `/tmp/oath-ember-post-town-qa`.
