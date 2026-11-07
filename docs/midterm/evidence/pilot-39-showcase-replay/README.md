# Pilot-39 continuous showcase — 4-minute replay video

[replay.webm](replay.webm): 1280×720, 247 s, 30.8 MB. Public link: https://github.com/SaadSatter/oath_and_ember/blob/midterm/evaluation/docs/midterm/evidence/pilot-39-showcase-replay/replay.webm

**This is a REPLAY of the recorded Pilot-39 actions, not the live capture.** No model calls were made, and it cost $0. `scripts/midterm/replay-video.ts` reset the same scenario and seed on the real game server and submitted each hero's recorded actions in order, paced on the game clock at speed 1. Every check matched the original trace:

- the start hash;
- all 1,428 step results;
- the end: `token_limit`, end hash `ba1e9a0b…`, tick 14,245.

See [replay-recording.json](replay-recording.json); trace SHA-256 `89942ff1…`. The live capture is about 99 minutes because it includes model thinking time. It stays local only (595 MB) and is identified by hash in [the preserved run](../../../../midterms/saadsatter/evidence/showcase/pilot-39-original/original-files.json).

What it shows: two AI players (one `model-centralized` planner on `gpt-6-luna`) start at the Goddess Shrine and:

- read the quest;
- clear the Hedge Maze for the Enchanted Shears;
- defeat the Griffin in combat;
- claim the wig;
- return, and have the offering accepted ("MY GLORIOUS BEAUTY HAS RETURNED!").

The run is **gameplay-complete**. Its recorded result is `success: false`: Coco's planner hit the 8M-token limit during the finale dialogue, so `chapter0.complete` was not reached. The video ends there.

Viewer caveat: each hero panel shows the game's human HUD hint line (for example, which ability to use on an obstacle). Those hints are **excluded from the AI players' observations** (`packages/agent/src/perception.ts`). The AI players never received them. The `acting:` line shows each hero's current recorded action.

Prompt-tuned demonstration, excluded from the official A/B/C evaluation. Not included in the course package (`MANIFEST.txt` excludes `*.webm`); the submission links to it in this repository.
