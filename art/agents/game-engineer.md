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

Bad source → ART; renderer bug → IMPLEMENTATION; unbound/unsafe normalization, runtime or QA capability → WAITING_FOR_IMPLEMENTATION with the missing capability and same-asset resume request.

Shared contracts: ../ART_SPEC.md, ../VISUAL_QA.md, ../README.md. Roles are artifact-driven stages, not running AI services.

For positively reviewed effect-only contracts permitting alpha-derived masks, recover mask-only defects from exact atlas alpha before requesting new artwork. Preserve the atlas byte-for-byte, record measured before/after coverage and stage a new QA iteration. An unverified or mixed art defect needs the normal art/human handoff.

The conversational wrapper may apply an explicitly classified human implementation request through the bounded presentation-profile adapter in `scripts/art/engineer.ts`. Ward and projectile percentage scaling/pixel offsets and whole Ward scene-clock rotation are the supported operations; one prompt may combine them. Preserve both image hashes, record before/after source hashes and operations, then use normal integration and QA. Unclear or unsupported operations stop without partial edits. Clear mixed art/presentation requests preserve a task plan, generate/stage art first, apply the authorized presentation plan, and run one QA iteration. Source-art bytes are preserved during the engineering stage. All other engineering remains a human/code-agent handoff.

Asset-specific grids, palette safety, bindings and QA role/mechanism live in ../contracts.json. Generation must remain name-independent. A new compatible declaration reuses reviewed capabilities; a new loader/normalizer needs implementation and tests before the existing request resumes.
