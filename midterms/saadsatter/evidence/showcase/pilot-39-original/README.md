# Pilot-39 — continuous showcase, gameplay-complete

Actual paid showcase run (`showcase-maze-griffin-complete-v1`, seed 0). Source `39a142b`. One `model-centralized` planner on OpenAI `gpt-6-luna`, medium effort, batch 4. Guidance `showcase-maze-griffin-v1`, positioning revision `ea5d75ba…`. Prompt-tuned demonstration, **excluded from the official A/B/C evaluation**. Owner-launched, no retry.

**Outcome: gameplay-complete; the recorded result is `success: false`, terminal reason `token_limit`.** Every gameplay objective was completed through normal play, in order:

| Milestone | Tick | Game-s |
| --- | --- | --- |
| Goddess opening quest received | 108 | 1.8 |
| Hedge Maze entered | 281 | 4.7 |
| Enchanted Shears obtained (maze complete) | 8,381 | 139.7 |
| Returned to the shrine | 8,969 | 149.5 |
| Griffin Enclosure entered | 9,235 | 153.9 |
| Griffin defeated in combat (HP 0) | 12,841 | 214.0 |
| Wig claimed at the nest after the defeat | 14,022 | 233.7 |
| Returned to the shrine with the wig | 14,039 | 234.0 |
| Offering accepted by the Goddess | 14,184 | 236.4 |

At tick 14,245 (237.4 game-s), 61 ticks after the offering was accepted, Coco's planner reached the owner-approved limit of 8,000,000 tokens per hero (8,013,449 counted; Sieg 6,503,224). The episode ended during the finale dialogue, at the Goddess's line "He was not alone. Someone accompanied him, though their face escapes me." So `chapter0.complete`, the scenario's declared success condition, was **not** reached. The remaining step was advancing the finale dialogue; no gameplay objective remained. The owner reports this run as **gameplay-complete**. The raw result is not relabelled.

Other facts: 542 model calls (247 Sieg, 295 Coco), none failed or timed out. 50 unusable replies. 2 invalid actions (Coco). One knockout: Coco in the Griffin Enclosure at 164.5 game-s, recovered by the game's normal respawn. 5,931 s wall time. The ledger settled $1.556206 (runner estimate from list prices with the 1.1 uplift, not the provider's bill).

Files: byte-identical copies of the run's records. The trace is gzip-compressed and decodes to the original bytes. `original-files.json` hashes every original, including the local-only 595 MB `recording.webm`, which is not committed. `replay.txt` records the exact replay check: start hash, all 1,428 step results, and the end (`token_limit`, tick 14,245) match the trace. No model calls were made in the replay.

How to read it: this is one demonstration run with prompt tuning informed by earlier failed runs (Pilot-37, Pilot-38). It is not evidence of reliability and is not pooled with A/B/C. The maze phase took 135 game-s here, against 89.5 s for the standalone Pilot-30.
