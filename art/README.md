# Visual development workflow

This framework coordinates four roles through files. Optional OpenAI API adapters now provide image generation and vision critique inside the same bounded filesystem pipeline. Manual mode remains the default; no continuously running agent services are introduced. Read `agents/*.md`, `ART_SPEC.md` and `VISUAL_QA.md` before performing a stage. No gameplay changes are permitted to accommodate art.

## Storage

- `references/index.json`: canonical paths, reusing existing large references in Images and approved runtime/provenance documents.
- `briefs`: versioned JSON generation contracts plus Markdown.
- `incoming/<asset_id>`: external art submission; `generated/attempt-NN` preserves each provider request, raw PNG, normalized atlas/mask, submission and response provenance.
- `qa/<asset_id>/iteration-NN`: immutable normalized candidate, contact sheet, browser screenshots, authoritative samples, logs, reports and summaries.
- `approved/<asset_id>`: explicit human-approved source, brief and provenance; previous runtime archived on publish.
- `manifest.json`: resumable state, dimensions/anchor, target bindings, hashes and report history.
- `apps/client/public/assets`: production runtime only. QA overlays a copied build in a separate preview root.

Generated screenshots/preview builds are ignored by Git. Keep reports and useful evidence together when archiving/sharing a run. The CLI writes atomically and permits one command at a time. After a crashed process, inspect `.pipeline-lock/owner.json`, confirm its PID is gone, then remove the stale lock. `ART_WORKSPACE_ROOT` isolates filesystem tests; ordinary use needs no configuration.

## Commands and Coco Ward example

```sh
npm run art:brief -- coco ward
npm run art:status
npm run art:run -- coco_ward_v1
```

The first two commands produce a versioned brief and WAITING_FOR_ART. Running again without files stays waiting. Later briefs increment `_v2`, `_v3`, etc. Use the returned ID, not an assumed version. `coco projectile` binds the existing four-frame flight atlas. Other requests draft a brief but require an engineer-reviewed adapter before integration or paid generation; they stop at human review.

Put these files in `art/incoming/coco_ward_v1/`:

```json
{
  "kind": "production_atlas",
  "image": "atlas.png",
  "mask": "mask.png",
  "frame_dimensions": [128, 128],
  "frame_count": 1,
  "anchor": [64, 70],
  "provenance": "Creator/source/license and extraction notes"
}
```

Save the JSON as `submission.json`. The atlas is a transparent horizontal frame strip; mask is an RGBA PNG of identical size, green only on effect regions. Coordinates are pixels in the fixed cell, not auto-detected bounds. Supplied art must already match the brief. Identity normalization preserves its pixels and transparency; no resizing/repainting occurs.

For an existing Ward validation, copy `apps/client/public/assets/characters/ember/defense.png` to `atlas.png`, and `defense-mask.png` to `mask.png`; cite `docs/DEFENSE_ASSET_PROVENANCE.json`. The repository includes that demonstration as an unapproved submission. Raw concept/reference sheets are rejected with ART feedback. Existing Python extraction scripts are asset-specific and often write production paths; an engineer should adapt them to output to incoming, inspect the crops, and submit an exact atlas. They are deliberately not auto-run against arbitrary images.

```sh
npm run art:integrate -- coco_ward_v1  # optional separate stage
npm run art:qa -- coco_ward_v1         # optional separate stage
# Or run advances integration and then QA:
npm run art:run -- coco_ward_v1
```

QA runs typecheck, tests and build, starts a local-only fixture with the existing in-memory game, opens isolated Sieg and Coco browser contexts, creates/joins a room through the real UI, selects roles and emerald magic palette, readies both and enters gameplay. The fixture grants existing skills and drives existing intents, without production gameplay changes. It captures idle/start/mid/held/end/recovered screenshots on both clients at 1920×1080, 1440×900, 390×844 and 844×390. Server state samples verify the requested mechanic is active. Screenshots show local Coco and remote Coco; errors and viewport clipping are objective checks. In manual mode, remaining visual criteria are explicit REVIEW items. With visual_qa enabled, a vision model evaluates the full evidence packet and produces validated findings; low confidence or unsupported claims still require human review.

