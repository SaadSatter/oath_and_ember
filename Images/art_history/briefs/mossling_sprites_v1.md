# Generation brief: mossling_sprites_v1

See the JSON contract and art/ART_SPEC.md.

{
  "asset_id": "mossling_sprites_v1",
  "version": 1,
  "status": "BRIEF",
  "character": "mossling",
  "animation": "sprites",
  "source_file": "art/incoming/mossling_sprites_v1",
  "canonical_references": [
    "Images/Character Concept art.png"
  ],
  "runtime_files": [],
  "directions": [
    "unspecified"
  ],
  "frame_count": 1,
  "frame_dimensions": [
    64,
    64
  ],
  "anchor": [
    32,
    32
  ],
  "palette_behavior": {},
  "qa_status": "NOT_RUN",
  "iteration": 0,
  "approved_at": null,
  "target": null,
  "mask_target": null,
  "reports": [],
  "art_spec": {
    "path": "art/ART_SPEC.md",
    "sha256": "32a3ff42dbe2bb6e83b365d4f1dfbb411679badd1ca86aaf64efe38a1bb856a3"
  },
  "canonical_reference_hashes": {
    "Images/Character Concept art.png": "d6cb8715f3f8d8630079b1a29cb97238482c2338c10096a351a424ed11ebce8d"
  },
  "approved_runtime_hash": null,
  "asset_type": "requires_engineer_binding",
  "perspective": "top_down",
  "frame_count_target": 1,
  "frame_dimensions_target": [
    64,
    64
  ],
  "ground_anchor": [
    32,
    32
  ],
  "canonical_reference": [
    "Images/Character Concept art.png"
  ],
  "approved_runtime_reference": null,
  "effect_behavior": "Game Engineer must declare animation behavior; no inferred effect template.",
  "must_preserve": [
    "canonical silhouette",
    "equipment",
    "hair",
    "skin",
    "costume proportions"
  ],
  "must_not_change": [
    "gameplay",
    "collision",
    "staff structure",
    "skin/hair/eyes palette"
  ],
  "acceptance_criteria": [
    "transparent horizontal atlas",
    "exact frame grid and anchor",
    "contract-specific safe mask strategy",
    "stable design across frames",
    "local/remote visibility",
    "four responsive viewports"
  ],
  "previous_feedback": []
}
