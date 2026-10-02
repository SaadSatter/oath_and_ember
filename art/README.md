# Visual development workflow

This framework coordinates four roles through files. It does not run autonomous agents or call an image service. Read `agents/*.md`, `ART_SPEC.md` and `VISUAL_QA.md` before performing a stage. No gameplay changes are permitted to accommodate art.

## Storage

- `references/index.json`: canonical paths, reusing existing large references in Images and approved runtime/provenance documents.
- `briefs`: versioned JSON generation contracts plus Markdown.
- `incoming/<asset_id>`: external art submission.
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

The first two commands produce a versioned brief and WAITING_FOR_ART. Running again without files stays waiting. Later briefs increment `_v2`, `_v3`, etc. Use the returned ID, not an assumed version. `coco projectile` binds the existing four-frame flight atlas. Other requests draft a brief but require an engineer-reviewed adapter before integration; they stop at human review.

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

QA runs typecheck, tests and build, starts a local-only fixture with the existing in-memory game, opens isolated Sieg and Coco browser contexts, creates/joins a room through the real UI, selects roles and emerald magic palette, readies both and enters gameplay. The fixture grants existing skills and drives existing intents, without production gameplay changes. It captures idle/start/mid/held/end/recovered screenshots on both clients at 1920×1080, 1440×900, 390×844 and 844×390. Server state samples verify the requested mechanic is active. Screenshots show local Coco and remote Coco; errors and viewport clipping are objective checks. Remaining visual criteria are explicit REVIEW items; automated screenshots do not recognize equipment drift or measure subjective scale.

Use installed system Chrome on macOS, or install Chromium once:

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/oath-ember-playwright npx playwright install chromium
```

Alternatively set `ART_QA_BROWSER_EXECUTABLE` to a Chromium executable. `ART_QA_PORT` defaults to 3015; occupied ports fail rather than attaching to another service. Dependencies require no provider credentials. QA startup failures produce structured IMPLEMENTATION feedback, not a false visual pass. Short sampled sequences supplement the contact sheet; inspect them together for temporal behavior. Continuous video and pixel comparison baselines are future additions.

## Review, revisions and approval

A successful evidence run stops at NEEDS_HUMAN_REVIEW. Inspect every rubric item, then create a JSON review:

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

ART failures route to SPRITE_ARTIST: revise incoming files externally. IMPLEMENTATION failures route to GAME_ENGINEER: fix the adapter/rendering code, then revise/run. DESIGN ambiguity routes to HUMAN. Reports retain every finding. `art:run` stops at these handoffs; it does not invent art/code repairs. `art:revise` allocates a new iteration on integration, retaining all previous files. At three integrations/failures the workflow requires revised human direction and a new brief. Approved assets cannot be reintegrated or revised; create a new version.

After all objective and human checks pass, status becomes AWAITING_APPROVAL:

```sh
npm run art:approve -- coco_ward_v1
npm run art:publish -- coco_ward_v1
```

Approval verifies candidate hashes and archives source/brief/provenance. Publish is a separate explicit action that replaces the bound runtime slot and first archives the previous atlas/mask. The demonstration is deliberately not approved or published. Always rerun relevant checks after production publishing.

## State machine and resume

BRIEF → WAITING_FOR_ART → READY_FOR_INTEGRATION → INTEGRATING → READY_FOR_QA → (QA_FAILED_ART / QA_FAILED_IMPLEMENTATION / NEEDS_HUMAN_REVIEW / AWAITING_APPROVAL) → APPROVED.

`run` resumes READY_FOR_QA directly; it does not re-extract art. It stops at review/failure/approval states. `revise` explicitly returns failures to integration. Iteration reports cannot be overwritten. APPROVED is terminal for generation/integration, with an optional explicit publish.

## Connecting a provider later

`scripts/art/model.ts` defines `SpriteGenerationProvider.generate(request): Promise<GeneratedAsset>`. Request includes brief/reference paths and structured feedback; response is a submission directory plus provenance. ManualProvider intentionally returns WAITING_FOR_ART. No provider is configured or automatically invoked in this iteration. A later adapter should validate its returned production submission, record provider/model/settings provenance, then call the same integration stage. ART retries must preserve bounded iterations; major direction changes still go to humans. Never add credentials to briefs/manifests or assume an image API exists.
