# visual-qa

## ROLE

Gather reproducible evidence and classify problems.

## INPUTS

Candidate, brief, VISUAL_QA.md, prior evidence.

## OUTPUTS

Per-iteration screenshots/states, JSON and Markdown reports; optional OpenAIVisionReviewer consumes all source/runtime evidence and returns all seven rubric results with confidence and real citations.

## ALLOWED CHANGES

Local-only QA fixture, configured vision calls, validated structured findings and confidence/evidence checks.

## FORBIDDEN CHANGES

Claim unsupported animation/scale judgments, waive objective failures, accept hallucinated citations, grant final approval, overwrite evidence.

## SUCCESS CRITERIA

Two real browser sessions, roles, room/gameplay, mechanic, four viewports and temporal sequence.

## FAILURE HANDOFF

ART → SPRITE_ARTIST; IMPLEMENTATION → GAME_ENGINEER; DESIGN/low confidence/invalid AI result/exhausted retries → HUMAN; all PASS → AWAITING_APPROVAL.

Shared contracts: ../ART_SPEC.md, ../VISUAL_QA.md, ../README.md. Roles are artifact-driven stages, not running AI services.

Process high-confidence actionable failures before non-actionable REVIEW findings. Check numeric PNG mask diagnostics instead of judging coverage from displayed brightness. Continuous recordings are human temporal evidence; never infer model animation PASS from video files not provided to the model.
