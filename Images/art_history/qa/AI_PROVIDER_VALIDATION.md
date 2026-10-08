# AI provider upgrade validation — 2026-10-02

The existing architecture and Sieg/Coco official names versus OATH/EMBER runtime IDs are preserved. Changes extend the two provider stages and orchestration; no game client, gameplay, server authority or network protocol code was changed.

## Implemented

- Real OpenAI Images edits adapter with reference PNGs, canonical brief/art spec, structured ART feedback, transparent output and immutable generation attempts.
- Fixed-cell nearest-neighbor normalization and alpha-derived effect-only masks for Coco Ward/projectile flight. Other asset types require reviewed adapters.
- Real OpenAI Responses vision adapter using image inputs and a strict seven-criterion JSON schema.
- Evidence-path/category checks, model-reported confidence threshold, changed-candidate detection, refusal/incomplete-output handling, and final human approval gate.
- Bounded automatic regeneration only for ART failures. IMPLEMENTATION and DESIGN failures stop for their existing handoffs. Provider HTTP failures do not retry automatically.
- New art:generate / art:vision commands; existing art:run connects all enabled stages and resumes existing captures into their first vision review.
- Interrupted requests retain attempts and require explicit retry, avoiding silent duplicate paid calls.

## Checks performed

- `npm run typecheck`: PASS.
- `npm test`: PASS, 70 tests across 12 files. Includes existing real localhost multiplayer integration tests and 11 art workflow/provider tests.
- `npm run build`: PASS; existing Vite bundle-size advisory remains.
- Credentials-free provider tests inject fixture HTTP responses at the fetch boundary of the real adapters. They verify official endpoint URLs, multipart/reference/transparent image requests, Responses image/schema payloads, all 64 screenshot inputs, normalization, source preservation, evidence/confidence checks, failure routing, retry bounds and approval gates.
- A complete fixture-response loop exercised generation → candidate staging → synthetic browser evidence → vision ART failure → new generation → new iteration → vision PASS → AWAITING_APPROVAL. The synthetic image/review fixtures are test-only, not artistic validation.
- Actual existing Coco Ward iteration-03 packet loaded successfully: 70 images total, 64 runtime screenshots, four authoritative state sequences, 20 objective checks and verified candidate hashes. Original browser screenshots and reports were preserved.
- Existing manual waiting/resume behavior still passes. Missing credentials do not make an API request or consume a generation attempt.

## Live validation still needed

No OPENAI_API_KEY was configured during this upgrade. No paid image generation or model vision call was performed, and no AI artistic-quality PASS is claimed for Ward. The existing Ward remains NEEDS_HUMAN_REVIEW; projectile remains WAITING_FOR_ART. Nothing was automatically approved or published.

Enable either/both stages in art/providers.json, put OPENAI_API_KEY in ignored .env or the local environment, then use art:vision for existing Ward evidence or create a fresh version and art:run for generation. The account must support the configured models and modalities. Confidence is model-reported, not a calibrated guarantee. Explicit human art:approve remains required before publishing.