Use installed system Chrome on macOS, or install Chromium once:

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/oath-ember-playwright npx playwright install chromium
```

Alternatively set `ART_QA_BROWSER_EXECUTABLE` to a Chromium executable. `ART_QA_PORT` defaults to 3015; occupied ports fail rather than attaching to another service. Dependencies require no provider credentials. QA startup failures produce structured IMPLEMENTATION feedback, not a false visual pass. Short sampled sequences supplement the contact sheet; inspect them together for temporal behavior. Continuous WebM recordings and phase timelines now accompany each browser run. Use `art:temporal` for native timestamped video frames; new captures also record browser callback cadence. Pixel comparison baselines remain a future addition.

## Review, revisions and approval

A successful manual evidence run stops at NEEDS_HUMAN_REVIEW. An enabled vision reviewer can instead produce AWAITING_APPROVAL, a classified failure, or NEEDS_HUMAN_REVIEW. AI PASS never publishes or grants final approval. Inspect every rubric item, then create a JSON review:

```json
{
  "checks": [
    {
      "id": "character_consistency",
      "result": "PASS",
      "evidence": "art/qa/coco_ward_v1/iteration-01/contact-sheet.png",
      "feedback": "Canonical body remains unchanged; reviewed rim only."
    },
    {
      "id": "animation",
      "result": "FAIL",
      "category": "IMPLEMENTATION",
      "evidence": "art/qa/coco_ward_v1/iteration-01/1920x1080-client-2-loop.png",
      "feedback": "Example only: renderer diameter measured 140px versus 100px target; reduce scale 40%."
    }
  ]
}
```

This abbreviated example is not ready to submit: include all seven IDs in VISUAL_QA.md, and cite actual evidence for this asset. Failures require category/evidence/feedback. Replace examples with observations; do not mark uninspected criteria PASS.

```sh
npm run art:review -- coco_ward_v1 /absolute/path/to/review.json
npm run art:revise -- coco_ward_v1
npm run art:run -- coco_ward_v1
```

ART failures route to SPRITE_ARTIST: revise incoming files externally. IMPLEMENTATION failures route to GAME_ENGINEER: fix the adapter/rendering code, then revise/run. DESIGN ambiguity routes to HUMAN. Reports retain every finding. `art:run` automatically regenerates ART failures when sprite_artist is enabled and budget remains. In manual mode it stops at the artist handoff. IMPLEMENTATION failures always stop for the engineer; DESIGN failures stop for human direction. It does not invent code repairs. `art:revise` allocates a new iteration on integration, retaining all previous files. At three integrations/failures the workflow requires revised human direction and a new brief. Approved assets cannot be reintegrated or revised; create a new version.

After objective checks and either validated AI critique or explicit human rubric review pass, status becomes AWAITING_APPROVAL:

```sh
npm run art:approve -- coco_ward_v1
npm run art:publish -- coco_ward_v1
```

Approval verifies candidate hashes and archives source/brief/provenance. Publish is a separate explicit action that replaces the bound runtime slot and first archives the previous atlas/mask. The demonstration is deliberately not approved or published. Always rerun relevant checks after production publishing.

## State machine and resume

BRIEF → WAITING_FOR_ART → [GENERATING_ART when enabled] → READY_FOR_INTEGRATION → INTEGRATING → READY_FOR_QA → (QA_FAILED_ART / QA_FAILED_IMPLEMENTATION / NEEDS_HUMAN_REVIEW / AWAITING_APPROVAL) → APPROVED.

`run` resumes READY_FOR_QA directly; it does not re-extract art. It stops at design/engineering/final-approval states, and at ART failures if generation is disabled or its budget is exhausted. A captured QA packet awaiting its first vision critique resumes directly into vision without another build or browser capture. `revise` explicitly returns failures to integration. Iteration reports cannot be overwritten. APPROVED is terminal for generation/integration, with an optional explicit publish.

## Enable AI generation and vision

The repository includes real API adapters, not simulated APIs. Choose each stage independently in `art/providers.json`:

```json
{
  "schema_version": 1,
  "sprite_artist": {
    "provider": "openai",
    "model": "gpt-image-1.5",
    "quality": "medium",
    "timeout_ms": 180000
  },
  "visual_qa": {
    "provider": "openai",
    "model": "gpt-4.1",
    "confidence_threshold": 0.85,
    "timeout_ms": 120000
  }
}
```

Both default to `manual` so existing external-art workflows keep working without credentials. Model IDs are configurable; the configured account must have access to image editing, transparent PNG output, and vision + structured outputs respectively. Put `OPENAI_API_KEY` in ignored `.env` or the shell environment; art commands load `.env` with Node's built-in loader. Never paste the key into a brief, provider config, screenshot report, or source control. API calls send the selected local references/screenshots to OpenAI and incur normal API usage. Models/settings, image hashes, response usage and request IDs are preserved; credentials/base64 request bodies are not logged.

```sh
npm run art:brief -- coco ward            # use the newly returned version ID
npm run art:run -- coco_ward_v2           # generate → integrate → capture → vision → bounded ART retry
npm run art:generate -- coco_ward_v2      # explicitly request/resume generation only
npm run art:vision -- coco_ward_v1        # critique existing iteration-03 evidence, without recapture
```

The previously validated Ward v1 remains unapproved and at its integration limit. Vision can review it without allocating another integration. A PASS waits for explicit `art:approve`; a failure at iteration 3 requires a new version/direction. Use a new brief for another generation cycle.

### Sprite Artist

`OpenAISpriteProvider` implements `SpriteGenerationProvider` via the official `POST /v1/images/edits` endpoint. It sends a 1024×1024 layout reference made from the existing effect, canonical references, the brief/art spec, and latest structured ART feedback. The first input establishes scale, frame order and anchors. Transparent PNG and one canonical ember palette are requested.

Automatic normalization is deliberately limited to **Coco Ward** and **Coco projectile flight**: both are isolated magic effects whose entire visible area may use the green palette mask. It never constructs character masks by tinting everything. Character animations, enemies and other effects need a reviewed adapter before auto-generation/integration.

Ward uses the entire square canvas at integer scale 8; projectile uses four scaled cells in the top row with unused canvas fully transparent. Fixed-cell nearest-neighbor sampling converts the declared grid to runtime resolution without silhouette-based recentering, guessed cropping, painting, or anchor changes. Off-grid pixels, opaque backgrounds or wrong canvas sizes become ART failures. The generated source is retained even when rejected. Exact grid requirements may be difficult for a generator; three failures stop for human direction rather than inventing crops.

The normalized mask is derived from alpha **only because these adapters forbid embedded character/equipment pixels**. Vision checks that restriction; semantic errors route to ART. The existing runtime palette system performs all recoloring.

### Vision critique

`OpenAIVisionReviewer` uses `POST /v1/responses` with image inputs and a strict JSON schema. Its packet contains all 64 original screenshots, source atlas/mask/contact sheet (plus raw generated sheet when available), canonical references, existing runtime reference, authoritative state samples, brief, art spec, rubric and previous feedback. It saves the packet index and SHA-256 image hashes.

It must evaluate every rubric ID exactly once. Findings include PASS/FAIL/REVIEW, category, confidence, actual evidence paths, and concise actionable feedback. The pipeline derives the overall outcome; the model cannot directly set manifest status. ART failures must cite candidate/source art. IMPLEMENTATION failures must cite runtime screenshots. Unseen paths, missing criteria, malformed/refused/incomplete responses, or confidence below the configured threshold produce human review. Vision cannot override objective QA failures or review a candidate modified after capture.

Sampled frames support comparisons and visible discontinuities, not a guarantee of smooth continuous animation. When evidence cannot establish timing, source of failure, numeric scale, or subjective direction, the reviewer must return DESIGN/REVIEW. Human approval remains the final authority.

### Retries and resume

- ART failures regenerate automatically only with the image provider enabled, within the existing three-iteration limit and a separate three-generation-attempt cap. Every retry gets a fresh directory. Objective image failures count toward the iteration budget.
- IMPLEMENTATION and DESIGN failures never trigger image generation or code changes.
- A missing key leaves generation at WAITING_FOR_ART and vision at human review, without making a request.
- HTTP errors/timeouts have no automatic HTTP retry. Preserve the error and inspect it: a timed-out request may already have been billed. After fixing configuration, retry explicitly with `art:generate` for a saved provider failure or `art:vision` for a vision failure. Vision has three attempts per captured iteration.
- A crash during vision leaves its saved attempt in place; `run` stops, and an explicit `art:vision` retry is required to avoid silently duplicating a paid request.
- A crash during generation leaves GENERATING_ART. `run` stops to avoid duplicate paid requests. `art:generate` recovers an existing completed submission without a new API call; otherwise it explicitly starts a new bounded attempt.
- `art:review` remains available for captured evidence when AI reasoning is unavailable or ambiguous. It cannot waive objective failures.

## Verification and current limitation

`npm run art:test` covers the real HTTP request contracts via injected fixture responses, source normalization, missing credentials, invalid/off-grid art, all-image vision packets, structured evidence/confidence validation, bounded ART regeneration, engineering/design stops, history, and approval gates. These deterministic tests never contact a live image/vision service.

No OPENAI_API_KEY was configured during this upgrade, so a live paid generation/vision run has not been verified. Existing browser Ward evidence is preserved and can be reviewed with `art:vision` once configured. This distinction is recorded in `qa/AI_PROVIDER_VALIDATION.md`.

Official API contracts: [image editing and transparency](https://developers.openai.com/api/docs/guides/image-generation), [vision inputs](https://developers.openai.com/api/docs/guides/images-vision), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Recovery before regeneration

Actionable high-confidence ART/IMPLEMENTATION failures now take precedence over non-actionable DESIGN/REVIEW findings. Low-confidence failures remain human-review items. The iteration cap and human-approval gate are unchanged; animation REVIEW is never converted to PASS to make a loop proceed.

Before regenerating an isolated Coco Ward/projectile atlas for a mask-coverage finding, recovery checks the PNG pixels and requires existing positive character-consistency/rendering/VFX findings. It compares every atlas alpha > 0 pixel against green mask coverage, including faint halos, and verifies candidate hashes. For a mask-only defect it builds `[0,255,0,255]` exactly where atlas alpha > 0, leaving atlas RGB/alpha/cells/anchors byte-for-byte unchanged. Other artwork defects, character masks and stale candidates do not qualify.

If all pixels are already covered, record NOT_REPRODUCED rather than pretending to fix the image or regenerating it. Stage a new verification iteration with measured diagnostics; retain the original model FAIL and all REVIEW findings. A repeated mask claim contradicted by exact pixel coverage goes to human adjudication, not endless regeneration. Actual pixel coverage does not prove semantic mask correctness or runtime recoloring; those criteria remain in the rubric.

```sh
npm run art:recover -- coco_ward_v4  # stage safe mask repair/verification from existing vision findings
npm run art:integrate -- coco_ward_v4
npm run art:capture -- coco_ward_v4  # tests/build + local browser evidence; no API calls
npm run art:vision -- coco_ward_v4   # new vision critique after capture
```

`art:run` performs the same recovery before regeneration when all enabled stages can run. Each new iteration preserves its own atlas/mask, recovery provenance, screenshots, timelines, recordings and reports. No production asset is overwritten.

## Temporal evidence and next step

Browser QA records both clients continuously at all four sizes using Playwright's video encoder (install with `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/oath-ember-playwright npx playwright install ffmpeg`). Named recordings and `temporal/index.json` cover lobby, entry, held effect, release and recovery; per-viewport phase timelines use approximate Node request timing, not video presentation timestamps. Actual recording dimensions match each viewport.

Run `npm run art:temporal -- coco_ward_v4` after capture, then `npm run art:vision -- coco_ward_v4` once external evidence upload is authorized. Extraction is local and additive: it preserves the candidate, QA iteration and recordings; rerunning refuses to overwrite `temporal/frames-v1`. Set `ART_FFMPEG_EXECUTABLE` for another FFmpeg executable; the default is the local Playwright encoder, which also decodes VP8 and exports PNG. Missing decoder/tool or empty windows fail before upload.

The current bounded packet adds 60 real frames from both desktop clients: three 800ms windows sampled at native intervals >=80ms near start-request, held-request and end-request. Frames carry video presentation timestamps, client, viewport and sequence; the adapter sends PNG bytes with these ordered labels, never WebM bytes. Candidate/video/frame hashes are checked before review. Laptop/mobile retain their existing still evidence. The original Node phase clock has an unknown offset from video start, so these labels are **approximate request hints**, not confirmed WARD_START/LOOP/END. Gaps cannot prove uninterrupted motion, precise transitions or absence of restarts. Unsupported animation judgments remain DESIGN/REVIEW; no animation PASS is manufactured.

New captures write per-client `*-cadence.json`: raw browser `requestAnimationFrame` timestamps, request markers in the same browser clock, visibility changes, median/max callback intervals and counts over 50ms. This measures callback scheduling under headless capture overhead, not actual game renders or display FPS; it is local engineering evidence, with no automatic pacing PASS. To evaluate true jank, the next instrumentation step is to correlate Phaser render-completion events and actual presentation-state transitions with decoded video timestamps using a synchronized capture marker. Legacy recordings have no such telemetry. Until that alignment exists, vision assesses only visible artifacts supported by the sampled sequences.

Synchronized Ward captures now include a QA-only frame/tick marker, per-client presentation samples and server tick history; see VISUAL_QA.md. The iteration-02 investigation is additive under `art/qa/coco_ward_v4/iteration-02/investigation-01`, preserving the original vision findings and candidate files. Correlate captured markers with exact server ticks before treating equal-PTS remote/local differences as an implementation bug.
