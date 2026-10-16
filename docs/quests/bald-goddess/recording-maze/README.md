# Maze playthrough

`maze-playthrough.mp4` shows the full normal encounter from both real clients, side by side, at 2× simulation speed. Includes all five guards, the marked hedge, physical Black Hole cow movement, reactive runner chase with both abilities, key-gate use, shared shears collection and a walk back through the cleared maze.

The automation first plans ordinary movement, ability, combat and inventory intents against the authoritative simulation, resets the encounter, then replays those intents while recording the actual game clients. It does not teleport players, remove guards, alter HP/speeds, skip collision, or grant rewards. Normal game reset is used only before recording. Neutral browser input and the automatic simulation interval are suppressed in the recording harness so one fixed tick is applied per recorded intent frame. The production game code is unchanged.

`plan.json` retains the exact intent sequence. `report.json` records chapter times, final outcome and both original recordings. `completed.png` shows the acquired shared inventory item. Raw `.webm` files are preserved alongside the MP4.

To reproduce: build the game, run `node --import tsx scripts/maze-playthrough.ts`, then `python3 scripts/encode-maze-playthrough.py`. The encoder uses the same locally available ffmpeg binary as the earlier bridge recording workflow, with imageio-ffmpeg as a fallback.

Refreshed on 2026-10-15 using the current forest golem sprites, charged beam / two-tile blast and close-range punch. The driver verifies the route includes both golem attack modes; all five guards remain active.

Both views are aligned to the first recorded chapter caption at 24fps, rather than browser startup wall-clock estimates. The measured trims are retained as `captionSyncSeconds` in `report.json`. `scripts/sync-playthrough-captions.py` performs that measurement with NumPy and local ffmpeg.
