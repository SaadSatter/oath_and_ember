# P1 "Into the Forest", revision 3: scripted baseline evidence

Generated on 2026-11-03 by the Claude Code implementation agent. The run used a **clean checkout of commit `702d715`**: revision 3 (`45e5148`) plus a fix to the check script. This is the commit the first live trial runs from. The command was:

```sh
node --import tsx scripts/midterm/prologue-situation.ts --baseline --out docs/midterm/evidence/p1-v3-baseline
```

- **Revision 3:** preset `P1-v3`, so episode ids are `P1-v3-<seed>-<start>`. Definition hash `05a2e7442d5271f04af135ddcfec687c23c756e3cc9e6894f43182dd0d7161aa`.
- **Earlier revisions' evidence** is in `../p1-baseline/` (revision 1) and `../p1-v2-baseline/` (revision 2), both unchanged.
- **Player:** `baseline-quest` (scripted, route-aware). It played only through the five operations: no model calls, no fixtures, no messages.

| Seed | Outcome | Game time | Decisions (Sieg / Coco) | Invalid | Start hash | End hash | Trace SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | success | 1,058 ticks (17.6 s) | 161 (104 / 57) | 0 | `688b2462…1530` | `c2f3b973…7e54` | `b5d674436442733940bfcf0efb526b47e45e8f4f4b0682dbc664fab577f35df6` |
| 1 | success | 1,058 ticks (17.6 s) | 161 (104 / 57) | 0 | `e9922b16…0f12` | `30565934…87d3` | `e62469e69da45b0e6e2144fe12b0761199cb51c11688690f68995372a007f96f` |

- **Checks:** the script checked these runs against the frozen definition ("All checks passed"). The hash chains of all six P1 baseline traces (revisions 1–3) were verified.
- **Recording check:** `replay-video.ts` on the seed-0 trace reported "REPLAY MATCHES THE TRACE" and saved a 1280×720 video (19.1 s at speed 2). That video is not committed.
- **Secret scan:** `scan_secrets.py` found 0 issues in 7 files.

This is a scripted reference, not a model result.
