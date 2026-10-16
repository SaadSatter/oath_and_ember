# Hedge Maze artwork provenance

Approved layout: `docs/quests/bald-goddess/layouts/02-hedge-maze.png`.

Reused PixelLab assets:
- Hedge wall: exact user-reference sprite reused from Grasslands `object-03e604f7-5274-4746-b761-19241d13b94d.png`, preserved as `source/hedge-wall.png` (64×64). Walls use full native-size sprites, with quadrant clips only at collision boundaries. The marked burnable hedge uses the same sprite with an amber tint. Collision and puzzle behavior are unchanged.
- Earlier berry bush `7f83ef96-6169-4127-b025-879f3c539650` remains preserved in `source/bush.png` for provenance; it is no longer used for the wall presentation.
- Grass and path: existing `transition_trail/texture-1.png` and `texture-0.png`, both 64×64, already deployed by the current map pipeline. Repeated at native scale.
- Gate: existing `bridge-ruins/overhead-gate.png`, rotated 90 degrees at native scale to span the maze gate.
- Mossling, Cinder Wisp, Ironbound Sentinel: existing approved enemy contracts and sprites, unchanged. The key carrier uses the existing Mossling appearance with a key indicator. The maze sentinel stays in its starter pose and has no attacks.

New PixelLab objects generated after map approval:
- Cow: selected frame 0 from review object `e7d543f6-577c-414b-826f-7d92def69781`; final object `4282fad7-f36e-42f0-ad7b-b82a9e42c0c2`; native 128×128; `source/cow.png`.
  Prompt: Strict overhead top-down view of one large calm dairy cow, cream white hide with dark brown patches, broad rounded body seen from above, tiny horns ears tail, facing south, friendly harmless grazing animal, original fantasy pixel art matching warm natural forest RPG props, transparent background, fills square frame. No ground, no accessories.
- Chest: selected frame 2 from review object `73b3f8b5-e4b7-4cf4-baff-02488a451da4`; final object `6266d845-8b8e-4550-8d58-6308e48bcd52`; native 64×64; `source/chest.png`.
  Prompt: One closed small treasure chest, strict overhead top-down view with only top lid visible, warm oak planks and antique golden metal bands with a tiny central emerald clasp, original fantasy forest ruins pixel art, transparent background, no ground no text, compact square silhouette.

Generated and reused originals are preserved here and copied into `apps/client/public/assets/environment/hedge-maze`. Inventory glyphs come from the separately approved inventory artwork and its provenance. No inpainting or full-map image generation was used. Collision geometry is authored separately in shared deterministic code and is never inferred from artwork. All sprites use nearest-neighbor filtering.


## User-provided directional hedge revision

The active maze walls now use the eight native 85×85 PNGs supplied in `Images/Sprites/It_is_a_bush_with_red_and_blue/It_is_a_bush_with_red_and_blue/rotations/`. PixelLab object ID `0819fae1-f611-43da-8b89-972bc67d1ea7`, group `a48e8810-9d7f-4299-b52d-c4f6497811c7`; original export metadata preserved alongside the source copies. Cardinal views follow horizontal / vertical path edges; diagonal views decorate corners. All use the same integer source anchor, nearest-neighbor filtering and native scale. Boundary quadrants are clipped inside the existing collision footprint; the server maze is unchanged. The burnable hedge uses the matching east view with its existing amber tint. Earlier source artwork remains preserved for provenance.

Density revision: shrubs overlap on a 24px lattice rather than one per 64px block. Native sprite size, directional views and integer anchors remain intact. Edge fragments are clipped to the existing solid maze cells so foliage does not occupy paths; gameplay geometry is unchanged.

Spacing refinement: the heavy 24px overlap is superseded by whole-sprite packing based on opaque foliage bounds (62px wide for horizontal views, 30–31px for vertical views; 45px rows). No per-cell wall cropping remains. Full native bushes touch along runs, with small natural canopy overhang at path edges; collision and traversal are unchanged. The burnable barrier also uses whole vertical shrubs.
