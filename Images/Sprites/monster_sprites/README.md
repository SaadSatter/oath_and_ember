# Monster sprites

Current human-approved designs, preserved without pixel changes:

- `mossling/v3/atlas.png` — current Mossling, user-supplied eight-frame directional walks and idle poses. Source PNGs and GIFs are retained in `sources/mossling-user-export-v3/`; packing and offsets are recorded in `mossling/v3/provenance.json`.
- `mossling/atlas.png` — previous approved Mossling, revision v2, preserved unchanged.
- `cinder_wisp/atlas.png` — Cinder Wisp, revision v1.
- `ironbound_sentinel/atlas.png` — Ironbound Sentinel, revision v2.

Each folder includes the original approval, frame/anchor contract and transformation record. `sources/` preserves the externally supplied artwork, forest references, transparent replacements and previous source attempts unchanged. `preservation.json` records the original approved paths and verifies each atlas matches its existing runtime copy. Historical paths in metadata are retained for provenance.

The game continues to use `apps/client/public/assets/enemies/`. The former multi-role art workflow and its commands have been removed. No replacement art workflow is imposed.
