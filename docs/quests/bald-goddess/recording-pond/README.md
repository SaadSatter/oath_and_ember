# Mirror Pond playthrough

`pond-playthrough.mp4` shows both real browser clients side by side at 2× playback speed, with chapter captions. It begins at the normal Mirror Pond spawns, traverses Coco's water culvert and Sieg's spike entrance, rotates and restores all four mirrors, lights all four torches using reflected fireballs, raises the center platform and bridge, and reunites both heroes at the shared Vanity Mirror chest.

The recording driver submits ordinary movement, facing, ability and inventory interaction intents to the authoritative simulation. It does not teleport actors, grant items, set torch states or bypass collision. It plans the input sequence, resets to a fresh puzzle and replays the same intents while recording both clients. An isolated manual clock drives replay at 2×; browser neutral input is suppressed during the automated recording. Final assertions verify that the sanctuary is raised and exactly one shared mirror was awarded.

Reproduce after building:

```
node --import tsx scripts/pond-playthrough.ts
python3 scripts/encode-pond-playthrough.py
```

`report.json` contains chapter timestamps and recording provenance. This is a continuous playthrough, separate from the station fixtures in `scripts/qa-mirror-pond.ts`.

Refreshed on 2026-10-15 using the current full-360° hold-to-rotate mirrors, actual-angle reflection and supplied torch-flame animation.

Both views are aligned to the first recorded chapter caption at 24fps, rather than browser startup wall-clock estimates. The measured trims are retained as `captionSyncSeconds` in `report.json`. `scripts/sync-playthrough-captions.py` performs that measurement with NumPy and local ffmpeg.
