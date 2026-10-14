# Forest ruins puzzle artwork

Generated with the user's connected PixelLab MCP for **The Bridge That Hates Cooperation**, map `384ece37-eb6a-4d30-b02a-5c2012fbc730`, October 13, 2026. Objects use basic transparent generation, no background image or inpainting. Original supplied character artwork is unchanged.

Raw downloaded PNGs and tileset JSON metadata are retained under `source/`. Runtime object files are lossless alpha-bound crops; the runtime horizontal bridge is cropped from `bridge-horizontal.png`. `ground.png` assembles 32px Wang tiles using their exact corner metadata. Runtime terrain, collision geometry and mechanisms are separate; artwork does not define authoritative physics.

| Source | PixelLab ID |
|---|---|
| Water / grass terrain | a5bd2e92-f30f-4941-9da0-9893d34adad0 |
| Grass / stone walkway terrain | a7ff6691-a995-4ec4-b6da-f7990c31f080 |
| Spike mechanism | b7456c52-6ad9-4b4d-b3f6-6a5f907109c7 |
| Pressure plate | 31da0dc8-93e5-4a6b-87c7-876149256204 |
| Gate | d208ac7e-edb3-442f-bdab-cd10d5c13c33 |
| Ranged lock target | 7ec7a65a-dd8c-4d9f-b856-69f5bda62191 |
| Final switch | c8cadc18-02f4-4300-a9f5-7b4e990df6ad |
| Inscription sign | 9fd2a6d9-0038-4fd6-8869-295ef51cbff4 |
| Original vertical bridge (preserved) | 44b5fa28-d25d-41a4-97e7-be1606d240c1 |
| Horizontal bridge | befb62b7-bb8c-47bd-9f7b-c3cb6292abec |
| Counterweight rock | 937b37d1-7095-4448-9e13-ec52c370702d |
| Temple | 39ac813e-2781-46d6-a667-833f98f1ce34 |
| Ruin wall | 43ab179c-cf20-4f8f-8849-6722b8c93c34 |

Runtime forest decorations reuse the project's approved `Tree1` texture with nearest-neighbor filtering. Native PixelLab map decorations use generated trees `51ab38f8-ee82-46ce-84ca-def195d0e661` and `3d3413e0-5196-452e-876e-bd35b6f3c306`.

## Approved persistent-boulder revision — October 14, 2026

Basic transparent object generation, without inpainting. Original attempts remain preserved; the empty plate is used so artwork never includes a second baked-in boulder.

| Live source | PixelLab ID |
|---|---|
| Persistent boulder | 8e9269ec-6fce-4f79-bf4b-2302a4ea85e2 |
| Sideways spike carriage | e408eb23-0bca-4315-be92-64b7ddbe61b7 |
| Empty golden weight plate | 563a946d-80f0-44fa-9bd1-e9e083ad14fc |
| Golden floor switch | 594c7d53-62f3-4563-a5df-7874b43d826d |
| Overhead barrier gate | e3dbb403-1418-46c6-9b26-7656e9edf5d0 |
| South weak-point target disc | 8842b49b-705c-4705-9595-bb7d6122de53 |
| Overhead forest canopy (native map) | 4449c0ff-e18d-4c82-bc3c-2ee3185c16b2 |

The live castle exit uses an original flat geometric floor glyph, and live forest/ruin decorations use original overhead geometric canopies and stones. Upright temple facade artwork is preserved as provenance but not rendered in this revision. The generated standing-door exit attempt (5728414f-0d20-4623-ba80-d21a801b31dd) and baked-rock plate attempt (e3569d7b-dac9-45cd-b87e-4e4fb11b20a3) are not used in the live map.

The native map's upright exit attempt was replaced with the flat exit rune `70c8a2ac-8670-4134-84bf-a666bc09ff01` (`source/exit-rune.png`). Raw canopy pixels are preserved at `source/overhead-tree.png`. The prior third bridge and old standing temple are no longer placed on the native map.

## Requested prop restoration — October 14, 2026

Superseding the visual choices above, the live persistent boulder now renders the original golden PixelLab counterweight (`937b37d1-7095-4448-9e13-ec52c370702d`, `source/weight.png`). The final exit renders the original PixelLab temple (`39ac813e-2781-46d6-a667-833f98f1ce34`, `source/temple.png`). Both are restored on the native map as well. Source artwork from earlier revisions remains preserved. Authoritative boulder identity, collision footprint, and exit conditions are unchanged. Coco's visible first gate requires a frontal moving-target hit and the boulder on plate A.

## Existing map trees — October 14, 2026

The live bridge puzzle now reuses the approved PixelLab fall and base trees from `post-town/transition_trail/object-29197f1c-aaf7-47e0-8f88-a786fcd15581.png` and `object-379c80d1-5c82-4ab8-b14d-98c2e88bb8b4.png`. Alternating trees replace the procedural side canopies, with nearest-neighbor filtering and trunk anchors. The surrounding grass remains blocked by the shared authoritative stone-path collision boundaries.
