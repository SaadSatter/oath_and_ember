# Course PR #92 description

**GitHub login:** SaadSatter (folder `midterms/saadsatter/`)
**Project:** Oath and Ember. An original cooperative two-hero fantasy action-adventure (TypeScript, authoritative Socket.IO game server). Two AI players, Sieg and Coco, play the Bald Goddess quest through a five-operation interface, compared against free scripted baselines.

## Contents

This PR adds only `midterms/saadsatter/` and one workflow, `.github/workflows/midterm-saadsatter.yml`.

- **The folder** was packaged from [SaadSatter/oath_and_ember](https://github.com/SaadSatter/oath_and_ember) commit `b4bedb9` by `scripts/midterm/package_submission.py`; see `SUBMITTED_COMMIT.txt`. It contains the game, the agent interface and players, the baselines, the tests, the agent configurations (`.claude/`, `.codex/`, `.agents/`), the reports and the trace evidence.
- **The workflow** runs only on changes under `midterms/saadsatter/**` (or the workflow file). It uses `working-directory: midterms/saadsatter` and needs no secrets. It runs `npm ci`, then typecheck, the deterministic tests and the build.
- **Videos** are not in the folder; the recording is linked below.

## Links

- [README](https://github.com/columbia-university-ai-games/game-dev-f26/blob/saadsatter/midterm-oath-and-ember/midterms/saadsatter/README.md): setup, play, test and evaluation commands from `midterms/saadsatter/`.
- [EVALUATION.md](https://github.com/columbia-university-ai-games/game-dev-f26/blob/saadsatter/midterm-oath-and-ember/midterms/saadsatter/EVALUATION.md): declared A/B/C suite (Hedge Maze; Griffin unprepared; Griffin prepared), each with pre-tuned model, post-tuned model and scripted baseline. All nine cells have a recorded outcome, failures included. Model: `gpt-6-luna`.
- [AGENT-TEAM.md](https://github.com/columbia-university-ai-games/game-dev-f26/blob/saadsatter/midterm-oath-and-ember/midterms/saadsatter/AGENT-TEAM.md): the agent team log, written by the student.
- [Peer notes](https://github.com/columbia-university-ai-games/game-dev-f26/blob/saadsatter/midterm-oath-and-ember/midterms/saadsatter/PEER_NOTES.md): no class time was available for the classmate playtest, so human playtests with friends serve as the peer notes; the professor allows a non-classmate playtester. Session 2 (7 November) was **unassisted** on the current build and reached Chapter 0 complete. Session 1 (2 November) was assisted, on an earlier build, and this is disclosed.
- **Recording (4 min): [Pilot-39 continuous showcase](https://drive.google.com/file/d/1gdwVPO4_xMDQnH0v7ETj5DDXnfqUBLcR/view?usp=drive_link).**
  - Two AI players start at the Goddess Shrine, clear the Hedge Maze, defeat the Griffin in combat, claim the wig and have the offering accepted.
  - It is a **replay** of the recorded actions, verified step by step against the trace, with no model calls; the live capture with model latency is about 99 minutes.
  - It is a prompt-tuned demonstration, excluded from the A/B/C comparison.
  - The run is **gameplay-complete**, but its recorded result is `success: false`: the token limit ended it during the finale dialogue, before `chapter0.complete`.
  - The viewer shows human HUD hints that the AI players never received.
- [Rule/source map](https://github.com/columbia-university-ai-games/game-dev-f26/blob/saadsatter/midterm-oath-and-ember/midterms/saadsatter/RULE_SOURCE_MAP.md) · [Evidence](https://github.com/columbia-university-ai-games/game-dev-f26/blob/saadsatter/midterm-oath-and-ember/midterms/saadsatter/evidence/README.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Recordings are hosted externally on Google Drive. The evaluation report links all nine primary A/B/C recordings; A pre-tuned is a trace-verified Pilot-28 replay at normal game speed (125.267 game-seconds), preserving the manual-stop failure. No video bytes are included in this course submission.
