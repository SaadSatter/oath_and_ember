# Oath & Ember — Flora forest creature review

**Status: NEEDS_HUMAN_REVIEW. Nothing published or automatically approved.**

[PRIMARY REVIEW — all three animated beside Sieg/Coco](browser/PRIMARY-REVIEW.webm)

[Gameplay scale](browser/primary-all-creatures-scale.png) · [Decoded temporal evidence](browser/temporal-decoded/primary-temporal-contact.png) · [Exact provenance, anchors, directions and findings](review-findings.json)

Original PNG: 2172×724. Alpha: 735,670 zero; 836,858 nonzero; 835,847 partial; 1,011 opaque. Genuine alpha passes the ingestion gate; unusually extensive partial alpha and edge fringes remain aesthetic review findings.

Each region has 16 substantial alpha silhouettes in four directional rows. Spacing is nonuniform; source edges are recorded in each contract and normalization report. Result: 272×288 frames, 1088×1152 atlas, fixed (136,260) anchor, eight FPS, original left-to-right order. No pose individually recentered.

## Mossling

IMPROVE: east row frame 4 faces west. Leaves/branches survive intact, but small details shimmer when reduced; review red edge specks and fractional display sampling.

Region (x,y,w,h): [0, 0, 750, 724]; rows: south, north, west, east; scale: 0.25.

[Mossling animation](browser/mossling_sprites_v1.webm) · [Contact sheet](mossling_sprites_v1/contact-sheet.png) · [Atlas](mossling_sprites_v1/atlas.png) · [Source boundaries](mossling_sprites_v1/source-cells.png) · [Identity comparison](mossling_sprites_v1/identity-comparison.png) · [Decoded video frames](mossling_sprites_v1/temporal-contact.png) · [Normalization/hash](mossling_sprites_v1/normalization.json)

## Cinder Wisp

IMPROVE: west row frames 2 and 4 turn toward east; side poses change yaw. Flame-tail swing produces up to 21 source-pixel bottom variation (3.94 world pixels). Body floats convincingly, but tail/branch detail is small in portrait.

Region (x,y,w,h): [750, 0, 675, 724]; rows: south, north, east, west; scale: 0.1875.

[Cinder Wisp animation](browser/cinder_wisp_sprites_v1.webm) · [Contact sheet](cinder_wisp_sprites_v1/contact-sheet.png) · [Atlas](cinder_wisp_sprites_v1/atlas.png) · [Source boundaries](cinder_wisp_sprites_v1/source-cells.png) · [Identity comparison](cinder_wisp_sprites_v1/identity-comparison.png) · [Decoded video frames](cinder_wisp_sprites_v1/temporal-contact.png) · [Normalization/hash](cinder_wisp_sprites_v1/normalization.json)

## Ironbound Sentinel

REVIEW / recommendation APPROVE pending human acceptance of source differences: heavy silhouette and hierarchy read clearly; rows are directionally consistent. Foot bounds vary at most 4 source pixels (1.5 world pixels), but fine shaded stone/armor is denser than the heroes.

Region (x,y,w,h): [1425, 0, 747, 724]; rows: south, north, west, east; scale: 0.375.

[Ironbound Sentinel animation](browser/ironbound_sentinel_sprites_v1.webm) · [Contact sheet](ironbound_sentinel_sprites_v1/contact-sheet.png) · [Atlas](ironbound_sentinel_sprites_v1/atlas.png) · [Source boundaries](ironbound_sentinel_sprites_v1/source-cells.png) · [Identity comparison](ironbound_sentinel_sprites_v1/identity-comparison.png) · [Decoded video frames](ironbound_sentinel_sprites_v1/temporal-contact.png) · [Normalization/hash](ironbound_sentinel_sprites_v1/normalization.json)

## QA and launch

Art tests: 74 passed. Browser errors: zero. Full tests: 137 passed. Typecheck and build: PASS (existing large bundle warning). [Validation record](validation.json). Presentation-only entities: no combat/AI or protocol changes. Two independent review clients match; these creatures are not network-visible.

[Portrait](browser/responsive-390x844.png) · [Landscape](browser/responsive-844x390.png) · [Desktop](browser/responsive-1920x1080.png) · [Client 1](browser/independent-client-1.png) · [Client 2](browser/independent-client-2.png)

```sh
npm run art:encounter -- art/qa/flora_forest_monsters_v1/integration-02
```

Open http://127.0.0.1:3016/art-encounter.html. Press 1/2 for Sieg/Coco; arrows approach. Both forest reference images remain canonical art direction, not maps.

Respond: `APPROVE`, `IMPROVE: <feedback>`, or `REJECT: <reason>`. Final aesthetic authority is human.

Identity review: conceptual designs remain recognizable, but replacement proportions/pose details differ from the JPEG references, especially Sentinel helmet/torso. No source edits were performed. Exact matching remains a human review finding.
