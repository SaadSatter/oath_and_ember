# Pilot-38 — original stopped cow attempt

Actual paid showcase, source `ec46864`, north-next prompt `1bd73ba9…` / full prompt `89f34d17…`. Manual stop at 65.5 game-s, 142 attempted calls, one failed/unknown-usage call, no knockout, no Shears or Griffin entry. Ledger conservative charge $0.362406; original cost/usage fields preserved. Excluded from official A/B/C. No automatic retry.

Trace verifies the cow never moved from (26,25). Coco repeatedly chose northeast Black Hole casts from below it. At tick 2028 its vortex was (23.78,30.18), 5.64 tiles from the cow, outside the manual's 3-tile pull radius. At tick 1996 the model combined a cast and go_to in one order, although the documented controller executes actions before walking. Previous Pilot-37 had a side cast; its observed vortex/cow separation was 2.04 tiles at tick 2149 and the cow visibly moved into the bay. diagnosis.json contains exact source line hashes and observed geometry.

No engine or controller regression found in the source diff between these two run commits. Fresh model planning is not persistent learning from an earlier success. This explains this observed failure; it does not prove all future casts will work. The specific collision that stopped the latest projectile early was not isolated.

Original source files are byte-identical copies; gzip trace decodes to original bytes. Original video remains untouched/local-only, identified by hash; no full decode/visual inspection of this paid recording is claimed. replay.txt records exact verification. No raw development-session transcript included. Subsequent generic positioning guidance is separate, proposed post-run tuning.
