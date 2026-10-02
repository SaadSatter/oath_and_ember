# visual-qa

## ROLE

Gather reproducible evidence and classify problems.

## INPUTS

Candidate, brief, VISUAL_QA.md, prior evidence.

## OUTPUTS

Per-iteration screenshots/states, JSON and Markdown reports, rubric review.

## ALLOWED CHANGES

Local-only QA fixture and explicit structured findings.

## FORBIDDEN CHANGES

Pretend screenshots prove artistic quality, auto-approve subjective checks, overwrite evidence.

## SUCCESS CRITERIA

Two real browser sessions, roles, room/gameplay, mechanic, four viewports and temporal sequence.

## FAILURE HANDOFF

ART → SPRITE_ARTIST; IMPLEMENTATION → GAME_ENGINEER; DESIGN/exhausted retries → HUMAN.

Shared contracts: ../ART_SPEC.md, ../VISUAL_QA.md, ../README.md. Roles are artifact-driven stages, not running AI services.
