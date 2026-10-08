import mossling from "../../public/assets/enemies/mossling/visual.json" with { type: "json" };
import wisp from "../../public/assets/enemies/cinder_wisp/visual.json" with { type: "json" };
import sentinel from "../../public/assets/enemies/ironbound_sentinel/visual.json" with { type: "json" };
// Plain runtime sprite metadata; source designs are preserved in Images/Sprites/monster_sprites.
export interface EnemyVisual {
  asset_id: string;
  url: string;
  frame_dimensions: number[];
  anchor: number[];
  directions: string[];
  x_edges: number[];
  animation_frames?: Record<string, number[]>;
  direction_aliases?: Record<
    string,
    { source_direction: string; flip_x: boolean }
  >;
  standing_frames?: Record<string, number>;
  direction_scales?: Record<string, number>;
  scale: number;
  fps: number;
  motion: string;
}
export const enemyVisuals: EnemyVisual[] = [mossling, wisp, sentinel];
