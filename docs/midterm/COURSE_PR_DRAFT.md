# Draft: course pull request (not opened)

Prepared on 2026-10-29 for the owner's approval. The course PR is **not opened**. The earlier Prince of Persia course PR #57 was closed, not merged, on 2026-10-29, so this is a new PR rather than a reopened one. Opening it needs the owner's decision and the professor's approval of the Oath and Ember scope (requirements checklist, "Submission").

## How to build it

```sh
# in a clone of columbia-university-ai-games/game-dev-f26 (or the owner's fork), on branch saadsatter/midterm
python3 -I <oath_and_ember checkout>/scripts/midterm/package_submission.py --dest . --rev <submitted commit> --replace
git add midterms/saadsatter .github/workflows/midterm-saadsatter.yml
```

The packager writes only `midterms/saadsatter/**` and `.github/workflows/midterm-saadsatter.yml`, the boundary the guidelines allow. Run it from the `oath_and_ember` checkout so that `git` reads that repository's commit. It refuses to overwrite a non-empty folder unless `--replace` is given.

## Title

`saadsatter midterm: Oath and Ember, the Bald Goddess episode with two AI players`

## Description

- **GitHub login:** saadsatter
- **Project:** Oath and Ember, an original two-player fantasy action-adventure. Its Bald Goddess episode (the goddess checkpoint to `chapter0.complete`) is played by two independent LLM players, one for Sieg and one for Coco, and compared with scripted baselines.
- **README:** `midterms/saadsatter/README.md`
- **Evaluation report:** `midterms/saadsatter/EVALUATION.md`
- **Agent team log:** `midterms/saadsatter/AGENT-TEAM.md`
- **Peer notes:** `midterms/saadsatter/PEER_NOTES.md`
- **Recording:** https://github.com/SaadSatter/oath_and_ember/blob/midterm/evaluation/docs/midterm/evidence/pilot-11-model-guided/replay.webm (a trace-verified replay of a real model run that succeeded; the `model-guided` player received a solution-informed Hedge Maze walkthrough, so it is not an unaided result)
- **CI:** `.github/workflows/midterm-saadsatter.yml`, deterministic checks only, no secrets.

## Open before this can be opened

- [ ] The professor's approval of the Oath and Ember scope.
- [ ] Final trials and the EVALUATION.md comparison filled in.
- [ ] AGENT-TEAM.md and the limitations paragraph rewritten in the owner's voice.
- [ ] Peer notes received and given.
- [ ] The generated sprites' terms confirmed for publication.
- [ ] The owner's choice of submitted commit.
