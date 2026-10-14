# Coco Flight

Flight is available from the start without skill points. Coco can fly for 20 seconds, then recharge for 7 seconds. The duration uses real server simulation time, including during Slow Time. Only explicitly authored water and canyon gaps are bypassed: solid walls, gates, objects, grass restrictions and puzzle wards remain obstacles. If the effect expires over a gap, the deterministic movement step restores her last safe position and invalidates old movement intents. Scene changes end flight and start its seven-second recovery.

The four supplied GIFs are looped with their authored frame durations, transparent green-matte removal, nearest-neighbor scaling, a common ground anchor, and a purple outfit palette mask. Source hashes and operations are recorded in `Images/Sprites/Coco/flight-provenance.json`. The supplied framed icons are cropped into Flight and Black Hole without recoloring; their original sheet and provenance are preserved beside Coco's sprites. Black Hole is now implemented separately; see `docs/black-hole/README.md`.

Number-key slots follow the visible ability bar independently for each hero:

- Sieg: 1 Push (hold), 2 Super Speed.
- Coco: 1 Slow Time, 2 Flight, 3 Black Hole.

Slots 4–9 are reserved for future abilities. J attack, K defense, E interaction for both heroes, Shift Super Speed, and T Slow Time remain available. F is also a Flight shortcut.

Verification: `apps/server/test/flight.test.ts` covers roles/availabilitys, real duration and cooldown, forward movement over gaps, solid obstacles, safe landing, preserved puzzle wards, and multiplayer protocol validation. `node --import tsx scripts/flight-qa.ts` drives two real clients through the UI, checks that the skill tree is absent, activates the starting movement abilities with number 2, captures all four wing directions, and rejects browser/asset errors. Screenshot results and the QA report live in this directory.
