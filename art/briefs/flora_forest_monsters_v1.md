# FLORA forest and monster candidate brief v1

Workspace: ws_qd79c48t3nna3s5900kfdd89p58frnky
Project: prj_ns7ajke2xjtg8f9anqnma777xx8fspwx
Workflow: flora-batch-generate
Skill run: oath-ember-forest-monsters-v1-20261006

Deliverables: two 2:1 forest map directions (Mosslight Ruins and Twilight Brambles), and three 4x4 directional sprite-sheet candidates (Mossling, Cinder Wisp, Ironbound Sentinel). Mossling exists in gameplay; the other enemies remain planned content.

Source of truth: packages/shared/src/maps.ts, docs/GAMEPLAY.md, art/ART_SPEC.md, art/VISUAL_QA.md and art/agents/*.md.

Map composition follows the existing 1800x900 world, spawn (120,450), vertical barrier footprints x450–485 and x1050–1085 with openings y370–530, gate interactions (410,400)/(410,505), crate (790,430), plate (945,430), crystal (920,520), exit (1670,450). Dynamic mechanisms are separate overlays, never baked into static terrain. No gameplay or collision changes.

Style: original crisp top-down pixel art, moss/pine greens, indigo shadows, gray stone, restrained canonical amber #ff9b32. No copyrighted assets, labels or UI.

Sprite target: 16 equal cells, four columns of motion poses, directional rows south/north/west/east; stable ground anchor at 50% width / 87.5% height; full-body padding; requested transparent backgrounds. Generated dimensions, alpha, grid and anchors must be measured before declaring production readiness. No recolor variants or inferred semantic masks.

Generation settings revised at user request: standard 1K, medium quality. Updated FLORA estimate: $0.014 per image, $0.070 total for five images; not a price lock.

Status: prepared for cost approval and FLORA generation. Repository art:brief/art:run records WAITING_FOR_IMPLEMENTATION because environment/enemy runtime contracts, loaders and QA capabilities do not yet exist. External FLORA images are design candidates, not production atlas submissions. Preserve requests, run IDs, output URLs, costs and provenance. Runtime integration requires a reviewed adapter, isolated QA, all rubric criteria and explicit human art:approve before art:publish.
