# Visual QA rubric

Objective validation and screenshots are evidence, not artistic approval. An optional AI reviewer may produce structured findings, subject to evidence and confidence validation. Explicit human approval remains required. Every applicable item must be reviewed; mark inapplicable items with a PASS and explanation. Review both clients across all four viewports, contact sheet and sequential frames. Ward body is unchanged; inspect its separate rim and envelope.

| Review ID             | Criteria                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| character_consistency | Canonical clothing, equipment, recognizable silhouette, proportions; staff/hat consistency across frames.                                           |
| animation             | Smooth ordered sequence, stable anchor/feet, appropriate timing, no restart on snapshots; inspect start/held/end sequences, not one still.          |
| rendering             | Transparency, no source or runtime clipping/background artifacts, crisp pixels, layer order, expected scale. Compare to brief and existing asset.   |
| vfx                   | Readable scale/orientation; effect does not obscure gameplay; hollow Ward leaves body visible.                                                      |
| palette               | Only intended regions change; preserved shading and identity; emerald captures use runtime recoloring from the single canonical source.             |
| multiplayer           | Coco local on client 2 and remote on client 1; both see identical intended presentation. Server snapshots show skill/mechanic, not client outcomes. |
| responsive            | Desktop 1920×1080, laptop 1440×900, portrait 390×844 and landscape 844×390 are readable.                                                            |

## Classification

ART → SPRITE_ARTIST: inconsistent design/equipment, missing frames, bad poses/anatomy, unsuitable VFX, unusable transparency, clipping already in source.
IMPLEMENTATION → GAME_ENGINEER: wrong crop/anchor/order/timing/scale/layering, palette recolors protected regions, remote animation absent, resize failure.
DESIGN → HUMAN: conflicting brief, unclear size or obscuration, technically correct but undesirable. Mixed art + implementation findings route art first; retain all findings. Actionable high-confidence ART/IMPLEMENTATION findings are processed before non-actionable DESIGN/REVIEW findings. Third failed iteration stops at human review.

Every failure needs category, actionable feedback and evidence path. Example: “Runtime effect diameter is 140 px versus brief 100 px (40% too large); source atlas matches target, reduce renderer scale” = IMPLEMENTATION. “Frames 4–5 replace Coco's staff head; visible in source contact sheet” = ART. Do not claim numerical size errors without a target and measurement.

Submit all seven review IDs with PASS/FAIL through `art:review`. PASS means a reviewer actually inspected the evidence. A failed objective check cannot be waived with a subjective review. Approval is a separate human command.

## AI review contract

The enabled vision provider sees the full source/reference/runtime packet, not filenames alone. All seven IDs are required exactly once with result, category (null for PASS), confidence 0–1, evidence paths and actionable feedback. It may cite only supplied image paths. ART must cite the candidate/source; IMPLEMENTATION must cite runtime evidence. Confidence below the configured threshold (default .85) turns the criterion into DESIGN/REVIEW. Model refusal, incomplete/malformed response and unseen evidence cannot produce PASS. Objective failures and changed candidate hashes block vision review.

Sampled temporal screenshots do not prove continuous smooth motion; return REVIEW for unsupported timing or numeric claims. All AI PASS produces AWAITING_APPROVAL, never APPROVED. API errors go to a human/configuration handoff rather than blaming the artist or triggering automatic HTTP retries.

## Mask coverage and temporal evidence

Mask coverage is an objective pixel measurement: green coverage at every atlas alpha > 0 pixel, no nontransparent mask outside the effect. Do not infer missing halo coverage solely from image brightness. Isolated effect masks may be deterministically rebuilt from a positively reviewed effect atlas; retain atlas bytes and create a fresh QA iteration. Complete coverage still requires semantic and runtime palette review. When model feedback conflicts with measured coverage, preserve both and seek human adjudication if the conflict persists.

`temporal/` includes continuous both-client WebM recordings and approximate phase-request timelines. Review videos for motion, holds and resets. After `art:temporal`, vision receives real decoded PNG frames in timestamp order, with client/viewport/sequence metadata. The current desktop windows carry approximate phase-request hints; they do not establish exact Ward phase transitions or uninterrupted holds across gaps. Recorded video availability alone is insufficient for animation PASS. New browser callback-cadence telemetry is engineering evidence, not proof of render FPS. True pacing QA still needs synchronized render-completion/presentation-state instrumentation. Return REVIEW for animation claims outside the supplied temporal coverage.

## Synchronized Ward investigation

New local captures install optional read-only Ward hooks. `PlayerView` reports the presentation phase and actual effect image visibility/alpha/position/texture after update; the harness records it at Phaser POST_RENDER. Each sample carries the client's received authoritative serverTick, Coco action/combat state and local/remote identity. The fixture archives server state after each tick. Compare against that exact tick, not a later HTTP state or another client's equal video PTS.

A QA-only overlay labels each captured screenshot/video with render ID (`F`), server tick (`T`), Ward phase, visibility and alpha. Look up the visible render ID in that client's `temporal/*-presentation.json`; compare it with `*-authority.json`. Screenshot `*-sync.json` files bracket capture with render IDs; they do not claim atomic screenshot timing. Equal video PTS across clients still do not establish equal authoritative moments. No hook or overlay is installed during normal production play.

The Ward investigation checks sustained guard after 30 authoritative ticks, requiring matched authority and adequate tick coverage. Missing held-state history, conflicting snapshots or insufficient coverage are inconclusive. Confirmed hidden held samples require engineering investigation; a non-reproduction is recorded as QA alignment error, retaining the original vision report and animation REVIEW. This is not an automatic smoothness/FPS or global animation PASS.

## Human decisions

An explicit `art:approve` may accept remaining REVIEW findings after complete objective/browser QA and all seven visual criteria have been reviewed. Preserve the model's REVIEW and record separate human acceptance; never rewrite it as AI PASS. Objective failures, unresolved classified FAIL, incomplete review and changed candidates remain blocked. Human art/code revision feedback and rejection are separate versioned decisions. Explicit human revision can authorize an iteration beyond the automatic retry cap without resetting history or enabling unbounded agent retries.
