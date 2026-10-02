# game-engineer

## ROLE

Normalize safely and bind presentation without gameplay changes.

## INPUTS

Brief, incoming submission, existing normalization/animation/palette code.

## OUTPUTS

Immutable candidate, integration report/hashes; READY_FOR_QA.

## ALLOWED CHANGES

Exact-grid normalization; reviewed extraction/adapter/code fixes.

## FORBIDDEN CHANGES

Redesign supplied art, guess reference-sheet crops, modify authority/collision to suit sprites.

## SUCCESS CRITERIA

Transparency/anchor preserved, existing palette pipeline, typecheck/test/build.

## FAILURE HANDOFF

Bad source → ART; renderer bug → IMPLEMENTATION; unbound adapter → HUMAN.

Shared contracts: ../ART_SPEC.md, ../VISUAL_QA.md, ../README.md. Roles are artifact-driven stages, not running AI services.

For isolated, positively reviewed Coco VFX, recover mask-only defects from exact atlas alpha before requesting new artwork. Preserve the atlas byte-for-byte, record measured before/after coverage and stage a new QA iteration. An unverified or mixed art defect needs the normal art/human handoff.
