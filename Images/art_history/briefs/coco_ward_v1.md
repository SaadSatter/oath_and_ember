# Generation brief: coco_ward_v1

See the JSON contract and art/ART_SPEC.md.

{
  "asset_id": "coco_ward_v1",
  "version": 1,
  "status": "BRIEF",
  "character": "coco",
  "animation": "ward",
  "source_file": "art/incoming/coco_ward_v1",
  "canonical_references": [
    "Images/Character Concept art.png",
    "Images/Sprites/Defense Basic Sprites.png",
    "docs/DEFENSE_ASSET_PROVENANCE.json"
  ],
  "runtime_files": [],
  "directions": [
    "omnidirectional"
  ],
  "frame_count": 1,
  "frame_dimensions": [
    128,
    128
  ],
  "anchor": [
    64,
    70
  ],
  "palette_behavior": {
    "source": "canonical_ember_magic",
    "runtime_recolor": true,
    "mask_channel": "green"
  },
  "qa_status": "NOT_RUN",
  "iteration": 0,
  "approved_at": null,
  "target": "assets/characters/ember/defense.png",
  "mask_target": "assets/characters/ember/defense-mask.png",
  "reports": [],
  "asset_type": "defensive_vfx",
  "perspective": "top_down",
  "frame_count_target": 1,
  "frame_dimensions_target": [
    128,
    128
  ],
  "ground_anchor": [
    64,
    70
  ],
  "canonical_reference": [
    "Images/Character Concept art.png",
    "Images/Sprites/Defense Basic Sprites.png",
    "docs/DEFENSE_ASSET_PROVENANCE.json"
  ],
  "approved_runtime_reference": "apps/client/public/assets/characters/ember/defense.png",
  "effect_behavior": "Separate hollow rim; existing start/held/end envelope; Coco body unchanged",
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
