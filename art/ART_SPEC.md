# Oath & Ember visual source of truth

Official names: **Sieg** (runtime OATH), **Coco** (runtime EMBER). Top-down exploration and platformer scenes share identity. Runtime presentation never changes server collision, damage, skills, position or cooldowns.

## Sieg

Physical swordsman / guardian. Dark hair, dark armor, default crimson scarf, sword, shield for Guard, grounded angular silhouette. Only scarf/cape palette is customizable. Do not recolor skin, hair, eyes, sword blade, or shield metal without an explicit brief.

## Coco

Mage / arcanist. Long dark hair, oversized witch-style hat, layered purple/indigo clothing, staff, magical silhouette. Outfit/hat and magic palettes are customizable. Skin, hair, eyes and staff structure remain unchanged.

## Palette and rendering contracts

Magic uses ONE canonical ember source palette (#ff9b32) with shading and runtime recoloring. Never generate orange/blue/violet/green/pink atlas variants. Existing mask convention: red = cloth; green = magic. Contracts explicitly select alpha-effect, semantic-external or no-mask strategies. Effect-only submissions may use green masks matching alpha-bearing effect pixels; character/equipment art must never derive semantic masks from atlas alpha. Unmasked pixels and alpha remain unchanged. Masks must be reviewed for semantic region accuracy; color checks cannot recognize skin or equipment.

Preserve nearest-neighbor rendering, transparent RGBA, stable per-frame canvas and anatomical ground anchors. No automatic bounding-box recentering: it causes foot jitter. Original geometric placeholders remain valid fallbacks. Use original or authorized artwork; do not introduce copyrighted game assets.

## Canonical references and current runtime

`references/index.json` points to existing files rather than duplicating large art:

- `Images/Character Concept art.png`: character identity.
- `Images/Sprites/Defense Basic Sprites.png`: defense reference sheet (not a production atlas).
- `docs/DEFENSE_ASSET_PROVENANCE.json`: reviewed extraction parameters.
- `apps/client/public/assets/characters/{oath,ember}`: current runtime sprites and masks.
- `Images/Sprites/Magic Basic Spell.png` and `docs/MAGIC_PROJECTILE_PROVENANCE.json`: magic reference/extraction.

Coco Ward is a single 128×128 hollow rim centered at (64,70), separate from her unchanged body. Existing presentation supplies start/held/end envelope; do not generate new character poses to replace it. Coco projectile flight is four 64×64 horizontal frames centered at (32,32); core/impact remain separate. Match existing animation definitions and scale. Changes to dimensions, anchors, ordering or timing require a reviewed integration adapter, never an improvised gameplay adjustment.

Sieg Shield uses the existing Guard character-and-equipment atlas, not a floating shield sprite: 47 row-major frames in 8 columns × 6 rows, 128×128 cells, foot anchor (64,96), last cell transparent. Preserve existing directional start/held/recovery/impact indexing and timing; left mirrors right. Its separate semantic red mask covers scarf/cape only; shield/sword metal and character protected regions remain unmasked.

The Director resolves `art/contracts.json` before generation. Compatible declarations use the reviewed fixed-grid normalizer and existing runtime/QA capability. Missing or unsafe capabilities route to Game Engineer with a preserved same-asset request; resume rechecks the contract. Do not guess new art direction or derive masks from arbitrary nontransparent pixels.
