# P1 "Into the Forest": scripted baseline evidence

Generated on 2026-11-03 by the Claude Code implementation agent. The run used a **clean checkout of commit `b62df73`**, the commit that adds P1, with this command:

```sh
node --import tsx scripts/midterm/prologue-situation.ts --baseline --out docs/midterm/evidence/p1-baseline
```

- **Player:** `baseline-quest` (scripted, route-aware). The route is disclosed in `packages/agent/src/policies/questKnowledge.ts` (`PROLOGUE`).
- **What it used:** it played only through the five operations. There were no model calls, no fixtures and no messages.

| Seed | Outcome | Game time | Decisions (Sieg / Coco) | Invalid | Start hash | End hash | Trace SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | success | 1,058 ticks (17.6 s) | 161 (104 / 57) | 0 | `688b2462…1530` | `c2f3b973…7e54` | `92884eb56d77e5074c0395b71d6d71cbb28750e4e1be79ff083c4e80c302f565` |
| 1 | success | 1,058 ticks (17.6 s) | 161 (104 / 57) | 0 | `e9922b16…0f12` | `30565934…87d3` | `c5c6eaaa4468252a7e3ffdcc38c4f1e87e607cc1da225f410408497fecf287da` |

- **Labels:** every summary carries `evaluation: { label: "P1", definitionHash: "baa6b04b7de3d56e479cbb092d5d8a10875a290c89748b836917e32a895f73ac" }`.
- **Checks:** the traces are hash-chained, and the script checked them against the frozen definition ("All checks passed").
- **Secret scan:** `scan_secrets.py` found 0 issues in 7 files.

This is a scripted reference, not a model result. No model player has run P1.
