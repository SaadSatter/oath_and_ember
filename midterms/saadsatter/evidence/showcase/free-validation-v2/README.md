# Current showcase free validation — revision 2

Source code: `20d9d2813dc6f0c37a6fb3d420d049addec7a98d`. Supplementary demonstration only; excluded from official A/B/C results. No paid call or real ledger reservation. Revision-1 evidence in the neighboring `free-validation/` directory is historical and unchanged.

- Scripted baseline: success, 8,500 ticks / 141.7 game seconds, zero model calls; all 2,025 step results replay exactly.
- Real-damage recovery certification probe: success, two normal knockouts; full flags, backpack, claims and completed maze progress survive. All 2,085 results replay exactly. Its privileged engineering target is probe-only; this is not a fair player/baseline result. The probe summary is replay-identification metadata; `knockout-check.json` is the actual report.
- Mock planner: watchdog error, 144 simulated calls, zero spend; all 1,154 results replay exactly. This is neither a successful showcase nor a model evaluation.
- All nine original official A/B/C traces replay exactly. Frozen run-path identities and protected-path diffs are in `isolation.json`.
- Typecheck/build pass. Targeted tests: 53/53. Permitted suite: 1,355 pass, one known pre-existing failure at `s2Shutdown.test.ts:59` (recorder timeout wording), 139 files. Separate S1–S3 scripted group: six pass, one skip. Held-out/full-route tests were excluded.
- Baseline speed-1 replay matches trace hashes and paces 8,499 ticks over 141.65 wall seconds. The 8,500-tick episode includes one final accounting tick. Full video decode passes; the inspected terminal frame shows success and all Chapter 0 milestones. File decode duration is 152.84 seconds including overhead. The video remains local, identified by hash in `baseline-replay-video.json`; it is a baseline replay, not the model showcase or a 3–5 minute submission clip.
- Live acting can skip boundary waits; live capture timing remains a disclosed caveat. Use an explicitly labelled game-clock-paced replay alongside the unedited model capture. No shared game clock was changed.
- Scratch-copy reservation proves $2 fits pilot $2.130405 / total $19.127484 remaining; canonical ledger unchanged. Dispatch must recheck balances. Paid source flag remains false; guidance remains proposed.

`guidance-showcase-maze-griffin-v1.txt` and `planner-system-prompt.txt` preserve the exact current texts; hashes appear in `showcase-check.json`. `manifest.json` hashes every packaged file except itself. Gzip traces decode to the original bytes (uncompressed hashes in provenance). To replay, decode a trace into a scratch directory alongside its corresponding summary, then run `node --import tsx scripts/midterm/replay-video.ts <trace.jsonl> --check-only` from the repository. No provider is used.

Review dispositions, remaining risks and the exact proposed paid command: [showcase handoff](../../../../../docs/midterm/SHOWCASE_CONTINUOUS_EPISODE.md#10-codex-takeover-and-final-review-response-november-7-2026). This package records free checks only. Original reviewer provenance is preserved verbatim; Codex follow-up audit is same-session, not independent.
