# Generation brief: sieg_shield_v1

See the JSON contract and art/ART_SPEC.md.

{
  "asset_id": "sieg_shield_v1",
  "version": 1,
  "status": "BRIEF",
  "character": "sieg",
  "animation": "shield",
  "source_file": "art/incoming/sieg_shield_v1",
  "canonical_references": [
    "Images/Character Concept art.png"
  ],
  "runtime_files": [],
  "directions": [
    "right",
    "left",
    "up",
    "down"
  ],
  "frame_count": 4,
  "frame_dimensions": [
    64,
    64
  ],
  "anchor": [
    32,
    32
  ],
  "palette_behavior": {
    "source": "canonical_ember_magic",
    "runtime_recolor": true,
    "mask_channel": "green"
  },
  "qa_status": "NOT_RUN",
  "iteration": 0,
  "approved_at": null,
  "target": null,
  "mask_target": null,
  "reports": [],
  "art_spec": {
    "path": "art/ART_SPEC.md",
    "sha256": "d16aaee905c5d9b27d5ddf8aeba905214cd4cd2d66ad9558749d197ec1b2809a"
  },
  "canonical_reference_hashes": {
    "Images/Character Concept art.png": "d6cb8715f3f8d8630079b1a29cb97238482c2338c10096a351a424ed11ebce8d"
  },
  "approved_runtime_hash": null,
  "asset_type": "requires_engineer_binding",
  "perspective": "top_down",
  "frame_count_target": 4,
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
  "effect_behavior": "Existing flight animation and authoritative projectile movement",
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
    "green effect-only mask",
    "stable design across frames",
    "local/remote visibility",
    "four responsive viewports"
  ],
  "previous_feedback": []
}
