# P1 "Into the Forest", revision 2: scripted baseline evidence

Generated on 2026-11-03 by the Claude Code implementation agent. The run used a **clean checkout of commit `28a28de`**, the commit that makes P1 revision 2, with this command:

```sh
node --import tsx scripts/midterm/prologue-situation.ts --baseline --out docs/midterm/evidence/p1-v2-baseline
```

- **Revision 2:** preset `P1-v2`, so episode ids are `P1-v2-<seed>-<start>`. Definition hash `7dfac8cd2b91b5d096328265a4eba068a8a86055750c204896394ebdc6b1a655`.
- **Revision 1's evidence** is in `../p1-baseline/` (generated at `b62df73`) and is unchanged.
- **Player:** `baseline-quest` (scripted, route-aware). The route is disclosed in `packages/agent/src/policies/questKnowledge.ts` (`PROLOGUE`).
- **What it used:** it played only through the five operations. There were no model calls, no fixtures and no messages.

| Seed | Outcome | Game time | Decisions (Sieg / Coco) | Invalid | Start hash | End hash | Trace SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | success | 1,058 ticks (17.6 s) | 161 (104 / 57) | 0 | `688b2462…1530` | `c2f3b973…7e54` | `a9b23419816c4ab3649e2ad230ffb3c14099d09f4eb86a5579ca031ff9f4f312` |
| 1 | success | 1,058 ticks (17.6 s) | 161 (104 / 57) | 0 | `e9922b16…0f12` | `30565934…87d3` | `d9dd1389df485bf935c9fc00508b9929797e9c4c3578c255fd5e849ec484a40e` |

- **Same as revision 1:** the outcome, ticks, decisions and end hashes. The world and the baseline's actions do not depend on the observation fixes.
- **Different from revision 1:** the traces' bytes, because the observations differ (Coco's view of the stairs; the fence opening's listing).
- **Checks:** the script checked these runs against the frozen definition ("All checks passed").
- **Secret scan:** `scan_secrets.py` found 0 issues in 7 files.

This is a scripted reference, not a model result. No model player has run P1.
