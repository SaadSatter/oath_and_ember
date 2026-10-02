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
