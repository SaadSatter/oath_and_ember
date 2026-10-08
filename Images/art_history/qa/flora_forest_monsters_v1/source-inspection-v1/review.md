# External creature source Review Card

PRIMARY REVIEW: source gate — no gameplay/video preview exists yet. All three originals are JPEGs with baked checkerboard, not transparent sprites. Preserve the originals and export original alpha-bearing PNGs from FLORA. Do not convert these JPEGs to PNG or remove checkerboard pixels.

Source package is `art/incoming/flora_forest_monsters_v1` (plural monsters); no singular package exists.

## Required replacement exports

- Mossling: `mossling_sprites.png`, FLORA run `run_m17bmpnatp6639mwr94pk6100s8frbpf`, output_0.
- Cinder Wisp: `cinder_wisp_sprites.png`, FLORA run `run_m17c139vexw4n2ssjd0jszddxd8frn4w`, output_0.
- Ironbound Sentinel: `ironbound_sentinel_sprites.png`, FLORA run `run_m17ap0zmzhhdperhs7cbr6nrch8fsx0s`, output_0.

Place alpha-bearing original exports beside the preserved JPGs in the source package. The existing CDN links returned JPEGs despite `.png` URL suffixes. A PNG export is usable only if its background contains actual alpha-zero pixels. If FLORA's original itself contains the checkerboard, it cannot be fixed by changing export format; obtain an original transparent version of the same artwork from its creator. Do not regenerate/redesign.

## Inspected structure

Each creature: JPEG RGB, 1024×1024, no alpha, 16 separate visible poses on an apparent uniform 4×4 / 256×256 cell grid. Entire decoded content bounds are 1024×1024 because the checkerboard is opaque. Approximate foreground bounds for every pose are in inspection.json; they are diagnostic RGB estimates, not exact extraction rectangles. Ground anchors are not verified; cell-relative silhouette baselines drift materially across rows/poses.

Rows top to bottom:

| Creature | Row 1 | Row 2 | Row 3 | Row 4 |
|---|---|---|---|---|
| Mossling | down/south | up/north | left/west | mostly right/east; final pose faces left |
| Cinder Wisp | down/south | up/north | right/east, turning | left/west, turning |
| Sentinel | down/south | up/north | left/west | right/east |

Columns are apparent sequential motion poses; frame timing and seamless loops remain REVIEW. Wisp orientation must not be copied from the other sheets.

## Scale and coherence

Heroes use 48×64 cells at scale 1, with first-idle visible heights Sieg 50px / Coco 51px. Estimated creature visible heights: Mossling 174–187px, Wisp 174–229px including flame/branches, Sentinel 193–218px. A raw 1× sheet integration would dwarf the heroes. No final runtime scale is selected without camera evidence. Preserve intended standard Mossling / smaller floating Wisp / large elite Sentinel hierarchy; do not equalize heights.

All three visually share moss, gray stone/wood and orange emissive details with the two forest references. Creature outlines are heavier and details denser than the small hero sprites; downsampling may lose expressive pixels. Wisp flame/branch shapes and yaw vary across frames; Mossling's last pose breaks row direction. Ground-baseline drift needs explicit anchor review. Lighting reads broadly from above, but consistency in gameplay is unverified. Forest concepts contain baked puzzle props and remain art-direction references only.

## Recommendation

- Mossling: REVIEW / IMPROVE submission — real alpha required; final east-row pose faces west; baseline drift.
- Cinder Wisp: REVIEW / IMPROVE submission — real alpha required; mixed side yaw, variable flame/branch extents and scale.
- Sentinel: REVIEW / IMPROVE submission — real alpha required; heavyweight hierarchy and foot alignment need camera review.

IMPROVE here means provide valid original exports and resolve indexing/anchor decisions, not redesign the approved art. Aesthetic approval remains human. APPROVE cannot bypass this objective source gate; REJECT: <reason> can end this candidate direction.

## Engineering state

No normalization, runtime atlases, animation names, test encounter or new combat/AI have been created. Runtime atlas hashes and scales are null. Three independent draft contracts are saved as `art/briefs/*_sprites_v1.external-draft.json`; they deliberately remain outside the supported runtime registry until alpha, anchors and loader/QA capabilities are resolved. No production binding is falsely declared.

Generic source inspection: `npm run art:inspect -- art/incoming/flora_forest_monsters_v1/mossling_sprites.png 4 4 16` (replace basename for each creature). Exit 2 means blocked. This reads actual signatures/alpha and per-frame bounds without modifying artwork. The same command accepts a future goblin sheet and arbitrary declared grid.

Game browser QA, both-client/responsive captures, normalized contact sheets and temporal video are blocked by source transparency. No primary video exists to watch yet. Continue with the same versioned source records after replacement PNGs pass inspection.

Validation: `npm run art:test` passed 70 tests in 9 files; `npm run typecheck` passed; `npm test` passed 133 tests in 19 files; `npm run build` passed (existing large-bundle warning). The source inspection command correctly exits 2 for the JPEG. Source artwork hashes match the download manifest. Browser/temporal integration QA was not run because there is no valid normalized creature candidate.
