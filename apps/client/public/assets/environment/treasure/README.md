# Treasure animations

Created with PixelLab for Oath and Ember on 2026-10-17.

- `chest-open.png`: nine 64×64 frames, left to right (the unchanged closed input followed by eight opening frames). PixelLab Animate Image job `dd65a1f1-ae31-4271-a2e1-3973c86d78aa`, Creator asset `4f480cdb-7d4b-5e9a-a7b8-ee95567f940e`. Source: the existing `../hedge-maze/chest.png`; its original artwork remains intact. The animation keeps the chest base fixed and ends open.
- `collect-shine.png` and `collect-shine.json`: PixelLab VFX Workbench, 16 frames of 36×39, 15 fps, a 4×4 sheet. Origin at (16, 25). Cream/gold Collect Pop and Item Glint parts. Effect `8c30eaff-bba9-4629-af15-a0470bad765a`, export `bdbaaff7-4a7b-474a-a136-9dea16baa41b`.
- [Editable shine in PixelLab](https://pixellab.ai/create-vfx?effect=8c30eaff-bba9-4629-af15-a0470bad765a).

The client opens a chest only after a shared inventory claim is confirmed, then raises the existing reward icon with this shine. It holds the final open frame on later visits and reconnects, without replaying the collection. Both players observe the claim. These assets and presentation timing do not affect collision, reward eligibility, inventory counts or the network protocol.

Visual QA: `node --import tsx scripts/qa-treasure-chests.ts` after `npm run build`. The server-only fixture captures both observers, both chests, the opening and reward, and the final open state after rejoining in `qa/treasure-chests/`.
