# P1 "Into the Forest", revision 4: scripted baseline evidence

Generated on 2026-11-04 by the Claude Code implementation agent, on the `midterm/evaluation` worktree after merging the game change `ffbdecb` (merge `ea654e8`). The worktree had uncommitted work in progress, so this is **not** a clean checkout. The command was:

```sh
node --import tsx scripts/midterm/prologue-situation.ts --baseline --out docs/midterm/evidence/p1-v4-baseline
```

- **Revision 4:** preset `P1-v3` (unchanged), so episode ids are still `P1-v3-<seed>-<start>`; the start hash in the id tells the revisions apart. Definition hash `be986cfa1767e26e5aa80a1304cd7d5ce7f1de1e81cb63e23e8df50409c5296d`.
- **Why a new revision.** `ffbdecb` added chapter 0 story lines that P1 never reaches. The world records a hash of all story content, so the start and end state hashes changed. The play itself did not: same ticks, decisions, views hash and outcome as revision 3.
- **Earlier revisions' evidence** is in `../p1-baseline/`, `../p1-v2-baseline/` and `../p1-v3-baseline/`, all unchanged.
- **Player:** `baseline-quest` (scripted, route-aware), only through the five operations: no model calls, no fixtures, no messages.

| Seed | Outcome | Game time | Decisions (Sieg / Coco) | Invalid | Start hash | End hash | Trace SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | success | 1,058 ticks (17.6 s) | 161 (104 / 57) | 0 | `e60f3526…d532` | `7aebea79…8a62` | `62a75257e27a56388c3a844f8d154695833e9f63893eefbba923ae81344d9153` |
| 1 | success | 1,058 ticks (17.6 s) | 161 (104 / 57) | 0 | `240103bd…a136` | `791fc1e8…` | `7f7bf08398adeae372d7298d87fea5f42d68a043a5c93c582fb17da83f213134` |

- **Checks:** the script checked these runs against the frozen definition ("All checks passed").
- **Not done:** no replay video and no secret scan were run for this folder.

This is a scripted reference, not a model result.
