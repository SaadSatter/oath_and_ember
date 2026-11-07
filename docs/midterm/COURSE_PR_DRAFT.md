# Draft: course pull request (not opened)

Prepared on 2026-10-29 for the owner's approval and revised the same day for the Hedge Maze scope. The course PR is **not opened**. The earlier Prince of Persia course PR #57 was closed, not merged, on 2026-10-29, so this is a new PR rather than a reopened one. Opening it needs the owner's decision. The professor's approval of the Oath and Ember scope, and of the narrower Hedge Maze evaluation, is not recorded (requirements checklist, "Submission"; [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md)).

## How to build it

```sh
# in the oath_and_ember checkout: check the packaged evidence first
python3 -I scripts/midterm/collect_evidence.py --verify

# in a clone of columbia-university-ai-games/game-dev-f26 (or the owner's fork), on branch saadsatter/midterm
python3 -I <oath_and_ember checkout>/scripts/midterm/package_submission.py --dest . --rev <submitted commit> --replace
(cd midterms/saadsatter && python3 -I scripts/midterm/collect_evidence.py --verify)
git add midterms/saadsatter .github/workflows/midterm-saadsatter.yml
```

The packager writes only `midterms/saadsatter/**` and `.github/workflows/midterm-saadsatter.yml`, the boundary the guidelines allow. Run it from the `oath_and_ember` checkout so that `git` reads that repository's commit. It refuses to overwrite a non-empty folder unless `--replace` is given. The Hedge Maze traces and manifest in `midterms/saadsatter/evidence/` are copied with the folder; videos are not.

## Title

`saadsatter midterm: Oath and Ember, two AI players in the Hedge Maze`

## Description

- **GitHub login:** saadsatter
- **Project:** Oath and Ember, an original cooperative two-character fantasy action-adventure. The Bald Goddess quest is implemented and playable end to end.
- **Primary evaluated episode:** S2-local, the Hedge Maze. Sieg and Coco are controlled by independent players. The episode compares a solution-aware scripted reference (`baseline-quest`), walkthrough-guided LLM agents (`model-guided`) and unaided LLM agents with persistent memory (`model-memory`). The three policies do not have equal information.
- **Results (tuning stage, seed 0):** the scripted reference succeeds reproducibly (49.8 game-seconds, 0 invalid actions, four identical runs). The guided LLM pair succeeded 2 of 2 times (38.6 s, 44.0 s). The unaided pair completed 0 of 2: pilot 13 reached the key gate and was stopped by the owner; pilot 15 was interrupted at the cow puzzle. No held-out case has been run, and the gaps against the suite requirements are stated in the evaluation report.
- **README:** `midterms/saadsatter/README.md`
- **Evaluation report:** `midterms/saadsatter/EVALUATION.md`
- **Evidence:** `midterms/saadsatter/evidence/README.md` (traces, summaries, SHA-256 manifest)
- **Agent team log:** `midterms/saadsatter/AGENT-TEAM.md`
- **Peer notes:** `midterms/saadsatter/PEER_NOTES.md`. No class time was available for a classmate playtest, so an anonymous human playtest with friends serves as the peer notes; the professor allows a non-classmate playtester. Assisted play, disclosed.
- **Recording:** _owner to choose_. The current link is https://github.com/SaadSatter/oath_and_ember/blob/midterm/evaluation/docs/midterm/evidence/pilot-11-model-guided/replay.webm. It is a trace-verified **replay**, not a live capture, of the walkthrough-guided LLM pair succeeding, so it shows execution of a supplied solution. The other videos are listed in the evidence README with their delivery status.
- **Continuous showcase (excluded from A/B/C):** Pilot-39 is gameplay-complete. The AI pair cleared the Hedge Maze, defeated the Griffin in combat, claimed the wig and had the offering accepted in 236.4 game-seconds. The token limit then ended the run during the finale dialogue, so the recorded result is `success: false` (`chapter0.complete` not reached). Evidence: `midterms/saadsatter/evidence/showcase/pilot-39-original/`. **Recording:** https://github.com/SaadSatter/oath_and_ember/blob/midterm/evaluation/docs/midterm/evidence/pilot-39-showcase-replay/replay.webm (a 4-minute trace-verified replay of the recorded actions, no model calls).
- **CI:** `.github/workflows/midterm-saadsatter.yml`, deterministic checks only, no secrets.

## Open before this can be opened

- [ ] The professor's approval of the Oath and Ember scope and of the Hedge Maze-only evaluation, or an agreed reduced suite.
- [ ] Decide whether final trials (held-out S4/F, final seeds) run before submission, and fill in the comparison if so.
- [ ] Choose the submitted recording and deliver it somewhere the instructor, TAs and peers can open; verify the link.
- [ ] AGENT-TEAM.md and the limitations paragraph rewritten in the owner's voice.
- [ ] Peer notes received and given.
- [ ] The generated sprites' terms confirmed for publication.
- [ ] The owner's choice of submitted commit, then a fresh-clone rehearsal and CI run at that commit.
