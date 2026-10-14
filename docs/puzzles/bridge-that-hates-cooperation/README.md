# Puzzle Map 2 — The Bridge That Hates Cooperation

Approved October 14, 2026. Strictly top-down forest ruins, 30 × 48 tiles (960 × 1536 world pixels), six-tile bank routes, southern shared courtyard and northern castle exit. PixelLab MCP map: `384ece37-eb6a-4d30-b02a-5c2012fbc730`. The third bridge is removed and replaced by the distant river target.

Campaign position: immediately after the Monster Clearing wave. Defeat all enemies, then press E at the east exit to enter Puzzle Map 2.

## Required progression

1. Sieg physically pushes **one persistent boulder** from (288,1312) onto weight plate A at (288,1264). Coco hits the moving target's south-facing weak point from the front. Both conditions latch her first gate open; players standing on the plate supply no weight. An object-only retaining rail keeps the stone reachable at A until the first gate opens; it never moves the stone automatically.
2. Coco passes her gate and holds E at the golden switch (672,1088), permanently releasing Sieg's spike-corridor gate. Sieg retrieves the same stone by pushing it onward.
3. Sieg holds 1 (or the Push icon) plus movement to push the boulder through three sequential traps at y=1040,960,880, using Super Speed while Coco activates Slow Time. Each rectangular spike sled travels sideways from the west stone edge fully into the water and returns. Super Speed doubles pushing normally and restores normal pushing speed during 0.2 Slow Time. No auto-follow or ordinary checkpoint teleporting occurs.
4. The boulder alone activates golden weight plate B at (288,736). It supports the second bridge while weighted. Coco may reach the bridge center, but wards prevent crossing onto Sieg's bank.
5. Coco casts a frontal shot from the designated 40 × 40 center pad at (480,800) into the target at (480,416), replacing the third bridge. The center-to-center distance is 384 pixels / 12 tiles. A valid hit permanently opens both final gates and stabilizes bridge 2 regardless of later weight removal.
6. Both characters use their own bank entrances and hold opposite final switches together for 23 server ticks. The divider opens and they reunite at the castle exit; E continues to Forest Ruins.

## Movement and retries

The server owns boulder identity/position, target hits, plate occupancy, trap phases and all latches. Swept rectangular movement prevents the stone tunneling through walls, closed gates, bridge closures or other characters. Spike sweeps detect contact with moving or stationary stone; contact resets Sieg and the same boulder to the spike-trial start (288,1120), preserving completed first-gate and golden-switch unlocks. Sieg-only spike contact returns him to a clear entry position while leaving the boulder in place, so players cannot use a character hit to skip transporting it.

If bridge support disappears before the final target hit, occupants recover to safe bank landings. The boulder remains where it was physically pushed. Earlier trials stay complete. Restore plate B to retry. An occupancy collapse closes the bridge briefly without resetting earlier progress. Both remaining bridges meet the stone banks fully, including stone landing aprons.

Frontal target checks validate projectile velocity, server-captured cast origin and the south weak-point collision, so side/back hits and off-pad casts cannot complete the final trial. Clients never submit boulder positions, plate outcomes or puzzle completion.

## Artwork and verification

Raw generated assets remain in `Images/Maps/bridge-ruins/source`; runtime assets are in `apps/client/public/assets/environment/bridge-ruins`. No inpainting was used. The live client draws flat overhead ruin stones, forest canopies, role wards and glowing control links. The approved annotated layout remains in `proposals/persistent-boulder-layout.png`.

After building, `node --import tsx scripts/bridge-walkthrough.ts recording-directory` runs two real browser clients through the sequence using UI and keyboard intent only. `--no-video` performs the same gameplay verification without recording overhead. Tests cover plate type discrimination, frontal and long-range shots, boosted push speed, swept collisions, all three spike crossings, safe resets, permanent unlocks and matching authoritative multiplayer state.
