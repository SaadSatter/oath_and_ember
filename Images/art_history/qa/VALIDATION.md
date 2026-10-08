# First-pass validation — 2026-10-02

- `coco_projectile_v1`: brief → WAITING_FOR_ART. No generated artwork or provider required.
- `coco_ward_v1`: existing runtime Ward submitted with provenance → exact-grid normalization → candidate → READY_FOR_QA → two-client evidence → NEEDS_HUMAN_REVIEW.
- Iteration 01 preserved the sandbox localhost/socket restriction as a structured implementation/infrastructure failure.
- Iteration 02 preserved a test-fixture failure: the isolated test workspace lacked newly required ART_SPEC.md. The test fixture was corrected.
- Iteration 03: typecheck passed; 62 tests in 11 files passed; production build passed (existing Vite bundle-size advisory). No browser errors.
- 64 screenshots: idle, start, mid-start, loop, next loop, end, mid-end and recovery on both clients at 1920×1080, 1440×900, 390×844 and 844×390.
- Authoritative state samples show two connected players and Coco's active defense during the held capture. Browser contexts use the real create/join/role/ready UI and runtime emerald recoloring.
- Both canvas bounds were checked at each size. The first runner's viewport check screenshot references point to client 2 for both clients; both were independently measured. The runner now cites each client's own screenshot for future runs. Original reports/evidence remain preserved.
- Desktop and portrait loop screenshots were spot-inspected: emerald hollow rim and separate Coco body visible. Full subjective rubric review remains outstanding.
- No asset approved or published; production sprites and gameplay code unchanged by this workflow work.

Open `coco_ward_v1/iteration-03/qa-report.json` and its summary; inspect contact sheet and both-client sequences with art/VISUAL_QA.md. Submit a seven-criterion human report using art:review, then explicitly approve/publish if satisfactory. A failure at the three-iteration limit needs a new brief/version with revised direction.

Workflow tests cover failure classification, evidence requirements, iteration bound, waiting/resume, invalid reference-sheet rejection, identity staging, preserved failed history, approval gating, source archival and approved-asset immutability. No automated semantic image judgments are claimed.
