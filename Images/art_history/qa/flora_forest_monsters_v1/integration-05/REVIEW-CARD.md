# Canonical side-walk review — source revision 05

HUMAN APPROVED — Mossling and Ironbound Sentinel, source revision 05. [Recorded decision](human-decision.json). Approved snapshots preserved. Historical review findings below remain unchanged. No publication.

[PRIMARY: right → left → stop beside Sieg/Coco](browser/PRIMARY-right-left-stop.webm)

[Inspection, identity, anchors, transforms and hashes](review-findings.json) · [Leg articulation / rigid-translation diagnostics](articulation-inspection.json)

## Mossling

REVIEW: roots/arms articulate in place, but the two contact poses are similar and the gait remains stylized. Confirm alternating-root readability before approval.

[Individual right/left/stop video](browser/mossling_sprites_v2-right-left-stop.webm) · [Canonical contact sheet](mossling_sprites_v2/contact-sheet.png) · [Source boundaries](mossling_sprites_v2/source-boundaries.png) · [Composition provenance](mossling_sprites_v2/composition.json)

## Ironbound Sentinel

REVIEW: clearer heavy knee/foot movement and small bob; review the contact-to-passing transitions and directional flip before approval.

[Individual right/left/stop video](browser/ironbound_sentinel_sprites_v2-right-left-stop.webm) · [Canonical contact sheet](ironbound_sentinel_sprites_v2/contact-sheet.png) · [Source boundaries](ironbound_sentinel_sprites_v2/source-boundaries.png) · [Composition provenance](ironbound_sentinel_sprites_v2/composition.json)

## Answers

- mossling_walk_vs_slide: Lower root/leg silhouette changes cannot be explained by a single rigid translation, and world x/y remain fixed. Articulation is visible; contact 1 vs 3 and opposite-leg readability still need human review.
- sentinel_walk_vs_slide: Knee/foot and opposing-arm poses change while world x/y remain fixed; clearer articulation than the rejected source. Passing/contact weight-transfer quality still needs human judgment.
- grounding: Fixed centered anchor. Mossling core bottom variation 0 source pixels; Sentinel 3 pixels (0.84 world pixels at side scale .28). No per-frame origin or position edits.
- horizontal_mirroring: No side-specific weapon or emblem prevents mirroring. Left reverses local lighting/organic detail, so visual acceptability remains REVIEW.
- direction_change_jump: World anchor, scale and canonical animation phase remain fixed across east/west changes. Mirrored silhouette naturally reverses; visible pivot/readability must be checked in primary video.
- identity: Conceptual Flora identity preserved; exact shading/detail match is human REVIEW.
- weight_hierarchy: Sentinel side body approximately63 world pixels high vs Mossling36; Sentinel remains the heavier/larger creature.

APPROVE / IMPROVE: <feedback> / REJECT: <reason>

Validation: 78 art tests, 141 full tests; typecheck/build/browser QA passed. [Validation record](validation.json)
