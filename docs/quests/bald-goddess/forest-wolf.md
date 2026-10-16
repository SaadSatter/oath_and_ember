# Forest wolf key carrier

Uses the supplied PixelLab Forest_Wolf export, preserved in Images/Sprites/monster_sprites/sources/forest-wolf/pixellab-export. Rebuild its four-direction, four-frame running sheet with scripts/import-forest-wolf.py using Pillow. Idle rotations and all original eight-direction artwork remain preserved. Nearest-neighbor rendering uses a stable 48,64 anchor on 96px cells (native 96px run frames; 64px idle views centered with transparent padding).

The authoritative maze actor detects either living, connected hero within 1000 pixels (ordinary guards reach at most 420). It selects navigable escape destinations maximizing distance from both detected heroes rather than following a patrol. It runs at 430px/s, rising to 560px/s when it detects boosted Sieg. Slow Time scales either speed by 0.2; boosted Sieg retains 190px/s during Slow Time, overtaking the wolf at 112px/s. Walls remain authoritative collision constraints. Sieg tags it with E while both abilities are active to award the single shared gate key. It is separate from the five combat guards.

Runner presentation now derives movement from successive authoritative positions. Stopped wolves use idle frames; run directions follow current movement. scripts/qa-wolf.ts checks all four running directions and stop transitions in both clients.
