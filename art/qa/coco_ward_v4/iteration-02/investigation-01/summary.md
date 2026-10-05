# Coco Ward: synchronized multiplayer investigation

**NOT_REPRODUCED / QA alignment error.** No gameplay or Ward rendering behavior was changed. Optional read-only observation and QA-only markers were added; the original candidate atlas and mask hashes remain unchanged.

All four viewport captures completed with 18 objective browser checks passing. Across eight client/viewport streams, 5,033 samples of sustained authoritative guard matched the exact archived server tick, action/combat state and HP. Zero held samples had a hidden/zero-alpha/non-loop Ward. Both clients shared 245 desktop, 256 laptop, 81 portrait and 210 landscape held ticks. Every stream had zero unresolved held samples and zero state mismatches. A few idle snapshots before fixture seeding were unarchived and excluded explicitly.

The same native video PTS does not identify the same moment across clients. Decoded frames at PTS 30,000ms contain client 1 marker F=700/T=742 and client 2 marker F=634/T=722, a 20-server-tick difference. See pts-probe/markers.png and the source decoded frames. The visible markers correlate directly to the client presentation sample arrays and authoritative history. Original iteration-02 recordings lack markers, so their purported matched held frames cannot be established retrospectively.

No remote presentation fix is justified by this reproduction. The original vision report is preserved; investigation-disposition.json records its multiplayer failure as disputed/not reproduced and routes to human review. Animation remains REVIEW. This is not a claim of continuous smoothness, absence of every possible transient or true frame pacing: callback/render gaps under capture load remain explicit in the raw evidence.

Validation: typecheck passed; all 82 tests passed; build passed with the existing bundle-size advisory. Tests cover read-only actual Ward observation, legitimate release disappearance, reproduced hidden-held samples and missing/conflicting authority. The first concurrent test run timed out under recording load; after capture finished, the full unchanged-timeout suite passed.

Synchronized evidence lives under temporal/: per-client presentation arrays, per-viewport authoritative tick archives, callback cadence, videos and request timelines. Screenshot sync sidecars bracket capture; use the actual visible F marker rather than treating those brackets as atomic. The asset remains NEEDS_HUMAN_REVIEW in iteration 2, with no regeneration, approval or publication.
