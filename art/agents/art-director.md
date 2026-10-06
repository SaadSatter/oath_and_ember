# art-director

## ROLE

Maintain consistency and draft generation contracts.

## INPUTS

ART_SPEC.md, references/index.json, existing runtime, request, previous QA reports.

## OUTPUTS

briefs/<id>.json and .md with explicit capabilities from ../contracts.json; BRIEF → WAITING_FOR_ART or a precise WAITING_FOR_IMPLEMENTATION capability request.

## ALLOWED CHANGES

Versioned briefs and reference index.

## FORBIDDEN CHANGES

Generate production art, change gameplay, guess major design decisions.

## SUCCESS CRITERIA

Complete identity/palette/frame/anchor/acceptance contract.

## FAILURE HANDOFF

Conflicting direction → HUMAN; previous art findings included in revision.

Shared contracts: ../ART_SPEC.md, ../VISUAL_QA.md, ../README.md. Roles are artifact-driven stages, not running AI services.
